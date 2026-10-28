#!/usr/bin/env node
/**
 * skills-doctor — portão executável do frontmatter das skills.
 *
 * Existe por uma falha real: a `visant-killer` tem "nível vale do silício" na
 * lista de gatilhos, o pedido começou com exatamente essa frase, e ela não
 * disparou. Investigando, duas skills tinham YAML QUEBRADO (`Triggers: "x"` e
 * `no pedido: gráfico` dentro de escalar sem aspas — o `: ` fecha a chave e o
 * parser morre), e o resto tinha descrição de 800-1300 caracteres competindo
 * com outras 90 skills.
 *
 * A lição: descrição de skill é código. Se não passa num parser, a skill não
 * existe — e ninguém percebe, porque a falha é silenciosa. Isto é o parser.
 *
 *   node skills-doctor.mjs                # audita o repo inteiro
 *   node skills-doctor.mjs visant-motion  # audita skills específicas
 *   node skills-doctor.mjs --live         # audita ~/.claude/skills (o que roda de verdade)
 *   node skills-doctor.mjs --fix          # conserta o que é mecânico (aspas, dobra de linha)
 *   node skills-doctor.mjs --json
 *   node skills-doctor.mjs --self-test    # prova as regras nos dois sentidos
 *
 * Sai 1 se houver ERROR, 0 se só WARN. Um WARN é orçamento; um ERROR é uma
 * skill que não vai ser encontrada.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const HERE = dirname(fileURLToPath(import.meta.url));

/* -------------------------------------------------------------------------- */
/* Orçamento                                                                  */
/* -------------------------------------------------------------------------- */

/* Por que 350/500 e não o teto de 1024 que a plataforma aceita: o teto é o que
   cabe, não o que funciona. A descrição não é lida isolada — ela concorre com
   todas as outras no mesmo índice. Descrição longa não aumenta a chance de
   disparar, dilui: enterra o gatilho literal ("nível vale do silício") no meio
   de 200 palavras de justificativa que nenhum seletor pontua. O formato que
   dispara é uma frase de intenção + os gatilhos literais, e isso cabe em 350. */
const DESC_WARN = 350;
const DESC_ERROR = 500;

/* Corpo do SKILL.md: cada linha aqui é contexto gasto TODA vez que a skill
   carrega. Acima de 250 linhas, mova para `references/` e cite sob demanda. */
const BODY_WARN = 250;

const KNOWN_KEYS = new Set(["name", "description", "license", "allowed-tools", "metadata", "tags"]);

/* -------------------------------------------------------------------------- */
/* Regras                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Cada regra recebe o contexto do arquivo e devolve achados. Manter as regras
 * como dados (e não como ifs soltos no fluxo) é o que deixa o --self-test
 * afirmar "toda regra ainda dispara" — uma regra que parou de casar calada é
 * pior que nenhuma regra, porque a auditoria volta verde.
 */
