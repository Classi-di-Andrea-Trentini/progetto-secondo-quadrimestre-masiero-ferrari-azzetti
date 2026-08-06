import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

/**
 * "Avvisami quando torna disponibile".
 *
 * È la richiesta che un cliente fa quando trova la taglia giusta esaurita: senza,
 * quella visita è persa e non torna. La riga resta anche dopo l'invio, così si sa
 * quanta domanda c'era per una variante che non c'era — un dato che serve a chi
 * decide i riordini.
 */
@Injectable()
export class StockAlertsService {
  private readonly logger = new Logger(StockAlertsService.name);

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  async subscribe(userId: string, variantId: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      select: { id: true, stockQty: true, isActive: true },
    });
    if (!variant || !variant.isActive) throw new NotFoundException('Variant not available');
    // Iscriversi a qualcosa che c'e' gia' non ha senso e lascerebbe una riga che
    // non partira' mai: meglio dirlo subito.
    if (variant.stockQty > 0) {
      throw new BadRequestException('This item is already in stock');
    }

    // `upsert` perche' chi clicca due volte non deve ricevere due email ne' vedere
    // un errore: la seconda volta e' semplicemente gia' iscritto.
    await this.prisma.stockAlert.upsert({
      where: { userId_variantId: { userId, variantId } },
      create: { userId, variantId },
      update: { notifiedAt: null },
    });

    return { subscribed: true };
  }

  async unsubscribe(userId: string, variantId: string) {
    await this.prisma.stockAlert.deleteMany({ where: { userId, variantId } });
    return { subscribed: false };
  }

  /** Le varianti per cui questo utente aspetta un avviso non ancora partito. */
  async mine(userId: string) {
    const alerts = await this.prisma.stockAlert.findMany({
      where: { userId, notifiedAt: null },
      include: {
        variant: {
          include: { product: { select: { name: true, slug: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return alerts.map((alert) => ({
      variantId: alert.variantId,
      productName: alert.variant.product.name,
      slug: alert.variant.product.slug,
      label: [alert.variant.color, alert.variant.size].filter(Boolean).join(' / ') || null,
      stockQty: alert.variant.stockQty,
      createdAt: alert.createdAt,
    }));
  }

  /**
   * Avvisa chi aspettava questa variante.
   *
   * Va chiamata **dopo** che la giacenza è già stata scritta, altrimenti si manda
   * un'email che invita a comprare qualcosa che ancora non c'è. Gli invii non
   * bloccano né fanno fallire l'operazione che li ha innescati: una email che non
   * parte non deve annullare un carico di magazzino.
   */
  async notifyBackInStock(variantId: string): Promise<number> {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: { select: { name: true, slug: true } } },
    });
    if (!variant || variant.stockQty <= 0) return 0;

    const pending = await this.prisma.stockAlert.findMany({
      where: { variantId, notifiedAt: null },
      include: { user: { select: { email: true, fullName: true } } },
    });
    if (pending.length === 0) return 0;

    const label = [variant.color, variant.size].filter(Boolean).join(' / ');
    const url = `${process.env.FRONTEND_URL ?? ''}/product/${variant.product.slug}`;

    for (const alert of pending) {
      try {
        await this.mail.sendBackInStock(
          alert.user.email,
          alert.user.fullName ?? '',
          variant.product.name,
          label,
          url,
        );
      } catch (error) {
        this.logger.warn(`Back-in-stock email failed for ${alert.user.email}: ${error}`);
      }
    }

    // Segnati come inviati comunque: riprovare all'infinito su un indirizzo morto
    // significa rimandare l'email a ogni carico di magazzino, per sempre.
    await this.prisma.stockAlert.updateMany({
      where: { id: { in: pending.map((alert) => alert.id) } },
      data: { notifiedAt: new Date() },
    });

    return pending.length;
  }

  /** Quante persone aspettano una variante: utile a chi decide i riordini. */
  async demand(variantIds: string[]) {
    if (variantIds.length === 0) return new Map<string, number>();
    const grouped = await this.prisma.stockAlert.groupBy({
      by: ['variantId'],
      where: { variantId: { in: variantIds }, notifiedAt: null },
      _count: { _all: true },
    });
    return new Map(grouped.map((row) => [row.variantId, row._count._all]));
  }
}
