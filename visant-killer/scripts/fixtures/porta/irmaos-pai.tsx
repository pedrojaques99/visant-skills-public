import { BuscaA } from './irmaos-busca-a';
import { BuscaB } from './irmaos-busca-b';
import { ImportarJson } from './irmaos-json';
import { CampoPreset } from './irmaos-preset';
import { CampoSala } from './irmaos-sala';
import { CampoCaixa } from './irmaos-caixa';

/* One parent, five children on the same screen.
 *   - BuscaA × BuscaB: `t('common.search')` is common vocabulary, deliberate
 *     reuse (round 1: four searches on four screens). EXPECTED: zero.
 *   - ImportarJson × CampoPreset: the JSON placeholder is a code EXAMPLE,
 *     not a field label (round 1: AdminPresetsPage). EXPECTED: zero.
 *   - CampoSala × CampoCaixa: two doors with the same name side by side, the
 *     jukebox case between siblings. EXPECTED repeated-door: 2. */
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
