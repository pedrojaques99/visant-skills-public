#!/usr/bin/env node
/**
 * scripts-smoke: proves the detectors work when CALLED FROM OUTSIDE.
 *
 * It exists because of a zero that lied. `motion-lint` did `join(cwd, target)`,
 * so `join("C:/x", "Z:/app")` became `"C:/x/Z:/app"` and the script died with
 * "no such path"; `refine-scan` stored `relative(cwd, target)` and blew up with
 * `ENOENT: C:\Users\...\D:\dev\...` across drives; `killer-scan` survived
 * but compared a relative path with an absolute one in the token lint filter,
 * and returned zero findings in a repo full of them.
 *
 * All three had a green --self-test. None of them tested the one thing every
 * caller does: pass an absolute path from another directory. The self-test
 * runs from inside the skill folder, which is exactly the case that never breaks.
 *
 * This smoke runs from a FOREIGN cwd with an ABSOLUTE target, which is the real
 * contract. If it goes green by accident again, this is where the fixture goes.
 *
 * Matchers accept both the Portuguese and the English output of each detector,
 * so the smoke keeps passing while those scripts are translated.
 *
 *   node scripts-smoke.mjs
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// --root=<folder>: runs the cases against another skills repo; a detector missing there is skipped.
const rootArg = process.argv.slice(2).find((a) => a.startsWith("--root="))?.slice(7);
const REPO = rootArg ? resolve(rootArg) : dirname(fileURLToPath(import.meta.url));

/* A target outside the repo, with a planted defect every detector recognizes. */
const sandbox = mkdtempSync(join(tmpdir(), "visant-smoke-"));
const appDir = join(sandbox, "app");
mkdirSync(appDir, { recursive: true });
writeFileSync(
  join(appDir, "Bad.tsx"),
  `export function Bad({ pct }: { pct: number }) {
  return (
    <div className="transition-all" style={{ transition: "all 600ms ease-in" }}>
      <span style={{ color: "#ff0000" }}>Carregando o seu painel — quase lá</span>
      <div style={{ width: \`\${Math.min(pct, 90)}%\` }} />
    </div>
  );
}
`,
  "utf8",
);

/* brand-vault-lint does not look at code, it looks at a vault, but the
   contract is the same: absolute path, foreign cwd. Planted defect: a logo
   hosted outside R2, the link that expires and silently kills the client's brand. */
const vaultFile = join(sandbox, "vault.json");
writeFileSync(
  vaultFile,
  JSON.stringify({
    guideline: {
      id: "fixture",
      identity: { name: "Marca de Fixture" },
      colors: [
        { hex: "#FFFFFF", name: "Fundo", role: "background" },
        { hex: "#101010", name: "Tinta", role: "primary" },
      ],
      typography: [
        { family: "Inter", role: "display", size: 96 },
        { family: "Inter", role: "body", size: 16 },
      ],
      logos: [{ id: "a", variant: "primary", url: "https://www.figma.com/api/mcp/asset/x.svg" }],
    },
  }),
  "utf8",
);

/* leva-plan reads a list of requests and a finals folder. Planted defect: a
   piece already delivered in `@finais`; if it shows up as pending, the script
   did not open the folder and the skill would create an issue for finished work. */
const finaisDir = join(sandbox, "@finais");
mkdirSync(join(finaisDir, "Envelope A3"), { recursive: true });
const levaFile = join(sandbox, "demandas.json");
writeFileSync(levaFile, JSON.stringify(["Envelope A3", "Placa de Obra"]), "utf8");

/* Foreign cwd: neither the skills repo nor the target. That is what an agent does. */
const foreignCwd = tmpdir();

