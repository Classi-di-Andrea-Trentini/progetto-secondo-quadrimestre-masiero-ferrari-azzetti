import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PromoCodesService } from '../promo-codes/promo-codes.service';
import { MailService } from '../mail/mail.service';
import { CheckoutDto, ShippingMethod } from './dto/checkout.dto';
import { GiftCardsService } from '../gift-cards/gift-cards.service';
import { priceOf } from '../common/pricing';

const SHIPPING_COST: Record<ShippingMethod, number> = {
  [ShippingMethod.STANDARD]: 4.9,
  [ShippingMethod.EXPRESS]: 9.9,
};
const FREE_SHIPPING_THRESHOLD = 100;

@Injectable()
export class CheckoutService {
  constructor(
    private prisma: PrismaService,
    private promoSvc: PromoCodesService,
    private mailService: MailService,
    private giftCards: GiftCardsService,
  ) {}

  async placeOrder(userId: string, dto: CheckoutDto) {
    // 1. Verify address belongs to user
    const address = await this.prisma.userAddress.findUnique({ where: { id: dto.addressId } });
    if (!address) throw new NotFoundException('Address not found');
    if (address.userId !== userId) throw new ForbiddenException();

    // 2. Load and validate all variants
    const variants = await Promise.all(
      dto.items.map(async (item) => {
        const variant = await this.prisma.productVariant.findUnique({
          where: { id: item.variantId },
          include: {
            product: {
              include: {
                discounts: { where: { isActive: true }, take: 1 },
              },
            },
          },
        });
        if (!variant || !variant.isActive)
          throw new BadRequestException(`Variant ${item.variantId} not found`);
        if (variant.stockQty < item.quantity)
          throw new BadRequestException(
            `Insufficient stock for ${variant.product.name} (${variant.size ?? ''} ${variant.color ?? ''})`.trim(),
          );
        return { variant, quantity: item.quantity };
      }),
    );

    // 3. Calculate subtotal using DB prices (never trust client)
    const lineItems = variants.map(({ variant, quantity }) => {
      // Stessa funzione che usa il carrello: se le due formule divergessero, il
      // totale mostrato prima di pagare non combacerebbe con quello addebitato.
      const { originalPrice: basePrice, unitPrice } = priceOf(variant);
      const discountApplied = (basePrice - unitPrice) * quantity;
      const variantLabel = [variant.color, variant.size].filter(Boolean).join(' / ');
      return {
        variantId: variant.id,
        productName: variant.product.name,
        variantLabel: variantLabel || null,
        skuSnapshot: variant.sku,
        unitPrice: Math.round(unitPrice * 100) / 100,
        quantity,
        discountApplied: Math.round(discountApplied * 100) / 100,
        lineTotal: Math.round(unitPrice * quantity * 100) / 100,
      };
    });

    const subtotal = lineItems.reduce((s, i) => s + i.lineTotal, 0);

    // 4. Apply promo code
    let discountTotal = 0;
    let promoCodeId: string | null = null;
    let promoDiscountValue = 0;

    if (dto.promoCode) {
      const promo = await this.promoSvc.validate(dto.promoCode, subtotal, userId);
      discountTotal = promo.discountValue;
      promoCodeId = promo.promoCodeId;
      promoDiscountValue = promo.discountValue;
    }

    // 5. Shipping
    const method = dto.shippingMethod ?? ShippingMethod.STANDARD;
    const shippingCost = subtotal - discountTotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST[method];

    // 6. Total
    const total = Math.max(0, subtotal - discountTotal + shippingCost);

    // La gift card si scala **dopo** sconti e spedizione, sul dovuto reale: scalarla
    // prima farebbe pagare al cliente una spedizione che il buono avrebbe coperto.
    // Il saldo si tocca solo dentro la transazione, cosi' un ordine che fallisce piu'
    // avanti non brucia il credito.

    // 7. Create order in a transaction
    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          userId,
          addressId: dto.addressId,
          status: 'pending',
          subtotal,
          discountTotal,
          shippingCost,
          total,
          promoCodeId,
          shippingMethod: method,
          notes: dto.notes,
          items: { create: lineItems },
        },
        include: {
          items: true,
          address: true,
        },
      });

      // Status history entry
      await tx.orderStatusHistory.create({
        data: { orderId: created.id, status: 'pending', changedBy: userId },
      });

      // Gift card: scala quanto serve e annota l'utilizzo sull'ordine.
      let giftCardApplied = 0;
      if (dto.giftCardCode) {
        const redeemed = await this.giftCards.redeemWithin(tx, dto.giftCardCode, total, created.id);
        giftCardApplied = redeemed.applied;
        await tx.order.update({
          where: { id: created.id },
          data: { giftCardId: redeemed.giftCardId, giftCardAmount: redeemed.applied },
        });
      }

      // Quello che resta da incassare col metodo di pagamento vero.
      const amountToCharge = Math.round((total - giftCardApplied) * 100) / 100;

      // Mock payment (immediately succeeded — real Stripe hook would update this)
      await tx.payment.create({
        data: {
          orderId: created.id,
          userId,
          status: 'succeeded',
          // Coperto interamente dal buono: il metodo lo dice, invece di far figurare
          // una carta che non e' stata usata.
          method: amountToCharge > 0 ? 'credit_card' : 'gift_card',
          amount: amountToCharge,
          paidAt: new Date(),
        },
      });

      // Move order to 'paid' + log history
      await tx.order.update({ where: { id: created.id }, data: { status: 'paid' } });
      await tx.orderStatusHistory.create({
        data: { orderId: created.id, status: 'paid', changedBy: userId, note: 'Mock payment succeeded' },
      });

      // Decrement stock.
      //
      // Il controllo fatto al punto 2 non basta: due checkout concorrenti sull'ultimo pezzo
      // leggono entrambi stockQty=1, entrano entrambi nella propria transazione e decrementano
      // entrambi, lasciando la giacenza a -1 (venduto piu' di quanto c'era). Qui il decremento
      // e' condizionale: `updateMany` con `stockQty: { gte: quantity }` tocca la riga solo se
      // la giacenza c'e' ancora nel momento della scrittura, e `count === 0` vuol dire che
      // qualcun altro e' arrivato prima — si lancia e la transazione fa rollback di tutto.
      for (const { variant, quantity } of variants) {
        const { count } = await tx.productVariant.updateMany({
          where: { id: variant.id, stockQty: { gte: quantity } },
          data: { stockQty: { decrement: quantity } },
        });
        if (count === 0) {
          throw new BadRequestException(
            `Insufficient stock for ${variant.product.name} (${variant.size ?? ''} ${variant.color ?? ''})`.trim(),
          );
        }
      }

      // Il carrello si svuota qui dentro, non dal client dopo la risposta: se la
      // chiamata di svuotamento fallisse, il cliente resterebbe con l'ordine gia'
      // fatto e il carrello ancora pieno, pronto a comprare due volte.
      const cart = await tx.cart.findUnique({ where: { userId }, select: { id: true } });
      if (cart) {
        for (const { variant, quantity } of variants) {
          const line = await tx.cartItem.findUnique({
            where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } },
            select: { id: true, quantity: true },
          });
          if (!line) continue;

          // Si scala la quantita' ordinata, non si cancella la riga: chi ne aveva tre
          // nel carrello e ne ordina uno deve ritrovarsi gli altri due.
          if (line.quantity > quantity) {
            await tx.cartItem.update({
              where: { id: line.id },
              data: { quantity: line.quantity - quantity },
            });
          } else {
            await tx.cartItem.delete({ where: { id: line.id } });
          }
        }
      }

      // Increment soldCount on each product
      const productQtyMap = new Map<string, number>();
      variants.forEach(({ variant, quantity }) => {
        productQtyMap.set(variant.product.id, (productQtyMap.get(variant.product.id) ?? 0) + quantity);
      });
      await Promise.all(
        Array.from(productQtyMap.entries()).map(([productId, qty]) =>
          tx.product.update({
            where: { id: productId },
            data: { soldCount: { increment: qty } },
          }),
        ),
      );

      // Record promo code use and increment counter
      if (promoCodeId) {
        await tx.promoCodeUse.create({
          data: { promoCodeId, userId, orderId: created.id, discountValue: promoDiscountValue },
        });
        await tx.promoCode.update({
          where: { id: promoCodeId },
          data: { currentUses: { increment: 1 } },
        });
      }

      return created;
    });

    // Invia email di conferma ordine (fire-and-forget)
    this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true },
    }).then((user) => {
      if (user) {
        this.mailService.sendOrderConfirmation(user.email, user.fullName, {
          id: order.id,
          items: order.items.map((i) => ({
            productName: i.productName,
            quantity: i.quantity,
            lineTotal: i.lineTotal,
          })),
          total,
        }).catch(() => {});
      }
    }).catch(() => {});

    return { orderId: order.id, total, status: 'paid' };
  }
}
