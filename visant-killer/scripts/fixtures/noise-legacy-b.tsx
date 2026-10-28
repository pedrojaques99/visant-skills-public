// noise-ignore-file: rotulo-gritado, the HUD of this fixture uses caps and tracking on purpose.
/*
 * LEGACY IDS, second file: the English whole-file alias and a line exception,
 * both naming the old id. EXPECTED: zero. The self-test's blanked copy must
 * fire shouting-label (3) and hover-lift (1).
 */
export function HudLegado() {
  return (
    <div>
      <span className="font-mono text-micro uppercase tracking-wider text-muted-foreground">um</span>
      <span className="font-mono text-micro uppercase tracking-wider text-muted-foreground">dois</span>
      <span className="font-mono text-micro uppercase tracking-widest text-muted-foreground">tres</span>
      {/* EXCEÇÃO ao ruido-scan/hover-que-levanta: o card de demonstração sobe de propósito. */}
      <div className="rounded-xl border hover:-translate-y-1">sobe</div>
    </div>
  );
}
