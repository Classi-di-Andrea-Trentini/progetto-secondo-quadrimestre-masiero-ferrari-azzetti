import { DiscountType } from '@prisma/client';

/**
 * Prezzo di una variante, sconti applicati.
 *
 * Sta qui e non dentro un servizio perché lo usano sia il carrello sia il
 * checkout: se le due formule divergessero, il totale mostrato nel carrello
 * smetterebbe di combaciare con quello addebitato all'ordine, che è il tipo di
 * bug che si scopre da un cliente arrabbiato e non da un test.
 *
 * Il prezzo si ricalcola **sempre** dal database: quello che arriva dal client
 * non fa testo.
 */

export interface PriceableVariant {
  priceOverride: unknown;
  product: {
    basePrice: unknown;
    discounts: { type: DiscountType; value: unknown; label?: string | null }[];
  };
}

export interface UnitPrice {
  /** Prezzo di listino, senza sconti. */
  originalPrice: number;
  /** Prezzo effettivo per unità. */
  unitPrice: number;
  discountLabel: string | null;
}

/** Prisma serializza i `Decimal` come stringhe: vanno convertiti prima di calcolare. */
function toNumber(value: unknown): number {
  const parsed = parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function priceOf(variant: PriceableVariant): UnitPrice {
  const originalPrice = toNumber(variant.priceOverride ?? variant.product.basePrice);
  const discount = variant.product.discounts[0];

  if (!discount) {
    return { originalPrice: round(originalPrice), unitPrice: round(originalPrice), discountLabel: null };
  }

  const value = toNumber(discount.value);
  const discounted =
    discount.type === 'percentage' ? originalPrice * (1 - value / 100) : originalPrice - value;

  return {
    originalPrice: round(originalPrice),
    // Uno sconto fisso più grande del prezzo non può far pagare un importo negativo.
    unitPrice: round(Math.max(0, discounted)),
    discountLabel: discount.label ?? null,
  };
}
