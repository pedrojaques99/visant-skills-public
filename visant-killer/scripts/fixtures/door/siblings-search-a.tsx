/* See siblings-parent.tsx. `t('common.search')` is the design system's word
 * "Buscar": reusing the key is the DS working. EXPECTED: zero. */
declare const t: (k: string) => string;
export function BuscaA() {
  return <input placeholder={t('common.search')} />;
}
