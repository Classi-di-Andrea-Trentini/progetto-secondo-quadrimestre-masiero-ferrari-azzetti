import { describe, it, expect } from 'vitest';
import { nextStepFrom, stepsFor } from './checkout-steps';

/**
 * I passi del checkout sono funzioni pure apposta: la regola "se non c'e'
 * niente da pagare il passo pagamento non esiste" va provata senza montare il
 * componente, perche' e' li' che si sbaglia — saltando avanti si finirebbe su
 * un modulo di carta per un importo di zero euro.
 */
describe('passi del checkout', () => {
  it("inserisce il pagamento fra spedizione e riepilogo quando c'e' da pagare", () => {
    expect(stepsFor(94.9).map(s => s.key)).toEqual(['address', 'shipping', 'payment', 'review']);
    expect(nextStepFrom('shipping', 94.9)).toBe('payment');
  });

  it('salta il pagamento se il buono copre tutto', () => {
    expect(stepsFor(0).map(s => s.key)).toEqual(['address', 'shipping', 'review']);
    expect(nextStepFrom('shipping', 0)).toBe('review');
  });

  it("torna indietro saltando il pagamento quando non c'e'", () => {
    expect(nextStepFrom('review', 0, 'back')).toBe('shipping');
  });

  it('torna indietro passando dal pagamento quando esiste', () => {
    expect(nextStepFrom('review', 94.9, 'back')).toBe('payment');
  });

  it('non va oltre gli estremi', () => {
    expect(nextStepFrom('review', 94.9)).toBe('review');
    expect(nextStepFrom('address', 94.9, 'back')).toBe('address');
  });

  it("l'importo non ancora noto si comporta come 'da pagare'", () => {
    // Prima della risposta del backend non si sa quanto resta da incassare:
    // mostrare il passo e toglierlo dopo e' meno peggio del contrario.
    expect(stepsFor(null).map(s => s.key)).toContain('payment');
  });
});
