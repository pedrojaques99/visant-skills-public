#!/usr/bin/env node
/**
 * Codemod — troca duração inline por token do SSoT (`DUR.*`).
 *
 * Existe por uma conta: numa auditoria de 55 achados do motion-lint, 48 eram
 * `duration: 0.6` querendo virar `DUR.slow`. Puramente mecânico, e mesmo assim
 * consumiu a maior parte da sessão à mão. O `transition-all` já tinha codemod;
 * a duração, que é o achado mais comum de todos, não tinha.
 *
 *   node scripts/codemod-duration.mjs                 # dry-run, imprime o plano
 *   node scripts/codemod-duration.mjs --apply         # aplica exato + próximo
 *   node scripts/codemod-duration.mjs --apply --over  # inclui > 300ms
 *   node scripts/codemod-duration.mjs <pasta> ...     # alvo explícito
 *   node scripts/codemod-duration.mjs --self-test
 *
 * TRÊS BALDES, e a diferença entre eles é a razão de isto não ser um sed:
 *
 *   EXATO    o número já é o valor de um token (0.2 -> DUR.base). Renomear,
 *            risco zero. Entra no --apply.
 *   PRÓXIMO  cai dentro da tolerância de um token e respeita o teto de 300ms
 *            (0.25 -> DUR.base). Mexe pouco no tempo. Entra no --apply.
 *   ACIMA    passa de 300ms, que é o defeito que a regra slow-ui-duration
 *            aponta (0.6 -> DUR.slow). Isso CORTA a duração pela metade — é
 *            mudança de comportamento, não refatoração. Só com --over, porque
 *            transição de rota e peça de marketing são exceções legítimas e
 *            quem decide é quem olha a tela.
 *
 * O codemod nunca inventa import: se o arquivo passa a usar `DUR` sem ter o
 * import, ele acrescenta usando o caminho que o próprio repo já usa.
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

/** Espelho do SSoT (assets/motion-ssot-starter/motion.ts). Segundos. */
const DUR = { press: 0.12, fast: 0.16, base: 0.2, slow: 0.3 };
const MAX_UI = 0.3;
/* Tolerância RELATIVA, não absoluta. Com tolerância fixa de 60ms, 0.08 casava
   com press (0.12) — mas 80ms e 120ms são 50% de diferença, e a percepção de
   duração é logarítmica: o que importa é a razão, não a diferença. 25% é o
   ponto onde ainda se lê como "o autor quis este token". */
const REL_TOL = 0.25;

/* -------------------------------------------------------------------------- */
/* Classificação                                                              */
/* -------------------------------------------------------------------------- */

/** @returns {{token: string, bucket: 'EXATO'|'PRÓXIMO'|'ACIMA'} | null} */
export function classify(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;

  for (const [name, v] of Object.entries(DUR)) {
    if (Math.abs(seconds - v) < 1e-9) return { token: name, bucket: "EXATO" };
  }

  if (seconds > MAX_UI) return { token: "slow", bucket: "ACIMA" };

  /* Empate arredonda pra BAIXO. DUR está em ordem crescente e o `<` estrito
     deixa o primeiro ganhar, então 0.18 vira fast e 0.25 vira base. Não é
     detalhe: a tese inteira desta skill é que UI abaixo de ~300ms responde e
     acima disso parece travada. Quando o desempate é arbitrário, ele cai pro
     lado que a skill defende. */
  let best = null;
  for (const [name, v] of Object.entries(DUR)) {
    const d = Math.abs(seconds - v);
    if (d <= v * REL_TOL && (!best || d < best.d)) best = { token: name, d };
  }
  /* Abaixo de 300ms mas longe de qualquer token: não adivinha. Um 0.08 pode ser
     escolha deliberada de press mais seco, e trocar por DUR.press sem avisar
     esconde a decisão em vez de registrar. Vira NÃO-MAPEADO no relatório. */
  return best ? { token: best.token, bucket: "PRÓXIMO" } : null;
}

/* -------------------------------------------------------------------------- */
/* Import do SSoT                                                             */
/* -------------------------------------------------------------------------- */

const IMPORT_DUR = /import\s*\{[^}]*\bDUR\b[^}]*\}\s*from\s*["']([^"']+)["']/;

/** Descobre o caminho que ESTE repo usa pra importar o SSoT. */
function detectSsotPath(files) {
  const count = new Map();
  for (const f of files) {
    const m = readFileSync(f, "utf8").match(IMPORT_DUR);
    if (m) count.set(m[1], (count.get(m[1]) ?? 0) + 1);
  }
  if (!count.size) return null;
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/** Acrescenta o import depois do último import do arquivo. */
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
/* Varredura                                                                  */
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
/* O SSoT é o único lugar onde o número literal é a definição, não a cópia. */
const isSsot = (f) => /(^|[\\/])(lib[\\/])?motion\.tsx?$/.test(f);

/** `duration: 0.6` em objeto de transition do framer. */
const DURATION_LITERAL = /(\bduration:\s*)(\d*\.?\d+)(\s*[,}\n])/g;

