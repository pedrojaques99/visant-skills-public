/*
 * `ruido-scan` PHASE 2 fixture (2026-10-05): the six rules the eye caught and
 * the detector did not, and the two `mesma-info` false positives from slop
 * killer round 1 in visantlabs-os.
 *
 * Each block says how many findings it promises (EXPECTED). The NEGATIVES come
 * first and far from the positives on purpose: two rules (synthetic-cover and
 * blur-on-card) look at a window of lines around, and a neighboring positive
 * would contaminate the negative. Comments do not count for the window (the
 * detector blanks comments before looking), so this spacing is made of code.
 *
 * Run: node ruido-scan.mjs --self-test
 */

/* ============================================================== */
/* NEGATIVES                                                      */
/* ============================================================== */

/* A gradient that SHOWS the palette (guideline swatch) is not a cover: there is
 * no missing image nearby. EXPECTED synthetic-cover: zero. */
export function AmostraDeGradiente({ g }: { g: { angle: number; stops: string[] } }) {
  return <div className="h-8 rounded" style={{ background: `linear-gradient(${g.angle}deg, ${g.stops.join(', ')})` }} />;
}

/* Background glow: a large radial-gradient, no background-size. Not a grid.
 * EXPECTED dot-grid: zero. */
export function BrilhoDeFundo() {
  return <div className="pointer-events-none inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_120%,rgba(82,221,235,0.07),transparent)]" />;
}

/* A fixed delay is not a cascade. EXPECTED stagger-by-index: zero. */
export function EntradaUnica({ Motion }: { Motion: React.ComponentType<Record<string, unknown>> }) {
  return (
    <>
      <Motion transition={{ delay: 0.2, duration: 0.3 }} />
      <Motion delay={500} />
    </>
  );
}

/* Sinking on hover/press is not lifting, shifting sideways is not rising, and an
 * icon scaling inside its button is not a card jumping.
 * EXPECTED hover-lift: zero. */
export function AfundaNoClique({ Motion, XMarkIcon }: { Motion: React.ComponentType<Record<string, unknown>>; XMarkIcon: React.ComponentType<{ className?: string }> }) {
  return (
    <>
      <button className="transition-transform hover:scale-95 active:scale-[0.98]">ok</button>
      <span className="transition-transform group-hover:translate-x-1">seguir</span>
      <Motion whileHover={{ opacity: 1 }} />
      {/* a glyph growing inside a fixed button box (vercel/commerce, cart/modal.tsx): no card rises */}
      <XMarkIcon className="h-6 transition-all ease-in-out hover:scale-110" />
    </>
  );
}

/* Images that do not break, or that already handle the break.
 * EXPECTED tile-img-no-onerror: zero. */
export function ImagensQueNaoQuebram({ url, preview, props }: { url: string; preview: string; props: Record<string, unknown> }) {
  return (
    <>
      <img src={url} alt="" onError={() => undefined} className="h-full w-full object-cover" />
      <img src={preview} alt="" className="h-full w-full object-cover" />
      <img src={url} alt="" className="h-6 w-auto" />
      <img {...props} className="h-full w-full object-cover" />
      <img src="/tools/naming.webp" alt="" className="aspect-video w-full object-cover" />
    </>
  );
}

/* Blur where there is something to blur: a sticky bar, a chip over an image, and a dialog.
 * EXPECTED blur-on-card: zero. */
export function BarraGrudada() {
  return <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-md">topo</header>;
}
export function ConfirmDialog() {
  return <div className="rounded-xl border bg-popover/90 backdrop-blur-xl p-6">certeza?</div>;
}
/* The component name is the only overlay signal: it sits more than 6 lines from
 * the blur (the rule's first version only looked at the neighborhood and flagged
 * Modal.tsx itself and the DS's SelectContent). EXPECTED: zero. */
export function SettingsPopover({ n }: { n: number }) {
  const a = n + 1;
  const b = a + 1;
  const c = b + 1;
  const d = c + 1;
  const e = d + 1;
  const f = e + 1;
  const g = f + 1;
  return <div className="rounded-xl border bg-card/80 backdrop-blur-xl p-4">{g}</div>;
}

/* A CODE BLOCK repeats the auth header in every section on purpose:
 * whoever arrives by anchor reads only one. False positive confirmed on DocsPage
 * (visantlabs-os, 2026-10-05): 14 findings, all in examples.
 * EXPECTED same-info-twice: zero. */
