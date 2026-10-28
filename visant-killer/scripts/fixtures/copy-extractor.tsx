/* Fixture do extrator de copy do killer-scan. NÃO é componente de verdade.
 *
 * Contrato, e ele é auto-verificável:
 *   toda linha cuja copy DEVE ser extraída contém a palavra EXTRAI;
 *   toda linha que NÃO deve ser extraída contém a palavra IGNORA.
 *
 * `node killer-scan.mjs --self-test` roda o extrator aqui e falha nos dois
 * sentidos: string extraída sem EXTRAI é falso positivo, linha com EXTRAI que
 * não saiu é falso negativo. Sem isso, cada falso positivo novo era descoberto
 * por tropeço, e o conserto de um reabria o outro.
 *
 * Cada caso abaixo já mordeu de verdade. Não apague nenhum: acrescente.
 *
 * Este comentário de bloco tem travessão — IGNORA, comentário não é copy.
 */

// Comentário de linha com travessão — IGNORA.

const LIMITE_ANUAL = 81_000; // IGNORA, constante em caixa alta
const rate = 0.32;

export function Fixture({ receita, despesa, ano }: { receita: number; despesa: number; ano: number }) {
  // IGNORA: subtração é menos de conta, não travessão de copy
  const lucro = receita - despesa;

  // IGNORA: ternário cujo `>` o extrator de texto de JSX confundia com fim de tag
  const carga = receita > 0 ? lucro / receita : null;

  // IGNORA: expressão de linha solta, com operador e identificador em camelCase
  const adicional = receita > LIMITE_ANUAL
    ? (receita - LIMITE_ANUAL) * rate
    : 0;

  // IGNORA: arrow function e template de caminho
  const url = (id: string) => `/api/admin/fiscal/${id}`;

  return (
    <div className="flex min-w-0 items-baseline justify-between gap-2 text-xs text-muted-foreground">
      {/* IGNORA: className é string, e string de classe não é copy */}
      <span className="truncate text-sm font-bold tracking-tight">EXTRAI Cenário fiscal</span>

      {/* EXTRAI: texto de JSX partido por expressão, o caso mais comum do repo */}
      <p className="text-xs">
        EXTRAI Acima de {LIMITE_ANUAL} no ano de {ano}, declaração obrigatória.
      </p>

      {/* EXTRAI: prop de rótulo */}
      <button aria-label="EXTRAI Limpar cenário simulado" onClick={() => setSim(null)}>
        <span>EXTRAI Limpar</span>
      </button>

      {/* EXTRAI: literal de template com copy dentro */}
      <p>{`EXTRAI Lançado no ano de ${ano} até aqui`}</p>

      {/* IGNORA: url, caminho de arquivo e chave de tradução */}
      <a href={url("resumo")}>ver</a>
      <img src="/img/fiscal-hero.png" alt="EXTRAI Gráfico do acumulado por mês" />

      {/* IGNORA: identificador solto, sem espaço e sem acento */}
      <div data-testid="fiscal-simulator" id="fiscal-card" />

      {/* IGNORA: valor numérico formatado sem texto */}
      <span className="tabular-nums">{carga}</span>
      <span className="tabular-nums">{adicional}</span>

      {/* IGNORA: acesso a propriedade dentro de objeto, sem sinal de código óbvio */}
      <Consumidor ano={{ anterior: 2025, atual: 2026 }} />

      {/* EXTRAI: entidade HTML no meio da copy, e o ponto-e-vírgula dela não é pontuação */}
      <p>EXTRAI Marque como &quot;Mensal&quot; para ela aparecer aqui.</p>

      {/* EXTRAI: aspa curva. A lista fechada de entidade tinha &quot; e não
          &ldquo;, então a copy certa acusava ponto-e-vírgula. */}
      <p>&ldquo;EXTRAI A marca cresceu junto com a clareza&rdquo;</p>
    </div>
  );
}

declare function setSim(v: number | null): void;

/* Casos do audit das rotas públicas (2026-08-03). Os três acusavam vício de
 * linguagem em cima de sintaxe, e o pior é que o achado parecia legítimo:
 * "ponto-e-vírgula" num arquivo de player de áudio.
 */
