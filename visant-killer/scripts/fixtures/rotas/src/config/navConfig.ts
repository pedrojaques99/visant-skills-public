// A ARMADILHA: /community/* num comentário de linha. Um removedor de comentário
// em duas passadas lê o `/*` como abertura de bloco e apaga até o próximo fecho
// — levando a lista de login junto. ESPERADO dica('/login'): isMarketing.
function isMarketing(p: string) {
  const auth = ['/login'];
  if (p === '/pricing') return true;
  return auth.includes(p);
}
/* fecho de bloco de verdade, longe */
const EDITOR_PREFIXES = ['/canvas'];
export { isMarketing, EDITOR_PREFIXES };
