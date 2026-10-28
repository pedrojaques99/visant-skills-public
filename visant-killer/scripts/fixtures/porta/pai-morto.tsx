import { CampoMorto } from './campo-morto';

/* NEGATIVO: import morto não põe ninguém na tela. Caso real da rodada 1:
 * BudgetMachinePage importava BrandCustomizationPanel e nunca renderizava.
 * ESPERADO: zero. */
export function PaiMorto() {
  return <input placeholder="cor de fundo" />;
}
