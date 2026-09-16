// Formattazione del prezzo, in un posto solo.
//
// Prima di questo file la stessa formattazione era scritta a mano in nove
// punti del frontend (home, products, product-detail, checkout, i quattro
// pannelli admin, cart): quattro varianti diverse a seconda di chi l'aveva
// copiata, e solo due gia' aggiornate al formato inglese dal task 4
// (products.ts, product-detail.ts). Le altre sette producevano ancora
// "€ 120,00" (spazio dopo il simbolo, virgola decimale) su una pagina ormai
// tutta in inglese.
//
// Valuta sempre euro: qui si cambia solo la formattazione, mai l'importo.
// `Intl.NumberFormat` con locale 'en' produce esattamente "€120.00" — nessuno
// spazio dopo il simbolo, punto decimale, separatore delle migliaia dove
// serve — senza dover gestire i casi a mano (toFixed + replace, come faceva
// il vecchio codice).
//
// Gli importi arrivano dal backend Java gia' come numeri JSON (BigDecimal).
// Il parametro accetta comunque anche una stringa perche' alcuni chiamanti
// (residuo dell'epoca Prisma, che serializzava i NUMERIC come stringhe)
// passano ancora `String(valore)`.
export function formatPrice(value: number | string): string {
  const amount = typeof value === 'number' ? value : parseFloat(value);
  return new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR' }).format(amount);
}
