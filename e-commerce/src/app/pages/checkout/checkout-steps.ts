/**
 * I passi del checkout, come funzioni pure.
 *
 * Stanno fuori dal componente perche' la regola che conta — **il passo di
 * pagamento esiste solo se c'e' qualcosa da pagare** — e' esattamente quella
 * che si sbaglia, e provarla non deve richiedere di montare mezzo Angular.
 * Un buono che copre l'intero ordine deve portare dritti al riepilogo, non a
 * un modulo per la carta da zero euro.
 */
export type CheckoutStep = 'address' | 'shipping' | 'payment' | 'review';

export interface StepDescriptor {
  key: CheckoutStep;
  label: string;
}

const ALL: StepDescriptor[] = [
  { key: 'address', label: 'Address' },
  { key: 'shipping', label: 'Shipping' },
  { key: 'payment', label: 'Payment' },
  { key: 'review', label: 'Review' },
];

/**
 * @param amountToPay quanto resta da incassare. `null` significa "non ancora
 *   noto", cioe' prima che il backend risponda: in quel caso il passo si mostra,
 *   perche' toglierlo dopo e' meno peggio che scoprirlo mancante a meta' strada.
 */
export function stepsFor(amountToPay: number | null): StepDescriptor[] {
  const nothingToPay = amountToPay !== null && amountToPay <= 0;
  return nothingToPay ? ALL.filter(s => s.key !== 'payment') : ALL;
}

export function nextStepFrom(
  current: CheckoutStep,
  amountToPay: number | null,
  direction: 'forward' | 'back' = 'forward',
): CheckoutStep {
  const steps = stepsFor(amountToPay);
  const index = steps.findIndex(s => s.key === current);
  if (index === -1) return steps[0].key;

  const target = direction === 'forward' ? index + 1 : index - 1;
  // Agli estremi si resta dove si e': chi chiama non deve difendersi da un
  // indice fuori intervallo.
  if (target < 0 || target >= steps.length) return current;
  return steps[target].key;
}
