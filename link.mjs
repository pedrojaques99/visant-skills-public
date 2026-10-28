#!/usr/bin/env node
/**
 * link: points `~/.claude/skills/<skill>` at this repo with a junction, so
 * there is ONLY ONE copy.
 *
 * `sync.mjs` manages the drift; this removes it. Once linked, editing the skill
 * while you work is editing the repo, so the folder that runs and the versioned
 * folder can no longer tell different stories (which is what happened with
 * visant-copy).
 *
 *   node link.mjs           # dry run: what would become a junction
 *   node link.mjs --apply   # replaces the folders with junctions
 *   node link.mjs --undo    # undo: back to a real folder, with the repo's content
 *   node link.mjs --root=../visant-skills --apply   # links another skills repo
 *
 * A link pointing somewhere ELSE (a skill that moved repos) is repointed.
 *
 * Only runs with a clean git repo: the folder in ~/.claude is DELETED and
 * recreated as a link, so the content must be committed first. Junction, not
 * symlink: it needs no administrator privilege on Windows.
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, lstat, readdir, readlink, rm } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const rootArg = process.argv.slice(2).find((a) => a.startsWith("--root="))?.slice(7);
const REPO = rootArg ? resolve(rootArg) : dirname(fileURLToPath(import.meta.url));
const LIVE = join(homedir(), ".claude", "skills");

const apply = process.argv.includes("--apply");
const undo = process.argv.includes("--undo");

if (platform() !== "win32") {
  console.error("link: written for Windows (junction). On macOS/Linux use `ln -s`.");
  process.exit(2);
}

// Guardrail: nothing is deleted while there is uncommitted work.
if (apply || undo) {
  const { stdout } = await run("git", ["-C", REPO, "status", "--porcelain"]);
  if (stdout.trim()) {
    console.error("link: the repo has uncommitted changes. Commit first; this command deletes folders.");
    console.error(stdout.trim().split("\n").slice(0, 10).join("\n"));
    process.exit(1);
  }
}

const skills = (await readdir(REPO, { withFileTypes: true }))
  .filter((e) => e.isDirectory() && !e.name.startsWith(".") && !e.name.startsWith("_"))
  .filter((e) => existsSync(join(REPO, e.name, "SKILL.md")))
  .map((e) => e.name)
  .sort();

let linked = 0, real = 0, missing = 0, old = 0;

for (const name of skills) {
  const live = join(LIVE, name);
  const target = join(REPO, name);
  const info = await lstat(live).catch(() => null);
  const isLink = info?.isSymbolicLink() === true;
  // readlink on a junction returns `\\?\Z:\...`; strip the prefix before comparing.
  const norm = (p) => resolve(p.replace(/^\\\\\?\\/, "")).toLowerCase();
  const stale = isLink && norm(await readlink(live)) !== norm(target);

  if (!apply && !undo) {
    const state = !info ? "missing" : stale ? "stale link" : isLink ? "linked" : "real folder";
    console.log(`  ${state.padEnd(11)} ${name}`);
    if (stale) old++; else if (isLink) linked++; else if (info) real++; else missing++;
    continue;
  }

  if (undo) {
    if (!isLink) continue;
    await rm(live, { recursive: true, force: true }); // removes only the link
    await cp(target, live, { recursive: true });
    console.log(`  undone     ${name}`);
    linked++;
    continue;
  }

  if (isLink && !stale) continue;
  if (isLink) await rm(live, { force: true }); // only the link; the old target stays intact
  else if (info) await rm(live, { recursive: true, force: true });
  await run("cmd", ["/c", "mklink", "/J", live, target]);
  console.log(`  linked     ${name}`);
  linked++;
}

if (!apply && !undo) {
  console.log(`\n${real} real folder(s), ${old} stale link(s), ${linked} already linked, ${missing} missing.`);
  if (real || old) console.log("Run --apply to turn them into junctions (the repo content becomes the only copy).");
} else {
  console.log(`\nlink: ${linked} skill(s) ${undo ? "undone" : "linked"}.`);
}
