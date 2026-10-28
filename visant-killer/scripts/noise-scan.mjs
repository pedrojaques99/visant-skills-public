#!/usr/bin/env node
/**
 * noise-scan (formerly ruido-scan): the CHROME POLLUTION detector.
 *
 * The three detectors that already existed look at something else: `impeccable`
 * finds the AI tell in code, `audit:design` finds the wrong token, `copy-lint`
 * finds voice tics in a sentence. None of them sees the most common defect of a
 * screen built by an agent: **the whole page working, correctly written, with
 * the right tokens, and still unreadable from so much supporting text.**
 *
 * The case that produced this file: five rooms of a showcase were rebuilt by
 * five agents in parallel, each one following the house skills. Every gate went
 * green. And the user opened the screen and said "still full of text,
 * unnecessary labels, visual noise". Counted, there were ELEVEN text blocks
 * before the first pixel of product, and the same information appeared three
 * times, in three sizes.
 *
 * Why this gets past everything: **each piece of chrome, alone, is defensible.**
 * The label names the section. The note guides. The instruction helps whoever
 * arrives. The ordinal gives order. No line is "wrong": the damage is the SUM,
 * and no linter sums. An agent in particular writes this by default: it has
 * just decided on a structure and wants the structure to show, so it captions
 * everything it did. It is the signature of someone explaining their own work
 * instead of delivering it.
 *
 * The rules below are the ones that survived real cases. Each one targets a
 * pattern that is only a defect by accumulation, and that is why almost all of
 * them have a FLOOR: one occurrence is a choice, three is a symptom.
 *
 * Two of them (2026-09-11) are NOT about text, and came in because text was not
 * the problem: `highlight-at-rest` finds highlight at rest (the highlight
 * that runs once per item and lights up the whole list) and `repeated-door`
 * finds the same data door named in two files. The second is the first rule of
 * this skill that does not fit in one file, and the finding that produced it
 * had gotten past the seven previous rules, `tsc`, `ui:audit` and 2347 tests.
 *
 * Six came in on 2026-10-05 (slop killer phase 2 in visantlabs-os), all found
 * by OPENING the screen after the detectors went green: `synthetic-cover`,
 * `tile-img-no-onerror`, `stagger-by-index`, `hover-lift`,
 * `dot-grid` and `blur-on-card`. The same day `repeated-door` started
 * requiring the SAME SCREEN through the import graph (`grafo.mjs`): from 25
 * findings, almost all false, down to 2 real ones.
 *
 * Nine more came in on 2026-10-28, from the design-slop signals 47-57 of the
 * catalog: `tag-everywhere`, `italic-headline-word`, `display-serif-tight`,
 * `divider-everywhere`, `opacity-ladder`, `box-in-box`, `code-crumb`,
 * `numbered-section` and `mono-everywhere`. Signals 50 and 54 stay with the eye.
 *
 * Usage:
 *   node noise-scan.mjs <target...>          # files or folders
 *   node noise-scan.mjs --quiet <target...>  # scoreboard only
 *
 * Exits 1 on findings. A finding here is a CUT CANDIDATE, not an automatic fix:
 * confirm it at file:line before deleting, because one of those lines may be
 * the only one that really guides. The golden rule of cutting is in
 * `references/slop-catalog.md`, entry "page that explains itself".
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { montarGrafo, ancestrais, nomesEm, normP, semComentario, semComentario as tirarComentario } from './grafo.mjs';

const args = process.argv.slice(2);
const quiet = args.includes('--quiet');
const targets = args.filter((a) => !a.startsWith('--'));

/*
 * No work at the top level: this module is also imported.
 *
 * `killer-scan.mjs` imports `scanRuido` from here, and `import` runs the whole
 * module. Since the target check and the scan read `process.argv` at the top,
 * they saw the arguments of WHOEVER IMPORTED: in
 * `killer-scan --init-report AUDIT.md <target>`, the report name came in as a
 * target and `walk` blew up with ENOENT on a file not yet created, taking down
 * the whole gate before the first detector, and precisely on the command the
 * skill says to run first.
 *
 * The `executadoDireto` guard already existed down below. The problem is that
 * the work happened before it.
 */
function exigirAlvo() {
  /* `--self-test` runs against the fixture and needs no target. */
  if (!targets.length && !args.includes('--self-test')) {
    console.error('usage: node noise-scan.mjs [--quiet] <file|folder>...');
    console.error('       node noise-scan.mjs --self-test    # locks the rules against the fixture');
    process.exit(2);
  }
}

/*
 * What is never a product screen.
 *
 * `.claude` and `worktrees` came in after running on an outside repo: it had
 * two agent worktrees versioned inside it, and the same file was counted three
 * times. Nineteen findings became six real ones, and an inflated scoreboard is
 * worse than the right number: it makes the team think the debt is bigger than
 * it is and give up before starting.
 */
const IGNORA = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.turbo',
  '.claude', 'worktrees', '.worktrees', 'out', 'storybook-static', '.cache', 'vendor',
]);

function walk(p, out = []) {
  const st = fs.statSync(p);
  if (st.isFile()) {
    if (/\.(tsx|jsx)$/.test(p)) out.push(p);
    return out;
  }
  for (const e of fs.readdirSync(p)) {
    if (IGNORA.has(e)) continue;
    walk(path.join(p, e), out);
  }
  return out;
}

/** Resolves the target only when someone asks, never on import. See `exigirAlvo`. */
const listarArquivos = () => targets.flatMap((t) => walk(path.resolve(t)));

/* ------------------------------------------------------------------ */
/* extraction: only what reaches the user's eye                        */
/* ------------------------------------------------------------------ */

/**
 * JSX text and the attributes that become text on screen.
 *
 * Deliberately does NOT look at comments, variable names or code strings: the
 * detector dies of false positives at the first `const label = "clique"` if it
 * does, and a noisy detector is a detector the agent learns to ignore.
 */