export type UniaoDoFixture =
  // IGNORA: membro de união de tipo, o `];` não é ponto-e-vírgula de copy
  | { type: ToolUIPartDoFixture["type"]; state: ToolUIPartDoFixture["state"] };

export function CodigoQueNaoEhCopy({ mediaType, base64, id }: { mediaType: string; base64: string; id: string }) {
  // IGNORA: data URI, o `;` é do MIME
  const src = `data:${mediaType};base64,${base64}`;
  /* A quebra de linha importa: o extrator de texto de JSX come o que vem depois
     do `>` do genérico, e só quando o `>` está colado num identificador. Numa
     linha só, o `const` já derrubava pelo CODEY e o caso não reproduzia. */
  const {
    data,
  } = useSWRDoFixture<MemberDataDoFixture>(chaveDoFixture(id, "portfolio")); // IGNORA
  return <img src={src} alt="EXTRAI Prévia do arquivo enviado" data-nome={data?.nome} />
}

declare interface ToolUIPartDoFixture { type: string; state: string }
declare function useSWRDoFixture<T>(k: string): { data: T | null };
declare interface MemberDataDoFixture { nome: string }
declare function chaveDoFixture(a: string, b: string): string;

/* Casos extras, achados na rodada a frio na tab /finance (2026-08-03):
 *   - `year: prev.year - 1,` virava copy e acusava hífen como travessão;
 *   - `onSet: (s: X) => Promise<void> | void;` deixava "| void;" passar;
 *   - `&quot;` levava o `;` dela para dentro da regra de ponto-e-vírgula.
 */
export interface PropsDoFixture {
  onSetStatus: (status: string) => Promise<void> | void; // IGNORA, assinatura de tipo
}

/* Caso achado no audit das rotas públicas (2026-08-03): a linha de propriedade
 * de objeto saía DUAS vezes, uma com a chave e as aspas junto e outra limpa. As
 * duas versões escapavam do dedupe (string diferente), eram concatenadas, e a
 * frase contava dobrada: o selo de credibilidade (`max: 1`) acusava repetição
 * num arquivo com uma ocorrência só. A linha solta agora sai, e quem extrai o
 * texto é o laço de literal.
 *
 * Contrato: a linha abaixo tem que sair UMA vez, e sem o `description:` junto.
 */
export const metadataDoFixture = {
  description: 'EXTRAI Faça sua pergunta ao palestrante em tempo real',
};

/* Título de documento nas DUAS formas do Next. O pipe ali é convenção de aba e
 * de SERP, não bolinha separadora: as duas linhas são extraídas (EXTRAI, porque
 * emoji e guru continuam valendo nelas) mas saem marcadas, e o portão não
 * cobra delimitador. A forma `generateMetadata` é a que escapava.
 */
export async function generateMetadata() {
  return {
    title: `EXTRAI Portfólio | Visant® Studio`,
    description: 'EXTRAI Explore os projetos de branding da Visant Studio',
  };
}

export function ExtraFixture({ prev }: { prev: { year: number } }) {
  const anterior = {
    year: prev.year - 1, // IGNORA, acesso a propriedade e menos de subtração
  };
  return <span>{anterior.year}</span>;
}

declare function Consumidor(p: { ano: { anterior: number; atual: number } }): JSX.Element;

/* Copy PARTIDA por interpolação. Achado no header da home do mockup-store, onde
 * `59 à vista · 4.480 no acervo` estava na tela e o portão dizia zero: o fragmento
 * que sobra depois da máscara é "à vista ·", uma palavra só, e a regra de "menos de
 * duas palavras não é frase" o descartava. Falso NEGATIVO, o grave — o detector
 * aprovava um separador visível. Agora fragmento com bolinha ou travessão conta
 * como copy mesmo com uma palavra.
 *
 * O ponto-e-vírgula continua fora da exceção de propósito: `(k: string): ;` (linha
 * de assinatura de tipo, mais acima neste arquivo) termina em `;` e voltaria como
 * falso positivo. A primeira versão do conserto fez exatamente isso, e este fixture
 * pegou. */
export function CopyPartida({ vista, total }: { vista: number; total: number }) {
  return (
    <div>
      <span>{vista} EXTRAI à vista · </span>
      {total} EXTRAI no acervo
    </div>
  );
}

