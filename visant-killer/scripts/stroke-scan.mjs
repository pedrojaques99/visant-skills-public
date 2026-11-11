#!/usr/bin/env node
/**
 * stroke-scan: interface strokes thicker than a hairline.
 *
 * Why it exists. In a first-run redesign (Tucano, 2026-11-11) every card had a
 * 1.5–2px outline, the radio had a 2px ring, the focus halo was 3px, and
 * selection was said by weight. The owner called it "classic design slop". No
 * detector saw it: the tokens were right and the scanners count text and boxes,
 * not stroke weight. The rule that came out of it: 1px for chrome, selection by
 * color (accent mixed into the border, a tint behind), never by weight.
 *
 * Reads CSS, SCSS, JS/TS style objects, Tailwind classes in JSX/TSX/Vue/Svelte/
 * Astro/HTML, and the shadcn defaults that ship with them (`focus-visible:ring-[3px]`).
 *
 *   heavy-border   border / border-width over 1px (CSS, style object, border-2, border-[1.5px])
 *   heavy-ring     ring-2+, box-shadow `0 0 0 Npx` with N > 1
 *   heavy-outline  outline over 1px outside focus
 *   heavy-focus    focus ring or outline over 2px (2px is the accessible focus
 *                  indicator and passes; the 3px halo does not)
 *
 * Passes without a marker: 0 and 1px, sub-pixel hairlines, focus rings up to 2px
 * (WCAG 2.4.7 needs a visible focus), the `border-2 … animate-spin` spinner.
 * Anything else over 1px carries a written reason, in the same contract as every
 * killer scanner: `EXCEPTION to stroke-scan/<rule>: reason` (or `EXCEÇÃO ao`) on
 * the line or up to 8 above, 8+ letters of reason; whole file:
 * `stroke-ignore-file: <rule>, reason`. Chart rings, an active tab bar and a
 * drawn illustration are typical reasons.
 *
 *   node stroke-scan.mjs <files-or-folders...>
 *   node stroke-scan.mjs --self-test
 *
 * Exit 0 clean, 1 findings, 2 could not read.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EXT = /\.(css|scss|sass|less|tsx|jsx|ts|js|mjs|vue|svelte|astro|html)$/;
const IGNORA = new Set(['node_modules', 'dist', 'build', '.next', '.nuxt', '.svelte-kit', 'coverage', '.git', 'out', '.turbo']);
const JANELA = 8;
const RULES = ['heavy-border', 'heavy-ring', 'heavy-outline', 'heavy-focus'];

function walk(p, out = []) {
  const st = fs.statSync(p);
  if (st.isFile()) {
    if (EXT.test(p) && !/\.min\.(css|js)$/.test(p) && !/\.d\.ts$/.test(p)) out.push(p);
    return out;
  }
  for (const e of fs.readdirSync(p)) {
    if (IGNORA.has(e)) continue;
    walk(path.join(p, e), out);
  }
  return out;
}

const px = (s) => Number.parseFloat(s);
const letras = (s) => (s.match(/\p{L}/gu) ?? []).length;

/* `EXCEPTION to stroke-scan/<rule>: reason`, same line or up to 8 above, reason 8+ letters. */
function liberado(linhas, i, regra) {
  const re = new RegExp(String.raw`(?:EXCE(?:Ç|C)(?:Ã|A)O|EXCEPTION)\s+(?:ao|to)\s+\x60?stroke-scan/${regra}(?![\w-])\x60?\s*:\s*(.*)`, 'i');
  for (let k = i; k >= Math.max(0, i - JANELA); k--) {
    const m = (linhas[k] ?? '').match(re);
    if (m && letras(m[1].replace(/\*\/\}?\s*$/, '')) >= 8) return true;
  }
  return false;
}
function ignoradoNoArquivo(src, regra) {
  const m = src.match(/stroke-ignore-file:\s*([\w-]+)\s*,\s*(.+)/);
  return !!m && m[1] === regra && letras(m[2]) >= 8;
}

