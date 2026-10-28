import { CampoMorto } from './dead-field';

/* NEGATIVE: a dead import puts nobody on screen. Real case from round 1:
 * BudgetMachinePage imported BrandCustomizationPanel and never rendered it.
 * EXPECTED: zero. */
export function PaiMorto() {
  return <input placeholder="cor de fundo" />;
}