export function DocDeApi() {
  return (
    <>
      <div className="rounded-md p-4 font-mono text-sm">
        <p className="text-muted-foreground"># Pass your API key in every request</p>
      </div>
      <pre>
        <code># Pass your API key in the Authorization header request</code>
      </pre>
    </>
  );
}

/* METADATA does not reach the eye: SEO and JSON-LD repeat the description by duty.
 * False positive confirmed at BrandingMachinePage:1022 in the same round.
 * EXPECTED same-info-twice: zero. */
export function Metadados({ SEO, AppSchema }: { SEO: React.ComponentType<Record<string, string>>; AppSchema: React.ComponentType<Record<string, string>> }) {
  return (
    <>
      <SEO title="Branding Machine" description="crie estratégias completas de branding com inteligência artificial" />
      <AppSchema name="Branding Machine" description="crie estratégias completas de branding usando inteligência artificial" />
    </>
  );
}

/* ============================================================== */
/* POSITIVES                                                      */
/* ============================================================== */

/* R10 a: the name hash becomes a hue. Real case: CoverFallback of the brand grid.
 * EXPECTED synthetic-cover: 1 (the hsl line). */
export function CapaPorHash({ name }: { name: string }) {
  const hue = [...name].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 360, 7);
  return <div style={{ background: `linear-gradient(135deg, hsl(${hue} 32% 26%), #111)` }} />;
}

/* R10 b: with no cover, the brand colors become a gradient. Real case: cockpit hero.
 * EXPECTED synthetic-cover: 1. (The <img> has onError: it does not count for R11.) */
export function CapaComCoresDaMarca({ cover, colors }: { cover?: string; colors: string[] }) {
  if (cover) return <img src={cover} alt="" onError={() => undefined} className="h-full w-full object-cover" />;
  return <div style={{ background: `linear-gradient(115deg, ${colors.join(', ')})` }} />;
}

/* R11: a hand-drawn media tile, without onError. Real case: MasonryCard on
 * /references (128 refs pointing to a local disk).
 * EXPECTED tile-img-no-onerror: 2. */
export function TileSemOnError({ item, Motion }: { item: { url: string }; Motion: { img: React.ComponentType<Record<string, unknown>> } }) {
  return (
    <>
      <img src={item.url} alt="" className="h-full w-full object-cover" />
      <motion.img src={item.url} alt="" className="aspect-square w-full" />
      <Motion.img />
    </>
  );
}

/* R12: staircase list. EXPECTED stagger-by-index: 2. */
export function ListaEmEscada({ itens, Motion }: { itens: string[]; Motion: React.ComponentType<Record<string, unknown>> }) {
  return (
    <>
      {itens.map((it, index) => (
        <Motion key={it} transition={{ delay: index * 0.05 }} />
      ))}
      {itens.map((it, i) => (
        <div key={it} style={{ animationDelay: `${i * 60}ms` }} />
      ))}
    </>
  );
}

/* R13: a card that jumps, an image that grows, a motion that rises. Real case: 26 cards
 * on AdminPage with hover:-translate-y-1.
 * EXPECTED hover-lift: 3. */
export function CardQuePula({ Motion }: { Motion: React.ComponentType<Record<string, unknown>> }) {
  return (
    <>
      <div className="rounded-xl border transition-transform hover:-translate-y-1">a</div>
      <img src="/x.webp" alt="" className="transition-transform group-hover:scale-105" />
      <Motion whileHover={{ y: -4 }} />
    </>
  );
}

/* R14: template graph paper, in its three forms.
 * EXPECTED dot-grid: 3. */
const DOT_TEXTURE =
  "url(\"data:image/svg+xml,%3Csvg width='16' height='16' viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='2' cy='2' r='1' fill='%23fff'/%3E%3C/svg%3E\")";
export function FundoDePontos({ GridDotsBackground }: { GridDotsBackground: React.ComponentType }) {
  return (
    <>
      <GridDotsBackground />
      <div style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
      <div style={{ backgroundImage: DOT_TEXTURE }} />
    </>
  );
}

/* R15: blur on an in-flow card, over a flat background: it blurs nothing.
 * EXPECTED blur-on-card: 1. */
