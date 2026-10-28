import { PassoUm } from './step-one';
import { PassoDois } from './step-two';

/* NEGATIVE: two steps of a wizard on opposite sides of a ternary.
 * Real case from round 1: SidebarSetupSection × SidebarGenerationConfig.
 * EXPECTED: zero. */
export function Assistente({ analisado }: { analisado: boolean }) {
  return <aside>{analisado ? <PassoDois /> : <PassoUm />}</aside>;
}
