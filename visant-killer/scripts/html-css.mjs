/* html-css: what the gate needs to read a plain HTML + CSS site (no React).
 *
 * Until 2026-11 the killer refused any target without .tsx/.jsx (exit 2): the
 * detectors were calibrated on JSX and a plain HTML page came out "[OK] zero"
 * without being read. Static sales pages are exactly where the house sells, so
 * the refusal left the most expensive surface without a gate.
 *
 * No dependency on purpose (the repo has none for parsing, and the gate must run
 * with plain node in any repo). The page is read with a masked copy of the
 * source: comments, <script> and <style> bodies become spaces of the same
 * length, so every index still maps to the right LINE of the original file.
 *
 * THE SCOPE RULE (the point of this file). A static site usually links one big
 * shared stylesheet; the sales page of 2026-11-23 linked a 6,000-line
 * styles.css used by nine pages. Scanning the whole sheet for one page is
 * the same mistake the killer already refuses for JSX ("never on the whole repo,
 * or the old debt drowns the new finding"). So a CSS rule counts for a page only
 * when every class and id in its selector is USED by that page's HTML, or when
 * it has no class/id and its elements are on the page. A class only added by
 * JS (`.on`, `.js`, a state class) is not in the HTML and its rule is skipped:
 * that blind spot is reported in the scoreboard line, never hidden.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { SETA_GLIFO, temMotivoEscrito } from './noise-scan.mjs';

export const HTML_EXT = /\.html?$/i;
const norm = (p) => p.split(sep).join('/');
const vazio = (s) => s.replace(/[^\n]/g, ' ');

/* Entities decoded to the real character, so the copy gate sees what the eye
   sees: `&mdash;` IS a dash on screen and must hit the dash rule. */
const ENT = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…',
  laquo: '«', raquo: '»', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', middot: '·', bull: '•',
  rarr: '→', larr: '←', uarr: '↑', darr: '↓', copy: '©', reg: '®', trade: '™', times: '×',
};
export const decodeEnt = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENT[e.toLowerCase()] ?? m;
  });

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const COPY_ATTR = /\b(alt|title|aria-label|placeholder)\s*=\s*("([^"]*)"|'([^']*)')/gi;
/* Meta text reaches the eye too, in the tab and the share card. */
const META_COPY = /^(description|og:title|og:description|twitter:title|twitter:description)$/i;

