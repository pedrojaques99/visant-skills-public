#!/usr/bin/env node
/* refine-scan: the greppable gate of the finishing layer.
 *
 *   node refine-scan.mjs components/admin/finance
 *   node refine-scan.mjs --self-test        (proves the detector both ways)
 *
 * Six rules, all for things that compile, pass lint and still break:
 *
 *   CHART_RAW_COLOR      raw color in a chart prop (hex, rgb, Tailwind palette)
 *   CHART_WITHOUT_STATE  chart without ChartState: an empty axis instead of "no data"
 *   DEFS_ID_NOT_SCOPED   literal id in defs/clipPath: two charts collide
 *   HARDCODED_MOTION     cubic-bezier or duration outside the SSoT
 *   BAD_EASE             ease-in on UI, transition-all, animate-bounce, scale(0)
 *   LAYOUT_ANIMATION     width/height/margin/padding animation
 *
 * Complements, does not replace: `impeccable detect` and `npm run audit:design`
 * catch the visual tell, and killer-scan runs all three together. Exit 1 on any
 * finding.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

const args = process.argv.slice(2);
const selfTest = args.includes('--self-test');
const targets = args.filter((a) => !a.startsWith('--'));

if (!targets.length && !selfTest) {
  console.error('usage: node refine-scan.mjs <files-or-folders>');
  console.error('       node refine-scan.mjs --self-test');
  process.exit(2);
}

const ROOT = process.cwd();
const norm = (p) => p.split(sep).join('/');

/* The stored path is ALWAYS absolute; shortening is a printing concern.
   `relative(cwd, target)` across drives (cwd on C:, target on Z:) returns
   something that does not resolve back, and the scan died with
   `ENOENT: C:\Users\...\D:\dev\...`. An agent calling the detector from
   outside always passes an absolute path, so that was the hot path, not the
   edge case. */
const abs = (p) => resolve(ROOT, p);
const disp = (p, base) => {
  const r = relative(base, p);
  return norm(r && !r.startsWith('..') && !isAbsolute(r) ? r : p);
};
/* `__fixtures__` and `.next-*` were added after an audit (2026-08-12).
 *
 * `__fixtures__` is a linter's test corpus: a file full of defects ON PURPOSE,
 * which exists to prove the rules still fire. Scanning it makes one detector
 * accuse another's evidence, and the "obvious" fix would be deleting the
 * fixture's defects, which is exactly how a regression suite dies.
 * `motion-lint` already ignored it; this one did not, and the difference only
 * showed up when both ran on the same repo.
 *
 * `.next-*` is a build with its own name (NEXT_DIST_DIR), used by whoever runs
 * two dev servers side by side. Inside it every token is already inlined, so
 * the detector reports the compiler's work as the author's. */
const SKIP_DIR = /^(node_modules|\.next|\.next-.*|\.git|dist|build|coverage|__fixtures__)$/;

function walk(p, out = []) {
  const st = statSync(p);
  if (st.isDirectory()) {
    for (const name of readdirSync(p)) {
      if (SKIP_DIR.test(name)) continue;
      walk(join(p, name), out);
    }
  } else if (/\.(tsx|jsx)$/.test(p)) {
    out.push(p);
  }
  return out;
}