const CASES = [
  {
    name: "motion-lint",
    script: join(REPO, "visant-motion", "scripts", "motion-lint.mjs"),
    target: appDir,
    /* Expects to FIND: the target has transition-all + ease-in + fake progress.
       Zero here means the script did not open the file. */
    expect: (out, code) => (code === 1 || /finding|achado/i.test(out) ? null : "found nothing in a target with a planted defect"),
  },
  {
    name: "refine-scan",
    script: join(REPO, "visant-refine", "scripts", "refine-scan.mjs"),
    target: appDir,
    expect: (out) =>
      /\d+ (arquivo\(s\)|files?\b|file\(s\))/i.test(out) && !/zero (achado|findings?) (em|in|across) 0 (arquivo|file)/i.test(out)
        ? null
        : "did not read any file from the target",
  },
  {
    name: "killer-scan",
    script: join(REPO, "visant-killer", "scripts", "killer-scan.mjs"),
    target: appDir,
    expect: (out) =>
      /(arquivos no alvo|files in (the )?target|target files): [1-9]/i.test(out) ? null : "did not expand the target into any file",
  },
  {
    name: "brand-vault-lint",
    script: join(REPO, "visant-brand-sync", "scripts", "brand-vault-lint.mjs"),
    target: vaultFile,
    /* Expects to FIND the ephemeral logo. Zero here means it did not read the file. */
    expect: (out, code) =>
      code === 1 && /logo-url-efemera/.test(out) ? null : "did not find the ephemeral logo in a vault with a planted defect",
  },
  {
    name: "leva-plan",
    script: join(REPO, "visant-team-director", "scripts", "leva-plan.mjs"),
    target: levaFile,
    args: ["--finais", finaisDir, "--time", "a,b", "--inicio", "2026-09-14"],
    /* Expects 1 done (envelope, by folder) and 1 pending (placa). */
    expect: (out) =>
      /1 (feita\(s\)|done), 1 (pendente\(s\)|pending)/i.test(out) ? null : "did not match the delivered piece to the finals folder",
  },
];

/*
 * THE SELF-TESTS RUN HERE TOO, not only when someone remembers.
 *
 * `ruido-scan` and `corta-scan` lock their rules in fixtures (nine rules and
 * three geometries). A fixture nobody runs is documentation: whoever loosens a
 * threshold never learns they zeroed the rule, and a zeroed rule passes as a
 * clean screen, the worst failure mode of a gate.
 *
 * The `corta-scan` one needs playwright and exits 0 saying "NOT TESTED" (or
 * "NÃO TESTADO") where it is missing: "could not run" is not a fail, and it is
 * not a pass either.
 */
const SELF_TESTS = [
  { name: "noise-scan", script: join(REPO, "visant-killer", "scripts", "noise-scan.mjs"), args: ["--self-test"] },
  { name: "corta-scan", script: join(REPO, "visant-killer", "scripts", "corta-self-test.mjs"), args: [] },
];

let failed = 0;
for (const t of SELF_TESTS) {
  if (!existsSync(t.script)) continue;
  const r = spawnSync(process.execPath, [t.script, ...t.args], { cwd: foreignCwd, encoding: "utf8", timeout: 180_000 });
  const out = `${r.stdout || ""}${r.stderr || ""}`;
  if (r.status === 0) {
    const notTested = /NÃO TESTADO|NOT TESTED/i.test(out);
    console.log(`  ${notTested ? "–" : "✓"} ${t.name.padEnd(12)} ${notTested ? "self-test did not run (no playwright in this cwd)" : "self-test matches the fixture"}`);
  } else {
    failed++;
    const failures = out.split(String.fromCharCode(10)).filter((l) => /FALHA|FAIL/.test(l)).join(String.fromCharCode(10));
    console.error(`  ✗ ${t.name.padEnd(12)} self-test off contract:`);
    console.error(failures || out.trim());
  }
}

for (const c of CASES) {
  // The public mirror (export-public.mjs) does not carry every skill: a missing detector is skipped, not failed.
  if (!existsSync(c.script)) {
    console.log(`  – ${c.name.padEnd(12)} skill not in this repo, skipped`);
    continue;
  }
  const r = spawnSync(process.execPath, [c.script, c.target, ...(c.args ?? [])], {
    cwd: foreignCwd,
    encoding: "utf8",
    timeout: 120_000,
  });
  const out = `${r.stdout || ""}${r.stderr || ""}`;

  const CRASH = /Error:|ENOENT|no such path|alvo não existe|target does not exist|target not found/i;
  const crashed = CRASH.test(out);
  const problem = crashed ? out.split("\n").find((l) => CRASH.test(l))?.trim() : c.expect(out, r.status);

  if (problem) {
    failed++;
    console.error(`  ✗ ${c.name.padEnd(12)} ${problem}`);
  } else {
    console.log(`  ✓ ${c.name.padEnd(12)} accepts an absolute path from another cwd`);
  }
}

console.log("-".repeat(64));
if (failed) {
  console.error(`scripts-smoke FAILED: ${failed}/${CASES.length} detector(s) do not work when called from outside.`);
  console.error("A detector that only works from the right cwd returns zero because it never looked.");
  process.exit(1);
}
console.log(`scripts-smoke ok: ${CASES.length}/${CASES.length} detectors from outside, plus ${SELF_TESTS.length} self-test(s) against fixtures.`);
