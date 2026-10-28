/**
 * O self-test do `corta-scan.js` — as três geometrias travadas num fixture.
 *
 * Existe pelo mesmo motivo que o `--self-test` do `ruido-scan`: quem mexer nos
 * limiares (os 40% de cobertura, os 2px de sobra) precisa descobrir na hora que
 * afrouxou a regra até ela não achar mais nada. Detector que devolve zero passa
 * por tela limpa, e é o pior modo de falha de um portão.
 *
 *   node scripts/corta-self-test.mjs
 *
 * Pede `playwright-core` e um Chrome — os dois já existem em qualquer repo que
 * rode harness. SEM eles, o script sai 0 dizendo que não testou: "não consegui
 * rodar" nunca é "passou", e também não é "está quebrado" (a mesma lição do
 * guard de ambiente dos harness desta casa).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(aqui, 'fixtures', 'corta-casos.html');
const snippet = fs.readFileSync(path.join(aqui, 'corta-scan.js'), 'utf8');

/*
 * `playwright-core` é resolvido a partir do REPO, não desta skill.
 *
 * A skill mora em `~/.claude/skills/`, e um `import('playwright-core')` daqui
 * procura por um node_modules dentro de `~/.claude` — que não existe. O
 * primeiro teste deste script disse "sem playwright-core neste repo" dentro de
 * um repo que tinha playwright-core instalado: o modo de falha exato que o guard
 * existe pra evitar, acontecendo POR CAUSA do guard.
 *
 * (E o glob que estava escrito aqui FECHAVA este comentário: dois asteriscos
 * mais barra é o fim de um bloco, então metade da explicação virava código e o
 * arquivo nem parseava. Glob em comentário de bloco, nunca.)
 */
/*
 * Mesma ordem do verify-screens: `playwright-core` ou `playwright` do cwd
 * (createRequire no repo-alvo), e por último o cache do npx. Repo que só tem
 * `playwright` no topo dava NÃO TESTADO procurando só o `-core`.
 */
let chromium;
{
  const { createRequire } = await import('node:module');
  const os = await import('node:os');
  const exigir = createRequire(path.join(process.cwd(), 'package.json'));
  for (const nome of ['playwright-core', 'playwright']) {
    try {
      ({ chromium } = exigir(nome)); // CJS: require direto, o import por file:// devolve namespace sem os browsers
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
  console.log('corta-self-test: sem playwright(-core) no repo atual nem no cache do npx — NÃO TESTADO (não é aprovação). Rode do repo-alvo.');
  process.exit(0);
}

const exe =
  process.env.CHROME ||
  ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(
    (p) => fs.existsSync(p),
  );
if (!exe) {
  console.log('corta-self-test: nenhum Chrome encontrado (defina CHROME=) — NÃO TESTADO.');
  process.exit(0);
}

const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto('file://' + fixture.replace(/\\/g, '/'));
/* fonte carregada antes de medir: a largura de uma palavra não existe antes
   disso, e medir antes é medir o fallback (ver references/ambiente.md) */
await page.evaluate(() => document.fonts.ready);
const achados = await page.evaluate(`${snippet}; corta('body', { verbose: false }).map(({ no, ...r }) => r)`);
await browser.close();

const esperado = { 'texto-cortado': 1, 'overlay-empilhado': 2, 'fora-do-pai': 1 };
const contado = achados.reduce((a, x) => ((a[x.regra] = (a[x.regra] ?? 0) + 1), a), {});

let falhou = 0;
for (const [regra, n] of Object.entries(esperado)) {
  const achou = contado[regra] ?? 0;
  const ok = achou === n;
  if (!ok) falhou++;
  console.log(`  ${ok ? 'ok  ' : 'FALHA'}  ${regra.padEnd(20)} esperado ${n}, achou ${achou}`);
}
for (const regra of Object.keys(contado)) {
  if (esperado[regra] === undefined) {
    falhou++;
    console.log(`  FALHA  ${regra.padEnd(20)} apareceu e não é esperado (${contado[regra]}x)`);
  }
}
for (const a of achados) console.log(`         ${a.regra}: ${a.el} — ${a.detalhe}`);
console.log(falhou ? `\ncorta-self-test: ${falhou} regra(s) fora do esperado.` : '\ncorta-self-test: as 3 geometrias batem com o fixture.');
process.exit(falhou ? 1 : 0);