function extrairTextos(src) {
  const out = [];
  /* a single pass: `// /community/*` in a line comment does not open a block (see grafo.mjs) */
  const semComentario = tirarComentario(src)
    /*
     * SVG `<title>` and `<desc>` are ACCESSIBLE NAME, not visual chrome.
     *
     * Same reason as `alt` (see ATTRS below): nobody sees this text on screen,
     * it exists for screen reader users. A detector that asked to shorten it
     * would be asking to make accessibility worse.
     */
    .replace(/<(title|desc)(\s[^>]*)?>[\s\S]*?<\/\1>/g, (m) => m.replace(/[^\n]/g, ' '));

  const linhaDe = (idx) => semComentario.slice(0, idx).split('\n').length;

  /*
   * TEXT INSIDE A CODE BLOCK IS NOT A SCREEN SENTENCE, and so it gets a mark.
   *
   * False positive confirmed in slop killer round 1 (visantlabs-os,
   * 2026-10-05): 14 `same-info-twice` findings on DocsPage, all inside
   * example blocks: `# Pass your API key in every request` against
   * `# Pass your API key in the Authorization header`, and endpoint lists
   * (`POST /api/...`) in different sections. API docs repeat the auth header in
   * every section ON PURPOSE: whoever arrives by anchor reads only one.
   *
   * A code block here is `<pre>`, `<code>` and an element with a `font-*mono`
   * class (that is how this house and almost every repo draws an example
   * block). The text is still extracted (the other rules still look), it just
   * carries the `codigo` mark, and R5 does not compare marked sentences.
   */
  const regioesDeCodigo = [];
  for (const m of semComentario.matchAll(/<([A-Za-z][\w.]*)\b((?:[^<>{}]|\{[^{}]*\})*)>/g)) {
    const tag = m[1];
    const attrs = m[2] ?? '';
    if (attrs.trimEnd().endsWith('/')) continue;
    if (!(tag === 'pre' || tag === 'code' || /\bfont-[\w-]*mono\b/.test(attrs))) continue;
    /* closes on the tag with the SAME name, counting nesting */
    const nome = tag.replace('.', '\\.');
    const re = new RegExp(`<${nome}\\b|</${nome}\\s*>`, 'g');
    re.lastIndex = m.index + m[0].length;
    let prof = 1;
    let fim = semComentario.length;
    for (let x = re.exec(semComentario); x; x = re.exec(semComentario)) {
      if (x[0].startsWith('</')) {
        if (--prof === 0) { fim = x.index; break; }
      } else prof++;
    }
    regioesDeCodigo.push([m.index, fim]);
  }
  const emCodigo = (idx) => regioesDeCodigo.some(([a, b]) => idx >= a && idx < b);

  /*
   * A METADATA ATTRIBUTE NEVER REACHES THE EYE. `<SEO description=…>` and
   * `<SoftwareApplicationSchema description=…>` repeat the same sentence by duty
   * (Google snippet and JSON-LD), and neither appears on screen. False positive
   * confirmed at BrandingMachinePage:1022 and DocsPage:354 in the same round.
   */
  const TAG_META = /^(SEO|Seo|Helmet|Head|meta|link|\w*Schema|JsonLd\w*|StructuredData\w*|Metadata)$/;
  const metaEm = (idx) => {
    const j = semComentario.lastIndexOf('<', idx);
    if (j === -1) return false;
    const m = semComentario.slice(j, j + 60).match(/^<([A-Za-z][\w.]*)/);
    return !!m && TAG_META.test(m[1]);
  };
  /*
   * An i18n key (`placeholder={t('common.search')}`) is not the text, it is its
   * ADDRESS. Before this mark, the words "common search" became a screen
   * sentence and R9 flagged four searches on four different screens as the same
   * door: the deliberate reuse of a common vocabulary key.
   */
  const CHAVE_I18N = /^[\w-]+(\.[\w-]+)+$/;
  const marcas = (idx, t) => ({ codigo: emCodigo(idx), meta: metaEm(idx), chave: CHAVE_I18N.test(t) });

  /*
   * Loose text between tags, and the sieve that separates text from CODE.
   *
   * False positive confirmed in a real round: `React.useState<string | null>`
   * followed by another line with `React.useState<TipoFilter>` matches the
   * `>…<` pattern, because a TypeScript generic uses the same signs as a tag.
   * The two extracted "sentences" were nearly identical state declarations, and
   * the repeated-information rule flagged 50% shared words between two lines of
   * code nobody will ever read on screen.
   *
   * A detector that shouts at code loses the authority it needs when it shouts
   * at the screen. The sieve: interface text has no `=`, `;`, `=>` or JS
   * reserved word.
   */
  const CHEIRO_DE_CODIGO = /[;=]|=>|\b(const|let|var|function|return|await|import|export|React|use[A-Z])\w*/;
  /*
   * Two more sieves, and both came from the SAME false positive confirmed on
   * 2026-08-19 (visant-club, `components/club/Rail.tsx`): R5 flagged "l.142
   * and l.145, 50% shared words" on
   *
   *     () => Array.from(ref.current?.querySelectorAll<HTMLElement>('[data-item]')
   *     ...  Array.from(item.querySelectorAll<HTMLElement>('a[href], button')
   *
   * The `>` of the `=>` opens the match and the `<` of the generic closes it, so
   * the extracted chunk was `Array.from(ref.current?.querySelectorAll`: pure
   * code, which escaped `CHEIRO_DE_CODIGO` because it has no `=`, `;` or
   * reserved word. Neither line reaches anyone's eye, and SKILL.md is explicit:
   * this detector only looks at strings that reach the user's eye.
   *
   *   - **`=>` is not a tag opening.** If the character before the `>` is `=`,
   *     the match started at a function arrow, not at a tag close.
   *   - **Interface text has balanced parentheses and brackets.** Code cut in the
   *     middle of a call almost never does. It is generic enough to catch the
   *     next code fragment without squeezing screen sentences:
   *     "Grátis (por enquanto)" still passes.
   */
  const arrowFn = (i) => semComentario[i - 1] === '=';
  /*
   * A TS GENERIC CLOSES WITH `>` JUST LIKE A TAG, and opens with `<` just like
   * one too, so a pair of generics on neighboring lines becomes "text" between
   * them. False positive confirmed on 2026-09-21 (liminal-stage, PiscinaDeLuz.tsx:86):
   *
   *     ids:   Array<string | null>(PS1_LAMPS).fill(null),
   *     pesos: Array<number>(PS1_LAMPS).fill(0),
   *
   * The extracted chunk (`(PS1_LAMPS).fill(null), pesos: Array`) has balanced
   * parentheses, no `=`, no `;` and no reserved word. It got past every sieve
   * and became "57% shared words" with the line above.
   *
   * The test looks behind the `>` that opened the match: if there is a matching
   * `<` containing ONLY type stuff (identifier, `|`, `&`, `,`, `[]`, `?`, `.`)
   * and an identifier comes before that `<`, it was a generic. A real tag would
   * have `=`, `"` or `/` in there.
   */
  const genericoTS = (i) => {
    const fim = i;
    let j = fim - 1;
    let prof = 0;
    for (; j >= 0 && fim - j < 120; j--) {
      const c = semComentario[j];
      if (c === '>') prof++;
      else if (c === '<') { if (prof === 0) break; prof--; }
      else if (!/[\w\s|&,[\]?.]/.test(c)) return false;
    }
    if (j < 0 || semComentario[j] !== '<') return false;
    return /[A-Za-z0-9_$]/.test(semComentario[j - 1] ?? '');
  };
  const desbalanceado = (t) => {
    const par = { ')': '(', ']': '[' };
    const pilha = [];
    for (const c of t) {
      if (c === '(' || c === '[') pilha.push(c);
      else if (par[c] && pilha.pop() !== par[c]) return true;
    }
    return pilha.length > 0;
  };
  for (const m of semComentario.matchAll(/>([^<>{}]{3,400})</g)) {
    const t = m[1].replace(/\s+/g, ' ').trim();
    if (!t || !/\p{L}/u.test(t)) continue;
    if (CHEIRO_DE_CODIGO.test(t)) continue;
    if (arrowFn(m.index) || genericoTS(m.index)) continue;
    if (desbalanceado(t)) continue;
    out.push({ texto: t, linha: linhaDe(m.index), ...marcas(m.index, t) });
  }
  /*
   * Attributes that show up for the person.
   *
   * False positive confirmed on 2026-08-12 (visant-board, MemberIssuesView):
   * the regex does not tell the ATTRIBUTE `title="Fechar"` from the ASSIGNMENT
   * `title = "Nenhuma tarefa por aqui ainda";`. And the difference matters a lot
   * for R5: a variable holds one value at a time, so two `title = …` in branches
   * of an `if/else` NEVER appear together on screen. Flagging them as "the same
   * information in two sizes" is flagging an empty state for repeating the other
   * one it replaces.
   *
   * Two discriminators, and either one alone settles the case:
   *   - declaration: comes after `let`/`const`/`var`;
   *   - statement: ends in `;` (a JSX attribute never ends in a semicolon:
   *     after it comes a space, another attribute, `/` or `>`).
   */
  /*
   * ALT TEXT IS NOT CHROME, and that is why it left this list.
   *
   * False positive confirmed on 2026-08-19 (visant-club,
   * `app/(club)/mural/page.tsx:73`): R3 flagged as "caption of what comes" the
   * `alt` of an empty-state illustration:
   *
   *   alt="Pintura a óleo de uma parede de galeria com várias molduras
   *        penduradas e nenhuma tela dentro delas, e uma escada encostada ao lado"
   *
   * because the sentence ends in "ao lado". But `alt` is an image description
   * for screen readers: it is REQUIRED, long by duty, and NOBODY sees it on
   * screen. This detector counts VISUAL pollution; asking to shorten an `alt` is
   * asking to make accessibility worse, the opposite of what the rule defends.
   *
   * `alt`, `aria-label`, `aria-description(by)` and SVG `<title>`/`<desc>` are
   * out of scope for THIS detector. They stay in scope for `copy-lint`, which
   * judges voice, not screen density.
   *
   * `title` (attribute) STAYS: a tooltip shows for whoever sees, and a tooltip
   * that repeats the label next to it is exactly the chrome R5 hunts.
   */
  /*
   * `cap` CAME IN on 2026-09-11, through a finding that got past the seven
   * rules. `<Group cap="link ou arquivo">` is how this codebase names a panel
   * section: it is a screen label, as visible as a `title`, and it was out of
   * the detector's scope. The pair it formed with an identical `placeholder` in
   * another file (see R8, `repeated-door`) was invisible because HALF OF THE
   * PAIR was not extracted: a detector blind in one eye approves what it did
   * not see.
   *
   * It only matches a quoted string, so `cap={40}` (numeric ceiling, the other
   * meaning of the word in this codebase) stays out.
   */
  /* `(?<![-\w])` is what stops `aria-label` from coming in via `label` and
     `aria-description` via `description`: `\b` alone matches after the hyphen. */
  const ATTRS = /(\blet\s+|\bconst\s+|\bvar\s+)?(?<![-\w])(title|label|placeholder|heading|hint|cap|tese|nota|contexto|titulo|descricao|description)\s*=\s*(?:"([^"]{3,400})"|'([^']{3,400})'|\{\s*["'`]([^"'`]{3,400})["'`]\s*\})(\s*;)?/g;
  for (const m of semComentario.matchAll(ATTRS)) {
    const declaracao = !!m[1];
    const statement = !!m[6];
    if (declaracao || statement) continue; // it is code, not a screen attribute
    const t = (m[3] ?? m[4] ?? m[5] ?? '').replace(/\s+/g, ' ').trim();
    if (t && /\p{L}/u.test(t)) out.push({ texto: t, linha: linhaDe(m.index), attr: m[2], ...marcas(m.index, t) });
  }
  /*
   * A VISIBLE ATTRIBUTE WHOSE VALUE IS AN EXPRESSION: the hole that let a
   * confirmed finding get past seven rules.
   *
   * The `ATTRS` above only reads a raw string (`placeholder="x"`) or a lone
   * string inside braces. But screen text is rarely raw in a real app:
   *
   *   placeholder={api.set ? `link · vai pra "${api.set}"` : compact ? 'link ou arquivo' : 'url .mp3'}
   *
   * That `'link ou arquivo'` is as visible as any other, and it was the
   * invisible half of the jukebox repeated-door pair (2026-09-11): R9 ran
   * against the broken code and returned zero, because the typing side never
   * reached the extractor. A detector that only reads the easy case approves
   * the real one.
   *
   * Here every literal INSIDE the attribute value comes in, with the literal's
   * own line (not the attribute's: `file:line` has to point at the word). The
   * scope is the attribute expression, with balanced braces and a 600-character
   * ceiling: it is where only screen text lives, and so it does not become the
   * code sieve the rest of this file spent three rounds building.
   */
  const ATTR_EXPR = /(?<![-\w])(title|label|placeholder|heading|hint|cap|tese|nota|contexto|titulo|descricao|description)\s*=\s*\{/g;
  for (const m of semComentario.matchAll(ATTR_EXPR)) {
    const ini = m.index + m[0].length;
    let prof = 1;
    let i = ini;
    for (; i < semComentario.length && i < ini + 600 && prof > 0; i++) {
      const c = semComentario[i];
      if (c === '{') prof++;
      else if (c === '}') prof--;
    }
    const expr = semComentario.slice(ini, i - 1);
    /* a lone string was already extracted by ATTRS: do not count it twice */
    if (/^\s*["'`][^"'`]*["'`]\s*$/.test(expr)) continue;
    for (const lit of expr.matchAll(/"([^"\n]{3,200})"|'([^'\n]{3,200})'|`([^`$\n]{3,200})`/g)) {
      const t = (lit[1] ?? lit[2] ?? lit[3] ?? '').replace(/\s+/g, ' ').trim();
      if (!t || !/\p{L}/u.test(t)) continue;
      if (CHEIRO_DE_CODIGO.test(t)) continue;
      out.push({ texto: t, linha: linhaDe(ini + lit.index), attr: m[1], ...marcas(m.index, t) });
    }
  }
  /*
   * DEDUPE by line+text: the two attribute passes can touch the same string,
   * and a duplicated string would become a PAIR for R5 ("the same information
   * in two sizes"): the detector accusing itself of repeating.
   */
  const visto = new Set();
  return out.filter((o) => {
    const k = `${o.linha}|${o.attr ?? ''}|${o.texto}`;
    if (visto.has(k)) return false;
    visto.add(k);
    return true;
  });
}

const PALAVRA_VAZIA = new Set(
  ('a o e de da do das dos que em no na nos nas um uma uns umas para pra por com sem se ao aos à às ' +
    'the of and to in for on is are it this that as at by or be')
    .split(' '),
);

const conteudo = (t) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !PALAVRA_VAZIA.has(w));

/* ------------------------------------------------------------------ */
/* the per-file rules                                                  */
/* ------------------------------------------------------------------ */

const REGRAS = [];

/*
 * R1: shouted label.
 *
 * `font-mono text-micro uppercase tracking-wider text-muted-foreground` on a
 * single line is a typography choice. Five of them stacked on one page is the
 * generic dashboard tell: each section announces its own name in caps before
 * showing anything. Apple groups with space and body hierarchy; a template
 * groups with tags.
 *
 * Floor of 3 per file, because a table header or a single eyebrow is
 * legitimate and common.
 */
REGRAS.push({
  id: 'shouting-label',
  descricao: 'uppercase + tracking + micro-size label, repeated on the same screen',
  piso: 3,
  achar(src, file) {
    const out = [];
    const CLASSE = /class(?:Name)?\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/g;
    for (const m of src.matchAll(CLASSE)) {
      const c = m[1] ?? m[2] ?? m[3] ?? '';
      const grita = /\buppercase\b/.test(c);
      const espacado = /\btracking-(wide|wider|widest)\b/.test(c);
      const miudo = /\btext-(micro|rotulo|xs|\[1[01]px\]|\[0\.6\d+rem\])\b/.test(c);
      if (grita && espacado && miudo) {
        out.push({ linha: src.slice(0, m.index).split('\n').length, amostra: 'uppercase+tracking+micro' });
      }
    }
    return out;
  },
});

/*
 * R2: text that teaches how to use.
 *
 * "Clique para abrir a ficha", "arrasta um cartão pra outra coluna", "passe o
 * mouse". A usage instruction is what gets written when the screen does not
 * explain itself, and almost always the screen DOES explain itself, and the
 * sentence was only there because whoever built it wanted to be sure the work
 * would be noticed.
 *
 * No floor: a single one is already a symptom, and cheap to confirm.
 *
 * **The rule was NARROWED after running on three outside repos.** The first
 * version accepted a loose verb (`escolha`, `selecione`, `digite`, `choose`,
 * `select`, `enter`) and fell into two traps that only show up outside the
 * house:
 *
 * - **Language collision.** "Supabase Service **Role** Key" became a finding
 *   because `role` is the imperative of "rolar" (scroll) in Portuguese. "Scale
 *   down slightly on **click**" too, with `click` being a noun. In a bilingual
 *   repo this is constant, and a detector that is wrong 40% of the time is a
 *   detector the team turns off.
 * - **A form label is not chrome.** "Choose the model shown on the Overview
 *   tab" describes what the field does; that is the label's job. The rule
 *   targets an instruction next to a control that ALREADY explains itself, not
 *   the label that explains a field which cannot explain itself.
 *
 * The high-precision core that remained: the verb has to be glued to the
 * MECHANISM (clique **para**, arraste **o**, role **a**, click **to**, drag
 * **the**, hover over). A verb alone is not enough.
 *
 * Known legitimate exception: first use of a gesture with no native affordance
 * (dragging a canvas, a keyboard shortcut). Then the instruction stays, with
 * the reason written on the line.
 */
REGRAS.push({
  id: 'usage-instruction',
  descricao: 'sentence teaching how to operate a control that already has affordance',
  piso: 1,
  texto: true,
  achar(textos) {
    /*
     * Bilingual on purpose.
     *
     * The first version only spoke Portuguese, and on an English repo it would
     * find zero, which is WORSE than not running, because a detector that
     * returns zero passes as a clean screen. This rule's pattern is not
     * linguistic, it is about posture: an imperative aimed at the reader,
     * telling them to operate a control. That exists the same way in both
     * languages, and a Brazilian repo usually has both (a third-party piece
     * ships with English copy out of the box: that is how a `StoreStatus`
     * arrived saying "Open now until 18h" at the top of the most expensive fold
     * of a Brazilian landing page).
     */
    const GESTO =
      /(\bclique (para|aqui|no|na|em)|\bclica (no|na|em|aqui)|\baperte (o|a|para)|\barrast[ae] (o|a|um|uma|para|pra)|\barraste-?o\b|\bsolt[ea] (o|a|aqui|fora)|\bpasse o mouse|\bpassa o mouse|\brole (a|o|as|os|at[ée]|para|pra)|\bclick (to|here|on the|and)|\btap (to|here)|\bdrag (the|it|a|to|and)|\bdrop (it|the|here)|\bhover over|\bscroll (to|down to|up to))/i;
    /*
     * A quoted verb is an EXAMPLE, not an instruction.
     *
     * False positive confirmed in a real round: the placeholder of an
     * accent-tolerant search said `tente "animacao", "vintage", "arrastar"`.
     * The three words are test terms (the piece is proving it finds "animacao"
     * without the tilde), and "arrastar" there tells nobody to drag anything.
     * An `audit-ignore` on the file would hide the next case; it was the rule
     * that was badly written.
     */
    const semExemplos = (s) => s.replace(/["“”'‘’][^"“”'‘’]{1,40}["“”'‘’]/g, ' ');
    /*
     * An imperative commands; a subordinate clause describes.
     *
     * "Role a lista e a barra gruda" is an instruction. "AO ROLAR, a barra
     * gruda" is the same information without commanding anyone: it is a
     * description of behavior, which is exactly what a component sheet should
     * say. The rule exists to kill the wagging finger, not the declarative
     * sentence; without this sieve it would push all component docs into the
     * passive voice.
     */
    const semSubordinada = (s) =>
      s.replace(/\b(ao|quando|se|enquanto|depois de|antes de|when|while|after|before)\s+\p{L}+/giu, ' ');
    return textos
      .filter(
        (t) => GESTO.test(semSubordinada(semExemplos(t.texto))) && conteudo(t.texto).length >= 3,
      )
      .map((t) => ({ linha: t.linha, amostra: t.texto.slice(0, 60) }));
  },
});

/*
 * R3: caption of what comes next.
 *
 * "As dez peças abaixo cobrem…", "veja a seguir", "o gráfico ao lado mostra".
 * The sentence narrates what the page itself shows two centimeters later. It is
 * the most expensive text on a screen: it takes the prime spot to say what the
 * content would say on its own, and it goes stale the first time someone
 * reorders the page (then it lies).
 *
 * A form description is NOT exempt, decided on 2026-10-28 (shadcn-ui/taxonomy):
 * "Enter your email below to create your account" is shadcn's default auth
 * copy, and the same repo's login page says "Enter your email to sign in to
 * your account", with no pointer and nothing lost. That is the fix, one word.
 * Exempting form or auth context would also exempt "fill in the form below",
 * the canonical case of this rule.
 */
REGRAS.push({
  id: 'caption-of-what-follows',
  descricao: 'sentence narrating the content that appears right after it',
  piso: 1,
  texto: true,
  achar(textos) {
    const APONTA =
      /\b(?:(?:abaixo|acima)(?!\s+(?:de|do|da|dos|das)\b)|a seguir|logo em seguida|ao lado|aqui embaixo|na imagem acima|below|above|as you can see|on the right|on the left|the following)\b/i;
    return textos
      .filter((t) => APONTA.test(t.texto) && conteudo(t.texto).length >= 4)
      .map((t) => ({ linha: t.linha, amostra: t.texto.slice(0, 60) }));
  },
});

/*
 * R4: verb repeated per item.
 *
 * A list of five pieces where each name is followed by the word `add` writes
 * `add` five times in the same strip. The second one already says nothing, and
 * from the third on it is texture. The fix is always the same: the action
 * becomes an icon (one character wide) or appears on hover and focus.
 *
 * Detects a short constant string rendered INSIDE a `.map(`.
 */
REGRAS.push({
  id: 'verb-per-item',
  descricao: 'constant action word repeated once per list item',
  piso: 1,
  achar(src) {
    const out = [];
    const MAP = /\.map\(\s*\(?[^)]*\)?\s*=>\s*\(?/g;
    for (const m of src.matchAll(MAP)) {
      const trecho = src.slice(m.index, m.index + 1400);
      for (const t of trecho.matchAll(/>\s*([\p{L}]{2,8})\s*</gu)) {
        const p = t[1].toLowerCase();
        if (/^(add|copiar|copy|ver|abrir|open|usar|use|editar|baixar|instalar)$/.test(p)) {
          out.push({
            linha: src.slice(0, m.index + t.index).split('\n').length,
            amostra: `"${t[1]}" per item`,
          });
        }
      }
    }
    return out;
  },
});

/*
 * R6: drawn arrow, in both forms.
 *
 * House LAW, written after it showed up in repo after repo: **an icon is a
 * library asset, never a character and never a hand-written SVG.**
 *
 * Case A is the glyph (`→`, `←`, `↑`, `↓`, and the family of variants). It is
 * Claude's #1 habit, and it gets past every linter because, to the compiler,
 * it is just a letter. The defects are typographic, not a matter of taste:
 *
 * - it inherits the font metrics of the text, so it misaligns with the
 *   baseline of the label next to it, and the misalignment changes with the
 *   family;
 * - it has no controllable weight or size (`weight`, `size`), so it does not
 *   follow the screen hierarchy;
 * - its drawing changes with the installed font, and it vanishes for fonts
 *   without the glyph, becoming tofu;
 * - the screen reader reads it as text, not decoration.
 *
 * Case B is the `<svg>` drawn by hand inside the component. It aims NARROW, at
 * the only high-precision signature: a `viewBox` on the universal icon grid
 * (`0 0 16 16`, `0 0 20 20`, `0 0 24 24`). Whoever draws a UI glyph in that box
 * is redrawing an icon that already exists in any library. Logos also live on
 * the 24 grid (Simple Icons), so brand marks and icon files are filtered out
 * below: the rule only flags what an import can replace.
 *
 * No floor: a single one is already the law broken, and cheap to confirm.
 *
 * Legitimate exception, with the reason written on the line, like every
 * exception in this skill: a glyph inside an example or documentation code
 * block, and an arrow as the client's own data content (a timeline written as
 * "Exatas → engenharia"). In both cases the arrow is real text, not interface
 * chrome.
 */
const SETA_GLIFO = /[←-⇿⟰-⟿⤀-⥿⬀-⬑➜-➾]/u;

/*
 * It runs on the CODE, not on the extracted text, and that is a fix, not a
 * preference. The first version used `texto: true` and caught `← Voltar`, but
 * let `<span aria-hidden="true">→</span>` through: the extractor discards
 * single-character nodes, which is precisely the MOST common form of the habit.
 * A detector that misses the dominant case is worse than none, because it
 * returns zero and zero looks like approval.
 *
 * Comments are removed before matching, otherwise this rule's own docs (which
 * need to quote the glyphs to be readable) would become findings.
 */
REGRAS.push({
  id: 'arrow-glyph',
  descricao: 'arrow as a character where a library icon should be',
  piso: 1,
  achar(src) {
    /* Replaces comments with spaces of the same length: kills the false positive
       without shifting any line, so the finding's line number stays right. */
    const limpo = src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) =>
      m.replace(/[^\n]/g, ' ')
    );
    const out = [];
    const RE = new RegExp(SETA_GLIFO.source, 'gu');
    /*
     * A KEY GLYPH IS NOT A NAVIGATION ARROW: false positive confirmed in a real
     * repo (liminal-stage: `<kbd>↵</kbd>`, `hint="⇧i"`). The symbol printed on
     * the key is the only spelling that matches the physical object; no library
     * icon replaces "the Enter key" without becoming a generic arrow.
     *
     * The test is about the neighborhood, not the character: inside `<kbd>`, or
     * in a prop that names a key/shortcut. Outside that, the arrow is still the
     * habit the rule exists to catch.
     */
    const TECLA = /[\u21B5\u21E7\u2318\u2325\u238B\u21E5\u23CE]/u;
    const emTecla = (linhaTxt, ch) =>
      TECLA.test(ch) && /<kbd>|<\/kbd>|(hint|Hint|atalho|shortcut|key|Key)\s*=/.test(linhaTxt);
    for (const m of limpo.matchAll(RE)) {
      const inicio = limpo.lastIndexOf('\n', m.index) + 1;
      const fim = limpo.indexOf('\n', m.index);
      if (emTecla(limpo.slice(inicio, fim === -1 ? undefined : fim), m[0])) continue;
      out.push({
        linha: limpo.slice(0, m.index).split('\n').length,
        amostra: limpo.slice(inicio, fim === -1 ? undefined : fim).trim().slice(0, 40),
      });
    }
    return out;
  },
});

