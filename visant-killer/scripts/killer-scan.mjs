#!/usr/bin/env node
/* killer-scan: the visant-killer gate in one command.
 *
 *   node killer-scan.mjs components/admin/finance/MeiTaxCard.tsx
 *   node killer-scan.mjs components/admin/finance app/admin/fiscal
 *   node killer-scan.mjs --quiet <paths>      only the scoreboard and the exit code
 *
 * Runs the three detectors ON THE TARGET (never on the whole repo, or the old
 * debt drowns the new finding) and prints a single scoreboard:
 *
 *   1. npx impeccable detect        generic AI tells
 *   2. npm run audit:design         tokens and raw color (repo without a token gate:
 *                                   built-in fallback, raw hex/rgb/hsl + Tailwind palette)
 *   3. visant-copy's copy-lint      language tics
 *
 * The trick is in 3: running copy-lint straight on a .tsx floods the screen with
 * false positives, because the subtraction minus matches "hyphen as dash" and
 * every code comment matches the dash rule. Here the strings that reach the
 * user's eye are extracted first (JSX text and label props), become a JSON keyed
 * by "file:line", and copy-lint runs on that.
 *
 * Exit 1 if any gate fails. No dependencies: plain node.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir, homedir } from 'node:os';
import { scanRuido } from './noise-scan.mjs';
import { montarGrafo, fanOut, normP, semComentario } from './grafo.mjs';

const args = process.argv.slice(2);
const quiet = args.includes('--quiet');
const selfTest = args.includes('--self-test');
const flagValue = (name) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
};
const reportPath = flagValue('--report');
const initReport = flagValue('--init-report') ?? (args.includes('--init-report') ? 'AUDIT.md' : null);
const targets = args
  .filter((a) => !a.startsWith('--'))
  .filter((a) => a !== reportPath && a !== initReport);

const roots = args.includes('--roots');

if (!targets.length && !selfTest) {
  console.error('usage: node killer-scan.mjs [--quiet] --report AUDIT.md <files-or-folders>');
  console.error('       node killer-scan.mjs --init-report AUDIT.md <target>   (writes the skeleton, one row per ROUTE)');
  console.error('       node killer-scan.mjs --roots <target>                  (root first: shared piece x fan-out)');
  console.error('       node killer-scan.mjs --self-test                       (checks the copy extractor, the route reader and the token fallback)');
  process.exit(2);
}

/* The repo being audited is the nearest folder above the first target that has
   a package.json or .git, not the cwd: run from anywhere, the token gate and
   the npm scripts still read the audited repo. No marker found: cwd. */
