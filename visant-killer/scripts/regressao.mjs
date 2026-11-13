#!/usr/bin/env node
/**
 * regressao: compares a screen before and after. Removing stops being an
 * automatic improvement.
 *
 * Why it exists. An agent cut the cards from a costs screen, six number tiles to
 * a sentence, per-row "Ok" to a grey icon, and framed the rest in a fixed max-width.
 * Every detector improved, because all of them count what is left over. Nothing
 * had the BEFORE. Four losses, each with an absolute and a relative floor (one
 * card less is a decision; half the screen's cards is an event):
 *
 *   perdeu-contentor  tiles holding main numbers: lost >= 2 and >= 34%; or
 *                     surfaces: lost >= 3 and >= 50%.
 *   perdeu-controle   controls in the screen area: lost >= 2 and >= 25%.
 *   perdeu-chip       chips or colored state signals: lost >= 2 and >= 50%.
 *   perdeu-largura    used width: lost >= 120px and >= 10% of the usable width.
 *   perdeu-marca      (source only) brand art: logo, mark, mascot, hero art,
 *                     illustration components and logo/mascot images: lost >= 1
 *                     and >= 50%. A cleanup that deletes the brand's own asset
 *                     removed the life, not a tell (Tucano, 2026-11-11).
 *
 * A loss can be right: the cut test exists. So a finding asks for a reason, not
 * a revert: `--aceito regra="why"` prints the reason and clears that rule. What
 * no flag clears is looking: every run ends pointing at the side-by-side.
 *
 *   node regressao.mjs snap <url> --out antes.json [--width 1440] [--storage state.json]
 *   node regressao.mjs diff antes.json depois.json [--aceito perdeu-chip="reason"]
 *   node regressao.mjs urls <url-antes> <url-depois> --out dir [--width 1440] [--storage state.json]
 *   node regressao.mjs git <ref> <paths...>      # no screen: the same four, read from the source diff
 *   node regressao.mjs --self-test
 *
 * Behind login without a storage state: `copy(JSON.stringify(retrato()))` in the
 * console with tela-scan.js pasted, then `diff` the two files. A snapshot holds
 * numbers only, no text from the screen; the screenshot `snap` saves beside it
 * does hold the screen, so keep it out of any public repo.
 *
 * It only reads: every request other than GET or HEAD is aborted in the browser.
 *
 * Exit 0: nothing lost. Exit 1: losses. Exit 2: could not compare.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const queda = (a, b) => ({ perdeu: a - b, pct: a > 0 ? (a - b) / a : 0 });

/* two snapshots of the same screen -> losses. Pure, so the floors are tested without a browser. */
export function comparar(a, b) {
  const out = [];
  const add = (regra, detalhe) => out.push({ regra, detalhe });
  const mc = queda(a.metricasEmCaixa, b.metricasEmCaixa);
  const su = queda(a.superficies, b.superficies);
  if (mc.perdeu >= 2 && mc.pct >= 0.34) add('perdeu-contentor', `main numbers in a box: ${a.metricasEmCaixa} -> ${b.metricasEmCaixa}. A number out of its tile stops being read first.`);
  else if (su.perdeu >= 3 && su.pct >= 0.5) add('perdeu-contentor', `surfaces: ${a.superficies} -> ${b.superficies}. Depth by line is for control panels; an operation dashboard keeps the box on main data.`);
  const ct = queda(a.controles, b.controles);
  if (ct.perdeu >= 2 && ct.pct >= 0.25) add('perdeu-controle', `controls: ${a.controles} -> ${b.controles}. Name what each one did and where that job went now.`);
  const antesSinal = a.selos + a.estadosComSinal;
  const depoisSinal = b.selos + b.estadosComSinal;
  const se = queda(antesSinal, depoisSinal);
  if (se.perdeu >= 2 && se.pct >= 0.5) add('perdeu-chip', `chips and colored states: ${antesSinal} -> ${depoisSinal}. The scan for the odd row just got harder.`);
  const la = a.usada - b.usada;
  if (la >= 120 && la >= a.util * 0.1) add('perdeu-largura', `used width: ${a.usada}px -> ${b.usada}px of ${b.util}px usable. Check the void beside it.`);
  return out;
}

