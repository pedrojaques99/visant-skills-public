/*
 * `ruido-scan` fixture: the cases the rule MUST get right.
 *
 * Each block below came from a real round. The three false positives were
 * fixed by fixing the RULE, never with an ignore by value, and stay locked
 * here so the next edit of the detector does not reopen the hole.
 *
 * Run: node ruido-scan.mjs --self-test
 *
 * The file does not compile as a real component and should not: it is test
 * input for a detector that reads text, not a tree.
 */

/* The room renders the box: that is what puts both doors on the same screen (R9). */
import { PortaDaCaixa } from './noise-door-b';

/* ============================================================== */
/* FALSE POSITIVE 1: TypeScript generic read as a tag             */
/* ============================================================== */
/* `React.useState<string | null>` matches the `>…<` pattern because a generic
 * uses the same signs as a tag. Two similar state declarations became
 * "two sentences with 50% shared words". EXPECTED: zero findings. */
export function FalsoPositivoGenerico() {
  const [dep, setDep] = React.useState<string | null>(null);
  const [tipo, setTipo] = React.useState<TipoFilter>(null);
  const [modo, setModo] = React.useState<Mode>("vitrine");
  return null;
}

/* ============================================================== */
/* FALSE POSITIVE 2: a quoted verb is an example, not an order    */
/* ============================================================== */
/* The placeholder of an accent-tolerant search lists test terms. The
 * word "arrastar" there tells nobody to drag anything. EXPECTED: zero. */
export function FalsoPositivoExemplo() {
  return <input placeholder={'tente "animacao", "vintage", "arrastar"'} />;
}

/* ============================================================== */
/* FALSE POSITIVE 3: a subordinate clause describes, not commands */
/* ============================================================== */
/* "Ao rolar, a barra encosta" is a description of behavior, which is what a
 * component sheet should say. EXPECTED: zero. */
export function FalsoPositivoSubordinada() {
  return <p>Ao rolar, a barra encosta no cabeçalho e o fio conta quanto já passou.</p>;
}

/* ============================================================== */
/* TRUE 1: teaches how to use                                     */
/* ============================================================== */
/* An imperative next to a control that already has affordance. EXPECTED: 1. */
export function VerdadeiroInstrucao() {
  return <p>Clique para abrir a ficha da peça no catálogo.</p>;
}

/* ============================================================== */
/* TRUE 2: caption of what comes next                             */
/* ============================================================== */
/* Narrates the content that shows up two centimeters later. EXPECTED: 1. */
export function VerdadeiroLegenda() {
  return <p>As dez peças abaixo cobrem esse intervalo inteiro, na ordem de um job.</p>;
}

/* ============================================================== */
/* TRUE 3: shouted label, three on the same screen                */
/* ============================================================== */
/* One is a legitimate eyebrow; three is a generic dashboard. EXPECTED: 3. */
export function VerdadeiroRotulos() {
  return (
    <div>
      <span className="font-mono text-micro uppercase tracking-wider text-muted-foreground">
        tipo
      </span>
      <span className="font-mono text-micro uppercase tracking-wider text-muted-foreground">
        npm
      </span>
      <span className="font-mono text-micro uppercase tracking-widest text-muted-foreground">
        peso
      </span>
    </div>
  );
}

/* ============================================================== */
/* EXCEPTION: a written reason releases the finding               */
/* ============================================================== */
/* The `shift` for fine adjustment is invisible by nature: no pixel can
 * announce a keyboard modifier. EXPECTED: zero, because the reason is
 * written and cites the rule by name.
 *
 * EXCEÇÃO ao `ruido-scan/usage-instruction`: gesto sem afordância nativa. */
export function ExcecaoComMotivo() {
  return <span>arrasta pra cima e pra baixo, shift para fino</span>;
}