function repoRoot(start) {
  let d = resolve(start);
  if (existsSync(d) && !statSync(d).isDirectory()) d = dirname(d);
  for (;;) {
    if (existsSync(join(d, 'package.json')) || existsSync(join(d, '.git'))) return d;
    const up = dirname(d);
    if (up === d) return process.cwd();
    d = up;
  }
}
const ROOT = targets.length ? repoRoot(targets[0]) : process.cwd();
const isWin = process.platform === 'win32';
const npx = isWin ? 'npx.cmd' : 'npx';
const npm = isWin ? 'npm.cmd' : 'npm';
const stripAnsi = (s) => s.replace(/\[[0-9;]*m/g, '');
const norm = (p) => p.split(sep).join('/');

/* ---------- target: expands a folder into a file list ---------- */

const EXT = /\.(tsx|jsx|ts|js|css)$/;
/* `__tests__` is here because the copy extractor read `describe` and `it`
   names as if they were interface text: a test title with a dash became a
   dash finding in a place no user ever reads. Test names are code
   documentation, and code does not follow the voice rule. */
const SKIP_DIR = /^(node_modules|\.next|\.git|dist|build|coverage|__tests__|__mocks__)$/;
/* Same reason for a test placed next to the component (`PianoRoll.test.tsx`):
   on /final (2026-10-09) the `it(...)` names gave 10 arrow and semicolon
   findings, all false; skipping by FOLDER did not see `.test.` files. */
const TESTE = /\.(test|spec)\.[cm]?[jt]sx?$/;

function walk(p, out = []) {
  const st = statSync(p);
  if (st.isDirectory()) {
    for (const name of readdirSync(p)) {
      if (SKIP_DIR.test(name)) continue;
      walk(join(p, name), out);
    }
  } else if (EXT.test(p) && !TESTE.test(p)) {
    /* Always absolute. Storing `relative(ROOT, p)` worked while the target sat
       under the cwd and broke silently when it did not: across drives the
       relative path does not resolve back, and the scan reads no file at all
       while still printing "zero findings". A zero from not looking is worse
       than an error. */
    out.push(norm(p));
  }
  return out;
}

/** Only shortens the path when printing, and only when it really is under the base. */
const disp = (p) => {
  const r = relative(ROOT, p);
  return norm(r && !r.startsWith('..') && !isAbsolute(r) ? r : p);
};

const files = [];
if (!selfTest) {
  for (const t of targets) {
    /* `resolve`, not the raw argument: an agent calling the gate from outside
       passes an absolute Windows path, and the script must treat that as the
       normal case, not the exception. */
    const a = resolve(t);
    if (!existsSync(a)) {
      console.error(`target does not exist: ${t}`);
      console.error(`  (resolved to ${a})`);
      process.exit(2);
    }
    walk(a, files);
  }
}
const uiFiles = files.filter((f) => /\.(tsx|jsx)$/.test(f));

/* Copy also lives in `.ts`, and that was the gate's biggest blind spot.
 *
 * The extractor only looked at `.tsx`/`.jsx`, so a sentence written in a lib and
 * RENDERED by the screen was never scanned. Real case (mockup-store, 2026-08-05):
 * `art-classify.ts` returned a `reason:` string with a dash, and the render panel
 * passed it straight to the user's eye. The gate said "copy zero" with a
 * language tic on screen.
 *
 * Scanning all of `.ts` would be noise (log messages, error keys, CLI text). The
 * rule is the CONTRACT: a string literal assigned to a property that exists to
 * become interface text. Outside this list, `.ts` stays out of the gate. */
const COPY_BEARING_PROP =
  /\b(label|title|placeholder|description|heading|subtitle|tooltip|hint|reason|message|helperText|errorMessage|emptyMessage|cta|caption)\s*:\s*(["'`])((?:[^"'`\\]|\\.)*)\2/g;
const libFiles = files.filter((f) => /\.ts$/.test(f) && !/\.d\.ts$/.test(f));

/* ---------- 1. impeccable ---------- */

function runImpeccable() {
  const r = spawnSync(npx, ['impeccable', 'detect', ...targets], {
    cwd: ROOT, encoding: 'utf8', shell: isWin,
  });
  if (r.error || r.status === null) return { skipped: 'impeccable did not run', findings: [] };
  const out = stripAnsi(`${r.stdout || ''}${r.stderr || ''}`);
  if (/unknown command|not found|command not found/i.test(out)) {
    return { skipped: 'impeccable not installed', findings: [] };
  }
  // Each finding comes out as "path:line" or as a per-file block; what matters
  // for the gate is the error count, so any finding line counts.
  const findings = out
    .split(/\r?\n/)
    .filter((l) => /\[[A-Z_]{3,}\]|✖|error/i.test(l) && l.trim())
    .map((l) => l.trim());
  const clean = r.status === 0 && !findings.length;
  return { skipped: null, findings: clean ? [] : findings };
}

/* ---------- 2. audit:design ---------- */

/* Token gate that lives as a FILE, not as an npm script.
 *
 * Expected format (that of visantlabs-os's `scan-design-violations.mjs`):
 *
 *   ERR [rule-name] message
 *     path/file.tsx:123
 *       <code excerpt>
 *
 * Only `ERR` gates. `WRN` goes to judgment, the same rule as the ✖ parser
 * below, for the same reason: mass warnings become noise and teach people to
 * ignore them.
 */
function runDesignScannerFile() {
  const CANDIDATES = [
    'scripts/scan-design-violations.mjs',
    'scripts/audit-design-system.cjs',
    'scripts/scan-design-tokens.mjs',
  ];
  const found = CANDIDATES.find((rel) => existsSync(join(ROOT, rel)));
  if (!found) {
    return runTokenFallback('repo has no audit:design/lint:design script nor scripts/scan-design-*.mjs');
  }

  /* `--all`: the scanner prints only 5 locations per rule by default, and the
     gate counted at most 5 per rule: a repo with 40 raw rgba showed 5. Only
     scan-design-violations knows the flag; the others run without it. */
  const extra = found.endsWith('scan-design-violations.mjs') ? ['--all'] : [];
  const r = spawnSync(process.execPath, [join(ROOT, found), ...extra], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  const out = stripAnsi(`${r.stdout || ''}${r.stderr || ''}`);

  const findings = [];
  let rule = null;
  let severity = null;
  for (const raw of out.split(/\r?\n/)) {
    const head = raw.match(/^\s*(ERR|ERRO|WRN|WARN)\s+\[([^\]]+)\]/);
    if (head) {
      severity = head[1].startsWith('ERR') ? 'err' : 'wrn';
      rule = head[2];
      continue;
    }
    const loc = raw.match(/^\s+(\S+?):(\d+)\s*$/);
    if (!loc || severity !== 'err') continue;
    /* The scanner sweeps the whole repo and prints paths relative to the cwd;
       the target list is absolute. Resolve both to the same form before
       comparing, or the filter never matches and the gate returns zero on a
       full repo. */
    const f = norm(resolve(ROOT, loc[1]));
    if (files.includes(f)) findings.push(`${disp(f)}:${loc[2]}  ${rule}`);
  }
  return { skipped: null, findings, via: found };
}

/* ---------- 2b. built-in token fallback ----------
 *
 * A repo without `audit:design` (no alias, no scanner file) used to lose one of
 * the four gates: the scoreboard said SKIPPED and anyone running the skill
 * outside the house had no color check at all. This is the minimum that holds
 * in any repo, and it runs ONLY when the repo has no gate of its own (the
 * repo's gate always wins).
 *
 * Conservative on purpose, because a noisy gate teaches people to ignore it:
 *   raw-hex          `#abc` in .css (outside custom-property definitions and
 *                    theme blocks) and, in .tsx/.jsx, only inside an arbitrary
 *                    class (`bg-[#123456]`) or a color string in a style context
 *   raw-rgb-hsl      `rgb(10,...)` / `hsl(210 ...)` with a literal number;
 *                    `hsl(var(--x))` is the right way and is not flagged
 *   tailwind-palette `text-purple-500`, `bg-slate-900`: fixed palette color
 *                    (in .css only via `@apply`). What it means depends on the
 *                    repo, see "token layer" below.
 *
 * Token layer. A palette class is only a bypass when there is something to
 * bypass. vercel/commerce has no semantic color layer and uses Tailwind's
 * default palette AS its design system (`border-neutral-200`, `bg-neutral-50`):
 * the old rule gave it 40 FAILs, one per class, all noise. So:
 *   - token layer present (shadcn `components.json`, semantic color custom
 *     properties such as `--primary` / `--background` / `--color-*` in any
 *     .css, Tailwind v4 `@theme` colors, or semantic keys under `colors` in
 *     tailwind.config): every palette class is a finding, as before;
 *   - no token layer: no per-class finding. ONE aggregated finding only when
 *     the palette is chaotic, more than 3 non-neutral hue families across the
 *     target; otherwise the gate passes and says why in its `via` line.
 *
 * Brand marks need literal colors: raw hex/rgb/hsl is not flagged in files
 * under an `icons/` or `logos/` folder, nor on a `fill` / `stroke` /
 * `stop-color` attribute of a `<path>` or `<polygon>` (glyph geometry). A
 * `<circle>` in a gauge is a chart, not a glyph, and still fires.
 *
 * Left out: token/theme files (`tokens.css`, `theme.css`, `globals.css`,
 * `*-theme.*`, `tailwind.config.*`, a `tokens/` or `theme/` folder), `:root`,
 * `.dark`, `[data-theme]` and `@theme` blocks, comment lines, and any line with
 * a written exception: `EXCEPTION to token-fallback/<rule>: reason` (or the
 * Portuguese `EXCEÇÃO ao token-fallback/<rule>: reason`) on the same line or up
 * to 8 lines above (same contract as the other scanners). The rule ids were
 * Portuguese until 2026-10; exceptions written with the old ids still count.
 */
export const TF_LEGACY_IDS = {
  'hex-cru': 'raw-hex',
  'rgb-hsl-cru': 'raw-rgb-hsl',
  'paleta-tailwind': 'tailwind-palette',
};
const TF_EXT = /\.(tsx|jsx|css)$/;
const TF_DIR_TEMA = /\/(tokens?|themes?)\//i;
const TF_ARQ_TEMA = /(^|[-_.])(tokens?|themes?|globals?|palette|variables)$/i;
const TF_TW_CONFIG = /^tailwind\.config\./i;
const TF_NEUTRAS = ['slate', 'gray', 'zinc', 'neutral', 'stone', 'black', 'white'];
const TF_FAMILIAS = 'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const TF_PREFIXO = '(?:bg|text|border|ring|fill|stroke|from|via|to|outline|decoration|divide|placeholder|caret|accent|shadow)';
const TF_PALETA = new RegExp(`\\b${TF_PREFIXO}-(?:${TF_FAMILIAS})-(?:50|[1-9]00|950)\\b`);
const TF_PALETA_G = new RegExp(`\\b${TF_PREFIXO}-(${TF_FAMILIAS})-(?:50|[1-9]00|950)\\b`, 'g');
const TF_PRETO_BRANCO_G = new RegExp(`\\b${TF_PREFIXO}-(black|white)\\b`, 'g');
const TF_ARBITRARIO = /\b(?:bg|text|border|ring|fill|stroke|from|via|to|outline|decoration|divide|shadow|caret|accent)-\[(?:#[0-9a-fA-F]{3,8}|rgba?\(\s*\d|hsla?\(\s*\d)/;
const TF_COR_STRING = /(['"`])(?:#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|rgba?\(\s*\d[^)'"`]*\)|hsla?\(\s*\d[^)'"`]*\))\1/;
const TF_CONTEXTO_ESTILO = /\b(?:color|colou?r|background|bg|fill|stroke|border|shadow|outline|style)\w*\s*[:=]/i;
const TF_HEX_CSS = /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/;
const TF_FUNC_CSS = /\b(?:rgba?|hsla?)\(\s*\d/;
const TF_BLOCO_TEMA = /(:root|\.dark\b|\[data-theme|@theme)/;
const TF_COMENTARIO = /^\s*(\{\s*)?(\/\/|\/\*|\*)/;
const TF_DIR_ICONE = /\/(icons?|logos?)\//i;
const TF_ATTR_GLIFO = /\b(?:fill|stroke|stopColor|stop-color)\s*=\s*["'{]/;

function arquivoDeTema(f) {
  const n = norm(f);
  const base = n.split('/').pop();
  const stem = base.replace(/\.[^.]+$/, '');
  return TF_DIR_TEMA.test(n) || TF_ARQ_TEMA.test(stem) || TF_TW_CONFIG.test(base);
}

function excecaoTF(lines, i, regra) {
  const ids = [regra, ...Object.keys(TF_LEGACY_IDS).filter((k) => TF_LEGACY_IDS[k] === regra)];
  const re = new RegExp(`(?:EXCE[ÇC][ÃA]O ao|EXCEPTION to) token-fallback/(?:${ids.join('|')})(?![\\w-])`);
  for (let k = Math.max(0, i - 8); k <= i; k++) if (re.test(lines[k])) return true;
  return false;
}

/* `fill="#0D0C22"` on a `<path>`: the nearest opening tag before the
   attribute, looking back at most 12 lines (JSX puts one attribute per line). */
function corDeGlifo(lines, i) {
  const m = lines[i].match(TF_ATTR_GLIFO);
  if (!m) return false;
  for (let k = i; k >= Math.max(0, i - 12); k--) {
    const seg = k === i ? lines[k].slice(0, m.index) : lines[k];
    const tags = [...seg.matchAll(/<([A-Za-z][\w.]*)/g)];
    if (tags.length) return /^(?:motion\.)?(?:path|polygon)$/i.test(tags[tags.length - 1][1]);
  }
  return false;
}

/* ---- token layer detection (on the audited repo, not only on the target) ---- */
const TL_VAR_COR = /(?:^|[{;\s])--(?:color-[\w-]+|background|foreground|primary|secondary|accent|muted|destructive|border|input|ring|card|popover|brand|surface)(?:-[\w-]+)?\s*:/m;
const TL_TW_CORES = /\bcolors\s*:\s*\{[\s\S]{0,3000}?['"]?\b(?:primary|secondary|background|foreground|accent|muted|brand|destructive|surface|border)\b['"]?\s*:/;

function cssDoRepo(dir, out = [], prof = 0) {
  if (prof > 6 || out.length >= 300) return out;
  let nomes;
  try { nomes = readdirSync(dir); } catch { return out; }
  for (const name of nomes) {
    if (SKIP_DIR.test(name) || name.startsWith('.')) continue;
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) cssDoRepo(p, out, prof + 1);
    else if (/\.(css|scss|pcss)$/.test(name)) out.push(p);
  }
  return out;
}

/** Does the repo at `root` have a semantic color layer? `{ present, via }`. */
export function detectTokenLayer(root) {
  if (existsSync(join(root, 'components.json'))) return { present: true, via: 'shadcn components.json' };
  for (const f of cssDoRepo(root)) {
    const m = readFileSync(f, 'utf8').match(TL_VAR_COR);
    if (m) {
      const r = relative(root, f);
      return { present: true, via: `color custom properties in ${norm(r && !r.startsWith('..') ? r : f)} (${m[0].replace(/^[{;\s]+/, '')})` };
    }
  }
  for (const ext of ['js', 'ts', 'cjs', 'mjs']) {
    const f = join(root, `tailwind.config.${ext}`);
    if (existsSync(f) && TL_TW_CORES.test(readFileSync(f, 'utf8'))) {
      return { present: true, via: `semantic colors in tailwind.config.${ext}` };
    }
  }
  return { present: false, via: 'no token layer' };
}

/**
 * Scans the files. Returns `{ achados, hues }`: findings
 * `{ file, linha, regra, amostra }` and the palette families seen
 * (`hues.neutral` / `hues.accent`, family -> count).
 * With `tokenLayer: false`, palette classes are only counted; one aggregated
 * finding (`file: null, linha: 0`) is added when more than 3 accent families
 * show up.
 */
export function scanTokenFallbackFull(lista, { tokenLayer = true } = {}) {
  const achados = [];
  const hues = { neutral: new Map(), accent: new Map() };
  const conta = (fam) => {
    const m = TF_NEUTRAS.includes(fam) ? hues.neutral : hues.accent;
    m.set(fam, (m.get(fam) || 0) + 1);
  };
  for (const f of lista) {
    if (!TF_EXT.test(f) || arquivoDeTema(f)) continue;
    const lines = readFileSync(f, 'utf8').split(/\r?\n/);
    const css = f.endsWith('.css');
    const icone = TF_DIR_ICONE.test(norm(f));
    const pilha = []; // .css only: true when the open block is a theme block
    const acusa = (i, regra) => {
      if (excecaoTF(lines, i, regra)) return;
      if (regra === 'tailwind-palette') {
        for (const m of lines[i].matchAll(TF_PALETA_G)) conta(m[1]);
        for (const m of lines[i].matchAll(TF_PRETO_BRANCO_G)) conta(m[1]);
        if (!tokenLayer || !TF_PALETA.test(lines[i])) return;
      }
      achados.push({ file: f, linha: i + 1, regra, amostra: lines[i].trim().slice(0, 80) });
    };
    lines.forEach((line, i) => {
      if (css) {
        if (TF_COMENTARIO.test(line)) return;
        const corte = line.lastIndexOf('{') + 1;
        const tema = TF_BLOCO_TEMA.test(line);
        for (const ch of line.slice(0, corte)) {
          if (ch === '{') pilha.push(tema);
          else if (ch === '}') pilha.pop();
        }
        const resto = line.slice(corte).replace(/\/\*.*?\*\//g, '');
        if (!pilha.includes(true)) {
          for (const decl of resto.split(/[;}]/)) {
            if (!/^\s*[a-z-]+\s*:/i.test(decl) || /^\s*--/.test(decl)) continue;
            if (TF_HEX_CSS.test(decl)) { acusa(i, 'raw-hex'); break; }
            if (TF_FUNC_CSS.test(decl)) { acusa(i, 'raw-rgb-hsl'); break; }
          }
          if (/@apply/.test(resto) && TF_PALETA.test(resto)) acusa(i, 'tailwind-palette');
        }
        for (const ch of resto) if (ch === '}') pilha.pop();
        return;
      }
      if (TF_COMENTARIO.test(line)) return;
      const marca = icone || corDeGlifo(lines, i);
      if (TF_ARBITRARIO.test(line)) {
        if (!marca) acusa(i, /\[#/.test(line) ? 'raw-hex' : 'raw-rgb-hsl');
      } else if (TF_CONTEXTO_ESTILO.test(line) && TF_COR_STRING.test(line)) {
        if (!marca) acusa(i, /(['"`])#/.test(line.match(TF_COR_STRING)[0]) ? 'raw-hex' : 'raw-rgb-hsl');
      }
      /* black/white never fire on their own; they are only counted, so the
         "N neutral" in the summary is honest. */
      if (TF_PALETA.test(line) || line.search(TF_PRETO_BRANCO_G) !== -1) acusa(i, 'tailwind-palette');
    });
  }
  if (!tokenLayer && hues.accent.size > 3) {
    const lista2 = (m) => [...m].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} x${n}`).join(', ');
    achados.push({
      file: null,
      linha: 0,
      regra: 'tailwind-palette',
      amostra: `no token layer and ${hues.accent.size} accent hue families (more than 3): ${lista2(hues.accent)}; neutral: ${lista2(hues.neutral) || 'none'}`,
    });
  }
  return { achados, hues };
}

/** Findings only. `tokenLayer` defaults to true: every palette class fires. */
export function scanTokenFallback(lista, opts) {
  return scanTokenFallbackFull(lista, opts).achados;
}

const TF_ROTULO = 'killer-scan built-in FALLBACK (raw hex/rgb/hsl, Tailwind palette)';

function runTokenFallback(motivo) {
  const camada = detectTokenLayer(ROOT);
  const { achados, hues } = scanTokenFallbackFull(files, { tokenLayer: camada.present });
  const nota = camada.present
    ? `token layer found (${camada.via}): palette classes bypass it`
    : `no token layer; Tailwind palette used as the design system (${hues.neutral.size} neutral, ${hues.accent.size} accent hues)`;
  return {
    skipped: null,
    via: `${TF_ROTULO}; ${motivo}; ${nota}`,
    findings: achados.map((a) => (a.file
      ? `${disp(a.file)}:${a.linha}  ${a.regra}  ${a.amostra}`
      : `(target)  ${a.regra}  ${a.amostra}`)),
  };
}

function runAuditDesign() {
  const pkgPath = join(ROOT, 'package.json');
  if (!existsSync(pkgPath)) return runTokenFallback('repo has no package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

  /* Not every repo names its token gate `audit:design`. boxy-app calls it
     `lint:design` and the gate said "SKIPPED" with 218 open token findings: a
     silent skip that looks like approval, the same defect as the extractor's
     false negative. Accept the known aliases before giving up. */
  const ALIASES = ['audit:design', 'lint:design', 'design:lint', 'lint:tokens'];
  const scriptName = ALIASES.find((n) => pkg.scripts?.[n]);
  if (!scriptName) {
    /* Not every repo exposes its token gate as an npm script. visantlabs-os
       keeps its own as a FILE (`scripts/scan-design-violations.mjs`), and the
       killer printed "SKIPPED" with the scanner right there: a silent skip that
       looks like approval, the SAME defect the block above had already fixed
       once for npm aliases. Look for the file before giving up. */
    return runDesignScannerFile();
  }

  /* grep-style linter format (`file:line:content`, sections as `--- x ---`).
     This is `lint:design`'s format; `audit:design` falls to the ✖ parser below. */
  if (scriptName !== 'audit:design') {
    const r = spawnSync(npm, ['run', '--silent', scriptName], {
      cwd: ROOT, encoding: 'utf8', shell: isWin,
    });
    const out = stripAnsi(`${r.stdout || ''}${r.stderr || ''}`);
    const findings = [];
    let section = null;
    for (const raw of out.split(/\r?\n/)) {
      const head = raw.match(/^---\s*(.+?)\s*---\s*$/);
      if (head) { section = head[1]; continue; }
      const m = raw.match(/^(\S+?):(\d+):/);
      if (!m) continue;
      /* The linter sweeps the whole repo and prints paths RELATIVE to the cwd;
         the target list is absolute. Resolve both to the same form before
         comparing, or the filter never matches and the gate returns zero token
         findings on a repo full of them. */
      const f = norm(resolve(ROOT, m[1]));
      if (files.includes(f)) findings.push(`${disp(f)}:${m[2]}  ${section || 'token'}`);
    }
    return { skipped: null, findings, via: `npm run ${scriptName}` };
  }

  const r = spawnSync(npm, ['run', '--silent', scriptName, '--', `--file=${targets[0]}`], {
    cwd: ROOT, encoding: 'utf8', shell: isWin,
  });
  const out = stripAnsi(`${r.stdout || ''}${r.stderr || ''}`);

  // Format: header "path.tsx [zone]" then indented findings
  // "✖ [RULE] line 12:34". Only errors (✖) gate; warnings and info go to
  // judgment, not the gate.
  const findings = [];
  let current = null;
  for (const raw of out.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '');
    const header = line.match(/^(\S+\.(?:tsx|jsx|ts|js|css))/);
    if (header) { current = norm(header[1]); continue; }
    const m = line.match(/^\s+✖\s*\[([A-Z_]+)\]\s*line\s*(\d+)/);
    if (m && current && files.includes(current)) {
      findings.push(`${current}:${m[2]}  ${m[1]}`);
    }
  }
  return { skipped: null, findings, via: 'npm run audit:design' };
}

/* ---------- 3. copy: extracts only what the user reads ---------- */

const CLASSY = /(^|\s)(flex|grid|block|inline|absolute|relative|fixed|sticky|truncate|shrink|grow|hidden|rounded|shadow|border|outline|ring|animate-|transition|duration-|ease-|origin-|opacity-|z-|overflow|whitespace|tracking-|leading-|font-|italic|uppercase|lowercase|capitalize|tabular-nums|text-|bg-|from-|via-|to-|fill-|stroke-|w-|h-|min-|max-|p[xytblrse]?-|m[xytblrse]?-|gap-|space-|items-|justify-|self-|place-|col-|row-|order-|basis-|divide-|cursor-|select-|pointer-events|sm:|md:|lg:|xl:|hover:|focus|active:|group|peer|data-\[|aria-\[|\[&)/;

const LABEL_PROPS = /\b(label|title|placeholder|alt|description|heading|subtitle|tooltip|emptyMessage|emptyLabel|confirmLabel|cancelLabel|actionLabel|helperText|errorMessage|aria-label)\s*=\s*(["'])((?:[^"'\\]|\\.)*)\2/g;

/* Code smell that escaped extraction. Without this, `a > 0 ? b : null;` becomes
   "copy" through the JSX text extractor and the gate flags a semicolon on top
   of a ternary expression. */
/* The backtick joined the list for the same reason as the others: it delimits a
   template literal and NEVER appears in text the user reads. Without it, the
   JSX text extractor ate what follows the `>` of a generic with a template
   argument: `querySelector<HTMLMediaElement>(`[src*="id=${id}"]`)` came back as
   copy and the gate flagged a semicolon on a DOM selector. The "loose line"
   branch already blocked backticks; the JSX text branch did not. */
const CODEY = /(=>|===|!==|&&|\|\||\?\?|\{|\}|`)|(^|\s)(const|let|var|return|function|import|export|await|async|typeof|null|undefined|true|false|void|Promise|boolean|props|className|Math|Number|String|Intl)(\s|$|\.|\(|;|,|\|)/;

/** Property access (`prev.year`). A real sentence has a space after the period. */
const PROP_ACCESS = /[a-z]\.[a-z]/i;

/* Three code smells that slipped through `looksLikeCopy` and made the gate
   flag language tics on syntax. Found in the public routes audit (2026-08-03):
     - data URI: `data:${type};base64,${b64}` became copy and the MIME `;` was
       read as a sales-copy semicolon;
     - function call: the JSX text extractor eats what follows the `>` of a
       generic (`useSWR<T>(key)`) and hands over the whole call;
     - type union member: the literal loop captures the text BETWEEN two
       strings (`X["type"]; state: Y["`), and the `];` came along.
   Real copy has no `;base64`, does not glue an identifier to a parenthesis
   (it writes "something (like this)", with a space) and does not close a
   bracket before a comma. */
const DATA_URI = /^data:|;base64/i;
const CALL_EXPR = /\w\(/;
const TYPE_SYNTAX = /\]\s*[;,]/;

/* Call tail, when the identifier ended up on the other side of the cut.
 *
 * `pickList<{ id: string; job: string }>(jobsRaw), [jobsRaw]);`: the `{expr}`
 * mask eats the type argument, the generic's `>` starts looking like a tag
 * close, and what is left AFTER it is `(jobsRaw), [jobsRaw]);`. It starts with a
 * parenthesis, so `CALL_EXPR` (which needs an identifier glued to the `(`) sees
 * nothing: the function name stayed on the left side of the cut. The gate
 * flagged a "sales-copy semicolon" on a `useMemo` line. False positive, found
 * in the sales kanban audit (visant-board, 2026-08-07).
 *
 * `);` and not `)` followed by anything: Portuguese prose uses a parenthesis
 * followed by a comma, and blocking that would kill real copy. Closing a
 * parenthesis and ending with a semicolon is code. */
const CODE_TAIL = /\)\s*;/;

/* TypeScript parameter annotation, when the `>` of a generic in the MIDDLE of
 * the signature becomes a "tag close": `fly(root, flights: Map<string, Tween>,
 * id: string, dir: 'open' | 'close')` handed over `, id: string, dir: 'open' |
 * 'close')` as copy, and the union pipe became "pipe-separator". False
 * POSITIVE, found in the MN Group audit (AboutChapters.tsx, 2026-09-28).
 *
 * Only a primitive type after the colon: "Name: Pedro" is legitimate copy and
 * must not land here. No interface writes "id: string". */
const TS_PARAM = /\b\w+\??\s*:\s*(?:string|number|boolean|unknown|null|undefined)\b/;

/* TypeScript generic leftover read as JSX text: the `>` that closes a type
 * argument becomes a "tag close" and what is glued right after it is a type
 * suffix or a member access, never screen text:
 *   - `Node<FlowNodeData>[] | ((prev: ...` handed over `[] | ((prev: Node` and
 *     the union pipe flagged pipe-separator (visantlabs-os CollaborativeCanvas);
 *   - `(ref as React.MutableRefObject<Konva.Stage | null>).current = node;`
 *     handed over `).current = node;` and flagged a semicolon (KonvaCanvas).
 * Found in wave 4 of the visantlabs-os slop killer (2026-10-05).
 *
 * Only in the JSX text branch, and only at the START of the candidate: `[]`
 * (type array) or a glued `.member`, with or without `)` before it. Prose after
 * an inline tag starts with `). Then` (period and SPACE), and that is still
 * extracted; the fixture locks the counterexample. */
const GENERIC_TAIL = /^(?:\[\]|\)?\.[A-Za-z_$])/;