/*
 * Case B, CALIBRATED ON THIRD-PARTY REPOS (2026-10-28).
 *
 * The first version said "nobody draws a brand logo on the 24 grid". Wrong:
 * Simple Icons (the source of almost every tech logo on the web) ships on
 * `0 0 24 24`. Run on shadcn-ui/taxonomy, vercel/commerce and
 * steven-tey/precedent, 11 of the 11 hits were noise or borderline: the
 * Next.js/React/Prisma/Tailwind/Stripe/GitHub logos of a marketing grid, and
 * the files of a dedicated `components/shared/icons/` folder. A logo has no
 * library import that replaces it, and the icons folder is exactly where an
 * inline SVG belongs. What stayed is the case the law is about: a UI glyph
 * (shield, chevron, x, arrow) inlined in a regular component.
 *
 * Out of the rule:
 *   - the file IS the icon set: inside an `icons/` or `icon/` folder, or named
 *     `*icon*` / `*logo*` (any case);
 *   - the SVG is a brand mark: a `<title>` or `aria-label` that is not a UI
 *     glyph word (`close`, `menu`, `chevron`...), a path longer than
 *     `PATH_DE_LOGO` characters (measured: the shortest logo, Prisma, has 214;
 *     a chevron or an x has 20 to 150), or a literal color in `fill`/`stroke`
 *     (a multicolor brand mark; `currentColor`, black and white do not count).
 *
 * And it reads the repo's `package.json`: with an icon library installed, every
 * hand-drawn glyph is a finding that names the library to import from. Without
 * one, the fix is adopting a library, not editing each SVG, so the file gets ONE
 * finding with that hint instead of one per glyph.
 */
const PATH_DE_LOGO = 200;
const LIBS_DE_ICONE = [
  'lucide-react', 'lucide-vue-next', 'lucide-svelte', '@heroicons/react', '@radix-ui/react-icons',
  'react-icons', '@tabler/icons-react', '@phosphor-icons/react', 'phosphor-react', '@iconify/react',
];
const PALAVRA_DE_GLIFO =
  /\b(icon|close|x|menu|hamburger|chevron|caret|arrow|check|checkmark|tick|plus|minus|add|remove|delete|trash|search|expand|collapse|open|next|prev|previous|back|forward|more|dismiss|cancel|edit|copy|settings|loading|spinner|info|warning|error|external|link|fechar|abrir|voltar|avançar|próximo|anterior|buscar|mais|menos|adicionar|remover|excluir|editar|copiar|seta)\b/i;

/* The icon library the file can import from, from the nearest package.json (plus a monorepo root). */
const CACHE_DE_LIB = new Map();
function libDeIcone(file) {
  const ini = path.dirname(path.resolve(file ?? '.'));
  if (CACHE_DE_LIB.has(ini)) return CACHE_DE_LIB.get(ini);
  const pacotes = [];
  for (let d = ini; ; d = path.dirname(d)) {
    const pj = path.join(d, 'package.json');
    if (fs.existsSync(pj)) {
      try {
        pacotes.push({ dir: d, json: JSON.parse(fs.readFileSync(pj, 'utf8')) });
      } catch { /* a broken package.json counts as none */ }
    }
    if (fs.existsSync(path.join(d, '.git')) || path.dirname(d) === d) break;
  }
  /*
   * The nearest package.json always counts. An ancestor only counts when it is a
   * monorepo root (`workspaces`, pnpm or lerna), where a hoisted dependency
   * lives; otherwise an unrelated package.json above the project would decide.
   */
  const raizDeMonorepo = (p) =>
    !!p.json.workspaces || ['pnpm-workspace.yaml', 'lerna.json'].some((f) => fs.existsSync(path.join(p.dir, f)));
  const valem = pacotes.filter((p, i) => i === 0 || raizDeMonorepo(p));
  let lib = null;
  for (const p of valem) {
    const deps = { ...p.json.dependencies, ...p.json.devDependencies, ...p.json.peerDependencies };
    lib = LIBS_DE_ICONE.find((l) => l in deps) ?? null;
    if (lib) break;
  }
  CACHE_DE_LIB.set(ini, lib);
  return lib;
}