/* ---------- the same four, from source, when nobody took a BEFORE snapshot ---------- */
const RE_CONTENTOR = /<(?:Card|Panel|Tile|Surface|Stat\w*|Metric\w*|v-card|el-card|mat-card|n-card|ion-card)\b|(?:className|class)=["'`{][^"'`]*\b(?:border\b[^"'`]*\brounded|rounded(?:-\w+)?\b[^"'`]*\b(?:border\b|bg-|shadow))/g;
const RE_CONTROLE = /<(?:button|Button|Link|select|Select|input|Input|Switch|Checkbox|Toggle\w*|Tabs?Trigger|v-btn|el-button|mat-button|router-link)\b|<a\s[^>]*href=/g;
const RE_CHIP = /<(?:Badge|Chip|Pill|Tag|Status\w*)\b|\brounded-full\b[^"'`]*\b(?:px-|bg-)/g;
const RE_MOLDURA = /\bmax-w-(?:xs|sm|md|lg|xl|[2-7]xl|screen-\w+|\[[^\]]+\])|\bmax-width\s*:/g;
/* Brand art: a component whose name ENDS in a brand noun (EngineMark, ToucanHero, GoalArt; not Markdown,
   not HeroSection), or an image whose src/alt names a logo, mascot, brand or illustration. */