/* ============================================================== */
/* ENGLISH: the same defect, another language                     */
/* ============================================================== */
/* The rule's first version only spoke Portuguese, and on an English repo it
 * returned zero, which is WORSE than not running, because zero passes as clean.
 * A Brazilian repo has both: a third-party piece arrives with English copy out
 * of the box. EXPECTED: 1 in usage-instruction, 1 in caption-of-what-follows. */
export function VerdadeiroIngles() {
  return (
    <div>
      <p>Click to open the component page.</p>
      <p>The three panels below cover the whole flow, in order.</p>
    </div>
  );
}

/* FALSE POSITIVE: an English subordinate clause describes, it does not command.
 * EXPECTED: zero. */
export function FalsoPositivoSubordinadaIngles() {
  return <p>When you scroll, the bar sticks to the header and the wire fills up.</p>;
}

/* ============================================================== */
/* LANGUAGE COLLISION: real findings from outside repos           */
/* ============================================================== */
/* Both came from a validation on three outside repos, and they are why the
 * rule was narrowed to require a verb GLUED to the mechanism.
 * EXPECTED: zero on both. */
export function FalsoPositivoColisao() {
  return (
    <div>
      <span>Supabase Service Role Key</span>
      <p>Scale down slightly on click.</p>
    </div>
  );
}

/* FALSE POSITIVE: a form field label describes the field, and that is its job.
 * It is not chrome next to a control that explains itself. EXPECTED: zero. */
export function FalsoPositivoRotuloDeCampo() {
  return (
    <div>
      <p>Choose the 3D model shown on the Overview tab.</p>
      <p>Selecione o tipo de cache que deseja atualizar.</p>
    </div>
  );
}

/* ============================================================== */
/* AN ASSIGNMENT IS NOT AN ATTRIBUTE                              */
/* ============================================================== */
/* Real finding on 2026-08-12 (visant-board, MemberIssuesView): guided empty
 * states build the message in a variable, and each branch of the `if` writes a
 * different `title`. The attribute regex matched the ASSIGNMENT, and R5
 * compared two sentences that NEVER show together: one replaces the other.
 *
 * A variable holds one value at a time. EXPECTED: zero, on the four sentences below. */
export function FalsoPositivoAtribuicaoNaoEhAtributo() {
  let title = "Nenhuma tarefa por aqui ainda";
  let hint = "Quando você receber tarefas no Linear, elas aparecem aqui.";
  if (Math.random() > 0.5) {
    title = "Nenhuma tarefa concluída ainda";
    hint = "Ao marcar tarefas como concluídas, elas ficam guardadas aqui.";
  }
  return <p>{title}</p>;
}

/* POSITIVE of the pair: the same text in TWO real attributes, in the same
 * render, is still the same information in two sizes. Both must be attributes
 * the person SEES (`title` is a tooltip, `placeholder` is the field's text):
 * the pair with `alt` that used to live here left with the fix of
 * 2026-08-19, see the "ALT TEXT" block right below.
 * EXPECTED: 1 same-info-twice finding. */
export function PositivoAtributoRepetido() {
  return (
    <div>
      <button type="button" title="O relatório mensal de horas trabalhadas pelo time" />
      <input placeholder="O relatório mensal de horas trabalhadas do time" />
    </div>
  );
}

/* ============================================================== */
/* ALT TEXT IS NOT VISUAL CHROME                                  */
/* ============================================================== */
/* False positive confirmed on 2026-08-19 (visant-club,
 * app/(club)/mural/page.tsx:73): R3 flagged as "caption of what comes" the `alt`
 * of an empty-state illustration, because the description ends in "ao lado".
 * `alt` is an accessibility duty, long by obligation, and nobody sees it on
 * screen: shortening it makes the product worse. `alt`, `aria-*` and SVG
 * `<title>`/`<desc>` leave THIS detector's scope (they stay in copy-lint's).
 *
 * EXPECTED: zero, on the four descriptions below. */
