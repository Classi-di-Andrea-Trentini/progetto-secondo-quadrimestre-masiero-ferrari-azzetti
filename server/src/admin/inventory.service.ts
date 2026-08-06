import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StockAlertsService } from '../stock-alerts/stock-alerts.service';

/**
 * Magazzino: cosa sta finendo, cosa è finito, e la rettifica delle giacenze.
 *
 * Il campo `low_stock_alert` era sulle varianti fin dall'inizio (con default 5) e
 * **non lo leggeva nessuno**: la soglia c'era ma nessuno avvisava mai. Qui diventa
 * il criterio con cui una variante finisce nella lista da riordinare.
 *
 * Le rettifiche passano da qui e non da un `update` sparso, così la quantità non
 * può diventare negativa e ogni movimento lascia una nota nell'audit log — senza,
 * "chi ha azzerato quella taglia?" resta senza risposta.
 */

export type StockLevel = 'out' | 'low' | 'ok';

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private stockAlerts: StockAlertsService,
  ) {}

  /**
   * Varianti esaurite o sotto soglia, le esaurite per prime.
   * `threshold` permette di guardare oltre la soglia impostata sul prodotto.
   */
  async lowStock(threshold?: number) {
    const variants = await this.prisma.productVariant.findMany({
      where: {
        isActive: true,
        product: { isActive: true, deletedAt: null },
      },
      include: {
        product: { select: { id: true, name: true, slug: true, brand: true } },
      },
      orderBy: { stockQty: 'asc' },
    });

    const rows = variants
      .map((variant) => {
        // La soglia del prodotto ha la precedenza; `threshold` serve a chi vuole
        // guardare piu' in la' di quanto impostato, non a sovrascriverlo.
        const limit = threshold ?? variant.lowStockAlert ?? 0;
        const level: StockLevel =
          variant.stockQty <= 0 ? 'out' : variant.stockQty <= limit ? 'low' : 'ok';

        return {
          variantId: variant.id,
          sku: variant.sku,
          productId: variant.product.id,
          productName: variant.product.name,
          slug: variant.product.slug,
          brand: variant.product.brand,
          label: [variant.color, variant.size].filter(Boolean).join(' / ') || null,
          stockQty: variant.stockQty,
          lowStockAlert: variant.lowStockAlert,
          level,
        };
      })
      .filter((row) => row.level !== 'ok');

    return {
      rows,
      outOfStock: rows.filter((row) => row.level === 'out').length,
      lowStock: rows.filter((row) => row.level === 'low').length,
    };
  }

  /**
   * Rettifica di giacenza.
   *
   * `delta` somma (positivo carico, negativo scarico), `set` fissa il valore
   * assoluto: sono due gesti diversi — "ne sono arrivati 20" e "contati, sono 3" —
   * e confonderli è il modo classico per sballare l'inventario.
   */
  async adjustStock(
    adminId: string,
    variantId: string,
    input: { delta?: number; set?: number; reason?: string },
  ) {
    if (input.delta === undefined && input.set === undefined) {
      throw new BadRequestException('Provide either delta or set');
    }
    if (input.delta !== undefined && input.set !== undefined) {
      throw new BadRequestException('Provide only one of delta or set');
    }

    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      select: { id: true, sku: true, stockQty: true, productId: true },
    });
    if (!variant) throw new NotFoundException('Variant not found');

    const next = input.set !== undefined ? input.set : variant.stockQty + (input.delta ?? 0);
    if (next < 0) {
      throw new BadRequestException(
        `Stock cannot go below zero (current ${variant.stockQty})`,
      );
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.productVariant.update({
        where: { id: variantId },
        data: { stockQty: next },
      }),
      // Traccia del movimento: senza, una giacenza cambiata non ha ne' autore ne'
      // motivo, e in magazzino e' proprio la domanda che si fa sempre.
      this.prisma.auditLog.create({
        data: {
          userId: adminId,
          action: 'stock.adjust',
          entityType: 'product_variant',
          entityId: variantId,
          oldValue: { stockQty: variant.stockQty },
          newValue: { stockQty: next, sku: variant.sku, reason: input.reason ?? null },
        },
      }),
    ]);

    // Se la variante era esaurita e ora c'e', partono gli avvisi. Va fatto **dopo**
    // la scrittura, altrimenti si invita a comprare qualcosa che non c'e' ancora.
    let notified = 0;
    if (variant.stockQty <= 0 && next > 0) {
      notified = await this.stockAlerts.notifyBackInStock(variantId);
    }

    return {
      variantId: updated.id,
      stockQty: updated.stockQty,
      previous: variant.stockQty,
      notified,
    };
  }

  /** Ultimi movimenti registrati, per capire chi ha toccato cosa. */
  async movements(limit = 50) {
    return this.prisma.auditLog.findMany({
      where: { action: 'stock.adjust' },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
      include: { user: { select: { email: true, fullName: true } } },
    });
  }
}
