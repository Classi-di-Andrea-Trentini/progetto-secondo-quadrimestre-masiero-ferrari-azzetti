import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Gift card.
 *
 * I modelli `GiftCard` e `GiftCardTransaction` c'erano fin dall'inizio, insieme a
 * `Order.giftCardId` e `Cart.giftCardId`, e **non li usava nessuna riga di codice**:
 * si potevano emettere buoni che non erano spendibili da nessuna parte.
 *
 * Due cose vanno prese sul serio, perché qui si muovono soldi:
 *
 * 1. **Lo scalo avviene dentro la transazione dell'ordine.** Se l'ordine fallisce
 *    più avanti (giacenza finita fra un controllo e l'altro), il saldo torna su da
 *    solo con il rollback, invece di restare bruciato per un ordine mai nato.
 * 2. **Lo scalo è condizionale sul saldo.** Due checkout con lo stesso codice
 *    leggerebbero lo stesso saldo e lo spenderebbero due volte: la scrittura passa
 *    solo se il saldo c'è ancora nel momento in cui si scrive.
 */

export interface GiftCardCheck {
  giftCardId: string;
  code: string;
  balance: number;
  expiresAt: Date | null;
}

@Injectable()
export class GiftCardsService {
  constructor(private prisma: PrismaService) {}

  /** Saldo e validità di un codice, senza toccare niente. */
  async check(code: string): Promise<GiftCardCheck> {
    const card = await this.prisma.giftCard.findUnique({
      where: { code: code.trim().toUpperCase() },
      select: { id: true, code: true, currentBalance: true, expiresAt: true, isActive: true },
    });

    if (!card || !card.isActive) throw new NotFoundException('Gift card not found');
    if (card.expiresAt && card.expiresAt < new Date()) {
      throw new BadRequestException('This gift card has expired');
    }

    const balance = Number(card.currentBalance);
    if (balance <= 0) throw new BadRequestException('This gift card has no balance left');

    return { giftCardId: card.id, code: card.code, balance, expiresAt: card.expiresAt };
  }

  /**
   * Scala dalla gift card quanto serve, dentro una transazione già aperta.
   *
   * Non si scala mai più del dovuto: se il buono vale più dell'ordine, la
   * differenza resta sulla carta per la prossima volta.
   */
  async redeemWithin(
    tx: Prisma.TransactionClient,
    code: string,
    amountDue: number,
    orderId: string | null,
  ): Promise<{ giftCardId: string; applied: number; balanceAfter: number }> {
    const card = await tx.giftCard.findUnique({
      where: { code: code.trim().toUpperCase() },
      select: { id: true, currentBalance: true, expiresAt: true, isActive: true },
    });

    if (!card || !card.isActive) throw new NotFoundException('Gift card not found');
    if (card.expiresAt && card.expiresAt < new Date()) {
      throw new BadRequestException('This gift card has expired');
    }

    const balance = Number(card.currentBalance);
    const applied = Math.min(balance, Math.max(0, amountDue));
    if (applied <= 0) throw new BadRequestException('This gift card has no balance left');

    const balanceAfter = Math.round((balance - applied) * 100) / 100;

    // Scrittura condizionale: se un altro checkout ha speso il saldo nel frattempo,
    // qui non si aggiorna niente e la transazione dell'ordine viene annullata.
    const { count } = await tx.giftCard.updateMany({
      where: { id: card.id, currentBalance: { gte: applied } },
      data: { currentBalance: balanceAfter },
    });
    if (count === 0) {
      throw new BadRequestException('Gift card balance changed, please try again');
    }

    await tx.giftCardTransaction.create({
      data: {
        giftCardId: card.id,
        orderId,
        // Negativo perché è un utilizzo: il segno distingue lo scalo dalla ricarica.
        amount: -applied,
        balanceAfter,
        note: orderId ? 'Utilizzo su ordine' : 'Utilizzo',
      },
    });

    return { giftCardId: card.id, applied, balanceAfter };
  }

  /** Emissione da parte di un amministratore. */
  async issue(adminId: string, input: { amount: number; issuedTo?: string; expiresAt?: string; note?: string }) {
    if (!input.amount || input.amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    const card = await this.prisma.giftCard.create({
      data: {
        code: generateCode(),
        initialBalance: input.amount,
        currentBalance: input.amount,
        issuedTo: input.issuedTo ?? null,
        issuedBy: adminId,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        note: input.note ?? null,
      },
    });

    await this.prisma.giftCardTransaction.create({
      data: {
        giftCardId: card.id,
        amount: input.amount,
        balanceAfter: input.amount,
        note: 'Emissione',
      },
    });

    return card;
  }

  async list() {
    return this.prisma.giftCard.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        issuedToUser: { select: { email: true, fullName: true } },
        transactions: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
  }
}

/**
 * Codice leggibile a voce: niente `0`/`O` né `1`/`I`, che al telefono si confondono
 * e generano richieste di assistenza per un buono "che non funziona".
 */
function generateCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const pick = () =>
    Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  return `GC-${pick()}-${pick()}-${pick()}`;
}