export function FalsoPositivoTextoAlternativo() {
  return (
    <div>
      <img
        src="/art/vazio-mural.webp"
        alt="Pintura a óleo de uma parede de galeria com várias molduras penduradas e nenhuma tela dentro delas, e uma escada encostada ao lado"
      />
      <button type="button" aria-label="Clique para abrir o painel de filtros do acervo" />
      <input aria-description="As opções a seguir filtram o acervo por formato e por ano" />
      <svg viewBox="0 0 1017 135" role="img">
        <title>As três colunas abaixo mostram o funil inteiro, na ordem do job</title>
        <desc>Clique para abrir o relatório completo do funil de vendas</desc>
        <path d="M0 0h1017v135H0z" />
      </svg>
    </div>
  );
}

/* ============================================================== */
/* A TS GENERIC + FUNCTION ARROW ARE NOT SCREEN TEXT              */
/* ============================================================== */
/* False positive confirmed on 2026-08-19 (visant-club,
 * components/club/Rail.tsx:142): R5 flagged "l.142 and l.145, 50% shared
 * words" on the `>` of a `=>` closing at the `<` of a generic. The extracted
 * chunk was `Array.from(ref.current?.querySelectorAll`: code, which nobody
 * reads on screen. The new sieves: a `>` preceded by `=` does not open a tag,
 * and interface text has balanced parentheses.
 *
 * EXPECTED: zero. */
export function FalsoPositivoGenericoEmCallback() {
  const itens = useCallback(
    () => Array.from(ref.current?.querySelectorAll<HTMLElement>('[data-item]') ?? []),
    []
  );
  const focaveisDe = (item: HTMLElement) =>
    Array.from(item.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));
  return { itens, focaveisDe };
}

/* The counterexample that keeps the sieve from becoming cowardice: BALANCED
 * parentheses inside a screen sentence are still a screen sentence, and these
 * two say the same thing. EXPECTED: 1 same-info-twice finding. */
export function PositivoFraseComParenteses() {
  return (
    <div>
      <p>O acervo (por enquanto) guarda toda aula publicada no clube.</p>
      <p>O acervo guarda toda aula publicada no clube, por enquanto.</p>
    </div>
  );
}

/* ============================================================== */
/* AN EMPTY STATE DOES NOT REPEAT ANOTHER EMPTY STATE             */
/* ============================================================== */
/* Real findings on 2026-08-12 (visant-board, TeamAgendaCard and TimeSheetView):
 * branches of the same `if/else`. One sentence REPLACES the other: the screen
 * shows at most one. EXPECTED: zero. */
export function FalsoPositivoDoisEstadosVazios() {
  const all: unknown[] = [];
  const mine: unknown[] = [];
  if (all.length === 0) return <p>Nada agendado nos próximos 14 dias.</p>;
  if (mine.length === 0) return <p>Nada seu nos próximos 14 dias.</p>;
  return <p>Nenhuma hora apontada nesta semana.</p>;
}

/* FALSE POSITIVE: `title` and `aria-label` with the same text is the
 * accessible pattern: same message, different audiences. Diverging them would
 * be the defect. EXPECTED: zero. */
export function FalsoPositivoNomeAcessivel() {
  return (
    <span
      role="img"
      title="Porte médio da entrega, quatro pontos"
      aria-label="Porte médio da entrega, quatro pontos"
    />
  );
}

/* ============================================================== */
/* A FAILURE MESSAGE SHARES THE FORMULA ON PURPOSE                */
/* ============================================================== */
/* Real finding on 2026-08-12 (visant-board, CommentSection): "Não foi possível
 * carregar os comentários" against "Não foi possível carregar os membros". The
 * formula is the house's consistent language for errors; what tells the two
 * apart is the complement. Diverging to escape the detector would worsen the UI.
 * EXPECTED: zero. */
export function FalsoPositivoDuasMensagensDeFalha() {
  return (
    <div>
      <p>Não foi possível carregar os comentários.</p>
      <p>Não foi possível carregar os membros.</p>
    </div>
  );
}

