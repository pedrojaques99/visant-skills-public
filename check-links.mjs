#!/usr/bin/env node
/**
 * check-links: every relative link in every .md of this repo must resolve.
 *
 * Skills point at their references by relative path, and a renamed reference
 * breaks the link silently: the agent follows it, finds nothing, and goes on
 * without the rule. Code fences are ignored (they hold example paths).
 *
 *   node check-links.mjs        # exit 1 and list the broken links
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SKIP = new Set(["node_modules", ".git"]);

const walk = (d) =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    SKIP.has(e.name) ? [] : e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith(".md") ? [join(d, e.name)] : [],
  );

let total = 0;
const broken = [];
for (const file of walk(ROOT)) {
  const text = readFileSync(file, "utf8").replace(/```[\s\S]*?```/g, "");
  for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (/^(https?:|mailto:|#)/.test(m[1])) continue;
    const target = decodeURI(m[1].split("#")[0]);
    if (!target) continue;
    total++;
    if (!existsSync(resolve(dirname(file), target))) broken.push(`${file.slice(ROOT.length + 1)} -> ${m[1]}`);
  }
}

if (broken.length) {
  console.error(`✗ ${broken.length} broken relative link(s):\n  ${broken.join("\n  ")}`);
  process.exit(1);
}
console.log(`✓ check-links: ${total} relative links, all resolve`);