const RULES = [
  {
    id: "no-frontmatter",
    level: "ERROR",
    check: (c) => (c.raw === null ? ["SKILL.md não abre com bloco `---` de frontmatter"] : []),
  },
  {
    id: "yaml-invalid",
    level: "ERROR",
    check: (c) => (c.raw !== null && c.parseError ? [`YAML inválido: ${c.parseError}`] : []),
  },
  {
    id: "colon-bomb",
    level: "ERROR",
    /* Pega a bomba MESMO quando o parser da vez tolerou. Foi assim que a
       visant-refine passou no loader e morreu no js-yaml: parser diferente,
       tolerância diferente. Escalar sem aspas contendo `: ` é indefinido, e
       "funciona no meu parser" não é contrato. */
    check: (c) => {
      const out = [];
      for (const { key, text, line } of c.plainScalars) {
        const m = text.match(/\S: |\s: /);
        if (m) out.push(`\`${key}\` é escalar sem aspas e contém "${m[0].trim() || ": "}" (linha ${line}) — aspe o valor`);
      }
      return out;
    },
  },
  {
    id: "name-missing",
    level: "ERROR",
    check: (c) => (c.fm && !c.fm.name ? ["frontmatter sem `name`"] : []),
  },
  {
    id: "name-mismatch",
    level: "ERROR",
    check: (c) =>
      c.fm?.name && c.fm.name !== c.dir ? [`\`name: ${c.fm.name}\` ≠ pasta \`${c.dir}\``] : [],
  },
  {
    id: "name-shape",
    level: "ERROR",
    check: (c) =>
      c.fm?.name && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.fm.name)
        ? [`\`name\` deve ser kebab-case minúsculo, veio "${c.fm.name}"`]
        : [],
  },
  {
    id: "desc-missing",
    level: "ERROR",
    check: (c) =>
      c.fm && !String(c.fm.description ?? "").trim()
        ? ["sem `description` — a skill não pode ser escolhida por relevância, só digitando o nome"]
        : [],
  },
  {
    id: "desc-too-long",
    level: "ERROR",
    check: (c) =>
      c.descLen > DESC_ERROR
        ? [`description com ${c.descLen} chars (teto ${DESC_ERROR}) — dilui o gatilho, corte para 1 frase + 5-8 gatilhos literais`]
        : [],
  },
  {
    id: "desc-long",
    level: "WARN",
    check: (c) =>
      c.descLen > DESC_WARN && c.descLen <= DESC_ERROR
        ? [`description com ${c.descLen} chars (alvo ${DESC_WARN})`]
        : [],
  },
  {
    id: "desc-multiline",
    level: "ERROR",
    /* `|` preserva as quebras: a description vira várias linhas e o índice de
       skills mostra só a primeira. Todo o resto do gatilho some. `>-` dobra e
       é seguro, mas ainda assim uma linha só é o formato que nunca surpreende. */
    check: (c) =>
      c.desc.includes("\n")
        ? ["description tem quebra de linha literal (bloco `|`) — o índice trunca na primeira linha; use `>-` ou aspas"]
        : [],
  },
  {
    id: "desc-no-triggers",
    level: "WARN",
    /* Descrição sem NENHUM gatilho entre aspas é descrição que só casa por
       semântica difusa. Os disparos confiáveis vêm da frase literal que o
       usuário digita. */
    check: (c) =>
      c.desc && !/["“'](.{3,60})["”']/.test(c.desc) && !/\/[a-z][a-z0-9-]+/.test(c.desc)
        ? ["description sem gatilho literal entre aspas nem `/comando` — só casa por semântica difusa"]
        : [],
  },
  {
    id: "unknown-key",
    level: "WARN",
    check: (c) =>
      c.fm
        ? Object.keys(c.fm)
            .filter((k) => !KNOWN_KEYS.has(k))
            .map((k) => `chave de frontmatter desconhecida: \`${k}\``)
        : [],
  },
  {
    id: "body-long",
    level: "WARN",
    check: (c) =>
      c.bodyLines > BODY_WARN
        ? [`corpo com ${c.bodyLines} linhas (alvo ${BODY_WARN}) — mova o excedente para references/`]
        : [],
  },
];

/* -------------------------------------------------------------------------- */
/* Leitura                                                                    */
/* -------------------------------------------------------------------------- */

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/**
 * Lista os escalares "planos" (sem aspas, sem bloco) do frontmatter, para a
 * regra colon-bomb poder acusar independente do parser.
 */
function plainScalars(raw) {
  const out = [];
  const lines = raw.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^([A-Za-z0-9_-]+):[ \t]+(.*)$/);
    if (!m) continue;
    const [, key, rest] = m;
    if (/^["'>|&*!]/.test(rest.trim())) continue; // aspado ou bloco: seguro
    if (!rest.trim()) continue;
    out.push({ key, text: rest, line: i + 1 });
  }
  return out;
}

