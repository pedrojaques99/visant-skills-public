/*
 * Fixture da FASE 2 do `ruido-scan` (2026-10-05) — as seis regras que o olho
 * pegava e o detector não, e os dois falsos positivos de `mesma-info` da
 * rodada 1 do slop killer no visantlabs-os.
 *
 * Cada bloco diz quantos achados promete (ESPERADO). Os NEGATIVOS vêm primeiro
 * e longe dos positivos de propósito: duas regras (capa-sintetica e
 * blur-em-card) olham uma janela de linhas em volta, e um positivo vizinho
 * contaminaria o negativo. Comentário não conta pra janela (o detector apaga
 * comentário antes de olhar), então este espaçamento é feito de código.
 *
 * Rode: node ruido-scan.mjs --self-test
 */

/* ============================================================== */
/* NEGATIVOS                                                      */
/* ============================================================== */

/* Gradiente que MOSTRA a paleta (swatch de guideline) não é capa: não há imagem
 * ausente por perto. ESPERADO capa-sintetica: zero. */
export function AmostraDeGradiente({ g }: { g: { angle: number; stops: string[] } }) {
  return <div className="h-8 rounded" style={{ background: `linear-gradient(${g.angle}deg, ${g.stops.join(', ')})` }} />;
}

/* Brilho de fundo: radial-gradient grande, sem background-size. Não é grade.
 * ESPERADO grade-de-pontos: zero. */
export function BrilhoDeFundo() {
  return <div className="pointer-events-none inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_120%,rgba(82,221,235,0.07),transparent)]" />;
}

/* Delay fixo não é cascata. ESPERADO cascata-por-indice: zero. */
export function EntradaUnica({ Motion }: { Motion: React.ComponentType<Record<string, unknown>> }) {
  return (
    <>
      <Motion transition={{ delay: 0.2, duration: 0.3 }} />
      <Motion delay={500} />
    </>
  );
}

/* Afundar no hover/press não é levantar, e deslocar pro lado não é subir.
 * ESPERADO hover-que-levanta: zero. */
export function AfundaNoClique({ Motion }: { Motion: React.ComponentType<Record<string, unknown>> }) {
  return (
    <>
      <button className="transition-transform hover:scale-95 active:scale-[0.98]">ok</button>
      <span className="transition-transform group-hover:translate-x-1">seguir</span>
      <Motion whileHover={{ opacity: 1 }} />
    </>
  );
}

/* Imagens que não quebram, ou que já tratam a quebra.
 * ESPERADO img-de-tile-sem-onerror: zero. */
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

/* Blur onde há o que borrar: barra grudada, chip sobre imagem, e um diálogo.
 * ESPERADO blur-em-card: zero. */
export function BarraGrudada() {
  return <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-md">topo</header>;
}
export function ConfirmDialog() {
  return <div className="rounded-xl border bg-popover/90 backdrop-blur-xl p-6">certeza?</div>;
}
/* O nome do componente é o único sinal de overlay: fica a mais de 6 linhas do
 * blur (primeira versão da regra só olhava a vizinhança e acusava o próprio
 * Modal.tsx e o SelectContent do DS). ESPERADO: zero. */
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

/* BLOCO DE CÓDIGO repete o header de autenticação em cada seção de propósito:
 * quem chega por âncora lê uma só. Falso positivo confirmado na DocsPage
 * (visantlabs-os, 2026-10-05) — 14 achados, todos em exemplo.
 * ESPERADO mesma-info-dois-tamanhos: zero. */
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

/* METADADO não chega no olho: SEO e JSON-LD repetem a descrição por dever.
 * Falso positivo confirmado em BrandingMachinePage:1022 na mesma rodada.
 * ESPERADO mesma-info-dois-tamanhos: zero. */
export function Metadados({ SEO, AppSchema }: { SEO: React.ComponentType<Record<string, string>>; AppSchema: React.ComponentType<Record<string, string>> }) {
  return (
    <>
      <SEO title="Branding Machine" description="crie estratégias completas de branding com inteligência artificial" />
      <AppSchema name="Branding Machine" description="crie estratégias completas de branding usando inteligência artificial" />
    </>
  );
}

/* ============================================================== */
/* POSITIVOS                                                      */
/* ============================================================== */

/* R10 a: o hash do nome vira matiz. Caso real: CoverFallback do grid de marcas.
 * ESPERADO capa-sintetica: 1 (a linha do hsl). */
