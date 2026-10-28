#!/usr/bin/env node
/**
 * scripts-smoke — prova que os detectores funcionam CHAMADOS DE FORA.
 *
 * Existe por um zero que mentiu. O `motion-lint` fazia `join(cwd, alvo)`, então
 * `join("C:/x", "Z:/app")` virava `"C:/x/Z:/app"` e o script morria com
 * "no such path"; o `refine-scan` guardava `relative(cwd, alvo)` e explodia com
 * `ENOENT: C:\Users\...\D:\dev\...` entre drives; o `killer-scan` sobrevivia
 * mas comparava caminho relativo com absoluto no filtro do lint de token, e
 * devolvia zero achado num repo cheio deles.
 *
 * Os três tinham --self-test verde. Nenhum dos três testava a única coisa que
 * todo chamador faz: passar caminho absoluto, de outro diretório. O self-test
 * roda de dentro da pasta da skill, que é justamente o caso que nunca quebra.
 *
 * Este smoke roda de um cwd ESTRANGEIRO e com alvo ABSOLUTO, que é o contrato
 * real. Se ele ficar verde por acidente de novo, é aqui que a fixture entra.
 *
 *   node scripts-smoke.mjs
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// --root=<pasta>: roda os casos contra outro repo de skills; detector ausente lá é pulado.
const rootArg = process.argv.slice(2).find((a) => a.startsWith("--root="))?.slice(7);
const REPO = rootArg ? resolve(rootArg) : dirname(fileURLToPath(import.meta.url));

/* Um alvo fora do repo, com um defeito plantado que cada detector reconhece. */
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

/* O brand-vault-lint não olha código, olha um vault — mas o contrato é o mesmo:
   caminho absoluto, cwd estrangeiro. Defeito plantado: logo hospedado fora do
   R2, que é o link que expira e mata a marca do cliente calado. */
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

/* O leva-plan lê uma lista de demandas e uma pasta de finais. Defeito plantado:
   uma peça já entregue em `@finais` — se ela aparecer como pendente, o script
   não abriu a pasta e a skill criaria issue de coisa pronta. */
const finaisDir = join(sandbox, "@finais");
mkdirSync(join(finaisDir, "Envelope A3"), { recursive: true });
const levaFile = join(sandbox, "demandas.json");
writeFileSync(levaFile, JSON.stringify(["Envelope A3", "Placa de Obra"]), "utf8");

/* cwd estrangeiro: nem o repo das skills, nem o alvo. É o que um agente faz. */
const foreignCwd = tmpdir();

const CASES = [
  {
    name: "motion-lint",
    script: join(REPO, "visant-motion", "scripts", "motion-lint.mjs"),
    target: appDir,
    /* Espera ACHAR: o alvo tem transition-all + ease-in + progresso falso.
       Zero aqui significa que o script não abriu o arquivo. */
    expect: (out, code) => (code === 1 || /finding/i.test(out) ? null : "não achou nada num alvo com defeito plantado"),
  },
  {
    name: "refine-scan",
    script: join(REPO, "visant-refine", "scripts", "refine-scan.mjs"),
    target: appDir,
    expect: (out) => (/\d+ arquivo\(s\)/.test(out) && !/zero achado em 0 arquivo/.test(out) ? null : "não leu nenhum arquivo do alvo"),
  },
  {
    name: "killer-scan",
    script: join(REPO, "visant-killer", "scripts", "killer-scan.mjs"),
    target: appDir,
    expect: (out) => (/arquivos no alvo: [1-9]/.test(out) ? null : "não expandiu o alvo em arquivo nenhum"),
  },
  {
    name: "brand-vault-lint",
    script: join(REPO, "visant-brand-sync", "scripts", "brand-vault-lint.mjs"),
    target: vaultFile,
    /* Espera ACHAR o logo efêmero. Zero aqui significa que não leu o arquivo. */
    expect: (out, code) =>
      code === 1 && /logo-url-efemera/.test(out) ? null : "não achou o logo efêmero num vault com defeito plantado",
  },
  {
    name: "leva-plan",
    script: join(REPO, "visant-team-director", "scripts", "leva-plan.mjs"),
    target: levaFile,
    args: ["--finais", finaisDir, "--time", "a,b", "--inicio", "2026-09-14"],
    /* Espera 1 feita (envelope, pela pasta) e 1 pendente (placa). */
    expect: (out) => (/1 feita\(s\), 1 pendente\(s\)/.test(out) ? null : "não casou a peça entregue com a pasta de finais"),
  },
];

