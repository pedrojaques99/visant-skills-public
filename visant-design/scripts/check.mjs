#!/usr/bin/env node
/**
 * check: one command, one verdict. The code detectors plus the real screen.
 *
 * Why it exists. In a test with the same request, with and without these skills,
 * the agent with the skills still finished on "the build passes, I did not open
 * the screen", and the screen overflowed at 390px. Five scripts to remember are
 * five chances to skip. This is one, on any agent, from any folder.
 *
 *   node check.mjs src                                     # code only
 *   node check.mjs src --url http://localhost:5173         # code + screen + screenshots
 *   node check.mjs src --url http://localhost:5173 --out shots --routes home,pricing
 *
 * Exit 0: everything ran and came back clean.
 * Exit 1: findings. Fix them and run again.
 * Exit 2: something could not run, so nothing can be claimed about it.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const VALUED = new Set(['--url', '--out', '--routes', '--widths']);
const paths = argv.filter((a, i) => !a.startsWith('--') && !VALUED.has(argv[i - 1]));
const url = flag('url');
const out = resolve(flag('out', 'design-shots'));
const routes = flag('routes', 'home').split(',');
const widths = flag('widths', '390,1280');

if (!paths.length && !url) {
  console.error('usage: node check.mjs <paths...> [--url http://localhost:3000] [--routes home,pricing] [--out dir]');
  process.exit(2);
}

const sibling = (skill, file) => join(HERE, '..', '..', skill, 'scripts', file);
const run = (script, args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', timeout: 300_000 });
const lines = (s) => s.split(/\r?\n/);

let findings = 0;
let blocked = 0;

/* ---------- code ---------- */
console.log('CODE');
const scan = sibling('visant-killer', 'killer-scan.mjs');
if (!paths.length) {
  console.log('  not run: no paths given');
  blocked++;
} else if (!existsSync(scan)) {
  console.log('  not run: visant-killer is not installed next to this skill');
  console.log('  npx skills add pedrojaques99/visant-skills-public --skill visant-killer visant-copy');
  blocked++;
} else {
  const r = run(scan, paths);
  const text = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  if (/NOT SCANNED/.test(text)) {
    console.log('  not scanned: the code detectors read React JSX. Judge this stack by hand; the screen check below still counts.');
  } else if (/GATE CLOSED/.test(text)) {
    const keep = lines(text).filter((l) => /^\[FAIL\]/.test(l) || /^\s{8,}\S+:\d+/.test(l));
    for (const l of keep.slice(0, 40)) console.log(`  ${l.trim()}`);
    if (keep.length > 40) console.log(`  ... and ${keep.length - 40} more; run killer-scan directly for all of them`);
    findings += Math.max(1, keep.filter((l) => !/^\[FAIL\]/.test(l)).length);
  } else if (/gates: /.test(text)) {
    console.log(`  clean. ${lines(text).find((l) => /^gates: /.test(l))}`);
  } else {
    console.log('  not run: killer-scan gave no verdict');
    console.log(text.trim().slice(0, 400));
    blocked++;
  }
}

/* ---------- screen ---------- */
console.log('\nSCREEN');
const screen = sibling('visant-killer', 'corta-url.mjs');
if (!url) {
  console.log('  NOT OPENED: no --url. Start the app and pass it. Compiling is not seeing.');
  blocked++;
} else if (!existsSync(screen)) {
  console.log('  NOT OPENED: visant-killer is not installed next to this skill');
  blocked++;
} else {
  const r = run(screen, [url, ...routes, '--widths', widths, '--shots', out]);
  const text = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim();
  if (r.status === 0 || r.status === 1) {
    console.log(lines(text).map((l) => `  ${l}`).join('\n'));
    if (r.status === 1) findings++;
  } else {
    console.log('  NOT OPENED');
    console.log(`  ${text.slice(0, 400)}`);
    blocked++;
  }
}

/* ---------- verdict ---------- */
console.log('');
if (blocked) {
  console.log(`VERDICT: NOT VERIFIED. ${blocked} check(s) could not run. Say so in your answer; do not call this done.`);
  process.exit(2);
}
if (findings) {
  console.log('VERDICT: FINDINGS. Fix them, or confirm on the image that a screen candidate is a false alarm, and run again.');
  process.exit(1);
}
console.log('VERDICT: the checks are clean. Now read the screenshots: a clean check is not a good screen.');
console.log('If you edited this screen: before and after side by side, shown to the owner (visant-killer/scripts/regressao.mjs).');
console.log('Chromium is not an iPhone: a custom touch gesture stays under what you did not check until it ran on one.');
process.exit(0);
