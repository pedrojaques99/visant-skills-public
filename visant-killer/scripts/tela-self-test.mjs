/**
 * tela-self-test: every rule of tela-scan.js both ways, plus axe-core and the
 * whole-screen pair (the real case, with invented data).
 *
 * Same contract as corta-self-test: a rule loosened to zero passes as a clean
 * screen, the worst failure of a gate, so each threshold lives under a fixture.
 * No playwright or Chrome: exits 0 saying NOT TESTED, which is not a pass.
 *
 *   node scripts/tela-self-test.mjs
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OUVINTES_INIT, axeSource, loadChromium, medirTela, rodarAxe, telaSrc } from './tela-harness.mjs';
import { comparar } from './regressao.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const url = (f) => 'file:///' + join(aqui, 'fixtures', 'tela', f).replace(/\\/g, '/').replace(/^\/+/, '');
const chromium = loadChromium();
if (!chromium) {
  console.log('tela-self-test: no playwright(-core) in this repo or the npx cache: NOT TESTED (this is not a pass).');
  process.exit(0);
}
const exe = process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => existsSync(p));
if (!exe) {
  console.log('tela-self-test: no Chrome found (set CHROME=): NOT TESTED.');
  process.exit(0);
}

const browser = await chromium.launch({ executablePath: exe });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(OUVINTES_INIT);
const page = await ctx.newPage();
let falhas = 0;
const fim = (ok, msg) => {
  if (!ok) falhas++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${msg}`);
};

/* 1 · every rule, section by section */
await page.goto(url('casos.html'));
await page.evaluate(`${telaSrc()};window.tela=tela;window.retrato=retrato;1`);
const casos = await page.evaluate(() =>
  [...document.querySelectorAll('section')].map((s) => {
    const a = tela(s, { verbose: false }) || [];
    return { caso: s.dataset.caso, espera: JSON.parse(s.dataset.espera), achados: a.map(({ no, ...x }) => x) };
  }),
);
const vivas = new Set();
for (const c of casos) {
  const conta = c.achados.reduce((m, a) => ((m[a.regra] = (m[a.regra] ?? 0) + 1), m), {});
  const regras = new Set([...Object.keys(conta), ...Object.keys(c.espera)]);
  const erros = [...regras].filter((r) => (conta[r] ?? 0) !== (c.espera[r] ?? 0));
  for (const r of Object.keys(conta)) vivas.add(r);
  fim(!erros.length, `${c.caso}${erros.length ? `  -> ${erros.map((r) => `${r}: expected ${c.espera[r] ?? 0}, found ${conta[r] ?? 0}`).join('; ')}` : ''}`);
}
const TODAS = ['vazio-lateral', 'blocos-colados', 'texto-denso', 'sem-ponto-de-entrada', 'metrica-sem-destaque', 'numeros-em-frase', 'tudo-igual', 'acao-virou-texto', 'estado-so-texto', 'estado-so-icone', 'parece-clicavel', 'texto-demais', 'rotulo-repetido', 'legenda-em-toda-linha', 'nomes-tecnicos', 'pilha-de-selos', 'icones-decorativos'];
for (const r of TODAS) if (!vivas.has(r)) fim(false, `rule ${r} never fired in the fixture`);

/* 2 · the real case, whole page */
await page.goto(url('custos-ruim.html'));
const ruim = await medirTela(page);
await page.goto(url('custos-bom.html'));
const bom = await medirTela(page);
const regrasRuim = new Set(ruim.achados.map((a) => a.regra));
for (const r of ['vazio-lateral', 'metrica-sem-destaque', 'numeros-em-frase', 'tudo-igual', 'estado-so-icone', 'sem-ponto-de-entrada']) fim(regrasRuim.has(r), `custos-ruim fires ${r}`);
fim(bom.achados.length === 0, `custos-bom is clean${bom.achados.length ? `  -> ${bom.achados.map((a) => `${a.regra}: ${a.detalhe}`).join('; ')}` : ''}`);

/* 3 · regression both ways, on the snapshots of those two screens */
const ida = comparar(bom.retrato, ruim.retrato).map((a) => a.regra);
for (const r of ['perdeu-contentor', 'perdeu-controle', 'perdeu-chip', 'perdeu-largura']) fim(ida.includes(r), `good -> bad reports ${r}`);
const volta = comparar(ruim.retrato, bom.retrato);
fim(volta.length === 0, `bad -> good reports nothing${volta.length ? `  -> ${volta.map((a) => a.regra).join(', ')}` : ''}`);
/* a snapshot carries numbers only: no string from the screen can leave in it */
const textos = Object.values(bom.retrato).filter((v) => typeof v === 'string');
fim(textos.length === 0, 'a snapshot holds no text from the screen');

/* 4 · axe owns target size and accessible name */
if (axeSource()) {
  await page.setContent(`<!doctype html><html lang="pt"><title>t</title><main><button style="width:14px;height:14px;padding:0" aria-label="fechar">x</button><button style="width:14px;height:14px;padding:0" aria-label="abrir">y</button><button style="width:40px;height:40px"></button></main></html>`);
  const sujo = await rodarAxe(page);
  const r = new Set(sujo.achados.map((a) => a.regra));
  fim(sujo.medido && r.has('target-size'), `axe flags a 14px target${sujo.medido ? '' : `  -> ${sujo.motivo}`}`);
  fim(sujo.medido && r.has('button-name'), 'axe flags a button with no name');
  await page.setContent(`<!doctype html><html lang="pt"><title>t</title><main><button style="width:40px;height:40px">ok</button></main></html>`);
  const limpo = await rodarAxe(page);
  fim(limpo.medido && limpo.achados.length === 0, 'axe stays quiet on a 40px named button');
} else {
  console.log('  -     axe-core not found: target size and name NOT TESTED (npm install)');
}
await browser.close();
console.log(falhas ? `\ntela-self-test: ${falhas} case(s) off the fixture.` : `\ntela-self-test: all ${TODAS.length} rules match the fixture both ways, plus the before/after pair.`);
process.exit(falhas ? 1 : 0);