function attr(tag, nome) {
  const m = tag.match(new RegExp(`\\b${nome}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? (m[2] ?? m[3] ?? m[4] ?? '') : null;
}

/** Reads one page. `root` resolves `/`-absolute stylesheet hrefs. */
export function lerHtml(file, root) {
  const src = readFileSync(file, 'utf8');
  const masked = src
    .replace(/<!--[\s\S]*?-->/g, vazio)
    .replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script\s*>)/gi, (m, a, b, c) => a + vazio(b) + c)
    .replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi, (m, a, b, c) => a + vazio(b) + c);
  const inicios = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === '\n') inicios.push(i + 1);
  const linhaDe = (idx) => {
    let lo = 0, hi = inicios.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (inicios[mid] <= idx) lo = mid; else hi = mid - 1;
    }
    return lo + 1;
  };

  const classes = new Set();
  const ids = new Set();
  const tags = new Set();
  for (const m of masked.matchAll(/\bclass\s*=\s*("([^"]*)"|'([^']*)')/gi)) for (const c of (m[2] ?? m[3]).split(/\s+/)) if (c) classes.add(c);
  for (const m of masked.matchAll(/\bid\s*=\s*("([^"]*)"|'([^']*)')/gi)) ids.add(m[2] ?? m[3]);
  for (const m of masked.matchAll(/<([a-z][a-z0-9-]*)\b/gi)) tags.add(m[1].toLowerCase());

  const cssLinks = [];
  for (const m of masked.matchAll(/<link\b[^>]*>/gi)) {
    if (!/stylesheet/i.test(attr(m[0], 'rel') ?? '')) continue;
    let href = attr(m[0], 'href');
    if (!href || /^(https?:)?\/\//i.test(href)) continue;
    href = href.replace(/[?#].*$/, '');
    const abs = norm(href.startsWith('/') ? join(root, href) : resolve(dirname(file), href));
    if (existsSync(abs)) cssLinks.push(abs);
  }

  const styleBlocks = [];
  for (const m of src.matchAll(/(<style\b[^>]*>)([\s\S]*?)<\/style\s*>/gi)) {
    if (/^\s*$/.test(masked.slice(m.index, m.index + 6).replace(/</, ''))) continue; // inside a comment
    const ini = m.index + m[1].length;
    styleBlocks.push({ texto: m[2], linha: linhaDe(ini) });
  }

  /* Text nodes with the open-tag stack, so a rule can ask "is this inside a
     control?" (an arrow in a <button> is a control glyph; in a <p> it is prose). */
  const textos = [];
  const pilha = [];
  for (const m of masked.matchAll(/<\/?([a-z][a-z0-9-]*)\b[^>]*>|([^<]+)/gi)) {
    if (m[1]) {
      const t = m[1].toLowerCase();
      if (m[0][1] === '/') {
        const k = pilha.map((x) => x.tag).lastIndexOf(t);
        if (k !== -1) pilha.length = k;
      } else if (!VOID.has(t) && !/\/>$/.test(m[0])) {
        pilha.push({ tag: t, role: attr(m[0], 'role'), classe: attr(m[0], 'class') ?? '' });
      }
      continue;
    }
    const bruto = m[2];
    if (!/\S/.test(bruto)) continue;
    const off = bruto.search(/\S/);
    const texto = decodeEnt(bruto).replace(/\s+/g, ' ').trim();
    if (!/\p{L}|\p{N}|[←-⇿⟰-⟿⤀-⥿⬀-⬑➜-➾·•|—–]/u.test(texto)) continue;
    textos.push({ linha: linhaDe(m.index + off), texto, dentro: pilha.map((x) => ({ ...x })) });
  }

  const attrCopy = [];
  for (const m of masked.matchAll(/<([a-z][a-z0-9-]*)\b[^>]*>/gi)) {
    const tag = m[0];
    for (const a of tag.matchAll(COPY_ATTR)) {
      const v = decodeEnt(a[3] ?? a[4] ?? '').trim();
      if (/\p{L}/u.test(v)) attrCopy.push({ linha: linhaDe(m.index + a.index), texto: v });
    }
    if (m[1].toLowerCase() === 'meta') {
      const nome = attr(tag, 'name') ?? attr(tag, 'property') ?? '';
      const v = attr(tag, 'content');
      if (META_COPY.test(nome) && v && /\p{L}/u.test(v)) attrCopy.push({ linha: linhaDe(m.index), texto: decodeEnt(v).trim() });
    }
  }

  return { file: norm(file), src, linhas: src.split(/\r?\n/), masked, linhaDe, classes, ids, tags, cssLinks, styleBlocks, textos, attrCopy };
}

/** The copy the eye reads, keyed `file:line` (the same bag format the JSX extractor feeds copy-lint). */
export function copyDoHtml(pag) {
  const out = {};
  for (const { linha, texto } of [...pag.textos, ...pag.attrCopy]) {
    const k = `${pag.file}:${linha}`;
    out[k] = out[k] ? `${out[k]} ${texto}` : texto;
  }
  return out;
}

/* ---------- CSS ---------- */

/**
 * Rules of a stylesheet: `{ selector, linha, decls: [{ prop, valor, linha }], pais }`.
 * `pais` are the enclosing at-rules and selectors (`@media ...`, `:root`). Comments
 * are blanked first (same length), quotes and parentheses are respected so a
 * `url(data:...;base64,...)` does not end a declaration.
 */
export function parseCss(texto, linhaBase = 1) {
  const s = texto.replace(/\/\*[\s\S]*?\*\//g, vazio);
  const regras = [];
  const pilha = [];
  let buf = '';
  let bufIni = 0;
  let aspas = null;
  let par = 0;
  const inicios = [0];
  for (let i = 0; i < s.length; i++) if (s[i] === '\n') inicios.push(i + 1);
  const linhaDe = (idx) => {
    let lo = 0, hi = inicios.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (inicios[mid] <= idx) lo = mid; else hi = mid - 1;
    }
    return linhaBase + lo;
  };
  /* the line of the first non-space character of the buffer */
  const linhaDoBuf = () => linhaDe(bufIni + (buf.match(/^\s*/)[0].length));
  const fechaDecl = () => {
    const topo = pilha[pilha.length - 1];
    const m = buf.match(/^\s*([-\w]+)\s*:\s*([\s\S]*?)\s*$/);
    if (topo?.regra && m) topo.regra.decls.push({ prop: m[1].toLowerCase(), valor: m[2], linha: linhaDoBuf() });
  };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (aspas) { if (c === aspas && s[i - 1] !== '\\') aspas = null; buf += c; continue; }
    if (c === '"' || c === "'") { aspas = c; buf += c; continue; }
    if (c === '(') par++;
    if (c === ')') par = Math.max(0, par - 1);
    if (c === '{' && !par) {
      const sel = buf.trim().replace(/\s+/g, ' ');
      const ehAt = sel.startsWith('@');
      const no = { sel, regra: null };
      if (!ehAt || /^@(font-face|page)/.test(sel)) {
        no.regra = { selector: sel, linha: linhaDoBuf(), decls: [], pais: pilha.map((x) => x.sel) };
        regras.push(no.regra);
      }
      pilha.push(no);
      buf = ''; bufIni = i + 1;
      continue;
    }
    if (c === ';' && !par) { fechaDecl(); buf = ''; bufIni = i + 1; continue; }
    if (c === '}' && !par) { fechaDecl(); pilha.pop(); buf = ''; bufIni = i + 1; continue; }
    if (buf === '') bufIni = i;
    buf += c;
  }
  return regras;
}

/** Splits a selector list on its top-level commas. */
const partes = (sel) => {
  const out = [];
  let prof = 0, ini = 0;
  for (let i = 0; i < sel.length; i++) {
    if (sel[i] === '(' || sel[i] === '[') prof++;
    else if (sel[i] === ')' || sel[i] === ']') prof--;
    else if (sel[i] === ',' && !prof) { out.push(sel.slice(ini, i)); ini = i + 1; }
  }
  out.push(sel.slice(ini));
  return out.map((x) => x.trim()).filter(Boolean);
};

/** Does this rule reach this page? See THE SCOPE RULE at the top. */
export function alcanca(selector, pag) {
  if (/^@font-face/.test(selector)) return false;
  return partes(selector).some((sel) => {
    /* classes inside :not() / :is() negate or widen; only the positive ones must be present */
    const positivo = sel.replace(/:not\([^)]*\)/g, ' ');
    const cls = [...positivo.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]);
    const ids = [...positivo.matchAll(/#(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]);
    if (cls.length || ids.length) return cls.every((c) => pag.classes.has(c)) && ids.every((x) => pag.ids.has(x));
    const els = [...positivo.replace(/\[[^\]]*\]|::?[\w-]+(\([^)]*\))?/g, ' ').matchAll(/(?:^|[\s>+~(])([a-z][a-z0-9-]*)/gi)].map((m) => m[1].toLowerCase());
    return !els.length || els.some((t) => pag.tags.has(t) || t === 'html' || t === 'body');
  });
}

/** Theme block: custom properties live there on purpose (`:root`, `.dark`, `[data-theme]`, `@theme`). */
export const emBlocoDeTema = (regra) => [regra.selector, ...regra.pais].some((s) => /(:root|\.dark\b|\[data-theme|@theme)/.test(s));

/**
 * Every CSS source of the page with its own lines (for exceptions):
 * `{ arquivo, linhas, regras }`. Linked sheets and inline <style> blocks.
 * `cache` lets several pages share one parse of the same stylesheet.
 */
export function cssDaPagina(pag, cache = new Map()) {
  const fontes = [];
  for (const f of pag.cssLinks) {
    if (!cache.has(f)) {
      const t = readFileSync(f, 'utf8');
      cache.set(f, { arquivo: f, linhas: t.split(/\r?\n/), regras: parseCss(t, 1) });
    }
    fontes.push(cache.get(f));
  }
  for (const b of pag.styleBlocks) fontes.push({ arquivo: pag.file, linhas: pag.linhas, regras: parseCss(b.texto, b.linha) });
  return fontes;
}

/* ---------- noise and AI tells that exist in HTML + CSS ----------
 *
 * Only the JSX rules that have a real CSS/HTML equivalent. The others read
 * Tailwind classes and React props, and porting them by regex would fire on
 * nothing or on everything. Same ids as noise-scan where the rule is the same
 * (`hover-lift`, `arrow-glyph`), so a written exception reads the same in both.
 */
export const HTML_AVISOS = new Set(['hover-lift', 'backdrop-blur', 'nowrap-no-max-width']);
const INTERATIVO = /:(hover|focus|focus-visible|focus-within|active)\b|(^|[\s>+~,(])(a|button|summary|input|select|textarea)\b|\[role=|\.btn\b/;
const ms = (v) => {
  let max = 0;
  for (const m of v.matchAll(/(?<![\w-])(\d*\.?\d+)(ms|s)\b/g)) max = Math.max(max, m[2] === 's' ? Number(m[1]) * 1000 : Number(m[1]));
  return max;
};
const SOBE = /translate(?:Y|3d)?\(\s*(?:[^,)]*,\s*)?-\s*\d|translateY\(\s*-|scale\(\s*1\.\d*[1-9]|^\s*-\s*\d|scale:\s*1\.\d*[1-9]/;

export function ruidoHtmlCss(paginas, cache = new Map()) {
  const achados = [];
  const visto = new Set();
  const add = (file, linhas, linha, regra, amostra) => {
    const k = `${file}:${linha}:${regra}`;
    if (visto.has(k)) return;
    visto.add(k);
    if (temMotivoEscrito(linhas, linha, regra)) return;
    achados.push({ file, linha, regra, amostra: amostra.trim().slice(0, 80), aviso: HTML_AVISOS.has(regra) });
  };
  for (const pag of paginas) {
    for (const fonte of cssDaPagina(pag, cache)) {
      for (const r of fonte.regras) {
        if (!alcanca(r.selector, pag)) continue;
        const props = new Set(r.decls.map((d) => d.prop));
        for (const d of r.decls) {
          const amostra = `${r.selector} { ${d.prop}: ${d.valor} }`;
          if ((d.prop === 'transition' || d.prop === 'transition-property') && /(^|[\s,])all\b/.test(d.valor)) {
            add(fonte.arquivo, fonte.linhas, d.linha, 'transition-all', amostra);
          }
          if ((d.prop === 'transition' || d.prop === 'transition-duration') && INTERATIVO.test(r.selector) && ms(d.valor) > 300) {
            add(fonte.arquivo, fonte.linhas, d.linha, 'ui-duration', amostra);
          }
          if (/:hover\b/.test(r.selector) && (d.prop === 'transform' || d.prop === 'translate' || d.prop === 'scale') && SOBE.test(d.prop === 'scale' ? `scale: ${d.valor}` : d.valor)) {
            add(fonte.arquivo, fonte.linhas, d.linha, 'hover-lift', amostra);
          }
          /* A fixed or sticky bar is THE case the skill allows ("blur is for a
             floating bar over scrolling content"): the mobile buy bar of the sales
             page of 2026-11-23 was flagged and was right. Only blur on something
             that stays in the flow is a question. */
          const flutua = r.decls.some((x) => x.prop === 'position' && /\b(fixed|sticky)\b/.test(x.valor));
          if ((d.prop === 'backdrop-filter' || d.prop === '-webkit-backdrop-filter') && !flutua) {
            if (d.prop === 'backdrop-filter' || !props.has('backdrop-filter')) add(fonte.arquivo, fonte.linhas, d.linha, 'backdrop-blur', amostra);
          }
          if (d.prop === 'white-space' && /nowrap/.test(d.valor) && !props.has('max-width') && !props.has('text-overflow') && !props.has('overflow')) {
            add(fonte.arquivo, fonte.linhas, d.linha, 'nowrap-no-max-width', amostra);
          }
        }
      }
    }
    /* An arrow character as the label of a control. Prose arrows (`A → B` in a
       paragraph) are typography and stay out: only text whose nearest
       interactive ancestor is <a>, <button>, a role=button or a .btn counts,
       and never inside <kbd> (a printed key). */
    for (const t of pag.textos) {
      if (!SETA_GLIFO.test(t.texto)) continue;
      if (t.dentro.some((x) => x.tag === 'kbd')) continue;
      const controle = t.dentro.some((x) => x.tag === 'a' || x.tag === 'button' || x.role === 'button' || /(^|\s)btn(\s|$)/.test(x.classe));
      if (controle) add(pag.file, pag.linhas, t.linha, 'arrow-glyph', t.texto);
    }
  }
  return achados;
}
