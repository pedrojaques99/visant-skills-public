#!/usr/bin/env node
/**
 * link — aponta `~/.claude/skills/<skill>` para este repo com junction, para
 * existir UMA cópia só.
 *
 * `sync.mjs` administra a divergência; isto elimina. Depois de linkar, editar a
 * skill enquanto trabalha já é editar o repo — some a chance de a pasta que roda
 * e a pasta versionada contarem histórias diferentes (que é o que aconteceu com
 * a visant-copy).
 *
 *   node link.mjs           # dry-run: o que viraria junction
 *   node link.mjs --apply   # substitui as pastas por junctions
 *   node link.mjs --undo    # desfaz: volta a ser pasta real, com o conteúdo do repo
 *   node link.mjs --root=../visant-skills --apply   # linka outro repo de skills
 *
 * Link que aponta pra OUTRO lugar (skill que mudou de repo) é reapontado.
 *
 * Só roda com o repo limpo no git: a pasta em ~/.claude é APAGADA e recriada
 * como link, então o conteúdo precisa estar commitado antes. Junction, não
 * symlink: não exige privilégio de administrador no Windows.
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
  console.error("link: escrito para Windows (junction). No macOS/Linux use `ln -s`.");
  process.exit(2);
}

// Guarda-corpo: nada é apagado enquanto houver trabalho não commitado.
if (apply || undo) {
  const { stdout } = await run("git", ["-C", REPO, "status", "--porcelain"]);
  if (stdout.trim()) {
    console.error("link: há mudança não commitada no repo. Commite antes — este comando apaga pastas.");
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
  // readlink de junction volta como `\\?\Z:\...`; tira o prefixo antes de comparar.
  const norm = (p) => resolve(p.replace(/^\\\\\?\\/, "")).toLowerCase();
  const stale = isLink && norm(await readlink(live)) !== norm(target);

  if (!apply && !undo) {
    const state = !info ? "ausente" : stale ? "link velho" : isLink ? "já é link" : "pasta real";
    console.log(`  ${state.padEnd(11)} ${name}`);
    if (stale) old++; else if (isLink) linked++; else if (info) real++; else missing++;
    continue;
  }

  if (undo) {
    if (!isLink) continue;
    await rm(live, { recursive: true, force: true }); // remove só o link
    await cp(target, live, { recursive: true });
    console.log(`  desfeito   ${name}`);
    linked++;
    continue;
  }

  if (isLink && !stale) continue;
  if (isLink) await rm(live, { force: true }); // só o link; o alvo antigo fica intacto
  else if (info) await rm(live, { recursive: true, force: true });
  await run("cmd", ["/c", "mklink", "/J", live, target]);
  console.log(`  linkado    ${name}`);
  linked++;
}

if (!apply && !undo) {
  console.log(`\n${real} pasta(s) real(is), ${old} link(s) velho(s), ${linked} já linkada(s), ${missing} ausente(s).`);
  if (real || old) console.log("Rode --apply para virar junction (o conteúdo do repo passa a ser o único).");
} else {
  console.log(`\nlink: ${linked} skill(s) ${undo ? "desfeitas" : "linkadas"}.`);
}
