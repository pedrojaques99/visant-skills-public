import { FilhoExclusivo } from './filho-exclusivo';

/* NEGATIVO: o pai devolve o filho num `return` antecipado, então as duas
 * portas nunca coexistem. Caso real da rodada 1: BudgetForm × VisantBudgetForm.
 * ESPERADO: zero. */
export function PaiExclusivo({ modo }: { modo: string }) {
  if (modo === 'visant') return <FilhoExclusivo />;
  return <input placeholder="nome do cliente" />;
}
