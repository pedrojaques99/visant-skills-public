#!/usr/bin/env node
/**
 * ruido-scan — o detector de POLUIÇÃO DE CROMO.
 *
 * Os três detectores que já existiam olham para outra coisa: `impeccable` acha
 * o tell de IA no código, `audit:design` acha token errado, `copy-lint` acha
 * vício de voz numa frase. Nenhum deles enxerga o defeito mais comum de uma
 * tela feita por agente: **a página inteira funcionando, escrita corretamente,
 * com tokens certos, e ainda assim ilegível de tanto texto de apoio.**
 *
 * O caso que gerou este arquivo: cinco salas de uma vitrine foram reconstruídas
 * por cinco agentes em paralelo, cada um seguindo as skills da casa. Todos os
 * portões ficaram verdes. E o usuário abriu a tela e disse "tá cheio de texto
 * ainda, label desnecessária, ruído visual". Contados, eram ONZE blocos de
 * texto antes do primeiro pixel de produto — e a mesma informação aparecia três
 * vezes, em três tamanhos.
 *
 * Por que isso passa por tudo: **cada peça de cromo, sozinha, é defensável.**
 * O rótulo nomeia o trecho. A nota orienta. A instrução ajuda quem chega. O
 * ordinal dá ordem. Nenhuma linha é "errada" — o dano é o SOMATÓRIO, e nenhum
 * linter soma. Agente, em particular, escreve isso por default: ele acabou de
 * decidir uma estrutura e quer que a estrutura apareça, então legenda tudo o
 * que fez. É a assinatura de quem explica o próprio trabalho em vez de
 * entregá-lo.
 *
 * As regras abaixo são as que sobreviveram a casos reais. Cada uma mira um
 * padrão que só é defeito por acumulação, e por isso quase todas têm PISO: uma
 * ocorrência é escolha, três é sintoma.
 *
 * Duas delas (2026-09-11) NÃO são de texto, e entraram porque o texto não era o
 * problema: `realce-que-nao-decide` acha destaque em repouso — o realce que
 * roda uma vez por item e acende a lista inteira — e `porta-repetida` acha a
 * mesma porta de dado nomeada em dois arquivos. A segunda é a primeira regra
 * desta skill que não cabe num arquivo, e o achado que a gerou havia passado
 * pelas sete anteriores, por `tsc`, por `ui:audit` e por 2347 testes.
 *
 * Seis entraram em 2026-10-05 (fase 2 do slop killer no visantlabs-os), todas
 * achadas ABRINDO a tela depois de os detectores darem verde: `capa-sintetica`,
 * `img-de-tile-sem-onerror`, `cascata-por-indice`, `hover-que-levanta`,
 * `grade-de-pontos` e `blur-em-card`. No mesmo dia a `porta-repetida` passou a
 * exigir a MESMA TELA pelo grafo de imports (`grafo.mjs`): de 25 achados quase
 * todos falsos pra 2 reais.
 *
 * Nine more came in on 2026-10-28, from the design-slop signals 47-57 of the
 * catalog: `tag-everywhere`, `italic-headline-word`, `display-serif-tight`,
 * `divider-everywhere`, `opacity-ladder`, `box-in-box`, `code-crumb`,
 * `numbered-section` and `mono-everywhere`. Signals 50 and 54 stay with the eye.
 *
 * Uso:
 *   node ruido-scan.mjs <alvo...>          # arquivos ou pastas
 *   node ruido-scan.mjs --quiet <alvo...>  # só o placar
 *
 * Sai 1 se achou. Achado aqui é CANDIDATO A CORTE, não conserto automático:
 * confirme em arquivo:linha antes de apagar, porque uma dessas linhas pode ser
 * a única que orienta de verdade. A regra de ouro do corte está no
 * `references/slop-catalog.md`, entrada "página que se explica".
 */

import fs from 'node:fs';
import path from 'node:path';
import { montarGrafo, ancestrais, nomesEm, normP, semComentario, semComentario as tirarComentario } from './grafo.mjs';

const args = process.argv.slice(2);
const quiet = args.includes('--quiet');
const targets = args.filter((a) => !a.startsWith('--'));

/*
 * Nada de trabalho no topo — este módulo também é importado.
 *
 * `killer-scan.mjs` importa `scanRuido` daqui, e `import` executa o módulo
 * inteiro. Como a checagem de alvo e a varredura liam `process.argv` no topo,
 * elas enxergavam os argumentos de QUEM IMPORTOU: em
 * `killer-scan --init-report AUDIT.md <alvo>`, o nome do relatório entrava como
 * alvo e o `walk` estourava ENOENT num arquivo que ainda nem tinha sido criado
 * — derrubando o portão inteiro antes do primeiro detector, e justamente no
 * comando que a skill manda rodar primeiro.
 *
 * O guard `executadoDireto` já existia lá embaixo. O problema é que o trabalho
 * acontecia antes dele.
 */
function exigirAlvo() {
  /* `--self-test` roda contra o fixture e não pede alvo. */
  if (!targets.length && !args.includes('--self-test')) {
    console.error('uso: node ruido-scan.mjs [--quiet] <arquivo|pasta>...');
    console.error('     node ruido-scan.mjs --self-test    # trava as regras no fixture');
    process.exit(2);
  }
}

/*
 * O que nunca é tela de produto.
 *
 * `.claude` e `worktrees` entraram depois de rodar num repo de fora: ele tinha
 * duas worktrees de agente versionadas dentro de si, e o mesmo arquivo era
 * contado três vezes. Dezenove achados viravam seis reais, e o placar inflado
 * é pior que o número certo — ele faz o time achar que a dívida é maior do que
 * é e desistir antes de começar.
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

/** Resolve o alvo só quando alguém pede — nunca na importação. Ver `exigirAlvo`. */
const listarArquivos = () => targets.flatMap((t) => walk(path.resolve(t)));

/* ------------------------------------------------------------------ */
/* extração: só o que chega no olho de quem usa                        */
/* ------------------------------------------------------------------ */

/**
 * Texto de JSX e os atributos que viram texto na tela.
 *
 * Deliberadamente NÃO olha comentário, nome de variável nem string de código:
 * o detector morre de falso positivo no primeiro `const label = "clique"` se
 * fizer isso, e detector barulhento é detector que o agente aprende a ignorar.
 */
