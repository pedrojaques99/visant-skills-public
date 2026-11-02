#!/usr/bin/env node
/**
 * skills-doctor: executable gate for skill frontmatter.
 *
 * It exists because of a real failure: `visant-killer` had "nível vale do
 * silício" in its trigger list, the request started with exactly that phrase,
 * and it did not fire. On inspection, two skills had BROKEN YAML (`Triggers: "x"`
 * and `no pedido: gráfico` inside an unquoted scalar; the `: ` closes the key
 * and the parser dies), and the rest had 800-1300 character descriptions
 * competing with 90 other skills.
 *
 * The lesson: a skill description is code. If it does not pass a parser, the
 * skill does not exist, and nobody notices because the failure is silent.
 * This is the parser.
 *
 *   node skills-doctor.mjs                # audit the whole repo
 *   node skills-doctor.mjs visant-motion  # audit specific skills
 *   node skills-doctor.mjs --root=../x    # audit another skills repo
 *   node skills-doctor.mjs --live         # audit ~/.claude/skills (what actually runs)
 *   node skills-doctor.mjs --fix          # fix what is mechanical (quotes, line folding)
 *   node skills-doctor.mjs --json
 *   node skills-doctor.mjs --self-test    # prove the rules both ways
 *
 * Exits 1 on any ERROR, 0 if only WARN. A WARN is budget; an ERROR is a skill
 * that will not be found.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const HERE = dirname(fileURLToPath(import.meta.url));

/* -------------------------------------------------------------------------- */
/* Budget                                                                     */
/* -------------------------------------------------------------------------- */

/* Why 350/500 and not the 1024 ceiling the platform accepts: the ceiling is
   what fits, not what works. A description is not read in isolation; it
   competes with every other one in the same index. A long description does not
   raise the odds of firing, it dilutes: it buries the literal trigger ("nível
   vale do silício") in 200 words of justification that no selector scores. The
   format that fires is one intent sentence + the literal triggers, and that
   fits in 350. */
const DESC_WARN = 350;
const DESC_ERROR = 500;

/* SKILL.md body: every line here is context spent EVERY time the skill
   loads. Above 250 lines, move it to `references/` and cite it on demand. */
const BODY_WARN = 250;

const KNOWN_KEYS = new Set(["name", "description", "license", "compatibility", "allowed-tools", "metadata", "tags"]);

/* -------------------------------------------------------------------------- */
/* Rules                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Each rule takes the file context and returns findings. Keeping rules as
 * data (not as loose ifs in the flow) is what lets --self-test assert "every
 * rule still fires": a rule that silently stopped matching is worse than no
 * rule, because the audit comes back green.
 */