function inspect(skillDir) {
  const file = join(skillDir, "SKILL.md");
  const dir = basename(skillDir);
  const ctx = { dir, file, raw: null, fm: null, parseError: null, desc: "", descLen: 0, bodyLines: 0, plainScalars: [] };

  if (!existsSync(file)) return { ...ctx, missing: true };

  const text = readFileSync(file, "utf8");
  const m = text.match(FM_RE);
  if (!m) {
    ctx.bodyLines = text.split(/\r?\n/).length;
    return ctx;
  }

  ctx.raw = m[1];
  ctx.bodyLines = text.slice(m[0].length).split(/\r?\n/).length;
  ctx.plainScalars = plainScalars(ctx.raw);

  try {
    ctx.fm = yaml.load(ctx.raw) ?? {};
  } catch (e) {
    ctx.parseError = String(e.message).split("\n")[0];
    return ctx;
  }

  ctx.desc = String(ctx.fm.description ?? "").trim();
  ctx.descLen = ctx.desc.length;
  return ctx;
}

/**
 * Regra ENTRE skills, que nenhuma checagem por arquivo pega: duas skills
 * reivindicando o mesmo gatilho literal.
 *
 * É o defeito que o feedback descreveu como "cinco skills cobrindo qualidade de
 * interface": quando o mesmo território é reivindicado várias vezes, a escolha
 * certa deixa de ser óbvia e o custo de errar sobe. Descrição curta resolve
 * diluição; só isto resolve disputa.
 */
function crossCheck(results) {
  const donos = new Map();
  for (const r of results) {
    if (!r.ctx?.desc) continue;
    for (const m of r.ctx.desc.matchAll(/["“']([^"”']{4,60})["”']/g)) {
      const t = m[1].toLowerCase().trim();
      if (!donos.has(t)) donos.set(t, []);
      donos.get(t).push(r.dir);
    }
  }
  const findings = [];
  for (const [gatilho, skills] of donos) {
    const uniq = [...new Set(skills)];
    if (uniq.length > 1) {
      findings.push({
        rule: 'gatilho-duplicado',
        level: 'WARN',
        skill: uniq[0],
        message: `gatilho "${gatilho}" reivindicado por ${uniq.length} skills: ${uniq.join(', ')} — escolha uma dona`,
      });
    }
  }
  return findings;
}

function audit(skillDir) {
  const ctx = inspect(skillDir);
  if (ctx.missing) return { dir: ctx.dir, findings: [], skipped: "sem SKILL.md" };
  const findings = [];
  for (const rule of RULES) {
    for (const message of rule.check(ctx)) {
      findings.push({ rule: rule.id, level: rule.level, skill: ctx.dir, message });
    }
  }
  return { dir: ctx.dir, ctx, findings };
}

/* -------------------------------------------------------------------------- */
/* --fix: só o que é mecânico e reversível                                    */
/* -------------------------------------------------------------------------- */

/**
 * Conserta duas coisas e nada mais: escalar sem aspas que contém `: `, e bloco
 * `|` que vira `>-`. NÃO reescreve descrição longa — encurtar é decisão
 * editorial, e um script que "resume" a descrição da skill acaba apagando
 * justamente o gatilho literal que faz ela disparar.
 */
function fixFile(skillDir) {
  const file = join(skillDir, "SKILL.md");
  if (!existsSync(file)) return null;
  const text = readFileSync(file, "utf8");
  const m = text.match(FM_RE);
  if (!m) return null;

  let raw = m[1];
  const changes = [];

  // `|` (literal, preserva quebras) → `>-` (dobrado, uma linha só no consumo)
  raw = raw.replace(/^([A-Za-z0-9_-]+): \|\s*$/gm, (_, key) => {
    changes.push(`${key}: bloco \`|\` → \`>-\``);
    return `${key}: >-`;
  });

  // escalar plano com `: ` dentro → aspas simples com escape YAML ('' para ')
  for (const { key, text: val, line } of plainScalars(raw)) {
    if (!/\S: |\s: /.test(val)) continue;
    const quoted = `'${val.replace(/'/g, "''")}'`;
    const lines = raw.split(/\r?\n/);
    lines[line - 1] = `${key}: ${quoted}`;
    raw = lines.join("\n");
    changes.push(`${key}: escalar aspado (continha ": ")`);
  }

  if (!changes.length) return null;
  writeFileSync(file, text.replace(FM_RE, `---\n${raw}\n---\n`), "utf8");
  return changes;
}

