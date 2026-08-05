// I decoratori di class-validator/class-transformer leggono i metadati a runtime.
// Fuori da Nest nessuno carica il polyfill, quindi va importato qui per primo.
import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { priceOf } from './pricing';
import { AddCartItemDto } from '../cart/dto/cart.dto';

describe('priceOf', () => {
  const variant = (priceOverride: unknown, basePrice: unknown, discounts: any[] = []) =>
    ({ priceOverride, product: { basePrice, discounts } }) as any;

  it('usa il prezzo base quando la variante non ha un prezzo proprio', () => {
    // Prisma serializza i Decimal come stringhe: se non venissero convertite,
    // '19.99' - 5 darebbe NaN e il totale sparirebbe dal carrello.
    expect(priceOf(variant(null, '19.99'))).toEqual({
      originalPrice: 19.99,
      unitPrice: 19.99,
      discountLabel: null,
    });
  });

  it('il prezzo della variante ha la precedenza sul prezzo base', () => {
    expect(priceOf(variant('24.50', '19.99')).unitPrice).toBe(24.5);
  });

  it('applica lo sconto percentuale', () => {
    const price = priceOf(variant(null, '100.00', [{ type: 'percentage', value: '25', label: '-25%' }]));
    expect(price.unitPrice).toBe(75);
    expect(price.originalPrice).toBe(100);
    expect(price.discountLabel).toBe('-25%');
  });

  it('applica lo sconto a importo fisso', () => {
    expect(priceOf(variant(null, '50.00', [{ type: 'fixed_amount', value: '10' }])).unitPrice).toBe(40);
  });

  it('uno sconto fisso piu\' grande del prezzo non produce un importo negativo', () => {
    // Senza il taglio a zero il carrello mostrerebbe un totale negativo e
    // l'ordine accrediterebbe soldi al cliente.
    expect(priceOf(variant(null, '10.00', [{ type: 'fixed_amount', value: '30' }])).unitPrice).toBe(0);
  });

  it('arrotonda ai centesimi', () => {
    expect(priceOf(variant(null, '19.99', [{ type: 'percentage', value: '33' }])).unitPrice).toBe(13.39);
  });
});

describe('validazione degli id del catalogo', () => {
  it('accetta gli UUID del seed, che non hanno una versione RFC valida', async () => {
    // Regressione: con `@IsUUID()` (default) ogni id del seed veniva rifiutato con
    // 400, e non solo dal carrello — **anche il checkout era inutilizzabile** su
    // tutto il catalogo di prova. Da validator 13.15 l'opzione permissiva e'
    // `'loose'`: `'all'` non basta piu'.
    const dto = plainToInstance(AddCartItemDto, {
      variantId: 'e0000001-eeee-eeee-eeee-eeeeeeeeeeee',
      quantity: 1,
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('rifiuta comunque quello che UUID non e\'', async () => {
    const dto = plainToInstance(AddCartItemDto, { variantId: 'non-un-uuid', quantity: 1 });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('rifiuta le quantita\' fuori scala', async () => {
    const dto = plainToInstance(AddCartItemDto, {
      variantId: 'e0000001-eeee-eeee-eeee-eeeeeeeeeeee',
      quantity: 1000,
    });
    expect(await validate(dto)).not.toHaveLength(0);
  });
});
