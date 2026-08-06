import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Punti fedeltà.
 *
 * Il saldo **non è un contatore**: è la somma dei movimenti. Un contatore tenuto a
 * parte prima o poi si scolla dalla storia — un accredito che parte due volte, uno
 * scalo che non viene scritto — e a quel punto non si sa più quale dei due numeri
 * sia quello giusto. Sommando, il saldo è per costruzione coerente con la lista dei
 * movimenti che si mostra al cliente.
 *
 * L'accredito è legato all'ordine con un vincolo unico su `(order_id, reason)`:
 * riprovare la stessa operazione non regala punti due volte.
 */

/** Un punto ogni euro speso, sull'imponibile: la spedizione non genera punti. */
const POINTS_PER_EURO = 1;
/** 100 punti = 1 euro di sconto. Rapporto tondo, facile da capire al checkout. */
const POINTS_PER_EURO_DISCOUNT = 100;
/** Sotto questa soglia lo sconto è irrisorio e complica il conto per niente. */
const MIN_REDEEMABLE = 500;

@Injectable()
export class LoyaltyService {
  constructor(private prisma: PrismaService) {}

  async balance(userId: string): Promise<number> {
    const result = await this.prisma.loyaltyEntry.aggregate({
      where: { userId },
      _sum: { points: true },
    });
    return result._sum.points ?? 0;
  }

  async history(userId: string, limit = 50) {
    return this.prisma.loyaltyEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
      select: { points: true, reason: true, orderId: true, createdAt: true },
    });
  }

  async summary(userId: string) {
    const balance = await this.balance(userId);
    return {
      balance,
      // Quanto vale davvero in euro, arrotondato per difetto: promettere 1,37 €
      // e poi scalarne 1,00 è il modo migliore per far arrabbiare qualcuno.
      value: Math.floor(balance / POINTS_PER_EURO_DISCOUNT),
      minRedeemable: MIN_REDEEMABLE,
      pointsPerEuro: POINTS_PER_EURO,
      pointsPerEuroDiscount: POINTS_PER_EURO_DISCOUNT,
      redeemable: balance >= MIN_REDEEMABLE,
    };
  }

  /**
   * Accredita i punti di un ordine, dentro la transazione che lo crea.
   *
   * Si contano sull'imponibile scontato e **senza spedizione**: pagare di più
   * perché si è scelto il corriere veloce non è fedeltà, è un costo.
   */
  async awardForOrder(
    tx: Prisma.TransactionClient,
    userId: string,
    orderId: string,
    eligibleAmount: number,
  ): Promise<number> {
    const points = Math.floor(Math.max(0, eligibleAmount) * POINTS_PER_EURO);
    if (points <= 0) return 0;

    await tx.loyaltyEntry.create({
      data: { userId, orderId, points, reason: 'Acquisto' },
    });
    return points;
  }

  /**
   * Converte punti in sconto, dentro la transazione dell'ordine.
   *
   * Lo scalo è condizionale sul saldo ricalcolato **dentro** la transazione: due
   * checkout in parallelo leggerebbero lo stesso saldo e lo spenderebbero due volte.
   */
  async redeemWithin(
    tx: Prisma.TransactionClient,
    userId: string,
    orderId: string,
    requestedPoints: number,
    maxDiscount: number,
  ): Promise<{ points: number; discount: number }> {
    const current = await tx.loyaltyEntry.aggregate({
      where: { userId },
      _sum: { points: true },
    });
    const balance = current._sum.points ?? 0;

    if (requestedPoints < MIN_REDEEMABLE) {
      throw new BadRequestException(`You need at least ${MIN_REDEEMABLE} points to redeem`);
    }
    if (requestedPoints > balance) {
      throw new BadRequestException(`Not enough points (balance ${balance})`);
    }

    // Non si scala più di quanto valga l'ordine: i punti in eccesso restano al
    // cliente invece di evaporare in uno sconto che non serve.
    const cappedByOrder = Math.min(
      requestedPoints,
      Math.floor(maxDiscount * POINTS_PER_EURO_DISCOUNT),
    );
    const usable = Math.floor(cappedByOrder / POINTS_PER_EURO_DISCOUNT) * POINTS_PER_EURO_DISCOUNT;
    if (usable <= 0) return { points: 0, discount: 0 };

    await tx.loyaltyEntry.create({
      data: { userId, orderId, points: -usable, reason: 'Sconto punti' },
    });

    return { points: usable, discount: usable / POINTS_PER_EURO_DISCOUNT };
  }
}
