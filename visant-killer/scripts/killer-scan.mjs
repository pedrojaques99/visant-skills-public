#!/usr/bin/env node
/* killer-scan — o portão do visant-killer num comando.
 *
 *   node killer-scan.mjs components/admin/finance/MeiTaxCard.tsx
 *   node killer-scan.mjs components/admin/finance app/admin/fiscal
 *   node killer-scan.mjs --quiet <paths>      só o placar e o exit code
 *
 * Roda os três detectores NO ALVO (nunca no repo inteiro, senão a dívida antiga
 * afoga o achado novo) e imprime um placar só:
 *
 *   1. npx impeccable detect        tells de IA genérica
 *   2. npm run audit:design         token e cor crua (repo without a token gate:
 *                                   built-in fallback, raw hex/rgb/hsl + Tailwind palette)
 *   3. copy-lint do visant-copy     vício de linguagem
 *
 * O pulo do gato está no 3: rodar copy-lint direto num .tsx enche a tela de
 * falso positivo, porque o menos da subtração casa com "hífen como travessão" e
 * todo comentário em português casa com travessão. Aqui as strings que chegam no
 * olho do usuário são extraídas primeiro (texto de JSX e prop de rótulo), viram
 * um JSON com a chave "arquivo:linha", e o copy-lint roda em cima disso.
 *
 * Exit 1 se qualquer portão falhar. Sem dependência: node puro.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir, homedir } from 'node:os';
import { scanRuido } from './ruido-scan.mjs';
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
  console.error('uso: node killer-scan.mjs [--quiet] --report AUDIT.md <arquivos-ou-pastas>');
  console.error('     node killer-scan.mjs --init-report AUDIT.md <alvo>   (gera o esqueleto, uma linha por ROTA)');
  console.error('     node killer-scan.mjs --roots <alvo>                  (raiz primeiro: peça compartilhada × fan-out)');
  console.error('     node killer-scan.mjs --self-test                     (checa o extrator de copy, o leitor de rotas e o fallback de token)');
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

/* ---------- alvo: expande pasta em lista de arquivo ---------- */

const EXT = /\.(tsx|jsx|ts|js|css)$/;
/* `__tests__` entra aqui porque o extrator de copy lia o nome do `describe` e
   do `it` como se fosse texto de interface: "MockupRenderButton — portão de
   acesso" virava achado de travessão num lugar que nenhum usuário lê. Nome de
   teste é documentação de código, e código não segue a regra de voz. */
const SKIP_DIR = /^(node_modules|\.next|\.git|dist|build|coverage|__tests__|__mocks__)$/;
/* O mesmo motivo vale pro teste colocado ao lado do componente (`PianoRoll.test.tsx`):
   na /final (2026-10-09) os nomes de `it('⇧↑ sobe a oitava; …')` deram 10 achados de
   seta e ponto-e-vírgula, todos falsos — o pulo por PASTA não via arquivo `.test.`. */
const TESTE = /\.(test|spec)\.[cm]?[jt]sx?$/;

function walk(p, out = []) {
  const st = statSync(p);
  if (st.isDirectory()) {
    for (const name of readdirSync(p)) {
      if (SKIP_DIR.test(name)) continue;
      walk(join(p, name), out);
    }
  } else if (EXT.test(p) && !TESTE.test(p)) {
    /* Absoluto sempre. Guardar `relative(ROOT, p)` funcionava enquanto o alvo
       estava debaixo do cwd e quebrava calado quando não estava: entre drives
       o relativo não resolve de volta, e o scan passa a ler arquivo nenhum
       enquanto continua imprimindo "zero achado". Um zero por não ter olhado é
       pior que um erro. */
    out.push(norm(p));
  }
  return out;
}

/** Só encurta o caminho na impressão, e só quando ele está mesmo sob a base. */
const disp = (p) => {
  const r = relative(ROOT, p);
  return norm(r && !r.startsWith('..') && !isAbsolute(r) ? r : p);
};

const files = [];
if (!selfTest) {
  for (const t of targets) {
    /* `resolve`, não o argumento cru: agente que chama o portão de fora manda
       caminho absoluto do Windows, e o script precisa tratar isso como o caso
       normal, não como a exceção. */
    const a = resolve(t);
    if (!existsSync(a)) {
      console.error(`alvo não existe: ${t}`);
      console.error(`  (resolvido para ${a})`);
      process.exit(2);
    }
    walk(a, files);
  }
}
const uiFiles = files.filter((f) => /\.(tsx|jsx)$/.test(f));

/* Copy também mora em `.ts`, e essa era a maior cegueira do portão.
 *
 * O extrator só olhava `.tsx`/`.jsx`, então frase escrita numa lib e RENDERIZADA pela
 * tela nunca era varrida. Caso real (mockup-store, 2026-08-05): `art-classify.ts`
 * devolvia `reason: "proporção casa com a superfície — preenche sem cortar"`, com
 * travessão, e o painel de render passava essa string direto pro olho do usuário. O
 * portão dizia "copy zero" com um vício de linguagem na tela.
 *
 * Varrer `.ts` inteiro seria ruído (mensagem de log, chave de erro, texto de CLI). A
 * regra é o CONTRATO: string literal atribuída a uma propriedade que existe para virar
 * texto de interface. Fora dessa lista, `.ts` continua fora do portão. */