const RULES = [
  {
    id: "no-frontmatter",
    level: "ERROR",
    check: (c) => (c.raw === null ? ["SKILL.md does not open with a `---` frontmatter block"] : []),
  },
  {
    id: "yaml-invalid",
    level: "ERROR",
    check: (c) => (c.raw !== null && c.parseError ? [`invalid YAML: ${c.parseError}`] : []),
  },
  {
    id: "colon-bomb",
    level: "ERROR",
    /* Catches the bomb EVEN when the current parser tolerated it. That is how
       visant-refine passed the loader and died in js-yaml: different parser,
       different tolerance. An unquoted scalar containing `: ` is undefined, and
       "works in my parser" is not a contract. */
    check: (c) => {
      const out = [];
      for (const { key, text, line } of c.plainScalars) {
        const m = text.match(/\S: |\s: /);
        if (m) out.push(`\`${key}\` is an unquoted scalar containing "${m[0].trim() || ": "}" (line ${line}); quote the value`);
      }
      return out;
    },
  },
  {
    id: "name-missing",
    level: "ERROR",
    check: (c) => (c.fm && !c.fm.name ? ["frontmatter has no `name`"] : []),
  },
  {
    id: "name-mismatch",
    level: "ERROR",
    check: (c) =>
      c.fm?.name && c.fm.name !== c.dir ? [`\`name: ${c.fm.name}\` ≠ folder \`${c.dir}\``] : [],
  },
  {
    id: "name-shape",
    level: "ERROR",
    check: (c) =>
      c.fm?.name && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.fm.name)
        ? [`\`name\` must be lowercase kebab-case, got "${c.fm.name}"`]
        : [],
  },
  {
    id: "desc-missing",
    level: "ERROR",
    check: (c) =>
      c.fm && !String(c.fm.description ?? "").trim()
        ? ["no `description`: the skill cannot be picked by relevance, only by typing its name"]
        : [],
  },
  {
    id: "desc-too-long",
    level: "ERROR",
    check: (c) =>
      c.descLen > DESC_ERROR
        ? [`description has ${c.descLen} chars (ceiling ${DESC_ERROR}); it dilutes the trigger, cut to 1 sentence + 5-8 literal triggers`]
        : [],
  },
  {
    id: "desc-long",
    level: "WARN",
    check: (c) =>
      c.descLen > DESC_WARN && c.descLen <= DESC_ERROR
        ? [`description has ${c.descLen} chars (target ${DESC_WARN})`]
        : [],
  },
  {
    id: "desc-multiline",
    level: "ERROR",
    /* `|` keeps line breaks: the description becomes several lines and the
       skills index shows only the first one. The rest of the trigger is lost.
       `>-` folds and is safe, but a single line is still the format that never
       surprises. */
    check: (c) =>
      c.desc.includes("\n")
        ? ["description has a literal line break (`|` block); the index truncates at the first line, use `>-` or quotes"]
        : [],
  },
  {
    id: "desc-no-triggers",
    level: "WARN",
    /* A description with NO quoted trigger only matches by fuzzy semantics.
       Reliable firing comes from the literal phrase the user types. */
    check: (c) =>
      c.desc && !/["“'](.{3,60})["”']/.test(c.desc) && !/\/[a-z][a-z0-9-]+/.test(c.desc)
        ? ["description has no quoted literal trigger and no `/command`; it only matches by fuzzy semantics"]
        : [],
  },
  {
    id: "metadata-not-string",
    level: "ERROR",
    /* agentskills.io: metadata is a map from strings to strings. A list parses here
       and fails in a stricter client, where the skill just does not exist. */
    check: (c) =>
      c.fm?.metadata && typeof c.fm.metadata === "object"
        ? Object.entries(c.fm.metadata)
            .filter(([, v]) => typeof v !== "string")
            .map(([k]) => `metadata.${k} is not a string (agentskills.io)`)
        : [],
  },
  {
    id: "agent-locked",
    level: "WARN",
    /* A path only one agent understands means the skill works on one agent. */
    check: (c) => (/CLAUDE_SKILL_DIR|~\/\.claude\/skills\//.test(c.text ?? "") ? ["uses a path only Claude Code understands; use <skill-dir>"] : []),
  },
  {
    id: "unknown-key",
    level: "WARN",
    check: (c) =>
      c.fm
        ? Object.keys(c.fm)
            .filter((k) => !KNOWN_KEYS.has(k))
            .map((k) => `unknown frontmatter key: \`${k}\``)
        : [],
  },
  {
    id: "body-long",
    level: "WARN",
    check: (c) =>
      c.bodyLines > BODY_WARN
        ? [`body has ${c.bodyLines} lines (target ${BODY_WARN}); move the excess to references/`]
        : [],
  },
];

/* -------------------------------------------------------------------------- */
/* Reading                                                                    */
/* -------------------------------------------------------------------------- */

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/**
 * Lists the "plain" scalars (unquoted, not block) of the frontmatter, so the
 * colon-bomb rule can flag them regardless of the parser.
 */
function plainScalars(raw) {
  const out = [];
  const lines = raw.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^([A-Za-z0-9_-]+):[ \t]+(.*)$/);
    if (!m) continue;
    const [, key, rest] = m;
    if (/^["'>|&*!]/.test(rest.trim())) continue; // quoted or block: safe
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
 * A rule BETWEEN skills that no per-file check catches: two skills claiming
 * the same literal trigger.
 *
 * It is the defect feedback described as "five skills covering interface
 * quality": when the same territory is claimed several times, the right choice
 * stops being obvious and the cost of a wrong pick goes up. Short descriptions
 * fix dilution; only this fixes disputes.
 *
 * A router is not a dispute: a skill that declares `metadata.routes` hands the
 * request on to those skills, so sharing a trigger with them has one owner.
 * An unrelated skill on the same trigger still fires, router or not.
 *
 * Boundaries are checked here too. Each skill says who its neighbors are in
 * `## Neighbors`, and a boundary only works when both sides know it: if A sends
 * a request to B and B has never heard of A, B will happily keep the request A
 * was meant to hand over. A skill with no section (third party) is exempt as a
 * target; inside a repo, a skill of ours without one is flagged.
 */
function crossCheck(results, { live = false } = {}) {
  const routes = (r) => (r.ctx?.fm?.metadata?.routes ? String(r.ctx.fm.metadata.routes).split(/\s+/) : r.ctx?.routes ?? []);
  const routedBy = new Map(results.map((r) => [r.dir, new Set(routes(r))]));
  const byDir = new Map(results.map((r) => [r.dir, r]));
  const handsOff = (a, b) => routedBy.get(a)?.has(b) || routedBy.get(b)?.has(a);
  const owners = new Map();
  for (const r of results) {
    if (!r.ctx?.desc) continue;
    for (const m of r.ctx.desc.matchAll(/["“']([^"”']{4,60})["”']/g)) {
      const t = m[1].toLowerCase().trim();
      if (!owners.has(t)) owners.set(t, []);
      owners.get(t).push(r.dir);
    }
  }
  const findings = [];
  for (const [trigger, skills] of owners) {
    const all = [...new Set(skills)];
    const uniq = all.filter((s) => !all.some((o) => routedBy.get(o)?.has(s)));
    if (uniq.length > 1) {
      findings.push({
        rule: 'gatilho-duplicado',
        level: 'WARN',
        skill: uniq[0],
        message: `trigger "${trigger}" claimed by ${uniq.length} skills: ${uniq.join(', ')}; pick one owner`,
      });
    }
  }

  /* "burilar" inside "burilar a copy": not identical, still a dispute. The short
     trigger fires on every request the long one was written for. */
  const triggers = [...owners.keys()];
  for (const short of triggers) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${short.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "u");
    for (const long of triggers) {
      if (short === long || !re.test(long)) continue;
      const pairs = owners.get(short).flatMap((a) => owners.get(long).map((b) => [a, b]));
      const clash = pairs.find(([a, b]) => a !== b && !handsOff(a, b) && !(byDir.get(a)?.ctx?.neighbors == null && byDir.get(b)?.ctx?.neighbors == null));
      if (clash) {
        findings.push({
          rule: "gatilho-contido",
          level: "WARN",
          skill: clash[0],
          message: `trigger "${short}" (${clash[0]}) is inside "${long}" (${clash[1]}); narrow it, or declare the hand-off in metadata.routes`,
        });
      }
    }
  }

  for (const r of results) {
    if (!r.ctx) continue;
    const mine = r.ctx.neighbors;
    if (mine === null && !live) {
      findings.push({ rule: "sem-vizinhos", level: "WARN", skill: r.dir, message: "no `## Neighbors` section: nothing says where a request that is not for this skill goes" });
    }
    for (const n of mine ?? []) {
      const target = byDir.get(n);
      if (!target) {
        /* Exists in a source repo but has no junction: a choice, not a broken reference. */
        const inRepo = [HERE, join(HERE, "..", "visant-skills")].some((root) => existsSync(join(root, n, "SKILL.md")));
        if (live && !inRepo) findings.push({ rule: "vizinho-fantasma", level: "ERROR", skill: r.dir, message: `neighbor [[${n}]] is not installed` });
      } else if (target.ctx?.neighbors && !target.ctx.neighbors.has(r.dir)) {
        findings.push({ rule: "vizinho-assimetrico", level: "ERROR", skill: r.dir, message: `names [[${n}]], but ${n} does not name it back` });
      }
    }
    for (const route of routedBy.get(r.dir) ?? []) {
      if (!mine?.has(route)) findings.push({ rule: "rota-sem-vizinho", level: "ERROR", skill: r.dir, message: `metadata.routes has ${route}, missing from \`## Neighbors\`` });
    }
  }
  return findings;
}

/** The skills named in `## Neighbors`, or null when there is no such section. */
function neighborsOf(skillDir) {
  const lines = readFileSync(join(skillDir, "SKILL.md"), "utf8").split(/\r?\n/);
  const start = lines.findIndex((l) => /^## Neighbors\s*$/.test(l));
  if (start < 0) return null;
  const end = lines.findIndex((l, i) => i > start && /^#{1,2} /.test(l));
  const section = lines.slice(start + 1, end < 0 ? undefined : end).join("\n");
  return new Set([...section.matchAll(/\[\[([a-z0-9-]+)\]\]/g)].map((m) => m[1]));
}

/** Who does what, written from the skills themselves so it cannot drift. */
function renderMap(results) {
  const families = new Map();
  for (const r of results) {
    if (!r.ctx?.neighbors) continue;
    const family = r.ctx.fm?.metadata?.family ?? "(sem família)";
    if (!families.has(family)) families.set(family, []);
    families.get(family).push(r);
  }
  const out = ["# Mapa das skills", "", "Gerado por `skills-doctor --map`. Não edite à mão: a fonte é o `SKILL.md` de cada skill.", ""];
  for (const [family, skills] of [...families].sort(([a], [b]) => a.localeCompare(b))) {
    out.push(`## ${family}`, "", "| Skill | O que faz | Vizinhas |", "|---|---|---|");
    for (const r of skills.sort((a, b) => a.dir.localeCompare(b.dir))) {
      const what = r.ctx.desc.split(/ (?:Use on|Use em|Use BEFORE|Use to|Use when)\b/)[0].replace(/\|/g, "\\|").trim();
      out.push(`| \`${r.dir}\` | ${what} | ${[...r.ctx.neighbors].sort().join(", ")} |`);
    }
    out.push("");
  }
  return out.join("\n");
}

function audit(skillDir) {
  const ctx = inspect(skillDir);
  if (ctx.missing) return { dir: ctx.dir, findings: [], skipped: "no SKILL.md" };
  ctx.neighbors = neighborsOf(skillDir);
  ctx.text = readFileSync(join(skillDir, "SKILL.md"), "utf8");
  const findings = [];
  for (const rule of RULES) {
    for (const message of rule.check(ctx)) {
      findings.push({ rule: rule.id, level: rule.level, skill: ctx.dir, message });
    }
  }
  return { dir: ctx.dir, ctx, findings };
}

/* -------------------------------------------------------------------------- */
/* --fix: only what is mechanical and reversible                             */
/* -------------------------------------------------------------------------- */

/**
 * Fixes two things and nothing else: an unquoted scalar containing `: `, and
 * a `|` block that becomes `>-`. It does NOT rewrite long descriptions:
 * shortening is an editorial decision, and a script that "summarizes" a skill
 * description ends up deleting exactly the literal trigger that makes it fire.
 */
function fixFile(skillDir) {
  const file = join(skillDir, "SKILL.md");
  if (!existsSync(file)) return null;
  const text = readFileSync(file, "utf8");
  const m = text.match(FM_RE);
  if (!m) return null;

  let raw = m[1];
  const changes = [];

  // `|` (literal, keeps breaks) → `>-` (folded, a single line when consumed)
  raw = raw.replace(/^([A-Za-z0-9_-]+): \|\s*$/gm, (_, key) => {
    changes.push(`${key}: block \`|\` → \`>-\``);
    return `${key}: >-`;
  });

  // plain scalar with `: ` inside → single quotes with YAML escaping ('' for ')
  for (const { key, text: val, line } of plainScalars(raw)) {
    if (!/\S: |\s: /.test(val)) continue;
    const quoted = `'${val.replace(/'/g, "''")}'`;
    const lines = raw.split(/\r?\n/);
    lines[line - 1] = `${key}: ${quoted}`;
    raw = lines.join("\n");
    changes.push(`${key}: scalar quoted (contained ": ")`);
  }

  if (!changes.length) return null;
  writeFileSync(file, text.replace(FM_RE, `---\n${raw}\n---\n`), "utf8");
  return changes;
}

/* -------------------------------------------------------------------------- */
/* --self-test                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Proves both ways, the only way a zero is worth anything: (a) every rule
 * fires on its broken fixture, (b) the clean fixture returns zero. Without (b),
 * a regex that turned into `/$^/` goes unnoticed forever.
 */
const FIXTURES = {
  bad: {
    "no-frontmatter": "# no frontmatter at all\n",
    // single quote that never closes: a stream error, not an indentation one
    "yaml-invalid": "---\nname: yaml-invalid\ndescription: 'opens the quote and never closes it, like \"open\"\n---\n",
    "colon-bomb": "---\nname: colon-bomb\ndescription: Does a thing. Triggers: \"open\", \"close\", /colon-bomb\n---\n",
    "name-missing": "---\ndescription: 'Does a thing. Triggers: \"open\".'\n---\n",
    "name-mismatch": "---\nname: outro-nome\ndescription: 'Does a thing, like \"open the door\".'\n---\n",
    "name-shape": "---\nname: Name_Shape\ndescription: 'Does a thing, like \"open the door\".'\n---\n",
    "desc-missing": "---\nname: desc-missing\ndescription: ''\n---\n",
    "desc-too-long": `---\nname: desc-too-long\ndescription: '${"keyword ".repeat(70)}\"open\"'\n---\n`,
    "desc-long": `---\nname: desc-long\ndescription: '${"keyword ".repeat(46)}\"open\"'\n---\n`,
    "desc-multiline": "---\nname: desc-multiline\ndescription: |\n  First line, like \"open\".\n  Second line disappears from the index.\n---\n",
    "desc-no-triggers": "---\nname: desc-no-triggers\ndescription: Does a vague, fuzzy thing with no literal trigger at all.\n---\n",
    "unknown-key": "---\nname: unknown-key\ndescription: 'Does a thing, like \"open\".'\ninvented: yes\n---\n",
    "metadata-not-string": "---\nname: metadata-not-string\ndescription: 'Does a thing, like \"open\".'\nmetadata:\n  routes: [a, b]\n---\n",
    "agent-locked": "---\nname: agent-locked\ndescription: 'Does a thing, like \"open\".'\n---\nnode ${CLAUDE_SKILL_DIR}/x.mjs\n",
    "body-long": `---\nname: body-long\ndescription: 'Does a thing, like \"open\".'\n---\n${"line\n".repeat(BODY_WARN + 10)}`,
  },
  /* The clean fixture is the side almost everyone forgets. It has to pass
     EVERY rule silently, otherwise the zero of a real audit is noise too. */
  good: "---\nname: good\ndescription: >-\n  Does one specific, verifiable thing. Use when the request mentions \"open the\n  door\", \"close the door\", \"lock it\", or /good.\n---\n\n# Good\n\nShort body.\n",
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
        `rule \`${ruleId}\` did NOT fire on its own fixture (fired: ${findings.map((f) => f.rule).join(", ") || "nothing"})`,
      );
    }
  }

  const goodDir = join(tmp, "good");
  mkdirSync(goodDir, { recursive: true });
  writeFileSync(join(goodDir, "SKILL.md"), FIXTURES.good, "utf8");
  const clean = audit(goodDir).findings;
  if (clean.length) {
    problems.push(`false positive on the clean fixture: ${clean.map((f) => `${f.rule}: ${f.message}`).join(" | ")}`);
  }

  const silent = RULES.filter((r) => !fired.has(r.id)).map((r) => r.id);
  if (silent.length) problems.push(`rule(s) that never fired: ${silent.join(", ")}`);

  /* crossCheck does not live in RULES (it is a rule BETWEEN skills), so it
     needs its own proof, both ways, like all the others. */
  const mk = (name, desc) => ({ dir: name, ctx: { desc } });
  const dispute = crossCheck([
    mk("a", 'Does a thing. Use on "audit this screen".'),
    mk("b", 'Does another. Use on "audit this screen".'),
  ]);
  if (!dispute.some((f) => f.rule === "gatilho-duplicado")) {
    problems.push("gatilho-duplicado did not fire with two skills on the same trigger");
  }
  const noDispute = crossCheck([
    mk("a", 'Does a thing. Use on "audit this screen".'),
    mk("b", 'Does another. Use on "generate the creative".'),
  ]);
  if (noDispute.length) {
    problems.push(`gatilho-duplicado gave a false positive on distinct triggers: ${JSON.stringify(noDispute)}`);
  }
  const routed = crossCheck([
    { dir: "door", ctx: { desc: 'One door. Use on "audit this screen".', routes: ["a"], neighbors: new Set(["a"]) } },
    mk("a", 'Does a thing. Use on "audit this screen".'),
  ]);
  if (routed.length) {
    problems.push(`gatilho-duplicado fired on a router and the skill it routes to: ${JSON.stringify(routed)}`);
  }
  const outsider = crossCheck([
    { dir: "door", ctx: { desc: 'One door. Use on "audit this screen".', routes: ["a"], neighbors: new Set(["a"]) } },
    mk("a", 'Does a thing. Use on "audit this screen".'),
    mk("b", 'Does another. Use on "audit this screen".'),
  ]);
  if (!outsider.some((f) => f.rule === "gatilho-duplicado")) {
    problems.push("gatilho-duplicado stayed silent on a skill outside the router claiming its trigger");
  }

  /* Boundaries, both ways. */
  const nb = (dir, desc, neighbors, extra = {}) => ({ dir, ctx: { desc, neighbors: neighbors && new Set(neighbors), ...extra } });
  const has = (fs, rule) => fs.some((f) => f.rule === rule);
  if (!has(crossCheck([nb("a", 'Use on "burilar".', []), nb("b", 'Use on "burilar a copy".', [])]), "gatilho-contido")) {
    problems.push("gatilho-contido did not fire on a trigger inside another");
  }
  if (has(crossCheck([nb("a", 'Use on "burilar".', []), nb("b", 'Use on "burilarmos a copy".', [])]), "gatilho-contido")) {
    problems.push("gatilho-contido fired inside a longer word");
  }
  if (has(crossCheck([nb("a", 'Use on "burilar".', ["b"], { routes: ["b"] }), nb("b", 'Use on "burilar a copy".', ["a"])]), "gatilho-contido")) {
    problems.push("gatilho-contido fired on a declared hand-off");
  }
  if (!has(crossCheck([nb("a", "x", ["b"]), nb("b", "x", [])]), "vizinho-assimetrico")) {
    problems.push("vizinho-assimetrico did not fire when B does not name A back");
  }
  if (crossCheck([nb("a", "x", ["b"]), nb("b", "x", ["a"])]).length) {
    problems.push("a symmetric pair produced a finding");
  }
  if (has(crossCheck([nb("a", "x", ["third-party"]), nb("third-party", "x", null)], { live: true }), "vizinho-assimetrico")) {
    problems.push("vizinho-assimetrico fired on a third-party skill with no section");
  }
  if (!has(crossCheck([nb("a", "x", null)]), "sem-vizinhos")) problems.push("sem-vizinhos did not fire inside a repo");
  if (has(crossCheck([nb("a", "x", null)], { live: true }), "sem-vizinhos")) problems.push("sem-vizinhos fired on --live, where third parties live");
  if (!has(crossCheck([nb("a", "x", ["ghost"])], { live: true }), "vizinho-fantasma")) problems.push("vizinho-fantasma did not fire on a skill not installed");
  if (has(crossCheck([nb("a", "x", ["other-repo"])]), "vizinho-fantasma")) problems.push("vizinho-fantasma fired in a repo, where neighbors may live in the other repo");
  if (!has(crossCheck([nb("a", "x", [], { routes: ["b"] }), nb("b", "x", ["a"])]), "rota-sem-vizinho")) problems.push("rota-sem-vizinho did not fire");

  if (problems.length) {
    console.error("skills-doctor --self-test FAILED");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(
    `skills-doctor --self-test ok: ${RULES.length}/${RULES.length} rules fire, ` +
      `clean fixture returns zero.`,
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

// --root=<folder>: another skills repo (the private one uses this doctor instead of keeping a copy).
const rootArg = argv.find((a) => a.startsWith("--root="))?.slice(7);
const ROOT = live ? join(homedir(), ".claude", "skills") : rootArg ? resolve(rootArg) : HERE;

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
  console.log(n ? `skills-doctor --fix: ${n} skill(s) fixed.` : "skills-doctor --fix: nothing mechanical to fix.");
}

const results = skillDirs.map(audit);
const cross = crossCheck(results, { live });

/* --map=<file>: writes who-does-what. --boundaries: only the rules between
   skills, and any finding fails, because "no conflicts" has no warning level. */
const mapPath = argv.find((a) => a.startsWith("--map="))?.slice(6);
if (mapPath) {
  writeFileSync(resolve(mapPath), renderMap(results), "utf8");
  console.log(`skills-doctor --map: ${mapPath}`);
}
if (argv.includes("--boundaries")) {
  for (const f of cross) console.log(`  ${f.level === "ERROR" ? "✗" : "!"} ${f.rule.padEnd(20)} ${f.skill}: ${f.message}`);
  console.log(`skills-doctor --boundaries: ${results.length} skill(s), ${cross.length} conflict(s)`);
  process.exit(cross.length ? 1 : 0);
}

const findings = [...results.flatMap((r) => r.findings), ...cross];
const errors = findings.filter((f) => f.level === "ERROR");
const warns = findings.filter((f) => f.level === "WARN");

if (json) {
  console.log(JSON.stringify({ scanned: results.length, errors, warns }, null, 2));
  process.exit(errors.length || (argv.includes("--strict") && warns.length) ? 1 : 0);
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
  `\nskills-doctor: ${results.length} skill(s), ${clean} clean, ${errors.length} ERROR, ${warns.length} WARN`,
);
if (errors.length) {
  console.log("ERROR = the skill will not be found. Fix it before trusting any audit.");
}
process.exit(errors.length || (argv.includes("--strict") && warns.length) ? 1 : 0);
