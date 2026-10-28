/* Fixture of the killer-scan copy extractor. NOT a real component.
 *
 * Contract, and it is self-checking:
 *   every line whose copy MUST be extracted contains the word EXTRAI;
 *   every line that must NOT be extracted contains the word IGNORA.
 * (The markers stay in Portuguese: they are test data the self-test matches.)
 *
 * `node killer-scan.mjs --self-test` runs the extractor here and fails both
 * ways: a string extracted without EXTRAI is a false positive, an EXTRAI line
 * that did not come out is a false negative. Without this, each new false
 * positive was found by stumbling on it, and fixing one reopened the other.
 *
 * Every case below has bitten for real. Do not delete any: add.
 *
 * This block comment has a dash — IGNORA, a comment is not copy.
 */

// Line comment with a dash — IGNORA.

const LIMITE_ANUAL = 81_000; // IGNORA, uppercase constant
const rate = 0.32;

export function Fixture({ receita, despesa, ano }: { receita: number; despesa: number; ano: number }) {
  // IGNORA: subtraction is an arithmetic minus, not a copy dash
  const lucro = receita - despesa;

  // IGNORA: ternary whose `>` the JSX text extractor mistook for a tag end
  const carga = receita > 0 ? lucro / receita : null;

  // IGNORA: loose-line expression, with an operator and a camelCase identifier
  const adicional = receita > LIMITE_ANUAL
    ? (receita - LIMITE_ANUAL) * rate
    : 0;

  // IGNORA: arrow function and path template
  const url = (id: string) => `/api/admin/fiscal/${id}`;

  return (
    <div className="flex min-w-0 items-baseline justify-between gap-2 text-xs text-muted-foreground">
      {/* IGNORA: className is a string, and a class string is not copy */}
      <span className="truncate text-sm font-bold tracking-tight">EXTRAI Cenário fiscal</span>

      {/* EXTRAI: JSX text split by an expression, the most common case in the repo */}
      <p className="text-xs">
        EXTRAI Acima de {LIMITE_ANUAL} no ano de {ano}, declaração obrigatória.
      </p>

      {/* EXTRAI: label prop */}
      <button aria-label="EXTRAI Limpar cenário simulado" onClick={() => setSim(null)}>
        <span>EXTRAI Limpar</span>
      </button>

      {/* EXTRAI: template literal with copy inside */}
      <p>{`EXTRAI Lançado no ano de ${ano} até aqui`}</p>

      {/* IGNORA: url, file path and translation key */}
      <a href={url("resumo")}>ver</a>
      <img src="/img/fiscal-hero.png" alt="EXTRAI Gráfico do acumulado por mês" />

      {/* IGNORA: loose identifier, no space and no accent */}
      <div data-testid="fiscal-simulator" id="fiscal-card" />

      {/* IGNORA: formatted numeric value with no text */}
      <span className="tabular-nums">{carga}</span>
      <span className="tabular-nums">{adicional}</span>

      {/* IGNORA: property access inside an object, no obvious code smell */}
      <Consumidor ano={{ anterior: 2025, atual: 2026 }} />

      {/* EXTRAI: HTML entity in the middle of copy, and its semicolon is not punctuation */}
      <p>EXTRAI Marque como &quot;Mensal&quot; para ela aparecer aqui.</p>

      {/* EXTRAI: curly quote. The closed entity list had &quot; and not
          &ldquo;, so correct copy flagged a semicolon. */}
      <p>&ldquo;EXTRAI A marca cresceu junto com a clareza&rdquo;</p>
    </div>
  );
}

declare function setSim(v: number | null): void;

/* Cases from the public routes audit (2026-08-03). All three flagged language
 * tics on syntax, and the worst part is the finding looked legitimate:
 * "semicolon" in an audio player file.
 */
export type UniaoDoFixture =
  // IGNORA: type union member, the `];` is not a copy semicolon
  | { type: ToolUIPartDoFixture["type"]; state: ToolUIPartDoFixture["state"] };