/* ============================================================== */
/* TWO ATTRIBUTES OF THE SAME ELEMENT ARE NOT TWO SCREEN SENTENCES */
/* ============================================================== */
/* Real finding on 2026-08-12 (liminal-stage, Hub.tsx:153): the search field puts
 * the same sentence in the `placeholder` and the `aria-label`: once for whoever
 * sees, once for whoever listens. It is a single field; the clue was the
 * repeated line in the finding ("l.153 and l.153"). Two JSX sentences that fit
 * on one line are still two sentences, so the exception asks that BOTH come
 * from an attribute. EXPECTED: zero. */
export function FalsoPositivoPlaceholderEAriaLabelDoMesmoCampo() {
  return (
    <input type="text" placeholder="buscar sala, mapa ou o que está tocando" aria-label="buscar sala, mapa ou faixa" />
  );
}

/* ============================================================== */
/* R6 · ARROW AS A CHARACTER: the law, and what it does NOT catch */
/* ============================================================== */
/* An icon is a library asset. An arrow glyph inherits the font metrics,
 * misaligns with the baseline, has no weight or size, and the screen reader
 * reads it as text. There are TWO findings here: the button arrow and the back link one.
 * EXPECTED arrow-glyph: 2. */
export function SetaEmCaractere() {
  return (
    <div>
      <a href="/x">
        Ver a proposta <span aria-hidden="true">→</span>
      </a>
      <button type="button">← Voltar</button>
    </div>
  );
}

/* The fix: an imported icon. No glyph, no hand-drawn SVG.
 * EXPECTED: zero. */
export function SetaComoIconeDeBiblioteca({ ArrowRight }: { ArrowRight: React.ComponentType<{ className?: string }> }) {
  return (
    <a href="/x">
      Ver a proposta <ArrowRight className="size-4" />
    </a>
  );
}

/* ============================================================== */
/* R6b · HAND-DRAWN ICON SVG vs. BRAND GRAPHIC                    */
/* ============================================================== */
/* The 24×24 grid is the universal icon box: whoever draws on it is
 * redrawing something that already exists in any library.
 * EXPECTED hand-drawn-icon: 1 (only the one below). */
export function IconeDesenhadoAMao() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/* A brand graphic has its own viewBox and is NOT replaceable by an import.
 * The rule cannot flag it, or it becomes noise and the team turns the detector off.
 * EXPECTED: zero. */
export function GrafismoDaMarca() {
  return (
    <svg viewBox="0 0 1017 135" aria-hidden="true">
      <path d="M0 0h1017v135H0z" />
    </svg>
  );
}

/* ============================================================== */
/* R8 · THE HIGHLIGHT THAT DECIDES NOTHING                        */
/* ============================================================== */
/* `on: true` written by hand in a card factory: the highlight runs once PER
 * ITEM, so the whole list lights up and the highlight stops highlighting.
 * Real case: jukebox, 2026-09-11: three records in the box, all three in the
 * queue, the whole grid in cyan and "on air" indistinguishable from "3rd in queue".
 * EXPECTED highlight-at-rest: 1. */
export function GradeToraAcesa({ discos }: { discos: { url: string }[] }) {
  return (
    <ul>
      {discos.map((d) => {
        const card = { on: true, flag: 'na fila' };
        return <li key={d.url} data-on={card.on}>{card.flag}</li>;
      })}
    </ul>
  );
}

/* A CALL ARGUMENT is not an item descriptor: false positive confirmed in the
 * first round (Director.tsx:823): `{ on: true }` there is the switch of a
 * video screen passed to a setter, and the eight-line window cannot tell
 * a callback's `=> {` from a factory's `=> ({`. What tells them apart is the
 * character before the brace: `name(` is a call.
 * EXPECTED: zero. */
export function InterruptorDaTela({ setScreen }: { setScreen: (v: { on: boolean }) => void }) {
  const itens = [{ key: 'tv' }];
  return itens.map((i) => ({
    key: i.key,
    add: () => { setScreen({ on: true }) },
  }));
}

