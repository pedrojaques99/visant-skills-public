import { BuscaA } from './irmaos-busca-a';
import { BuscaB } from './irmaos-busca-b';
import { ImportarJson } from './irmaos-json';
import { CampoPreset } from './irmaos-preset';
import { CampoSala } from './irmaos-sala';
import { CampoCaixa } from './irmaos-caixa';

/* Um pai, cinco filhos na mesma tela.
 *   - BuscaA × BuscaB: `t('common.search')` é vocabulário comum, reuso
 *     deliberado (rodada 1: quatro buscas em quatro telas). ESPERADO: zero.
 *   - ImportarJson × CampoPreset: o placeholder do JSON é EXEMPLO de código,
 *     não rótulo de campo (rodada 1: AdminPresetsPage). ESPERADO: zero.
 *   - CampoSala × CampoCaixa: duas portas com o mesmo nome lado a lado — o
 *     caso do jukebox entre irmãos. ESPERADO porta-repetida: 2. */
export function Painel() {
  return (
    <section>
      <BuscaA />
      <BuscaB />
      <ImportarJson />
      <CampoPreset />
      <CampoSala />
      <CampoCaixa />
    </section>
  );
}