/* -------------------------------------------------------------------------- */
/* --self-test                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Prova nos dois sentidos, que é o único jeito de um zero valer alguma coisa:
 * (a) toda regra dispara na fixture defeituosa, (b) a fixture limpa devolve
 * zero. Sem (b), um regex que virou `/$^/` passa despercebido para sempre.
 */
const FIXTURES = {
  bad: {
    "no-frontmatter": "# sem frontmatter nenhum\n",
    // aspas simples que nunca fecham: erro de stream, não de indentação
    "yaml-invalid": "---\nname: yaml-invalid\ndescription: 'abre a aspa e nunca fecha, tipo \"abre\"\n---\n",
    "colon-bomb": "---\nname: colon-bomb\ndescription: Faz coisa. Triggers: \"abre\", \"fecha\", /colon-bomb\n---\n",
    "name-missing": "---\ndescription: 'Faz coisa. Gatilhos: \"abre\".'\n---\n",
    "name-mismatch": "---\nname: outro-nome\ndescription: 'Faz coisa, tipo \"abre a porta\".'\n---\n",
    "name-shape": "---\nname: Name_Shape\ndescription: 'Faz coisa, tipo \"abre a porta\".'\n---\n",
    "desc-missing": "---\nname: desc-missing\ndescription: ''\n---\n",
    "desc-too-long": `---\nname: desc-too-long\ndescription: '${"palavra ".repeat(70)}\"abre\"'\n---\n`,
    "desc-long": `---\nname: desc-long\ndescription: '${"palavra ".repeat(46)}\"abre\"'\n---\n`,
    "desc-multiline": "---\nname: desc-multiline\ndescription: |\n  Primeira linha, tipo \"abre\".\n  Segunda linha some do índice.\n---\n",
    "desc-no-triggers": "---\nname: desc-no-triggers\ndescription: Faz uma coisa vaga e difusa sem nenhum gatilho literal.\n---\n",
    "unknown-key": "---\nname: unknown-key\ndescription: 'Faz coisa, tipo \"abre\".'\ninventada: sim\n---\n",
    "body-long": `---\nname: body-long\ndescription: 'Faz coisa, tipo \"abre\".'\n---\n${"linha\n".repeat(BODY_WARN + 10)}`,
  },
  /* A fixture limpa é o lado que quase todo mundo esquece. Ela precisa passar
     por TODAS as regras em silêncio, senão o zero de uma auditoria de verdade
     também é ruído. */
  good: "---\nname: good\ndescription: >-\n  Faz uma coisa específica e verificável. Use quando o pedido citar \"abre a\n  porta\", \"fecha a porta\", \"tranca\", ou /good.\n---\n\n# Good\n\nCorpo curto.\n",
};