export function CodigoQueNaoEhCopy({ mediaType, base64, id }: { mediaType: string; base64: string; id: string }) {
  // IGNORA: data URI, the `;` belongs to the MIME type
  const src = `data:${mediaType};base64,${base64}`;
  /* The line break matters: the JSX text extractor eats what follows the
     generic's `>`, and only when the `>` is glued to an identifier. On a
     single line, `const` already knocked it out via CODEY and the case did not reproduce. */
  const {
    data,
  } = useSWRDoFixture<MemberDataDoFixture>(chaveDoFixture(id, "portfolio")); // IGNORA
  return <img src={src} alt="EXTRAI Prévia do arquivo enviado" data-nome={data?.nome} />
}

declare interface ToolUIPartDoFixture { type: string; state: string }
declare function useSWRDoFixture<T>(k: string): { data: T | null };
declare interface MemberDataDoFixture { nome: string }
declare function chaveDoFixture(a: string, b: string): string;

/* Extra cases, found in the cold run on the /finance tab (2026-08-03):
 *   - `year: prev.year - 1,` became copy and flagged hyphen-as-dash;
 *   - `onSet: (s: X) => Promise<void> | void;` let "| void;" through;
 *   - `&quot;` took its `;` into the semicolon rule.
 */
export interface PropsDoFixture {
  onSetStatus: (status: string) => Promise<void> | void; // IGNORA, type signature
}

/* Case found in the public routes audit (2026-08-03): the object property line
 * came out TWICE, once with the key and quotes attached and once clean. Both
 * versions escaped dedupe (different strings), were concatenated, and the
 * sentence counted double: the credibility seal (`max: 1`) flagged a repetition
 * in a file with a single occurrence. The loose line now goes, and the literal
 * loop is what extracts the text.
 *
 * Contract: the line below must come out ONCE, and without the `description:`.
 */
export const metadataDoFixture = {
  description: 'EXTRAI Faça sua pergunta ao palestrante em tempo real',
};

/* Document title in BOTH Next forms. The pipe there is the tab and SERP
 * convention, not a dot separator: both lines are extracted (EXTRAI, because
 * emoji and guru still apply to them) but come out marked, and the gate does
 * not check delimiters. The `generateMetadata` form is the one that escaped.
 */
export async function generateMetadata() {
  return {
    title: `EXTRAI Portfólio | Visant® Studio`,
    description: 'EXTRAI Explore os projetos de branding da Visant Studio',
  };
}

export function ExtraFixture({ prev }: { prev: { year: number } }) {
  const anterior = {
    year: prev.year - 1, // IGNORA, property access and subtraction minus
  };
  return <span>{anterior.year}</span>;
}

declare function Consumidor(p: { ano: { anterior: number; atual: number } }): JSX.Element;

/* Copy SPLIT by interpolation. Found in the mockup-store home header, where
 * `59 à vista · 4.480 no acervo` was on screen and the gate said zero: the
 * fragment left after the mask is "à vista ·", a single word, and the "fewer
 * than two words is not a sentence" rule discarded it. A false NEGATIVE, the
 * serious one: the detector approved a visible separator. Now a fragment with
 * a dot or dash counts as copy even with one word.
 *
 * The semicolon stays out of the exception on purpose: `(k: string): ;` (a type
 * signature line, further up in this file) ends in `;` and would come back as a
 * false positive. The first version of the fix did exactly that, and this
 * fixture caught it. */
export function CopyPartida({ vista, total }: { vista: number; total: number }) {
  return (
    <div>
      <span>{vista} EXTRAI à vista · </span>
      {total} EXTRAI no acervo
    </div>
  );
}

/* Generic with a template argument. The JSX text extractor eats what follows
 * the `>` of `querySelector<T>(...)` and returned the whole selector as copy;
 * the trailing `;` became a semicolon finding. A false POSITIVE, found in the
 * Recorder audit (jaques-os, 2026-08-05). The backtick joined CODEY: it
 * delimits a template literal and never appears in text the user reads. */