/* key=value pair separated by semicolons: cookie, header, query string.
   `document.cookie = 'auth_error=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'`
   has letters, has spaces and none of the code smells above: it passed
   `looksLikeCopy` whole and the gate flagged a sales-copy semicolon on a
   `Set-Cookie`. Found in the boxy-app audit (login-form).
   Real copy does not write `key=value;`. */
const KV_STRING = /[A-Za-z_-]+=[^;=]*;/;

/* Object property with a text literal (`description: '...'`).
   The loose-line extractor swallowed the WHOLE line, key name and quotes
   included, and the literal extractor caught the same sentence clean. Since
   dedupe is by exact string, both versions survived and were concatenated: the
   sentence appeared TWICE in the text handed to copy-lint, and every
   repetition rule (`max: 1`, the credibility seal) flagged a repetition with a
   single occurrence. Found in app/perguntas/layout.tsx, a single "tempo real".
   The literal is already covered by the string loop, so the loose line goes. */
const OBJ_PROP = /^\s*['"]?[A-Za-z_$][\w$-]*['"]?\s*:\s*['"`]/;

/* Document title (`metadata.title`, openGraph/twitter). The pipe and hyphen
   there are the SERP and browser-tab convention ("About | Visant® Studio"),
   not the sales-copy dot separator: swapping them for a colon makes the
   product worse. Only the two delimiter rules are waived; emoji, guru and
   seal still apply to the title. `description` is NOT included, it is real
   prose and shows up in the Google snippet. */
const DOC_TITLE_PROP = /^\s*title\s*:\s*['"`]/;
const DOC_TITLE_MARK = '~doctitle';
const DELIMITER_RULES = new Set(['pipe-separator', 'hyphen-as-dash']);

/* copy-lint renamed its rule ids from Portuguese to English (`travessao` is now
   `em-dash`, `bolinha` is `bullet-separator`). Every id this script READS,
   from copy-lint's output or from a product's `.killer-voice.json`, goes
   through this map, so a config written before the rename and an older
   copy-lint install both keep working. Copy of LEGACY_IDS in
   visant-copy/scripts/copy-lint.mjs: copy-lint runs as a child process, so it
   cannot be imported without running it. */
const COPY_LEGACY_IDS = {
  travessao: 'em-dash',
  bolinha: 'bullet-separator',
  'hifen-como-travessao': 'hyphen-as-dash',
  'nao-e-x-e-y': 'pt-not-x-but-y',
  'nao-e-apenas': 'pt-not-just',
  'nao-e-definicao': 'pt-defined-by-negation',
  'nao-se-trata': 'pt-not-about',
  'x-virgula-nao-y': 'pt-trailing-negation',
  'e-sobre': 'pt-is-about',
  'menos-x-mais-y': 'pt-less-x-more-y',
  'mais-que-apenas': 'pt-more-than-just',
  hype: 'pt-hype',
  'abertura-de-guru': 'pt-guru-opener',
  'urgencia-cliche': 'pt-generic-urgency',
  'pipe-separador': 'pipe-separator',
  'ponto-e-virgula': 'semicolon',
  'conector-de-llm': 'pt-llm-connector',
  'selo-de-credibilidade': 'credibility-seal',
};
const copyRuleId = (id) => COPY_LEGACY_IDS[id] || id;

/* ---------- product voice: the same principle as DOC_TITLE, one level up ----------
 *
 * visant-copy's `copy-lint` was written for ONE voice: Visant's sales voice. Run
 * on a product with its own consistent convention, it flags the whole
 * convention, and then the gate asks for 132 rewrites that make the product
 * WORSE, exactly the argument that already existed for the document title above.
 *
 * Found in the liminal-stage record box audit (2026-08-14): 14 findings, all
 * `bolinha` and `travessao` (today `bullet-separator` and `em-dash`), 9 of them
 * on lines the audited work did not touch, and 132 uses of `·` in 26 files committed earlier (`ao vivo · 3`,
 * `em breve · 2d`, `55/120 · limpar`). Not an AI tic; it is that product's beat
 * separator.
 *
 * Opt-in per repository, with a price: a `.killer-voice.json` at the target's
 * root, naming ONLY the rules that product adopted and a real written `motivo`
 * (reason). Without a reason (or with one under 40 characters) the file is
 * ignored and the gate flags again, because that is the difference between an
 * exception and a mute `audit-ignore`, which is what this whole skill exists to
 * prevent.
 *
 * Only DELIMITER rules can be waived. Emoji, guru, seal, sales semicolon and dash
 * in prose still apply: a microcopy convention is a punctuation choice, not a
 * free pass on voice. */