const RE_MARCA_IMG = /<img\b[^>]*\b(?:src|alt)=["'{`][^"'}`]*(?:logo|mascot|mascote|brand|marca|illustration|ilustra)/gi;
const RE_MARCA = /<(?:[A-Z]\w*)?(?:Logo|Mark|Mascot|Hero|Art|Illustration|Brand|Emblem)s?(?![\w-])/g;
const contar = (s, re) => (s.match(re) || []).length;
export const medirFonte = (s) => ({ contentores: contar(s, RE_CONTENTOR), controles: contar(s, RE_CONTROLE), chips: contar(s, RE_CHIP), molduras: contar(s, RE_MOLDURA), marcas: contar(s, RE_MARCA) + contar(s, RE_MARCA_IMG) });
export function compararFonte(a, b) {
  const out = [];
  const q = (k) => queda(a[k], b[k]);
  if (q('contentores').perdeu >= 2 && q('contentores').pct >= 0.34) out.push({ regra: 'perdeu-contentor', detalhe: `boxes in source: ${a.contentores} -> ${b.contentores}` });
  if (q('controles').perdeu >= 2 && q('controles').pct >= 0.25) out.push({ regra: 'perdeu-controle', detalhe: `controls in source: ${a.controles} -> ${b.controles}` });
  if (q('chips').perdeu >= 2 && q('chips').pct >= 0.5) out.push({ regra: 'perdeu-chip', detalhe: `chips in source: ${a.chips} -> ${b.chips}` });
  if (q('marcas').perdeu >= 1 && q('marcas').pct >= 0.5) out.push({ regra: 'perdeu-marca', detalhe: `brand art in source: ${a.marcas} -> ${b.marcas}. Removing the brand's own asset is losing life, not a tell: replace it in the same change or say why` });
  if (b.molduras > a.molduras) out.push({ regra: 'perdeu-largura', detalhe: `new max-w frame: ${a.molduras} -> ${b.molduras}. Confirm on the screen` });
  return out;
}

function imprimir(achados, aceitos, rodape = []) {
  let abertos = 0;
  for (const a of achados) {
    if (aceitos[a.regra]) console.log(`ACCEPTED ${a.regra}: ${a.detalhe}\n         reason: ${aceitos[a.regra]}`);
    else {
      abertos++;
      console.log(`[${a.regra}] ${a.detalhe}`);
    }
  }
  if (!achados.length) console.log('nothing measured as lost.');
  for (const l of rodape) console.log(l);
  console.log('The score is not the verdict: look at before and after side by side, and show the owner before shipping.');
  return abertos;
}

/* ---------- self-test ---------- */
function selfTest() {
  const base = { largura: 1440, util: 1200, usada: 1150, superficies: 10, metricas: 6, metricasEmCaixa: 6, controles: 8, selos: 6, estadosComSinal: 6 };
  const casos = [
    ['the real case fires all four', { ...base, usada: 900, superficies: 0, metricasEmCaixa: 0, controles: 3, selos: 0, estadosComSinal: 0 }, ['perdeu-contentor', 'perdeu-controle', 'perdeu-chip', 'perdeu-largura']],
    ['identical is silent', { ...base }, []],
    ['one card less is a decision', { ...base, superficies: 9, metricasEmCaixa: 5 }, []],
    ['one control less is a decision', { ...base, controles: 7 }, []],
    ['one chip less is a decision', { ...base, selos: 5 }, []],
    ['80px narrower is noise', { ...base, usada: 1070 }, []],
    ['tiles to a sentence', { ...base, metricasEmCaixa: 0 }, ['perdeu-contentor']],
    ['half the surfaces gone, numbers kept', { ...base, superficies: 4 }, ['perdeu-contentor']],
    ['moving numbers INTO boxes is not a loss', { ...base, metricasEmCaixa: 9, superficies: 14 }, []],
  ];
  let falhas = 0;
  const ok = (cond, msg) => {
    if (!cond) falhas++;
    console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${msg}`);
  };
  for (const [nome, depois, esperado] of casos) {
    const got = comparar(base, depois).map((a) => a.regra);
    const bate = JSON.stringify(got) === JSON.stringify(esperado);
    ok(bate, `${nome}${bate ? '' : ` -> ${got}`}`);
  }
  const antes = `<Card className="x"/><Card/><div className="border rounded-xl p-4"/><Badge/><Badge/><Button onClick={f}/><Button/><button/>`;
  const depois = `<div className="max-w-5xl"><p>texto</p><Button/></div>`;
  const a = medirFonte(antes);
  const b = medirFonte(depois);
  const rf = compararFonte(a, b).map((x) => x.regra);
  ok(JSON.stringify(rf) === JSON.stringify(['perdeu-contentor', 'perdeu-controle', 'perdeu-chip', 'perdeu-largura']), `source diff fires all four -> ${rf}`);
  ok(compararFonte(a, a).length === 0, 'source unchanged is silent');
  const comMarca = medirFonte(`<TucaMark live/><GoalArt id="x"/><img src="/logo.svg" alt=""/><Markdown/><HeroSection/>`);
  ok(comMarca.marcas === 3, `brand art counted, Markdown and HeroSection left out -> ${comMarca.marcas}`);
  ok(compararFonte(comMarca, medirFonte('<p>texto</p>')).some((x) => x.regra === 'perdeu-marca'), 'brand art deleted fires perdeu-marca');
  ok(!compararFonte(comMarca, medirFonte('<TucaMark/><MissionArt/><img src="/logo.svg"/>')).some((x) => x.regra === 'perdeu-marca'), 'brand art swapped for other brand art is silent');
  console.log(falhas ? `\nregressao --self-test: ${falhas} failure(s)` : '\nregressao --self-test: floors hold both ways.');
  return falhas ? 1 : 0;
}

/* ---------- screens ---------- */
const argv = process.argv.slice(2);
const valor = (nome) => {
  const i = argv.indexOf(`--${nome}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
function aceitosDeArgv() {
  const out = {};
  argv.forEach((a, i) => {
    if (a !== '--aceito') return;
    const m = (argv[i + 1] || '').match(/^([\w-]+)=(.+)$/);
    if (m) out[m[1]] = m[2];
  });
  return out;
}

async function abrir() {
  const { OUVINTES_INIT, loadChromium } = await import('./tela-harness.mjs');
  const chromium = loadChromium();
  if (!chromium) {
    console.error('Playwright is not available: npx --yes playwright install chromium');
    process.exit(2);
  }
  const browser = await chromium.launch();
  const storageState = valor('storage');
  const ctx = await browser.newContext({ viewport: { width: Number(valor('width') || 1440), height: 900 }, ...(storageState ? { storageState } : {}) });
  await ctx.addInitScript(OUVINTES_INIT);
  await ctx.route('**/*', (r) => (['GET', 'HEAD'].includes(r.request().method()) ? r.continue() : r.abort('blockedbyclient')));
  return { browser, page: await ctx.newPage() };
}
async function fotografar(page, url, json) {
  const { medirTela } = await import('./tela-harness.mjs');
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(Number(valor('wait') || 3000));
  await page.evaluate(async () => {
    const passo = innerHeight * 0.8;
    for (let y = 0; y < document.documentElement.scrollHeight && y < 30000; y += passo) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 80));
    }
    scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 500));
  });
  const { retrato } = await medirTela(page, { axe: null });
  if (!retrato || !retrato.corridas) {
    console.error(`nothing rendered at ${url}: a blank screen cannot be compared.`);
    process.exit(2);
  }
  mkdirSync(dirname(resolve(json)), { recursive: true });
  writeFileSync(json, JSON.stringify(retrato, null, 2));
  const png = json.replace(/\.json$/, '') + '.png';
  await page.screenshot({ path: png, fullPage: true });
  return { retrato, png };
}
function ladoALado(dir, pa, pb) {
  const f = join(dir, 'lado-a-lado.html');
  const src = (p) => pathToFileURL(resolve(p)).href;
  writeFileSync(f, `<!doctype html><meta charset="utf-8"><title>Antes e depois</title><style>body{margin:0;display:grid;grid-template-columns:1fr 1fr;gap:8px;background:#111;color:#eee;font:14px sans-serif}figure{margin:0}figcaption{padding:8px}img{width:100%;display:block}</style><figure><figcaption>Antes</figcaption><img src="${src(pa)}"></figure><figure><figcaption>Depois</figcaption><img src="${src(pb)}"></figure>`);
  return f;
}

