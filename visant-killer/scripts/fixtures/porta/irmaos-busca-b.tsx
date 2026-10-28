/* See irmaos-busca-a.tsx. EXPECTED: zero. */
declare const t: (k: string) => string;
export function BuscaB() {
  return <input placeholder={t('common.search')} />;
}