export function CapaPorHash({ name }: { name: string }) {
  const hue = [...name].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 360, 7);
  return <div style={{ background: `linear-gradient(135deg, hsl(${hue} 32% 26%), #111)` }} />;
}

/* R10 b: sem capa, as cores da marca viram degradê. Caso real: hero do cockpit.
 * ESPERADO capa-sintetica: 1. (A <img> tem onError: não conta pra R11.) */
export function CapaComCoresDaMarca({ cover, colors }: { cover?: string; colors: string[] }) {
  if (cover) return <img src={cover} alt="" onError={() => undefined} className="h-full w-full object-cover" />;
  return <div style={{ background: `linear-gradient(115deg, ${colors.join(', ')})` }} />;
}

/* R11: tile de mídia desenhado à mão, sem onError. Caso real: MasonryCard da
 * /references (128 refs apontando pra disco local).
 * ESPERADO img-de-tile-sem-onerror: 2. */
export function TileSemOnError({ item, Motion }: { item: { url: string }; Motion: { img: React.ComponentType<Record<string, unknown>> } }) {
  return (
    <>
      <img src={item.url} alt="" className="h-full w-full object-cover" />
      <motion.img src={item.url} alt="" className="aspect-square w-full" />
      <Motion.img />
    </>
  );
}

/* R12: lista em escadinha. ESPERADO cascata-por-indice: 2. */
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

/* R13: card que pula, imagem que cresce, motion que sobe. Caso real: 26 cards
 * do AdminPage com hover:-translate-y-1.
 * ESPERADO hover-que-levanta: 3. */
export function CardQuePula({ Motion }: { Motion: React.ComponentType<Record<string, unknown>> }) {
  return (
    <>
      <div className="rounded-xl border transition-transform hover:-translate-y-1">a</div>
      <img src="/x.webp" alt="" className="transition-transform group-hover:scale-105" />
      <Motion whileHover={{ y: -4 }} />
    </>
  );
}

/* R14: papel quadriculado de template, nas três formas.
 * ESPERADO grade-de-pontos: 3. */
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

/* R15: blur num card no fluxo, em cima de fundo chapado — não borra nada.
 * ESPERADO blur-em-card: 1. */
export function CardDeResumo() {
  return <div className="rounded-xl border bg-card/60 backdrop-blur-md p-4">resumo</div>;
}

/* ============================================================== */
/* A EXCEÇÃO ESCRITA PRECISA DE MOTIVO                            */
/* ============================================================== */

/*
 * O mesmo contrato dos outros quatro portões: `EXCEÇÃO ao ruido-scan/<regra>:
 * <motivo>`, na linha do achado ou nas oito acima, com 8+ letras de motivo e
 * uma palavra de 3+ na própria linha. Antes, "EXCEÇÃO" e o nome da regra em
 * qualquer lugar da janela liberavam o achado, inclusive o marcador mudo.
 * Cada caso fica a mais de oito linhas do próximo, senão a exceção de um
 * liberaria o achado do vizinho e o teste mentiria.
 *
 * ESPERADO hover-que-levanta: 4 destes (mudo, motivo curto, nome pela metade,
 * exceção abaixo do achado). Os dois com motivo não contam.
 */
export function ExcecaoMuda() {
  {/* EXCEÇÃO ao ruido-scan/hover-que-levanta */}
  return <div className="rounded-xl border hover:-translate-y-1">mudo</div>;
}
const espaco1 = 1;
const espaco2 = espaco1 + 1;
const espaco3 = espaco2 + 1;
const espaco4 = espaco3 + 1;
const espaco5 = espaco4 + 1;
const espaco6 = espaco5 + 1;
export function ExcecaoComMotivoCurto() {
  {/* EXCEÇÃO ao ruido-scan/hover-que-levanta: ok. */}
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
  {/* EXCEÇÃO ao ruido-scan/hover-que-levanta: o card de demonstração sobe de propósito. */}
}
const espaco19 = espaco18 + 1;
const espaco20 = espaco19 + 1;
const espaco21 = espaco20 + 1;
const espaco22 = espaco21 + 1;
const espaco23 = espaco22 + 1;
const espaco24 = espaco23 + 1;
const espaco25 = espaco24 + 1;
export function ExcecaoComMotivo() {
  {/* EXCEÇÃO ao ruido-scan/hover-que-levanta: o card de demonstração sobe de propósito. */}
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
  // EXCEÇÃO ao ruido-scan/hover-que-levanta: o card
  // de demonstração sobe de propósito.
  return <div className="rounded-xl border hover:-translate-y-1">quebrado</div>;
}
export const espacoFinal = espaco32;