async function main() {
  const [cmd, ...resto] = argv;
  const COM_VALOR = new Set(['--out', '--width', '--storage', '--aceito', '--wait']);
  const pos = resto.filter((a, i) => !a.startsWith('--') && !COM_VALOR.has(resto[i - 1]));
  if (cmd === '--self-test') process.exit(selfTest());
  if (cmd === 'snap' && pos[0] && valor('out')) {
    const { browser, page } = await abrir();
    const { png } = await fotografar(page, pos[0], valor('out'));
    await browser.close();
    console.log(`SNAPSHOT ${resolve(valor('out'))}\nIMAGE ${resolve(png)}`);
    return;
  }
  if (cmd === 'diff' && pos[1]) {
    const [a, b] = pos.slice(0, 2).map((p) => JSON.parse(readFileSync(p, 'utf8')));
    if (a.largura !== b.largura) {
      console.error(`different viewports (${a.largura} vs ${b.largura}): take both at the same width.`);
      process.exit(2);
    }
    const [pa, pb] = pos.slice(0, 2).map((p) => p.replace(/\.json$/, '.png'));
    const rodape = existsSync(pa) && existsSync(pb) ? [`SIDE BY SIDE ${ladoALado(dirname(resolve(pos[1])), pa, pb)}`] : ['no screenshots next to the snapshots: open both screens side by side by hand.'];
    process.exit(imprimir(comparar(a, b), aceitosDeArgv(), rodape) ? 1 : 0);
  }
  if (cmd === 'urls' && pos[1] && valor('out')) {
    const dir = resolve(valor('out'));
    const { browser, page } = await abrir();
    const antes = await fotografar(page, pos[0], join(dir, 'antes.json'));
    const depois = await fotografar(page, pos[1], join(dir, 'depois.json'));
    await browser.close();
    const rodape = [`SIDE BY SIDE ${ladoALado(dir, antes.png, depois.png)}`];
    process.exit(imprimir(comparar(antes.retrato, depois.retrato), aceitosDeArgv(), rodape) ? 1 : 0);
  }
  if (cmd === 'git' && pos[1]) {
    const [ref, ...paths] = pos;
    const git = (...a) => spawnSync('git', a, { encoding: 'utf8' });
    const raiz = git('rev-parse', '--show-toplevel').stdout?.trim();
    if (!raiz) {
      console.error('not a git repository.');
      process.exit(2);
    }
    const nomes = git('diff', '--name-only', ref, '--', ...paths).stdout.split('\n').filter((f) => /\.(tsx|jsx|vue|svelte|astro|html)$/.test(f));
    let abertos = 0;
    for (const f of nomes) {
      const velho = git('show', `${ref}:${f}`).stdout || '';
      const abs = join(raiz, f);
      const novo = existsSync(abs) ? readFileSync(abs, 'utf8') : '';
      const achados = compararFonte(medirFonte(velho), medirFonte(novo));
      if (!achados.length) continue;
      console.log(`\n${f}`);
      abertos += imprimir(achados, aceitosDeArgv());
    }
    console.log(`\n${nomes.length} changed UI file(s) read against ${ref}. Source is a hint: a box may have moved to another file. Confirm with snapshots.`);
    process.exit(abertos ? 1 : 0);
  }
  console.error('usage: regressao.mjs snap <url> --out a.json | diff a.json b.json | urls <a> <b> --out dir | git <ref> <paths...> | --self-test');
  process.exit(2);
}

/* Caminho REAL dos dois lados: a skill costuma ser instalada por link (~/.claude/skills -> repo), e
   com o link o argv[1] nunca batia com o import.meta.url: o script saía calado, sem rodar nada. */
const real = (p) => { try { return realpathSync(p); } catch { return resolve(p); } };
if (process.argv[1] && real(process.argv[1]) === real(fileURLToPath(import.meta.url))) {
  main().catch((e) => {
    console.error('regressao:', e.message);
    process.exit(2);
  });
}
