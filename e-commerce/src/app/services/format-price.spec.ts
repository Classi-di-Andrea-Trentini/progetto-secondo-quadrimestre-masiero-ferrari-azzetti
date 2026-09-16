import { formatPrice } from './format-price';

// La funzione era duplicata in nove punti del frontend (home, products,
// product-detail, checkout, i quattro pannelli admin, cart): quattro varianti
// diverse, tutte con la virgola italiana tranne le due gia' portate
// all'inglese dal task 4. Questo file prova la versione unica e condivisa.
describe('formatPrice', () => {
  it('formats in english: euro symbol with no space, decimal point (not the italian comma)', () => {
    expect(formatPrice(120)).toBe('€120.00');
  });

  it('always shows two decimals, even starting from a whole number or a single decimal digit', () => {
    expect(formatPrice(45)).toBe('€45.00');
    expect(formatPrice(45.5)).toBe('€45.50');
  });

  it('adds a thousands separator for large amounts', () => {
    expect(formatPrice(1234.5)).toBe('€1,234.50');
    expect(formatPrice(12000)).toBe('€12,000.00');
  });

  it('accepts a numeric string, as the values coming from the legacy Prisma backend still do in places', () => {
    expect(formatPrice('99.9')).toBe('€99.90');
  });
});
