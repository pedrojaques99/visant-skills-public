#!/usr/bin/env node
/**
 * motion-lint — the severity table in references/motion-rules.md, executable.
 *
 * A severity table only counts if someone reads it carefully. This one runs.
 * Zero dependencies, zero config: point it at a repo and it reports every
 * feel-breaking pattern with file:line, the reason, and the fix.
 *
 *   node scripts/motion-lint.mjs                    # cwd, human output
 *   node scripts/motion-lint.mjs src app            # specific roots
 *   node scripts/motion-lint.mjs --json             # machine output (CI, agents)
 *   node scripts/motion-lint.mjs --strict           # fail on MEDIUM too
 *   node scripts/motion-lint.mjs --ignore marketing # skip a path substring
 *   node scripts/motion-lint.mjs --self-test        # verify the rules still work
 *
 * Exit code: 1 if any HIGH (or MEDIUM with --strict), else 0. So it drops into
 * a pre-push hook or CI without extra glue.
 *
 * Suppression, when a rule is genuinely wrong for a line — long, deliberate
 * marketing/scroll/3D motion is audited-and-kept, not a defect:
 *   // motion-lint-disable-next-line <rule-id>   (reason required after it)
 *   // motion-lint-disable-file
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

/* -------------------------------------------------------------------------- */
/* Rules                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Each rule: { id, severity, test (RegExp, global), message, fix, files?, skip? }
 * `files` narrows by extension. `skip({ rel, line, src })` marks the places a
 * match is legitimate — the SSoT file is *supposed* to declare the curves.
 */
const isSsotFile = (p) =>
  /(^|[\\/])(lib[\\/])?motion\.tsx?$/.test(p) ||
  /globals(-tokens)?\.css$/.test(p) ||
  /tailwind\.config\./.test(p);

