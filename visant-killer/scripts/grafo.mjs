/**
 * grafo: who imports whom, in a single pass, with no dependencies.
 *
 * It exists because two visant-killer questions do not fit in one file:
 *
 *   1. `killer-scan --roots`: a finding in a `ui/` component imported by 40
 *      screens is worth 40 findings. Without the fan-out, the gate list says to
 *      fix the page the person opened first, and the defect comes back on the
 *      next screen that uses the same piece.
 *   2. `noise-scan` / `repeated-door`: "two doors on the same screen" is only a
 *      defect if both appear TOGETHER. Round 1 of the slop killer (2026-10-05)
 *      gave 25 findings for this rule and almost all were different screens or
 *      exclusive branches. The same screen is, statically, a close common
 *      ancestor in the import tree, and that is only visible with the graph.
 *
 * What it is NOT: a bundler. It resolves relative imports, tsconfig aliases
 * (`paths`) and Vite's `@/` as a fallback. What it cannot resolve stays out of
 * the graph, and out of the graph means "I don't know", never "doesn't matter".
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

/** Walks up from the file until it finds `package.json`. If none is found, returns null. */
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

/** tsconfig `paths`, read as JSON with comments and trailing commas. */
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
    } catch { /* unreadable tsconfig: continue with the fallback */ }
  }
  /* `@/` -> `src/` is the Vite and Next convention; it applies as a last resort. */
  if (!out.some((a) => a.prefixo === '@/')) out.push({ prefixo: '@/', curinga: true, alvo: path.join(raiz, 'src') });
  /* Most specific first, same as Vite. */
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
    try { if (fs.statSync(f).isFile()) { achou = normP(f); break; } } catch { /* try the next one */ }
  }
  resolvidos.set(k, achou);
  return achou;
}
/* Resolution cache: the same `@/components/ui/button` shows up in 246 files,
   and each attempt is a disk stat (slow on a network drive). */
const resolvidos = new Map();

/** A comment becomes whitespace of the same length: a commented-out import is not an import. */
/*
 * ONE pass, left to right, not two.
 *
 * The two-pass version (block first, then line) broke on the first read of the
 * real navConfig: the line comment `// /community and
 * /community/* are NOT marketing` has a `/*` inside, the block pass took it for
 * an opener and erased everything up to the next `*\/`, fifty lines below,
 * along with the list of login routes. In a single regex with alternation,
 * whoever starts first wins, which is how the JS parser itself decides.
 *
 * A `//` after `:` stays (it is `http://`, not a comment). Each character's
 * position is preserved: a comment becomes whitespace of the same length, and
 * `file:line` stays correct.
 */
export const semComentario = (src) =>
  src.replace(/\/\*[\s\S]*?\*\/|(^|[^:\\])(\/\/[^\n]*)/gm, (m, p1, linha) =>
    linha !== undefined ? p1 + linha.replace(/[^\n]/g, ' ') : m.replace(/[^\n]/g, ' '),
  );

/** Local names an import creates; they are what the screen renders as `<Name`. */
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

/** How many times each identifier appears in the file, in a single pass. */
const contagem = (s) => {
  const c = new Map();
  for (const m of s.matchAll(/[A-Za-z_$][\w$]*/g)) c.set(m[0], (c.get(m[0]) ?? 0) + 1);
  return c;
};

const cache = new Map();

/**
 * Builds the graph of the project that contains `arquivos[0]`.
 *
 * The nodes are EVERY code file under `src/` (or `app/`, `pages/`,
 * `components/`, `lib/` when there is no `src`), not just the scan target:
 * fan-out measured inside a slice under-reports, and a common ancestor outside
 * the slice is still the same screen. The target files are added too, in case
 * they live outside those folders (the self-test fixtures).
 *
 * Returns:
 *   deps:      file -> [{ para, lazy, nomes, usado }]
 *   importers: file -> Set(file)   (static and lazy)
 *   lazyCount: file -> number of dynamic import() calls (a router has many)
 *   fonte:     file -> source code
 */
export function montarGrafo(arquivos) {
  const primeiro = arquivos.find(Boolean);
  const raiz = primeiro ? raizDoProjeto(primeiro) : null;
  /*
   * Known app folders only. Walking the whole root when there is no `src/` was
   * dropped on the first run: the fixtures live under `~/.claude`, which has a
   * `package.json`, and the graph went off scanning plugins and transcripts.
   */
  const pastas = !raiz
    ? []
    : fs.existsSync(path.join(raiz, 'src'))
      ? ['src']
      : ['app', 'pages', 'components', 'lib'].filter((d) => fs.existsSync(path.join(raiz, d)));
  /* Without an app folder, the graph is only what was passed in, and so is the cache key. */
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
       * `usado` (used): the name appears outside its own import. A dead import
       * puts nobody on screen. Real case from round 1: BudgetMachinePage
       * imported a panel that never rendered, and the graph said its doors
       * lived alongside the form's.
       */
      /* count OUTSIDE the import lines: the path `'./BrandCustomizationPanel'`
         repeats the name and made every dead import look used */
      ids ??= contagem(s.replace(IMPORT_ESTATICO, ' '));
      const usado = nomes.some((n) => (ids.get(n) ?? 0) >= 1);
      lista.push({ para, lazy: false, nomes, usado });
    }
    /*
     * Dynamic import. The local name comes from the assignment (`const X =
     * lazy(() => import('./X'))`), and that is what appears in the route as `<X />`.
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

/** How many files import `arquivo` (static or lazy). */
export const fanOut = (g, arquivo) => g.importers.get(normP(arquivo))?.size ?? 0;

/**
 * Files that do not count as "the same screen": the router (five or more
 * dynamic `import()` calls, each one a route) and the barrel (an `index.ts`
 * that only re-exports). Going through them as a common ancestor would merge
 * the whole app into one screen.
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
 * Ancestors of `f` up to `prof` levels, with the child they were reached through.
 * Map: ancestor -> that ancestor's immediate child on the path to `f`
 * (`f` itself maps to itself). Only a static AND used edge counts: a route
 * split by `import()` is a separate screen, and a dead import renders nothing.
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

/** The names `pai` imports `filho` under; the JSX calls it by them. */
export const nomesEm = (g, pai, filho) =>
  (g.deps.get(pai) ?? []).filter((d) => d.para === filho).flatMap((d) => d.nomes);
