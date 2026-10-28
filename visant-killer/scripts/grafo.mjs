/**
 * grafo — quem importa quem, numa passada só, sem dependência.
 *
 * Existe porque duas perguntas do visant-killer não cabem num arquivo:
 *
 *   1. `killer-scan --roots`: um achado num componente de `ui/` importado por 40
 *      telas vale 40 achados. Sem o fan-out, a lista do portão manda consertar
 *      a página que a pessoa abriu primeiro, e o defeito volta na próxima tela
 *      que usa a mesma peça.
 *   2. `ruido-scan` / `porta-repetida`: "duas portas na mesma tela" só é defeito
 *      se as duas aparecem JUNTAS. A rodada 1 do slop killer (2026-10-05) deu 25
 *      achados dessa regra e quase todos eram telas diferentes ou ramos
 *      exclusivos. A mesma tela é, estaticamente, um ancestral comum próximo na
 *      árvore de imports — e isso só se vê com o grafo.
 *
 * O que ele NÃO é: um bundler. Resolve import relativo, alias do tsconfig
 * (`paths`) e o `@/` de Vite como fallback. O que não resolve fica fora do
 * grafo, e fora do grafo quer dizer "não sei", nunca "não importa".
 */

import fs from 'node:fs';
import path from 'node:path';

const IGNORA = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.turbo',
  '.claude', 'worktrees', '.worktrees', 'out', 'storybook-static', '.cache', 'vendor',
  '__tests__', '__mocks__',
]);
const EXT_CODIGO = /\.(tsx|ts|jsx|js|mjs)$/;
const TENTATIVAS = ['', '.tsx', '.ts', '.jsx', '.js', '.mjs', '/index.tsx', '/index.ts', '/index.jsx', '/index.js'];

export const normP = (p) => path.resolve(p).split(path.sep).join('/');

/** Sobe do arquivo até achar `package.json`. Sem achar, a pasta do próprio arquivo. */
export function raizDoProjeto(arquivo) {
  let d = path.dirname(path.resolve(arquivo));
  for (;;) {
    if (fs.existsSync(path.join(d, 'package.json'))) return d;
    const up = path.dirname(d);
    if (up === d) return null;
    d = up;
  }
}

function walk(p, out) {
  let st;
  try { st = fs.statSync(p); } catch { return out; }
  if (st.isFile()) {
    if (EXT_CODIGO.test(p) && !/\.d\.ts$/.test(p)) out.push(normP(p));
    return out;
  }
  for (const e of fs.readdirSync(p)) {
    if (IGNORA.has(e)) continue;
    walk(path.join(p, e), out);
  }
  return out;
}

/** `paths` do tsconfig, lido como JSON com comentário e vírgula sobrando. */
function aliases(raiz) {
  const out = [];
  for (const nome of ['tsconfig.json', 'tsconfig.app.json', 'jsconfig.json']) {
    const f = path.join(raiz, nome);
    if (!fs.existsSync(f)) continue;
    try {
      const txt = fs.readFileSync(f, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:"])\/\/[^\n]*/g, '$1')
        .replace(/,(\s*[}\]])/g, '$1');
      const co = JSON.parse(txt).compilerOptions ?? {};
      const base = path.resolve(raiz, co.baseUrl ?? '.');
      for (const [k, v] of Object.entries(co.paths ?? {})) {
        if (!Array.isArray(v) || !v.length) continue;
        out.push({ prefixo: k.replace(/\*$/, ''), curinga: k.endsWith('*'), alvo: path.resolve(base, v[0].replace(/\*$/, '')) });
      }
    } catch { /* tsconfig ilegível: segue com o fallback */ }
  }
  /* `@/` → `src/` é a convenção de Vite e Next; vale como último recurso. */
  if (!out.some((a) => a.prefixo === '@/')) out.push({ prefixo: '@/', curinga: true, alvo: path.join(raiz, 'src') });
  /* O mais específico primeiro, igual ao Vite. */
  return out.sort((a, b) => b.prefixo.length - a.prefixo.length);
}

function resolver(spec, deArquivo, als) {
  let base = null;
  if (spec.startsWith('.')) base = path.resolve(path.dirname(deArquivo), spec);
  else {
    for (const a of als) {
      if (a.curinga ? spec.startsWith(a.prefixo) : spec === a.prefixo) {
        base = a.curinga ? path.join(a.alvo, spec.slice(a.prefixo.length)) : a.alvo;
        break;
      }
    }
  }
  if (!base) return null;
  const k = normP(base);
  if (resolvidos.has(k)) return resolvidos.get(k);
  let achou = null;
  for (const t of TENTATIVAS) {
    const f = base + t;
    try { if (fs.statSync(f).isFile()) { achou = normP(f); break; } } catch { /* tenta a próxima */ }
  }
  resolvidos.set(k, achou);
  return achou;
}
/* Cache de resolução: o mesmo `@/components/ui/button` aparece em 246 arquivos,
   e cada tentativa é um stat no disco (lento em drive de rede). */