const CODE = [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"];
const STYLE = [".css", ".scss", ".pcss"];
const ALL = [...CODE, ...STYLE];

const RULES = [
  {
    id: "ease-in-on-ui",
    severity: "HIGH",
    files: ALL,
    // `ease-in` but not `ease-in-out`; Tailwind class or CSS timing function.
    test: /(?:^|[\s"'`:;{(])ease-in(?!-out)(?![\w-])/g,
    message: "`ease-in` on UI delays the first frame — exactly when the user is watching.",
    fix: "EASE_OUT / var(--ease-out). Exception: ::view-transition-old (content leaving a route).",
    skip: ({ line }) => /view-transition-old|::view-transition/.test(line),
  },
  {
    id: "scale-zero",
    severity: "HIGH",
    files: ALL,
    test: /(?:scale\(\s*0\s*\)|scale:\s*0\s*[,;}\n]|(?:^|\s)scale-0(?![\w-]))/g,
    message: "Nothing appears from nothing — scale(0) reads as a glitch, not an entrance.",
    fix: "scale(0.95) + opacity:0.",
  },
  {
    id: "transition-all",
    severity: "MEDIUM",
    files: ALL,
    test: /(?:(?:^|[\s"'`])transition-all(?![\w-])|transition:\s*all\b)/g,
    message: "`transition-all` animates props you never chose — including layout ones. Janks.",
    fix: "Scope it: transition-colors / transition-transform / transition-[opacity,box-shadow].",
  },
  {
    id: "slow-ui-duration",
    severity: "HIGH",
    files: ALL,
    // Tailwind duration-[350..999] and raw CSS 350ms+ on a transition.
    test: /(?:(?:^|\s)duration-\[?(?:3[5-9]\d|[4-9]\d\d|\d{4,})m?s?\]?(?![\w-])|transition-duration:\s*(?:3[5-9]\d|[4-9]\d\d|\d{4,})ms|transition-duration:\s*(?:0?\.[4-9]|[1-9])\d*s)/g,
    message: "Interactive UI over ~300ms reads as slow no matter how good the curve is.",
    fix: "DUR.base/DUR.slow (200-300ms). Route/view transitions and marketing are exempt — suppress with a reason.",
    skip: ({ line }) => /view-transition|--dur-vt-|marquee|shimmer|skeleton/.test(line),
  },
  {
    id: "hardcoded-curve",
    severity: "MEDIUM",
    files: ALL,
    test: /cubic-bezier\(/g,
    message: "A curve hardcoded in a component is a curve that drifts from every other surface.",
    fix: "Import EASE_* from lib/motion.ts, or use var(--ease-*).",
    /* A curve on the right side of a custom property IS the token — it has to
       be a literal somewhere, or no token exists at all. The filename allowlist
       (`isSsotFile`) only recognised the tokens it could guess the path of, so
       a product that declares its own scale (an embedded e-book, a client
       theme) got its DECLARATION reported as the drift the rule exists to
       prevent — pointing at the one line that must not change. Judge by the
       shape of the line, not by where the file happens to live. */
    skip: ({ rel, line }) => isSsotFile(rel) || /--[\w-]+\s*:[^;]*cubic-bezier\(/.test(line),
  },
  {
    id: "hardcoded-duration",
    severity: "MEDIUM",
    files: CODE,
    // framer-motion `duration: 0.25` written inline instead of DUR.*
    test: /\bduration:\s*(?:0?\.\d+|\d+(?:\.\d+)?)\s*[,}]/g,
    message: "Inline duration in a component — the SSoT stops being single.",
    fix: "duration: DUR.fast | DUR.base | DUR.slow.",
    skip: ({ rel }) => isSsotFile(rel),
  },
  {
    id: "layout-property-animation",
    severity: "HIGH",
    files: ALL,
    test: /(?:transition:\s*(?:width|height|margin|padding|top|left|right|bottom)\b|transition-\[(?=[^\]]*\b(?:width|height|margin|padding)\b)|animate=\{\{[^}]*\b(?:width|height|marginTop|paddingTop):)/g,
    message: "Animating a layout property runs layout+paint every frame. This is where jank comes from.",
    fix: "transform (scale/translate) + opacity only. For size, animate a wrapper's transform or use FLIP/layout.",
  },
  {
    id: "background-position-shimmer",
    severity: "MEDIUM",
    files: ALL,
    // Same rule block (or keyframes body) mentioning both — they're rarely on
    // one declaration, so scan the block, not the line.
    test: /(?:@keyframes[\s\S]{0,400}?background-position|\{[^{}]{0,300}?animation[^{}]{0,300}?background-position|\{[^{}]{0,300}?background-position[^{}]{0,300}?animation\s*:)/g,
    message: "A shimmer driven by background-position repaints the whole box every frame.",
    fix: "Translate a gradient pseudo-element with transform (see .skeleton in globals-tokens.css).",
  },
  {
    id: "whiletap-inherits-transition",
    severity: "MEDIUM",
    files: CODE,
    // whileTap={{ ... }} with no transition of its own → inherits the (slow) enter one.
    test: /whileTap=\{\{(?:(?!transition)[^}])*\}\}/g,
    message: "`whileTap` with no transition of its own inherits the enter transition — press feels laggy.",
    fix: "whileTap={{ scale: 0.985, transition: { duration: DUR.press, ease: EASE_OUT } }}",
  },
  {
    id: "loader-without-guard",
    severity: "MEDIUM",
    files: CODE,
    // A pending branch rendering a loader, in a file that never delays it.
    test: /\b(?:isLoading|isPending|isFetching|loading|pending)\b\s*(?:&&|\?)[^\n]{0,80}<(?:Spinner|Loader|Loading|Skeleton)/g,
    message: "Loader mounted the instant the request starts — on a fast response it only blinks.",
    fix: "useDelayedFlag(isPending) — 300ms before showing, 500ms minimum once shown.",
    skip: ({ src }) => /useDelayedFlag|delayedFlag/.test(src),
  },
  {
    id: "fake-progress",
    severity: "HIGH",
    files: CODE,
    test: /(?:Math\.min\((?:\d+|progress[^,]*),\s*9\d\)|setProgress\((?:p|prev|progress)[^)]*\+[^)]*\)[^\n]*(?:9\d|0\.9))/g,
    message: "Invented progress that creeps toward 90% teaches users the UI lies to them.",
    fix: "Narrate real steps, or stream partial content. A bar implies a known percentage.",
  },
  {
    id: "popover-origin",
    severity: "MEDIUM",
    files: CODE,
    // A Radix content primitive that animates but never anchors to its trigger.
    test: /<(Popover|DropdownMenu|Select|ContextMenu|HoverCard|Tooltip)Content\b(?![^>]*transform-origin)(?=[^>]*(?:data-\[state=open\]|animate-|transition))/g,
    message: "Overlay scales from its own center instead of from the trigger that opened it.",
    fix: "origin-[var(--radix-<primitive>-content-transform-origin)] (modals are exempt).",
  },
];

/* -------------------------------------------------------------------------- */
/* Scanner                                                                    */
/* -------------------------------------------------------------------------- */

const IGNORED_DIRS = new Set([
  "node_modules", ".next", ".git", "dist", "build", "out", "coverage",
  ".turbo", ".vercel", ".cache", "storybook-static",
  "__fixtures__", // this script's own test corpus — deliberately full of defects
]);

/**
 * A build directory, whatever it got named.
 *
 * `.next` alone was not enough: any repo that runs two dev servers side by side
 * sets NEXT_DIST_DIR (`.next-audit`, `.next-v2`, …), and the linter then read
 * COMPILED css — where every token is already inlined as a raw cubic-bezier.
 * Seen for real: 8 findings became 72, all of them the project's own tokens
 * reflected back from the build output. A detector that reports the compiler's
 * work as the author's work trains people to ignore it.
 */
const isBuildDir = (name) => IGNORED_DIRS.has(name) || /^\.next-/.test(name);

/**
 * Is this line suppressed for this rule?
 *
 * Walks UP through the contiguous comment block above the finding, instead of
 * reading only the single previous line. The old version worked in JSX, where
 * the reason fits on one `{/* … *\/}`, and failed everywhere else:
 *
 *   - in CSS the reason is a `/* … *\/` block, so the line right above the
 *     defect is the selector, not the comment;
 *   - a reason long enough to be worth writing wraps to a second line, which
 *     pushed the marker out of view.
 *
 * Both failures are silent and land on the same person: someone documented the
 * exception exactly as told, the finding kept firing, and the next step is
 * `disable-file` or ignoring the detector. Suppression that only works when the
 * reason is short is a rule that punishes the reason.
 *
 * It also climbs past a line that only OPENS a block. In CSS the marker sits
 * above the selector, never above the declaration it describes — you cannot put
 * a comment between `.acc {` and the property without it reading as a comment
 * about the whole rule. Stopping at the selector meant CSS suppression worked
 * nowhere, which is where it is needed most.
 *
 * It stops at the first line of real code (a declaration, a closing brace), so
 * a marker cannot leak down onto something it was never written about, and the
 * climb is capped so it cannot reach across a whole file.
 */
const SUPPRESSION_CEILING = 25;

function isSuppressed(rawLines, blankLines, line, ruleId) {
  const marker = new RegExp(`motion-lint-disable-next-line\\s+${ruleId}\\b`);
  const floor = Math.max(0, line - 2 - SUPPRESSION_CEILING);
  for (let i = line - 2; i >= floor; i--) {
    if (marker.test(rawLines[i] ?? "")) return true;
    /* "Is this line a comment?" is decided by `blankComments`, not guessed from
       how it starts. Guessing failed on the continuation lines of a block
       comment — the ones that carry no leading `*`, which is most reasons
       written by a human. The blanked source already knows exactly, and reusing
       it means the answer can never drift from what the rules themselves see. */
    /* The climb ends at a CLOSING brace, not at the first sibling line.
       A marker written above a selector describes the whole rule — that is the
       only place CSS lets you put it — and the defect is often the third
       declaration down, with plain siblings in between. Stopping at the first
       sibling meant the marker covered only a rule whose very first property
       was the offending one, which is nobody's file. Ending at `}` scopes the
       marker to its own block: it cannot reach the rule above. */
    const blanked = (blankLines[i] ?? "").trim();
    if (blanked.includes("}")) return false;
  }
  return false;
}

/** Blank out comments so a rule can't fire on prose, keeping line/col offsets. */
function blankComments(src) {
  return (
    src
      /* The JSX comment's WRAPPER goes with its body, and this line comes first
         on purpose. Blanking only the `/* … *\/` left the `}` of `{/* … *\/}`
         behind on the comment's last line; the suppression climb reads `}` as
         the end of a block, so a reason spanning MORE THAN ONE LINE in JSX was
         thrown away — and a one-line reason is exactly what this tool does not
         want to encourage. It survived until now because the fixture happened
         to use a single-line JSX comment, where the marker is found before the
         brace is ever reached. */
      .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, (m) => m.replace(/[^\n]/g, " "))
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
      .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(m.length - p1.length))
  );
}

async function* walk(dir, ignores) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (ignores.some((s) => full.includes(s))) continue;
    if (e.isDirectory()) {
      if (isBuildDir(e.name)) continue;
      yield* walk(full, ignores);
    } else if (ALL.some((ext) => e.name.endsWith(ext))) {
      yield full;
    }
  }
}

function lineAt(src, index) {
  const before = src.slice(0, index);
  const line = before.split("\n").length;
  const col = index - before.lastIndexOf("\n");
  return { line, col };
}

/**
 * Base used to shorten paths when printing. It only shortens when the file is
 * REALLY inside the base; otherwise it returns the target's own absolute base.
 * Without this, a target outside the cwd prints as `../../../app/x.tsx` or,
 * across drives, as a path that opens nowhere. A printed path you cannot paste
 * back costs a trip to the terminal per finding.
 */
/* The base is the TARGET's project root (nearest folder at or above the
   target with a package.json or .git), never the cwd. Shortening against the
   cwd printed `Users/<name>/.../repo/components/mode-toggle.tsx` when the
   lint ran from `C:\` on a repo under it: technically relative, useless to
   paste. No project marker: the target folder itself (a file's folder). */
function displayBase(absTarget, isDir) {
  const start = isDir ? absTarget : dirname(absTarget);
  for (let d = start; ; ) {
    if (existsSync(join(d, "package.json")) || existsSync(join(d, ".git"))) return d;
    const up = dirname(d);
    if (up === d) return start;
    d = up;
  }
}

/** Path relative to the base, or the absolute path when it is not under it. */
function relToBase(base, path) {
  const r = relative(base, path);
  return r && !r.startsWith("..") && !isAbsolute(r) ? r : path;
}

/**
 * A test/spec file. No rendered surface, so no motion rule applies to it.
 *
 * These files quote the very strings the rules hunt for — `it('no
 * transition-all')`, `expect(src).not.toMatch(/ease-in/)` — so the repos that
 * were disciplined enough to GUARD a rule got reported for it. The detector was
 * punishing the guard and rewarding its absence, which is the worst incentive a
 * linter can have.
 */
const isTestFile = (p) => /(^|[\\/])(tests?|__tests__)[\\/]|\.(test|spec)\.[cm]?[jt]sx?$/.test(p);

async function lintFile(path, root) {
  const raw = await readFile(path, "utf8");
  if (raw.includes("motion-lint-disable-file")) return [];
  const rel = relToBase(root, path);
  if (isTestFile(rel)) return [];

  const src = blankComments(raw);
  const rawLines = raw.split("\n");
  const blankLines = src.split("\n");
  const findings = [];

  for (const rule of RULES) {
    if (rule.files && !rule.files.some((ext) => path.endsWith(ext))) continue;

    rule.test.lastIndex = 0;
    let m;
    while ((m = rule.test.exec(src)) !== null) {
      const { line, col } = lineAt(src, m.index);
      const text = rawLines[line - 1] ?? "";
      const prev = rawLines[line - 2] ?? "";

      // Per-line suppression, with the rule named explicitly.
      if (isSuppressed(rawLines, blankLines, line, rule.id)) continue;
      if (rule.skip && rule.skip({ rel, line: text, src: raw })) continue;

      findings.push({
        rule: rule.id,
        severity: rule.severity,
        file: rel.split(sep).join("/"),
        line,
        col,
        snippet: text.trim().slice(0, 120),
        message: rule.message,
        fix: rule.fix,
      });
      if (m.index === rule.test.lastIndex) rule.test.lastIndex++; // zero-width guard
    }
  }
  return findings;
}

/* -------------------------------------------------------------------------- */
/* CLI                                                                        */
/* -------------------------------------------------------------------------- */

const argv = process.argv.slice(2);

/**
 * --self-test: run the rules against `__fixtures__/`, where every defect is
 * planted on purpose. Asserts three things a regex suite silently loses over
 * time: every rule still fires at least once, the clean fixture stays at zero
 * (no false positives), and suppression still suppresses. Run it after touching
 * any pattern — a rule that quietly stopped matching is worse than no rule,
 * because the audit comes back green.
 */
if (argv.includes("--self-test")) {
  const { fileURLToPath } = await import("node:url");
  const { dirname } = await import("node:path");
  const here = dirname(fileURLToPath(import.meta.url));
  const fx = join(here, "__fixtures__");

  const bad = [
    ...(await lintFile(join(fx, "bad.tsx"), fx)),
    ...(await lintFile(join(fx, "bad.css"), fx)),
  ];
  const good = [
    ...(await lintFile(join(fx, "good", "good.tsx"), fx)),
    ...(await lintFile(join(fx, "good", "good.css"), fx)),
    // A repo that GUARDS the rules with a test used to be reported for quoting
    // the very patterns it defends. Zero here, or the detector punishes rigour.
    ...(await lintFile(join(fx, "good", "guard.test.tsx"), fx)),
  ];
  const suppressed = [
    ...(await lintFile(join(fx, "suppressed.tsx"), fx)),
    // CSS cannot write a one-line marker: the reason is a block comment, and a
    // reason worth writing wraps. Both shapes used to fail silently.
    ...(await lintFile(join(fx, "suppressed.css"), fx)),
  ];

  const fired = new Set(bad.map((f) => f.rule));
  const silent = RULES.filter((r) => !fired.has(r.id)).map((r) => r.id);

  const problems = [];
  if (silent.length) problems.push(`rule(s) never fired on the bad fixture: ${silent.join(", ")}`);
  if (good.length)
    problems.push(`false positive(s) on the clean fixture: ${good.map((f) => `${f.rule}@${f.file}:${f.line}`).join(", ")}`);
  if (suppressed.length)
    problems.push(`suppression leaked: ${suppressed.map((f) => `${f.file}:${f.line} ${f.rule}`).join(", ")}`);

  /* Build output is not authored code. Walked directories can't go through
     lintFile, so the predicate is asserted directly — the day someone drops the
     `.next-*` branch, a repo running two dev servers starts reporting its own
     compiled css, where every token is already inlined as a raw curve. */
  for (const d of [".next", ".next-v2", ".next-audit", "node_modules"])
    if (!isBuildDir(d)) problems.push(`build dir not ignored: ${d}`);
  for (const d of ["app", "components", "next-steps"])
    if (isBuildDir(d)) problems.push(`source dir wrongly ignored: ${d}`);

  /* Suppression has to stop at the end of its own block. Without this, the fix
     that let a marker sit above a selector would keep widening until one marker
     silenced a whole file — and a file nobody re-reads reports green. */
  const leak = await lintFile(join(fx, "leak.css"), fx);
  if (leak.length !== 1)
    problems.push(
      `leak fixture: expected exactly 1 finding (the unmarked block), got ${leak.length}` +
        (leak.length ? ` — ${leak.map((f) => `${f.rule}@${f.line}`).join(", ")}` : ""),
    );

  /* Printed paths are relative to the target's project root, whatever the
     cwd: the fixtures sit in a repo with a package.json, so a finding prints
     as `visant-motion/scripts/fixtures/bad.tsx`, never `Users/...` or `../..`. */
  {
    const base = displayBase(fx, true);
    const shown = relToBase(base, join(fx, "bad.tsx")).split(sep).join("/");
    if (!existsSync(join(base, "package.json")) && !existsSync(join(base, ".git")))
      problems.push(`display base is not a project root: ${base}`);
    if (!/^[\w.-]+(\/[\w.-]+)*\/bad\.tsx$/.test(shown) || shown.startsWith(".."))
      problems.push(`path display: expected a project-relative path, got ${shown}`);
    if (relToBase(join(fx, "good"), join(fx, "bad.tsx")) !== join(fx, "bad.tsx"))
      problems.push("path display: a file outside the base must print absolute");
  }

  if (problems.length) {
    console.error("motion-lint --self-test FAILED");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(
    `motion-lint --self-test ok — ${RULES.length}/${RULES.length} rules fire, ` +
      `clean fixture is clean, suppression holds.`,
  );
  process.exit(0);
}

/**
 * --fix: delegates to the codemods. The lint rewrites nothing on its own: the
 * decision of what is safe to swap lives in the codemod, which can tell a
 * mechanical swap from a behaviour change. This is just the single door,
 * because `--fix` is what the hand reaches for after reading 55 findings.
 *
 * What comes out of here is what is REALLY mechanical. What changes behaviour
 * (duration above 300ms, transition-all with a live transform) the codemod
 * holds back and explains, instead of applying silently.
 */
if (argv.includes("--fix")) {
  const { spawnSync } = await import("node:child_process");
  const { fileURLToPath: f2u } = await import("node:url");
  const { dirname: dn } = await import("node:path");
  const here = dn(f2u(import.meta.url));
  const passthru = argv.filter((a) => !["--fix", "--json", "--strict", "--self-test"].includes(a));

  const codemods = [
    { name: "inline duration → DUR.*", script: join(here, "codemod-duration.mjs") },
    { name: "transition-all → explicit list", script: join(here, "codemod-transition-all.mjs") },
  ];
  for (const c of codemods) {
    console.log(`\n=== ${c.name} ===`);
    const r = spawnSync(process.execPath, [c.script, ...passthru], { stdio: "inherit" });
    if (r.error) console.error(`  (did not run: ${r.error.message})`);
  }
  console.log(
    "\n" + "─".repeat(64) + "\n" +
      "--fix covers only the mechanical part. Run `motion-lint` again for the rest:\n" +
      "ease-in on UI, scale(0), popovers without an origin, blinking loaders and\n" +
      "undesigned waits are design decisions, not text substitution.",
  );
  process.exit(0);
}

const json = argv.includes("--json");
const strict = argv.includes("--strict");
const ignores = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--ignore" && argv[i + 1]) ignores.push(argv[++i]);
}
const roots = argv.filter((a) => !a.startsWith("--") && !ignores.includes(a));
const cwd = process.cwd();
const targets = roots.length ? roots : ["."];

const findings = [];
for (const t of targets) {
  /* `resolve`, never `join`. `join(cwd, "Z:/app")` returns "C:/x/Z:/app", which
     does not exist, and the script dies with "no such path" on a target that
     does. That is how an audit returned zero on 62 routes it never opened:
     every agent calling the lint from outside passes an absolute path.
     `resolve` treats absolute as absolute and relative as relative, which is
     the contract any caller expects. */
  const abs = resolve(cwd, t);
  let s;
  try {
    s = await stat(abs);
  } catch {
    console.error(`motion-lint: no such path: ${t}`);
    console.error(`  (resolved to ${abs})`);
    process.exit(2);
  }
  const base = displayBase(abs, s.isDirectory());
  if (s.isDirectory()) {
    for await (const f of walk(abs, ignores)) findings.push(...(await lintFile(f, base)));
  } else {
    findings.push(...(await lintFile(abs, base)));
  }
}

const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
findings.sort(
  (a, b) => order[a.severity] - order[b.severity] || a.file.localeCompare(b.file) || a.line - b.line,
);

const counts = findings.reduce((acc, f) => ({ ...acc, [f.severity]: (acc[f.severity] ?? 0) + 1 }), {});

if (json) {
  console.log(JSON.stringify({ counts, findings }, null, 2));
} else if (!findings.length) {
  console.log("motion-lint: clean — no feel-breaking patterns found.");
} else {
  let lastRule = "";
  for (const f of findings) {
    if (f.rule !== lastRule) {
      console.log(`\n${f.severity}  ${f.rule}\n  ${f.message}\n  fix: ${f.fix}`);
      lastRule = f.rule;
    }
    console.log(`    ${f.file}:${f.line}:${f.col}  ${f.snippet}`);
  }
  console.log(
    `\n${findings.length} finding(s): ${counts.HIGH ?? 0} HIGH, ${counts.MEDIUM ?? 0} MEDIUM.`,
  );
  console.log("Suppress a legitimate one with: // motion-lint-disable-next-line <rule-id>  <reason>");
  console.log("Mechanical fixes: motion-lint --fix (duration tokens, transition-all).");
}

/* Footer always, including on zero, especially on zero.
   A zero from here was once read as "full pass" and the round skipped the
   whole surface classification. A script ends in an exit code, and an exit
   code feels like being done. This linter sees regex; it does not see an open
   screen. */
if (!json) {
  console.log(
    "\nThis is ONE detector, not the audit. It does not see the open screen:\n" +
      "a stuck AnimatePresence slips past it and past every other one.\n" +
      "The real gate: killer-scan --report AUDIT.md <target>",
  );
}

const failing = (counts.HIGH ?? 0) + (strict ? (counts.MEDIUM ?? 0) : 0);
process.exit(failing > 0 ? 1 : 0);
