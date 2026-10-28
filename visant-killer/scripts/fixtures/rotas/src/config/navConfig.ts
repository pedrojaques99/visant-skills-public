// THE TRAP: /community/* in a line comment. A two-pass comment stripper
// reads the `/*` as a block opener and deletes up to the next closer,
// taking the login list with it. EXPECTED hint('/login'): isMarketing.
function isMarketing(p: string) {
  const auth = ['/login'];
  if (p === '/pricing') return true;
  return auth.includes(p);
}
/* a real block closer, far away */
const EDITOR_PREFIXES = ['/canvas'];
export { isMarketing, EDITOR_PREFIXES };
