import { FilhoExclusivo } from './exclusive-child';

/* NEGATIVE: the parent returns the child in an early `return`, so the two
 * doors never coexist. Real case from round 1: BudgetForm × VisantBudgetForm.
 * EXPECTED: zero. */
export function PaiExclusivo({ modo }: { modo: string }) {
  if (modo === 'visant') return <FilhoExclusivo />;
  return <input placeholder="nome do cliente" />;
}
