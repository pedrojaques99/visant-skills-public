/**
 * The `corta-scan.js` self-test: the three geometries locked in a fixture.
 *
 * It exists for the same reason as `noise-scan`'s `--self-test`: whoever touches
 * the thresholds (the 40% coverage, the 2px overflow) needs to find out right
 * away that they loosened the rule until it finds nothing. A detector that
 * returns zero passes as a clean screen, and that is a gate's worst failure mode.
 *
 *   node scripts/corta-self-test.mjs
 *
 * Needs `playwright-core` and a Chrome; both already exist in any repo that
 * runs a harness. WITHOUT them, the script exits 0 saying it did not test: "I
 * could not run" is never "passed", and it is not "broken" either (the same
 * lesson as the environment guard in this house's harnesses).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(aqui, 'fixtures', 'clip-cases.html');
const snippet = fs.readFileSync(path.join(aqui, 'corta-scan.js'), 'utf8');
/* ritmo-scan rides the same browser: spacing that lies about grouping */
const fixtureRitmo = path.join(aqui, 'fixtures', 'spacing-cases.html');
const snippetRitmo = fs.readFileSync(path.join(aqui, 'ritmo-scan.js'), 'utf8');

/*
 * `playwright-core` is resolved from the REPO, not from this skill.
 *
 * The skill lives in `~/.claude/skills/`, and an `import('playwright-core')`
 * from here looks for a node_modules inside `~/.claude`, which does not exist.
 * The first run of this script said "no playwright-core in this repo" inside a
 * repo that had playwright-core installed: the exact failure mode the guard
 * exists to prevent, happening BECAUSE of the guard.
 *
 * (And the glob that was written here CLOSED this comment: two asterisks plus a
 * slash end a block, so half the explanation became code and the file did not
 * even parse. Never put a glob in a block comment.)
 */
/*
 * Same order as verify-screens: `playwright-core` or `playwright` from the cwd
 * (createRequire in the target repo), and last the npx cache. A repo with only
 * `playwright` at the top level gave NOT TESTED when looking only for `-core`.
 */
let chromium;
{
  const { createRequire } = await import('node:module');
  const os = await import('node:os');
  const exigir = createRequire(path.join(process.cwd(), 'package.json'));
  for (const nome of ['playwright-core', 'playwright']) {
    try {
      ({ chromium } = exigir(nome)); // CJS: plain require; importing via file:// returns a namespace without the browsers
      break;
    } catch {}
  }
  if (!chromium) {
    const cache = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'npm-cache', '_npx');
    for (const d of fs.existsSync(cache) ? fs.readdirSync(cache) : []) {
      const p = path.join(cache, d, 'node_modules', 'playwright', 'index.js');
      if (fs.existsSync(p)) {
        ({ chromium } = createRequire(p)(p));
        break;
      }
    }
  }
}
if (!chromium) {
  console.log('corta-self-test: no playwright(-core) in the current repo or the npx cache: NOT TESTED (this is not a pass). Run it from the target repo.');
  process.exit(0);
}

const exe =
  process.env.CHROME ||
  ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(
    (p) => fs.existsSync(p),
  );
if (!exe) {
  console.log('corta-self-test: no Chrome found (set CHROME=): NOT TESTED.');
  process.exit(0);
}

const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto('file://' + fixture.replace(/\\/g, '/'));
/* font loaded before measuring: a word's width does not exist before that, and
   measuring earlier measures the fallback font (see references/environment.md) */
await page.evaluate(() => document.fonts.ready);
const achados = await page.evaluate(`${snippet}; corta('body', { verbose: false }).map(({ no, ...r }) => r)`);
await page.goto('file://' + fixtureRitmo.replace(/\\/g, '/'));
await page.evaluate(() => document.fonts.ready);
const achadosRitmo = await page.evaluate(`${snippetRitmo}; ritmo('body', { verbose: false }).map(({ no, ...r }) => r)`);
await browser.close();

let falhou = 0;
function conferir(titulo, esperado, lista) {
  console.log(titulo);
  const contado = lista.reduce((a, x) => ((a[x.regra] = (a[x.regra] ?? 0) + 1), a), {});
  for (const [regra, n] of Object.entries(esperado)) {
    const achou = contado[regra] ?? 0;
    const ok = achou === n;
    if (!ok) falhou++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${regra.padEnd(22)} expected ${n}, found ${achou}`);
  }
  for (const regra of Object.keys(contado)) {
    if (esperado[regra] === undefined) {
      falhou++;
      console.log(`  FAIL  ${regra.padEnd(22)} showed up and is not expected (${contado[regra]}x)`);
    }
  }
  for (const a of lista) console.log(`         ${a.regra}: ${a.el}: ${a.detalhe}`);
}
conferir('corta-scan · clip-cases.html', { 'texto-cortado': 1, 'overlay-empilhado': 2, 'fora-do-pai': 1 }, achados);
conferir('ritmo-scan · spacing-cases.html', { 'proximidade-invertida': 1, 'ritmo-chato': 1, 'irmaos-desalinhados': 2 }, achadosRitmo);
console.log(falhou ? `\ncorta-self-test: ${falhou} rule(s) off the expected count.` : '\ncorta-self-test: all 3 geometries and all 3 spacing rules match their fixtures.');
process.exit(falhou ? 1 : 0);