/* Tailwind: `[variant:]*(border|ring|outline)[-side]-(N|[Npx])` */
const RE_TW = /(?<![\w-])((?:[\w-]+(?:\[[^\]]*\])?:)*)(border|ring|outline)(?:-(?:x|y|t|r|b|l|s|e))?-(\d+(?:\.\d+)?|\[(\d*\.?\d+)px\])(?![\w-]|\/)/g;
/* CSS / style objects */
const RE_CSS_BORDER = /\bborder(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?(?:-width)?\s*:\s*['"`]?([^;'"`\n}]*)/gi;
const RE_JS_BORDERW = /\bborder(?:Top|Right|Bottom|Left)?Width\s*:\s*['"`]?(\d*\.?\d+)/g;
const RE_OUTLINE = /\boutline(?:-width)?\s*:\s*['"`]?([^;'"`\n}]*)/gi;
const SUPERFICIE = /var\(--(?:[\w-]*-)?(?:bg|background|panel|surface|card|paper|canvas|page|base|field)\b(?![\w-]*-(?:soft|tint))/;
const RE_SHADOW_RING =/(?<!-)\b0[\s_]+0[\s_]+0[\s_]+(\d*\.?\d+)px/g;

function primeiroPx(valor) {
  const m = valor.match(/(\d*\.?\d+)px/);
  if (m) return px(m[1]);
  if (/\b(thick|medium)\b/.test(valor)) return 3;
  return null;
}

export function scanSource(src, arquivo = '') {
  const linhas = src.split(/\r?\n/);
  const css = /\.(css|scss|sass|less)$/.test(arquivo);
  const out = [];
  let seletor = '';
  let emComentario = false;
  const add = (regra, i, valor, amostra) => {
    if (ignoradoNoArquivo(src, regra) || liberado(linhas, i, regra)) return;
    out.push({ arquivo, linha: i + 1, regra, valor, amostra: amostra.trim().slice(0, 140) });
  };
  linhas.forEach((cru, i) => {
    /* strip comments so a marker or a commented-out rule never fires */
    let linha = '';
    let s = cru;
    while (s.length) {
      if (emComentario) {
        const f = s.indexOf('*/');
        if (f < 0) { s = ''; break; }
        s = s.slice(f + 2); emComentario = false;
      } else {
        const a = s.indexOf('/*');
        const b = css ? -1 : s.search(/(?<![:'"\w])\/\//);
        if (a < 0 && b < 0) { linha += s; break; }
        if (b >= 0 && (a < 0 || b < a)) { linha += s.slice(0, b); break; }
        linha += s.slice(0, a); s = s.slice(a + 2); emComentario = true;
      }
    }
    if (!linha.trim()) return;
    if (css && linha.includes('{') && !/^\s*@/.test(linha)) seletor = linha.slice(0, linha.indexOf('{')).trim() || seletor;
    const focoCss = css && /:focus/.test(seletor);
    const spinner = /animate-spin|spinner|@keyframes\s+spin/i.test(linha) || (css && /spin/i.test(seletor));

    if (!css || /@apply/.test(linha)) {
      for (const m of linha.matchAll(RE_TW)) {
        const variantes = m[1] ?? '';
        const kind = m[2];
        const v = m[4] !== undefined ? px(m[4]) : px(m[3]);
        if (!(v > 1)) continue;
        const foco = /(^|:)(focus|focus-visible|focus-within|group-focus|peer-focus)[\w-]*:/.test(variantes);
        if ((kind === 'ring' || kind === 'outline') && foco) {
          if (v > 2) add('heavy-focus', i, `${v}px`, linha);
          continue;
        }
        if (kind === 'border' && spinner) continue;
        if (kind === 'ring' && /(?<![\w-])ring-(?:background|card|panel|surface|bg|paper|canvas)\b/.test(linha)) continue;
        add(kind === 'border' ? 'heavy-border' : kind === 'ring' ? 'heavy-ring' : 'heavy-outline', i, `${v}px`, linha);
      }
    }
    for (const m of linha.matchAll(RE_CSS_BORDER)) {
      if (/border-(?:radius|color|style|collapse|spacing|image)/i.test(m[0])) continue;
      /* a transparent border is reserved space (no jump when it lights up), not a stroke */
      if (/\btransparent\b/.test(m[1])) continue;
      const v = primeiroPx(m[1]);
      if (v > 1 && !spinner) add('heavy-border', i, `${v}px`, linha);
    }
    for (const m of linha.matchAll(RE_JS_BORDERW)) {
      const v = px(m[1]);
      if (v > 1 && !spinner) add('heavy-border', i, `${v}px`, linha);
    }
    for (const m of linha.matchAll(RE_OUTLINE)) {
      if (/outline-(?:offset|color|style)/i.test(m[0])) continue;
      const v = primeiroPx(m[1]);
      if (!(v > 1)) continue;
      if (focoCss) { if (v > 2) add('heavy-focus', i, `${v}px`, linha); }
      else add('heavy-outline', i, `${v}px`, linha);
    }
    if (/box-?shadow/i.test(linha) || /shadow-\[/.test(linha)) {
      for (const m of linha.matchAll(RE_SHADOW_RING)) {
        const v = px(m[1]);
        if (!(v > 1)) continue;
        /* a ring in the surface color is a gap (avatar cut-out, offset), not a stroke */
        if (SUPERFICIE.test(linha.slice(m.index + m[0].length, m.index + m[0].length + 60).split(/[,;]/)[0])) continue;
        if (focoCss || /focus[\w-]*:/.test(linha)) { if (v > 2) add('heavy-focus', i, `${v}px`, linha); }
        else add('heavy-ring', i, `${v}px`, linha);
      }
    }
  });
  /* one finding per line and rule */
  const vistos = new Set();
  return out.filter((f) => {
    const k = `${f.linha}:${f.regra}`;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

function selfTest() {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'stroke');
  /* Both directions: the dirty files fire exactly these counts, the clean twins stay at zero. */
  const esperado = {
    'stroke-dirty.css': { 'heavy-border': 4, 'heavy-ring': 2, 'heavy-outline': 1, 'heavy-focus': 1 },
    'stroke-dirty.tsx': { 'heavy-border': 5, 'heavy-ring': 2, 'heavy-outline': 1, 'heavy-focus': 2 },
    'stroke-clean.css': {},
    'stroke-clean.tsx': {},
  };
  let falhas = 0;
  for (const [f, exp] of Object.entries(esperado)) {
    const p = path.join(dir, f);
    if (!fs.existsSync(p)) {
      console.error(`stroke-scan --self-test: fixture not found at ${p}`);
      process.exit(2);
    }
    const got = scanSource(fs.readFileSync(p, 'utf8'), p).reduce((a, x) => ((a[x.regra] = (a[x.regra] ?? 0) + 1), a), {});
    for (const r of RULES) {
      const ok = (got[r] ?? 0) === (exp[r] ?? 0);
      if (!ok) falhas++;
      console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${f.padEnd(18)} ${r.padEnd(14)} expected ${exp[r] ?? 0}, found ${got[r] ?? 0}`);
    }
  }
  console.log(falhas ? `\nstroke-scan --self-test: ${falhas} count(s) off.` : '\nstroke-scan --self-test: fires on the dirty fixtures, silent on the clean twins.');
  return falhas ? 1 : 0;
}

const executadoDireto = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (executadoDireto) {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) process.exit(selfTest());
  const alvos = args.filter((a) => !a.startsWith('--'));
  if (!alvos.length) {
    console.error('usage: node stroke-scan.mjs <files-or-folders...> | --self-test');
    process.exit(2);
  }
  let achados = [];
  try {
    for (const f of alvos.flatMap((t) => walk(path.resolve(t)))) achados = achados.concat(scanSource(fs.readFileSync(f, 'utf8'), f));
  } catch (e) {
    console.error(`stroke-scan: ${e.message}`);
    process.exit(2);
  }
  for (const a of achados) console.log(`${path.relative(process.cwd(), a.arquivo)}:${a.linha}  [${a.regra}] ${a.valor}  |  ${a.amostra}`);
  console.log(`\n${achados.length} stroke(s) over a hairline without a written reason.`);
  if (achados.length) console.log('Selection is said by color, not weight. A real exception: `EXCEPTION to stroke-scan/<rule>: reason`.');
  process.exit(achados.length ? 1 : 0);
}