const resolvidos = new Map();

/** Comentário vira espaço do mesmo tamanho: import comentado não é import. */
/*
 * UMA passada, da esquerda pra direita — e não duas.
 *
 * A versão em duas passadas (bloco primeiro, linha depois) quebrou na primeira
 * leitura do navConfig real: o comentário de linha `// /community e
 * /community/* NÃO são marketing` tem um `/*` dentro, a passada de bloco o
 * tomou por abertura e apagou tudo até o próximo `*\/`, cinquenta linhas abaixo
 * — com a lista de rotas de login junto. Numa regex só com alternância, quem
 * começa primeiro ganha, que é como o próprio parser do JS decide.
 *
 * O `//` depois de `:` fica (é `http://`, não comentário). A posição de cada
 * caractere é preservada: comentário vira espaço do mesmo tamanho, e
 * `arquivo:linha` continua certo.
 */
export const semComentario = (src) =>
  src.replace(/\/\*[\s\S]*?\*\/|(^|[^:\\])(\/\/[^\n]*)/gm, (m, p1, linha) =>
    linha !== undefined ? p1 + linha.replace(/[^\n]/g, ' ') : m.replace(/[^\n]/g, ' '),
  );

/** Nomes locais que um import cria — é com eles que a tela renderiza `<Nome`. */
function nomesDoImport(clausula) {
  const nomes = [];
  const c = clausula.replace(/\btype\s+/g, '');
  const def = c.match(/^\s*([A-Za-z_$][\w$]*)/);
  if (def && def[1] !== 'type') nomes.push(def[1]);
  const ns = c.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
  if (ns) nomes.push(ns[1]);
  const chaves = c.match(/\{([\s\S]*)\}/);
  if (chaves) {
    for (const parte of chaves[1].split(',')) {
      const m = parte.trim().match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
      if (m) nomes.push(m[2] ?? m[1]);
    }
  }
  return nomes;
}

/** Quantas vezes cada identificador aparece no arquivo — uma passada só. */
const contagem = (s) => {
  const c = new Map();
  for (const m of s.matchAll(/[A-Za-z_$][\w$]*/g)) c.set(m[0], (c.get(m[0]) ?? 0) + 1);
  return c;
};

const cache = new Map();

/**
 * Monta o grafo do projeto que contém `arquivos[0]`.
 *
 * Os nós são TODO arquivo de código sob `src/` (ou `app/`, `pages/`,
 * `components/`, `lib/` quando não há `src`), não só o alvo da varredura:
 * fan-out medido dentro de um recorte mente pra baixo, e um ancestral comum
 * fora do recorte continua sendo a mesma tela. Os arquivos do alvo entram
 * também, para o caso de estarem fora dessas pastas (os fixtures do self-test).
 *
 * Retorna:
 *   deps:      arquivo -> [{ para, lazy, nomes, usado }]
 *   importers: arquivo -> Set(arquivo)   (estático e lazy)
 *   lazyCount: arquivo -> nº de import() dinâmicos (roteador tem muitos)
 *   fonte:     arquivo -> código-fonte
 */