function selfTest() {
  const tmp = mkdtempSync(join(tmpdir(), "skills-doctor-"));
  const problems = [];
  const fired = new Set();

  for (const [ruleId, content] of Object.entries(FIXTURES.bad)) {
    const d = join(tmp, ruleId);
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, "SKILL.md"), content, "utf8");
    const { findings } = audit(d);
    for (const f of findings) fired.add(f.rule);
    if (!findings.some((f) => f.rule === ruleId)) {
      problems.push(
        `regra \`${ruleId}\` NÃO disparou na fixture feita pra ela (disparou: ${findings.map((f) => f.rule).join(", ") || "nada"})`,
      );
    }
  }

  const goodDir = join(tmp, "good");
  mkdirSync(goodDir, { recursive: true });
  writeFileSync(join(goodDir, "SKILL.md"), FIXTURES.good, "utf8");
  const clean = audit(goodDir).findings;
  if (clean.length) {
    problems.push(`falso positivo na fixture limpa: ${clean.map((f) => `${f.rule} — ${f.message}`).join(" | ")}`);
  }

  const silent = RULES.filter((r) => !fired.has(r.id)).map((r) => r.id);
  if (silent.length) problems.push(`regra(s) que nunca dispararam: ${silent.join(", ")}`);

  /* crossCheck não mora em RULES (é regra ENTRE skills), então precisa da
     própria prova — nos dois sentidos, como todas as outras. */
  const mk = (name, desc) => ({ dir: name, ctx: { desc } });
  const disputa = crossCheck([
    mk("a", 'Faz coisa. Use em "audita essa tela".'),
    mk("b", 'Faz outra. Use em "audita essa tela".'),
  ]);
  if (!disputa.some((f) => f.rule === "gatilho-duplicado")) {
    problems.push("gatilho-duplicado não disparou com duas skills no mesmo gatilho");
  }
  const semDisputa = crossCheck([
    mk("a", 'Faz coisa. Use em "audita essa tela".'),
    mk("b", 'Faz outra. Use em "gera o criativo".'),
  ]);
  if (semDisputa.length) {
    problems.push(`gatilho-duplicado deu falso positivo em gatilhos distintos: ${JSON.stringify(semDisputa)}`);
  }

  if (problems.length) {
    console.error("skills-doctor --self-test FALHOU");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(
    `skills-doctor --self-test ok — ${RULES.length}/${RULES.length} regras disparam, ` +
      `fixture limpa devolve zero.`,
  );
  process.exit(0);
}

/* -------------------------------------------------------------------------- */
/* CLI                                                                        */
/* -------------------------------------------------------------------------- */

const argv = process.argv.slice(2);
if (argv.includes("--self-test")) selfTest();

const json = argv.includes("--json");
const doFix = argv.includes("--fix");
const live = argv.includes("--live");
const names = argv.filter((a) => !a.startsWith("--"));

const ROOT = live ? join(homedir(), ".claude", "skills") : HERE;

const skillDirs = (
  names.length
    ? names.map((n) => (n.includes("/") || n.includes("\\") ? resolve(n) : join(ROOT, n)))
    : readdirSync(ROOT, { withFileTypes: true })
        .filter((e) => (e.isDirectory() || e.isSymbolicLink()) && !e.name.startsWith(".") && !e.name.startsWith("_"))
        .filter((e) => !["node_modules", "dist"].includes(e.name))
        .map((e) => join(ROOT, e.name))
).filter((d) => {
  try {
    return statSync(d).isDirectory();
  } catch {
    return false;
  }
});

if (doFix) {
  let n = 0;
  for (const d of skillDirs) {
    const changes = fixFile(d);
    if (changes) {
      n++;
      console.log(`  ${basename(d)}`);
      for (const c of changes) console.log(`    ${c}`);
    }
  }
  console.log(n ? `skills-doctor --fix: ${n} skill(s) consertada(s).` : "skills-doctor --fix: nada mecânico a consertar.");
}

const results = skillDirs.map(audit);
const findings = [...results.flatMap((r) => r.findings), ...crossCheck(results)];
const errors = findings.filter((f) => f.level === "ERROR");
const warns = findings.filter((f) => f.level === "WARN");

if (json) {
  console.log(JSON.stringify({ scanned: results.length, errors, warns }, null, 2));
  process.exit(errors.length ? 1 : 0);
}

const bySkill = new Map();
for (const f of findings) {
  if (!bySkill.has(f.skill)) bySkill.set(f.skill, []);
  bySkill.get(f.skill).push(f);
}

for (const [skill, fs_] of bySkill) {
  console.log(`\n${skill}`);
  for (const f of fs_.sort((a, b) => (a.level === b.level ? 0 : a.level === "ERROR" ? -1 : 1))) {
    console.log(`  ${f.level === "ERROR" ? "✗" : "!"} ${f.rule.padEnd(18)} ${f.message}`);
  }
}

const clean = results.length - bySkill.size;
console.log(
  `\nskills-doctor: ${results.length} skill(s) — ${clean} limpa(s), ${errors.length} ERROR, ${warns.length} WARN`,
);
if (errors.length) {
  console.log("ERROR = a skill não vai ser encontrada. Conserte antes de confiar em qualquer auditoria.");
}
process.exit(errors.length ? 1 : 0);