export function SeletorDeDom({ id }: { id: string }) {
  const pular = () => {
    const el = document.querySelector<HTMLMediaElement>(`[src*="id=${id}"]`);   // IGNORA
    if (el) el.currentTime = 0;
  };
  return <button onClick={pular}>EXTRAI voltar pro começo</button>;
}

/* Multi-line JSX with an expression left OPEN at the end of the line. The
 * candidate came out with `{cond` glued on, CODEY saw the brace and threw the
 * whole sentence away: the dash stayed visible on screen and the gate said
 * zero. A false NEGATIVE, found by opening the page in the Recorder audit
 * (jaques-os, 2026-08-05). */
export function CopyAntesDeExpressao({ tem }: { tem: boolean }) {
  return (
    <div>
      Aperte <b>Gravar</b> EXTRAI — ou {tem
        ? <span>EXTRAI o atalho, que cola sozinho</span>
        : 'EXTRAI o atalho global, quando estiver disponível'}
    </div>
  );
}

/* Cookie: a `key=value;` pair. It has letters, spaces and no code smell: it
 * passed `looksLikeCopy` whole and the gate flagged a sales-copy semicolon on a
 * `Set-Cookie`. A false POSITIVE, found in the boxy-app audit
 * (login-form.tsx:120, 2026-08-06). Copy does not write `key=value;`. */
export function LimpaCookieDeErro() {
  const limpar = () => {
    document.cookie = 'auth_error=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';   // IGNORA
    document.cookie = 'auth_pending=true; path=/; max-age=60; SameSite=Lax';           // IGNORA
  };
  return <button onClick={limpar}>EXTRAI tentar de novo</button>;
}

/* A PURE separator between two interpolations, inside a combobox `label`.
 * After the `${...}` mask the template becomes " · ": zero letters, three
 * characters, so it died on the minimum length and the `\p{L}` of
 * `looksLikeCopy`, and the literal loop required 6 characters and 3 letters in
 * a row. The gate said "copy zero" with a dot going to the user's eye. A false
 * NEGATIVE, found in the CRM Proposals tab audit (visant-board, 2026-08-07).
 *
 * The counterexample on the next line is mandatory: parenthesis and slash are
 * LEGITIMATE separators, and the rule must not start flagging any punctuation
 * between interpolations. */
export function OpcoesDeNegocio({ itens }: { itens: Negocio[] }) {
  return itens.map((negocio) => ({
    value: negocio.id,
    label: negocio.cliente
      ? `${negocio.name} · ${negocio.cliente}`   // EXTRAI
      : negocio.name,
    subtitulo: `${negocio.cidade} (${negocio.uf})`,   // IGNORA
  }));
}

/* Placeholder for a MISSING value: the same glyph as the separator doing the
 * opposite job. `" · "` JOINS two values; `"—"` REPLACES a value that does not
 * exist. A dense table convention (Linear, Stripe, Vercel): swapping it for a
 * hyphen worsens the typography, it does not fix voice.
 *
 * The discriminator is the space, and it is not leftover formatting: a
 * separator is written with spaces around it because `a·b` cannot be read; a
 * placeholder is written bare because there is nothing to separate. In the
 * /admin audit (visant-board, 2026-08-10) these were 9 of 16 "separator-only
 * literal" findings, enough noise for someone to turn off the whole gate. */
export function CelulaDeHoras({ horas }: { horas: number | null }) {
  return <span>{horas != null ? horas : '—'}</span>;   // IGNORA
}

/* Mandatory counterexample to the counterexample: a dash WITH spaces is still
 * prose, and still forbidden. Without this line, "require a space" would
 * become a way in for the prose dash. */
export function AvisoDeRessalva({ pct }: { pct: number }) {
  return <p>{pct}% do orçado{' — '}EXTRAI leia com ressalva</p>;
}

/* Generic with an object inside, followed by a call. The `{expr}` mask eats the
 * type argument, the generic's `>` becomes a "tag close" and the rest of the
 * line (`(jobsRaw), [jobsRaw]);`) is extracted as text. It starts with a
 * parenthesis, so CALL_EXPR sees no identifier glued to the `(`: the name stayed
 * on the other side of the cut. The gate flagged a sales-copy semicolon on a
 * `useMemo`. A false POSITIVE, found in the sales kanban audit (2026-08-07).
 *
 * The counterexample is mandatory: a parenthesis followed by a comma is
 * legitimate Portuguese prose, and the rule must not start killing copy
 * because of a parenthesis. */