function processFile(file, ssotPath) {
  const src = readFileSync(file, "utf8");
  if (/motion-lint-disable-file/.test(src)) return null;

  const lines = src.split("\n");
  const hits = [];

  const next = lines.map((line, i) => {
    if (/motion-lint-disable-next-line/.test(lines[i - 1] ?? "")) return line;
    // Comentário não é código.
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return line;

    return line.replace(DURATION_LITERAL, (whole, head, num, tail) => {
      const c = classify(parseFloat(num));
      if (!c) {
        hits.push({ line: i + 1, from: num, bucket: "NÃO-MAPEADO", token: null });
        return whole;
      }
      const willWrite = c.bucket !== "ACIMA" || OVER;
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
    // [segundos, token esperado, balde esperado]
    [0.12, "press", "EXATO"],
    [0.16, "fast", "EXATO"],
    [0.2, "base", "EXATO"],
    [0.3, "slow", "EXATO"],
    [0.25, "base", "PRÓXIMO"],
    [0.18, "fast", "PRÓXIMO"],  // empate fast/base cai pro mais rápido
    [0.6, "slow", "ACIMA"],
    [1.2, "slow", "ACIMA"],
    [0.31, "slow", "ACIMA"], // 310ms já passou do teto: não é "próximo de slow"
  ];
  const problems = [];
  for (const [s, token, bucket] of cases) {
    const c = classify(s);
    if (!c) { problems.push(`${s}s: não classificou`); continue; }
    if (c.token !== token || c.bucket !== bucket) {
      problems.push(`${s}s: esperava ${bucket}/${token}, veio ${c.bucket}/${c.token}`);
    }
  }
  /* Valor solto abaixo do teto NÃO pode ser adivinhado: se isto virar
     PRÓXIMO algum dia, o codemod passa a apagar decisão deliberada. */
  if (classify(0.08)) problems.push(`0.08s devia ficar NÃO-MAPEADO, veio ${classify(0.08).token}`);
  if (classify(0)) problems.push("0 devia ser ignorado");

  // Reescrita de verdade, inclusive o import.
  const sample = `"use client";\nimport { motion } from "framer-motion";\n\nexport const A = () => <motion.div transition={{ duration: 0.2 }} />;\n`;
  const rewritten = addImport(
    sample.replace(DURATION_LITERAL, (w, h, n, t) => {
      const c = classify(parseFloat(n));
      return c ? `${h}DUR.${c.token}${t}` : w;
    }),
    "@/lib/motion",
  );
  if (!/duration: DUR\.base/.test(rewritten)) problems.push("não reescreveu duration: 0.2 -> DUR.base");
  if (!IMPORT_DUR.test(rewritten)) problems.push("não acrescentou o import do DUR");
  if ((rewritten.match(/import \{ DUR \}/g) ?? []).length !== 1) problems.push("import duplicado");

  // Idempotência: rodar duas vezes não pode mexer de novo.
  const twice = addImport(rewritten, "@/lib/motion");
  if (twice !== rewritten) problems.push("não é idempotente: segunda passada mexeu no arquivo");

  if (problems.length) {
    console.error("codemod-duration --self-test FALHOU");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`codemod-duration --self-test ok — ${cases.length} classificações, reescrita, import e idempotência.`);
  process.exit(0);
}

/* -------------------------------------------------------------------------- */
/* Execução                                                                   */
/* -------------------------------------------------------------------------- */

const roots = argv.filter((a) => !a.startsWith("--"));
const targets = (roots.length ? roots : ["components", "app", "src"])
  .map((t) => resolve(ROOT, t))
  .filter((t) => existsSync(t));

if (!targets.length) {
  console.error("codemod-duration: nenhum alvo existe. Passe a pasta explicitamente.");
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

const buckets = { EXATO: [], "PRÓXIMO": [], ACIMA: [], "NÃO-MAPEADO": [] };
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
  console.log(`\n${name} (${list.length})${note ? ` — ${note}` : ""}`);
  for (const l of list) console.log(`  ${l}`);
};

show("EXATO", buckets.EXATO, "o número já É o token; renomear");
show("PRÓXIMO", buckets["PRÓXIMO"], "dentro da tolerância e sob 300ms");
show("ACIMA", buckets.ACIMA, OVER ? "aplicado: CORTA a duração, revise no diff" : "NÃO aplicado — mudança de comportamento, veja abaixo");
show("NÃO-MAPEADO", buckets["NÃO-MAPEADO"], "longe de qualquer token; decida à mão ou acrescente um token ao SSoT");

console.log("\n" + "─".repeat(64));
if (!ssotPath) {
  console.log("aviso: nenhum arquivo do alvo importa `DUR` ainda — o import NÃO foi");
  console.log("acrescentado. Importe o SSoT em um arquivo primeiro (ou copie o");
  console.log("assets/motion-ssot-starter/motion.ts), depois rode de novo.");
} else {
  console.log(`SSoT detectado no próprio repo: import { DUR } from "${ssotPath}"`);
}
const applied = buckets.EXATO.length + buckets["PRÓXIMO"].length + (OVER ? buckets.ACIMA.length : 0);
console.log(`${APPLY ? "APLICADO" : "DRY-RUN"} — ${applied} troca(s) em ${filesChanged} arquivo(s).`);
if (!OVER && buckets.ACIMA.length) {
  console.log(
    `\n${buckets.ACIMA.length} achado(s) ACIMA de 300ms ficaram de fora. Eles são o defeito que a\n` +
      `regra slow-ui-duration aponta, mas trocar 0.6 por DUR.slow CORTA a animação pela\n` +
      `metade — e transição de rota e peça de marketing são exceção legítima. Depois de\n` +
      `olhar a lista:  node scripts/codemod-duration.mjs --apply --over`,
  );
}
if (!APPLY) console.log("\nRode de novo com --apply pra escrever.");