function extrairTextos(src) {
  const out = [];
  /* uma passada só: `// /community/*` num comentário de linha não abre bloco (ver grafo.mjs) */
  const semComentario = tirarComentario(src)
    /*
     * `<title>` e `<desc>` de SVG são NOME ACESSÍVEL, não cromo visual.
     *
     * Mesmo motivo do `alt` (ver ATTRS abaixo): ninguém enxerga esse texto na
     * tela, ele existe para quem usa leitor de tela. Um detector que mandasse
     * encurtar isso estaria pedindo para piorar a acessibilidade.
     */
    .replace(/<(title|desc)(\s[^>]*)?>[\s\S]*?<\/\1>/g, (m) => m.replace(/[^\n]/g, ' '));

  const linhaDe = (idx) => semComentario.slice(0, idx).split('\n').length;

  /*
   * TEXTO DENTRO DE BLOCO DE CÓDIGO NÃO É FRASE DE TELA — e por isso ganha marca.
   *
   * Falso positivo confirmado na rodada 1 do slop killer (visantlabs-os,
   * 2026-10-05): 14 achados de `mesma-info-dois-tamanhos` na DocsPage, todos
   * dentro de bloco de exemplo — `# Pass your API key in every request` contra
   * `# Pass your API key in the Authorization header`, e listas de endpoint
   * (`POST /api/...`) em seções diferentes. Documentação de API repete o header
   * de autenticação em cada seção DE PROPÓSITO: quem chega por âncora lê só uma.
   *
   * Bloco de código aqui é `<pre>`, `<code>` e elemento com classe `font-*mono`
   * (é assim que esta casa e quase todo repo desenha bloco de exemplo). O texto
   * continua sendo extraído — as outras regras ainda olham —, só leva a marca
   * `codigo`, e a R5 não compara frase marcada.
   */
  const regioesDeCodigo = [];
  for (const m of semComentario.matchAll(/<([A-Za-z][\w.]*)\b((?:[^<>{}]|\{[^{}]*\})*)>/g)) {
    const tag = m[1];
    const attrs = m[2] ?? '';
    if (attrs.trimEnd().endsWith('/')) continue;
    if (!(tag === 'pre' || tag === 'code' || /\bfont-[\w-]*mono\b/.test(attrs))) continue;
    /* fecha na tag de MESMO nome, contando aninhamento */
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
   * ATRIBUTO DE METADADO NÃO CHEGA NO OLHO. `<SEO description=…>` e
   * `<SoftwareApplicationSchema description=…>` repetem a mesma frase por dever
   * (snippet do Google e JSON-LD), e nenhum dos dois aparece na tela. Falso
   * positivo confirmado em BrandingMachinePage:1022 e DocsPage:354 na mesma
   * rodada.
   */
  const TAG_META = /^(SEO|Seo|Helmet|Head|meta|link|\w*Schema|JsonLd\w*|StructuredData\w*|Metadata)$/;
  const metaEm = (idx) => {
    const j = semComentario.lastIndexOf('<', idx);
    if (j === -1) return false;
    const m = semComentario.slice(j, j + 60).match(/^<([A-Za-z][\w.]*)/);
    return !!m && TAG_META.test(m[1]);
  };
  /*
   * Chave de i18n (`placeholder={t('common.search')}`) não é o texto, é o
   * ENDEREÇO dele. Antes desta marca, a palavra "common search" virava frase de
   * tela e a R9 acusou quatro buscas de quatro telas diferentes como a mesma
   * porta — o reuso deliberado de uma chave de vocabulário comum.
   */
  const CHAVE_I18N = /^[\w-]+(\.[\w-]+)+$/;
  const marcas = (idx, t) => ({ codigo: emCodigo(idx), meta: metaEm(idx), chave: CHAVE_I18N.test(t) });

  /*
   * Texto solto entre tags — e a peneira que separa texto de CÓDIGO.
   *
   * Falso positivo confirmado numa rodada real: `React.useState<string | null>`
   * seguido de outra linha com `React.useState<TipoFilter>` casa com o padrão
   * `>…<`, porque genérico de TypeScript usa os mesmos sinais de uma tag. As
   * duas "frases" extraídas eram declarações de estado quase idênticas, e a
   * regra de informação repetida acusou 50% de palavras em comum entre duas
   * linhas de código que ninguém nunca vai ler na tela.
   *
   * Detector que grita no código perde a autoridade que precisa ter quando
   * grita na tela. A peneira: texto de interface não tem `=`, `;`, `=>` nem
   * palavra reservada de JS.
   */
  const CHEIRO_DE_CODIGO = /[;=]|=>|\b(const|let|var|function|return|await|import|export|React|use[A-Z])\w*/;
  /*
   * Duas peneiras a mais, e as duas saíram do MESMO falso positivo confirmado
   * em 2026-08-19 (visant-club, `components/club/Rail.tsx`): a R5 acusou "l.142
   * e l.145 — 50% das palavras em comum" em cima de
   *
   *     () => Array.from(ref.current?.querySelectorAll<HTMLElement>('[data-item]')
   *     ...  Array.from(item.querySelectorAll<HTMLElement>('a[href], button')
   *
   * O `>` do `=>` abre o casamento e o `<` do genérico o fecha, então o trecho
   * extraído foi `Array.from(ref.current?.querySelectorAll` — código puro, que
   * escapou do `CHEIRO_DE_CODIGO` porque não tem `=`, `;` nem palavra
   * reservada. Nenhuma das duas linhas chega no olho de ninguém, e o SKILL.md é
   * explícito: este detector só olha string que chega no olho do usuário.
   *
   *   - **`=>` não é abertura de tag.** Se o caractere antes do `>` é `=`, o
   *     casamento começou numa seta de função, não num fecho de tag.
   *   - **Texto de interface tem parêntese e colchete equilibrados.** Código
   *     cortado no meio de uma chamada quase nunca tem. É genérico o bastante
   *     para pegar o próximo recorte de código sem apertar frase de tela:
   *     "Grátis (por enquanto)" continua passando.
   */
  const arrowFn = (i) => semComentario[i - 1] === '=';
  /*
   * GENERICO DE TS FECHA COM `>` IGUALZINHO A UMA TAG — e abre com `<` igualzinho
   * tambem, entao um par de genericos em linhas vizinhas vira "texto" entre eles.
   * Falso positivo confirmado em 2026-09-21 (liminal-stage, PiscinaDeLuz.tsx:86):
   *
   *     ids:   Array<string | null>(PS1_LAMPS).fill(null),
   *     pesos: Array<number>(PS1_LAMPS).fill(0),
   *
   * O trecho extraido — `(PS1_LAMPS).fill(null), pesos: Array` — tem parenteses
   * equilibrados, nenhum `=`, nenhum `;` e nenhuma palavra reservada. Passou por
   * todas as peneiras e virou "57% das palavras em comum" com a linha de cima.
   *
   * O teste olha pra tras do `>` que abriu o casamento: se ha um `<` casando com
   * ele contendo SO coisa de tipo (identificador, `|`, `&`, `,`, `[]`, `?`, `.`)
   * e antes desse `<` vem um identificador, era um generico. Uma tag de verdade
   * teria `=`, `"` ou `/` ali dentro.
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
   * Atributos que aparecem para a pessoa.
   *
   * Falso positivo confirmado em 2026-08-12 (visant-board, MemberIssuesView):
   * o regex não distingue o ATRIBUTO `title="Fechar"` da ATRIBUIÇÃO
   * `title = "Nenhuma tarefa por aqui ainda";`. E a diferença importa muito
   * para a R5: uma variável guarda um valor por vez, então dois `title = …` em
   * ramos de um `if/else` NUNCA aparecem juntos na tela — acusá-los de "a mesma
   * informação em dois tamanhos" é acusar um empty state de repetir o outro que
   * ele substitui.
   *
   * Dois discriminadores, e um só já resolve o caso:
   *   - declaração: vem depois de `let`/`const`/`var`;
   *   - statement: termina em `;` (atributo JSX nunca termina em ponto e vírgula
   *     — depois dele vem espaço, outro atributo, `/` ou `>`).
   */
  /*
   * O TEXTO ALTERNATIVO NÃO É CROMO — e por isso saiu daqui.
   *
   * Falso positivo confirmado em 2026-08-19 (visant-club,
   * `app/(club)/mural/page.tsx:73`): a R3 acusou de "legenda do que vem" o
   * `alt` de uma ilustração de estado vazio —
   *
   *   alt="Pintura a óleo de uma parede de galeria com várias molduras
   *        penduradas e nenhuma tela dentro delas, e uma escada encostada ao lado"
   *
   * — porque a frase termina em "ao lado". Só que `alt` é descrição de imagem
   * para leitor de tela: é OBRIGATÓRIO, é longo por dever, e NINGUÉM o enxerga
   * na tela. Este detector conta poluição VISUAL; mandar encurtar um `alt` é
   * pedir para piorar a acessibilidade, que é o oposto do que a regra defende.
   *
   * `alt`, `aria-label`, `aria-description(by)` e `<title>`/`<desc>` de SVG
   * saem do escopo DESTE detector. Continuam no escopo do `copy-lint`, que
   * julga voz e não densidade de tela.
   *
   * `title` (atributo) FICA: tooltip aparece para quem enxerga, e tooltip que
   * repete o rótulo ao lado é exatamente o cromo que a R5 caça.
   */
  /*
   * `cap` ENTROU em 2026-09-11, e entrou por um achado que passou pelas sete
   * regras. `<Group cap="link ou arquivo">` é como esta base nomeia seção de
   * painel: é rótulo de tela, tão visível quanto um `title`, e estava fora do
   * escopo do detector. O par que ele formava com um `placeholder` idêntico em
   * outro arquivo (ver R8, `porta-repetida`) era invisível porque METADE DO PAR
   * não era extraída — detector cego de um olho aprova o que não viu.
   *
   * Só casa com string entre aspas, então `cap={40}` (teto numérico, o outro
   * sentido da palavra nesta base) fica de fora.
   */
  /* `(?<![-\w])` é o que impede `aria-label` de entrar por `label` e
     `aria-description` por `description`: `\b` sozinho casa depois do hífen. */
  const ATTRS = /(\blet\s+|\bconst\s+|\bvar\s+)?(?<![-\w])(title|label|placeholder|heading|hint|cap|tese|nota|contexto|titulo|descricao|description)\s*=\s*(?:"([^"]{3,400})"|'([^']{3,400})'|\{\s*["'`]([^"'`]{3,400})["'`]\s*\})(\s*;)?/g;
  for (const m of semComentario.matchAll(ATTRS)) {
    const declaracao = !!m[1];
    const statement = !!m[6];
    if (declaracao || statement) continue; // é código, não atributo de tela
    const t = (m[3] ?? m[4] ?? m[5] ?? '').replace(/\s+/g, ' ').trim();
    if (t && /\p{L}/u.test(t)) out.push({ texto: t, linha: linhaDe(m.index), attr: m[2], ...marcas(m.index, t) });
  }
  /*
   * ATRIBUTO VISÍVEL CUJO VALOR É UMA EXPRESSÃO — o buraco que deixou um achado
   * confirmado passar por sete regras.
   *
   * O `ATTRS` acima só lê string crua (`placeholder="x"`) ou string sozinha
   * entre chaves. Mas o texto de tela raramente é crú num app de verdade:
   *
   *   placeholder={api.set ? `link · vai pra "${api.set}"` : compact ? 'link ou arquivo' : 'url .mp3'}
   *
   * Esse `'link ou arquivo'` é tão visível quanto qualquer outro, e era a metade
   * invisível do par de portas repetidas do jukebox (2026-09-11): a R9 rodou
   * contra o código defeituoso e devolveu zero, porque o lado que digita nunca
   * chegou ao extrator. Detector que lê só o caso fácil aprova o caso real.
   *
   * Aqui cada literal DENTRO do valor do atributo entra, com a linha do próprio
   * literal (não a do atributo — `arquivo:linha` tem que apontar pra palavra).
   * O escopo é a expressão do atributo, com chaves balanceadas e teto de 600
   * caracteres: é onde só existe texto de tela, e por isso não vira a peneira de
   * código que o resto deste arquivo passou três rodadas construindo.
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
    /* string sozinha já foi extraída pelo ATTRS — não conta duas vezes */
    if (/^\s*["'`][^"'`]*["'`]\s*$/.test(expr)) continue;
    for (const lit of expr.matchAll(/"([^"\n]{3,200})"|'([^'\n]{3,200})'|`([^`$\n]{3,200})`/g)) {
      const t = (lit[1] ?? lit[2] ?? lit[3] ?? '').replace(/\s+/g, ' ').trim();
      if (!t || !/\p{L}/u.test(t)) continue;
      if (CHEIRO_DE_CODIGO.test(t)) continue;
      out.push({ texto: t, linha: linhaDe(ini + lit.index), attr: m[1], ...marcas(m.index, t) });
    }
  }
  /*
   * DEDUPE por linha+texto: as duas passadas de atributo podem tocar a mesma
   * string, e uma string duplicada viraria um PAR pra R5 ("a mesma informação
   * em dois tamanhos") — o detector acusando a si mesmo de repetir.
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
/* as regras por arquivo                                               */
/* ------------------------------------------------------------------ */

const REGRAS = [];

/*
 * R1 — rótulo gritado.
 *
 * `font-mono text-micro uppercase tracking-wider text-muted-foreground` numa
 * linha só é uma escolha de tipografia. Cinco delas empilhadas numa página é o
 * tell de dashboard genérico: cada trecho anuncia o próprio nome em caixa-alta
 * antes de mostrar qualquer coisa. Apple agrupa com espaço e hierarquia de
 * corpo; template agrupa com etiqueta.
 *
 * Piso de 3 no arquivo, porque um cabeçalho de tabela ou um eyebrow único é
 * legítimo e comum.
 */
REGRAS.push({
  id: 'rotulo-gritado',
  descricao: 'rótulo em caixa-alta + tracking + corpo micro, repetido na mesma tela',
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
 * R2 — texto que ensina a usar.
 *
 * "Clique para abrir a ficha", "arrasta um cartão pra outra coluna", "passe o
 * mouse". Instrução de uso é o que se escreve quando a tela não se explica — e
 * quase sempre a tela SE explica, e a frase só estava ali porque quem construiu
 * queria ter certeza de que o trabalho seria notado.
 *
 * Sem piso: uma só já é sintoma, e é barata de confirmar.
 *
 * **A regra foi ESTREITADA depois de rodar em três repos de fora.** A primeira
 * versão aceitava verbo solto (`escolha`, `selecione`, `digite`, `choose`,
 * `select`, `enter`) e caía em duas armadilhas que só aparecem fora da casa:
 *
 * - **Colisão de língua.** "Supabase Service **Role** Key" virava achado porque
 *   `role` é o imperativo de "rolar" em português. "Scale down slightly on
 *   **click**" idem, com `click` sendo substantivo. Num repo bilíngue isso é
 *   constante, e detector que erra 40% é detector que o time desliga.
 * - **Rótulo de formulário não é cromo.** "Choose the model shown on the
 *   Overview tab" descreve o que o campo faz; é a função do rótulo. A regra
 *   mira instrução ao lado de um controle que JÁ se explica, não a etiqueta que
 *   explica um campo que não tem como se explicar sozinho.
 *
 * O núcleo de alta precisão que sobrou: o verbo precisa vir colado ao
 * MECANISMO (clique **para**, arraste **o**, role **a**, click **to**, drag
 * **the**, hover over). Verbo sozinho não basta.
 *
 * Exceção legítima e conhecida: primeiro uso de um gesto que não tem
 * afordância nativa (arrastar um canvas, atalho de teclado). Aí a instrução
 * fica, com o motivo escrito na linha.
 */
REGRAS.push({
  id: 'ensina-a-usar',
  descricao: 'frase que ensina a operar um controle que já tem afordância',
  piso: 1,
  texto: true,
  achar(textos) {
    /*
     * Bilíngue de propósito.
     *
     * A primeira versão só falava português, e num repo em inglês ela acharia
     * zero — o que é PIOR do que não rodar, porque um detector que devolve zero
     * passa por tela limpa. O padrão desta regra não é linguístico, é de
     * postura: imperativo dirigido a quem lê, mandando operar um controle. Isso
     * existe igual nas duas línguas, e um repo brasileiro costuma ter as duas
     * (peça de terceiro vem com copy em inglês de fábrica — foi assim que um
     * `StoreStatus` chegou dizendo "Open now until 18h" no topo da dobra mais
     * cara de uma landing brasileira).
     */
    const GESTO =
      /(\bclique (para|aqui|no|na|em)|\bclica (no|na|em|aqui)|\baperte (o|a|para)|\barrast[ae] (o|a|um|uma|para|pra)|\barraste-?o\b|\bsolt[ea] (o|a|aqui|fora)|\bpasse o mouse|\bpassa o mouse|\brole (a|o|as|os|at[ée]|para|pra)|\bclick (to|here|on the|and)|\btap (to|here)|\bdrag (the|it|a|to|and)|\bdrop (it|the|here)|\bhover over|\bscroll (to|down to|up to))/i;
    /*
     * Verbo entre aspas é EXEMPLO, não instrução.
     *
     * Falso positivo confirmado numa rodada real: o placeholder de uma busca
     * tolerante a acento dizia `tente "animacao", "vintage", "arrastar"`. As
     * três palavras são termos de teste — a peça está provando que acha
     * "animacao" sem o til —, e "arrastar" ali não manda ninguém arrastar
     * nada. Um `audit-ignore` no arquivo esconderia o próximo caso; a regra é
     * que estava mal escrita.
     */
    const semExemplos = (s) => s.replace(/["“”'‘’][^"“”'‘’]{1,40}["“”'‘’]/g, ' ');
    /*
     * Imperativo manda; oração subordinada descreve.
     *
     * "Role a lista e a barra gruda" é instrução. "AO ROLAR, a barra gruda" é a
     * mesma informação sem mandar em ninguém — é descrição de comportamento, que
     * é justamente o que uma ficha de componente deve dizer. A regra existe para
     * matar o dedo em riste, não a frase declarativa; sem esta peneira ela
     * empurraria toda documentação de peça para a voz passiva.
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
 * R3 — legenda do que vem a seguir.
 *
 * "As dez peças abaixo cobrem…", "veja a seguir", "o gráfico ao lado mostra".
 * A frase narra o que a própria página mostra dois centímetros depois. É o
 * texto mais caro de uma tela: ocupa o lugar nobre para dizer o que o
 * conteúdo diria sozinho, e envelhece na primeira vez que alguém reordena a
 * página (aí ela mente).
 */
REGRAS.push({
  id: 'legenda-do-que-vem',
  descricao: 'frase que narra o conteúdo que aparece logo em seguida',
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
 * R4 — verbo repetido por item.
 *
 * Uma lista de cinco peças em que cada nome vem seguido da palavra `add`
 * escreve `add` cinco vezes na mesma faixa. A segunda já não informa nada, e
 * da terceira em diante é textura. O conserto é sempre o mesmo: a ação vira
 * ícone (largura de um caractere) ou aparece no hover e no foco.
 *
 * Detecta string curta e constante renderizada DENTRO de um `.map(`.
 */
REGRAS.push({
  id: 'verbo-por-item',
  descricao: 'palavra de ação constante repetida uma vez por item de lista',
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
            amostra: `"${t[1]}" por item`,
          });
        }
      }
    }
    return out;
  },
});

/*
 * R6 — seta desenhada, nas duas formas.
 *
 * LEI da casa, escrita depois de aparecer em repo atrás de repo: **ícone é
 * ativo de biblioteca, nunca caractere e nunca SVG à mão.**
 *
 * O caso A é o glifo (`→`, `←`, `↑`, `↓`, e a família de variantes). É o vício
 * nº 1 do Claude, e passa por todo linter porque, para o compilador, é só uma
 * letra. Os defeitos são de tipografia, não de gosto:
 *
 * - herda a métrica da fonte do texto, então desalinha da linha de base do
 *   rótulo ao lado, e o desalinho muda com a família;
 * - não tem peso nem tamanho controláveis (`weight`, `size`), então não
 *   acompanha a hierarquia da tela;
 * - muda de desenho conforme a fonte instalada, e some para fonte sem o
 *   glifo, virando tofu;
 * - o leitor de tela lê como texto, não como decoração.
 *
 * O caso B é o `<svg>` desenhado na mão dentro do componente. Mira ESTREITO,
 * na única assinatura de alta precisão: `viewBox` na grade universal de ícone
 * (`0 0 16 16`, `0 0 20 20`, `0 0 24 24`). Ninguém desenha logotipo de marca
 * nessa grade — quem usa essa caixa está redesenhando um ícone que já existe
 * em qualquer biblioteca. SVG de marca, grafismo e ilustração têm viewBox
 * próprio e não são tocados de propósito: a regra só acusa o que é
 * substituível por um import.
 *
 * Sem piso: uma só já é a lei violada, e é barata de confirmar.
 *
 * Exceção legítima, com o motivo escrito na linha, como toda exceção desta
 * skill: glifo dentro de bloco de código de exemplo ou de documentação, e
 * seta como conteúdo de dado do próprio cliente (uma linha do tempo escrita
 * como "Exatas → engenharia"). Nos dois casos a seta é texto de verdade, não
 * cromo de interface.
 */
const SETA_GLIFO = /[←-⇿⟰-⟿⤀-⥿⬀-⬑➜-➾]/u;

/*
 * Vai no CÓDIGO, não no texto extraído — e isso é um conserto, não uma
 * preferência. A primeira versão usava `texto: true` e pegava `← Voltar`, mas
 * deixava passar `<span aria-hidden="true">→</span>`: o extrator descarta nó de
 * um caractere só, que é justamente a forma MAIS comum do vício. Um detector
 * que erra o caso dominante é pior que nenhum, porque devolve zero e o zero
 * parece aprovação.
 *
 * Comentário sai antes de casar, senão a própria documentação desta regra
 * (que precisa citar os glifos para ser legível) viraria achado.
 */
REGRAS.push({
  id: 'seta-glifo',
  descricao: 'seta em caractere onde deveria haver ícone de biblioteca',
  piso: 1,
  achar(src) {
    /* Troca comentário por espaço do mesmo tamanho: mata o falso positivo sem
       deslocar nenhuma linha, então o número de linha do achado continua certo. */
    const limpo = src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) =>
      m.replace(/[^\n]/g, ' ')
    );
    const out = [];
    const RE = new RegExp(SETA_GLIFO.source, 'gu');
    /*
     * GLIFO DE TECLA NAO E SETA DE NAVEGACAO — falso positivo confirmado em repo
     * real (liminal-stage: `<kbd>↵</kbd>`, `hint="⇧i"`). O simbolo impresso na
     * tecla e a unica grafia que casa com o objeto fisico; nenhum icone de
     * biblioteca substitui "a tecla Enter" sem virar uma seta generica.
     *
     * O teste e de vizinhanca, nao de caractere: dentro de `<kbd>`, ou numa
     * propriedade que nomeia tecla/atalho. Fora disso, a seta continua sendo o
     * vicio que a regra existe pra pegar.
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

REGRAS.push({
  id: 'icone-desenhado-a-mao',
  descricao: 'SVG de ícone escrito no componente em vez de importado',
  piso: 1,
  achar(src) {
    const out = [];
    const GRADE = /<svg[^>]*viewBox\s*=\s*["']0 0 (16 16|20 20|24 24)["']/g;
    for (const m of src.matchAll(GRADE)) {
      out.push({
        linha: src.slice(0, m.index).split('\n').length,
        amostra: `viewBox 0 0 ${m[1]}`,
      });
    }
    return out;
  },
});

/*
 * R5 — a mesma informação em dois tamanhos.
 *
 * O defeito estrutural que gerou este detector. Uma tela tinha a tese do
 * produto no cabeçalho, uma "abertura" um pouco abaixo dizendo o mesmo em
 * outras palavras, e a nota do primeiro bloco dizendo pela terceira vez. Cada
 * uma parecia curta e útil; juntas empurravam o produto para baixo da dobra.
 *
 * Compara pares de frases do MESMO arquivo por sobreposição de palavras de
 * conteúdo. Piso alto de similaridade (0.5) e mínimo de 4 palavras para não
 * acusar dois rótulos curtos que por acaso compartilham um substantivo.
 */
/**
 * Abertura de estado vazio, PT e EN. Ver o motivo dentro da R5.
 *
 * Ancorado no começo da frase: "nada" no meio de uma frase ("não deixe nada
 * para depois") não é estado vazio.
 */
const EMPTY_STATE =
  /^\s*(nada|nenhum|nenhuma|sem\s|você\s+não|voce\s+nao|ainda\s+não|ainda\s+nao|no\s|nothing|none|empty|there\s+are\s+no)\b/i;

/**
 * Abertura de mensagem de FALHA, PT e EN.
 *
 * Mesma lógica do estado vazio, por outro motivo: "Não foi possível carregar os
 * comentários" e "Não foi possível carregar os membros" compartilham a fórmula
 * DE PROPÓSITO — é a linguagem consistente da casa para erro, e o que distingue
 * as duas é justamente o complemento. Divergir a fórmula pra escapar do
 * detector deixaria a UI pior.
 */
const FALHA =
  /^\s*(não\s+foi\s+possível|nao\s+foi\s+possivel|erro\s+ao|falha\s+ao|não\s+consegui|nao\s+consegui|couldn'?t|could\s+not|failed\s+to|unable\s+to|something\s+went\s+wrong)\b/i;

/** Atributos que carregam o NOME acessível — o mesmo recado, outro público. */
const NOME_ACESSIVEL = new Set(['title', 'aria-label', 'alt']);

REGRAS.push({
  id: 'mesma-info-dois-tamanhos',
  descricao: 'duas frases da mesma tela dizendo a mesma coisa',
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
       * Fora da comparação: bloco de código (exemplo repetido por seção é dever
       * de doc), metadado (SEO e JSON-LD não aparecem) e chave de i18n (é o
       * endereço do texto, não o texto). Ver as marcas em `extrairTextos`.
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
         * Dois estados VAZIOS nunca aparecem juntos.
         *
         * Falso positivo confirmado em 2026-08-12 (visant-board): "Nada
         * agendado nos próximos 14 dias" contra "Nada seu nos próximos 14
         * dias", e "Nenhuma hora apontada ainda" contra "Nenhuma hora apontada
         * nesta semana". São ramos de um mesmo `if/else` — uma frase SUBSTITUI
         * a outra, e a tela mostra no máximo uma. Acusá-las de repetição é
         * cobrar que estados vazios diferentes usem vocabulário diferente,
         * quando o vocabulário comum é justamente o que os faz reconhecíveis.
         */
        if (a.vazio && b.vazio) continue;
        /* Duas mensagens de FALHA compartilham a fórmula de propósito — ver FALHA. */
        if (a.falha && b.falha) continue;
        /*
         * `title` + `aria-label` com o MESMO texto é o padrão acessível.
         *
         * Falso positivo confirmado no mesmo dia (`PorteMeter`): o medidor de
         * porte põe "Porte médio" nos dois, de propósito — quem passa o mouse
         * descobre o nome, quem usa leitor de tela não ouve "quatro pontos".
         * São o mesmo recado para PÚBLICOS diferentes, não a mesma informação
         * em dois tamanhos. Divergir os dois seria o defeito.
         */
        if (NOME_ACESSIVEL.has(a.attr ?? '') && NOME_ACESSIVEL.has(b.attr ?? '')) continue;
        /*
         * Dois ATRIBUTOS do mesmo elemento não são duas frases da tela.
         *
         * Falso positivo confirmado em 2026-08-12 (liminal-stage, Hub.tsx:153):
         * `placeholder="buscar sala, mapa ou o que está tocando…"` ao lado de
         * `aria-label="buscar sala, mapa ou faixa"` no MESMO <input>. Não são
         * duas frases empilhadas — é um campo só, dito uma vez para quem vê e
         * uma vez para quem ouve, que é o padrão acessível. A pista é a linha
         * repetida no próprio achado ("l.153 e l.153").
         *
         * Escopado por atributo (não por linha crua) de propósito: duas frases
         * de JSX que caibam numa linha só continuam sendo duas frases.
         */
        if (a.attr && b.attr && a.linha === b.linha) continue;
        /*
         * NOME ACESSIVEL IDENTICO EM CONTROLES IRMAOS e simetria, nao repeticao.
         *
         * Falso positivo confirmado em 2026-09-21 (liminal-stage, Inventory.tsx:81):
         *
         *   label={`mover ${label} para a tecla ${(slot ?? 2) - 1}`}
         *   label={`mover ${label} para a tecla ${(slot ?? 0) + 1}`}
         *
         * Sao os botoes "antes" e "depois" do mesmo card. Depois da interpolacao
         * sair, as duas frases ficam com 100% das palavras em comum — e e assim
         * que TEM que ser: dois controles que fazem a mesma coisa em sentidos
         * opostos precisam do mesmo nome. Exigir vocabulario diferente aqui seria
         * pedir que um deles mentisse.
         *
         * O escopo e estreito: so atributo, so 100% igual, so a tres linhas de
         * distancia. Duas frases de TELA iguais continuam sendo achado.
         */
        if (a.attr && b.attr && jacDe(a, b) === 1 && Math.abs(a.linha - b.linha) <= 3) continue;
        const inter = [...a.palavras].filter((w) => b.palavras.has(w)).length;
        const uniao = new Set([...a.palavras, ...b.palavras]).size;
        const jac = inter / uniao;
        if (jac >= 0.5) {
          out.push({
            linha: a.linha,
            amostra: `l.${a.linha} e l.${b.linha} — ${Math.round(jac * 100)}% das palavras em comum`,
          });
        }
      }
    }
    return out;
  },
});

/* ------------------------------------------------------------------ */
/* as regras que o OLHO pegava e o detector não (fase 2, 2026-10-05)   */
/* ------------------------------------------------------------------ */
/*
 * As seis regras abaixo saíram da rodada 1 do slop killer no visantlabs-os.
 * Todas foram achadas ABRINDO a tela, depois de os detectores darem verde — e
 * todas têm assinatura estática barata. O que era julgamento de olho e se
 * repetiu em dezenas de arquivos vira regra; o resto continua sendo olho.
 *
 * Nenhuma delas é de texto: olham o código com comentário apagado (a posição
 * das linhas fica, então `arquivo:linha` continua certo). O `//` depois de `:`
 * sobrevive de propósito — `http://www.w3.org/2000/svg` dentro de um data URI
 * é justamente onde mora a grade de pontos.
 */
const semComentarioCod = semComentario; // uma passada só — ver o porquê em grafo.mjs
const linhaEm = (src, idx) => src.slice(0, idx).split('\n').length;
const janelaDe = (linhas, l, antes, depois) =>
  linhas.slice(Math.max(0, l - 1 - antes), Math.min(linhas.length, l + depois)).join('\n');

/*
 * R10 — capa sintética.
 *
 * Sem imagem, o card inventa uma: degradê com o hash do nome virando matiz
 * (`hsl(${hue} …)`), ou as cores da marca viradas `linear-gradient` no lugar da
 * capa. Os dois casos reais da rodada 1 estavam no grid de marcas e no hero do
 * cockpit, e os dois tinham comentário defendendo a escolha ("nunca cai num
 * cinza padrão"). O problema é o que a tela diz: um card sem asset fica
 * indistinguível de um card COM asset, e a pessoa não sabe o que falta subir.
 * Vazio honesto (ícone + "sem capa") informa; degradê decora.
 *
 * Duas assinaturas:
 *   a. matiz derivada de string — `charCodeAt` no arquivo E `hsl(${…}` ou
 *      `hsla(${…}` interpolado. Avatar com cor por nome é o mesmo vício em
 *      tamanho menor, e cai aqui também.
 *   b. `linear-gradient(` interpolando cor de dado (`colors`, `.hex`, `stops`,
 *      `primary`, `accent`, `c1`) a até 15 linhas de vocabulário de imagem
 *      ausente (`img`, `image`, `cover`, `capa`, `thumb`, `fallback`,
 *      `placeholder`). Gradiente que MOSTRA a paleta da marca (amostra de cor,
 *      swatch de guideline) não tem esse vocabulário perto e passa.
 */
REGRAS.push({
  id: 'capa-sintetica',
  descricao: 'degradê inventado (hash do nome ou cores da marca) no lugar de imagem que não existe',
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
      for (const m of s.matchAll(/\bhsla?\(\s*\$\{/g)) push(linhaEm(s, m.index), 'matiz derivada de hash de string');
    }
    const COR_DE_DADO = /\$\{[^}]*\b(colors?|hex|stops|primary\w*|accent\w*|c[123])\b[^}]*\}/i;
    const IMAGEM_AUSENTE = /\b(img|image|imagem|cover|capa|thumb\w*|fallback|placeholder)\b/i;
    for (const m of s.matchAll(/linear-gradient\(/g)) {
      const l = linhaEm(s, m.index);
      /* até o fim do template (a crase), não até o primeiro `)`: `${colors.join(', ')}` tem parêntese dentro */
      const crase = s.indexOf('`', m.index);
      const trecho = s.slice(m.index, crase > m.index && crase - m.index < 400 ? crase : m.index + 240);
      if (!COR_DE_DADO.test(trecho)) continue;
      if (!IMAGEM_AUSENTE.test(janelaDe(linhas, l, 15, 15))) continue;
      push(l, 'cores de dado viradas degradê perto de imagem ausente');
    }
    return out;
  },
});

