#!/usr/bin/env node
/**
 * Codemod: swaps inline durations for an SSoT token (`DUR.*`).
 *
 * It exists because of a count: in an audit with 55 motion-lint findings, 48
 * were `duration: 0.6` wanting to become `DUR.slow`. Purely mechanical, and it
 * still ate most of the session by hand. `transition-all` already had a
 * codemod; duration, the most common finding of all, did not.
 *
 *   node scripts/codemod-duration.mjs                 # dry-run, prints the plan
 *   node scripts/codemod-duration.mjs --apply         # applies exact + near
 *   node scripts/codemod-duration.mjs --apply --over  # includes > 300ms
 *   node scripts/codemod-duration.mjs <dir> ...       # explicit target
 *   node scripts/codemod-duration.mjs --self-test
 *
 * THREE BUCKETS, and the difference between them is why this is not a sed:
 *
 *   EXACT     the number already is a token's value (0.2 -> DUR.base). Rename,
 *             zero risk. Included in --apply.
 *   NEAR      within a token's tolerance and under the 300ms ceiling
 *             (0.25 -> DUR.base). Barely changes the timing. Included in --apply.
 *   OVER      above 300ms, the defect the slow-ui-duration rule points at
 *             (0.6 -> DUR.slow). This CUTS the duration in half: a behaviour
 *             change, not a refactor. Only with --over, because route
 *             transitions and marketing pieces are legitimate exceptions and
 *             whoever looks at the screen decides.
 *
 * The codemod never invents an import: if the file starts using `DUR` without
 * importing it, it adds the import using the path the repo already uses.
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, sep, extname, resolve, relative, isAbsolute } from "node:path";

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const OVER = argv.includes("--over");
const INCLUDE_UI = argv.includes("--include-ui");
const SELF_TEST = argv.includes("--self-test");
const ROOT = process.cwd();

const EXTS = new Set([".tsx", ".ts", ".jsx", ".js"]);
const SKIP_DIR = /^(node_modules|\.next|\.git|dist|build|coverage|__tests__|__mocks__)$/;

/** Mirror of the SSoT (assets/motion-ssot-starter/motion.ts). Seconds. */
const DUR = { press: 0.12, fast: 0.16, base: 0.2, slow: 0.3 };
const MAX_UI = 0.3;
/* RELATIVE tolerance, not absolute. With a fixed 60ms tolerance, 0.08 matched
   press (0.12), but 80ms and 120ms are 50% apart, and duration perception is
   logarithmic: the ratio matters, not the difference. 25% is the point where
   it still reads as "the author meant this token". */
const REL_TOL = 0.25;

/* -------------------------------------------------------------------------- */
/* Classification                                                             */
/* -------------------------------------------------------------------------- */

/** @returns {{token: string, bucket: 'EXACT'|'NEAR'|'OVER'} | null} */
export function classify(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;

  for (const [name, v] of Object.entries(DUR)) {
    if (Math.abs(seconds - v) < 1e-9) return { token: name, bucket: "EXACT" };
  }

  if (seconds > MAX_UI) return { token: "slow", bucket: "OVER" };

  /* A tie rounds DOWN. DUR is in ascending order and the strict `<` lets the
     first one win, so 0.18 becomes fast and 0.25 becomes base. Not a detail:
     this skill's whole thesis is that UI under ~300ms responds and above that
     feels stuck. When the tiebreak is arbitrary, it falls on the side the
     skill defends. */
  let best = null;
  for (const [name, v] of Object.entries(DUR)) {
    const d = Math.abs(seconds - v);
    if (d <= v * REL_TOL && (!best || d < best.d)) best = { token: name, d };
  }
  /* Under 300ms but far from every token: do not guess. A 0.08 may be a
     deliberate choice of a drier press, and swapping it for DUR.press without
     notice hides the decision instead of recording it. It becomes UNMAPPED
     in the report. */
  return best ? { token: best.token, bucket: "NEAR" } : null;
}

/* -------------------------------------------------------------------------- */
/* SSoT import                                                                */
/* -------------------------------------------------------------------------- */

const IMPORT_DUR = /import\s*\{[^}]*\bDUR\b[^}]*\}\s*from\s*["']([^"']+)["']/;

