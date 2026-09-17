import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { priceOf } from '../common/pricing';
import { AddCartItemDto, MAX_QUANTITY_PER_ITEM } from './dto/cart.dto';

/**
 * Carrello lato server.
 *
 * Prima il carrello viveva solo nel browser: le tabelle `carts` e `cart_items`
 * esistevano nello schema ma **non le usava nessuno**. Le conseguenze erano tre:
 * il carrello non seguiva l'utente da telefono a computer, spariva svuotando i
 * dati del browser, e non c'era modo di sapere chi aveva lasciato qualcosa dentro
 * — quindi nessun recupero del carrello abbandonato.
 *
 * I prezzi non arrivano mai dal client: si rileggono dal database a ogni lettura
 * del carrello, così uno sconto scaduto o un rincaro si vedono subito invece di
 * saltare fuori al momento di pagare.
 */

/** Le varianti servono sempre col prodotto e i suoi sconti, per calcolare il prezzo. */
const VARIANT_INCLUDE = {
  variant: {
    include: {
      product: {
        include: {
          discounts: { where: { isActive: true }, take: 1 },
          images: { where: { isCover: true }, take: 1 },
        },
      },
    },
  },
} as const;

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  async getCart(userId: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: { items: { include: VARIANT_INCLUDE, orderBy: { addedAt: 'asc' } } },
    });

    if (!cart) return this.emptyCart();

    const items = cart.items.map((item) => {
      const { variant } = item;
      const { originalPrice, unitPrice, discountLabel } = priceOf(variant);
      // La disponibilità può essere calata da quando la riga è stata aggiunta:
      // si segnala qui invece di far fallire il checkout senza spiegazioni.
      const available = Math.min(item.quantity, variant.stockQty);

      return {
        variantId: variant.id,
        productId: variant.productId,
        productName: variant.product.name,
        slug: variant.product.slug,
        variantLabel: [variant.color, variant.size].filter(Boolean).join(' / ') || null,
        size: variant.size,
        color: variant.color,
        colorHex: variant.colorHex,
        imageUrl: variant.product.images[0]?.url ?? null,
        unitPrice,
        originalPrice,
        discountLabel,
        quantity: item.quantity,
        stockQty: variant.stockQty,
        /** `false` quando lo stock non copre più la quantità richiesta. */
        inStock: variant.isActive && variant.stockQty >= item.quantity,
        availableQuantity: available,
        lineTotal: Math.round(unitPrice * item.quantity * 100) / 100,
      };
    });

    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const savings = items.reduce(
      (sum, item) => sum + (item.originalPrice - item.unitPrice) * item.quantity,
      0,
    );

    return {
      items,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: Math.round(subtotal * 100) / 100,
      savings: Math.round(savings * 100) / 100,
      hasIssues: items.some((item) => !item.inStock),
      updatedAt: cart.updatedAt,
    };
  }

  async addItem(userId: string, dto: AddCartItemDto) {
    const variant = await this.loadVariant(dto.variantId);
    const cart = await this.ensureCart(userId);

    const existing = await this.prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } },
    });

    // Aggiungere due volte lo stesso articolo somma le quantità invece di creare
    // una seconda riga: `@@unique([cartId, variantId])` non lo permetterebbe.
    const quantity = Math.min((existing?.quantity ?? 0) + dto.quantity, MAX_QUANTITY_PER_ITEM);
    this.assertStock(variant, quantity);

    await this.prisma.cartItem.upsert({
      where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } },
      create: { cartId: cart.id, variantId: variant.id, quantity },
      update: { quantity },
    });

    await this.touch(cart.id);
    return this.getCart(userId);
  }

  async updateItem(userId: string, variantId: string, quantity: number) {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (!cart) throw new NotFoundException('Cart not found');

    if (quantity === 0) return this.removeItem(userId, variantId);

    const variant = await this.loadVariant(variantId);
    this.assertStock(variant, quantity);

    const updated = await this.prisma.cartItem.updateMany({
      where: { cartId: cart.id, variantId },
      data: { quantity },
    });
    if (updated.count === 0) throw new NotFoundException('Item not in cart');

    await this.touch(cart.id);
    return this.getCart(userId);
  }

  async removeItem(userId: string, variantId: string) {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (!cart) throw new NotFoundException('Cart not found');

    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id, variantId } });
    await this.touch(cart.id);
    return this.getCart(userId);
  }

  async clear(userId: string) {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (cart) {
      await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
      await this.touch(cart.id);
    }
    return this.getCart(userId);
  }

  /**
   * Fonde il carrello locale (riempito da sloggati) con quello sul server.
   *
   * Le quantità si sommano invece di sovrascriversi: se l'utente aveva già due
   * pezzi sul server e ne aggiunge uno dal telefono, se ne aspetta tre.
   * Le righe non valide vengono **saltate**, non fanno fallire tutta la fusione:
   * al login non si può chiedere all'utente di sistemare un carrello che non vede.
   */
  async merge(userId: string, items: AddCartItemDto[]) {
    const cart = await this.ensureCart(userId);
    const skipped: string[] = [];

    for (const item of items) {
      try {
        const variant = await this.loadVariant(item.variantId);
        const existing = await this.prisma.cartItem.findUnique({
          where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } },
        });

        const wanted = Math.min((existing?.quantity ?? 0) + item.quantity, MAX_QUANTITY_PER_ITEM);
        // Se lo stock non copre la somma si prende quello che c'è, invece di
        // scartare la riga: meglio un pezzo nel carrello che niente.
        const quantity = Math.min(wanted, variant.stockQty);
        if (quantity <= 0) {
          skipped.push(item.variantId);
          continue;
        }

        await this.prisma.cartItem.upsert({
          where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } },
          create: { cartId: cart.id, variantId: variant.id, quantity },
          update: { quantity },
        });
      } catch {
        skipped.push(item.variantId);
      }
    }

    await this.touch(cart.id);
    return { ...(await this.getCart(userId)), skipped };
  }

  private async ensureCart(userId: string) {
    return this.prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  private async loadVariant(variantId: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: { include: { discounts: { where: { isActive: true }, take: 1 } } } },
    });

    if (!variant || !variant.isActive || variant.product.deletedAt) {
      throw new NotFoundException('Variant not available');
    }
    return variant;
  }

  private assertStock(variant: { stockQty: number; product: { name: string } }, quantity: number) {
    if (variant.stockQty < quantity) {
      throw new BadRequestException(
        `Only ${variant.stockQty} left of ${variant.product.name}`,
      );
    }
  }

  /** `updatedAt` è `@updatedAt`: si muove solo se il carrello viene scritto. */
  private touch(cartId: string) {
    return this.prisma.cart.update({ where: { id: cartId }, data: { updatedAt: new Date() } });
  }

  private emptyCart() {
    return {
      items: [],
      itemCount: 0,
      subtotal: 0,
      savings: 0,
      hasIssues: false,
      updatedAt: null,
    };
  }
}
