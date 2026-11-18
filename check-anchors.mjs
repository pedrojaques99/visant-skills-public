// check-anchors: every relative markdown link with a #fragment points at a heading that exists in its target (GitHub
// slugs). check-links covers missing files, this covers moved or renamed sections. Usage: node check-anchors.mjs [root]
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";

const root = resolve(process.argv[2] ?? ".");
const files = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    if (n === "node_modules" || n.startsWith(".")) continue;
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (n.endsWith(".md")) files.push(p);
  }
})(root);

const slug = (h) =>
  h.trim().toLowerCase().replace(/<[^>]+>/g, "").replace(/[`*_~]/g, "").replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s/g, "-");
const anchorsOf = new Map();
function anchors(file) {
  if (!anchorsOf.has(file)) {
    const seen = new Map();
    const out = new Set();
    let fence = false;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      if (/^\s*```/.test(line)) fence = !fence;
      const m = !fence && line.match(/^#{1,6}\s+(.*?)\s*#*\s*$/);
      if (!m) continue;
      const base = slug(m[1]);
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      out.add(n ? `${base}-${n}` : base);
    }
    for (const m of readFileSync(file, "utf8").matchAll(/<a\s+(?:name|id)="([^"]+)"/g)) out.add(m[1]);
    anchorsOf.set(file, out);
  }
  return anchorsOf.get(file);
}

let bad = 0;
for (const f of files) {
  const text = readFileSync(f, "utf8");
  for (const m of text.matchAll(/\]\(([^)\s]*?)#([^)\s]+)\)/g)) {
    const [, target, frag] = m;
    if (/^[a-z]+:/i.test(target)) continue; // http(s), mailto
    const file = target ? resolve(dirname(f), target) : f;
    if (!existsSync(file) || !file.endsWith(".md")) continue; // check-links covers missing files
    if (!anchors(file).has(decodeURIComponent(frag).toLowerCase())) {
      bad++;
      console.log(`${relative(root, f)} -> ${target || "(self)"}#${frag}`);
    }
  }
}
console.log(bad ? `✗ ${bad} broken anchor(s)` : "✓ every #anchor resolves");
process.exit(bad ? 1 : 0);