/*
 * R11 — imagem de tile sem `onError`.
 *
 * `<img className="object-cover">` (ou com `aspect-*`) sem `onError` é o tile
 * que, com a URL quebrada, vira o ícone de imagem partida do navegador — ou,
 * com `blur-up`, um borrão eterno. Caso real da rodada 1: MasonryCard da
 * /references, com 128 referências apontando pra `/api/local-image?path=Z:\`.
 * O conserto da casa é `<Thumb>` (src/components/ui/Thumb.tsx), que reserva a
 * caixa e cai num vazio honesto; a regra só cobra quem desenhou a `<img>` à mão.
 *
 * Fora da regra: o próprio `Thumb`, tag com spread (`{...props}` pode trazer o
 * `onError`), e `<img>` sem classe de tile (ícone, logo inline, avatar
 * pequeno).
 */
REGRAS.push({
  id: 'img-de-tile-sem-onerror',
  descricao: '<img> de tile (object-cover/aspect) sem onError: URL quebrada vira ícone partido',
  piso: 1,
  achar(src, file) {
    if (/(^|[\\/])Thumb\.(tsx|jsx)$/.test(file ?? '')) return [];
    const s = semComentarioCod(src);
    const linhas = s.split('\n');
    const out = [];
    for (const m of s.matchAll(/<(motion\.img|img)\b/g)) {
      /* fim da tag: primeiro `>` fora de chaves */
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
       * `src` que não quebra: arquivo do próprio usuário ainda no navegador
       * (`preview`, blob, dataURL — a pré-visualização do upload), LQIP de
       * blur-up, e asset do build (caminho a partir de `/public` ou import de
       * imagem). Falso positivo medido na primeira rodada da regra: os widgets
       * de upload das mini-tools e as thumbs fixas da landing.
       */
      const srcExpr = (tag.match(/\bsrc\s*=\s*(\{[^}]*\}|"[^"]*"|'[^']*')/) ?? [])[1] ?? '';
      if (/preview|objectUrl|blob|dataUrl|base64|createObjectURL|lqip|blurData|placeholder/i.test(srcExpr)) continue;
      if (/^["'`{]\s*["'`]?\/(?!\/)/.test(srcExpr) || /^\{\s*`\//.test(srcExpr)) continue;
      const id = srcExpr.match(/^\{\s*([A-Za-z_$][\w$]*)\s*\}$/);
      if (id && new RegExp(`import\\s+${id[1]}\\s+from\\s+['"][^'"]+\\.(png|jpe?g|webp|svg|gif|avif)['"]`).test(s)) continue;
      const l = linhaEm(s, m.index);
      if (/<Thumb\b/.test(janelaDe(linhas, l, 5, 0))) continue;
      out.push({ linha: l, amostra: `<${m[1]}> com object-cover/aspect e sem onError` });
    }
    return out;
  },
});

/*
 * R12 — cascata por índice.
 *
 * `delay: index * 0.05` faz a lista entrar em escadinha. Em tela de TRABALHO
 * (superfície B) é atraso puro: o 30º item espera 1,5s pra aparecer, a cada
 * filtro, a cada volta pra página. É o tell de motion mais comum de agente —
 * ele quer que a lista "ganhe vida" — e o visant-motion já proíbe; faltava a
 * régua.
 *
 * Pega `delay`, `transitionDelay` e `animationDelay` cujo valor multiplica
 * `i`, `idx`, `index` ou `*Index`, em objeto de transição, prop ou template de
 * estilo.
 */
REGRAS.push({
  id: 'cascata-por-indice',
  descricao: 'atraso de entrada multiplicado pelo índice do item (lista em escadinha)',
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
 * R13 — hover que levanta.
 *
 * `hover:-translate-y-1`, `hover:scale-105`, `group-hover:scale-110` na
 * imagem, `whileHover={{ y: -4 }}`. O card que pula ao passar o mouse é o
 * template de landing de 2021 aplicado a tela de trabalho: mexe o layout do
 * vizinho no olho, não existe no toque e não diz nada que a borda não diria.
 * Medido na rodada 1: 26 cards do AdminPage com o mesmo `hover:-translate-y-1`.
 *
 * Escala MENOR que 1 no hover (`hover:scale-95`, `scale-[0.98]`) é afundar, não
 * levantar, e fica de fora — o press-in do Button da casa usa isso no `active:`.
 */
REGRAS.push({
  id: 'hover-que-levanta',
  descricao: 'card/imagem que sobe ou cresce no hover (translate-y negativo, scale > 1)',
  piso: 1,
  achar(src) {
    const s = semComentarioCod(src);
    const out = [];
    const escalaMaior = (v) => {
      const n = v.startsWith('[') ? Number(v.slice(1, -1)) * 100 : Number(v);
      return Number.isFinite(n) && n > 100;
    };
    for (const m of s.matchAll(/(?<![\w-])((?:group-)?hover):(-translate-y-[\w.[\]]+|scale-(\[[\d.]+\]|\d+))/g)) {
      if (m[2].startsWith('scale-') && !escalaMaior(m[3])) continue;
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
 * R14 — grade de pontos como fundo.
 *
 * Textura de pontinhos atrás do conteúdo: `radial-gradient` de 1px repetido com
 * `background-size`, um SVG de `<circle>` em data URI, ou o componente
 * (`GridDots*`, `DotPattern`, `DotGrid`). É o papel quadriculado de todo
 * template de IA, e na rodada 1 estava em três lugares ao mesmo tempo — o
 * `PageShell` (todas as páginas), o fallback de capa e o admin. Apagado do DS
 * (GridDotsBackground morreu com 0 usos); a regra impede que volte.
 *
 * `radial-gradient` de BRILHO (elipse grande, sem `background-size`) é outra
 * coisa e passa.
 */
REGRAS.push({
  id: 'grade-de-pontos',
  descricao: 'textura de pontos como fundo (radial-gradient repetido, SVG de círculo, GridDots)',
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
      if (repetido && ponto) push(m.index, 'radial-gradient de ponto repetido com background-size');
    }
    for (const m of s.matchAll(/data:image\/svg\+xml[^\n]{0,400}?(?:%3Ccircle|<circle)/gi)) push(m.index, 'SVG de círculo em data URI como textura');
    return out;
  },
});

/*
 * R15 — blur em card.
 *
 * `backdrop-blur` só faz sentido quando HÁ algo passando por baixo: diálogo,
 * popover, folha lateral, barra fixa ou grudada, peça flutuando sobre o canvas.
 * Num card no fluxo da página, em cima de fundo chapado, ele não borra nada —
 * só custa GPU e assina "glassmorphism de template". A casa já decidiu isso no
 * `GlassPanel` (default `flat`, blur só com `intensity` explícito) e no SSoT
 * de glass (blur só em painel); a regra cobra o resto do repo.
 *
 * Fica de fora o que sobrepõe: classe com `fixed`, `sticky` ou `absolute` (no
 * elemento ou nas 6 linhas acima, onde mora o `cn(` partido e o pai
 * `fixed inset-0` do card de modal), e contexto de overlay pelo NOME — da tag
 * vizinha, do componente que contém a linha ou do arquivo (Dialog, Sheet,
 * Popover, Overlay, Modal, Dropdown, Menu, Tooltip, Toast, HoverCard, Command,
 * Palette, Drawer, Select, Lightbox, Fullscreen). A primeira versão olhava só a
 * vizinhança e acusava o próprio `Modal.tsx` e o `SelectContent` do DS.
 */
REGRAS.push({
  id: 'blur-em-card',
  descricao: 'backdrop-blur em elemento no fluxo (não é dialog/sheet/popover/overlay fixo)',
  piso: 1,
  achar(src, file) {
    const OVERLAY =
      /(Dialog|Sheet|Popover|Overlay|Modal|Dropdown|Menu|Tooltip|Toast|HoverCard|Command|Palette|Drawer|Backdrop|Select|Combobox|Popup|Lightbox|Fullscreen|toast)/;
    /* O arquivo inteiro É o overlay (Modal.tsx, select.tsx, CommandPalette.tsx). */
    const base = path.basename(file ?? '').replace(/\.\w+$/, '');
    if (OVERLAY.test(base.charAt(0).toUpperCase() + base.slice(1))) return [];
    const s = semComentarioCod(src);
    const linhas = s.split('\n');
    const out = [];
    const SOBREPOE = /(?<![\w-])(fixed|sticky|absolute)(?![\w-])/;
    /* componente que contém a linha: `function X(` ou `const X = (` acima dela */
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
       * 10 linhas acima pro posicionamento: o botão de ação sobre a imagem do
       * card herda o `absolute` do grupo que o contém, e o pai `fixed inset-0`
       * do card de modal costuma estar ali. 6 pro nome de overlay.
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
/* execução                                                            */
/* ------------------------------------------------------------------ */

/**
 * Exceção com motivo escrito — e só assim.
 *
 * Um portão que fica vermelho no caso legítimo é um portão que o time aprende a
 * ignorar, e aí ele para de valer para o caso ilegítimo também. Mas a saída
 * NÃO pode ser um `ignore` mudo por valor: isso esconde o próximo caso, que é a
 * regra escrita no SKILL.md desta skill.
 *
 * O meio-termo que esta casa já usa: a exceção vive, desde que o motivo esteja
 * escrito na linha. Aqui isso vira contrato executável — um comentário nas oito
 * linhas acima do achado, citando a regra pelo nome, libera aquele achado. Quem
 * quiser calar o detector é obrigado a escrever por que, e a próxima pessoa lê
 * o porquê no lugar onde a dúvida aparece.
 *
 * Oito linhas porque um comentário de bloco explicando a decisão costuma ter
 * quatro ou cinco, e ele fica ACIMA do JSX que gerou o achado.
 */
const JANELA_DA_EXCECAO = 8;

/*
 * R8 — o realce que não decide nada.
 *
 * `on: true` escrito à mão dentro da fábrica de um card. Não é erro de sintaxe,
 * não é token errado, não é cromo de texto: é DESTAQUE EM REPOUSO. O caso que
 * gerou a regra (jukebox, 2026-09-11): todo disco que estava na fila vinha
 * `on: true`, e `.tcard.on` acende borda, sombra e nome. Com três discos na
 * caixa e os três na fila, a grade inteira acendia em ciano — e "no ar" ficava
 * indistinguível de "3º na fila". Destaque que destaca tudo não destaca nada, e
 * o único destaque da grade tinha sido gasto num fato que um selo já contava.
 *
 * Por que passa por tudo: `on: true` é uma linha correta. O defeito só existe
 * quando ela roda uma vez POR ITEM — e é justamente o que a janela de lookback
 * procura, não a linha solta.
 *
 * Precisão em vez de volume: a propriedade tem que ter nome de realce, o valor
 * tem que ser o literal `true`, e nas 8 linhas acima tem que haver sinal de
 * FÁBRICA (`.map(`, `=> ({`, `return {`, `card={`). Sem isso, a regra acusaria
 * todo `{ enabled: true }` de config do repo.
 *
 * Exceção legítima e comum: a peça que é uma só na tela e está acesa de
 * propósito (o plano atual numa tabela de preço, a aba montada aberta). Aí o
 * motivo vai escrito, como em toda exceção desta skill.
 */
REGRAS.push({
  id: 'realce-que-nao-decide',
  descricao: 'realce (`on`/`active`/`selected`) fixado em `true` dentro da fábrica de um item',
  piso: 1,
  achar(src) {
    const out = [];
    const linhas = src.split('\n');
    const FABRICA = /\.map\(|\.flatMap\(|=>\s*\(?\{|return\s*\{|card=\{|item=\{|render\w*=\{/;
    /*
     * ARGUMENTO DE CHAMADA NÃO É DESCRITOR DE ITEM — o falso positivo desta
     * regra, confirmado na primeira rodada em repo real (Director.tsx:823):
     *
     *   add: f.screen?.on ? undefined : () => { setScreen({ on: true }) }
     *
     * `on` ali é o interruptor de uma tela de vídeo, e `{ on: true }` é o
     * argumento de um setter. A janela de fábrica casou porque um `=> {` de
     * callback é indistinguível de um `=> ({` de fábrica olhando oito linhas.
     *
     * O discriminador é o caractere: se o `{` que contém a propriedade abre
     * logo depois de `nome(`, é argumento de chamada. `=> ({` passa (antes do
     * parêntese vem `>`, não identificador) e `return {` nunca cai aqui.
     */
    /*
     * SOBE POR TODOS OS NIVEIS, nao so um. A primeira versao olhava a chave
     * imediatamente acima e parava — entao um objeto ANINHADO dentro do
     * argumento escapava do teste e virava achado:
     *
     *   struct({ game: id ? { on: true, tempo: 80 } : null })
     *
     * A chave que contem `on: true` e precedida por `? `, nao por `nome(`, e a
     * regra acusava um setter de config de sala como fabrica de card (confirmado
     * em liminal-stage/Director.tsx:403). Objeto dentro de argumento continua
     * sendo argumento, em qualquer profundidade.
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
        /* `=> ({` e `return {` param aqui: sao fabrica de verdade. `?`, `:`, `,`
           e `[` querem dizer que ainda estamos numa expressao — sobe mais. */
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
 * Exceção de ARQUIVO INTEIRO, para superfície com linguagem visual própria.
 *
 * Existe porque a janela de oito linhas não cobre o caso real: uma área de
 * console/HUD usa caixa-alta + tracking + mono em DEZENAS de lugares, de
 * propósito — `font-mono uppercase tracking-[0.2em]` com rótulos tipo `ID_003`
 * é identidade, não o dashboard genérico que a R1 caça. Medido em 2026-08-12:
 * 40 achados de `rotulo-gritado` no visant-board, todos dentro de
 * `app/admin/agent/**`, e nenhum deles descuido.
 *
 * O motivo continua OBRIGATÓRIO e na mesma linha do marcador — a diferença é o
 * escopo, não a licença. Formato:
 *
 *   // ruido-ignore-file: rotulo-gritado — HUD do agente: mono + caixa-alta é
 *   // a identidade desta área, não etiqueta de dashboard.
 */
function arquivoTemExcecao(src, regraId) {
  const m = src.match(/ruido-ignore-file:(.+)/);
  if (!m) return false;
  const linha = m[1];
  // Precisa citar a regra E ter texto depois dela: marcador mudo não libera.
  const i = linha.indexOf(regraId);
  if (i === -1) return false;
  return linha.slice(i + regraId.length).trim().length > 3;
}

/*
 * O MESMO contrato dos outros quatro portões (scan-ui-scale, scan-ui-slop,
 * scan-lightmode-breakage, scan-design-violations): na linha do achado ou nas
 * oito acima, `EXCEÇÃO ao ruido-scan/<regra>: <motivo>`, e o motivo precisa ter
 * 8+ letras, com uma palavra de 3+ começando na própria linha (pode continuar
 * na seguinte). Antes bastava "EXCEÇÃO" e o nome da regra em qualquer lugar da
 * janela, então `// EXCEÇÃO ao ruido-scan/blur-em-card` mudo liberava o achado
 * e o contrato que este arquivo cobra (quem cala o detector escreve por quê)
 * não era executado. Nome de regra é exato: `blur` não libera `blur-em-card`.
 * Exceção abaixo do achado não vale.
 */
const escapaRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const contaLetras = (s) => (s.match(/\p{L}/gu) ?? []).length;
const RE_EXCECAO = new Map();
function reExcecao(regraId) {
  if (!RE_EXCECAO.has(regraId)) {
    RE_EXCECAO.set(
      regraId,
      new RegExp(
        String.raw`(?:EXCE(?:Ç|C)(?:Ã|A)O|EXCEPTION)\s+ao\s+` +
          String.raw`\x60?(?:ruido-scan/)?${escapaRe(regraId)}(?![\w-])\x60?\s*:\s*(.*)`,
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
    // O motivo pode quebrar pra linha seguinte do comentário; conta as duas.
    const seguinte = k + 1 <= i ? (linhas[k + 1] ?? '').replace(/^\s*(?:\/\/|\*|\/\*|\{\/\*)/, '') : '';
    const cabeca = m[1].replace(/\*\/\}?\s*$/, '');
    if (contaLetras(`${cabeca} ${seguinte}`) >= 8 && /\p{L}{3,}/u.test(cabeca)) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* a regra que só existe ENTRE arquivos                                */
/* ------------------------------------------------------------------ */

/*
 * R9 — duas portas pro mesmo gesto.
 *
 * Esta é a primeira regra desta skill que NÃO cabe num arquivo, e é por isso
 * que o defeito que a gerou passou por tudo.
 *
 * O caso (jukebox, 2026-09-11): a aba "sua caixa" tinha um campo de url que
 * escreve no set da SALA, e o rodapé logo abaixo — que vem de OUTRO arquivo,
 * por chamada de componente — tem um campo de url que escreve na caixa
 * PESSOAL. Mesma forma, os mesmos dois ícones do lado, 40px entre um e outro. E
 * o rótulo de um (`<Group cap="link ou arquivo">`, em JukeboxPanel.tsx) era
 * LITERALMENTE o placeholder do outro (`'link ou arquivo'`, em MyPlaylist.tsx).
 * Bancos diferentes, permissões diferentes, e nada na tela dizia isso: a pessoa
 * lia o mesmo formulário duas vezes e escolhia por sorte.
 *
 * Nenhum detector por arquivo enxerga isso, e nenhuma varredura de componente
 * enxergaria sem resolver a árvore de render. O que É estático e barato: a
 * MESMA string de tela nomeando uma porta de entrada de dado em dois arquivos
 * diferentes. Quando um formulário é genuinamente reusado, o texto vem por
 * prop — ele não é escrito duas vezes.
 *
 * Precisão: exige duas palavras de conteúdo (nunca acusa "salvar", "nome",
 * "buscar"), arquivos diferentes, e que pelo menos um lado seja `placeholder` —
 * o atributo que só existe onde se DIGITA. Rótulo repetido sem campo nenhum é
 * outro assunto, e é da R5, dentro do arquivo.
 *
 * Achado aqui não é "apague um". As duas portas podem ser as duas necessárias:
 * o conserto de hoje foi MUDAR UMA DE LUGAR (o campo da sala virou ação da aba
 * fila), porque o defeito é as duas ocuparem a mesma tela sem dizer qual é
 * qual.
 *
 * E ele tem DUAS FORMAS, as duas úteis, e só quem abre o arquivo sabe qual é:
 *
 *   1. **Duas portas na mesma tela** — o caso do jukebox. Defeito de layout: a
 *      pessoa escolhe por sorte. Conserto: separar ou fundir.
 *   2. **O mesmo nome pra coisas diferentes** — achado na primeira rodada desta
 *      regra: `Director.tsx:1647` chama de "link ou arquivo" a porta das
 *      TEXTURAS de ambiência da sala, e `MyPlaylist.tsx:869` chama de "link ou
 *      arquivo" a porta da sua caixa de MÚSICA. Telas diferentes, então não é o
 *      defeito 1 — é vocabulário: duas coisas com um nome só ensinam a pessoa
 *      que o nome não quer dizer nada.
 *
 * A regra não tenta adivinhar qual das duas é. Ela aponta as duas pontas e
 * exige que alguém abra as duas — que é o único jeito de saber.
 */
const REGRAS_GLOBAIS = [];

/*
 * A FORMA 2 SAIU EM 2026-10-05, e a regra passou a exigir a MESMA TELA.
 *
 * A rodada 1 do slop killer (visantlabs-os) deu 25 achados desta regra, e o
 * julgamento de cada um, arquivo aberto, foi quase todo "não": quatro buscas
 * `t('common.search')` em quatro telas sobre dados diferentes; o formulário de
 * orçamento que devolve o formulário Visant num `return` antecipado (as duas
 * portas nunca coexistem); dois passos de um assistente num ternário; o canvas
 * e a Mockup Machine, que nem são a mesma rota. Regra que erra 9 em 10 ensina o
 * time a pular a seção inteira — e aí o caso do jukebox, que é real, passa.
 *
 * O que ficou:
 *
 *   - **Mesma tela**, aproximada pelo grafo de imports: as duas pontas têm um
 *     ancestral estático comum a no máximo dois níveis (um renderiza o outro,
 *     ou os dois são filhos do mesmo pai). Import lazy não conta — rota
 *     separada por `import()` é tela separada —, e roteador e barril não servem
 *     de pai comum (juntariam o app inteiro).
 *   - **Não exclusivas**: se o pai comum renderiza um dos lados num `return`
 *     antecipado, ou os dois em lados opostos de um ternário, as portas nunca
 *     aparecem juntas.
 *   - **Rótulo de campo de verdade**: o placeholder tem que ser rótulo, não
 *     exemplo de código (`[{"name": …}]` de importação em lote não é campo).
 *   - **Chave de vocabulário comum fica de fora** (`common.*`, `shared.*`):
 *     reusar a palavra "Buscar" é o design system funcionando.
 *
 * O caso "o mesmo nome pra coisas diferentes em telas diferentes" é problema de
 * vocabulário, não de layout; ele continua sendo pergunta do julgamento
 * (references/slop-catalog.md), não de detector.
 */
const VOCABULARIO_COMUM = /^(common|shared|ui|actions|general|global|comum)\./;
const rotuloDeCampo = (t) => !/[{}[\]\n=<>]|":|\\n/.test(t) && conteudo(t).length <= 8;

/** O pai comum renderiza um lado num `return` antecipado, ou os dois num ternário? */
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

/** As duas pontas aparecem juntas? Ver o bloco acima da regra. */
export function mesmaTela(g, a, b) {
  const A = normP(a);
  const B = normP(b);
  const ancA = ancestrais(g, A, 2);
  const ancB = ancestrais(g, B, 2);
  for (const pai of ancA.keys()) {
    if (!ancB.has(pai)) continue;
    const cA = ancA.get(pai);
    const cB = ancB.get(pai);
    /* Mesmo filho dos dois lados: o ancestral comum MAIS BAIXO está abaixo deste. */
    if (pai !== A && pai !== B && cA === cB) continue;
    if (!exclusivos(g, pai, cA, cB)) return true;
  }
  return false;
}

REGRAS_GLOBAIS.push({
  id: 'porta-repetida',
  descricao: 'a mesma porta de dado nomeada em dois componentes que aparecem na mesma tela',
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
        chaves.get(k).push({ file, linha: t.linha, attr: t.attr ?? 'texto' });
      }
    }
    const candidatas = [...chaves].filter(
      ([, oc]) => new Set(oc.map((o) => o.file)).size >= 2 && oc.some((o) => o.attr === 'placeholder'),
    );
    if (!candidatas.length) return [];
    const g = montarGrafo([...porArquivo.keys()]);
    const out = [];
    for (const [k, ocorrencias] of candidatas) {
      /* par a par: só conta o par em arquivos diferentes, com um placeholder, na mesma tela */
      const parceiros = new Map();
      for (let i = 0; i < ocorrencias.length; i++) {
        for (let j = i + 1; j < ocorrencias.length; j++) {
          const x = ocorrencias[i];
          const y = ocorrencias[j];
          if (x.file === y.file) continue; // mesmo arquivo é da R5
          if (x.attr !== 'placeholder' && y.attr !== 'placeholder') continue;
          if (!mesmaTela(g, x.file, y.file)) continue;
          if (!parceiros.has(x)) parceiros.set(x, []);
          if (!parceiros.has(y)) parceiros.set(y, []);
          parceiros.get(x).push(y);
          parceiros.get(y).push(x);
        }
      }
      /* Aponta em TODAS as pontas: um achado que cita uma só manda consertar o
         lado errado — e o lado errado costuma ser o que a pessoa abriu primeiro. */
      for (const [o, outras] of parceiros) {
        const onde = outras.map((x) => `${path.basename(x.file)}:${x.linha}`).join(', ');
        out.push({ file: o.file, linha: o.linha, amostra: `"${k}" como ${o.attr} · na mesma tela que ${onde}` });
      }
    }
    return out;
  },
});

export function scanRuido(files) {
  const achados = [];
  /** texto de tela por arquivo — é o que as regras globais leem (ver R9) */
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
   * As globais rodam DEPOIS, com o mapa inteiro na mão. A exceção escrita
   * continua valendo, conferida em cada ponta do achado no arquivo daquela
   * ponta: o motivo pode estar escrito num lado só ("este é o campo da sala, o
   * outro é o da caixa"), e isso já resolve a dúvida que a regra levanta.
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
 * Rodou pela linha de comando, ou foi importado pelo killer-scan?
 *
 * A comparação óbvia (`import.meta.url` contra `argv[1]` resolvido) mente no
 * Windows: o `pathname` de uma URL de arquivo vem como `/Z:/...`, com barra na
 * frente e barras trocadas, e a igualdade nunca bate. O script então rodava,
 * não imprimia nada e saía 0 — um detector que diz "tudo certo" porque não
 * chegou a olhar, que é o pior modo de falha possível num portão.
 *
 * Comparar o nome do arquivo basta: quem importa isto o faz pelo nome.
 */
const executadoDireto = path.basename(process.argv[1] ?? '') === 'ruido-scan.mjs';

/**
 * `--self-test`: o detector auditado pelo próprio padrão que ele cobra.
 *
 * Os três falsos positivos desta rodada foram consertados arrumando a regra, e
 * a regra da casa manda travar o caso num fixture — senão a próxima pessoa que
 * mexer no regex reabre o buraco sem saber que ele existiu. O fixture declara,
 * por bloco, quantos achados são esperados.
 */
function selfTest() {
  const dir = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'fixtures');
  /*
   * DOIS arquivos, porque a R9 (`porta-repetida`) só existe ENTRE arquivos:
   * rodar o self-test contra um só faria a regra devolver zero pra sempre, e
   * zero num self-test lê como aprovação. O segundo é mínimo de propósito —
   * tudo que entra nele conta pras outras regras também.
   */
  /*
   * `ruido-fase2.tsx` trava as seis regras de 2026-10-05 e os falsos positivos
   * de `mesma-info` em bloco de código e metadado. `porta/` trava a exigência
   * de MESMA TELA da R9: cada arquivo lá é uma ponta, e o grafo de imports
   * entre eles é o caso (return antecipado, ternário, import morto, telas sem
   * relação, vocabulário comum, exemplo de JSON, e o par de irmãos que conta).
   */
  const porta = path.join(dir, 'porta');
  const fixtures = [
    /* `sinais-sujo.tsx` fires every rule for catalog signals 47-57; `sinais-limpo.tsx` is its legitimate twin and must stay silent. */
    ...['ruido-casos.tsx', 'ruido-porta-b.tsx', 'ruido-fase2.tsx', 'sinais-sujo.tsx', 'sinais-limpo.tsx'].map((f) => path.join(dir, f)),
    ...(fs.existsSync(porta) ? fs.readdirSync(porta).filter((f) => f.endsWith('.tsx')).map((f) => path.join(porta, f)) : []),
  ];
  for (const f of fixtures) {
    if (fs.existsSync(f)) continue;
    console.error(`self-test: fixture não encontrado em ${f}`);
    process.exit(2);
  }
  const achados = scanRuido(fixtures);
  const porRegra = achados.reduce((a, x) => ((a[x.regra] = (a[x.regra] ?? 0) + 1), a), {});

  /* O que o fixture promete. Ver os comentários "ESPERADO" dentro dele. */
  const esperado = {
    /* 2 = o imperativo em português + o em inglês. Exemplo entre aspas,
       subordinada (nas duas línguas) e exceção com motivo não contam. */
    'ensina-a-usar': 2,
    'legenda-do-que-vem': 2, // "as dez peças abaixo" + "the three panels below"
    'rotulo-gritado': 3,
    'verbo-por-item': 0,
    /*
     * 2 = o par `title`/`placeholder` no mesmo render + o par de frases de JSX
     * com parêntese equilibrado.
     *
     * Era 0 (só os genéricos de TS, que não podem virar "frase"). Virou 1 em
     * 2026-08-12 junto com o conserto do falso positivo de ATRIBUIÇÃO: sem um
     * positivo no fixture, estreitar o regex de atributos poderia zerar a regra
     * inteira e o self-test aplaudiria — um detector que não detecta nada passa
     * em todo teste negativo.
     *
     * Virou 2 em 2026-08-19: o par de atributos deixou de ser `alt`+
     * `placeholder` (o `alt` saiu do escopo do detector) e passou a ser
     * `title`+`placeholder`, e entrou um segundo positivo — duas frases de JSX
     * com PARÊNTESE equilibrado. Esse segundo existe para que a peneira nova de
     * parêntese desbalanceado não possa ser afrouxada até engolir frase de tela.
     */
    'mesma-info-dois-tamanhos': 2,
    /*
     * 2 = a seta do botão (`→` sozinha num span) + a do link de voltar.
     *
     * Os dois casos existem de propósito: a versão `texto: true` desta regra
     * pegava só o segundo, porque o extrator de texto descarta nó de um
     * caractere. Sem o primeiro travado aqui, alguém reescreve a regra em cima
     * do texto extraído, o self-test aplaude, e o vício mais comum volta a
     * passar.
     */
    'seta-glifo': 2,
    /* 1 = o ícone na grade 24×24. O grafismo de marca (viewBox 0 0 1017 135)
       fica de fora: a regra só acusa o que um import substituiria. */
    'icone-desenhado-a-mao': 1,
    /*
     * 1 = o `on: true` na fábrica do card. Os dois negativos existem pra travar
     * os dois jeitos de a regra virar ruído: o argumento de chamada
     * (`setScreen({ on: true })`, o falso positivo confirmado em Director.tsx)
     * e a peça única acesa de propósito, com o motivo escrito.
     */
    'realce-que-nao-decide': 1,
    /*
     * 4 = as DUAS PONTAS do par do jukebox (`cap` em ruido-casos, que agora
     * renderiza a caixa, e `placeholder` em ruido-porta-b) + as duas pontas do
     * par de irmãos em porta/irmaos-*. São duas por par porque um achado que
     * cita uma ponta só manda consertar o lado errado. Os outros seis casos de
     * porta/ são negativos e precisam continuar em zero.
     */
    'porta-repetida': 4,
    /* fase 2 — ver os ESPERADO em fixtures/ruido-fase2.tsx */
    'capa-sintetica': 2, // hash do nome + cores da marca no lugar da capa
    'img-de-tile-sem-onerror': 2, // <img> e <motion.img> de tile; 5 negativos
    'cascata-por-indice': 2, // delay: index * … e animationDelay `${i * …}`
    /*
     * 7 = os 3 da R13 (-translate-y, group-hover:scale-105, whileHover y<0) + 4
     * do bloco "A EXCEÇÃO ESCRITA PRECISA DE MOTIVO": exceção muda, motivo
     * curto, nome da regra pela metade e exceção abaixo do achado NÃO liberam.
     * Os dois com motivo (numa linha e quebrado em duas) liberam. Com o
     * contrato antigo (só "EXCEÇÃO" + nome na janela) dava 5.
     */
    'hover-que-levanta': 7,
    'grade-de-pontos': 3, // <GridDots…>, radial repetido, SVG de círculo
    'blur-em-card': 1, // o card no fluxo; barra grudada e diálogo ficam fora
    /*
     * Signals 47-57 (2026-10-28): every count below comes from sinais-sujo.tsx
     * alone. sinais-limpo.tsx holds the legitimate twin of each block (below
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
    console.log(`  ${ok ? 'ok  ' : 'FALHA'}  ${regra.padEnd(26)} esperado ${n}, achou ${achou}`);
    /* Na falha, mostra ONDE: contagem errada sem a linha manda caçar no escuro. */
    if (!ok) for (const a of achados.filter((x) => x.regra === regra)) console.log(`           ${path.basename(a.file)}:${a.linha}  ${a.amostra}`);
  }
  /* Regra que achou no fixture e não está no contrato também é falha. */
  for (const regra of Object.keys(porRegra)) {
    if (regra in esperado) continue;
    falhou++;
    console.log(`  FALHA  ${regra.padEnd(26)} fora do contrato, achou ${porRegra[regra]}`);
  }
  console.log(falhou ? `\nself-test: ${falhou} regra(s) fora do esperado.` : `\nself-test: as ${Object.keys(esperado).length} regras batem com o fixture.`);
  process.exit(falhou ? 1 : 0);
}

if (executadoDireto && args.includes('--self-test')) selfTest();

if (executadoDireto) {
  exigirAlvo();
  const arquivos = listarArquivos();
  const achados = scanRuido(arquivos);
  const bar = '-'.repeat(64);
  console.log(`\nruido-scan  alvo: ${targets.join(' ')}`);
  console.log(`arquivos de interface: ${arquivos.length}\n`);

  if (!achados.length) {
    console.log('[OK]  ruído de cromo  zero');
    console.log(bar);
    console.log('Zero aqui NÃO quer dizer tela limpa: este detector conta cromo,');
    console.log('não julga se o que sobrou merece o lugar que ocupa. Abra a tela.');
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
    console.log(`[FALHA]  ${regra.id.padEnd(26)} ${lista.length} achado(s) — ${regra.descricao}`);
    if (!quiet) {
      for (const a of lista.slice(0, 12)) {
        console.log(`           ${a.file}:${a.linha}  ${a.amostra}`);
      }
      if (lista.length > 12) console.log(`           ... e ${lista.length - 12} a mais`);
    }
  }

  console.log(bar);
  console.log(`${achados.length} candidato(s) a corte. Confirme em arquivo:linha antes de apagar:`);
  console.log('uma dessas linhas pode ser a única que orienta de verdade.');
  console.log(bar);
  process.exit(1);
}