export function ListaDeJobs({ jobsRaw }: { jobsRaw: unknown }) {
  const jobsList = useMemo(() => pickList<{ id: string; job: string }>(jobsRaw), [jobsRaw]);   // IGNORA
  return <p>EXTRAI a segunda opção (a melhor delas), aliás, é a que fecha mais</p>;
}

/* A generic in the MIDDLE of a signature: the `>` of `Map<string, Tween>`
 * becomes a "tag close" and the rest of the parameters was extracted as copy,
 * with the union pipe flagging pipe-separador. A false POSITIVE, MN Group audit
 * (2026-09-28). Counterexample: a label with a colon is copy and still gets in. */
export function fly(root: HTMLElement | null, flights: Map<string, Tween>, id: string, dir: 'open' | 'close') {   // IGNORA
  return <p>EXTRAI Nome: escreva como aparece no documento</p>
}

/* A generic followed by a type suffix or a member access. The `>` that closes
 * the type argument becomes a "tag close" and what follows was read as JSX
 * text:
 *   - `Node<FlowNodeData>[] | ((prev: ...` handed over `[] | ((prev: Node`, and
 *     the union pipe flagged pipe-separador (CollaborativeCanvas.tsx);
 *   - `(ref as React.MutableRefObject<Konva.Stage | null>).current = node;`
 *     handed over `).current = node;`, and the `;` flagged a semicolon
 *     (KonvaCanvas.tsx).
 * A false POSITIVE, wave 4 of the visantlabs-os slop killer (2026-10-05). Screen
 * text never starts with `[]` or a glued `.member`. Mandatory counterexample:
 * a closing parenthesis after an inline tag, followed by a period and a SPACE, is prose. */
type Setters = {
  setNodes: (nodes: Node<FlowNodeData>[] | ((prev: Node<FlowNodeData>[]) => Node<FlowNodeData>[])) => void;   // IGNORA
};
export function setRef(ref: unknown, node: unknown) {
  if (ref) (ref as React.MutableRefObject<Konva.Stage | null>).current = node;   // IGNORA
  return <p>(veja <a href="/docs">a documentação</a>). EXTRAI depois disso tudo segue igual</p>;
}

/* A TypeScript union written as prop DOCUMENTATION, on the design system page:
 * `<span>position:</span> 'left' | 'right'` and
 * `aspectRatio: 'number | string (default 1; masonry = natural)'`. The pipe
 * there is the union operator, not a copy separator, and the gate flagged
 * pipe-separador (and the `;` inside the parenthesis flagged a semicolon). Rule:
 * if EVERY segment between pipes is a quoted literal, a type word (string,
 * number, boolean, ReactNode, undefined, null...) or a code-looking identifier
 * (camelCase, `a.b`, `T[]`, `T<U>`), it is a type. A trailing parenthesized
 * annotation, `(default ...)`, does not count. A false POSITIVE, src/pages/
 * DesignSystemPage.tsx (2026-10-05).
 *
 * Mandatory counterexamples: a real copy pipe still gets in, with a sentence on
 * each side OR with a plain loose word (footer nav), because a lone
 * capitalized word is not a code identifier. */
export function PropsDoc() {
  const doc = {
    aspectRatio: 'number | string (default 1; masonry = natural)',   // IGNORA
  };
  return (
    <div data-doc={doc.aspectRatio}>
      <span>position:</span> 'left' | 'right' {/* IGNORA */}
      <span>size:</span> "sm" | "md" | "lg" {/* IGNORA */}
      <span>children:</span> ReactNode | undefined {/* IGNORA */}
      <span>items:</span> string[] | null {/* IGNORA */}
      <p>EXTRAI Planos | Preços para equipes</p>
      <nav>Home | Sobre | EXTRAI</nav>
    </div>
  );
}
