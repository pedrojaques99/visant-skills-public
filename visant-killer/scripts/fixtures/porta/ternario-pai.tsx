import { PassoUm } from './passo-um';
import { PassoDois } from './passo-dois';

/* NEGATIVO: dois passos de um assistente em lados opostos de um ternário.
 * Caso real da rodada 1: SidebarSetupSection × SidebarGenerationConfig.
 * ESPERADO: zero. */
export function Assistente({ analisado }: { analisado: boolean }) {
  return <aside>{analisado ? <PassoDois /> : <PassoUm />}</aside>;
}
