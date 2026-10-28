/* NEGATIVO de porta-repetida: o mesmo rótulo em DUAS TELAS sem relação de
 * import (a outra ponta é tela-b.tsx). Caso real da rodada 1: o campo de
 * categoria do canvas e o da Mockup Machine. ESPERADO: zero. */
export function TelaA() {
  return <input placeholder="nome do preset" />;
}
