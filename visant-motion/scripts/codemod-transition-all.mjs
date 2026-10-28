// Codemod — downgrade `transition-all` to explicit, compositor-friendly
// property lists (motion SSoT cleanup). Emil Kowalski: never `transition: all`.
//
// SAFETY (this is the whole point — a wrong downgrade snaps a live tween):
//   1. SKIP any line whose element animates a TRANSFORM in an interactive state
//      (translate/scale/rotate/skew under hover:/group-hover:/focus:/active:/
//      data-[]/peer-/aria-) — downgrading there would kill the transform tween.
//      Those cases were already fixed by hand in the motion audit.
//   2. SKIP dimension/spacing changes in interactive states (w-/h-/size-) for the
//      same reason (avoid surprising layout snaps).
//   3. Otherwise pick the MINIMAL correct target:
//        - base:            transition-colors            (color/bg/border only)
//        - + box-shadow:    when a state animates `shadow`
//        - + opacity:       when a state animates `opacity`
//      => `transition-[color,background-color,border-color,box-shadow,opacity]`
//         (or the shorter `transition-colors` when neither shadow nor opacity).
//
// Usage:  node scripts/codemod-transition-all.mjs           (dry-run, prints plan)
//         node scripts/codemod-transition-all.mjs --apply   (writes changes)
//
// Scope: components/** and app/** .tsx/.ts/.jsx/.js. Skips components/ui/** by
// default (shared primitives were hand-tuned; pass --include-ui to override).

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, sep, extname } from "node:path";

const APPLY = process.argv.includes("--apply");
const INCLUDE_UI = process.argv.includes("--include-ui");
const ROOTS = ["components", "app"];
const EXTS = new Set([".tsx", ".ts", ".jsx", ".js"]);

// A state prefix that makes a utility "interactive" (i.e. it animates).
const STATE = String.raw`(?:hover|group-hover|focus|focus-within|focus-visible|active|peer|peer-[a-z-]+|aria-[a-z]+|group-data-\[[^\]]*\]|data-\[[^\]]*\])`;

// Transform / dimension changes in an interactive state → do NOT downgrade.
const TRANSFORM_GUARD = new RegExp(
  `${STATE}:-?(?:translate|scale|rotate|skew)\\b|${STATE}:(?:w|h|size|min-w|max-w|min-h|max-h)-`
);
// Does any interactive state animate shadow / opacity? → include those props.
const SHADOW_STATE = new RegExp(`${STATE}:[^\\s"'\`]*shadow`);
const OPACITY_STATE = new RegExp(`${STATE}:[^\\s"'\`]*opacity`);
// A transform that lives on a motion element via `transition-transform` etc. — if
// the line pairs transition-all WITH transition-transform it's already scoped; skip.
const HAS_TRANSITION_TRANSFORM = /transition-transform|transition-\[[^\]]*transform/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(p, out);
    } else if (EXTS.has(extname(name))) {
      out.push(p);
    }
  }
  return out;
}

function isUi(file) {
  return file.replace(/\\/g, "/").includes("components/ui/");
}

let filesChanged = 0;
let totalReplacements = 0;
const skips = [];
const changes = [];

for (const root of ROOTS) {
  let files;
  try {
    files = walk(root);
  } catch {
    continue;
  }
  for (const file of files) {
    if (!INCLUDE_UI && isUi(file)) continue;
    const src = readFileSync(file, "utf8");
    const lines = src.split("\n");
    let changedInFile = 0;

    const nextLines = lines.map((line, i) => {
      // Only touch the standalone `transition-all` utility (word-bounded).
      if (!/\btransition-all(?![-\w])/.test(line)) return line;

      if (TRANSFORM_GUARD.test(line) || HAS_TRANSITION_TRANSFORM.test(line)) {
        skips.push(`${file}:${i + 1}  (transform/dimension animated — left as-is)`);
        return line;
      }

      const props = ["color", "background-color", "border-color"];
      if (SHADOW_STATE.test(line)) props.push("box-shadow");
      if (OPACITY_STATE.test(line)) props.push("opacity");

      const replacement =
        props.length === 3 ? "transition-colors" : `transition-[${props.join(",")}]`;

      changedInFile++;
      totalReplacements++;
      changes.push(`${file}:${i + 1}  transition-all → ${replacement}`);
      return line.replace(/\btransition-all(?![-\w])/g, replacement);
    });

    if (changedInFile > 0) {
      filesChanged++;
      if (APPLY) writeFileSync(file, nextLines.join("\n"), "utf8");
    }
  }
}

console.log(changes.join("\n"));
console.log("\n" + "─".repeat(60));
console.log(`${APPLY ? "APPLIED" : "DRY-RUN"} — ${totalReplacements} replacements in ${filesChanged} files.`);
console.log(`Skipped (transform/dimension in an interactive state): ${skips.length}`);
if (skips.length) console.log(skips.map((s) => "  • " + s).join("\n"));
if (!APPLY) console.log("\nRe-run with --apply to write changes.");