const VOICE_RULES = new Set(['bullet-separator', 'em-dash', 'pipe-separator', 'hyphen-as-dash']);
const productVoice = () => {
  try {
    const cfg = JSON.parse(readFileSync(join(ROOT, '.killer-voice.json'), 'utf8'));
    const motivo = typeof cfg.motivo === 'string' ? cfg.motivo.trim() : '';
    if (motivo.length < 40) {
      return { rules: new Set(), warn: '.killer-voice.json ignored: `motivo` missing or too short (min. 40 characters)' };
    }
    // Old Portuguese ids ("bolinha", "travessao") still work: normalized here.
    const dispensa = (Array.isArray(cfg.dispensa) ? cfg.dispensa : []).map((r) => copyRuleId(String(r)));
    const rules = new Set(dispensa.filter((r) => VOICE_RULES.has(r)));
    const bad = dispensa.filter((r) => !VOICE_RULES.has(r));
    return {
      rules,
      warn: bad.length ? `.killer-voice.json: only delimiter rules can be waived; ignored: ${bad.join(', ')}` : null,
      motivo,
    };
  } catch {
    return { rules: new Set(), warn: null };
  }
};

/* A literal that is ONLY a separator, with no letters at all.
 *
 * `label: cond ? \`${deal.name} · ${deal.client}\` : deal.name`: after
 * masking the interpolation, what is left of the template is " · ". Zero
 * letters, three characters: it died in the first two lines of `looksLikeCopy`
 * (minimum length and `\p{L}`), and the gate said "copy zero" about a dot that
 * went straight into the user's combobox. A false NEGATIVE, which is the
 * serious one: it looks like approval.
 *
 * The rule is narrow on purpose: it only passes if the literal is EXCLUSIVELY
 * punctuation/space AND carries a tic. So `" · "` gets in and `" (%) "` does
 * not; no code becomes a false positive, because a code literal with a dot or
 * dash inside practically does not exist. Found in the CRM Proposals tab audit
 * (visant-board, 2026-08-07).
 *
 * THE SPACE IS PART OF THE RULE, not leftover formatting.
 *
 * Separator and empty placeholder are the same glyph doing opposite jobs: the
 * separator JOINS two values (`a · b`) and so is written with spaces around
 * it, because without spaces it cannot be read; the placeholder REPLACES a
 * missing value (`{v ?? "—"}` in a table cell) and is written bare, because
 * there is nothing to separate. Without this distinction the gate flagged both
 * with the same word and the list became noise: in the /admin audit
 * (visant-board, 2026-08-10), 9 of 16 "separator-only literal" findings were
 * empty-cell dashes, a dense table convention (the same as Linear, Stripe and
 * Vercel), and swapping it for a hyphen worsens the typography.
 *
 * Requiring a space opens no hole in the case that created the rule: the
 * combobox `" · "` still gets in, and a prose `" — "` too. Only the bare glyph
 * goes, which is missing data, not voice. */
const SO_SEPARADOR_COM_VICIO = /^(?=\s*[·—][\s·—]*$)(?=.*\s)[\s·—]+$/;

/* TypeScript union written as prop documentation, the design system page kind:
 * `'left' | 'right'`, `"sm" | "md"`,
 * `number | string (default 1; masonry = natural)`. The pipe is a union
 * operator, not a copy separator, and the gate flagged pipe-separator
 * (src/pages/DesignSystemPage.tsx, 2026-10-05).
 *
 * It is a type when EVERY segment between pipes is a quoted literal, a type
 * word or a code-looking identifier, and at least one is a literal or type
 * word. The trailing parenthesized annotation (`(default 'x')`) is removed
 * before the test. "Code-looking identifier" requires camelCase, `a.b`, `T[]`,
 * `T<U>` or `_`/`$`: a loose capitalized word ("Home | Sobre") is a footer nav,
 * it is copy, and still gets in. See the PropsDoc fixture. */