/* Genérico com argumento em template. O extrator de texto de JSX come o que vem
 * depois do `>` de `querySelector<T>(...)` e devolvia o seletor inteiro como
 * copy; o `;` do fim virava achado de ponto-e-vírgula. Falso POSITIVO, achado no
 * audit do Gravador (jaques-os, 2026-08-05). A crase entrou no CODEY: ela
 * delimita template literal e nunca aparece em texto que o usuário lê. */
export function SeletorDeDom({ id }: { id: string }) {
  const pular = () => {
    const el = document.querySelector<HTMLMediaElement>(`[src*="id=${id}"]`);   // IGNORA
    if (el) el.currentTime = 0;
  };
  return <button onClick={pular}>EXTRAI voltar pro começo</button>;
}

/* JSX de várias linhas com expressão ABERTA no fim da linha. O candidato saía
 * com o `{cond` colado, o CODEY via a chave e jogava a frase inteira fora — o
 * travessão ficava visível na tela e o portão dizia zero. Falso NEGATIVO,
 * achado abrindo a página no audit do Gravador (jaques-os, 2026-08-05). */
export function CopyAntesDeExpressao({ tem }: { tem: boolean }) {
  return (
    <div>
      Aperte <b>Gravar</b> EXTRAI — ou {tem
        ? <span>EXTRAI o atalho, que cola sozinho</span>
        : 'EXTRAI o atalho global, quando estiver disponível'}
    </div>
  );
}

/* Cookie: par `chave=valor;`. Tem letra, tem espaço, não tem cheiro de código —
 * passava inteiro por `looksLikeCopy` e o portão acusava ponto-e-vírgula de copy
 * de venda em cima de um `Set-Cookie`. Falso POSITIVO, achado no audit do
 * boxy-app (login-form.tsx:120, 2026-08-06). Copy não escreve `chave=valor;`. */
export function LimpaCookieDeErro() {
  const limpar = () => {
    document.cookie = 'auth_error=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';   // IGNORA
    document.cookie = 'auth_pending=true; path=/; max-age=60; SameSite=Lax';           // IGNORA
  };
  return <button onClick={limpar}>EXTRAI tentar de novo</button>;
}

/* Separador PURO entre duas interpolações, dentro de um `label` de combobox.
 * Depois da máscara de `${...}` o template vira " · ": zero letra, três
 * caracteres, então morria no comprimento mínimo e no `\p{L}` de
 * `looksLikeCopy`, e o laço de literais exigia 6 caracteres e 3 letras seguidas.
 * O portão dizia "copy zero" com uma bolinha indo pro olho do usuário. Falso
 * NEGATIVO, achado no audit da aba Propostas do CRM (visant-board, 2026-08-07).
 *
 * O contraexemplo na linha seguinte é obrigatório: parêntese e barra são
 * separadores LEGÍTIMOS, e a regra não pode passar a acusar qualquer pontuação
 * entre interpolações. */
export function OpcoesDeNegocio({ itens }: { itens: Negocio[] }) {
  return itens.map((negocio) => ({
    value: negocio.id,
    label: negocio.cliente
      ? `${negocio.name} · ${negocio.cliente}`   // EXTRAI
      : negocio.name,
    subtitulo: `${negocio.cidade} (${negocio.uf})`,   // IGNORA
  }));
}

/* Placeholder de valor AUSENTE: o mesmo glifo do separador fazendo o trabalho
 * oposto. `" · "` JUNTA dois valores; `"—"` SUBSTITUI um valor que não existe.
 * Convenção de tabela densa (Linear, Stripe, Vercel) — trocar por hífen piora a
 * tipografia, não conserta voz.
 *
 * O discriminador é o espaço, e ele não é sobra de formatação: separador se
 * escreve com espaço em volta porque `a·b` não se lê; placeholder se escreve
 * pelado porque não há o que separar. No audit de /admin (visant-board,
 * 2026-08-10) eram 9 dos 16 achados de "literal só de separador" — barulho
 * suficiente pra alguém desligar o portão inteiro. */
export function CelulaDeHoras({ horas }: { horas: number | null }) {
  return <span>{horas != null ? horas : '—'}</span>;   // IGNORA
}

/* Contraexemplo obrigatório do contraexemplo: travessão COM espaço continua
 * sendo prosa, e continua proibido. Sem esta linha, "exigir espaço" viraria
 * porta de entrada pro travessão de prosa. */