const COPY_BEARING_PROP =
  /\b(label|title|placeholder|description|heading|subtitle|tooltip|hint|reason|message|helperText|errorMessage|emptyMessage|cta|caption)\s*:\s*(["'`])((?:[^"'`\\]|\\.)*)\2/g;
const libFiles = files.filter((f) => /\.ts$/.test(f) && !/\.d\.ts$/.test(f));

/* ---------- 1. impeccable ---------- */

function runImpeccable() {
  const r = spawnSync(npx, ['impeccable', 'detect', ...targets], {
    cwd: ROOT, encoding: 'utf8', shell: isWin,
  });
  if (r.error || r.status === null) return { skipped: 'impeccable não rodou', findings: [] };
  const out = stripAnsi(`${r.stdout || ''}${r.stderr || ''}`);
  if (/unknown command|not found|command not found/i.test(out)) {
    return { skipped: 'impeccable não instalado', findings: [] };
  }
  // Cada achado sai como "path:line" ou como bloco por arquivo; o que importa
  // pro portão é a contagem de erro, então qualquer linha de achado conta.
  const findings = out
    .split(/\r?\n/)
    .filter((l) => /\[[A-Z_]{3,}\]|✖|error/i.test(l) && l.trim())
    .map((l) => l.trim());
  const clean = r.status === 0 && !findings.length;
  return { skipped: null, findings: clean ? [] : findings };
}

/* ---------- 2. audit:design ---------- */

/* Portão de token que mora como ARQUIVO, não como script npm.
 *
 * Formato esperado (o do `scan-design-violations.mjs` do visantlabs-os):
 *
 *   ERR [nome-da-regra] mensagem
 *     caminho/arquivo.tsx:123
 *       <trecho de código>
 *
 * Só `ERR` é portão. `WRN` entra no julgamento — a mesma regra do parser de ✖
 * acima, e o motivo é o mesmo: aviso em massa vira ruído e ensina a ignorar.
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

  /* `--all`: o scanner imprime só 5 locais por regra por padrão, e o portão
     contava no máximo 5 por regra — um repo com 40 rgba crus aparecia com 5.
     Só o scan-design-violations conhece a flag; os outros rodam sem. */
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
    /* O scanner varre o repo inteiro e imprime caminho relativo ao cwd; a lista
       de alvos é absoluta. Resolver os dois pro mesmo formato antes de comparar,
       senão o filtro nunca casa e o portão devolve zero com o repo cheio. */
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
 *   hex-cru         `#abc` in .css (outside custom-property definitions and
 *                   theme blocks) and, in .tsx/.jsx, only inside an arbitrary
 *                   class (`bg-[#123456]`) or a color string in a style context
 *   rgb-hsl-cru     `rgb(10,...)` / `hsl(210 ...)` with a literal number;
 *                   `hsl(var(--x))` is the right way and is not flagged
 *   paleta-tailwind `text-purple-500`, `bg-slate-900`: fixed palette color
 *                   instead of a semantic token (in .css only via `@apply`)
 *
 * Left out: token/theme files (`tokens.css`, `theme.css`, `globals.css`,
 * `*-theme.*`, `tailwind.config.*`, a `tokens/` or `theme/` folder), `:root`,
 * `.dark`, `[data-theme]` and `@theme` blocks, comment lines, and any line with
 * a written exception: `EXCEÇÃO ao token-fallback/<rule>: reason` on the same
 * line or up to 8 lines above (same contract as the other scanners).
 */
const TF_EXT = /\.(tsx|jsx|css)$/;
const TF_DIR_TEMA = /\/(tokens?|themes?)\//i;
const TF_ARQ_TEMA = /(^|[-_.])(tokens?|themes?|globals?|palette|variables)$/i;
const TF_TW_CONFIG = /^tailwind\.config\./i;
const TF_PALETA = /\b(?:bg|text|border|ring|fill|stroke|from|via|to|outline|decoration|divide|placeholder|caret|accent|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|[1-9]00|950)\b/;
const TF_ARBITRARIO = /\b(?:bg|text|border|ring|fill|stroke|from|via|to|outline|decoration|divide|shadow|caret|accent)-\[(?:#[0-9a-fA-F]{3,8}|rgba?\(\s*\d|hsla?\(\s*\d)/;
const TF_COR_STRING = /(['"`])(?:#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|rgba?\(\s*\d[^)'"`]*\)|hsla?\(\s*\d[^)'"`]*\))\1/;
const TF_CONTEXTO_ESTILO = /\b(?:color|colou?r|background|bg|fill|stroke|border|shadow|outline|style)\w*\s*[:=]/i;
const TF_HEX_CSS = /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/;
const TF_FUNC_CSS = /\b(?:rgba?|hsla?)\(\s*\d/;
const TF_BLOCO_TEMA = /(:root|\.dark\b|\[data-theme|@theme)/;
const TF_COMENTARIO = /^\s*(\{\s*)?(\/\/|\/\*|\*)/;

function arquivoDeTema(f) {
  const n = norm(f);
  const base = n.split('/').pop();
  const stem = base.replace(/\.[^.]+$/, '');
  return TF_DIR_TEMA.test(n) || TF_ARQ_TEMA.test(stem) || TF_TW_CONFIG.test(base);
}

function excecaoTF(lines, i, regra) {
  const re = new RegExp(`EXCE[ÇC][ÃA]O ao token-fallback/${regra}(?![\\w-])`);
  for (let k = Math.max(0, i - 8); k <= i; k++) if (re.test(lines[k])) return true;
  return false;
}

/** Scans the files and returns findings `{ file, linha, regra, amostra }`. */
export function scanTokenFallback(lista) {
  const achados = [];
  for (const f of lista) {
    if (!TF_EXT.test(f) || arquivoDeTema(f)) continue;
    const lines = readFileSync(f, 'utf8').split(/\r?\n/);
    const css = f.endsWith('.css');
    const pilha = []; // .css only: true when the open block is a theme block
    const acusa = (i, regra) => {
      if (excecaoTF(lines, i, regra)) return;
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
            if (TF_HEX_CSS.test(decl)) { acusa(i, 'hex-cru'); break; }
            if (TF_FUNC_CSS.test(decl)) { acusa(i, 'rgb-hsl-cru'); break; }
          }
          if (/@apply/.test(resto) && TF_PALETA.test(resto)) acusa(i, 'paleta-tailwind');
        }
        for (const ch of resto) if (ch === '}') pilha.pop();
        return;
      }
      if (TF_COMENTARIO.test(line)) return;
      if (TF_ARBITRARIO.test(line)) acusa(i, /\[#/.test(line) ? 'hex-cru' : 'rgb-hsl-cru');
      else if (TF_CONTEXTO_ESTILO.test(line) && TF_COR_STRING.test(line)) {
        acusa(i, /(['"`])#/.test(line.match(TF_COR_STRING)[0]) ? 'hex-cru' : 'rgb-hsl-cru');
      }
      if (TF_PALETA.test(line)) acusa(i, 'paleta-tailwind');
    });
  }
  return achados;
}

const TF_ROTULO = 'killer-scan built-in FALLBACK (raw hex/rgb/hsl, Tailwind palette)';

function runTokenFallback(motivo) {
  const achados = scanTokenFallback(files);
  return {
    skipped: null,
    via: `${TF_ROTULO}; ${motivo}`,
    findings: achados.map((a) => `${disp(a.file)}:${a.linha}  ${a.regra}  ${a.amostra}`),
  };
}

function runAuditDesign() {
  const pkgPath = join(ROOT, 'package.json');
  if (!existsSync(pkgPath)) return runTokenFallback('repo has no package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

  /* Nem todo repo batiza o portão de token de `audit:design`. O boxy-app chama
     de `lint:design` e o portão dizia "PULADO" com 218 achados de token em
     aberto — pulo silencioso que parece aprovação, o mesmo defeito do falso
     negativo do extrator. Aceita os apelidos conhecidos antes de desistir. */
  const ALIASES = ['audit:design', 'lint:design', 'design:lint', 'lint:tokens'];
  const scriptName = ALIASES.find((n) => pkg.scripts?.[n]);
  if (!scriptName) {
    /* Nem todo repo expõe o portão de token como script npm. O visantlabs-os
       guarda o dele como ARQUIVO (`scripts/scan-design-violations.mjs`), e o
       killer imprimia "PULADO" com o scanner ali do lado — pulo silencioso que
       parece aprovação, o MESMO defeito que o bloco acima já tinha consertado
       uma vez para os apelidos de npm. Procurar por arquivo antes de desistir. */
    return runDesignScannerFile();
  }

  /* Formato de linter em grep (`arquivo:linha:conteúdo`, seção por `--- x ---`).
     É o formato do `lint:design`; o `audit:design` cai no parser de ✖ abaixo. */
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
      /* O linter varre o repo inteiro e imprime caminho RELATIVO ao cwd; a
         lista de alvos é absoluta. Resolver os dois pro mesmo formato antes de
         comparar — senão o filtro nunca casa e o portão devolve zero achado de
         token com o repo cheio deles. */
      const f = norm(resolve(ROOT, m[1]));
      if (files.includes(f)) findings.push(`${disp(f)}:${m[2]}  ${section || 'token'}`);
    }
    return { skipped: null, findings, via: `npm run ${scriptName}` };
  }

  const r = spawnSync(npm, ['run', '--silent', scriptName, '--', `--file=${targets[0]}`], {
    cwd: ROOT, encoding: 'utf8', shell: isWin,
  });
  const out = stripAnsi(`${r.stdout || ''}${r.stderr || ''}`);

  // Formato: cabeçalho "caminho.tsx [zona]" e depois achados indentados
  // "✖ [RULE] line 12:34". Só erro (✖) é portão; aviso e info entram no
  // julgamento, não no gate.
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

/* ---------- 3. copy: extrai só o que o usuário lê ---------- */