const TYPE_WORD = /^(?:string|number|boolean|bigint|symbol|object|unknown|any|never|void|null|undefined|true|false|ReactNode|ReactElement|JSX\.Element|Date|File|Blob)(?:\[\])*\??$/;
const TYPE_LITERAL = /^(?:'[^']*'|"[^"]*"|`[^`]*`|-?\d+(?:\.\d+)?)$/;
const CODE_IDENT = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*(?:<[^<>]*>)?(?:\[\])*\??$/;
const CODE_SHAPE = /[a-z][A-Z]|[._$<[]/;
function isTypeUnion(t) {
  if (!t.includes('|')) return false;
  const segs = t
    .replace(/^\s*\|/, '')
    .split('|')
    .map((x) => x.trim().replace(/\s*\([^()]*\)\s*$/, '').trim());
  if (segs.length < 2 || segs.some((x) => !x)) return false;
  let anchored = false;
  for (const x of segs) {
    if (TYPE_LITERAL.test(x) || TYPE_WORD.test(x)) { anchored = true; continue; }
    if (CODE_IDENT.test(x) && CODE_SHAPE.test(x)) continue;
    return false;
  }
  return anchored;
}

/** true if the string looks like interface text, not a className, path or id. */
function looksLikeCopy(s) {
  /* No `trim()` here: the surrounding space is exactly what separates the
     separator (`" · "`, joins two values) from the empty placeholder (`"—"`,
     replaces a value). Trimming before the test erased the evidence and both matched. */
  if (SO_SEPARADOR_COM_VICIO.test(s)) return true;
  const t = s.trim();
  if (t.length < 4) return false;
  if (!/\p{L}/u.test(t)) return false;
  if (CLASSY.test(t)) return false;
  if (CODEY.test(t)) return false;
  if (PROP_ACCESS.test(t)) return false;
  if (DATA_URI.test(t)) return false;
  if (CALL_EXPR.test(t)) return false;
  if (CODE_TAIL.test(t)) return false;
  if (TYPE_SYNTAX.test(t)) return false;
  if (TS_PARAM.test(t)) return false;
  if (isTypeUnion(t)) return false;
  if (KV_STRING.test(t)) return false;
  /* Fewer than two words is not a sentence: kills type signature leftovers
     ("| void;") that escape through the between-tags text extractor.

     The exception exists because JSX copy arrives SPLIT: in
     `<span>{n} à vista · </span>` the leftover fragment is "à vista ·", which
     has a single word and carries exactly the dot the gate should flag. Without
     the exception the detector said zero about a visible separator in the home
     header: a false negative, the serious defect, it looks like approval. A
     fragment carrying a dot or dash counts as copy even with one word. The
     semicolon stayed OUT of the exception: a type signature leftover
     (`(k: string): ;`) ends in `;` and would come back as a false positive (the
     fixture caught that on the first try). Type junk does not get in here
     because CODEY and TYPE_SYNTAX already ran above. */
  const CARREGA_VICIO = /[·—]/;
  if ((t.match(/\p{L}{2,}/gu) || []).length < 2 && !CARREGA_VICIO.test(t)) return false;
  if (/^[./#@]|^https?:|\.(tsx?|jsx?|css|json|svg|png|webp)$/i.test(t)) return false;
  if (/^[a-z0-9_.:-]+$/.test(t) && !/\s/.test(t)) return false; // id, key, slug
  if (!/\s/.test(t) && !/[áàâãéêíóôõúüç]/i.test(t)) return false;
  return true;
}

function extractCopy(file) {
  const raw0 = readFileSync(isAbsolute(file) ? file : join(ROOT, file), 'utf8');
  const src = raw0.split(/\r?\n/);
  const out = {};
  let inBlockComment = false;
  /* Next metadata file: an object `title:` there is a document title. BOTH
     forms count. Only `export const metadata` let the dynamic route through,
     which builds the title in `generateMetadata` with a template
     (`` title: `${name} | Visant® Studio` ``), and that was exactly where the
     gate flagged the most pipes. */
  const isMetadataFile = /export\s+(?:const\s+metadata\b|(?:async\s+)?function\s+generateMetadata\b)/.test(raw0);

  src.forEach((raw, i) => {
    let line = raw;
    if (inBlockComment) {
      const end = line.indexOf('*/');
      if (end === -1) return;
      line = line.slice(end + 2);
      inBlockComment = false;
    }
    line = line.replace(/\/\*[\s\S]*?\*\//g, ' ');
    const open = line.indexOf('/*');
    if (open !== -1) { line = line.slice(0, open); inBlockComment = true; }
    line = line.replace(/(^|\s)\/\/.*$/, '');
    if (!line.trim()) return;

    /* HTML entities go before any rule: the `;` in `&quot;` is not
       punctuation, and the gate flagged a semicolon on correct copy. */
    /* A closed entity list was a guaranteed gap: `&quot;` was there and
       `&ldquo;`/`&rdquo;` were not, so a curly quote in copy flagged a semicolon
       (components/brand/steps/PublishStep.tsx). A named entity is a format, so
       the rule becomes the format. */
    line = line.replace(/&(?:[a-zA-Z][a-zA-Z0-9]{1,10}|#\d+|#x[0-9a-fA-F]+);/g, '"');

    /* Developer output is not interface. `console.debug(`[render] ${ms}ms
       total · ${st}`)`, inside a `NODE_ENV === "development"` block, flagged a
       dot, and a dot in a log is terminal formatting, not a copy tic. No
       `console.*` reaches the user's eye, so the call goes before any
       extraction. It cuts from the call to the end of the line because the call
       runs to the end of the statement, and copy after a console call on the
       SAME line does not exist. Found in the scene operations audit
       (mockup-store, 2026-08-06). */
    const devOut = line.search(/\bconsole\s*\.\s*[a-zA-Z]+\s*\(/);
    if (devOut !== -1) line = line.slice(0, devOut);
    if (!line.trim()) return;

    const key = `${file}:${i + 1}`;
    const found = [];

    /* Mask `{expr}` before looking at JSX text. Without this, the most common
       copy line in the repo escapes whole: `Acima de {fmt(X)} — obrigatória.`
       has a brace and a parenthesis, so the loose-line extractor discards it,
       and the between-tags extractor stops at the `{`. */
    let masked = line;
    for (let k = 0; k < 6; k++) {
      const next = masked.replace(/\{[^{}]*\}/g, '\u0001');
      if (next === masked) break;
      masked = next;
    }

    /* Second mask, interpolation only, and it exists for the literals. The JSX
       mask above eats the whole `{...}`, but real copy lives INSIDE expressions
       (a ternary with two templates, for example): with a single mask the
       ternary's string was never extracted and the gate said "zero" about text
       nobody had checked. Found by the fixture. */
    let interp = line;
    for (let k = 0; k < 6; k++) {
      const next = interp.replace(/\$\{[^{}]*\}/g, ' ');
      if (next === interp) break;
      interp = next;
    }
    const unmask = (s) => s.replace(/\u0001/g, ' ').replace(/\s+/g, ' ').trim();

    /* JSX text: what is left between > and <, or after > at the end of the line.
       A tag's `>` is glued to what precedes it (`<span>`), a comparison's comes
       with a space (`a > 0`), and `=>` and `>=` are excluded by the lookarounds. */
    /* The U+0001 in the lookbehind is the {expr} mask. Without it the extractor
       was blind to the repo's most common button format:
       <button onClick={fn}>Text</button> closes the tag right after the mask, so
       the character before the > is no longer a letter and the whole copy was
       never read. A false NEGATIVE, the serious one: the gate said zero about
       text nobody had checked. Found by the fixture in the Recorder audit
       (jaques-os, 2026-08-05). */
    for (const m of masked.matchAll(/(?<=[A-Za-z0-9"'\]\/_-])>(?!=)([^<>]+)(?=<|$)/g)) {
      /* Cut at the leftover {. Multi-line JSX leaves the expression OPEN at the
         end of the line (`Aperte <b>Gravar</b> — ou {estado?.atalho`), and the
         candidate came with that piece of code glued on; CODEY then discarded
         the whole sentence because of the brace. A false NEGATIVE: a dash
         visible on screen passed the gate and only showed up when someone
         OPENED the page. Found in the Recorder audit (jaques-os, 2026-08-05). */
      const cand = unmask(m[1]).split("{")[0].trim();
      if (GENERIC_TAIL.test(cand)) continue;
      if (looksLikeCopy(cand)) found.push(cand);
    }
    /* Loose multi-line JSX text. The line has no tag to anchor on, so the
       filter is the reverse: no operators and no identifiers. Uppercase
       acronyms pass on purpose (MEI, IRPF, DAS, COFINS are copy). */
    if (!/[<>]/.test(masked) && !/[*?+=;|&`_]|[a-z][A-Z]/.test(masked) && !OBJ_PROP.test(line)) {
      const cand = unmask(masked);
      if (looksLikeCopy(cand)) found.push(cand);
    }
    // label prop
    for (const m of line.matchAll(LABEL_PROPS)) {
      if (looksLikeCopy(m[3])) found.push(m[3]);
    }
    // literal in a template or string inside a render expression
    for (const m of interp.matchAll(/[`'"]([^`'"]{6,})[`'"]/g)) {
      if (looksLikeCopy(m[1]) && /\s/.test(m[1]) && /[a-záéíóúãõç]{3}/i.test(m[1])) {
        found.push(m[1].trim());
      }
    }
    /* The pure separator, which the loop above misses in two ways: it requires
       6 characters and 3 letters in a row, and " · " has neither. See
       SO_SEPARADOR_COM_VICIO. */
    for (const m of interp.matchAll(/[`'"]([^`'"]{1,8})[`'"]/g)) {
      if (SO_SEPARADOR_COM_VICIO.test(m[1])) found.push(m[1]);
    }

    if (found.length) {
      const mark = isMetadataFile && DOC_TITLE_PROP.test(line) ? DOC_TITLE_MARK : '';
      out[key + mark] = [...new Set(found)].join(' ');
    }
  });

  return out;
}

/* `.ts` extraction: only what the contract says becomes screen text. See
   COPY_BEARING_PROP. */
function extractLibCopy(file) {
  const raw0 = readFileSync(isAbsolute(file) ? file : join(ROOT, file), 'utf8');
  const src = raw0.split(/\r?\n/);
  const out = {};
  let inBlockComment = false;

  src.forEach((raw, i) => {
    let line = raw;
    if (inBlockComment) {
      const end = line.indexOf('*/');
      if (end === -1) return;
      line = line.slice(end + 2);
      inBlockComment = false;
    }
    line = line.replace(/\/\*[\s\S]*?\*\//g, ' ');
    const open = line.indexOf('/*');
    if (open !== -1) { line = line.slice(0, open); inBlockComment = true; }
    line = line.replace(/(^|\s)\/\/.*$/, '');
    if (!line.trim()) return;
    line = line.replace(/&(?:[a-zA-Z][a-zA-Z0-9]{1,10}|#\d+|#x[0-9a-fA-F]+);/g, '"');

    const found = [];
    for (const m of line.matchAll(COPY_BEARING_PROP)) {
      const cand = m[3].replace(/\$\{[^{}]*\}/g, ' ').replace(/\s+/g, ' ').trim();
      if (looksLikeCopy(cand) && /\s/.test(cand) && /[a-záéíóúãõç]{3}/i.test(cand)) found.push(cand);
    }
    if (found.length) out[`${file}:${i + 1}`] = [...new Set(found)].join(' ');
  });

  return out;
}

function runCopy() {
  const script = join(homedir(), '.claude', 'skills', 'visant-copy', 'scripts', 'copy-lint.mjs');
  if (!existsSync(script)) return { skipped: "visant-copy's copy-lint not found", findings: [] };
  if (!uiFiles.length && !libFiles.length) return { skipped: 'no .tsx/.ts in the target', findings: [] };

  /* One JSON PER FILE, not a bag for the whole target. copy-lint's family
     rules count per document ("credibility seal at most once per page"), so
     merging six files into one JSON made the word appear once in each and the
     gate flagged a repetition that does not exist. Found with this bug: three
     different files, one "real" each. */
  const perFile = [
    ...uiFiles.map((f) => [f, extractCopy(f)]),
    ...libFiles.map((f) => [f, extractLibCopy(f)]),
  ].filter(([, bag]) => Object.keys(bag).length);
  const bag = Object.fromEntries(perFile.flatMap(([, b]) => Object.entries(b)));
  const strings = Object.keys(bag).length;
  if (!strings) return { skipped: 'no interface string extracted', findings: [], strings: 0 };

  // --dump shows what the extraction considered copy. Use it when the copy gate
  // gives a result you do not believe, in either direction.
  if (args.includes('--dump')) {
    for (const [k, v] of Object.entries(bag)) console.log(`  ${k}  ${v}`);
  }

  const dir = mkdtempSync(join(tmpdir(), 'killer-copy-'));
  const findings = [];
  const voice = productVoice();
  if (voice.warn) findings.push(`(warning) ${voice.warn}`);

  perFile.forEach(([file, fileBag], i) => {
    const jsonPath = join(dir, `copy-${i}.json`);
    writeFileSync(jsonPath, JSON.stringify(fileBag, null, 2), 'utf8');
    const r = spawnSync(process.execPath, [script, jsonPath], { cwd: ROOT, encoding: 'utf8' });
    const out = stripAnsi(`${r.stdout || ''}${r.stderr || ''}`);
    for (const line of out.split(/\r?\n/)) {
      const m = line.match(/^\s{2}([a-z-]+)\s{2,}(.+)$/);
      if (m && !/^(Como consertar|Aviso|How to fix|Warnings)/.test(m[1])) {
        const rule = copyRuleId(m[1]);
        // The product declared this delimiter as its own convention. See productVoice().
        if (voice.rules.has(rule)) continue;
        // A document title does not answer for delimiters. See DOC_TITLE_PROP.
        let locs = m[2].split(',').map((s) => s.trim()).filter(Boolean);
        if (DELIMITER_RULES.has(rule)) locs = locs.filter((l) => !l.includes(DOC_TITLE_MARK));
        if (!locs.length) continue;
        // Same path format as the other gates: relative to the audited repo.
        const short = (l) => {
          const i = l.lastIndexOf(':');
          return i > 0 ? `${disp(l.slice(0, i))}${l.slice(i)}` : l;
        };
        findings.push(`${locs.map((l) => short(l.split(DOC_TITLE_MARK).join(''))).join(', ')}  ${rule}`);
      }
    }
    void file;
  });

  return { skipped: null, findings, strings };
}

/* ---------- routes: the report is per SCREEN, not per file ----------
 *
 * `--init-report` asked for one row per interface file when the repo has no
 * `page.tsx` (Vite + react-router). In visantlabs-os that was 582 rows to run
 * the gate on `src/`: a table nobody fills in, and a gate nobody fills in is a
 * skipped gate. visant-frontend's unit of decision is the ROUTE (who arrives
 * there, what it moves), so the table becomes one row per route, with the page
 * file next to it.
 *
 * Reads the router (`<Route path=... element={...}>`), resolves the page
 * component through the router's own imports (static or
 * `lazy(() => import(...))`) and asks the navigation file (`navConfig`) for each
 * route's shell hint: the name of the list or function that mentions that path
 * (`isMarketing`, `BRAND_EDITOR_PREFIXES`...). The hint goes in its own column
 * and NEVER fills in the surface: classifying is still the auditor's job.
 *
 * Without a router, falls back to the old behavior (`page|layout|template`
 * files, and failing those, every interface file in the target).
 */
const ROUTER_CANDIDATES = [
  'src/App.tsx', 'src/App.jsx', 'src/routes.tsx', 'src/router.tsx',
  'src/routes/index.tsx', 'src/router/index.tsx', 'src/main.tsx', 'App.tsx',
];
const NAV_CANDIDATES = ['src/config/navConfig.ts', 'src/config/nav.ts', 'src/navConfig.ts', 'src/lib/nav.ts'];
/* Route wrapper: gate, provider, error boundary. The page is what is left. */
const WRAPPER = /(Gate|Guard|Provider|Boundary|Wrapper|Suspense|Protected\w*|RequireAuth\w*|Layout|Shell|Fragment)$/;

/** End of a JSX tag starting at `i` (`<Route ...>` or `<Route ... />`), counting braces. */
function fimDaTag(src, i) {
  let prof = 0;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === '{') prof++;
    else if (c === '}') prof--;
    else if (c === '>' && prof === 0 && src[j - 1] !== '=') return j;
  }
  return src.length;
}

/** Value of `attr={...}` with balanced braces. */
function valorEntreChaves(tag, attr) {
  const m = tag.match(new RegExp(`\\b${attr}\\s*=\\s*\\{`));
  if (!m) return null;
  let prof = 1;
  let j = m.index + m[0].length;
  const ini = j;
  for (; j < tag.length && prof > 0; j++) {
    if (tag[j] === '{') prof++;
    else if (tag[j] === '}') prof--;
  }
  return tag.slice(ini, j - 1);
}

function lerRotas(root, routerRel = null) {
  const rel = routerRel ?? ROUTER_CANDIDATES.find((r) => {
    const f = join(root, r);
    return existsSync(f) && /<Route\b/.test(readFileSync(f, 'utf8'));
  });
  if (!rel) return null;
  const routerFile = normP(join(root, rel));
  const src = semComentario(readFileSync(routerFile, 'utf8'));
  const g = montarGrafo([routerFile]);
  /* local name -> file, through the router's own imports */
  const arquivoDe = new Map();
  for (const d of g.deps.get(routerFile) ?? []) for (const n of d.nomes) arquivoDe.set(n, d.para);

  const rotas = [];
  const redirecionamentos = [];
  for (const m of src.matchAll(/<Route\b/g)) {
    const tag = src.slice(m.index, fimDaTag(src, m.index) + 1);
    const p = tag.match(/\bpath\s*=\s*(?:"([^"]+)"|'([^']+)'|\{\s*["'`]([^"'`]+)["'`]\s*\})/);
    const caminho = p ? (p[1] ?? p[2] ?? p[3]) : /\bindex\b/.test(tag) ? '(index)' : null;
    if (!caminho) continue; // layout route without a path: the child is the screen
    const el = valorEntreChaves(tag, 'element') ?? valorEntreChaves(tag, 'Component') ?? '';
    const nav = el.match(/<Navigate\b[^>]*\bto\s*=\s*(?:"([^"]+)"|'([^']+)'|\{\s*["'`]([^"'`]+)["'`]\s*\})/);
    if (nav) {
      redirecionamentos.push({ caminho, para: nav[1] ?? nav[2] ?? nav[3] });
      continue;
    }
    const ids = [...el.matchAll(/<([A-Z][\w.]*)/g)].map((x) => x[1]);
    const componenteSolto = /^\s*([A-Z][\w$]*)\s*$/.exec(el)?.[1]; // Component={Pagina}
    if (componenteSolto) ids.push(componenteSolto);
    const naoEmbrulho = ids.filter((n) => !WRAPPER.test(n));
    const emPages = naoEmbrulho.find((n) => /\/pages\//.test(arquivoDe.get(n) ?? ''));
    const nome = emPages ?? naoEmbrulho[naoEmbrulho.length - 1] ?? ids[ids.length - 1];
    if (!nome) continue;
    /* no import: component defined in the router itself (e.g. `HomeRoute`) */
    rotas.push({ caminho, componente: nome, arquivo: arquivoDe.get(nome) ?? routerFile });
  }
  return { routerFile, rotas, redirecionamentos };
}

/** Shell hint from the navigation file: who mentions this path. */
function lerNav(root, navRel = null) {
  const rel = navRel ?? NAV_CANDIDATES.find((r) => existsSync(join(root, r)));
  if (!rel) return null;
  const src = semComentario(readFileSync(join(root, rel), 'utf8'));
  /* top-level symbols only (column 0): a `const clean` inside a function is not a shell hint */
  const simbolos = [...src.matchAll(/^(?:export\s+)?(?:function\s+([A-Za-z_$][\w$]*)|const\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=)/gm)]
    .map((m) => ({ idx: m.index, nome: m[1] ?? m[2] }));
  const literais = [...src.matchAll(/['"`](\/[\w\-/]*)['"`]/g)].map((m) => {
    let dono = null;
    for (const s of simbolos) { if (s.idx < m.index) dono = s.nome; else break; }
    return { lit: m[1], dono };
  });
  return {
    arquivo: rel,
    dica(caminho) {
      const p = caminho.replace(/\/:[^/]+/g, '/x').replace(/\/\*$/, '');
      const casa = literais.filter(({ lit }) =>
        /* raw prefix, as the code does: `p.startsWith('/thank-you')` covers `/thank-you-pro` */
        p === lit || (lit.length > 1 && p.startsWith(lit)),
      );
      if (!casa.length) return '';
      const maior = Math.max(...casa.map((c) => c.lit.length));
      const donos = [...new Set(casa.filter((c) => c.lit.length === maior && c.dono).map((c) => c.dono))];
      return donos.length ? `nav: ${donos.slice(0, 3).join(', ')}` : '';
    },
  };
}

/**
 * The screens the target asks for: `page|layout|template` (Next), else the
 * router's routes whose page is in the target, else every interface file in the target.
 */
function telasDoAlvo() {
  const routeLike = uiFiles.filter((f) => /(^|\/)(page|layout|template)\.(tsx|jsx)$/.test(f));
  if (routeLike.length) return { cobrados: routeLike, porRota: null };
  const lidas = lerRotas(ROOT);
  if (lidas) {
    const alvo = new Set(files.map((f) => normP(f)));
    const noAlvo = lidas.rotas.filter((x) => alvo.has(x.arquivo));
    if (noAlvo.length) {
      return {
        cobrados: [...new Set(noAlvo.map((x) => x.arquivo))],
        porRota: noAlvo,
        redirecionamentos: alvo.has(lidas.routerFile) ? lidas.redirecionamentos : [],
        router: lidas.routerFile,
      };
    }
  }
  return { cobrados: uiFiles, porRota: null };
}

/* ---------- extractor self-test ---------- */

/**
 * The extractor is a heuristic, so it needs proof in BOTH directions: a string
 * extracted that was not copy (false positive, floods the screen and people
 * turn the gate off) and copy that was never extracted (false negative, the
 * gate says "zero" about text nobody checked; the worse of the two, because it
 * looks like success).
 *
 * The fixture carries the contract inside it: a line with EXTRAI must come out,
 * a line with IGNORA must not. Every case there has bitten for real.
 */
function runSelfTest() {
  const here = dirname(fileURLToPath(import.meta.url));
  const fixture = join(here, 'fixtures', 'copy-extractor.tsx');
  if (!existsSync(fixture)) {
    console.error(`fixture not found: ${fixture}`);
    process.exit(2);
  }

  /* Two fixtures, one contract. The `.ts` one came later, when it turned out that
     copy written in a lib and rendered by the screen had never been scanned: a
     false negative, the serious kind; the gate said zero about text nobody checked. */
  const libFixture = join(here, 'fixtures', 'lib-copy-extractor.ts');
  const bag = {
    ...extractCopy(fixture),
    ...(existsSync(libFixture) ? extractLibCopy(libFixture) : {}),
  };
  const src = [
    ...readFileSync(fixture, 'utf8').split(/\r?\n/),
    ...(existsSync(libFixture) ? readFileSync(libFixture, 'utf8').split(/\r?\n/) : []),
  ];
  const lineOf = (k) => Number(k.split(DOC_TITLE_MARK).join('').slice(k.lastIndexOf(':') + 1));
  /* Each fixture's lines are counted from 1, so the marking goes by
     `file:line` and the false-negative sweep walks each file with its own
     offset. Mixing both into one index would flag the wrong line. */
  const extractedByFile = new Map();
  for (const key of Object.keys(bag)) {
    const clean = key.split(DOC_TITLE_MARK).join('');
    const file = clean.slice(0, clean.lastIndexOf(':'));
    if (!extractedByFile.has(file)) extractedByFile.set(file, new Set());
    extractedByFile.get(file).add(lineOf(key));
  }

  const falsePositives = [];
  for (const [key, value] of Object.entries(bag)) {
    /* The pure separator exception.
     *
     * The normal contract is that the word EXTRAI travels INSIDE the copy, and
     * that is what proves the right sentence was extracted. A separator (" · ")
     * has no word at all (that is the definition of the case), so it can never
     * satisfy that check, and without this exception the case's fixture would
     * flag its own fix as a false positive.
     *
     * It opens no hole: the per-LINE sweep right below still requires the marker
     * on the line (EXTRAI that does not come out is a false negative, IGNORA that
     * comes out is a false positive). For the separator, the line marker is the
     * only possible proof, and it is still proof. */
    if (!value.includes('EXTRAI') && !SO_SEPARADOR_COM_VICIO.test(value)) {
      falsePositives.push(`line ${lineOf(key)}: ${value}`);
    }
    /* Contamination: the key name and quotes came along with the sentence.
       Without this assertion the fixture only proved the line was extracted,
       and the doubled extraction went unnoticed, which is how the credibility
       seal bug survived. A false positive that looks like success is the worst. */
    if (/[A-Za-z_$][\w$]*\s*:\s*['"`]/.test(value)) {
      falsePositives.push(`line ${lineOf(key)}: came with the key attached -> ${value}`);
    }
    // Doubled extraction: the same sentence twice inside the same value.
    const words = value.split(/\s+/);
    if (words.length >= 8 && words.slice(0, 4).join(' ') === words.slice(4, 8).join(' ')) {
      falsePositives.push(`line ${lineOf(key)}: sentence extracted twice -> ${value}`);
    }
  }

  const falseNegatives = [];
  const sweep = (path, lines) => {
    const extracted = extractedByFile.get(norm(path)) ?? extractedByFile.get(path) ?? new Set();
    lines.forEach((line, i) => {
      // Code lines only: the fixture header explains the contract and mentions
      // both words inside a comment.
      // `{/* ... */}` counts as a comment: in the fixture it annotates the next
      // case, and a comment is never copy.
      const isComment = /^\s*(\{\s*)?(\/\/|\*|\/\*)/.test(line);
      if (isComment) return;
      if (line.includes('EXTRAI') && !extracted.has(i + 1)) {
        falseNegatives.push(`${path.split(/[\\/]/).pop()} line ${i + 1}: ${line.trim()}`);
      }
      if (line.includes('IGNORA') && extracted.has(i + 1)) {
        falsePositives.push(`${path.split(/[\\/]/).pop()} line ${i + 1}: marked IGNORA and was extracted`);
      }
    });
  };
  sweep(fixture, readFileSync(fixture, 'utf8').split(/\r?\n/));
  if (existsSync(libFixture)) sweep(libFixture, readFileSync(libFixture, 'utf8').split(/\r?\n/));

  const total = Object.keys(bag).length;
  console.log(`\ncopy extractor self-test  (${total} string(s) extracted from the fixture)\n`);

  if (falsePositives.length) {
    console.log(`[FAIL]  false positive: ${falsePositives.length}`);
    for (const f of falsePositives) console.log(`          ${f}`);
  } else {
    console.log('[OK]    no false positive');
  }

  if (falseNegatives.length) {
    console.log(`[FAIL]  false negative: ${falseNegatives.length}`);
    for (const f of falseNegatives) console.log(`          ${f}`);
  } else {
    console.log('[OK]    no false negative');
  }

  /*
   * The `--init-report` route reader, against `fixtures/routes/`: imported page,
   * lazy page behind a gate, page defined in the router itself, redirect,
   * layout route without a path, commented-out route, and the `/*` trap inside
   * a line comment in navConfig.
   */
  const rotasFalhas = [];
  {
    const raiz = join(here, 'fixtures', 'routes');
    const lidas = lerRotas(raiz);
    const nav = lerNav(raiz);
    const fim = (f) => f.split('/').slice(-2).join('/');
    const got = (lidas?.rotas ?? []).map((r) => `${r.caminho}=${fim(r.arquivo)}`).join(' ');
    const want = '/=src/App.tsx /pricing=pages/Pricing.tsx /canvas/:id=pages/Canvas.tsx';
    if (got !== want) rotasFalhas.push(`routes: expected "${want}", got "${got}"`);
    const red = (lidas?.redirecionamentos ?? []).map((r) => `${r.caminho}>${r.para}`).join(' ');
    if (red !== '/old>/pricing') rotasFalhas.push(`redirects: expected "/old>/pricing", got "${red}"`);
    for (const [p, w] of [['/pricing', 'nav: isMarketing'], ['/login', 'nav: isMarketing'], ['/canvas/:id', 'nav: EDITOR_PREFIXES']]) {
      const d = nav?.dica(p) ?? '(no nav)';
      if (d !== w) rotasFalhas.push(`hint(${p}): expected "${w}", got "${d}"`);
    }
  }
  if (rotasFalhas.length) {
    console.log(`[FAIL]  route reader: ${rotasFalhas.length}`);
    for (const f of rotasFalhas) console.log(`          ${f}`);
  } else {
    console.log('[OK]    route reader (3 routes, 1 redirect, shell hint)');
  }

  /*
   * The built-in token fallback, both ways: it must fire on the dirty fixtures
   * (every ACUSA line flagged, no CALA line flagged) and stay silent on the
   * clean ones and on a theme file full of raw colors.
   */
  const tokenFalhas = [];
  {
    const fx = (n) => norm(join(here, 'fixtures', n));
    /* `token-fallback-ids.tsx` proves old ids (`paleta-tailwind`, `hex-cru`)
       and new ids both waive, and that an exception for one rule does not
       waive another. The `brand-marks` pair proves the brand-mark exemption. */
    const sujos = [
      'token-fallback-dirty.tsx', 'token-fallback-dirty.css', 'token-fallback-ids.tsx',
      'token-layer/brand-marks/components/icons/brand.tsx', 'token-layer/brand-marks/components/home/gauge.tsx',
    ].map(fx);
    const limpos = ['token-fallback-clean.tsx', 'token-fallback-clean.css', 'token-fallback-theme.css'].map(fx);
    for (const f of [...sujos, ...limpos]) if (!existsSync(f)) tokenFalhas.push(`fixture missing: ${f}`);
    if (!tokenFalhas.length) {
      const got = scanTokenFallback(sujos);
      const hit = new Set(got.map((a) => `${a.file}:${a.linha}`));
      for (const f of sujos) {
        readFileSync(f, 'utf8').split(/\r?\n/).forEach((line, i) => {
          if (/^\s*(\{\s*)?(\/\/|\/\*|\*)/.test(line) && !/;\s*\/\*/.test(line)) return;
          const k = `${f}:${i + 1}`;
          const nome = `${f.split('/').pop()} line ${i + 1}`;
          if (line.includes('ACUSA') && !hit.has(k)) tokenFalhas.push(`${nome}: marked ACUSA, not flagged`);
          if (line.includes('CALA') && hit.has(k)) tokenFalhas.push(`${nome}: marked CALA, flagged`);
        });
      }
      for (const a of scanTokenFallback(limpos)) {
        tokenFalhas.push(`${a.file.split('/').pop()} line ${a.linha}: clean fixture flagged (${a.regra})`);
      }
      if (!got.length) tokenFalhas.push('fallback flagged nothing on the dirty fixtures');
      if (got.some((a) => !Object.values(TF_LEGACY_IDS).includes(a.regra))) {
        tokenFalhas.push(`a finding carries a non-current rule id: ${[...new Set(got.map((a) => a.regra))].join(', ')}`);
      }
    }

    /* Token layer, both ways (fixtures/token-layer/<case>/). Detection must
       say present for shadcn, CSS color vars, v4 @theme and a semantic
       tailwind.config; absent for a commerce-like repo that only READS a
       palette var. Without a layer: a calm palette gives zero findings, a
       chaotic one (more than 3 accent families) gives exactly one. */
    const caso = (n) => join(here, 'fixtures', 'token-layer', n);
    const arquivos = (d, out = []) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) arquivos(p, out); else out.push(norm(p));
      }
      return out;
    };
    for (const [n, want] of [['shadcn', true], ['css-vars', true], ['v4-theme', true], ['tw-config', true], ['none', false], ['chaotic', false]]) {
      if (!existsSync(caso(n))) { tokenFalhas.push(`fixture missing: token-layer/${n}`); continue; }
      const tl = detectTokenLayer(caso(n));
      if (tl.present !== want) tokenFalhas.push(`token layer ${n}: expected ${want ? 'present' : 'absent'}, got ${tl.via}`);
    }
    if (existsSync(caso('shadcn'))) {
      const r = scanTokenFallbackFull(arquivos(caso('shadcn')), { tokenLayer: true }).achados;
      if (r.length !== 1 || r[0].regra !== 'tailwind-palette') tokenFalhas.push(`shadcn: expected 1 tailwind-palette per class, got ${r.length}`);
    }
    if (existsSync(caso('none'))) {
      const { achados, hues } = scanTokenFallbackFull(arquivos(caso('none')), { tokenLayer: false });
      if (achados.length) tokenFalhas.push(`no layer, calm palette: expected zero, got ${achados.map((a) => a.amostra).join(' | ')}`);
      if (hues.accent.size !== 2 || hues.neutral.size !== 4) tokenFalhas.push(`no layer, calm palette: expected 4 neutral and 2 accent families, got ${hues.neutral.size} and ${hues.accent.size}`);
      const comCamada = scanTokenFallbackFull(arquivos(caso('none')), { tokenLayer: true }).achados;
      if (comCamada.length !== 4) tokenFalhas.push(`same files WITH a layer: expected 4 per-line findings, got ${comCamada.length}`);
    }
    if (existsSync(caso('chaotic'))) {
      const { achados } = scanTokenFallbackFull(arquivos(caso('chaotic')), { tokenLayer: false });
      if (achados.length !== 1 || achados[0].file !== null || !/5 accent hue families/.test(achados[0].amostra)) {
        tokenFalhas.push(`no layer, chaotic palette: expected one aggregated finding with 5 accent families, got ${achados.map((a) => a.amostra).join(' | ') || 'none'}`);
      }
    }
  }
  if (tokenFalhas.length) {
    console.log(`[FAIL]  token fallback: ${tokenFalhas.length}`);
    for (const f of tokenFalhas) console.log(`          ${f}`);
  } else {
    console.log('[OK]    token fallback (fires on the dirty fixtures, silent on clean and theme files, token layer both ways, legacy ids waive)');
  }

  /* Legacy rule ids: an old `.killer-voice.json` ("bolinha") must still
     waive the renamed rule, and this map must not drift from copy-lint's. */
  const idFalhas = [];
  if (copyRuleId('bolinha') !== 'bullet-separator' || copyRuleId('em-dash') !== 'em-dash') {
    idFalhas.push('copyRuleId does not normalize old ids');
  }
  for (const id of ['bolinha', 'travessao', 'pipe-separador', 'hifen-como-travessao']) {
    if (!VOICE_RULES.has(copyRuleId(id))) idFalhas.push(`voice waiver lost legacy id ${id}`);
  }
  const copyLintSrc = [
    join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'visant-copy', 'scripts', 'copy-lint.mjs'),
    join(homedir(), '.claude', 'skills', 'visant-copy', 'scripts', 'copy-lint.mjs'),
  ].find((p) => existsSync(p));
  if (copyLintSrc) {
    const bloco = readFileSync(copyLintSrc, 'utf8').match(/const LEGACY_IDS = \{([\s\S]*?)\n\};/);
    const pares = bloco ? [...bloco[1].matchAll(/'?([a-z-]+)'?:\s*'([a-z-]+)'/g)].map((m) => [m[1], m[2]]) : [];
    if (!pares.length) idFalhas.push(`LEGACY_IDS not found in ${copyLintSrc}`);
    for (const [velho, novo] of pares) {
      if (COPY_LEGACY_IDS[velho] !== novo) idFalhas.push(`COPY_LEGACY_IDS drifted from copy-lint: ${velho} -> ${novo}`);
    }
    if (pares.length && pares.length !== Object.keys(COPY_LEGACY_IDS).length) {
      idFalhas.push(`COPY_LEGACY_IDS has ${Object.keys(COPY_LEGACY_IDS).length} entries, copy-lint has ${pares.length}`);
    }
  }
  if (idFalhas.length) {
    console.log(`[FAIL]  copy-lint rule ids: ${idFalhas.length}`);
    for (const f of idFalhas) console.log(`          ${f}`);
  } else {
    console.log('[OK]    copy-lint rule ids (legacy ids normalize, map matches copy-lint)');
  }

  const failed = falsePositives.length + falseNegatives.length + rotasFalhas.length + tokenFalhas.length + idFalhas.length;
  console.log('-'.repeat(64));
  console.log(
    failed
      ? 'EXTRACTOR BROKEN. Fix it before trusting any "zero" from the copy gate.'
      : 'EXTRACTOR OK. A new case that slips through: add it to the fixture, never replace one.'
  );
  console.log('-'.repeat(64));
  process.exit(failed ? 1 : 0);
}

if (selfTest) runSelfTest();

/* ---------- gate 0: surfaces and screen seen ---------- */

/* This gate exists because of two reports of the same failure.
 *
 * The first: someone ran motion-lint and refine-scan, saw both at zero, and
 * called it a full pass, skipping visant-frontend without noticing. It was not
 * carelessness. The other two end in a script, and a script feels finished;
 * visant-frontend ended in a QUESTION, which has no exit code. Agents always
 * gravitate toward what closes at zero.
 *
 * The second: an AnimatePresence bug froze a step of a lead-capture form and
 * passed tsc, ESLint, motion-lint, impeccable, audit:design and copy-lint. Six
 * green gates on a screen nobody opened.
 *
 * Both lead to the same conclusion: a rule that depends on the reader's
 * discipline fails on route 40. So the surface classification and the record
 * of having OPENED the screen become an artifact the script checks, and
 * without them no run can print GATE OPEN. */

const SURFACE_RE = /\b(A|B|C)\b/;

function readReport(path) {
  const abs = resolve(path);
  if (!existsSync(abs)) return { fatal: `report does not exist: ${abs}` };
  const text = readFileSync(abs, 'utf8');

  /*
   * Markdown tables, read BY HEADER.
   *
   * The old format was positional (`| file | surface | variable |`), and it is
   * still accepted. The new per-route one is `| Route | File | Surface |
   * Variable | Shell | Notes |`: reading by position would take the file as
   * the surface and flag the whole table as empty. The header says where each
   * thing is; a table with no surface column in its header (the "Screen seen"
   * one, for example) falls back to positional, as it always did. Headers are
   * matched in English and in Portuguese (Rota/Arquivo/Superfície/Variável),
   * so reports written before the translation keep working.
   */
  const linhasMd = text.split(/\r?\n/);
  const celulas = (l) => l.split('|').slice(1, -1).map((c) => c.trim());
  const ehSeparador = (l) => /^\s*\|[\s|:-]+\|\s*$/.test(l);
  const rows = [];
  let cols = null;
  for (let i = 0; i < linhasMd.length; i++) {
    const l = linhasMd[i];
    if (!l.trim().startsWith('|')) { cols = null; continue; } // table ended
    if (ehSeparador(l)) continue;
    const c = celulas(l);
    if (ehSeparador(linhasMd[i + 1] ?? '')) {
      const idx = (re) => c.findIndex((x) => re.test(x));
      const sup = idx(/superf|surface/i);
      cols = sup === -1 ? null : {
        rota: idx(/^(rota|route|tela|screen)$/i),
        arquivo: idx(/^(arquivo|file|componente|component|p[aá]gina|page)$/i),
        sup,
        vari: idx(/vari[aá]vel|variable/i),
      };
      continue;
    }
    rows.push({ cells: c, cols });
  }

  const classified = new Map();
  for (const { cells, cols: cc } of rows) {
    const pick = (k) => (cc[k] >= 0 ? cells[cc[k]] : '') ?? '';
    if (!cc && (cells.length < 3 || /^(arquivo|rota|file|route|componente|component)$/i.test(cells[0]))) continue;
    const rota = cc ? pick('rota') : '';
    const what = cc ? pick('arquivo') || rota : cells[0];
    const surface = (cc ? pick('sup') : cells[1]) ?? '';
    const variable = (cc ? pick('vari') : cells[2]) ?? '';
    if (!what || !SURFACE_RE.test(surface)) continue;
    /* An empty business variable, "?" or "TBD" does not count: the table exists
       to force the sentence "this element moves X". Filling it with a dash is
       the bureaucratic way of skipping the step. */
    if (!variable || /^[-–—?]+$/.test(variable) || /^(tbd|a definir|n\/a)$/i.test(variable)) continue;
    /* Key = route when there is one: two routes of the same page are two rows. */
    classified.set(rota || norm(what), { arquivo: norm(what), rota, surface: surface.match(SURFACE_RE)[1], variable });
  }

  /* It used to be `(?=^##\s|\Z)`. JavaScript has no `\Z`: the engine reads it
     as the LETTER "Z", and with the `i` flag that matches any lowercase "z".
     `[\s\S]*?` is lazy, so the section was cut at the first "z" that showed
     up. In Portuguese that is almost immediate: a report with 7 recorded
     screens counted 1, and the gate's message under-reported exactly the
     evidence it exists to require. `$(?![\s\S])` is the real end-of-text under `m`.
     The heading is accepted as `## Screen seen` or the Portuguese `## Tela vista`. */
  const seenSection = text.match(/^##+[ \t]*(?:Tela vista|Screen seen)[\s\S]*?(?=^##[ \t]|$(?![\s\S]))/im)?.[0] ?? '';
  /* Bullet OR table row.
   *
   * SKILL.md asks for "one row per screen, with route, width, data state and
   * what happened": four fields, which in markdown is a TABLE. The parser only
   * accepted bullets, so a report written exactly as the skill says was read
   * as zero screens seen, and the gate accused the person who had opened and
   * recorded the screen properly of not having opened it. A tool that demands
   * one format and reads another teaches people to fake the format. */
  const seen = seenSection
    .split(/\r?\n/)
    .filter((l) => {
      const t = l.trim();
      if (/^[-*]\s+\S/.test(t)) return true;
      if (!t.startsWith('|')) return false;
      if (/^\|[\s|:-]+\|$/.test(t)) return false;
      const cells = t.split('|').slice(1, -1).map((c) => c.trim());
      return cells.length >= 2 && cells[0] && !/^(rota|tela|url|caminho|route|screen|path)$/i.test(cells[0]);
    })
    .map((l) => l.trim().replace(/^[-*]\s+/, '').replace(/^\|/, '').replace(/\|$/, '').trim());

  return { classified, seen, text };
}

function gateZero(reportPath) {
  if (!reportPath) {
    return {
      ok: false,
      why: [
        'no report passed (--report <file.md>)',
        'without the surface classification this is a linter pass, not an audit',
      ],
    };
  }

  const r = readReport(reportPath);
  if (r.fatal) return { ok: false, why: [r.fatal] };

  const why = [];

  /* Every screen in the target needs a row. A leaf component inherits the
     route's surface, so only top-level interface files are required; requiring
     every button would turn the table into bureaucracy and it would stop being read. */
  const { cobrados, porRota } = telasDoAlvo();
  const arquivosClassificados = [...r.classified.values()].map((v) => v.arquivo);
  const casa = (f, k) => f.endsWith(k) || k.endsWith(f) || f.includes(k);
  let faltando;
  if (porRota) {
    /* Per route: each route in the target needs its row (by route or, in an
       old report, by the page file). */
    const rotasClass = new Set([...r.classified.values()].map((v) => v.rota).filter(Boolean));
    faltando = porRota
      .filter((x) => !rotasClass.has(x.caminho) && !arquivosClassificados.some((k) => !rotasClass.size && casa(x.arquivo, k)))
      .map((x) => `${x.caminho}  (${disp(x.arquivo)})`);
  } else {
    faltando = cobrados.filter((f) => !arquivosClassificados.some((k) => casa(f, k))).map(disp);
  }

  if (faltando.length) {
    why.push(`${faltando.length} ${porRota ? 'route(s)' : 'target(s)'} without a row in the surface table:`);
    for (const f of faltando.slice(0, 12)) why.push(`    ${f}`);
    if (faltando.length > 12) why.push(`    ... and ${faltando.length - 12} more`);
  }

  if (!r.seen.length) {
    why.push('no "## Screen seen" section ("## Tela vista" also accepted): no evidence that the screen was OPENED');
    why.push('    a green gate is not a screen seen; a frozen AnimatePresence passes all of them');
  }

  return { ok: !why.length, why, classified: r.classified, seen: r.seen };
}

/* --init-report: the skeleton already comes with one row per screen in the
   target. The friction of building the table by hand is exactly why everyone
   skips this step, and a step that gets skipped is not a gate. */
if (initReport) {
  const abs = resolve(initReport);
  if (existsSync(abs)) {
    console.error(`already exists: ${abs} (will not overwrite).`);
    process.exit(2);
  }
  const telas = telasDoAlvo();
  let rows;
  let cabecalho;
  let extra = '';
  if (telas.porRota) {
    const nav = lerNav(ROOT);
    rows = telas.porRota.map((x) => {
      const base = x.arquivo.split('/').pop().replace(/\.\w+$/, '');
      const comp = x.componente && x.componente !== base ? ` (${x.componente})` : '';
      return `| ${x.caminho} | ${disp(x.arquivo)}${comp} |  |  | ${nav?.dica(x.caminho) ?? ''} |  |`;
    });
    cabecalho = '| Route | File | Surface (A/B/C) | Business variable it moves | Shell | Notes |\n|---|---|---|---|---|---|';
    if (telas.redirecionamentos?.length) {
      extra = `\nRedirects (no screen of their own, not in the table): ${telas.redirecionamentos
        .map((x) => `\`${x.caminho}\` goes to \`${x.para}\``)
        .join(', ')}.\n`;
    }
    extra += `\nRoutes read from \`${disp(telas.router)}\`${nav ? `; the Shell column is the hint from \`${nav.arquivo}\` (who mentions the path), not the classification` : ''}.\n`;
  } else {
    rows = telas.cobrados.map((f) => `| ${disp(f)} |  |  |  |`);
    cabecalho = '| File | Surface (A/B/C) | Business variable it moves | Notes |\n|---|---|---|---|';
  }
  writeFileSync(
    abs,
    `# Audit: ${targets.join(', ')}

## Surfaces

One row per screen. **Fill this in before fixing anything.** Classifying
after changing things is justifying what was already done.

- **A acquisition**: whoever is not a customer yet. Persuade, prove, convert.
- **B work**: whoever uses it every day. Speed, density, keyboard.
- **C trust**: money, permission, destructive action. It cannot lie.

Applying A instincts to a B screen is the most expensive Visant frontend mistake.

${cabecalho}
${rows.join('\n')}
${extra}
## Screen seen

One row per screen OPENED, with what was seen. Without this the gate does not
open: a frozen AnimatePresence passes tsc, ESLint, motion-lint, impeccable,
audit:design and copy-lint without lighting anything up.

Each row carries: route, width, data state, and what happened.
Before measuring anything, check that the page hydrated (see
\`visant-killer/references/environment.md\`): half the findings of one session
were the dev server lying, not the screen.

-

## Findings

`,
    'utf8',
  );
  console.log(`skeleton created: ${abs}`);
  console.log(`${rows.length} surface row(s) pre-filled. Fill them in and run:`);
  console.log(`  node killer-scan.mjs --report ${initReport} ${targets.join(' ')}`);
  process.exit(0);
}

/* ---------- detector 4: chrome noise ---------- */

/**
 * Interface pollution: chrome nobody asked for.
 *
 * Delegated to `ruido-scan.mjs`, which also runs on its own. Here it joins the
 * scoreboard so that "gate open" also requires a screen WITHOUT excess support
 * text, not just a screen without bugs.
 */
function runRuido() {
  const achados = scanRuido(uiFiles);
  return {
    findings: achados.map(
      (a) => `${disp(a.file)}:${a.linha}  ${a.regra}  ${a.amostra}`,
    ),
  };
}

/* ---------- scoreboard ---------- */

/*
 * The fourth detector, and what the other three did not see.
 *
 * The first three look at CODE (AI tells), TOKENS (raw color) and SENTENCES
 * (voice tics). None of them adds up. The defect left over was a screen that
 * is entirely correct and unreadable from so much support text: an uppercase
 * label on every block, usage instructions next to a control that already has
 * an affordance, the same information said in three sizes. Each of those lines
 * alone is defensible; the damage is the sum, which is why no line linter
 * caught it.
 */
const gates = [
  { id: 'impeccable   (AI tell)   ', ...runImpeccable() },
  { id: 'audit:design (token)     ', ...runAuditDesign() },
  { id: 'copy         (tic)       ', ...runCopy() },
  { id: 'noise        (chrome)    ', ...runRuido() },
];

let failed = 0;
const bar = '-'.repeat(64);

if (!quiet) {
  console.log(`\nkiller-scan  target: ${targets.join(' ')}`);
  console.log(`files in target: ${files.length} (${uiFiles.length} interface)\n`);
}

for (const g of gates) {
  if (g.skipped) {
    console.log(`[SKIPPED] ${g.id}  ${g.skipped}`);
    continue;
  }
  if (g.findings.length) {
    failed++;
    console.log(`[FAIL]    ${g.id}  ${g.findings.length} finding(s)`);
    // --all lists everything: with the cut at 40 you cannot split the cleanup by file.
    const cap = args.includes('--all') ? Infinity : 40;
    if (!quiet) for (const f of g.findings.slice(0, cap)) console.log(`            ${f}`);
    if (!quiet && g.findings.length > cap) console.log(`            ... and ${g.findings.length - cap} more`);
  } else {
    const extra = g.strings != null ? ` (${g.strings} interface string(s))` : '';
    console.log(`[OK]      ${g.id}  zero${extra}`);
  }
  if (g.via && !quiet) console.log(`            via ${g.via}`);
}

/* One line that says what ran and what did not. A skipped gate read as a pass
   is the most expensive failure of this script; here it has nowhere to hide. */
{
  const nome = (g) => g.id.trim().split(/\s+/)[0];
  const ran = gates.filter((g) => !g.skipped).map((g) => (g.via?.startsWith(TF_ROTULO) ? `${nome(g)} (fallback)` : nome(g)));
  const skipped = gates.filter((g) => g.skipped).map((g) => `${nome(g)} (${g.skipped})`);
  console.log('');
  console.log(
    `gates: ${ran.length}/${gates.length} ran [${ran.join(', ')}]` +
      (skipped.length ? `; SKIPPED: ${skipped.join('; ')}` : '; none skipped'),
  );
}

/* ---------- --roots: root first ----------
 *
 * The gate's list is per file, in the order the detectors find things. That
 * says to fix the page the person opened first, and a defect living in a
 * `ui/` component imported by 68 screens comes back on the next one that uses
 * the same piece. Round 1 of the slop killer (2026-10-05) fixed `Thumb`,
 * `PageShell` and `GlassPanel` AFTER dozens of screens, one by one, when fixing
 * the piece first would have taken half the findings at once.
 *
 * `--roots` groups the findings of ALL detectors by the file they live in and
 * ranks SHARED files (in `components/ui`, `components/shared` or `lib/ui`, or
 * imported by 5+ files) by fan-out x findings. Fan-out is how many project
 * files import the piece, measured over the whole project, not the slice,
 * because the screen that inherits the defect may be outside the target.
 */
function raizPrimeiro() {
  const LOC = /((?:[A-Za-z]:)?[^\s,:]+\.(?:tsx|jsx|ts|js|css)):(\d+)/g;
  const porArquivo = new Map();
  for (const g of gates) {
    const det = g.id.trim().split(/\s+/)[0];
    for (const f of g.findings ?? []) {
      for (const m of String(f).matchAll(LOC)) {
        const abs = normP(resolve(ROOT, m[1]));
        if (!porArquivo.has(abs)) porArquivo.set(abs, new Map());
        const c = porArquivo.get(abs);
        c.set(det, (c.get(det) ?? 0) + 1);
      }
    }
  }
  if (!porArquivo.size) return [];
  const grafo = montarGrafo([...porArquivo.keys()]);
  const COMPARTILHADO = /\/(?:components\/(?:ui|shared)|lib\/ui)\//;
  return [...porArquivo]
    .map(([file, dets]) => {
      const achados = [...dets.values()].reduce((a, b) => a + b, 0);
      const fan = fanOut(grafo, file);
      return { file, dets, achados, fan, score: Math.max(1, fan) * achados };
    })
    .filter((x) => COMPARTILHADO.test(x.file) || x.fan >= 5)
    .sort((a, b) => b.score - a.score || b.fan - a.fan);
}

if (roots) {
  const lista = raizPrimeiro();
  console.log(bar);
  if (!lista.length) {
    console.log('ROOT FIRST: no finding in a shared piece. The findings are local to each screen.');
  } else {
    console.log('ROOT FIRST: fix these before the screens (findings x files that import the piece)');
    console.log(`  ${'score'.padStart(6)}  ${'fan-out'.padStart(7)}  ${'findings'.padStart(8)}  file  (per detector)`);
    const cap = args.includes('--all') ? Infinity : 15;
    for (const x of lista.slice(0, cap)) {
      const dets = [...x.dets].map(([d, n]) => `${d} ${n}`).join(', ');
      console.log(`  ${String(x.score).padStart(6)}  ${String(x.fan).padStart(7)}  ${String(x.achados).padStart(8)}  ${disp(x.file)}  (${dets})`);
    }
    if (lista.length > cap) console.log(`  ... and ${lista.length - cap} more (--all lists everything)`);
  }
}

const g0 = gateZero(reportPath);

console.log(bar);
if (failed) {
  console.log(`GATE CLOSED: ${failed} detector(s) with findings. A gate finding becomes a fix, not a proposal.`);
} else if (!g0.ok) {
  /* Detectors at zero with gate 0 open is NOT "open". This is the whole line of
     the fix: the scoreboard can no longer say the word that makes the agent stop. */
  console.log('GATE INCOMPLETE: the detectors passed, but this is not an audit yet.');
  for (const w of g0.why) console.log(`  ${w}`);
  console.log('');
  console.log(`  write the skeleton:  node killer-scan.mjs --init-report AUDIT.md ${targets.join(' ')}`);
  console.log(`  after filling it in: node killer-scan.mjs --report AUDIT.md ${targets.join(' ')}`);
} else {
  const skipped = gates.filter((g) => g.skipped).length;
  const porSup = [...g0.classified.values()].reduce((a, c) => ((a[c.surface] = (a[c.surface] ?? 0) + 1), a), {});
  console.log(`GATE OPEN${skipped ? ` (with ${skipped} skipped, report that)` : ''}.`);
  console.log(
    `  surfaces classified: ${g0.classified.size} ` +
      `(${Object.entries(porSup).map(([k, v]) => `${k}:${v}`).join('  ')})`,
  );
  console.log(`  screens recorded as seen: ${g0.seen.length}`);
  /*
   * THE LIST OF WHAT IS LEFT is the only place where `corta-scan` shows up
   * without someone having read the whole SKILL.md, and it measures exactly
   * what the gate does not see: cut words and stacked overlays, which only
   * exist with the screen open.
   */
  console.log('  Still to do: tsc, lint, 390px with real data, backend stopped, and');
  console.log('               corta-scan.js on the open screen (cut text / stacked overlay).');
}
console.log(bar);
process.exit(failed || !g0.ok ? 1 : 0);