export function montarGrafo(arquivos) {
  const primeiro = arquivos.find(Boolean);
  const raiz = primeiro ? raizDoProjeto(primeiro) : null;
  /*
   * Só pasta de app conhecida. Andar a raiz inteira quando não há `src/` foi
   * descartado na primeira execução: os fixtures moram sob `~/.claude`, que tem
   * `package.json`, e o grafo saía varrendo plugins e transcrições.
   */
  const pastas = !raiz
    ? []
    : fs.existsSync(path.join(raiz, 'src'))
      ? ['src']
      : ['app', 'pages', 'components', 'lib'].filter((d) => fs.existsSync(path.join(raiz, d)));
  /* Sem pasta de app, o grafo é só o que foi passado — e a chave do cache também. */
  const chave = `${raiz ?? '-'}|${pastas.length ? '' : [...arquivos].sort().join('|')}`;
  if (cache.has(chave)) return cache.get(chave);

  const nos = new Set(arquivos.map(normP));
  for (const d of pastas) for (const f of walk(path.join(raiz, d), [])) nos.add(f);
  const als = raiz ? aliases(raiz) : [{ prefixo: '@/', curinga: true, alvo: path.dirname(primeiro ?? '.') }];

  const deps = new Map();
  const importers = new Map();
  const lazyCount = new Map();
  const fonte = new Map();
  for (const f of nos) {
    let src;
    try { src = fs.readFileSync(f, 'utf8'); } catch { continue; }
    fonte.set(f, src);
    const s = semComentario(src);
    const lista = [];
    let ids = null;
    const IMPORT_ESTATICO = /\b(?:import|export)\s+([^'";]*?)\s+from\s+['"]([^'"]+)['"]|\bimport\s+['"]([^'"]+)['"]/g;
    for (const m of s.matchAll(IMPORT_ESTATICO)) {
      const para = resolver(m[2] ?? m[3], f, als);
      if (!para) continue;
      const nomes = m[1] ? nomesDoImport(m[1]) : [];
      /*
       * `usado`: o nome aparece fora do próprio import. Import morto não põe
       * ninguém na tela — caso real da rodada 1: BudgetMachinePage importava um
       * painel que nunca renderizava, e o grafo dizia que as portas dele
       * conviviam com as do formulário.
       */
      /* conta FORA das linhas de import: o caminho `'./BrandCustomizationPanel'`
         repete o nome e fazia todo import morto parecer usado */
      ids ??= contagem(s.replace(IMPORT_ESTATICO, ' '));
      const usado = nomes.some((n) => (ids.get(n) ?? 0) >= 1);
      lista.push({ para, lazy: false, nomes, usado });
    }
    /*
     * Import dinâmico. O nome local vem da atribuição (`const X = lazy(() =>
     * import('./X'))`), e é ele que aparece na rota como `<X />`.
     */
    let nLazy = 0;
    for (const m of s.matchAll(/(?:const\s+([A-Za-z_$][\w$]*)\s*=\s*[^;]{0,80}?)?\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const para = resolver(m[2], f, als);
      if (!para) continue;
      nLazy++;
      lista.push({ para, lazy: true, nomes: m[1] ? [m[1]] : [], usado: true });
    }
    lazyCount.set(f, nLazy);
    deps.set(f, lista);
    for (const d of lista) {
      if (!importers.has(d.para)) importers.set(d.para, new Set());
      importers.get(d.para).add(f);
    }
  }
  const g = { raiz, deps, importers, lazyCount, fonte };
  cache.set(chave, g);
  return g;
}

/** Quantos arquivos importam `arquivo` (estático ou lazy). */
export const fanOut = (g, arquivo) => g.importers.get(normP(arquivo))?.size ?? 0;

/**
 * Arquivo que não serve de "mesma tela": o roteador (cinco ou mais `import()`
 * dinâmicos — cada um é uma rota) e o barril (`index.ts` que só reexporta).
 * Passar por eles como ancestral comum juntaria o app inteiro numa tela só.
 */
export function ehHub(g, f) {
  if ((g.lazyCount.get(f) ?? 0) >= 5) return true;
  if (/\/index\.(ts|js|tsx|jsx)$/.test(f)) {
    const src = g.fonte.get(f) ?? '';
    const linhas = src.split('\n').filter((l) => l.trim() && !/^\s*(\/\/|\/\*|\*)/.test(l));
    if (linhas.length && linhas.every((l) => /^\s*export\b.*\bfrom\b|^\s*export\s*\{|^\s*\}|^\s*[\w$,\s]+$/.test(l))) return true;
  }
  return false;
}

/**
 * Ancestrais de `f` até `prof` níveis, com o filho por onde se chegou.
 * Mapa: ancestral -> filho imediato desse ancestral no caminho até `f`
 * (o próprio `f` mapeia pra si). Só aresta estática E usada conta: rota
 * separada por `import()` é tela separada, e import morto não renderiza nada.
 */
export function ancestrais(g, f, prof = 2) {
  const out = new Map([[f, f]]);
  let fronteira = [f];
  for (let n = 0; n < prof; n++) {
    const prox = [];
    for (const x of fronteira) {
      for (const pai of g.importers.get(x) ?? []) {
        if (out.has(pai) || ehHub(g, pai)) continue;
        const renderiza = (g.deps.get(pai) ?? []).some((d) => d.para === x && !d.lazy && d.usado);
        if (!renderiza) continue;
        out.set(pai, x);
        prox.push(pai);
      }
    }
    fronteira = prox;
  }
  return out;
}

/** Os nomes com que `pai` importa `filho` — é por eles que o JSX o chama. */
export const nomesEm = (g, pai, filho) =>
  (g.deps.get(pai) ?? []).filter((d) => d.para === filho).flatMap((d) => d.nomes);