const CLASSY = /(^|\s)(flex|grid|block|inline|absolute|relative|fixed|sticky|truncate|shrink|grow|hidden|rounded|shadow|border|outline|ring|animate-|transition|duration-|ease-|origin-|opacity-|z-|overflow|whitespace|tracking-|leading-|font-|italic|uppercase|lowercase|capitalize|tabular-nums|text-|bg-|from-|via-|to-|fill-|stroke-|w-|h-|min-|max-|p[xytblrse]?-|m[xytblrse]?-|gap-|space-|items-|justify-|self-|place-|col-|row-|order-|basis-|divide-|cursor-|select-|pointer-events|sm:|md:|lg:|xl:|hover:|focus|active:|group|peer|data-\[|aria-\[|\[&)/;

const LABEL_PROPS = /\b(label|title|placeholder|alt|description|heading|subtitle|tooltip|emptyMessage|emptyLabel|confirmLabel|cancelLabel|actionLabel|helperText|errorMessage|aria-label)\s*=\s*(["'])((?:[^"'\\]|\\.)*)\2/g;

/* Cheiro de código que escapou da extração. Sem isso, `a > 0 ? b : null;` vira
   "copy" pelo extrator de texto de JSX e o portão acusa ponto-e-vírgula em
   cima de uma expressão ternária. */
/* A crase entrou na lista pelo mesmo motivo dos outros: ela delimita template
   literal e NUNCA aparece em texto que o usuário lê. Sem ela, o extrator de
   texto de JSX comia o que vem depois do `>` de um genérico com argumento em
   template — `querySelector<HTMLMediaElement>(`[src*="id=${id}"]`)` voltava como
   copy e o portão acusava ponto-e-vírgula em cima de um seletor de DOM. O ramo
   de "linha solta" já barrava crase; o de texto de JSX não. */
const CODEY = /(=>|===|!==|&&|\|\||\?\?|\{|\}|`)|(^|\s)(const|let|var|return|function|import|export|await|async|typeof|null|undefined|true|false|void|Promise|boolean|props|className|Math|Number|String|Intl)(\s|$|\.|\(|;|,|\|)/;

/** Acesso a propriedade (`prev.year`). Frase de verdade tem espaço depois do ponto. */
const PROP_ACCESS = /[a-z]\.[a-z]/i;

/* Três cheiros de código que passavam por `looksLikeCopy` e faziam o portão
   acusar vício de linguagem em cima de sintaxe. Achados no audit das rotas
   públicas (2026-08-03):
     - data URI: `data:${tipo};base64,${b64}` virava copy e o `;` do MIME era
       lido como ponto-e-vírgula de copy de venda;
     - chamada de função: o extrator de texto de JSX come o que vem depois do
       `>` de um genérico (`useSWR<T>(chave)`) e entrega a chamada inteira;
     - membro de união de tipo: o laço de literal captura o texto ENTRE duas
       strings (`X["type"]; state: Y["`), e o `];` vinha junto.
   Copy de verdade não tem `;base64`, não cola identificador em parêntese
   (escreve "algo (assim)", com espaço) e não fecha colchete antes de vírgula. */
const DATA_URI = /^data:|;base64/i;
const CALL_EXPR = /\w\(/;
const TYPE_SYNTAX = /\]\s*[;,]/;

/* Cauda de chamada, quando o identificador ficou do outro lado do corte.
 *
 * `pickList<{ id: string; job: string }>(jobsRaw), [jobsRaw]);` — a máscara de
 * `{expr}` come o argumento de tipo, o `>` do genérico passa a parecer fechamento
 * de tag, e o que sobra DEPOIS dele é `(jobsRaw), [jobsRaw]);`. Começa em
 * parêntese, então `CALL_EXPR` (que pede identificador colado no `(`) não vê nada:
 * o nome da função ficou do lado esquerdo do corte. O portão acusava
 * "ponto-e-vírgula de copy de venda" numa linha de `useMemo`. Falso positivo,
 * achado no audit do kanban do comercial (visant-board, 2026-08-07).
 *
 * `);` e não `)` seguido de qualquer coisa: prose em português usa parêntese com
 * vírgula ("(a melhor delas), aliás"), e bloquear isso mataria copy de verdade.
 * Fechar parêntese e encerrar com ponto-e-vírgula é código. */
const CODE_TAIL = /\)\s*;/;

/* Anotação de parâmetro TypeScript, quando o `>` de um genérico no MEIO da
 * assinatura vira "fechamento de tag": `fly(root, flights: Map<string, Tween>,
 * id: string, dir: 'open' | 'close')` entregava `, id: string, dir: 'open' |
 * 'close')` como copy, e o pipe da união virava "pipe-separador". Falso POSITIVO,
 * achado no audit da MN Group (AboutChapters.tsx, 2026-09-28).
 *
 * Só tipo primitivo depois dos dois-pontos: "Nome: Pedro" é copy legítima e não
 * pode cair aqui. Nenhuma interface em português escreve "id: string". */
const TS_PARAM = /\b\w+\??\s*:\s*(?:string|number|boolean|unknown|null|undefined)\b/;

/* Sobra de genérico TypeScript lida como texto de JSX: o `>` que fecha um
 * argumento de tipo vira "fechamento de tag" e o que vem colado depois dele é
 * sufixo de tipo ou acesso a membro, nunca texto de tela:
 *   - `Node<FlowNodeData>[] | ((prev: ...` entregava `[] | ((prev: Node` e o
 *     pipe da união acusava pipe-separador (visantlabs-os CollaborativeCanvas);
 *   - `(ref as React.MutableRefObject<Konva.Stage | null>).current = node;`
 *     entregava `).current = node;` e acusava ponto-e-vírgula (KonvaCanvas).
 * Achado na onda 4 do slop killer do visantlabs-os (2026-10-05).
 *
 * Só no ramo de texto de JSX, e só no COMEÇO do candidato: `[]` (array de tipo)
 * ou `.membro` colado, com ou sem `)` antes. Prosa depois de tag inline começa
 * com `). Depois` (ponto e ESPAÇO), e isso continua sendo extraído; o fixture
 * trava o contraexemplo. */
const GENERIC_TAIL = /^(?:\[\]|\)?\.[A-Za-z_$])/;

/* Par chave=valor separado por ponto-e-vírgula: cookie, header, query string.
   `document.cookie = 'auth_error=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'`
   tem letra, tem espaço e não tem nenhum cheiro de código dos filtros acima —
   passava por `looksLikeCopy` inteira e o portão acusava ponto-e-vírgula de copy
   de venda em cima de um `Set-Cookie`. Achado no audit do boxy-app (login-form).
   Copy de verdade não escreve `chave=valor;`. */
const KV_STRING = /[A-Za-z_-]+=[^;=]*;/;

/* Propriedade de objeto com literal de texto (`description: 'Faça sua...'`).
   O extrator de linha solta engolia a linha INTEIRA, com o nome da chave e as
   aspas, e o extrator de literal pegava a mesma frase limpa. Como o dedupe é
   por string exata, as duas versões sobreviviam e eram concatenadas: a frase
   aparecia DUAS vezes no texto entregue ao copy-lint, e toda regra de
   repetição (`max: 1`, o selo de credibilidade) acusava repetição com uma
   ocorrência só. Achado em app/perguntas/layout.tsx, um único "tempo real".
   O literal já é coberto pelo laço de string, então aqui a linha solta sai. */
const OBJ_PROP = /^\s*['"]?[A-Za-z_$][\w$-]*['"]?\s*:\s*['"`]/;

/* Título de documento (`metadata.title`, openGraph/twitter). O pipe e o hífen
   ali são a convenção de SERP e de aba do navegador ("Sobre | Visant® Studio"),
   não a bolinha separadora de copy de venda: trocar por dois-pontos piora o
   produto. Só as duas regras de delimitador são dispensadas; emoji, guru e
   selo continuam valendo no título. `description` NÃO entra aqui, que é prosa
   de verdade e aparece no snippet do Google. */
const DOC_TITLE_PROP = /^\s*title\s*:\s*['"`]/;
const DOC_TITLE_MARK = '~doctitle';
const DELIMITER_RULES = new Set(['pipe-separador', 'hifen-como-travessao']);

/* ---------- voz do produto: o mesmo princípio do DOC_TITLE, um nível acima ----------
 *
 * O `copy-lint` do visant-copy foi escrito para UMA voz: a de venda da Visant. Rodado
 * sobre um produto com convenção própria e consistente, ele acusa a convenção inteira
 * — e aí o portão pede 132 reescritas que PIORAM o produto, exatamente o argumento que
 * já existia para o título de documento acima.
 *
 * Achado no audit da caixa de discos do liminal-stage (2026-08-14): 14 achados, todos
 * `bolinha` e `travessao`, 9 deles em linhas que o trabalho auditado não tocou, e 132
 * usos de `·` em 26 arquivos commitados antes — `ao vivo · 3`, `em breve · 2d`,
 * `55/120 · limpar`. Não é tique de IA; é o separador de batida daquele produto.
 *
 * Opt-in por repositório, e com preço: um `.killer-voice.json` na raiz do alvo,
 * nomeando SÓ as regras que aquele produto adotou e um `motivo` escrito de verdade.
 * Sem motivo (ou com um de menos de 40 caracteres) o arquivo é ignorado e o portão
 * volta a acusar — porque é essa a diferença entre exceção e `audit-ignore` mudo, que
 * é o que esta skill inteira existe pra impedir.
 *
 * Só regra de DELIMITADOR é dispensável. Emoji, guru, selo, ponto-e-vírgula de venda
 * e travessão em prosa continuam valendo: convenção de microcópia é uma escolha de
 * pontuação, não um passe livre de voz. */
const VOICE_RULES = new Set(['bolinha', 'travessao', 'pipe-separador', 'hifen-como-travessao']);
const productVoice = () => {
  try {
    const cfg = JSON.parse(readFileSync(join(ROOT, '.killer-voice.json'), 'utf8'));
    const motivo = typeof cfg.motivo === 'string' ? cfg.motivo.trim() : '';
    if (motivo.length < 40) {
      return { rules: new Set(), warn: '.killer-voice.json ignorado: `motivo` ausente ou curto demais (mín. 40 caracteres)' };
    }
    const rules = new Set((cfg.dispensa || []).filter((r) => VOICE_RULES.has(r)));
    const bad = (cfg.dispensa || []).filter((r) => !VOICE_RULES.has(r));
    return {
      rules,
      warn: bad.length ? `.killer-voice.json: só regra de delimitador é dispensável — ignorado: ${bad.join(', ')}` : null,
      motivo,
    };
  } catch {
    return { rules: new Set(), warn: null };
  }
};

/* Literal que é SÓ separador, sem letra nenhuma.
 *
 * `label: cond ? \`${negocio.name} · ${negocio.cliente}\` : negocio.name` — depois
 * de mascarar a interpolação, o que resta do template é " · ". Zero letra, três
 * caracteres: morria nas duas primeiras linhas de `looksLikeCopy` (comprimento
 * mínimo e `\p{L}`), e o portão dizia "copy zero" sobre uma bolinha que ia
 * direto pro combobox do usuário. Falso NEGATIVO, que é o grave: parece
 * aprovação.
 *
 * A regra é estreita de propósito: só passa se o literal for EXCLUSIVAMENTE
 * pontuação/espaço E carregar um vício. Assim `" · "` entra e `" (%) "` não —
 * nenhum código vira falso positivo, porque literal de código com bolinha ou
 * travessão dentro praticamente não existe. Achado no audit da aba Propostas do
 * CRM (visant-board, 2026-08-07).
 *
 * O ESPAÇO É PARTE DA REGRA, e não sobra de formatação.
 *
 * Separador e placeholder de vazio são o mesmo glifo fazendo trabalhos opostos:
 * o separador JUNTA dois valores (`a · b`) e por isso é escrito com espaço em
 * volta, porque sem espaço não se lê; o placeholder SUBSTITUI um valor ausente
 * (`{v ?? "—"}` numa célula de tabela) e é escrito pelado, porque não há o que
 * separar. Sem esta distinção, o portão acusava as duas coisas com a mesma
 * palavra e a lista virava barulho: no audit de /admin (visant-board,
 * 2026-08-10), 9 dos 16 achados de "literal só de separador" eram travessão de
 * célula vazia — convenção de tabela densa, a mesma do Linear, do Stripe e da
 * Vercel, e trocar por hífen é piorar a tipografia.
 *
 * Exigir espaço não abre buraco no caso que criou a regra: `" · "` do combobox
 * continua entrando, e `" — "` de prosa também. Sai só o glifo pelado, que é
 * dado ausente, não voz. */
const SO_SEPARADOR_COM_VICIO = /^(?=\s*[·—][\s·—]*$)(?=.*\s)[\s·—]+$/;

/* União de TypeScript escrita como documentação de prop, a da página de design
 * system: `'left' | 'right'`, `"sm" | "md"`,
 * `number | string (default 1; masonry = natural)`. O pipe é operador de união,
 * não separador de copy, e o portão acusava pipe-separador (src/pages/
 * DesignSystemPage.tsx, 2026-10-05).
 *
 * É tipo quando TODO segmento entre pipes é literal entre aspas, palavra de tipo
 * ou identificador com cara de código, e pelo menos um é literal ou palavra de
 * tipo. A anotação final entre parênteses (`(default 'x')`) sai antes do teste.
 * "Identificador com cara de código" exige camelCase, `a.b`, `T[]`, `T<U>` ou
 * `_`/`$`: palavra capitalizada solta ("Home | Sobre") é nav de rodapé, é copy,
 * e continua entrando. Ver fixture PropsDoc. */
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

/** true se a string parece texto de interface, e não className, path ou id. */
function looksLikeCopy(s) {
  /* Sem `trim()` aqui: o espaço em volta é justamente o que separa o separador
     (`" · "`, junta dois valores) do placeholder de vazio (`"—"`, substitui um
     valor). Trimar antes de testar apagava a evidência e os dois casavam. */
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
  /* Menos de duas palavras não é frase: mata sobra de assinatura de tipo
     ("| void;") que escapa pelo extrator de texto entre tags.

     A exceção existe porque copy de JSX chega PARTIDA: em
     `<span>{n} à vista · </span>` o fragmento que sobra é "à vista ·", que tem uma
     palavra só e carrega justamente a bolinha que o portão deveria acusar. Sem a
     exceção o detector dizia zero sobre um separador visível no header da home —
     falso negativo, que é o defeito grave: parece aprovação. Fragmento que carrega bolinha
     ou travessão conta como copy mesmo com uma palavra. O ponto-e-vírgula ficou
     FORA da exceção: sobra de assinatura de tipo (`(k: string): ;`) termina em `;`
     e voltaria como falso positivo — o fixture pegou isso na primeira tentativa. Lixo de tipo não
     entra por aqui porque CODEY e TYPE_SYNTAX já rodaram acima. */
  const CARREGA_VICIO = /[·—]/;
  if ((t.match(/\p{L}{2,}/gu) || []).length < 2 && !CARREGA_VICIO.test(t)) return false;
  if (/^[./#@]|^https?:|\.(tsx?|jsx?|css|json|svg|png|webp)$/i.test(t)) return false;
  if (/^[a-z0-9_.:-]+$/.test(t) && !/\s/.test(t)) return false; // id, chave, slug
  if (!/\s/.test(t) && !/[áàâãéêíóôõúüç]/i.test(t)) return false;
  return true;
}

function extractCopy(file) {
  const raw0 = readFileSync(isAbsolute(file) ? file : join(ROOT, file), 'utf8');
  const src = raw0.split(/\r?\n/);
  const out = {};
  let inBlockComment = false;
  /* Arquivo de metadata do Next: `title:` de objeto ali é título de documento.
     As DUAS formas contam. Só `export const metadata` deixava passar a rota
     dinâmica, que monta o título em `generateMetadata` com template
     (`` title: `${nome} | Visant® Studio` ``) — e era justamente ali que o
     portão acusava mais pipe. */
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

    /* Entidade HTML sai antes de qualquer regra: o `;` de `&quot;` não é
       pontuação, e o portão acusava ponto-e-vírgula em copy correta. */
    /* Lista fechada de entidade era gap garantido: `&quot;` estava lá e
       `&ldquo;`/`&rdquo;` não, então aspa curva em copy acusava ponto-e-vírgula
       (components/brand/steps/PublishStep.tsx). Entidade nomeada é um formato,
       então a regra passa a ser o formato. */
    line = line.replace(/&(?:[a-zA-Z][a-zA-Z0-9]{1,10}|#\d+|#x[0-9a-fA-F]+);/g, '"');

    /* Saída de desenvolvedor não é interface. `console.debug(`[render] ${ms}ms
       total · ${st}`)`, dentro de um bloco `NODE_ENV === "development"`, acusava
       bolinha — e bolinha em log é formatação de terminal, não vício de copy.
       Nenhum `console.*` chega no olho do usuário, então a chamada sai antes de
       qualquer extração. Corta da chamada até o fim da linha porque a chamada vai
       até o fim do statement, e copy depois de um console na MESMA linha não
       existe. Achado no audit da operação de cenas (mockup-store, 2026-08-06). */
    const devOut = line.search(/\bconsole\s*\.\s*[a-zA-Z]+\s*\(/);
    if (devOut !== -1) line = line.slice(0, devOut);
    if (!line.trim()) return;

    const key = `${file}:${i + 1}`;
    const found = [];

    /* Mascarar `{expr}` antes de olhar texto de JSX. Sem isso, a linha mais
       comum de copy do repo escapa inteira: `Acima de {fmt(X)} — obrigatória.`
       tem chave e parêntese, então o extrator de linha solta a descarta, e o de
       texto entre tags para no `{`. */
    let masked = line;
    for (let k = 0; k < 6; k++) {
      const next = masked.replace(/\{[^{}]*\}/g, '\u0001');
      if (next === masked) break;
      masked = next;
    }

    /* Segunda máscara, só da interpolação, e ela existe para os literais. A
       máscara de JSX acima come o `{...}` inteiro, mas copy de verdade mora
       DENTRO de expressão (um ternário com dois templates, por exemplo): com uma
       máscara só, a string do ternário nunca era extraída e o portão dizia
       "zero" sobre texto que ninguém tinha checado. Achado pelo fixture. */
    let interp = line;
    for (let k = 0; k < 6; k++) {
      const next = interp.replace(/\$\{[^{}]*\}/g, ' ');
      if (next === interp) break;
      interp = next;
    }
    const unmask = (s) => s.replace(/\u0001/g, ' ').replace(/\s+/g, ' ').trim();

    /* texto de JSX: o que sobra entre > e <, ou depois de > no fim da linha.
       O `>` de tag vem colado no que o antecede (`<span>`), o de comparação vem
       com espaço (`a > 0`), e `=>` e `>=` ficam de fora pelos lookarounds. */
    /* O  da lookbehind é a máscara de {expr}. Sem ele o extrator era cego
       pro formato mais comum de botão do repo: <button onClick={fn}>Texto</button>
       fecha a tag logo depois da máscara, então o caractere antes do > deixa de
       ser letra e a copy inteira nunca era lida. Falso NEGATIVO, o grave: o portão
       dizia zero sobre texto que ninguém tinha checado. Achado pelo fixture no
       audit do Gravador (jaques-os, 2026-08-05). */
    for (const m of masked.matchAll(/(?<=[A-Za-z0-9"'\]\/_-])>(?!=)([^<>]+)(?=<|$)/g)) {
      /* Corta no { que sobrou. JSX de várias linhas deixa a expressão ABERTA no
         fim da linha (`Aperte <b>Gravar</b> — ou {estado?.atalho`), e o candidato
         vinha com esse pedaço de código colado; o CODEY então descartava a frase
         inteira por causa da chave. Falso NEGATIVO: um travessão visível na tela
         passou pelo portão e só apareceu quando alguém ABRIU a página. Achado no
         audit do Gravador (jaques-os, 2026-08-05). */
      const cand = unmask(m[1]).split("{")[0].trim();
      if (GENERIC_TAIL.test(cand)) continue;
      if (looksLikeCopy(cand)) found.push(cand);
    }
    /* Texto solto de JSX multilinha. A linha não tem tag nenhuma pra ancorar,
       então o filtro é o inverso: nada de operador nem de identificador. Sigla
       em caixa alta passa de propósito (MEI, IRPF, DAS, COFINS são copy). */
    if (!/[<>]/.test(masked) && !/[*?+=;|&`_]|[a-z][A-Z]/.test(masked) && !OBJ_PROP.test(line)) {
      const cand = unmask(masked);
      if (looksLikeCopy(cand)) found.push(cand);
    }
    // prop de rótulo
    for (const m of line.matchAll(LABEL_PROPS)) {
      if (looksLikeCopy(m[3])) found.push(m[3]);
    }
    // literal em template ou string dentro de expressão de render
    for (const m of interp.matchAll(/[`'"]([^`'"]{6,})[`'"]/g)) {
      if (looksLikeCopy(m[1]) && /\s/.test(m[1]) && /[a-záéíóúãõç]{3}/i.test(m[1])) {
        found.push(m[1].trim());
      }
    }
    /* O separador puro, que o laço acima não alcança de dois jeitos: ele exige
       6 caracteres e 3 letras seguidas, e " · " não tem nem um nem outro. Ver
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

/* Extração de `.ts`: só o que o contrato diz que vira texto de tela. Ver
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
  if (!existsSync(script)) return { skipped: 'copy-lint do visant-copy não encontrado', findings: [] };
  if (!uiFiles.length && !libFiles.length) return { skipped: 'nenhum .tsx/.ts no alvo', findings: [] };

  /* Um JSON POR ARQUIVO, e não um bag do alvo inteiro. As regras de família do
     copy-lint contam por documento ("selo de credibilidade no máximo uma vez por
     página"), então juntar seis arquivos num JSON fazia a palavra aparecer uma
     vez em cada um e o portão acusar repetição que não existe. Achado com este
     bug: três arquivos diferentes, um "real" cada. */
  const perFile = [
    ...uiFiles.map((f) => [f, extractCopy(f)]),
    ...libFiles.map((f) => [f, extractLibCopy(f)]),
  ].filter(([, bag]) => Object.keys(bag).length);
  const bag = Object.fromEntries(perFile.flatMap(([, b]) => Object.entries(b)));
  const strings = Object.keys(bag).length;
  if (!strings) return { skipped: 'nenhuma string de interface extraída', findings: [], strings: 0 };

  // --dump mostra o que a extração considerou copy. Use quando o portão de copy
  // der um resultado que você não acredita, nos dois sentidos.
  if (args.includes('--dump')) {
    for (const [k, v] of Object.entries(bag)) console.log(`  ${k}  ${v}`);
  }

  const dir = mkdtempSync(join(tmpdir(), 'killer-copy-'));
  const findings = [];
  const voice = productVoice();
  if (voice.warn) findings.push(`(aviso) ${voice.warn}`);

  perFile.forEach(([file, fileBag], i) => {
    const jsonPath = join(dir, `copy-${i}.json`);
    writeFileSync(jsonPath, JSON.stringify(fileBag, null, 2), 'utf8');
    const r = spawnSync(process.execPath, [script, jsonPath], { cwd: ROOT, encoding: 'utf8' });
    const out = stripAnsi(`${r.stdout || ''}${r.stderr || ''}`);
    for (const line of out.split(/\r?\n/)) {
      const m = line.match(/^\s{2}([a-z-]+)\s{2,}(.+)$/);
      if (m && !/^(Como consertar|Aviso)/.test(m[1])) {
        const rule = m[1];
        // O produto declarou este delimitador como convenção própria. Ver productVoice().
        if (voice.rules.has(rule)) continue;
        // Título de documento não responde por delimitador. Ver DOC_TITLE_PROP.
        let locs = m[2].split(',').map((s) => s.trim()).filter(Boolean);
        if (DELIMITER_RULES.has(rule)) locs = locs.filter((l) => !l.includes(DOC_TITLE_MARK));
        if (!locs.length) continue;
        findings.push(`${locs.join(', ').split(DOC_TITLE_MARK).join('')}  ${rule}`);
      }
    }
    void file;
  });

  return { skipped: null, findings, strings };
}

/* ---------- rotas: o relatório é por TELA, não por arquivo ----------
 *
 * O `--init-report` cobrava uma linha por arquivo de interface quando o repo não
 * tem `page.tsx` (Vite + react-router). No visantlabs-os isso era 582 linhas
 * pra rodar o portão em `src/` — tabela que ninguém preenche, e portão que
 * ninguém preenche é portão pulado. A unidade de decisão do visant-frontend é a
 * ROTA (quem chega ali, o que ela move), então a tabela passa a ser uma linha
 * por rota, com o arquivo da página ao lado.
 *
 * Lê o roteador (`<Route path=… element={…}>`), resolve o componente da página
 * pelo import do próprio roteador (estático ou `lazy(() => import(…))`) e pede
 * ao arquivo de navegação (`navConfig`) a pista de shell de cada rota: o nome da
 * lista ou função que menciona aquele caminho (`isMarketing`,
 * `BRAND_EDITOR_PREFIXES`…). A pista vai em coluna própria e NUNCA preenche a
 * superfície: classificar continua sendo trabalho de quem audita.
 *
 * Sem roteador, volta ao comportamento antigo (arquivo `page|layout|template`, e
 * na falta deles, todo arquivo de interface do alvo).
 */
const ROUTER_CANDIDATES = [
  'src/App.tsx', 'src/App.jsx', 'src/routes.tsx', 'src/router.tsx',
  'src/routes/index.tsx', 'src/router/index.tsx', 'src/main.tsx', 'App.tsx',
];
const NAV_CANDIDATES = ['src/config/navConfig.ts', 'src/config/nav.ts', 'src/navConfig.ts', 'src/lib/nav.ts'];
/* Embrulho de rota: portão, provedor, limite de erro. A página é o que sobra. */
const WRAPPER = /(Gate|Guard|Provider|Boundary|Wrapper|Suspense|Protected\w*|RequireAuth\w*|Layout|Shell|Fragment)$/;

/** Fim de uma tag JSX começando em `i` (`<Route …>` ou `<Route … />`), contando chaves. */
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

/** Valor de `attr={…}` com chaves balanceadas. */
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
  /* nome local -> arquivo, pelos imports do próprio roteador */
  const arquivoDe = new Map();
  for (const d of g.deps.get(routerFile) ?? []) for (const n of d.nomes) arquivoDe.set(n, d.para);

  const rotas = [];
  const redirecionamentos = [];
  for (const m of src.matchAll(/<Route\b/g)) {
    const tag = src.slice(m.index, fimDaTag(src, m.index) + 1);
    const p = tag.match(/\bpath\s*=\s*(?:"([^"]+)"|'([^']+)'|\{\s*["'`]([^"'`]+)["'`]\s*\})/);
    const caminho = p ? (p[1] ?? p[2] ?? p[3]) : /\bindex\b/.test(tag) ? '(index)' : null;
    if (!caminho) continue; // rota de layout sem path: o filho é que é a tela
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
    /* sem import: componente definido no próprio roteador (ex.: `HomeRoute`) */
    rotas.push({ caminho, componente: nome, arquivo: arquivoDe.get(nome) ?? routerFile });
  }
  return { routerFile, rotas, redirecionamentos };
}

/** Pista de shell pelo arquivo de navegação: quem menciona este caminho. */
function lerNav(root, navRel = null) {
  const rel = navRel ?? NAV_CANDIDATES.find((r) => existsSync(join(root, r)));
  if (!rel) return null;
  const src = semComentario(readFileSync(join(root, rel), 'utf8'));
  /* só símbolo de topo (coluna 0): o `const clean` de dentro de uma função não é pista de shell */
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
        /* prefixo cru, como o código faz: `p.startsWith('/thank-you')` cobre `/thank-you-pro` */
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
 * As telas que o alvo cobra: `page|layout|template` (Next), senão as rotas do
 * roteador cuja página está no alvo, senão todo arquivo de interface do alvo.
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

/* ---------- self-test do extrator ---------- */

/**
 * O extrator é heurística, então ele precisa de prova nos DOIS sentidos: string
 * extraída que não era copy (falso positivo, enche a tela e a pessoa desliga o
 * portão) e copy que nunca foi extraída (falso negativo, o portão diz "zero"
 * sobre texto que ninguém checou — o pior dos dois, porque parece sucesso).
 *
 * O fixture carrega o contrato dentro dele: linha com EXTRAI deve sair, linha
 * com IGNORA não. Cada caso lá já mordeu de verdade.
 */
function runSelfTest() {
  const here = dirname(fileURLToPath(import.meta.url));
  const fixture = join(here, 'fixtures', 'copy-extractor.tsx');
  if (!existsSync(fixture)) {
    console.error(`fixture não encontrado: ${fixture}`);
    process.exit(2);
  }

  /* Dois fixtures, um contrato. O de `.ts` entrou depois, quando se descobriu que copy
     escrita em lib e renderizada pela tela nunca tinha sido varrida — falso negativo,
     que é o grave: o portão dizia zero sobre texto que ninguém checou. */
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
  /* As linhas de cada fixture são contadas do 1, então a marcação vai por
     `arquivo:linha` e a varredura de falso negativo percorre cada arquivo com o seu
     próprio offset. Misturar os dois num índice só acusaria linha errada. */
  const extractedByFile = new Map();
  for (const key of Object.keys(bag)) {
    const clean = key.split(DOC_TITLE_MARK).join('');
    const file = clean.slice(0, clean.lastIndexOf(':'));
    if (!extractedByFile.has(file)) extractedByFile.set(file, new Set());
    extractedByFile.get(file).add(lineOf(key));
  }

  const falsePositives = [];
  for (const [key, value] of Object.entries(bag)) {
    /* A exceção do separador puro.
     *
     * O contrato normal é que a palavra EXTRAI viaje DENTRO da copy, e é isso que
     * prova que a frase certa foi extraída. Um separador (" · ") não tem palavra
     * nenhuma — é a definição do caso —, então ele nunca pode satisfazer essa
     * checagem, e sem esta exceção o fixture do caso acusaria o próprio conserto
     * como falso positivo.
     *
     * Não abre buraco: a varredura por LINHA logo abaixo continua exigindo o
     * marcador na linha (EXTRAI que não sai vira falso negativo, IGNORA que sai
     * vira falso positivo). Para o separador, o marcador de linha é a única prova
     * possível — e continua sendo prova. */
    if (!value.includes('EXTRAI') && !SO_SEPARADOR_COM_VICIO.test(value)) {
      falsePositives.push(`linha ${lineOf(key)}: ${value}`);
    }
    /* Contaminação: o nome da chave e as aspas vieram junto com a frase. Sem
       esta asserção o fixture só provava que a linha foi extraída, e a extração
       dobrada passava batida — que é como o bug do selo de credibilidade
       sobreviveu. Falso positivo que parece sucesso é o pior. */
    if (/[A-Za-z_$][\w$]*\s*:\s*['"`]/.test(value)) {
      falsePositives.push(`linha ${lineOf(key)}: veio com a chave junto -> ${value}`);
    }
    // Extração dobrada: a mesma frase duas vezes dentro do mesmo valor.
    const words = value.split(/\s+/);
    if (words.length >= 8 && words.slice(0, 4).join(' ') === words.slice(4, 8).join(' ')) {
      falsePositives.push(`linha ${lineOf(key)}: frase extraída em dobro -> ${value}`);
    }
  }

  const falseNegatives = [];
  const sweep = (path, lines) => {
    const extracted = extractedByFile.get(norm(path)) ?? extractedByFile.get(path) ?? new Set();
    lines.forEach((line, i) => {
      // Só linhas de código: o cabeçalho do fixture explica o contrato e cita as
      // duas palavras dentro de comentário.
      // `{/* ... */}` conta como comentário: no fixture ele é a anotação do caso
      // seguinte, e comentário nunca é copy.
      const isComment = /^\s*(\{\s*)?(\/\/|\*|\/\*)/.test(line);
      if (isComment) return;
      if (line.includes('EXTRAI') && !extracted.has(i + 1)) {
        falseNegatives.push(`${path.split(/[\\/]/).pop()} linha ${i + 1}: ${line.trim()}`);
      }
      if (line.includes('IGNORA') && extracted.has(i + 1)) {
        falsePositives.push(`${path.split(/[\\/]/).pop()} linha ${i + 1}: marcada IGNORA e foi extraída`);
      }
    });
  };
  sweep(fixture, readFileSync(fixture, 'utf8').split(/\r?\n/));
  if (existsSync(libFixture)) sweep(libFixture, readFileSync(libFixture, 'utf8').split(/\r?\n/));

  const total = Object.keys(bag).length;
  console.log(`\nself-test do extrator de copy  (${total} string(s) extraída(s) do fixture)\n`);

  if (falsePositives.length) {
    console.log(`[FALHA] falso positivo: ${falsePositives.length}`);
    for (const f of falsePositives) console.log(`          ${f}`);
  } else {
    console.log('[OK]    nenhum falso positivo');
  }

  if (falseNegatives.length) {
    console.log(`[FALHA] falso negativo: ${falseNegatives.length}`);
    for (const f of falseNegatives) console.log(`          ${f}`);
  } else {
    console.log('[OK]    nenhum falso negativo');
  }

  /*
   * O leitor de rotas do `--init-report`, contra `fixtures/rotas/`: página
   * importada, página lazy atrás de um portão, página definida no próprio
   * roteador, redirecionamento, rota de layout sem path, rota comentada — e a
   * armadilha do `/*` dentro de comentário de linha no navConfig.
   */
  const rotasFalhas = [];
  {
    const raiz = join(here, 'fixtures', 'rotas');
    const lidas = lerRotas(raiz);
    const nav = lerNav(raiz);
    const fim = (f) => f.split('/').slice(-2).join('/');
    const got = (lidas?.rotas ?? []).map((r) => `${r.caminho}=${fim(r.arquivo)}`).join(' ');
    const want = '/=src/App.tsx /pricing=pages/Pricing.tsx /canvas/:id=pages/Canvas.tsx';
    if (got !== want) rotasFalhas.push(`rotas: esperado "${want}", veio "${got}"`);
    const red = (lidas?.redirecionamentos ?? []).map((r) => `${r.caminho}>${r.para}`).join(' ');
    if (red !== '/old>/pricing') rotasFalhas.push(`redirecionamentos: esperado "/old>/pricing", veio "${red}"`);
    for (const [p, w] of [['/pricing', 'nav: isMarketing'], ['/login', 'nav: isMarketing'], ['/canvas/:id', 'nav: EDITOR_PREFIXES']]) {
      const d = nav?.dica(p) ?? '(sem nav)';
      if (d !== w) rotasFalhas.push(`dica(${p}): esperado "${w}", veio "${d}"`);
    }
  }
  if (rotasFalhas.length) {
    console.log(`[FALHA] leitor de rotas: ${rotasFalhas.length}`);
    for (const f of rotasFalhas) console.log(`          ${f}`);
  } else {
    console.log('[OK]    leitor de rotas (3 rotas, 1 redirecionamento, pista de shell)');
  }

  /*
   * The built-in token fallback, both ways: it must fire on the dirty fixtures
   * (every ACUSA line flagged, no CALA line flagged) and stay silent on the
   * clean ones and on a theme file full of raw colors.
   */
  const tokenFalhas = [];
  {
    const fx = (n) => norm(join(here, 'fixtures', n));
    const sujos = ['token-fallback-sujo.tsx', 'token-fallback-sujo.css'].map(fx);
    const limpos = ['token-fallback-limpo.tsx', 'token-fallback-limpo.css', 'token-fallback-theme.css'].map(fx);
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
    }
  }
  if (tokenFalhas.length) {
    console.log(`[FALHA] token fallback: ${tokenFalhas.length}`);
    for (const f of tokenFalhas) console.log(`          ${f}`);
  } else {
    console.log('[OK]    token fallback (fires on the dirty fixtures, silent on clean and theme files)');
  }

  const failed = falsePositives.length + falseNegatives.length + rotasFalhas.length + tokenFalhas.length;
  console.log('-'.repeat(64));
  console.log(
    failed
      ? 'EXTRATOR QUEBRADO. Conserte antes de confiar em qualquer "zero" do portão de copy.'
      : 'EXTRATOR OK. Caso novo que escapar: acrescente no fixture, nunca substitua.'
  );
  console.log('-'.repeat(64));
  process.exit(failed ? 1 : 0);
}

if (selfTest) runSelfTest();

/* ---------- portão 0: superfícies e tela vista ---------- */

/* Este portão existe por dois relatos da mesma falha.
 *
 * O primeiro: alguém rodou motion-lint e refine-scan, viu os dois zerados, e
 * chamou de passada completa — pulou o visant-frontend sem perceber. Não foi
 * descuido. Os outros dois terminam em script, e script dá sensação de
 * acabamento; o visant-frontend terminava numa PERGUNTA, que não tem exit code.
 * Agente sempre gravita pro que fecha em zero.
 *
 * O segundo: um bug de AnimatePresence travou o passo de um formulário de
 * captação e passou por tsc, ESLint, motion-lint, impeccable, audit:design e
 * copy-lint. Seis portões verdes numa tela que ninguém abriu.
 *
 * A conclusão dos dois é a mesma: regra que depende de disciplina de quem lê
 * falha na rota 40. Então a classificação das superfícies e o registro de ter
 * ABERTO a tela viram artefato que o script confere, e sem eles nenhuma
 * execução pode imprimir PORTÃO ABERTO. */

const SURFACE_RE = /\b(A|B|C)\b/;

function readReport(path) {
  const abs = resolve(path);
  if (!existsSync(abs)) return { fatal: `relatório não existe: ${abs}` };
  const text = readFileSync(abs, 'utf8');

  /*
   * Tabelas markdown, lidas PELO CABEÇALHO.
   *
   * O formato antigo era posicional (`| arquivo | superfície | variável |`), e
   * continua aceito. O novo, por rota, é `| Rota | Arquivo | Superfície |
   * Variável | Shell | Notas |`: ler por posição pegaria o arquivo como
   * superfície e acusaria a tabela inteira de vazia. O cabeçalho diz onde está
   * cada coisa; tabela sem coluna de superfície no cabeçalho (a de "Tela
   * vista", por exemplo) cai no posicional, como sempre caiu.
   */
  const linhasMd = text.split(/\r?\n/);
  const celulas = (l) => l.split('|').slice(1, -1).map((c) => c.trim());
  const ehSeparador = (l) => /^\s*\|[\s|:-]+\|\s*$/.test(l);
  const rows = [];
  let cols = null;
  for (let i = 0; i < linhasMd.length; i++) {
    const l = linhasMd[i];
    if (!l.trim().startsWith('|')) { cols = null; continue; } // tabela acabou
    if (ehSeparador(l)) continue;
    const c = celulas(l);
    if (ehSeparador(linhasMd[i + 1] ?? '')) {
      const idx = (re) => c.findIndex((x) => re.test(x));
      const sup = idx(/superf|surface/i);
      cols = sup === -1 ? null : {
        rota: idx(/^(rota|route|tela)$/i),
        arquivo: idx(/^(arquivo|file|componente|p[aá]gina)$/i),
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
    if (!cc && (cells.length < 3 || /^(arquivo|rota|file|componente)$/i.test(cells[0]))) continue;
    const rota = cc ? pick('rota') : '';
    const what = cc ? pick('arquivo') || rota : cells[0];
    const surface = (cc ? pick('sup') : cells[1]) ?? '';
    const variable = (cc ? pick('vari') : cells[2]) ?? '';
    if (!what || !SURFACE_RE.test(surface)) continue;
    /* Variável de negócio vazia, "?" ou "TBD" não conta: a tabela existe pra
       forçar a frase "este elemento move X". Preencher com traço é a versão
       burocrática de pular o passo. */
    if (!variable || /^[-–—?]+$/.test(variable) || /^(tbd|a definir|n\/a)$/i.test(variable)) continue;
    /* Chave = rota quando há: duas rotas da mesma página são duas linhas. */
    classified.set(rota || norm(what), { arquivo: norm(what), rota, surface: surface.match(SURFACE_RE)[1], variable });
  }

  /* Era `(?=^##\s|\Z)`. JavaScript não tem `\Z` — a engine lê como a LETRA "Z",
     e com a flag `i` isso casa com qualquer "z" minúsculo. O `[\s\S]*?` é
     preguiçoso, então a seção era cortada no primeiro "z" que aparecesse. Em
     português isso é quase imediato: um relatório com 7 telas registradas
     contava 1, e a mensagem do portão subnotificava exatamente a evidência que
     ele existe pra exigir. `$(?![\s\S])` é o fim-de-texto de verdade sob `m`. */
  const seenSection = text.match(/^##+[ \t]*Tela vista[\s\S]*?(?=^##[ \t]|$(?![\s\S]))/im)?.[0] ?? '';
  /* Bullet OU linha de tabela.
   *
   * O SKILL.md pede "uma linha por tela, com rota, largura, estado do dado e o
   * que aconteceu" — quatro campos, que em markdown é uma TABELA. O parser só
   * aceitava bullet, entao um relatorio escrito exatamente como a skill manda
   * era lido como zero telas vistas, e o portao acusava de nao ter aberto a
   * tela justamente quem tinha aberto e registrado direito. Ferramenta que
   * cobra um formato e le outro ensina a fraudar o formato. */
  const seen = seenSection
    .split(/\r?\n/)
    .filter((l) => {
      const t = l.trim();
      if (/^[-*]\s+\S/.test(t)) return true;
      if (!t.startsWith('|')) return false;
      if (/^\|[\s|:-]+\|$/.test(t)) return false;
      const cells = t.split('|').slice(1, -1).map((c) => c.trim());
      return cells.length >= 2 && cells[0] && !/^(rota|tela|url|caminho)$/i.test(cells[0]);
    })
    .map((l) => l.trim().replace(/^[-*]\s+/, '').replace(/^\|/, '').replace(/\|$/, '').trim());

  return { classified, seen, text };
}

function gateZero(reportPath) {
  if (!reportPath) {
    return {
      ok: false,
      why: [
        'nenhum relatório passado (--report <arquivo.md>)',
        'sem a classificação das superfícies isto é uma passada de linter, não uma auditoria',
      ],
    };
  }

  const r = readReport(reportPath);
  if (r.fatal) return { ok: false, why: [r.fatal] };

  const why = [];

  /* Toda tela do alvo precisa de linha. Componente folha herda a superfície da
     rota, então só arquivo de interface de topo é cobrado — cobrar cada botão
     transformaria a tabela em burocracia e ela deixaria de ser lida. */
  const { cobrados, porRota } = telasDoAlvo();
  const arquivosClassificados = [...r.classified.values()].map((v) => v.arquivo);
  const casa = (f, k) => f.endsWith(k) || k.endsWith(f) || f.includes(k);
  let faltando;
  if (porRota) {
    /* Por rota: cada rota do alvo precisa da sua linha (pela rota ou, em
       relatório antigo, pelo arquivo da página). */
    const rotasClass = new Set([...r.classified.values()].map((v) => v.rota).filter(Boolean));
    faltando = porRota
      .filter((x) => !rotasClass.has(x.caminho) && !arquivosClassificados.some((k) => !rotasClass.size && casa(x.arquivo, k)))
      .map((x) => `${x.caminho}  (${disp(x.arquivo)})`);
  } else {
    faltando = cobrados.filter((f) => !arquivosClassificados.some((k) => casa(f, k))).map(disp);
  }

  if (faltando.length) {
    why.push(`${faltando.length} ${porRota ? 'rota(s)' : 'alvo(s)'} sem linha na tabela de superfícies:`);
    for (const f of faltando.slice(0, 12)) why.push(`    ${f}`);
    if (faltando.length > 12) why.push(`    ... e ${faltando.length - 12} a mais`);
  }

  if (!r.seen.length) {
    why.push('sem seção "## Tela vista": nenhuma evidência de que a tela foi ABERTA');
    why.push('    portão verde não é tela vista — um AnimatePresence travado passa por todos eles');
  }

  return { ok: !why.length, why, classified: r.classified, seen: r.seen };
}

/* --init-report: o esqueleto já vem com uma linha por tela do alvo. O atrito de
   montar a tabela na mão é exatamente o motivo de todo mundo pular esse passo,
   e um passo que se pula não é um portão. */
if (initReport) {
  const abs = resolve(initReport);
  if (existsSync(abs)) {
    console.error(`já existe: ${abs} — não vou sobrescrever.`);
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
    cabecalho = '| Rota | Arquivo | Superfície (A/B/C) | Variável de negócio que move | Shell | Notas |\n|---|---|---|---|---|---|';
    if (telas.redirecionamentos?.length) {
      extra = `\nRedirecionamentos (sem tela própria, não entram na tabela): ${telas.redirecionamentos
        .map((x) => `\`${x.caminho}\` vai pra \`${x.para}\``)
        .join(', ')}.\n`;
    }
    extra += `\nRotas lidas de \`${disp(telas.router)}\`${nav ? `; a coluna Shell é a pista de \`${nav.arquivo}\` (quem menciona o caminho), não a classificação` : ''}.\n`;
  } else {
    rows = telas.cobrados.map((f) => `| ${disp(f)} |  |  |  |`);
    cabecalho = '| Arquivo | Superfície (A/B/C) | Variável de negócio que move | Notas |\n|---|---|---|---|';
  }
  writeFileSync(
    abs,
    `# Auditoria — ${targets.join(', ')}

## Superfícies

Uma linha por tela. **Preencha antes de consertar qualquer coisa.** Classificar
depois de mexer é justificar o que já foi feito.

- **A aquisição** — quem não é cliente ainda. Persuadir, provar, converter.
- **B trabalho** — quem usa todo dia. Velocidade, densidade, teclado.
- **C confiança** — dinheiro, permissão, ação destrutiva. Não pode mentir.

Aplicar instinto de A numa tela B é o erro mais caro do frontend Visant.

${cabecalho}
${rows.join('\n')}
${extra}
## Tela vista

Uma linha por tela ABERTA, com o que foi visto. Sem isto o portão não abre —
um AnimatePresence travado passa por tsc, ESLint, motion-lint, impeccable,
audit:design e copy-lint sem acender nada.

Cada linha carrega: rota, largura, estado do dado, e o que aconteceu.
Antes de medir qualquer coisa, confira que a página hidratou (veja
\`visant-killer/references/ambiente.md\`) — metade dos achados de uma sessão
foram o dev server mentindo, não a tela.

-

## Achados

`,
    'utf8',
  );
  console.log(`esqueleto criado: ${abs}`);
  console.log(`${rows.length} linha(s) de superfície pré-preenchida(s). Preencha e rode:`);
  console.log(`  node killer-scan.mjs --report ${initReport} ${targets.join(' ')}`);
  process.exit(0);
}

/* ---------- detector 4: ruído de cromo ---------- */

/**
 * Poluição de interface: cromo que ninguém pediu.
 *
 * Delegado a `ruido-scan.mjs`, que roda sozinho também. Aqui ele entra no
 * placar para que "portão aberto" passe a exigir também uma tela SEM excesso
 * de texto de apoio — não só uma tela sem bug.
 */
function runRuido() {
  const achados = scanRuido(uiFiles);
  return {
    findings: achados.map(
      (a) => `${a.file}:${a.linha}  ${a.regra}  ${a.amostra}`,
    ),
  };
}

/* ---------- placar ---------- */

/*
 * O quarto detector, e o que os outros três nao viam.
 *
 * Os tres primeiros olham CODIGO (tell de IA), TOKEN (cor crua) e FRASE (vicio
 * de voz). Nenhum deles soma. O defeito que sobrava era a tela inteira correta
 * e ilegivel de tanto texto de apoio: rotulo em caixa-alta em todo trecho,
 * instrucao de uso ao lado de um controle que ja tem afordancia, a mesma
 * informacao dita em tres tamanhos. Cada linha dessas, sozinha, e defensavel;
 * o dano e o acumulado, e por isso nenhum linter de linha pegava.
 */
const gates = [
  { id: 'impeccable   (tell de IA)', ...runImpeccable() },
  { id: 'audit:design (token)     ', ...runAuditDesign() },
  { id: 'copy         (vício)     ', ...runCopy() },
  { id: 'ruído        (cromo)     ', ...runRuido() },
];

let failed = 0;
const bar = '-'.repeat(64);

if (!quiet) {
  console.log(`\nkiller-scan  alvo: ${targets.join(' ')}`);
  console.log(`arquivos no alvo: ${files.length} (${uiFiles.length} de interface)\n`);
}

for (const g of gates) {
  if (g.skipped) {
    console.log(`[PULADO] ${g.id}  ${g.skipped}`);
    continue;
  }
  if (g.findings.length) {
    failed++;
    console.log(`[FALHA]  ${g.id}  ${g.findings.length} achado(s)`);
    // --all lista tudo: com o corte em 40 não dá pra dividir a limpeza por arquivo.
    const cap = args.includes('--all') ? Infinity : 40;
    if (!quiet) for (const f of g.findings.slice(0, cap)) console.log(`           ${f}`);
    if (!quiet && g.findings.length > cap) console.log(`           ... e ${g.findings.length - cap} a mais`);
  } else {
    const extra = g.strings != null ? ` (${g.strings} string(s) de interface)` : '';
    console.log(`[OK]     ${g.id}  zero${extra}`);
  }
  if (g.via && !quiet) console.log(`           via ${g.via}`);
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

/* ---------- --roots: raiz primeiro ----------
 *
 * A lista do portão é por arquivo, na ordem em que os detectores acham. Isso
 * manda consertar primeiro a página que a pessoa abriu — e o defeito que mora
 * num componente de `ui/` importado por 68 telas volta na próxima que usa a
 * mesma peça. A rodada 1 do slop killer (2026-10-05) consertou `Thumb`,
 * `PageShell` e `GlassPanel` DEPOIS de dezenas de telas, uma por uma, quando
 * consertar a peça primeiro teria levado metade dos achados de uma vez.
 *
 * `--roots` junta os achados de TODOS os detectores pelo arquivo onde moram e
 * ranqueia os arquivos COMPARTILHADOS (em `components/ui`, `components/shared`
 * ou `lib/ui`, ou importados por 5+ arquivos) por fan-out × achados. Fan-out é
 * quantos arquivos do projeto importam a peça — medido no projeto inteiro, não
 * no recorte, porque a tela que herda o defeito pode estar fora do alvo.
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
    console.log('RAIZ PRIMEIRO: nenhum achado em peça compartilhada. Os achados são locais de cada tela.');
  } else {
    console.log('RAIZ PRIMEIRO: conserte estes antes das telas (achados × arquivos que importam a peça)');
    console.log(`  ${'score'.padStart(6)}  ${'fan-out'.padStart(7)}  ${'achados'.padStart(7)}  arquivo  (por detector)`);
    const cap = args.includes('--all') ? Infinity : 15;
    for (const x of lista.slice(0, cap)) {
      const dets = [...x.dets].map(([d, n]) => `${d} ${n}`).join(', ');
      console.log(`  ${String(x.score).padStart(6)}  ${String(x.fan).padStart(7)}  ${String(x.achados).padStart(7)}  ${disp(x.file)}  (${dets})`);
    }
    if (lista.length > cap) console.log(`  ... e ${lista.length - cap} a mais (--all lista tudo)`);
  }
}

const g0 = gateZero(reportPath);

console.log(bar);
if (failed) {
  console.log(`PORTÃO FECHADO: ${failed} detector(es) com achado. Achado de portão vira conserto, não proposta.`);
} else if (!g0.ok) {
  /* Detector zerado com portão 0 aberto NÃO é "aberto". Esta é a linha inteira
     do conserto: o placar não pode mais dizer a palavra que faz o agente parar. */
  console.log('PORTÃO INCOMPLETO: os detectores passaram, mas isto ainda não é uma auditoria.');
  for (const w of g0.why) console.log(`  ${w}`);
  console.log('');
  console.log(`  gere o esqueleto:  node killer-scan.mjs --init-report AUDIT.md ${targets.join(' ')}`);
  console.log(`  depois de preencher: node killer-scan.mjs --report AUDIT.md ${targets.join(' ')}`);
} else {
  const skipped = gates.filter((g) => g.skipped).length;
  const porSup = [...g0.classified.values()].reduce((a, c) => ((a[c.surface] = (a[c.surface] ?? 0) + 1), a), {});
  console.log(`PORTÃO ABERTO${skipped ? ` (com ${skipped} pulado, reporte isso)` : ''}.`);
  console.log(
    `  superfícies classificadas: ${g0.classified.size} ` +
      `(${Object.entries(porSup).map(([k, v]) => `${k}:${v}`).join('  ')})`,
  );
  console.log(`  telas registradas como vistas: ${g0.seen.length}`);
  /*
   * A LISTA DO QUE FALTA é o único lugar onde o `corta-scan` aparece sem alguém
   * ter lido o SKILL.md inteiro — e ele mede justamente o que o portão não vê:
   * palavra cortada e overlay empilhado, que só existem com a tela aberta.
   */
  console.log('  Falta: tsc, lint, 390px com dado real, backend parado, e o');
  console.log('         corta-scan.js na tela aberta (texto cortado / overlay empilhado).');
}
console.log(bar);
process.exit(failed || !g0.ok ? 1 : 0);