/** Finds the path THIS repo uses to import the SSoT. */
function detectSsotPath(files) {
  const count = new Map();
  for (const f of files) {
    const m = readFileSync(f, "utf8").match(IMPORT_DUR);
    if (m) count.set(m[1], (count.get(m[1]) ?? 0) + 1);
  }
  if (!count.size) return null;
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/** Adds the import after the file's last import. */
function addImport(src, path) {
  if (IMPORT_DUR.test(src)) return src;
  const lines = src.split("\n");
  let last = -1;
  for (let i = 0; i < lines.length; i++) if (/^import\b/.test(lines[i])) last = i;
  const stmt = `import { DUR } from "${path}";`;
  if (last === -1) {
    const at = /^["']use (client|server)["'];?\s*$/.test(lines[0]?.trim() ?? "") ? 1 : 0;
    lines.splice(at, 0, stmt, "");
  } else {
    lines.splice(last + 1, 0, stmt);
  }
  return lines.join("\n");
}

/* -------------------------------------------------------------------------- */
/* Walk                                                                       */
/* -------------------------------------------------------------------------- */

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIR.test(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (EXTS.has(extname(name))) out.push(p);
  }
  return out;
}

const isUi = (f) => f.split(sep).join("/").includes("components/ui/");
/* The SSoT is the only place where the literal number is the definition, not a copy. */
const isSsot = (f) => /(^|[\\/])(lib[\\/])?motion\.tsx?$/.test(f);

/** `duration: 0.6` in a framer transition object. */
const DURATION_LITERAL = /(\bduration:\s*)(\d*\.?\d+)(\s*[,}\n])/g;

function processFile(file, ssotPath) {
  const src = readFileSync(file, "utf8");
  if (/motion-lint-disable-file/.test(src)) return null;

  const lines = src.split("\n");
  const hits = [];

  const next = lines.map((line, i) => {
    if (/motion-lint-disable-next-line/.test(lines[i - 1] ?? "")) return line;
    // A comment is not code.
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return line;

    return line.replace(DURATION_LITERAL, (whole, head, num, tail) => {
      const c = classify(parseFloat(num));
      if (!c) {
        hits.push({ line: i + 1, from: num, bucket: "UNMAPPED", token: null });
        return whole;
      }
      const willWrite = c.bucket !== "OVER" || OVER;
      hits.push({ line: i + 1, from: num, bucket: c.bucket, token: c.token, applied: willWrite });
      return willWrite ? `${head}DUR.${c.token}${tail}` : whole;
    });
  });

  const written = hits.filter((h) => h.applied);
  if (!written.length) return { file, hits, changed: false };

  let out = next.join("\n");
  if (ssotPath) out = addImport(out, ssotPath);
  return { file, hits, changed: true, out, needsImport: !ssotPath && !IMPORT_DUR.test(src) };
}

/* -------------------------------------------------------------------------- */
/* --self-test                                                                */
/* -------------------------------------------------------------------------- */

if (SELF_TEST) {
  const cases = [
    // [seconds, expected token, expected bucket]
    [0.12, "press", "EXACT"],
    [0.16, "fast", "EXACT"],
    [0.2, "base", "EXACT"],
    [0.3, "slow", "EXACT"],
    [0.25, "base", "NEAR"],
    [0.18, "fast", "NEAR"],  // fast/base tie falls to the faster one
    [0.6, "slow", "OVER"],
    [1.2, "slow", "OVER"],
    [0.31, "slow", "OVER"], // 310ms is already past the ceiling: not "near slow"
  ];
  const problems = [];
  for (const [s, token, bucket] of cases) {
    const c = classify(s);
    if (!c) { problems.push(`${s}s: not classified`); continue; }
    if (c.token !== token || c.bucket !== bucket) {
      problems.push(`${s}s: expected ${bucket}/${token}, got ${c.bucket}/${c.token}`);
    }
  }
  /* A stray value under the ceiling must NOT be guessed: if this ever becomes
     NEAR, the codemod starts erasing deliberate decisions. */
  if (classify(0.08)) problems.push(`0.08s should stay UNMAPPED, got ${classify(0.08).token}`);
  if (classify(0)) problems.push("0 should be ignored");

  // A real rewrite, import included.
  const sample = `"use client";\nimport { motion } from "framer-motion";\n\nexport const A = () => <motion.div transition={{ duration: 0.2 }} />;\n`;
  const rewritten = addImport(
    sample.replace(DURATION_LITERAL, (w, h, n, t) => {
      const c = classify(parseFloat(n));
      return c ? `${h}DUR.${c.token}${t}` : w;
    }),
    "@/lib/motion",
  );
  if (!/duration: DUR\.base/.test(rewritten)) problems.push("did not rewrite duration: 0.2 -> DUR.base");
  if (!IMPORT_DUR.test(rewritten)) problems.push("did not add the DUR import");
  if ((rewritten.match(/import \{ DUR \}/g) ?? []).length !== 1) problems.push("duplicate import");

  // Idempotence: running twice must not touch it again.
  const twice = addImport(rewritten, "@/lib/motion");
  if (twice !== rewritten) problems.push("not idempotent: the second pass changed the file");

  if (problems.length) {
    console.error("codemod-duration --self-test FAILED");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`codemod-duration --self-test ok: ${cases.length} classifications, rewrite, import and idempotence.`);
  process.exit(0);
}

