import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const ORDER_INCLUDE = {
  address: true,
  items: {
    include: {
      variant: {
        include: {
          product: { select: { name: true, slug: true, images: { where: { isCover: true }, take: 1 } } },
        },
      },
    },
  },
  payments: { orderBy: { createdAt: 'desc' as const }, take: 1 },
  statusHistory: { orderBy: { createdAt: 'asc' as const } },
  promoCode: { select: { code: true } },
};

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          items: { select: { productName: true, quantity: true, lineTotal: true } },
          payments: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true } },
          // La cronologia serve anche in elenco: la pagina account espande l'ordine
          // li' dentro e non chiama il dettaglio, quindi senza questo il percorso
          // dell'ordine non si vedeva mai.
          statusHistory: { orderBy: { createdAt: 'asc' }, select: { status: true, note: true, createdAt: true } },
        },
      }),
      this.prisma.order.count({ where: { userId } }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(userId: string, id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new ForbiddenException();
    return order;
  }

  /**
   * Annulla un ordine **e disfa quello che il checkout aveva fatto**.
   *
   * Prima qui si cambiava solo lo status. Tutto il resto restava com'era: la merce rimaneva
   * scalata dal magazzino per sempre (bastava comprare l'ultimo pezzo e annullare per farlo
   * sparire dal catalogo), il `soldCount` continuava a contare una vendita mai avvenuta, il
   * codice promozionale restava consumato — se era uno di quelli usabili una volta sola,
   * l'utente lo perdeva senza aver comprato niente — e il pagamento restava `succeeded`,
   * senza traccia di alcun rimborso.
   */
  async cancelOrder(userId: string, id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true, promoCodeUses: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new ForbiddenException();

    const cancellableStatuses = ['pending', 'paid'];
    if (!cancellableStatuses.includes(order.status)) {
      throw new BadRequestException(
        `Cannot cancel an order with status "${order.status}". Only pending or paid orders can be cancelled.`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id }, data: { status: 'cancelled' } });
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          status: 'cancelled',
          changedBy: userId,
          note: "Cancellato dall'utente",
        },
      });

      // Giacenze e contatore di vendite, riga per riga.
      for (const item of order.items) {
        const variant = await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stockQty: { increment: item.quantity } },
          select: { productId: true },
        });
        await tx.product.update({
          where: { id: variant.productId },
          data: { soldCount: { decrement: item.quantity } },
        });
      }

      // Restituisce il codice promozionale: si scala il contatore globale e si cancella l'uso
      // registrato, che e' quello che impedisce di riusarlo.
      for (const use of order.promoCodeUses) {
        await tx.promoCode.update({
          where: { id: use.promoCodeId },
          data: { currentUses: { decrement: 1 } },
        });
        await tx.promoCodeUse.delete({ where: { id: use.id } });
      }

      // Il pagamento riuscito non si cancella (sarebbe riscrivere la storia): si segna come
      // rimborsato con l'importo, cosi' il registro resta leggibile.
      const payment = await tx.payment.findFirst({
        where: { orderId: id, status: 'succeeded' },
        orderBy: { createdAt: 'desc' },
      });
      if (payment) {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'refunded', refundedAmount: payment.amount },
        });
      }

      await tx.auditLog.create({
        data: {
          userId,
          action: 'order_cancel',
          entityType: 'order',
          entityId: id,
          newValue: {
            status: 'cancelled',
            stockRestored: order.items.length,
            promoReleased: order.promoCodeUses.length,
            paymentRefunded: Boolean(payment),
          },
        },
      });
    });

    return { id, status: 'cancelled' };
  }
}
