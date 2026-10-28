// ruido-ignore-file: grade-de-pontos, legacy id in a whole-file ignore must still release the rule.
/*
 * LEGACY IDS. The rules were renamed to English on 2026-10-28, and markers
 * already written with the old Portuguese id must keep releasing their rule.
 * Every finding in this file is released by an OLD id. EXPECTED: zero.
 *
 * The self-test also scans a copy with the old ids blanked and requires
 * dot-grid, blur-on-card and arrow-glyph to fire there, so this zero cannot
 * come from a rule that stopped detecting.
 */
export function LegadoArquivoInteiro({ GridDotsBackground }: { GridDotsBackground: React.ComponentType }) {
  return <GridDotsBackground />;
}
const folga1 = 1;
const folga2 = folga1 + 1;
const folga3 = folga2 + 1;
const folga4 = folga3 + 1;
const folga5 = folga4 + 1;
const folga6 = folga5 + 1;
export function LegadoEmIngles() {
  /* EXCEPTION to ruido-scan/blur-em-card: the glass is this demo piece's signature. */
  return <div className="rounded-xl border bg-card/60 backdrop-blur-md p-4">resumo</div>;
}
const folga7 = folga6 + 1;
const folga8 = folga7 + 1;
const folga9 = folga8 + 1;
const folga10 = folga9 + 1;
const folga11 = folga10 + 1;
const folga12 = folga11 + 1;
export function LegadoEmPortugues() {
  // EXCEÇÃO ao ruido-scan/seta-glifo: a seta é dado do cliente numa linha do tempo.
  return <p>Exatas <span>→</span> engenharia</p>;
}
export const folgaFinal = folga12;