/** Is this `<svg ...>...</svg>` a brand mark rather than a UI glyph? See the block above. */
function marcaDeMarca(svg) {
  const abre = svg.match(/^<svg\b[^>]*>/)?.[0] ?? '';
  const titulo = svg.match(/<title[^>]*>([^<]*)<\/title>/)?.[1]?.trim();
  const aria = abre.match(/aria-label\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*["'`]([^"'`]*)["'`]\s*\})/);
  const rotulo = titulo || (aria && (aria[1] ?? aria[2] ?? aria[3] ?? '').trim());
  if (rotulo && !PALAVRA_DE_GLIFO.test(rotulo)) return true;
  const caminhos = [...svg.matchAll(/\bd\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*["'`]([^"'`]*)["'`]\s*\})/g)];
  if (caminhos.some((c) => (c[1] ?? c[2] ?? c[3] ?? '').length > PATH_DE_LOGO)) return true;
  const COR_LITERAL = /\b(?:fill|stroke)\s*=\s*\{?\s*["'](#(?!(?:0{3}|f{3}|0{6}|f{6})\b)[0-9a-f]{3,8}|rgba?\()/i;
  return COR_LITERAL.test(svg);
}

REGRAS.push({
  id: 'hand-drawn-icon',
  descricao: 'UI glyph SVG drawn inline in a component instead of imported from an icon library',
  piso: 1,
  achar(src, file) {
    /* only the folders near the file: a repo cloned under some `icons/` path is not an icon set */
    const pastas = path.dirname(path.resolve(file ?? '.')).split(/[\\/]/).slice(-3);
    if (pastas.some((p) => /^icons?$/i.test(p)) || /(icon|logo)/i.test(path.basename(file ?? ''))) return [];
    const linhas = src.split('\n');
    const out = [];
    const GRADE = /<svg\b[^>]*viewBox\s*=\s*["']0 0 (16 16|20 20|24 24)["']/g;
    for (const m of src.matchAll(GRADE)) {
      const fim = src.indexOf('</svg>', m.index);
      const svg = src.slice(m.index, fim === -1 ? m.index + 4000 : fim + 6);
      if (marcaDeMarca(svg)) continue;
      const linha = src.slice(0, m.index).split('\n').length;
      /* checked here too, not only by the caller: the single per-file finding below must not let one written reason release every glyph */
      if (temMotivoEscrito(linhas, linha, 'hand-drawn-icon')) continue;
      out.push({ linha, grade: m[1] });
    }
    if (!out.length) return [];
    const lib = libDeIcone(file);
    if (lib) return out.map((h) => ({ linha: h.linha, amostra: `viewBox 0 0 ${h.grade}: import it from ${lib}` }));
    /* No library installed: one finding per file, the fix is adopting one. */
    return [{
      linha: out[0].linha,
      amostra: `${out.length} inline glyph SVG(s), no icon library in package.json: adopt one (lucide-react, @heroicons/react...)`,
    }];
  },
});

/*
 * R5: the same information in two sizes.
 *
 * The structural defect that produced this detector. A screen had the product
 * thesis in the header, an "opening" a little below saying the same in other
 * words, and the note of the first block saying it a third time. Each seemed
 * short and useful; together they pushed the product below the fold.
 *
 * Compares sentence pairs from the SAME file by content-word overlap. High
 * similarity floor (0.5) and a minimum of 4 words so it does not flag two short
 * labels that happen to share a noun.
 */
/**
 * Empty-state opening, PT and EN. See the reason inside R5.
 *
 * Anchored at the start of the sentence: "nada" in the middle of a sentence
 * ("não deixe nada para depois") is not an empty state.
 */
const EMPTY_STATE =
  /^\s*(nada|nenhum|nenhuma|sem\s|você\s+não|voce\s+nao|ainda\s+não|ainda\s+nao|no\s|nothing|none|empty|there\s+are\s+no)\b/i;

/**
 * FAILURE message opening, PT and EN.
 *
 * Same logic as the empty state, for another reason: "Não foi possível carregar
 * os comentários" and "Não foi possível carregar os membros" share the formula
 * ON PURPOSE: it is the house's consistent language for errors, and what tells
 * them apart is precisely the complement. Diverging the formula to escape the
 * detector would make the UI worse.
 */
const FALHA =
  /^\s*(não\s+foi\s+possível|nao\s+foi\s+possivel|erro\s+ao|falha\s+ao|não\s+consegui|nao\s+consegui|couldn'?t|could\s+not|failed\s+to|unable\s+to|something\s+went\s+wrong)\b/i;

/** Attributes that carry the accessible NAME: the same message, another audience. */
const NOME_ACESSIVEL = new Set(['title', 'aria-label', 'alt']);

REGRAS.push({
  id: 'same-info-twice',
  descricao: 'two sentences on the same screen saying the same thing',
  piso: 1,
  texto: true,
  achar(textos) {
    const frases = textos
      .map((t) => ({
        ...t,
        palavras: new Set(conteudo(t.texto)),
        vazio: EMPTY_STATE.test(t.texto),
        falha: FALHA.test(t.texto),
      }))
      /*
       * Out of the comparison: code block (an example repeated per section is a
       * doc's duty), metadata (SEO and JSON-LD do not show) and i18n key (it is
       * the text's address, not the text). See the marks in `extrairTextos`.
       */
      .filter((t) => t.palavras.size >= 4 && !t.codigo && !t.meta && !t.chave);
    const out = [];
    const jacDe = (x, y) => {
      const inter = [...x.palavras].filter((w) => y.palavras.has(w)).length;
      return inter / new Set([...x.palavras, ...y.palavras]).size;
    };
    for (let i = 0; i < frases.length; i++) {
      for (let j = i + 1; j < frases.length; j++) {
        const a = frases[i];
        const b = frases[j];
        /*
         * Two EMPTY states never show together.
         *
         * False positive confirmed on 2026-08-12 (visant-board): "Nada
         * agendado nos próximos 14 dias" against "Nada seu nos próximos 14
         * dias", and "Nenhuma hora apontada ainda" against "Nenhuma hora
         * apontada nesta semana". They are branches of the same `if/else`: one
         * sentence REPLACES the other, and the screen shows at most one.
         * Flagging them as repetition is demanding that different empty states
         * use different vocabulary, when the shared vocabulary is exactly what
         * makes them recognizable.
         */
        if (a.vazio && b.vazio) continue;
        /* Two FAILURE messages share the formula on purpose: see FALHA. */
        if (a.falha && b.falha) continue;
        /*
         * `title` + `aria-label` with the SAME text is the accessible pattern.
         *
         * False positive confirmed the same day (`PorteMeter`): the size meter
         * puts "Porte médio" in both, on purpose: whoever hovers discovers the
         * name, whoever uses a screen reader does not hear "four dots". They
         * are the same message for different AUDIENCES, not the same
         * information in two sizes. Diverging them would be the defect.
         */
        if (NOME_ACESSIVEL.has(a.attr ?? '') && NOME_ACESSIVEL.has(b.attr ?? '')) continue;
        /*
         * Two ATTRIBUTES of the same element are not two screen sentences.
         *
         * False positive confirmed on 2026-08-12 (liminal-stage, Hub.tsx:153):
         * `placeholder="buscar sala, mapa ou o que está tocando…"` next to
         * `aria-label="buscar sala, mapa ou faixa"` on the SAME <input>. They
         * are not two stacked sentences: it is a single field, said once for
         * whoever sees and once for whoever listens, which is the accessible
         * pattern. The clue is the repeated line in the finding itself
         * ("l.153 and l.153").
         *
         * Scoped by attribute (not by raw line) on purpose: two JSX sentences
         * that fit on a single line are still two sentences.
         */
        if (a.attr && b.attr && a.linha === b.linha) continue;
        /*
         * AN IDENTICAL ACCESSIBLE NAME ON SIBLING CONTROLS is symmetry, not
         * repetition.
         *
         * False positive confirmed on 2026-09-21 (liminal-stage, Inventory.tsx:81):
         *
         *   label={`mover ${label} para a tecla ${(slot ?? 2) - 1}`}
         *   label={`mover ${label} para a tecla ${(slot ?? 0) + 1}`}
         *
         * They are the "before" and "after" buttons of the same card. Once the
         * interpolation is gone, the two sentences share 100% of their words,
         * and that is how it HAS to be: two controls doing the same thing in
         * opposite directions need the same name. Demanding different vocabulary
         * here would be asking one of them to lie.
         *
         * The scope is narrow: attributes only, 100% equal only, at most three
         * lines apart. Two equal SCREEN sentences are still a finding.
         */
        if (a.attr && b.attr && jacDe(a, b) === 1 && Math.abs(a.linha - b.linha) <= 3) continue;
        const inter = [...a.palavras].filter((w) => b.palavras.has(w)).length;
        const uniao = new Set([...a.palavras, ...b.palavras]).size;
        const jac = inter / uniao;
        if (jac >= 0.5) {
          out.push({
            linha: a.linha,
            amostra: `l.${a.linha} and l.${b.linha}: ${Math.round(jac * 100)}% shared words`,
          });
        }
      }
    }
    return out;
  },
});

/* ------------------------------------------------------------------ */
/* the rules the EYE caught and the detector did not (phase 2, 2026-10-05) */
/* ------------------------------------------------------------------ */
/*
 * The six rules below came out of slop killer round 1 in visantlabs-os. All
 * were found by OPENING the screen, after the detectors went green, and all
 * have a cheap static signature. What was an eye judgment and repeated across
 * dozens of files becomes a rule; the rest stays with the eye.
 *
 * None of them is about text: they look at the code with comments blanked (line
 * positions stay, so `file:line` stays right). The `//` after `:` survives on
 * purpose: `http://www.w3.org/2000/svg` inside a data URI is exactly where the
 * dot grid lives.
 */
const semComentarioCod = semComentario; // a single pass: see why in grafo.mjs
const linhaEm = (src, idx) => src.slice(0, idx).split('\n').length;
const janelaDe = (linhas, l, antes, depois) =>
  linhas.slice(Math.max(0, l - 1 - antes), Math.min(linhas.length, l + depois)).join('\n');

/*
 * R10: synthetic cover.
 *
 * With no image, the card invents one: a gradient with the name hash turned
 * into hue (`hsl(${hue} …)`), or the brand colors turned into a
 * `linear-gradient` in place of the cover. The two real cases of round 1 were
 * on the brand grid and the cockpit hero, and both had a comment defending the
 * choice ("never falls into a default gray"). The problem is what the screen
 * says: a card with no asset becomes indistinguishable from a card WITH an
 * asset, and the person does not know what is missing. An honest empty state
 * (icon + "no cover") informs; a gradient decorates.
 *
 * Two signatures:
 *   a. hue derived from a string: `charCodeAt` in the file AND an interpolated
 *      `hsl(${…}` or `hsla(${…}`. An avatar colored by name is the same habit
 *      at a smaller size, and lands here too.
 *   b. `linear-gradient(` interpolating a data color (`colors`, `.hex`, `stops`,
 *      `primary`, `accent`, `c1`) within 15 lines of missing-image vocabulary
 *      (`img`, `image`, `cover`, `capa`, `thumb`, `fallback`, `placeholder`). A
 *      gradient that SHOWS the brand palette (color sample, guideline swatch)
 *      has no such vocabulary nearby and passes.
 */
REGRAS.push({
  id: 'synthetic-cover',
  descricao: 'invented gradient (name hash or brand colors) in place of an image that does not exist',
  piso: 1,
  achar(src) {
    const s = semComentarioCod(src);
    const linhas = s.split('\n');
    const out = [];
    const vistos = new Set();
    const push = (l, amostra) => {
      if (vistos.has(l)) return;
      vistos.add(l);
      out.push({ linha: l, amostra });
    };
    if (/\bcharCodeAt\s*\(/.test(s)) {
      for (const m of s.matchAll(/\bhsla?\(\s*\$\{/g)) push(linhaEm(s, m.index), 'hue derived from a string hash');
    }
    const COR_DE_DADO = /\$\{[^}]*\b(colors?|hex|stops|primary\w*|accent\w*|c[123])\b[^}]*\}/i;
    const IMAGEM_AUSENTE = /\b(img|image|imagem|cover|capa|thumb\w*|fallback|placeholder)\b/i;
    for (const m of s.matchAll(/linear-gradient\(/g)) {
      const l = linhaEm(s, m.index);
      /* up to the end of the template (the backtick), not the first `)`: `${colors.join(', ')}` has a parenthesis inside */
      const crase = s.indexOf('`', m.index);
      const trecho = s.slice(m.index, crase > m.index && crase - m.index < 400 ? crase : m.index + 240);
      if (!COR_DE_DADO.test(trecho)) continue;
      if (!IMAGEM_AUSENTE.test(janelaDe(linhas, l, 15, 15))) continue;
      push(l, 'data colors turned into a gradient near a missing image');
    }
    return out;
  },
});

/*
 * R11: tile image without `onError`.
 *
 * `<img className="object-cover">` (or with `aspect-*`) without `onError` is the
 * tile that, with a broken URL, becomes the browser's broken-image icon, or,
 * with `blur-up`, an eternal blur. Real case from round 1: MasonryCard on
 * /references, with 128 references pointing to `/api/local-image?path=Z:\`.
 * The house fix is `<Thumb>` (src/components/ui/Thumb.tsx), which reserves the
 * box and falls back to an honest empty state; the rule only charges whoever
 * drew the `<img>` by hand.
 *
 * Out of the rule: `Thumb` itself, a tag with a spread (`{...props}` may bring
 * the `onError`), and an `<img>` without a tile class (icon, inline logo, small
 * avatar).
 */
REGRAS.push({
  id: 'tile-img-no-onerror',
  descricao: 'tile <img> (object-cover/aspect) without onError: a broken URL becomes a broken icon',
  piso: 1,
  achar(src, file) {
    if (/(^|[\\/])Thumb\.(tsx|jsx)$/.test(file ?? '')) return [];
    const s = semComentarioCod(src);
    const linhas = s.split('\n');
    const out = [];
    for (const m of s.matchAll(/<(motion\.img|img)\b/g)) {
      /* end of the tag: first `>` outside braces */
      let prof = 0;
      let i = m.index + m[0].length;
      for (; i < s.length && i < m.index + 3000; i++) {
        const c = s[i];
        if (c === '{') prof++;
        else if (c === '}') prof--;
        else if (c === '>' && prof === 0 && s[i - 1] !== '=') break;
      }
      const tag = s.slice(m.index, i + 1);
      if (!/\bobject-cover\b|\baspect-(?:\[|square|video|\d)/.test(tag)) continue;
      if (/\bonError\b/.test(tag) || /\{\s*\.\.\./.test(tag)) continue;
      /*
       * A `src` that does not break: the user's own file still in the browser
       * (`preview`, blob, dataURL: the upload preview), blur-up LQIP, and a
       * build asset (path from `/public` or an image import). False positive
       * measured in the rule's first round: the upload widgets of the
       * mini-tools and the fixed thumbs of the landing page.
       */
      const srcExpr = (tag.match(/\bsrc\s*=\s*(\{[^}]*\}|"[^"]*"|'[^']*')/) ?? [])[1] ?? '';
      if (/preview|objectUrl|blob|dataUrl|base64|createObjectURL|lqip|blurData|placeholder/i.test(srcExpr)) continue;
      if (/^["'`{]\s*["'`]?\/(?!\/)/.test(srcExpr) || /^\{\s*`\//.test(srcExpr)) continue;
      const id = srcExpr.match(/^\{\s*([A-Za-z_$][\w$]*)\s*\}$/);
      if (id && new RegExp(`import\\s+${id[1]}\\s+from\\s+['"][^'"]+\\.(png|jpe?g|webp|svg|gif|avif)['"]`).test(s)) continue;
      const l = linhaEm(s, m.index);
      if (/<Thumb\b/.test(janelaDe(linhas, l, 5, 0))) continue;
      out.push({ linha: l, amostra: `<${m[1]}> with object-cover/aspect and no onError` });
    }
    return out;
  },
});

/*
 * R12: cascade by index.
 *
 * `delay: index * 0.05` makes the list enter as a staircase. On a WORK screen
 * (surface B) it is pure delay: the 30th item waits 1.5s to appear, on every
 * filter, on every return to the page. It is the most common agent motion tell
 * (it wants the list to "come alive"), and visant-motion already forbids it;
 * the ruler was missing.
 *
 * Catches `delay`, `transitionDelay` and `animationDelay` whose value
 * multiplies `i`, `idx`, `index` or `*Index`, in a transition object, prop or
 * style template.
 */
REGRAS.push({
  id: 'stagger-by-index',
  descricao: 'entry delay multiplied by the item index (staircase list)',
  piso: 1,
  achar(src) {
    const s = semComentarioCod(src);
    const out = [];
    const RE = /\b(delay|transitionDelay|animationDelay)\s*[:=]\s*\{?\s*`?[^,;}\n]{0,24}?\b(i|idx|index|\w+Index)\s*\*/g;
    for (const m of s.matchAll(RE)) out.push({ linha: linhaEm(s, m.index), amostra: `${m[1]} = ${m[2]} * …` });
    return out;
  },
});

/*
 * R13: hover that lifts.
 *
 * `hover:-translate-y-1`, `hover:scale-105`, `group-hover:scale-110` on the
 * image, `whileHover={{ y: -4 }}`. The card that jumps on hover is the 2021
 * landing template applied to a work screen: it moves the neighbor's layout in
 * the eye, does not exist on touch and says nothing the border would not.
 * Measured in round 1: 26 cards on AdminPage with the same `hover:-translate-y-1`.
 *
 * A hover scale BELOW 1 (`hover:scale-95`, `scale-[0.98]`) is sinking, not
 * lifting, and stays out: the house Button's press-in uses it on `active:`.
 */
REGRAS.push({
  id: 'hover-lift',
  descricao: 'card/image that rises or grows on hover (negative translate-y, scale > 1)',
  piso: 1,
  achar(src) {
    const s = semComentarioCod(src);
    const out = [];
    const escalaMaior = (v) => {
      const n = v.startsWith('[') ? Number(v.slice(1, -1)) * 100 : Number(v);
      return Number.isFinite(n) && n > 100;
    };
    /*
     * A glyph that grows inside a fixed button is not a card that rises.
     * Measured on vercel/commerce (2026-10-28): `<XMarkIcon className={clsx("h-6
     * ... hover:scale-110")}>` and the same on `ShoppingCartIcon`, both inside an
     * `h-11 w-11` box. The icon scales inside a box that does not move: no
     * layout shift, no card jumping. The class belongs to the open tag named
     * `*Icon`, `Icon*` or `svg` (no `>` closing it before the match).
     */
    const emIcone = (idx) => {
      const j = s.lastIndexOf('<', idx);
      if (j === -1 || /[^=]>/.test(s.slice(j, idx))) return false;
      return /^<(svg|Icon\w*|\w+Icon)\b/.test(s.slice(j, j + 60));
    };
    for (const m of s.matchAll(/(?<![\w-])((?:group-)?hover):(-translate-y-[\w.[\]]+|scale-(\[[\d.]+\]|\d+))/g)) {
      if (m[2].startsWith('scale-') && !escalaMaior(m[3])) continue;
      if (m[2].startsWith('scale-') && emIcone(m.index)) continue;
      out.push({ linha: linhaEm(s, m.index), amostra: `${m[1]}:${m[2]}` });
    }
    for (const m of s.matchAll(/whileHover\s*=\s*\{\{([^}]*)\}\}/g)) {
      const y = m[1].match(/\by\s*:\s*(-?[\d.]+)/);
      const sc = m[1].match(/\bscale\s*:\s*([\d.]+)/);
      if ((y && Number(y[1]) < 0) || (sc && Number(sc[1]) > 1)) {
        out.push({ linha: linhaEm(s, m.index), amostra: `whileHover {${m[1].trim().slice(0, 30)}}` });
      }
    }
    return out;
  },
});

/*
 * R14: dot grid as background.
 *
 * Dotted texture behind the content: a 1px `radial-gradient` repeated with
 * `background-size`, a `<circle>` SVG in a data URI, or the component
 * (`GridDots*`, `DotPattern`, `DotGrid`). It is the graph paper of every AI
 * template, and in round 1 it was in three places at once: `PageShell` (every
 * page), the cover fallback and the admin. Deleted from the DS
 * (GridDotsBackground died with 0 uses); the rule keeps it from coming back.
 *
 * A GLOW `radial-gradient` (large ellipse, no `background-size`) is something
 * else and passes.
 */
REGRAS.push({
  id: 'dot-grid',
  descricao: 'dot texture as background (repeated radial-gradient, circle SVG, GridDots)',
  piso: 1,
  achar(src) {
    const s = semComentarioCod(src);
    const linhas = s.split('\n');
    const out = [];
    const vistos = new Set();
    const push = (idx, amostra) => {
      const l = linhaEm(s, idx);
      if (vistos.has(l)) return;
      vistos.add(l);
      out.push({ linha: l, amostra });
    };
    for (const m of s.matchAll(/<(GridDots\w*|DotPattern\w*|DotGrid\w*|DotsBackground\w*)\b/g)) push(m.index, `<${m[1]}>`);
    for (const m of s.matchAll(/radial-gradient\(/g)) {
      const l = linhaEm(s, m.index);
      const perto = janelaDe(linhas, l, 3, 3);
      const repetido = /background-?size|backgroundSize|bg-\[(?:length|size):/i.test(perto);
      const ponto = /\b(?:circle|_?\d(?:\.\d)?px)\b[^)]{0,40}transparent|1px[,_ ]+transparent/i.test(s.slice(m.index, m.index + 160));
      if (repetido && ponto) push(m.index, 'dot radial-gradient repeated with background-size');
    }
    for (const m of s.matchAll(/data:image\/svg\+xml[^\n]{0,400}?(?:%3Ccircle|<circle)/gi)) push(m.index, 'circle SVG in a data URI as texture');
    return out;
  },
});

/*
 * R15: blur on a card.
 *
 * `backdrop-blur` only makes sense when there IS something passing underneath:
 * a dialog, popover, side sheet, fixed or sticky bar, a piece floating over the
 * canvas. On a card in the page flow, over a flat background, it blurs nothing:
 * it only costs GPU and signs "template glassmorphism". The house already
 * decided this in `GlassPanel` (default `flat`, blur only with explicit
 * `intensity`) and in the glass SSoT (blur only on panels); the rule charges
 * the rest of the repo.
 *
 * What overlaps stays out: a class with `fixed`, `sticky` or `absolute` (on the
 * element or in the 6 lines above, where the split `cn(` and the
 * `fixed inset-0` parent of the modal card live), and overlay context by NAME
 * (of the neighboring tag, of the component containing the line, or of the
 * file: Dialog, Sheet, Popover, Overlay, Modal, Dropdown, Menu, Tooltip, Toast,
 * HoverCard, Command, Palette, Drawer, Select, Lightbox, Fullscreen). The first
 * version only looked at the neighborhood and flagged `Modal.tsx` itself and
 * the DS's `SelectContent`.
 */
REGRAS.push({
  id: 'blur-on-card',
  descricao: 'backdrop-blur on an in-flow element (not a dialog/sheet/popover/fixed overlay)',
  piso: 1,
  achar(src, file) {
    const OVERLAY =
      /(Dialog|Sheet|Popover|Overlay|Modal|Dropdown|Menu|Tooltip|Toast|HoverCard|Command|Palette|Drawer|Backdrop|Select|Combobox|Popup|Lightbox|Fullscreen|toast)/;
    /* The whole file IS the overlay (Modal.tsx, select.tsx, CommandPalette.tsx). */
    const base = path.basename(file ?? '').replace(/\.\w+$/, '');
    if (OVERLAY.test(base.charAt(0).toUpperCase() + base.slice(1))) return [];
    const s = semComentarioCod(src);
    const linhas = s.split('\n');
    const out = [];
    const SOBREPOE = /(?<![\w-])(fixed|sticky|absolute)(?![\w-])/;
    /* component containing the line: `function X(` or `const X = (` above it */
    const componenteEm = (idx) => {
      let nome = null;
      for (const m of s.slice(0, idx).matchAll(/(?:function\s+|const\s+)([A-Z][\w$]*)\s*(?:[=:(<])/g)) nome = m[1];
      return nome ?? '';
    };
    const vistos = new Set();
    for (const m of s.matchAll(/(?<![\w-])backdrop-blur(?!-none)(?:-[\w[\]]+)?/g)) {
      const l = linhaEm(s, m.index);
      if (vistos.has(l)) continue;
      /*
       * 10 lines above for positioning: the action button over the card image
       * inherits the `absolute` of the group that holds it, and the
       * `fixed inset-0` parent of the modal card is usually there. 6 for the
       * overlay name.
       */
      if (SOBREPOE.test(janelaDe(linhas, l, 10, 1))) continue;
      if (OVERLAY.test(janelaDe(linhas, l, 6, 1)) || OVERLAY.test(componenteEm(m.index))) continue;
      vistos.add(l);
      out.push({ linha: l, amostra: m[0] });
    }
    return out;
  },
});

/* ------------------------------------------------------------------ */
/* design-slop signals, catalog entries 47-57 (2026-10-28)             */
/* ------------------------------------------------------------------ */
/*
 * Entries 47-57 of `references/slop-catalog.md` ("ornament that imitates
 * care") started as rg one-liners. The rules below are the ones with a static
 * signature cheap enough to run with few false positives. Two stay with the
 * eye on purpose: 50 (over-detailed UI) and 54 (diagram) do not live in any
 * single line, and a grep for them would flag every dashboard and every SVG.
 *
 * The density rules (47 tag, 51 divider, 57 mono) follow R1: one use is a
 * choice, many in the same file is the symptom, so the floor is a per-file
 * count. Every rule was run on a real app (visantlabs-os, 588 interface files,
 * 2026-10-28) and tightened where the sampled hits were legitimate; each
 * exclusion below names the case that forced it.
 *
 * Like the phase 2 rules, they read code with comments blanked (line numbers
 * are kept), and the written exception (`EXCEÇÃO ao ruido-scan/<rule>: why`)
 * releases a hit exactly as for every other rule.
 */

/**
 * Opening and closing JSX tags, in source order.
 *
 * Attribute values may hold braces three levels deep (`style={{ a: { } }}`).
 * A TS generic (`Array<string>`) also parses as a "tag"; that is harmless here
 * because every rule below asks something of the class list, which a generic
 * does not have.
 */
function tagsDe(s) {
  const out = [];
  const RE = /<(\/?)([A-Za-z][\w.]*)\b((?:[^<>{}]|\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})*?)(\/?)>/g;
  for (const m of s.matchAll(RE)) {
    out.push({ fecha: m[1] === '/', nome: m[2], attrs: m[3] ?? '', auto: m[4] === '/', idx: m.index, fim: m.index + m[0].length });
  }
  return out;
}

/** Index (in `tags`) of the tag that closes the opening tag at `i`, counting nesting. */
function fechoDe(tags, i) {
  const nome = tags[i].nome;
  let prof = 1;
  for (let k = i + 1; k < tags.length; k++) {
    const t = tags[k];
    if (t.nome !== nome || t.auto) continue;
    if (t.fecha) { if (--prof === 0) return k; } else prof++;
  }
  return tags.length;
}

/**
 * Utility present in the base state only. `hover:border` or `md:rounded` is a
 * state or a breakpoint, not the resting look of the element, so the lookbehind
 * refuses a `:` (and a `-`, so `divide-y` never reads as a bare `y`).
 */
const util = (re) => new RegExp(String.raw`(?<![\w:/-])(?:${re})(?![\w-])`);

/**
 * Visible text nodes: what follows a REAL tag end (`>` from `tagsDe`, so an
 * arrow `=>` or a comparison never opens one), up to the next tag or brace.
 * Also a lone string expression right after a tag (`>{'01'}<`).
 *
 * Only block comments are blanked here, not line comments: in JSX, `// serviços`
 * between two tags is TEXT that renders, and it is exactly what rule 55 hunts.
 * `semComentario` would erase it.
 */
function nosDeTexto(src) {
  const s = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const tags = tagsDe(s);
  const out = [];
  for (const t of tags) {
    const resto = s.slice(t.fim, t.fim + 240);
    const m = resto.match(/^\s*(?:\{\s*(["'`])([^"'`\n]{1,120})\1\s*\}|([^<>{}]{1,200}))/);
    if (!m) continue;
    const texto = (m[2] ?? m[3] ?? '').replace(/\s+/g, ' ').trim();
    if (!texto) continue;
    const idx = t.fim + resto.indexOf(texto.slice(0, 1));
    out.push({ texto, linha: linhaEm(s, idx), tag: t });
  }
  return { s, tags, out };
}

/** Inside `<pre>`, `<code>`, `<kbd>` or `<samp>`: code that is code, by markup. */
function regioesDeCodigoEm(tags) {
  const reg = [];
  tags.forEach((t, i) => {
    if (t.fecha || t.auto || !/^(pre|code|kbd|samp)$/.test(t.nome)) return;
    const j = fechoDe(tags, i);
    reg.push([t.idx, tags[j]?.idx ?? Infinity]);
  });
  return (idx) => reg.some(([a, b]) => idx >= a && idx < b);
}

/*
 * 47 - tag on everything.
 *
 * A chip on every card ("Novo", "IA", "Beta", the category), a badge above the
 * title, three tags under the description. Counted: `<Badge>`/`<Chip>`/`<Pill>`/
 * `<Tag>` and the hand-made pill (`rounded-full` + horizontal padding + small
 * text). A pill with a fixed width or height is an avatar or a dot, not a tag,
 * and a tag you click (`onClick`, `active`, `selected`, `href`) is a filter or a
 * choice, the use the catalog keeps (measured: the ruler chips of
 * NamingSettingsPopover.tsx, six selectable `<Chip>`, all legitimate).
 *
 * Floor 6 per file: a table column of status badges is legitimate and lives in
 * one or two lines of a `.map`; six separate tags in one file is the template.
 */
REGRAS.push({
  id: 'tag-everywhere',
  descricao: 'badge/chip/pill on everything: tag that neither filters nor changes a decision',
  piso: 6,
  achar(src) {
    const s = semComentarioCod(src);
    const out = [];
    const PILULA = util('rounded-full');
    const PAD = util(String.raw`px-(?:1\.5|2|2\.5|3)`);
    const MIUDO = util(String.raw`text-(?:xs|micro|\[1[01]px\]|\[0\.[67]\d*rem\])`);
    const FIXO = util(String.raw`(?:w|h|size)-(?:\d+|\[[^\]]+\])`);
    for (const t of tagsDe(s)) {
      if (t.fecha) continue;
      /* a tag you click IS a filter or a choice, the one use the catalog keeps */
      if (/\b(onClick|onSelect|onCheckedChange|onPressedChange|href|active|selected|pressed)\s*=/.test(t.attrs)) continue;
      const componente = /^(Badge|Chip|Pill|Tag)$|Badge$/.test(t.nome);
      const pilula = PILULA.test(t.attrs) && PAD.test(t.attrs) && MIUDO.test(t.attrs) && !FIXO.test(t.attrs);
      if (componente || pilula) out.push({ linha: linhaEm(s, t.idx), amostra: componente ? `<${t.nome}>` : 'pill: rounded-full + px + small text' });
    }
    return out;
  },
});

/*
 * 48 - one word in italics in the headline.
 *
 * "Design que *converte*": an `<em>`, `<i>` or `italic` child inside an h1/h2
 * or inside display-size text (`text-4xl` and up, `text-[40px]` and up,
 * `text-[clamp(...)]`). A heading that is italic as a WHOLE is a type choice
 * and passes; the tell is the single emphasized word. `<i>` with an icon class
 * (`fa-`, `icon`) is an icon font, not italics.
 *
 * No floor: one per page already is the tic.
 */
REGRAS.push({
  id: 'italic-headline-word',
  descricao: 'single word in italics (em/i/italic) inside a headline',
  piso: 1,
  achar(src) {
    const s = semComentarioCod(src);
    const tags = tagsDe(s);
    const out = [];
    const vistos = new Set();
    const DISPLAY = /(?<![\w-])(?:\w+:)?text-(?:[4-9]xl|\[(?:[4-9]\d|1\d\d)px\]|\[clamp)/;
    const ITALICO = util('italic');
    tags.forEach((t, i) => {
      if (t.fecha || t.auto) return;
      if (!/^h[12]$/.test(t.nome) && !DISPLAY.test(t.attrs)) return;
      if (ITALICO.test(t.attrs)) return;
      const j = fechoDe(tags, i);
      for (let k = i + 1; k < j && k < tags.length; k++) {
        const f = tags[k];
        if (f.fecha) continue;
        const enfase = (/^(em|i)$/.test(f.nome) && !f.auto && !/\b(fa-|icon|ri-|bi-)/.test(f.attrs)) || ITALICO.test(f.attrs);
        if (!enfase) continue;
        const l = linhaEm(s, f.idx);
        if (vistos.has(l)) continue;
        vistos.add(l);
        out.push({ linha: l, amostra: `<${f.nome}> italic inside <${t.nome}> headline` });
      }
    });
    return out;
  },
});

/*
 * 49 - Instrument Serif with negative tracking.
 *
 * The uniform of generated landing pages: a free display serif (Instrument
 * Serif first, `font-serif` in general) with `tracking-tight`, `tracking-tighter`,
 * `tracking-[-…]` or a negative `letterSpacing`, on the SAME element. Serif
 * alone passes (it may be the brand), tight tracking alone passes (the brand
 * sans may ask for it at that size); the pair is the borrowed look.
 */
REGRAS.push({
  id: 'display-serif-tight',
  descricao: 'Instrument Serif (or font-serif) with negative tracking on the same element',
  piso: 1,
  achar(src) {
    const s = semComentarioCod(src);
    const out = [];
    const SERIF = /instrument[\s_-]?serif|font-instrument|(?<![\w:-])font-serif(?![\w-])|fontFamily\s*:\s*[^,}\n]*serif/i;
    const APERTADO = /(?<![\w:-])(?:\w+:)?(?:tracking-(?:tight|tighter)(?![\w-])|-tracking-|tracking-\[-)|letterSpacing\s*:\s*['"`]?-/;
    for (const t of tagsDe(s)) {
      if (t.fecha) continue;
      if (/sans-serif/i.test(t.attrs) && !/instrument/i.test(t.attrs)) continue;
      if (SERIF.test(t.attrs) && APERTADO.test(t.attrs)) out.push({ linha: linhaEm(s, t.idx), amostra: 'display serif + negative tracking' });
    }
    return out;
  },
});

/*
 * 51 - a divider between everything.
 *
 * `<hr>`, `<Separator>`, `divide-y`, `border-t`/`border-b` splitting blocks that
 * spacing already split. Lines in a table or a dense list are the legitimate
 * use, so table parts and `<li>` do not count, and neither does a sticky or
 * fixed bar (the edge of a header over scrolling content is a real limit).
 * A vertical separator and any divider in a toolbar, sidebar or menu file are
 * out too: there the line splits groups of controls in a dense strip, which is
 * the "dense list" case (measured: CreativeToolbar.tsx, 12 `<Divider>` between
 * tool groups, all legitimate).
 *
 * Floor 8 per file: a few section lines in a long page are normal; eight is a
 * page that groups by line instead of by space. On visantlabs-os (2026-10-28)
 * it left 7 files, led by DocsPage.tsx (55) and BrandReadOnlyView.tsx (17).
 */
REGRAS.push({
  id: 'divider-everywhere',
  descricao: 'hr/Separator/divide/border-t used as the grouping device all over the file',
  piso: 8,
  achar(src, file) {
    if (/(Toolbar|Sidebar|Menu|Table|List)\w*\.(tsx|jsx)$/.test(path.basename(file ?? ''))) return [];
    const s = semComentarioCod(src);
    const out = [];
    const LINHA = util(String.raw`divide-[xy]|border-[tb]`);
    for (const t of tagsDe(s)) {
      if (t.fecha) continue;
      if (/^(tr|td|th|thead|tbody|tfoot|table|li|Table\w*)$/.test(t.nome)) continue;
      if (util('sticky|fixed').test(t.attrs) || /orientation\s*=\s*["'{]*vertical/.test(t.attrs)) continue;
      const tag = /^(hr|Separator|Divider)$/.test(t.nome);
      if (tag || LINHA.test(t.attrs)) out.push({ linha: linhaEm(s, t.idx), amostra: tag ? `<${t.nome}>` : (t.attrs.match(LINHA) ?? [''])[0] });
    }
    return out;
  },
});

/*
 * 52 - opacity ladder.
 *
 * `text-white/90`, `/70`, `/50`, `/40` in one file: hierarchy made of
 * transparency, which is a raw color under another name. The rule groups by
 * utility + color (`text-white`, `bg-primary`) and fires when one pair has FOUR
 * or more distinct steps in the base state. `hover:bg-primary/20` is a state,
 * not a level, and does not count. `text-sm/6` is font size with line height
 * (Tailwind shorthand), not opacity, and does not count either.
 *
 * One hit per ladder, at its first step.
 */
REGRAS.push({
  id: 'opacity-ladder',
  descricao: 'same color utility in 4+ opacity steps in one file (hierarchy by transparency)',
  piso: 1,
  achar(src) {
    const s = semComentarioCod(src);
    const escadas = new Map();
    const RE = /(?<![\w:/-])(text|bg|border)-([a-z]+(?:-[a-z]+)*(?:-\d{2,3})?)\/(\d{1,3}|\[[\d.]+%?\])(?![\w-])/g;
    for (const m of s.matchAll(RE)) {
      if (/^(xs|sm|base|lg|\d?xl)$/.test(m[2])) continue;
      const k = `${m[1]}-${m[2]}`;
      if (!escadas.has(k)) escadas.set(k, new Map());
      const passos = escadas.get(k);
      if (!passos.has(m[3])) passos.set(m[3], m.index);
    }
    const out = [];
    for (const [k, passos] of escadas) {
      if (passos.size < 4) continue;
      const idx = Math.min(...passos.values());
      out.push({ linha: linhaEm(s, idx), amostra: `${k}: /${[...passos.keys()].join(' /')}` });
    }
    return out;
  },
});

/*
 * 53 - a bordered box around everything, box inside box.
 *
 * A `border rounded-*` container opened inside another `border rounded-*`
 * container, in the same JSX tree. Borders where a real limit exists stay out:
 * the inner element being a field, a button, a link, an image, code or a table
 * (catalog: "input, table, clickable area"), anything with `onClick`/`href`, an
 * inline `span`/`Badge`/`Chip` (a tag, rule 47's business), a tab or toggle
 * group (a control), and an element with fixed width and height (swatch, icon
 * tile, thumbnail). `rounded-full` is a pill or an avatar, not a box.
 *
 * Floor 2 per file: one nested card can be a deliberate inset (a preview inside
 * a settings card); two is the habit.
 */
REGRAS.push({
  id: 'box-in-box',
  descricao: 'bordered rounded container nested inside another bordered rounded container',
  piso: 2,
  achar(src) {
    const s = semComentarioCod(src);
    const tags = tagsDe(s);
    const out = [];
    const BORDA = util(String.raw`border(?:-[1-4])?`);
    const CANTO = util(String.raw`rounded(?:-(?!full\b|none\b)[\w[\].]+)?`);
    const caixa = (a) => BORDA.test(a) && CANTO.test(a);
    const LIMITE_REAL = /^(input|textarea|select|button|a|Link|NavLink|img|Image|Input|Textarea|Button|Select\w*|kbd|code|pre|video|iframe|canvas|label|summary|table|svg|Thumb|span|Badge|Chip|Tabs\w*|Toggle\w*)$/;
    /* fixed width AND height: a swatch, an icon tile or a thumbnail, not a content box */
    const LARG = util(String.raw`(?:w|size)-(?:\d+|\[[^\]]+\])`);
    const ALT = util(String.raw`(?:h|size)-(?:\d+|\[[^\]]+\])`);
    const MEDIDA = (a) => LARG.test(a) && ALT.test(a);
    /*
     * The parent is the box whose CLOSING tag (same-name nesting, `fechoDe`)
     * comes after the child, not whatever is left on a stack. The first version
     * used a stack, and one misparsed tag left a modal "open" for 400 lines:
     * a sibling modal in another branch read as a box inside it (measured on
     * PixPaymentModal.tsx in the real app).
     */
    const regioes = [];
    tags.forEach((t, i) => {
      if (t.fecha || t.auto || !caixa(t.attrs) || LIMITE_REAL.test(t.nome)) return;
      regioes.push({ ini: t.idx, fim: tags[fechoDe(tags, i)]?.idx ?? -1, t });
    });
    /*
     * A `fixed` or `absolute` layer starts a new stack of boxes: the dialog
     * opened from inside a card is drawn over the page, not inside the card
     * (measured: the QR code modal declared inside the PIX modal,
     * PixPaymentModal.tsx), and a status chip floating over an image is an
     * overlay, not a box in a box (FullScreenViewer.tsx).
     */
    const camadas = [];
    const CAMADA = util('fixed|absolute');
    tags.forEach((t, i) => {
      if (!t.fecha && !t.auto && CAMADA.test(t.attrs)) camadas.push([t.idx, tags[fechoDe(tags, i)]?.idx ?? -1]);
    });
    const camadaEntre = (pai, idx) => camadas.some(([a, b]) => a > pai.ini && a <= idx && idx < b);
    for (const r of regioes) {
      const t = r.t;
      if (/\b(onClick|href)\s*=/.test(t.attrs) || MEDIDA(t.attrs)) continue;
      const pai = regioes.filter((p) => p !== r && p.ini < t.idx && t.idx < p.fim && !camadaEntre(p, t.idx)).pop();
      if (!pai) continue;
      out.push({ linha: linhaEm(s, t.idx), amostra: `<${t.nome}> box inside <${pai.t.nome}> box (l.${linhaEm(s, pai.ini)})` });
    }
    return out;
  },
});

/*
 * 55 - code breadcrumb as ornament.
 *
 * `~/projects/app`, `$ npm install`, `// serviços`, `src/app/page.tsx`,
 * `<Hero />` written as VISIBLE text on a page that is not for developers. Read
 * from the text nodes (see `nosDeTexto`), so a real comment never fires.
 *
 * Out: text inside `<pre>`/`<code>`/`<kbd>`/`<samp>` (code marked as code), the
 * caption of a code block (a `<pre>` or `<code>` opening in the next 4 lines,
 * like "plugin/src/code.ts usage" over the snippet on DocsPage.tsx), and a
 * command with a copy button within 10 lines (a real command someone copies,
 * the one case the catalog keeps).
 */
REGRAS.push({
  id: 'code-crumb',
  descricao: 'shell prompt, path or code comment as decorative visible text',
  piso: 1,
  achar(src) {
    const { s, tags, out: nos } = nosDeTexto(src);
    const linhas = s.split('\n');
    const emCodigo = regioesDeCodigoEm(tags);
    const MIGALHA = /^(?:~\/[\w.-]|\$ [a-z]|\/\/ ?\p{L}|&lt;[A-Z]\w*\s*\/&gt;|<[A-Z]\w*\s*\/>$)|\bsrc\/[\w/-]+\.(?:tsx?|jsx?|css)\b/u;
    const out = [];
    for (const n of nos) {
      if (!MIGALHA.test(n.texto)) continue;
      if (emCodigo(n.tag.idx + 1)) continue;
      if (/<(pre|code)\b/.test(janelaDe(linhas, n.linha, 0, 4))) continue;
      if (/clipboard|copyTo|onCopy|CopyButton/i.test(janelaDe(linhas, n.linha, 10, 10))) continue;
      out.push({ linha: n.linha, amostra: n.texto.slice(0, 40) });
    }
    return out;
  },
});

/*
 * 56 - numbered section.
 *
 * "01 — Serviços", "/02", "§3" written above each section. A visible text node
 * that is only the number (`01`, `/02`, `§ 3`) or the number joined to a label
 * (`01 · Serviços`). Clock and date text (`01:30`, `01/12`) does not match: a
 * digit after the separator is not a label.
 *
 * Floor 2 per file: the tell is the numbering of EVERY section, and a single
 * `01` is often a real step. Numbers generated in a `.map`
 * (`String(i + 1).padStart(2, '0')`) are left to the eye: there the list is
 * usually a process, where the catalog says the number belongs.
 */
REGRAS.push({
  id: 'numbered-section',
  descricao: 'section label numbered like 01 / /02 / §3 when order means nothing',
  piso: 2,
  achar(src) {
    const { out: nos } = nosDeTexto(src);
    const NUMERO = /^(?:\/\s?0[1-9]|0[1-9]|§\s?\d{1,2})(?:\s*[—–·.\/|:-]\s*\p{L}[^\n]{0,60})?$/u;
    return nos.filter((n) => NUMERO.test(n.texto)).map((n) => ({ linha: n.linha, amostra: n.texto.slice(0, 40) }));
  },
});

/*
 * 57 - mono on everything.
 *
 * `font-mono` on eyebrow, label, button, nav, date, counter, card caption: the
 * code font becomes the page's second font. Counted per file, leaving out what
 * is code by markup (`pre`, `code`, `kbd`, `samp`) or by content: the element's
 * first child is an expression naming an id, hash, key, token, serial, command,
 * path, url, slug or hex, the cases the catalog keeps.
 *
 * Floor 10 per file: a handful of mono values (a price column, a timestamp) is
 * a choice; ten is a second font. On visantlabs-os (2026-10-28) it left 7
 * files, and the sampled hits were what the catalog describes: an `<h1>`,
 * error copy, buttons and table headers in mono (AdminPage.tsx alone: 210).
 */
REGRAS.push({
  id: 'mono-everywhere',
  descricao: 'font-mono as a second UI font (labels, buttons, counters), not on code',
  piso: 10,
  achar(src) {
    const s = semComentarioCod(src);
    const out = [];
    const MONO = util(String.raw`font-mono|font-\[[^\]]*mono[^\]]*\]`);
    const CODIGO = /^\s*\{[^}]{0,60}\b(\w*(?:id|Id|ID|hash|Hash|sha|uuid|key|Key|token|Token|serial|Serial|cmd|command|Command|path|Path|url|Url|URL|slug|Slug|hex|Hex|json|Json|JSON|code|Code))\b/;
    for (const t of tagsDe(s)) {
      if (t.fecha || /^(pre|code|kbd|samp)$/.test(t.nome)) continue;
      if (!MONO.test(t.attrs)) continue;
      if (CODIGO.test(s.slice(t.fim, t.fim + 80))) continue;
      out.push({ linha: linhaEm(s, t.idx), amostra: `<${t.nome}> font-mono` });
    }
    return out;
  },
});

/* ------------------------------------------------------------------ */
/* execution                                                           */
/* ------------------------------------------------------------------ */

/**
 * An exception with a written reason, and only that way.
 *
 * A gate that goes red on the legitimate case is a gate the team learns to
 * ignore, and then it stops counting for the illegitimate case too. But the way
 * out CANNOT be a silent `ignore` by value: that hides the next case, which is
 * the rule written in this skill's SKILL.md.
 *
 * The middle ground this house already uses: the exception lives, as long as
 * the reason is written on the line. Here that becomes an executable contract:
 * a comment within the eight lines above the finding, citing the rule by name,
 * releases that finding. Whoever wants to silence the detector has to write
 * why, and the next person reads the why where the doubt shows up.
 *
 * Eight lines because a block comment explaining the decision usually has four
 * or five, and it sits ABOVE the JSX that produced the finding.
 */
const JANELA_DA_EXCECAO = 8;

/*
 * R8: the highlight that decides nothing.
 *
 * `on: true` written by hand inside a card factory. It is not a syntax error,
 * not a wrong token, not text chrome: it is HIGHLIGHT AT REST. The case that
 * produced the rule (jukebox, 2026-09-11): every record in the queue came with
 * `on: true`, and `.tcard.on` lights up border, shadow and name. With three
 * records in the box and all three in the queue, the whole grid lit up in cyan,
 * and "on air" became indistinguishable from "3rd in queue". A highlight that
 * highlights everything highlights nothing, and the grid's only highlight had
 * been spent on a fact a badge already told.
 *
 * Why it gets past everything: `on: true` is a correct line. The defect only
 * exists when it runs once PER ITEM, and that is exactly what the lookback
 * window looks for, not the loose line.
 *
 * Precision over volume: the property must have a highlight name, the value
 * must be the literal `true`, and within the 8 lines above there must be a
 * FACTORY signal (`.map(`, `=> ({`, `return {`, `card={`). Without that, the
 * rule would flag every config `{ enabled: true }` in the repo.
 *
 * A legitimate and common exception: the piece that is the only one on screen
 * and lit on purpose (the current plan in a pricing table, the tab mounted
 * open). Then the reason gets written, like every exception in this skill.
 */
REGRAS.push({
  id: 'highlight-at-rest',
  descricao: 'highlight (`on`/`active`/`selected`) hard-set to `true` inside an item factory',
  piso: 1,
  achar(src) {
    const out = [];
    const linhas = src.split('\n');
    const FABRICA = /\.map\(|\.flatMap\(|=>\s*\(?\{|return\s*\{|card=\{|item=\{|render\w*=\{/;
    /*
     * A CALL ARGUMENT IS NOT AN ITEM DESCRIPTOR: this rule's false positive,
     * confirmed in the first round on a real repo (Director.tsx:823):
     *
     *   add: f.screen?.on ? undefined : () => { setScreen({ on: true }) }
     *
     * `on` there is the switch of a video screen, and `{ on: true }` is a
     * setter argument. The factory window matched because a callback `=> {` is
     * indistinguishable from a factory `=> ({` when looking at eight lines.
     *
     * The discriminator is the character: if the `{` holding the property
     * opens right after `name(`, it is a call argument. `=> ({` passes (before
     * the parenthesis comes `>`, not an identifier) and `return {` never lands
     * here.
     */
    /*
     * IT CLIMBS THROUGH EVERY LEVEL, not just one. The first version looked at
     * the brace right above and stopped, so an object NESTED inside the
     * argument escaped the test and became a finding:
     *
     *   struct({ game: id ? { on: true, tempo: 80 } : null })
     *
     * The brace containing `on: true` is preceded by `? `, not by `name(`, and
     * the rule flagged a room config setter as a card factory (confirmed in
     * liminal-stage/Director.tsx:403). An object inside an argument is still an
     * argument, at any depth.
     */
    const argumentoDeChamada = (idx) => {
      let i = idx;
      for (let nivel = 0; nivel < 8; nivel++) {
        let prof = 0;
        for (; i >= 0; i--) {
          const c = src[i];
          if (c === '}') prof++;
          else if (c === '{') { if (prof === 0) break; prof--; }
        }
        if (i < 0) return false;
        let j = i - 1;
        while (j >= 0 && /\s/.test(src[j])) j--;
        if (src[j] === '(') {
          j--;
          while (j >= 0 && /\s/.test(src[j])) j--;
          return /[A-Za-z0-9_$\]]/.test(src[j] ?? '');
        }
        /* `=> ({` and `return {` stop here: they are a real factory. `?`, `:`, `,`
           and `[` mean we are still inside an expression: climb further. */
        if (src[j] === '>' || /[A-Za-z0-9_$]/.test(src[j] ?? '')) return false;
        i--;
      }
      return false;
    };
    const PROP = /(?<![.\w])(on|ativo|active|selected|selecionado|current|atual|highlight|destaque|realce|isActive|isSelected|isCurrent)\s*(?::\s*true\b|=\{true\})/g;
    for (const m of src.matchAll(PROP)) {
      const linha = src.slice(0, m.index).split('\n').length;
      const janela = linhas.slice(Math.max(0, linha - 9), linha - 1).join('\n');
      if (!FABRICA.test(janela)) continue;
      if (argumentoDeChamada(m.index)) continue;
      out.push({ linha, amostra: m[0].replace(/\s+/g, ' ') });
    }
    return out;
  },
});

/**
 * A WHOLE-FILE exception, for a surface with its own visual language.
 *
 * It exists because the eight-line window does not cover the real case: a
 * console/HUD area uses caps + tracking + mono in DOZENS of places, on purpose:
 * `font-mono uppercase tracking-[0.2em]` with labels like `ID_003` is identity,
 * not the generic dashboard R1 hunts. Measured on 2026-08-12: 40
 * `shouting-label` findings in visant-board, all inside `app/admin/agent/**`,
 * and none of them carelessness.
 *
 * The reason is still REQUIRED and on the same line as the marker: the
 * difference is the scope, not the license. Format (the English
 * `noise-ignore-file:` is accepted as an alias):
 *
 *   // ruido-ignore-file: shouting-label, agent HUD: mono + caps is
 *   // this area's identity, not a dashboard label.
 */
/*
 * LEGACY rule ids. Until 2026-10-28 the rules had Portuguese ids; they were
 * renamed to English so a third-party repo can read its own findings. Written
 * exceptions and whole-file ignores already in the wild still name the old id,
 * and a rename must not turn every one of them back into a finding: both
 * markers accept the old id as an alias of the new one. Findings always carry
 * the new id.
 */
export const LEGADO = {
  'rotulo-gritado': 'shouting-label',
  'ensina-a-usar': 'usage-instruction',
  'legenda-do-que-vem': 'caption-of-what-follows',
  'verbo-por-item': 'verb-per-item',
  'seta-glifo': 'arrow-glyph',
  'icone-desenhado-a-mao': 'hand-drawn-icon',
  'mesma-info-dois-tamanhos': 'same-info-twice',
  'capa-sintetica': 'synthetic-cover',
  'img-de-tile-sem-onerror': 'tile-img-no-onerror',
  'cascata-por-indice': 'stagger-by-index',
  'hover-que-levanta': 'hover-lift',
  'grade-de-pontos': 'dot-grid',
  'blur-em-card': 'blur-on-card',
  'realce-que-nao-decide': 'highlight-at-rest',
  'porta-repetida': 'repeated-door',
};
/** The rule id plus its legacy aliases. */
const nomesDaRegra = (regraId) => [regraId, ...Object.keys(LEGADO).filter((k) => LEGADO[k] === regraId)];

function arquivoTemExcecao(src, regraId) {
  const m = src.match(/(?:ruido|noise)-ignore-file:(.+)/);
  if (!m) return false;
  const linha = m[1];
  // It must cite the rule (new or legacy id) AND have text after it: a silent marker releases nothing.
  return nomesDaRegra(regraId).some((nome) => {
    const i = linha.search(new RegExp(String.raw`(?<![\w-])${escapaRe(nome)}(?![\w-])`));
    return i !== -1 && linha.slice(i + nome.length).trim().length > 3;
  });
}

/*
 * The SAME contract as the other four gates (scan-ui-scale, scan-ui-slop,
 * scan-lightmode-breakage, scan-design-violations): on the finding's line or
 * the eight above, `EXCEÇÃO ao ruido-scan/<rule>: <reason>` (or the English
 * `EXCEPTION to ruido-scan/<rule>: <reason>`), and the reason needs 8+ letters,
 * with a 3+ letter word starting on the marker line itself (it may continue on
 * the next one). It used to be enough to have "EXCEÇÃO" and the rule name
 * anywhere in the window, so a silent `// EXCEÇÃO ao ruido-scan/blur-on-card`
 * released the finding and the contract this file enforces (whoever silences
 * the detector writes why) was not executed. The rule name is exact: `blur`
 * does not release `blur-on-card`. An exception below the finding does not
 * count.
 */
const escapaRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const contaLetras = (s) => (s.match(/\p{L}/gu) ?? []).length;
const RE_EXCECAO = new Map();
function reExcecao(regraId) {
  if (!RE_EXCECAO.has(regraId)) {
    RE_EXCECAO.set(
      regraId,
      new RegExp(
        String.raw`(?:EXCE(?:Ç|C)(?:Ã|A)O|EXCEPTION)\s+(?:ao|to)\s+` +
          String.raw`\x60?(?:(?:noise|ruido)-scan/)?(?:${nomesDaRegra(regraId).map(escapaRe).join('|')})(?![\w-])\x60?\s*:\s*(.*)`,
        'i',
      ),
    );
  }
  return RE_EXCECAO.get(regraId);
}

function temMotivoEscrito(linhas, linhaDoAchado, regraId) {
  const re = reExcecao(regraId);
  const i = linhaDoAchado - 1;
  for (let k = Math.min(i, linhas.length - 1); k >= Math.max(0, i - JANELA_DA_EXCECAO); k--) {
    const m = (linhas[k] ?? '').match(re);
    if (!m) continue;
    // The reason may wrap to the next comment line; count both.
    const seguinte = k + 1 <= i ? (linhas[k + 1] ?? '').replace(/^\s*(?:\/\/|\*|\/\*|\{\/\*)/, '') : '';
    const cabeca = m[1].replace(/\*\/\}?\s*$/, '');
    if (contaLetras(`${cabeca} ${seguinte}`) >= 8 && /\p{L}{3,}/u.test(cabeca)) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* the rule that only exists BETWEEN files                             */
/* ------------------------------------------------------------------ */

/*
 * R9: two doors for the same gesture.
 *
 * This is the first rule of this skill that does NOT fit in one file, and that
 * is why the defect that produced it got past everything.
 *
 * The case (jukebox, 2026-09-11): the "your box" tab had a url field that
 * writes to the ROOM's set, and the footer right below (which comes from
 * ANOTHER file, through a component call) has a url field that writes to the
 * PERSONAL box. Same shape, the same two icons beside it, 40px between one and
 * the other. And the label of one (`<Group cap="link ou arquivo">`, in
 * JukeboxPanel.tsx) was LITERALLY the placeholder of the other
 * (`'link ou arquivo'`, in MyPlaylist.tsx). Different stores, different
 * permissions, and nothing on screen said so: the person read the same form
 * twice and chose by luck.
 *
 * No per-file detector sees this, and no component sweep would see it without
 * resolving the render tree. What IS static and cheap: the SAME screen string
 * naming a data entry door in two different files. When a form is genuinely
 * reused, the text comes through a prop: it is not written twice.
 *
 * Precision: it requires two content words (never flags "salvar", "nome",
 * "buscar"), different files, and at least one side being a `placeholder`, the
 * attribute that only exists where you TYPE. A repeated label with no field is
 * another matter, and belongs to R5, inside the file.
 *
 * A finding here is not "delete one". The two doors may both be needed: the fix
 * that day was MOVING ONE ELSEWHERE (the room field became an action of the
 * queue tab), because the defect is the two of them occupying the same screen
 * without saying which is which.
 *
 * And it has TWO FORMS, both useful, and only whoever opens the file knows
 * which one it is:
 *
 *   1. **Two doors on the same screen**: the jukebox case. A layout defect: the
 *      person chooses by luck. Fix: separate or merge.
 *   2. **The same name for different things**: found in this rule's first
 *      round: `Director.tsx:1647` calls the door for the room's ambience
 *      TEXTURES "link ou arquivo", and `MyPlaylist.tsx:869` calls the door for
 *      your MUSIC box "link ou arquivo". Different screens, so it is not defect
 *      1: it is vocabulary. Two things with one name teach the person that the
 *      name means nothing.
 *
 * The rule does not try to guess which of the two it is. It points at both ends
 * and demands that someone open both, which is the only way to know.
 */
const REGRAS_GLOBAIS = [];

/*
 * FORM 2 WAS DROPPED ON 2026-10-05, and the rule started requiring the SAME
 * SCREEN.
 *
 * Slop killer round 1 (visantlabs-os) gave 25 findings for this rule, and the
 * verdict on each, file open, was almost always "no": four
 * `t('common.search')` searches on four screens over different data; the budget
 * form that returns the Visant form in an early `return` (the two doors never
 * coexist); two steps of a wizard in a ternary; the canvas and the Mockup
 * Machine, which are not even the same route. A rule that is wrong 9 times in
 * 10 teaches the team to skip the whole section, and then the jukebox case,
 * which is real, gets through.
 *
 * What remained:
 *
 *   - **Same screen**, approximated by the import graph: the two ends share a
 *     static ancestor at most two levels up (one renders the other, or both are
 *     children of the same parent). A lazy import does not count (a route split
 *     by `import()` is a separate screen), and a router or barrel does not
 *     serve as a common parent (it would join the whole app).
 *   - **Not exclusive**: if the common parent renders one side in an early
 *     `return`, or both on opposite sides of a ternary, the doors never show
 *     together.
 *   - **A real field label**: the placeholder must be a label, not a code
 *     example (a bulk-import `[{"name": …}]` is not a field).
 *   - **Common vocabulary keys stay out** (`common.*`, `shared.*`): reusing the
 *     word "Buscar" is the design system working.
 *
 * The "same name for different things on different screens" case is a
 * vocabulary problem, not a layout one; it stays a judgment question
 * (references/slop-catalog.md), not a detector one.
 */
const VOCABULARIO_COMUM = /^(common|shared|ui|actions|general|global|comum)\./;
const rotuloDeCampo = (t) => !/[{}[\]\n=<>]|":|\\n/.test(t) && conteudo(t).length <= 8;

/** Does the common parent render one side in an early `return`, or both in a ternary? */
function exclusivos(g, pai, cA, cB) {
  const src = g.fonte.get(pai) ?? '';
  const nA = cA === pai ? [] : nomesEm(g, pai, cA);
  const nB = cB === pai ? [] : nomesEm(g, pai, cB);
  const esc = (s) => s.replace(/[$]/g, '\\$');
  for (const n of [...nA, ...nB]) {
    const cedo = new RegExp(`if\\s*\\([^\\n]*\\)\\s*\\{?\\s*return\\s*\\(?\\s*<${esc(n)}\\b`);
    if (cedo.test(src)) return true;
  }
  for (const a of nA) {
    for (const b of nB) {
      const ternario = (x, y) =>
        new RegExp(`\\?\\s*\\(?\\s*<${esc(x)}\\b[\\s\\S]{0,1500}?:\\s*\\(?\\s*<${esc(y)}\\b`).test(src);
      if (ternario(a, b) || ternario(b, a)) return true;
    }
  }
  return false;
}

/** Do the two ends show together? See the block above the rule. */
export function mesmaTela(g, a, b) {
  const A = normP(a);
  const B = normP(b);
  const ancA = ancestrais(g, A, 2);
  const ancB = ancestrais(g, B, 2);
  for (const pai of ancA.keys()) {
    if (!ancB.has(pai)) continue;
    const cA = ancA.get(pai);
    const cB = ancB.get(pai);
    /* Same child on both sides: the LOWEST common ancestor is below this one. */
    if (pai !== A && pai !== B && cA === cB) continue;
    if (!exclusivos(g, pai, cA, cB)) return true;
  }
  return false;
}

REGRAS_GLOBAIS.push({
  id: 'repeated-door',
  descricao: 'the same data door named in two components that show on the same screen',
  achar(porArquivo) {
    const chaves = new Map();
    for (const [file, textos] of porArquivo) {
      for (const t of textos) {
        if (t.meta || t.codigo) continue;
        if (t.chave && VOCABULARIO_COMUM.test(t.texto)) continue;
        if (t.attr === 'placeholder' && !rotuloDeCampo(t.texto)) continue;
        const palavras = conteudo(t.texto);
        if (palavras.length < 2) continue;
        const k = palavras.join(' ');
        if (!chaves.has(k)) chaves.set(k, []);
        chaves.get(k).push({ file, linha: t.linha, attr: t.attr ?? 'text' });
      }
    }
    const candidatas = [...chaves].filter(
      ([, oc]) => new Set(oc.map((o) => o.file)).size >= 2 && oc.some((o) => o.attr === 'placeholder'),
    );
    if (!candidatas.length) return [];
    const g = montarGrafo([...porArquivo.keys()]);
    const out = [];
    for (const [k, ocorrencias] of candidatas) {
      /* pair by pair: only counts a pair in different files, with a placeholder, on the same screen */
      const parceiros = new Map();
      for (let i = 0; i < ocorrencias.length; i++) {
        for (let j = i + 1; j < ocorrencias.length; j++) {
          const x = ocorrencias[i];
          const y = ocorrencias[j];
          if (x.file === y.file) continue; // the same file belongs to R5
          if (x.attr !== 'placeholder' && y.attr !== 'placeholder') continue;
          if (!mesmaTela(g, x.file, y.file)) continue;
          if (!parceiros.has(x)) parceiros.set(x, []);
          if (!parceiros.has(y)) parceiros.set(y, []);
          parceiros.get(x).push(y);
          parceiros.get(y).push(x);
        }
      }
      /* Points at EVERY end: a finding that cites only one sends you to fix the
         wrong side, and the wrong side is usually the one the person opened first. */
      for (const [o, outras] of parceiros) {
        const onde = outras.map((x) => `${path.basename(x.file)}:${x.linha}`).join(', ');
        out.push({ file: o.file, linha: o.linha, amostra: `"${k}" as ${o.attr} · on the same screen as ${onde}` });
      }
    }
    return out;
  },
});

export function scanRuido(files) {
  const achados = [];
  /** screen text per file: it is what the global rules read (see R9) */
  const porArquivo = new Map();
  const fonte = new Map();
  for (const file of files) {
    let src;
    try {
      src = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const linhas = src.split('\n');
    const textos = extrairTextos(src);
    porArquivo.set(file, textos);
    fonte.set(file, src);
    for (const regra of REGRAS) {
      if (arquivoTemExcecao(src, regra.id)) continue;
      const hits = (regra.texto ? regra.achar(textos, file) : regra.achar(src, file)).filter(
        (h) => !temMotivoEscrito(linhas, h.linha, regra.id),
      );
      if (hits.length < regra.piso) continue;
      for (const h of hits) {
        achados.push({ file, regra: regra.id, linha: h.linha, amostra: h.amostra });
      }
    }
  }
  /*
   * The global rules run AFTER, with the whole map in hand. The written
   * exception still counts, checked at each end of the finding in that end's
   * file: the reason may be written on one side only ("this is the room field,
   * the other is the box one"), and that already settles the doubt the rule
   * raises.
   */
  for (const regra of REGRAS_GLOBAIS) {
    for (const h of regra.achar(porArquivo)) {
      const src = fonte.get(h.file);
      if (src && arquivoTemExcecao(src, regra.id)) continue;
      if (src && temMotivoEscrito(src.split(String.fromCharCode(10)), h.linha, regra.id)) continue;
      achados.push({ file: h.file, regra: regra.id, linha: h.linha, amostra: h.amostra });
    }
  }
  return achados;
}

/*
 * Was it run from the command line, or imported by killer-scan?
 *
 * The obvious comparison (`import.meta.url` against the resolved `argv[1]`)
 * lies on Windows: the `pathname` of a file URL comes as `/Z:/...`, with a
 * leading slash and swapped slashes, and the equality never matches. The script
 * then ran, printed nothing and exited 0: a detector that says "all good"
 * because it never got to look, which is the worst possible failure mode for a
 * gate.
 *
 * Comparing the file name is enough: whoever imports this does so by name.
 */
const executadoDireto = ['noise-scan.mjs', 'ruido-scan.mjs'].includes(path.basename(process.argv[1] ?? ''));

/**
 * `--self-test`: the detector audited by the very standard it enforces.
 *
 * The three false positives of this round were fixed by fixing the rule, and
 * the house rule says to lock the case in a fixture, otherwise the next person
 * who touches the regex reopens the hole without knowing it existed. The
 * fixture declares, per block, how many findings are expected.
 */
/* Fixtures whose markers name OLD ids, and what their findings are once those ids are blanked. */
const LEGADO_FIXTURES = ['noise-legacy.tsx', 'noise-legacy-b.tsx'];
const LEGADO_CONTROLE = { 'dot-grid': 1, 'blur-on-card': 1, 'arrow-glyph': 1, 'shouting-label': 3, 'hover-lift': 1 };

function selfTest() {
  const dir = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'fixtures');
  /*
   * TWO files, because R9 (`repeated-door`) only exists BETWEEN files:
   * running the self-test against a single one would make the rule return zero
   * forever, and zero in a self-test reads as approval. The second is minimal
   * on purpose: everything in it counts for the other rules too.
   */
  /*
   * `noise-phase2.tsx` locks the six rules of 2026-10-05 and the `same-info-twice`
   * false positives in code blocks and metadata. `door/` locks R9's SAME
   * SCREEN requirement: each file there is one end, and the import graph
   * between them is the case (early return, ternary, dead import, unrelated
   * screens, common vocabulary, JSON example, and the sibling pair that counts).
   */
  const porta = path.join(dir, 'door');
  const fixtures = [
    /* `signals-dirty.tsx` fires every rule for catalog signals 47-57; `signals-clean.tsx` is its legitimate twin and must stay silent. */
    ...['noise-cases.tsx', 'noise-door-b.tsx', 'noise-phase2.tsx', 'signals-dirty.tsx', 'signals-clean.tsx'].map((f) => path.join(dir, f)),
    ...(fs.existsSync(porta) ? fs.readdirSync(porta).filter((f) => f.endsWith('.tsx')).map((f) => path.join(porta, f)) : []),
    /* `glyphs/` locks hand-drawn-icon against a package.json with (with-lib) and without (no-lib) an icon library. */
    ...walk(path.join(dir, 'glyphs')),
    /* old Portuguese ids in written exceptions and whole-file ignores: see LEGADO */
    ...LEGADO_FIXTURES.map((f) => path.join(dir, f)),
  ];
  for (const f of fixtures) {
    if (fs.existsSync(f)) continue;
    console.error(`self-test: fixture not found at ${f}`);
    process.exit(2);
  }
  const achados = scanRuido(fixtures);
  const porRegra = achados.reduce((a, x) => ((a[x.regra] = (a[x.regra] ?? 0) + 1), a), {});

  /* What the fixture promises. See the "EXPECTED" comments inside it. */
  const esperado = {
    /* 2 = the Portuguese imperative + the English one. A quoted example, a
       subordinate clause (in both languages) and an exception with a reason do
       not count. */
    'usage-instruction': 2,
    'caption-of-what-follows': 2, // "as dez peças abaixo" + "the three panels below"
    'shouting-label': 3,
    'verb-per-item': 0,
    /*
     * 2 = the `title`/`placeholder` pair in the same render + the pair of JSX
     * sentences with balanced parentheses.
     *
     * It was 0 (only the TS generics, which cannot become a "sentence"). It
     * became 1 on 2026-08-12 together with the ASSIGNMENT false positive fix:
     * without a positive in the fixture, narrowing the attribute regex could
     * zero out the whole rule and the self-test would applaud: a detector that
     * detects nothing passes every negative test.
     *
     * It became 2 on 2026-08-19: the attribute pair stopped being `alt`+
     * `placeholder` (`alt` left the detector's scope) and became
     * `title`+`placeholder`, and a second positive came in: two JSX sentences
     * with balanced PARENTHESES. That second one exists so the new
     * unbalanced-parenthesis sieve cannot be loosened until it swallows screen
     * sentences.
     */
    'same-info-twice': 2,
    /*
     * 2 = the button arrow (`→` alone in a span) + the one on the back link.
     *
     * Both cases exist on purpose: the `texto: true` version of this rule only
     * caught the second, because the text extractor discards single-character
     * nodes. Without the first one locked here, someone rewrites the rule on
     * top of the extracted text, the self-test applauds, and the most common
     * habit gets through again.
     */
    'arrow-glyph': 2,
    /*
     * 5 = the icon on the 24×24 grid in ruido-casos (the brand graphic, viewBox
     * 0 0 1017 135, stays out) + 3 glyphs in glyphs/with-lib/panel.tsx (lucide
     * installed: one finding per glyph; its four brand marks stay out) + 1 in
     * glyphs/no-lib/card.tsx (three glyphs, no library: one per file). The
     * `icons/` folder file and the `*logo*` file add zero.
     */
    'hand-drawn-icon': 5,
    /*
     * 1 = the `on: true` in the card factory. The two negatives exist to lock
     * the two ways the rule turns into noise: the call argument
     * (`setScreen({ on: true })`, the false positive confirmed in Director.tsx)
     * and the single piece lit on purpose, with the reason written.
     */
    'highlight-at-rest': 1,
    /*
     * 4 = the TWO ENDS of the jukebox pair (`cap` in ruido-casos, which now
     * renders the box, and `placeholder` in noise-door-b) + the two ends of
     * the sibling pair in door/siblings-*. Two per pair because a finding that
     * cites only one end sends you to fix the wrong side. The other six cases
     * in door/ are negatives and must stay at zero.
     */
    'repeated-door': 4,
    /* phase 2: see the EXPECTED comments in fixtures/noise-phase2.tsx */
    'synthetic-cover': 2, // name hash + brand colors in place of the cover
    'tile-img-no-onerror': 2, // tile <img> and <motion.img>; 5 negatives
    'stagger-by-index': 2, // delay: index * … and animationDelay `${i * …}`
    /*
     * 7 = the 3 from R13 (-translate-y, group-hover:scale-105, whileHover y<0) +
     * 4 from the "THE WRITTEN EXCEPTION NEEDS A REASON" block: a silent
     * exception, a short reason, half the rule name and an exception below the
     * finding do NOT release. The two with a reason (on one line and wrapped
     * over two) do, and so does the English `EXCEPTION to` alias (if the alias
     * breaks, this becomes 8). Under the old contract (only "EXCEÇÃO" + name in
     * the window) it gave 5.
     */
    'hover-lift': 7,
    'dot-grid': 3, // <GridDots…>, repeated radial, circle SVG
    'blur-on-card': 1, // the in-flow card; sticky bar and dialog stay out
    /*
     * Signals 47-57 (2026-10-28): every count below comes from signals-dirty.tsx
     * alone. signals-clean.tsx holds the legitimate twin of each block (below
     * the floor, real limits, code marked as code, a written exception) and
     * adds zero; if one of these numbers grows, the clean file started firing.
     */
    'tag-everywhere': 6,
    'italic-headline-word': 2,
    'display-serif-tight': 2,
    'divider-everywhere': 8,
    'opacity-ladder': 1,
    'box-in-box': 2,
    'code-crumb': 4,
    'numbered-section': 3,
    'mono-everywhere': 10,
  };

  let falhou = 0;
  for (const [regra, n] of Object.entries(esperado)) {
    const achou = porRegra[regra] ?? 0;
    const ok = achou === n;
    if (!ok) falhou++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${regra.padEnd(26)} expected ${n}, found ${achou}`);
    /* On failure, show WHERE: a wrong count without the line sends you hunting in the dark. */
    if (!ok) for (const a of achados.filter((x) => x.regra === regra)) console.log(`           ${path.basename(a.file)}:${a.linha}  ${a.amostra}`);
  }
  /* A rule that fired on the fixture and is not in the contract is also a failure. */
  for (const regra of Object.keys(porRegra)) {
    if (regra in esperado) continue;
    falhou++;
    console.log(`  FAIL  ${regra.padEnd(26)} outside the contract, found ${porRegra[regra]}`);
  }
  /*
   * The legacy fixtures add zero above. That zero only proves the alias if the
   * rules DO fire there without it: scan a copy with every old id blanked
   * (same basenames, in a temp folder) and require each released rule back.
   */
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ruido-legado-'));
  try {
    const copias = LEGADO_FIXTURES.map((f) => {
      let txt = fs.readFileSync(path.join(dir, f), 'utf8');
      for (const velho of Object.keys(LEGADO)) txt = txt.split(velho).join('id-apagado');
      const destino = path.join(tmp, f);
      fs.writeFileSync(destino, txt);
      return destino;
    });
    const semAlias = scanRuido(copias).reduce((a, x) => ((a[x.regra] = (a[x.regra] ?? 0) + 1), a), {});
    for (const [regra, n] of Object.entries(LEGADO_CONTROLE)) {
      const ok = (semAlias[regra] ?? 0) === n;
      if (!ok) falhou++;
      console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${`legacy ${regra}`.padEnd(26)} without the old id expected ${n}, found ${semAlias[regra] ?? 0}`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(falhou ? `\nself-test: ${falhou} rule(s) off the expected count.` : `\nself-test: all ${Object.keys(esperado).length} rules match the fixture, and the ${Object.keys(LEGADO_CONTROLE).length} legacy aliases hold.`);
  process.exit(falhou ? 1 : 0);
}

if (executadoDireto && args.includes('--self-test')) selfTest();

if (executadoDireto) {
  exigirAlvo();
  const arquivos = listarArquivos();
  const achados = scanRuido(arquivos);
  const bar = '-'.repeat(64);
  console.log(`\nnoise-scan  target: ${targets.join(' ')}`);
  console.log(`interface files: ${arquivos.length}\n`);

  if (!achados.length) {
    console.log('[OK]  chrome noise  zero');
    console.log(bar);
    console.log('Zero here does NOT mean a clean screen: this detector counts chrome,');
    console.log('it does not judge whether what is left deserves its place. Open the screen.');
    console.log(bar);
    process.exit(0);
  }

  const porRegra = new Map();
  for (const a of achados) {
    if (!porRegra.has(a.regra)) porRegra.set(a.regra, []);
    porRegra.get(a.regra).push(a);
  }

  for (const regra of [...REGRAS, ...REGRAS_GLOBAIS]) {
    const lista = porRegra.get(regra.id);
    if (!lista?.length) continue;
    console.log(`[FAIL]  ${regra.id.padEnd(26)} ${lista.length} finding(s): ${regra.descricao}`);
    if (!quiet) {
      for (const a of lista.slice(0, 12)) {
        console.log(`           ${a.file}:${a.linha}  ${a.amostra}`);
      }
      if (lista.length > 12) console.log(`           ... and ${lista.length - 12} more`);
    }
  }

  console.log(bar);
  console.log(`${achados.length} cut candidate(s). Confirm at file:line before deleting:`);
  console.log('one of these lines may be the only one that really guides.');
  console.log(bar);
  process.exit(1);
}
