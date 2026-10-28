/* Ver irmaos-pai.tsx. `t('common.search')` é a palavra "Buscar" do design
 * system: reusar a chave é o DS funcionando. ESPERADO: zero. */
declare const t: (k: string) => string;
export function BuscaA() {
  return <input placeholder={t('common.search')} />;
}