/* -------------------------------------------------------------------------- */
/* Run                                                                        */
/* -------------------------------------------------------------------------- */

const roots = argv.filter((a) => !a.startsWith("--"));
const targets = (roots.length ? roots : ["components", "app", "src"])
  .map((t) => resolve(ROOT, t))
  .filter((t) => existsSync(t));

if (!targets.length) {
  console.error("codemod-duration: no target exists. Pass the folder explicitly.");
  process.exit(2);
}

const files = [];
for (const t of targets) {
  statSync(t).isDirectory() ? walk(t, files) : files.push(t);
}
const scoped = files.filter((f) => !isSsot(f) && (INCLUDE_UI || !isUi(f)));

const ssotPath = detectSsotPath(scoped);
const disp = (f) => {
  const r = relative(ROOT, f);
  return (r && !r.startsWith("..") && !isAbsolute(r) ? r : f).split(sep).join("/");
};

const buckets = { EXACT: [], NEAR: [], OVER: [], UNMAPPED: [] };
let filesChanged = 0;

for (const file of scoped) {
  const r = processFile(file, ssotPath);
  if (!r) continue;
  for (const h of r.hits) buckets[h.bucket].push(`${disp(file)}:${h.line}  duration: ${h.from} → DUR.${h.token ?? "?"}`);
  if (r.changed) {
    filesChanged++;
    if (APPLY) writeFileSync(file, r.out, "utf8");
  }
}

const show = (name, list, note) => {
  if (!list.length) return;
  console.log(`\n${name} (${list.length})${note ? `: ${note}` : ""}`);
  for (const l of list) console.log(`  ${l}`);
};

show("EXACT", buckets.EXACT, "the number already IS the token; rename");
show("NEAR", buckets.NEAR, "within tolerance and under 300ms");
show("OVER", buckets.OVER, OVER ? "applied: CUTS the duration, review the diff" : "NOT applied, behaviour change, see below");
show("UNMAPPED", buckets.UNMAPPED, "far from every token; decide by hand or add a token to the SSoT");

console.log("\n" + "─".repeat(64));
if (!ssotPath) {
  console.log("warning: no file in the target imports `DUR` yet, so the import was NOT");
  console.log("added. Import the SSoT in one file first (or copy");
  console.log("assets/motion-ssot-starter/motion.ts), then run again.");
} else {
  console.log(`SSoT detected in the repo itself: import { DUR } from "${ssotPath}"`);
}
const applied = buckets.EXACT.length + buckets.NEAR.length + (OVER ? buckets.OVER.length : 0);
console.log(`${APPLY ? "APPLIED" : "DRY-RUN"}: ${applied} swap(s) in ${filesChanged} file(s).`);
if (!OVER && buckets.OVER.length) {
  console.log(
    `\n${buckets.OVER.length} finding(s) OVER 300ms were left out. They are the defect the\n` +
      `slow-ui-duration rule points at, but swapping 0.6 for DUR.slow CUTS the animation in\n` +
      `half, and route transitions and marketing pieces are legitimate exceptions. After\n` +
      `reading the list:  node scripts/codemod-duration.mjs --apply --over`,
  );
}
if (!APPLY) console.log("\nRun again with --apply to write.");