export function AvisoDeRessalva({ pct }: { pct: number }) {
  return <p>{pct}% do orçado{' — '}EXTRAI leia com ressalva</p>;
}

/* Genérico com objeto dentro, seguido de chamada. A máscara de `{expr}` come o
 * argumento de tipo, o `>` do genérico vira "fechamento de tag" e o resto da
 * linha (`(jobsRaw), [jobsRaw]);`) é extraído como texto. Começa em parêntese,
 * então CALL_EXPR não vê identificador colado no `(` — o nome ficou do outro lado
 * do corte. O portão acusava ponto-e-vírgula de copy de venda num `useMemo`.
 * Falso POSITIVO, achado no audit do kanban do comercial (2026-08-07).
 *
 * O contraexemplo é obrigatório: parêntese com vírgula é prose legítima em
 * português, e a regra não pode passar a matar copy por causa de um parêntese. */
export function ListaDeJobs({ jobsRaw }: { jobsRaw: unknown }) {
  const jobsList = useMemo(() => pickList<{ id: string; job: string }>(jobsRaw), [jobsRaw]);   // IGNORA
  return <p>EXTRAI a segunda opção (a melhor delas), aliás, é a que fecha mais</p>;
}

/* Genérico no MEIO de uma assinatura: o `>` de `Map<string, Tween>` vira
 * "fechamento de tag" e o resto dos parâmetros era extraído como copy, com o
 * pipe da união acusando pipe-separador. Falso POSITIVO, audit da MN Group
 * (2026-09-28). Contraexemplo: rótulo com dois-pontos é copy e continua entrando. */
export function fly(root: HTMLElement | null, flights: Map<string, Tween>, id: string, dir: 'open' | 'close') {   // IGNORA
  return <p>EXTRAI Nome: escreva como aparece no documento</p>
}

/* Genérico seguido de sufixo de tipo ou de acesso a membro. O `>` que fecha o
 * argumento de tipo vira "fechamento de tag" e o que vem depois era lido como
 * texto de JSX:
 *   - `Node<FlowNodeData>[] | ((prev: ...` entregava `[] | ((prev: Node`, e o
 *     pipe da união acusava pipe-separador (CollaborativeCanvas.tsx);
 *   - `(ref as React.MutableRefObject<Konva.Stage | null>).current = node;`
 *     entregava `).current = node;`, e o `;` acusava ponto-e-vírgula
 *     (KonvaCanvas.tsx).
 * Falso POSITIVO, onda 4 do slop killer do visantlabs-os (2026-10-05). Texto de
 * tela nunca começa com `[]` nem com `.membro` colado. Contraexemplo obrigatório:
 * parêntese fechado depois de tag inline, seguido de ponto e ESPAÇO, é prosa. */
type Setters = {
  setNodes: (nodes: Node<FlowNodeData>[] | ((prev: Node<FlowNodeData>[]) => Node<FlowNodeData>[])) => void;   // IGNORA
};
export function setRef(ref: unknown, node: unknown) {
  if (ref) (ref as React.MutableRefObject<Konva.Stage | null>).current = node;   // IGNORA
  return <p>(veja <a href="/docs">a documentação</a>). EXTRAI depois disso tudo segue igual</p>;
}

/* União de TypeScript escrita como DOCUMENTAÇÃO de prop, na página do design
 * system: `<span>position:</span> 'left' | 'right'` e
 * `aspectRatio: 'number | string (default 1; masonry = natural)'`. O pipe ali é
 * o operador de união, não separador de copy, e o portão acusava pipe-separador
 * (e o `;` do parêntese acusava ponto-e-vírgula). Regra: se TODO segmento entre
 * pipes é literal entre aspas, palavra de tipo (string, number, boolean,
 * ReactNode, undefined, null...) ou identificador com cara de código
 * (camelCase, `a.b`, `T[]`, `T<U>`), é tipo. Uma anotação final entre
 * parênteses, `(default ...)`, não conta. Falso POSITIVO, src/pages/
 * DesignSystemPage.tsx (2026-10-05).
 *
 * Contraexemplos obrigatórios: pipe de copy de verdade continua entrando, com
 * frase em cada lado OU com palavra solta comum (nav de rodapé), porque palavra
 * capitalizada sozinha não é identificador de código. */
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