/*
 * OS SELF-TESTS RODAM AQUI TAMBÉM, e não só quando alguém lembra.
 *
 * O `ruido-scan` e o `corta-scan` travam as regras deles em fixture (nove
 * regras e três geometrias). Fixture que ninguém roda é documentação: quem
 * afrouxa um limiar não descobre que zerou a regra, e regra zerada passa por
 * tela limpa — o pior modo de falha de um portão.
 *
 * O do `corta-scan` pede playwright e sai 0 dizendo "NÃO TESTADO" onde não
 * houver: "não consegui rodar" não é reprovação, e também não é aprovação.
 */
const SELF_TESTS = [
  { name: "ruido-scan", script: join(REPO, "visant-killer", "scripts", "ruido-scan.mjs"), args: ["--self-test"] },
  { name: "corta-scan", script: join(REPO, "visant-killer", "scripts", "corta-self-test.mjs"), args: [] },
];

let failed = 0;
for (const t of SELF_TESTS) {
  if (!existsSync(t.script)) continue;
  const r = spawnSync(process.execPath, [t.script, ...t.args], { cwd: foreignCwd, encoding: "utf8", timeout: 180_000 });
  const out = `${r.stdout || ""}${r.stderr || ""}`;
  if (r.status === 0) {
    const naoTestou = /NÃO TESTADO/.test(out);
    console.log(`  ${naoTestou ? "–" : "✓"} ${t.name.padEnd(12)} ${naoTestou ? "self-test não rodou (sem playwright neste cwd)" : "self-test bate com o fixture"}`);
  } else {
    failed++;
    const falhas = out.split(String.fromCharCode(10)).filter((l) => /FALHA/.test(l)).join(String.fromCharCode(10));
    console.error(`  ✗ ${t.name.padEnd(12)} self-test fora do esperado:`);
    console.error(falhas || out.trim());
  }
}

for (const c of CASES) {
  // O espelho público (export-public.mjs) não leva toda skill: detector ausente é pulado, não reprovado.
  if (!existsSync(c.script)) {
    console.log(`  – ${c.name.padEnd(12)} skill fora deste repo, pulado`);
    continue;
  }
  const r = spawnSync(process.execPath, [c.script, c.target, ...(c.args ?? [])], {
    cwd: foreignCwd,
    encoding: "utf8",
    timeout: 120_000,
  });
  const out = `${r.stdout || ""}${r.stderr || ""}`;

  const crashed = /Error:|ENOENT|no such path|alvo não existe/i.test(out);
  const problem = crashed ? out.split("\n").find((l) => /Error:|ENOENT|no such path|alvo não existe/i.test(l))?.trim() : c.expect(out, r.status);

  if (problem) {
    failed++;
    console.error(`  ✗ ${c.name.padEnd(12)} ${problem}`);
  } else {
    console.log(`  ✓ ${c.name.padEnd(12)} aceita caminho absoluto de outro cwd`);
  }
}

console.log("-".repeat(64));
if (failed) {
  console.error(`scripts-smoke FALHOU: ${failed}/${CASES.length} detector(es) não funcionam chamados de fora.`);
  console.error("Um detector que só funciona no cwd certo devolve zero por não ter olhado.");
  process.exit(1);
}
console.log(`scripts-smoke ok — ${CASES.length}/${CASES.length} detectores de fora, mais ${SELF_TESTS.length} self-test(s) contra fixture.`);