const CHART_MARK = /<(ResponsiveContainer|AreaChart|LineChart|BarChart|PieChart|RadialBarChart|ComposedChart)\b/;
const CHART_COLOR_PROP = /\b(stroke|fill|stopColor|color|activeStroke)\s*=\s*(["'{])/;
/* A RAW color is one that carries the number. `hsl(var(--muted-foreground))` is
   a token and passes: in this repo the tokens store a bare HSL channel
   (`--primary: 0 0% 9%`), so the `hsl(...)` wrapper is mandatory and
   `var(--primary)` alone is no color at all. The previous rule accused the
   right one and acquitted the wrong one. */
const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(\s*(?!var\()[\d.]/;
/** `var(--x)` without a wrapper in a color prop: silently no color. */
const NAKED_VAR = /=\s*["']\s*var\(--[^)]+\)\s*["']/;
const TW_PALETTE = /\b(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|[1-9]00|950)\b/;

/** One rule: id, whether it matches the line, and the fix that almost always works. */
const RULES = [
  {
    id: 'CHART_RAW_COLOR',
    /* Only in files that import recharts. Without this the rule accused three.js
       materials and SVG icons, where `color="#fff"` is no token at all: it is
       the lib's API. A detector that shouts out of scope gets switched off. */
    requires: /from ['"]recharts['"]/,
    test: (line) =>
      CHART_COLOR_PROP.test(line) &&
      (RAW_COLOR.test(line) || TW_PALETTE.test(line) || NAKED_VAR.test(line)),
    hint: 'Series color comes from a token WITH its wrapper: stroke="hsl(var(--primary))". The tokens store a bare HSL channel, so a naked var(--x) is not a color and the stroke vanishes with no error.',
  },
  {
    id: 'DEFS_ID_NOT_SCOPED',
    test: (line, _i, src) =>
      /<(linearGradient|radialGradient|clipPath|filter|pattern)\b/.test(line) &&
      /\sid\s*=\s*["'][^"'{]+["']/.test(line) &&
      !/useId/.test(src),
    hint: 'A defs id needs per-instance scope (useId). Two charts with the same id overwrite each other, and the bug shows up in only one of them.',
  },
  {
    id: 'HARDCODED_MOTION',
    test: (line) => /cubic-bezier\(/.test(line) || /duration-\[\d+ms\]/.test(line),
    hint: 'Easing and duration come from the SSoT: [transition-timing-function:var(--ease-out)] and [transition-duration:var(--dur-base)].',
  },
  {
    id: 'BAD_EASE',
    // The shared primitive is upstream (shadcn) and has a legitimate case: the
    // sidebar animates width because that is what a sidebar does. Same
    // exception as the transition-all codemod in visant-motion. Suppressed is
    // COUNTED at the end, never silenced: a silent cut reads as "all clean".
    skipUi: true,
    test: (line) =>
      /\btransition-all\b/.test(line) ||
      /\bease-in\b(?!-out)/.test(line) ||
      /\banimate-bounce\b/.test(line) ||
      /scale\(0\)|scale-0\b/.test(line),
    hint: 'transition-all animates what you did not ask for; ease-in on UI feels stuck; bounce and scale(0) are template tells.',
  },
  {
    id: 'LAYOUT_ANIMATION',
    skipUi: true,
    test: (line) => /transition-\[(?:[^\]]*\b(?:width|height|margin|padding|top|left)\b)/.test(line),
    hint: 'Animate only transform and opacity. Width and height go through layout every frame and jank.',
  },
];

/**
 * A file rule, not a line rule: chart without state.
 *
 * The proof of "has state" used to be `ChartState|isEmpty`: English-only, in
 * Portuguese code. `HoursPanorama.tsx` splits error, empty and loading into
 * three ternary branches (`error && !data`, `vazio`, `isLoading`) and was
 * accused anyway, only because the variable is called `vazio` ("empty") and
 * not `isEmpty`.
 *
 * And the rule asked too little: `isEmpty` alone acquitted the chart that
 * treats a network error AS empty, which is the exact defect it exists to
 * catch ("an empty framed axis is the 0 items that was really an error").
 *
 * But the error branch can only be demanded from whoever FETCHES the data.
 * Demanding it from everyone accused `HoursTeamChart` and `LeaderboardRace`,
 * which receive `isLoading` as a prop and already sit in `ChartState`: a
 * drawing component has no error to handle, it lives in the parent that does
 * the fetch. A rule that accuses two and hits zero is a bug, not a rule.
 */
const CHART_EMPTY_MARK = /ChartState|isEmpty|\bvazio\b|\bsemDado\b|\bnoData\b/;
const CHART_ERROR_MARK = /\berror\b/;
/** Whoever fetches its own data also answers for the error. */
const CHART_FETCHES = /\buseSWR\b|\buseQuery\b|\bfetch\(/;

function fileRules(file, src) {
  const out = [];
  const hasEmpty = CHART_EMPTY_MARK.test(src);
  const mustHandleError = CHART_FETCHES.test(src);
  const hasState = hasEmpty && (!mustHandleError || CHART_ERROR_MARK.test(src));
  if (CHART_MARK.test(src) && !hasState) {
    const i = src.split(/\r?\n/).findIndex((l) => CHART_MARK.test(l));
    out.push({
      id: 'CHART_WITHOUT_STATE',
      line: i + 1,
      hint: 'Every chart sits in ChartState: an empty framed axis is the "0 items" that was really a network error.',
      excerpt: 'chart with no empty or loading state',
    });
  }
  return out;
}

let suppressedUi = 0;

function scan(file, srcOverride) {
  /* `file` already arrives absolute (see `abs()` above). The `join(ROOT, file)`
     that used to be here was exactly the cross-drive crash: it became
     `C:\Users\...\D:\dev\...`. */
  const src = srcOverride ?? readFileSync(file, 'utf8');
  const lines = src.split(/\r?\n/);
  const isUi = /\/(components\/)?ui\//.test(`/${norm(file)}`);
  const findings = [];

  lines.forEach((raw, i) => {
    // A comment is not code: the example written in an explanation is not a finding.
    if (/^\s*(\{\s*)?(\/\/|\*|\/\*)/.test(raw)) return;
    for (const rule of RULES) {
      if (rule.requires && !rule.requires.test(src)) continue;
      if (!rule.test(raw, i, src)) continue;
      if (rule.skipUi && isUi) {
        suppressedUi++;
        continue;
      }
      findings.push({ id: rule.id, line: i + 1, hint: rule.hint, excerpt: raw.trim().slice(0, 96) });
    }
  });

  findings.push(...fileRules(file, src));
  return findings;
}

/* ---------- self-test ---------- */

const BAD_FIXTURE = `
import { AreaChart, ResponsiveContainer, Area } from 'recharts';
export function Bad() {
  return (
    <ResponsiveContainer>
      <AreaChart data={[]}>
        <defs><linearGradient id="fill" /></defs>
        <Area dataKey="v" stroke="#7c3aed" fill="url(#fill)" />
        <Area dataKey="w" stroke="text-purple-400" />
        <Area dataKey="x" stroke="hsl(210 40% 50%)" />
        <Area dataKey="y" stroke="var(--primary)" />
      </AreaChart>
      <div className="transition-all ease-in duration-[420ms]" />
      <div className="transition-[width,height]" style={{ transitionTimingFunction: 'cubic-bezier(.1,.2,.3,.4)' }} />
    </ResponsiveContainer>
  );
}
`;

const GOOD_FIXTURE = `
import { useId } from 'react';
import { AreaChart, ResponsiveContainer, Area } from 'recharts';
import { ChartState } from './ChartState';
export function Good({ isLoading, isEmpty, error }) {
  const gid = useId();
  if (error) return <p>Could not load.</p>;
  return (
    <ChartState isLoading={isLoading} isEmpty={isEmpty}>
      <ResponsiveContainer>
        <AreaChart data={[]}>
          <defs><linearGradient id={\`fill-\${gid}\`} /></defs>
          <Area dataKey="v" stroke="hsl(var(--primary))" fill={\`url(#fill-\${gid})\`} />
          <Area dataKey="w" stroke="hsl(var(--muted-foreground))" />
        </AreaChart>
      </ResponsiveContainer>
      <div className="transition-colors [transition-duration:var(--dur-base)] [transition-timing-function:var(--ease-out)]" />
    </ChartState>
  );
}
`;

/**
 * The case the English-only rule accused by mistake: states exist, split into
 * three branches, but named in PORTUGUESE. It came from `HoursPanorama.tsx` in
 * visant-board. It stays Portuguese in the fixture so the rule's fix is not lost.
 */
const GOOD_FIXTURE_PT = `
import { LineChart, ResponsiveContainer, Line } from 'recharts';
export function Panorama({ data, error, isLoading, mutate }) {
  const vazio = !data?.pontos?.length;
  if (error && !data) return <button onClick={mutate}>Tentar de novo</button>;
  if (vazio) return <p>Nenhuma hora apontada neste período.</p>;
  return (
    <ResponsiveContainer>
      <LineChart data={data.pontos}>
        <Line dataKey="v" stroke="hsl(var(--primary))" isAnimationActive={!isLoading} />
      </LineChart>
    </ResponsiveContainer>
  );
}
`;

/**
 * A PRESENTATIONAL chart: receives `isLoading` as a prop and sits in
 * `ChartState`. It fetches nothing, so it has no error to handle. It came from
 * `HoursTeamChart.tsx` and `LeaderboardRace.tsx`, which an intermediate version
 * of this rule accused for demanding `error` from every chart.
 */
const GOOD_FIXTURE_DUMB = `
import { BarChart, ResponsiveContainer, Bar } from 'recharts';
import { ChartState } from './ChartState';
export function Drawing({ points, isLoading }) {
  return (
    <ChartState isLoading={isLoading} isEmpty={points.length === 0}>
      <ResponsiveContainer>
        <BarChart data={points}><Bar dataKey="v" stroke="hsl(var(--primary))" /></BarChart>
      </ResponsiveContainer>
    </ChartState>
  );
}
`;

/**
 * The case the OLD rule acquitted: it FETCHES the data, has `isEmpty`, and does
 * not separate the error. It is the hint's "0 items that was really a network
 * error", slipping through.
 */
const BAD_FIXTURE_NO_ERROR = `
import useSWR from 'swr';
import { BarChart, ResponsiveContainer, Bar } from 'recharts';
export function EmptyOnly() {
  const { data } = useSWR('/api/hours');
  const isEmpty = !data?.length;
  if (isEmpty) return <p>No data.</p>;
  return (
    <ResponsiveContainer>
      <BarChart data={data}><Bar dataKey="v" stroke="hsl(var(--primary))" /></BarChart>
    </ResponsiveContainer>
  );
}
`;

if (selfTest) {
  const bad = scan('fixture-bad.tsx', BAD_FIXTURE);
  const good = [
    ...scan('fixture-good.tsx', GOOD_FIXTURE),
    ...scan('fixture-good-pt.tsx', GOOD_FIXTURE_PT),
    ...scan('fixture-good-dumb.tsx', GOOD_FIXTURE_DUMB),
  ];
  const noError = scan('fixture-empty-only.tsx', BAD_FIXTURE_NO_ERROR);
  const expected = ['CHART_RAW_COLOR', 'DEFS_ID_NOT_SCOPED', 'HARDCODED_MOTION', 'BAD_EASE', 'LAYOUT_ANIMATION', 'CHART_WITHOUT_STATE'];
  const found = new Set(bad.map((f) => f.id));
  const missing = expected.filter((id) => !found.has(id));

  console.log(`\nrefine-scan self-test\n`);
  console.log(missing.length
    ? `[FAIL]  rule that did not fire on the bad fixture: ${missing.join(', ')}`
    : `[OK]    all ${expected.length} rules fire on the bad fixture`);
  console.log(good.length
    ? `[FAIL]  false positive on the good fixture: ${good.map((f) => `${f.id}:${f.line}`).join(', ')}`
    : '[OK]    no false positive on the 3 good fixtures (state named in Portuguese, presentational chart)');
  // POSITIVE test of the fixed rule: whoever FETCHES and only handles empty MUST be caught.
  const caughtNoError = noError.some((f) => f.id === 'CHART_WITHOUT_STATE');
  console.log(caughtNoError
    ? '[OK]    a chart that fetches and treats a network error as empty is flagged'
    : '[FAIL]  a chart that treats a network error as empty slipped through');
  console.log('-'.repeat(64));
  const failed = missing.length + good.length + (caughtNoError ? 0 : 1);
  console.log(failed ? 'DETECTOR BROKEN.' : 'DETECTOR OK. New case: add it to the fixture, never replace one.');
  process.exit(failed ? 1 : 0);
}

/* ---------- run ---------- */

const files = [];
let base = ROOT;
for (const t of targets) {
  const a = abs(t);
  if (!existsSync(a)) {
    console.error(`target does not exist: ${t}`);
    console.error(`  (resolved to ${a})`);
    process.exit(2);
  }
  if (targets.length === 1) base = statSync(a).isDirectory() ? a : ROOT;
  walk(a, files);
}

let total = 0;
for (const file of files) {
  const findings = scan(file);
  if (!findings.length) continue;
  total += findings.length;
  console.log(`\n${disp(file, base)}`);
  for (const f of findings.sort((a, b) => a.line - b.line)) {
    console.log(`  ${f.id}  line ${f.line}`);
    console.log(`      ${f.excerpt}`);
    console.log(`      ${f.hint}`);
  }
}

console.log('\n' + '-'.repeat(64));
if (suppressedUi) {
  console.log(`${suppressedUi} finding(s) suppressed in components/ui (upstream primitive, legitimate case of animating width). Review by hand if you touch a primitive.`);
}
console.log(total
  ? `REFINE BLOCKED: ${total} finding(s) in ${files.length} file(s).`
  : `REFINE CLEAR: zero findings in ${files.length} file(s).`);
/* This footer exists because a zero from here was once read as a complete
   audit. A script ends in an exit code, and an exit code feels like being
   done: that is how a round skipped visant-frontend entirely without noticing.
   The detector is one slice; the gate is closed by killer-scan, which demands
   the surface table and the record of having opened the screen. */
console.log('');
console.log('This is ONE detector, not the audit. It does not see the chosen form,');
console.log('overflow at 390px, or a screen nobody opened. To close the gate:');
console.log('  node ~/.claude/skills/visant-killer/scripts/killer-scan.mjs --report AUDIT.md <target>');
console.log('-'.repeat(64));
process.exit(total ? 1 : 0);
