// tela-harness: what the open-screen CLIs share to run tela-scan.js and axe-core on a page.
//
// Why axe and not more code here: target size and accessible name are solved, tested and
// maintained upstream (rules `target-size`, `button-name`, `link-name`, `aria-command-name`).
// A rewrite would be a worse copy. axe is a dependency of this repo; a skill installed alone
// resolves it from the target repo or the npx cache, and when it finds nothing it says
// NOT MEASURED: never a zero that did not look.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const npxCaches = () => [join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'npm-cache', '_npx'), join(homedir(), '.npm', '_npx')];

export const telaSrc = () => readFileSync(join(here, 'tela-scan.js'), 'utf8').replace(/if \(typeof module[\s\S]*$/, '');

export const AXE_RULES = ['target-size', 'button-name', 'link-name', 'aria-command-name'];

export function axeSource() {
  for (const base of [import.meta.url, join(process.cwd(), 'package.json')]) {
    try {
      const p = createRequire(base).resolve('axe-core/axe.min.js');
      return readFileSync(p, 'utf8');
    } catch {}
  }
  for (const cache of npxCaches()) {
    for (const d of existsSync(cache) ? readdirSync(cache) : []) {
      const p = join(cache, d, 'node_modules', 'axe-core', 'axe.min.js');
      if (existsSync(p)) return readFileSync(p, 'utf8');
    }
  }
  return null;
}

/* Playwright from the target repo first, then the npx cache: same order as verify-screens. */
export function loadChromium() {
  for (const nome of ['playwright-core', 'playwright']) {
    try {
      const m = createRequire(join(process.cwd(), 'package.json'))(nome);
      if (m.chromium) return m.chromium;
    } catch {}
  }
  for (const cache of npxCaches()) {
    for (const d of existsSync(cache) ? readdirSync(cache) : []) {
      const p = join(cache, d, 'node_modules', 'playwright', 'index.js');
      if (existsSync(p)) return createRequire(p)(p).chromium;
    }
  }
  return null;
}

/*
 * Before the page's own scripts: remembers every element that received a click-like listener,
 * so `parece-clicavel` can read handlers on a page without React props. Installing it changes
 * no behavior; it only notes who called addEventListener.
 */
export const OUVINTES_INIT = `(() => {
  const set = new WeakSet();
  const orig = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (t, ...r) {
    if (/^(click|mousedown|mouseup|pointerdown|pointerup|touchstart|keydown)$/.test(t)) { try { set.add(this); } catch {} }
    return orig.call(this, t, ...r);
  };
  Object.defineProperty(window, '__telaOuvintes', { value: set, enumerable: false });
})();`;

/* tela + retrato + axe, serialized without DOM nodes */
export async function medirTela(page, { raiz = null, axe = axeSource(), tudo = false } = {}) {
  /* evaluate, not addScriptTag: a strict CSP (stripe.com) refuses the inline tag and CDP is exempt */
  await page.evaluate(`${telaSrc()};window.tela=tela;window.retrato=retrato;1`);
  const out = await page.evaluate(({ r, tudo }) => {
    const a = tela(r || undefined, { verbose: false, tudo }) || [];
    return { achados: a.map(({ no, ...x }) => x), naoMedido: a.naoMedido || 0, vitrine: !!a.vitrine, idiomaSemLista: a.idiomaSemLista || null, retrato: retrato(r || undefined, { tudo }) };
  }, { r: raiz, tudo });
  out.axe = await rodarAxe(page, { raiz, axe });
  return out;
}

export async function rodarAxe(page, { raiz = null, axe = axeSource() } = {}) {
  if (!axe) return { medido: false, motivo: 'axe-core not found (npm i -D axe-core)', achados: [] };
  try {
    await page.evaluate(`${axe};1`);
    const achados = await page.evaluate(
      async ({ regras, r }) => {
        const res = await window.axe.run(r || document, { runOnly: { type: 'rule', values: regras }, resultTypes: ['violations'] });
        return res.violations.flatMap((v) => v.nodes.map((n) => ({ regra: v.id, el: n.target.join(' '), detalhe: n.failureSummary?.split('\n').slice(1, 2).join(' ').trim() || v.help })));
      },
      { regras: AXE_RULES, r: raiz },
    );
    return { medido: true, achados };
  } catch (e) {
    return { medido: false, motivo: String(e).split('\n')[0].slice(0, 120), achados: [] };
  }
}
