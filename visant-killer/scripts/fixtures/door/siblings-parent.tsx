import { BuscaA } from './siblings-search-a';
import { BuscaB } from './siblings-search-b';
import { ImportarJson } from './siblings-json';
import { CampoPreset } from './siblings-preset';
import { CampoSala } from './siblings-room';
import { CampoCaixa } from './siblings-box';

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