export function CardDeResumo() {
  return <div className="rounded-xl border bg-card/60 backdrop-blur-md p-4">resumo</div>;
}

/* ============================================================== */
/* THE WRITTEN EXCEPTION NEEDS A REASON                           */
/* ============================================================== */

/*
 * The same contract as the other four gates: `EXCEÇÃO ao ruido-scan/<regra>:
 * <motivo>`, on the finding's line or the eight above, with 8+ letters of reason
 * and a 3+ letter word on the marker line itself. Before, "EXCEÇÃO" and the rule
 * name anywhere in the window released the finding, the silent marker included.
 * Each case sits more than eight lines from the next, otherwise one's exception
 * would release the neighbor's finding and the test would lie.
 *
 * EXPECTED hover-lift: 4 of these (silent, short reason, half the name,
 * exception below the finding). The two with a reason do not count.
 */
export function ExcecaoMuda() {
  {/* EXCEÇÃO ao ruido-scan/hover-lift */}
  return <div className="rounded-xl border hover:-translate-y-1">mudo</div>;
}
const espaco1 = 1;
const espaco2 = espaco1 + 1;
const espaco3 = espaco2 + 1;
const espaco4 = espaco3 + 1;
const espaco5 = espaco4 + 1;
const espaco6 = espaco5 + 1;
export function ExcecaoComMotivoCurto() {
  {/* EXCEÇÃO ao ruido-scan/hover-lift: ok. */}
  return <div className="rounded-xl border hover:-translate-y-1">curto</div>;
}
const espaco7 = espaco6 + 1;
const espaco8 = espaco7 + 1;
const espaco9 = espaco8 + 1;
const espaco10 = espaco9 + 1;
const espaco11 = espaco10 + 1;
const espaco12 = espaco11 + 1;
export function ExcecaoComNomePelaMetade() {
  {/* EXCEÇÃO ao ruido-scan/hover-que: o card de demonstração sobe de propósito. */}
  return <div className="rounded-xl border hover:-translate-y-1">metade</div>;
}
const espaco13 = espaco12 + 1;
const espaco14 = espaco13 + 1;
const espaco15 = espaco14 + 1;
const espaco16 = espaco15 + 1;
const espaco17 = espaco16 + 1;
const espaco18 = espaco17 + 1;
export function ExcecaoAbaixoDoAchado() {
  return <div className="rounded-xl border hover:-translate-y-1">abaixo</div>;
  {/* EXCEÇÃO ao ruido-scan/hover-lift: o card de demonstração sobe de propósito. */}
}
const espaco19 = espaco18 + 1;
const espaco20 = espaco19 + 1;
const espaco21 = espaco20 + 1;
const espaco22 = espaco21 + 1;
const espaco23 = espaco22 + 1;
const espaco24 = espaco23 + 1;
const espaco25 = espaco24 + 1;
export function ExcecaoComMotivo() {
  {/* EXCEÇÃO ao ruido-scan/hover-lift: o card de demonstração sobe de propósito. */}
  return <div className="rounded-xl border hover:-translate-y-1">com motivo</div>;
}
const espaco26 = espaco25 + 1;
const espaco27 = espaco26 + 1;
const espaco28 = espaco27 + 1;
const espaco29 = espaco28 + 1;
const espaco30 = espaco29 + 1;
const espaco31 = espaco30 + 1;
const espaco32 = espaco31 + 1;
export function ExcecaoComMotivoQuebrado() {
  // EXCEÇÃO ao ruido-scan/hover-lift: o card
  // de demonstração sobe de propósito.
  return <div className="rounded-xl border hover:-translate-y-1">quebrado</div>;
}
const espaco33 = espaco32 + 1;
const espaco34 = espaco33 + 1;
const espaco35 = espaco34 + 1;
const espaco36 = espaco35 + 1;
const espaco37 = espaco36 + 1;
const espaco38 = espaco37 + 1;
const espaco39 = espaco38 + 1;
/* The English marker is an alias of the Portuguese one and releases the same way. */
export function ExcecaoEmIngles() {
  {/* EXCEPTION to ruido-scan/hover-lift: the demo card rises on purpose. */}
  return <div className="rounded-xl border hover:-translate-y-1">english</div>;
}
export const espacoFinal = espaco39;