/* EXCEÇÃO ao `ruido-scan/highlight-at-rest`: esta peça é UMA na tela — o
   plano que o cliente já assina — e está acesa de propósito, não uma vez por
   item de lista.
 * EXPECTED: zero. */
export function PlanoAtual() {
  const cartao = { on: true, nome: 'pro' };
  return <div data-on={cartao.on}>{cartao.nome}</div>;
}

/* ============================================================== */
/* R9 · TWO DOORS FOR THE SAME GESTURE (across files)             */
/* ============================================================== */
/* The label of the door here is, LITERALLY, the placeholder of the door in
 * `noise-door-b.tsx`. Real case: jukebox × record box, 2026-09-11:
 * same shape, same icons, different stores, and nothing on screen said which
 * was which. No per-file rule sees this.
 *
 * Since 2026-10-05 the rule requires the SAME SCREEN, so this room RENDERS the
 * box (`<PortaDaCaixa />`, imported at the top of the file), as in the jukebox:
 * without the import, the two ends would be unrelated screens and the rule would go quiet.
 * EXPECTED repeated-door: 2 (one end here, one end there). */
export function PortaDaSala({ Group }: { Group: React.ComponentType<{ cap: string; children?: React.ReactNode }> }) {
  return (
    <>
      <Group cap="endereço da faixa">{null}</Group>
      <PortaDaCaixa />
    </>
  );
}

/* ============================================================== */
/* NEGATIVES LOCKED ON 2026-09-21 (liminal-stage repo)            */
/* ============================================================== */

/* A KEY GLYPH is not a navigation arrow. The symbol printed on the key is the
 * only spelling that matches the physical object: no library icon replaces "the
 * Enter key" without becoming a generic arrow. It holds inside `<kbd>` and in a
 * prop that names a shortcut.
 * EXPECTED arrow-glyph: zero of these. */
export function TeclaDeAtalho({ Btn }: { Btn: React.ComponentType<{ hint: string }> }) {
  return (
    <>
      <span>número + <kbd>↵</kbd> anda no eixo</span>
      <Btn hint="⇧i" />
    </>
  );
}

/* AN OBJECT NESTED INSIDE AN ARGUMENT is still an argument. Before the fix of
 * 2026-09-21 the rule climbed ONE level and stopped: the brace containing `on: true`
 * is preceded by `? `, not by `name(`, and a room config setter became
 * "lit card factory".
 * EXPECTED highlight-at-rest: zero. */
export function LigaJogo({ struct }: { struct: (p: Record<string, unknown>) => void }) {
  const setJogo = (id: string) =>
    struct({ game: id ? { on: true, minigame: id, tempo: 80 } : null });
  return <button onClick={() => setJogo('gartic')}>jogo</button>;
}

/* A TS GENERIC closes with `>` and opens with `<` just like a tag: two generics
 * on neighboring lines make the extractor read the CODE between them as a screen
 * sentence. The chunk has balanced parentheses and no reserved word: it got past
 * every sieve.
 * EXPECTED same-info-twice: zero. */
export function LampadasFalsas({ N }: { N: number }) {
  const falsa = {
    ids: Array<string | null>(N).fill(null),
    pesos: Array<number>(N).fill(0),
  };
  return <span>{falsa.ids.length}</span>;
}

/* AN IDENTICAL ACCESSIBLE NAME on sibling controls is symmetry, not repetition:
 * two buttons that do the same thing in opposite directions need the same name.
 * EXPECTED same-info-twice: zero. */
export function MoverNaFileira({ Btn, slot }: { Btn: React.ComponentType<{ label: string }>; slot: number }) {
  return (
    <>
      <Btn label={`mover a peça para a tecla ${slot - 1}`} />
      <Btn label={`mover a peça para a tecla ${slot + 1}`} />
    </>
  );
}
