#!/usr/bin/env node
/* copy-lint: hunts AI language tics in UI and marketing copy, Brazilian
 * Portuguese AND English. Both rule sets run on every input.
 *
 *   node copy-lint.mjs copy.json copy.ebook.json
 *   node copy-lint.mjs docs/COPY.md src/app/page.tsx
 *   node copy-lint.mjs --quiet copy.json          (exit code only, for CI)
 *   node copy-lint.mjs --include-comments a.tsx   (lints comments too)
 *
 * In .json, reads every string value and reports the KEY (which is the HTML's
 * data-copy). In any other file, reads line by line and reports the line number.
 * Exit 1 if it finds anything, so it works as a gate next to copy:check.
 *
 * In code files (.ts/.tsx/.js/.mjs/.vue/.svelte/.astro), COMMENTS ARE MASKED
 * before linting. The reason is concrete: in an LP with the copy inside the
 * component, the linter's only findings were the JSDoc blocks explaining the
 * design decision to the next dev. No client ever reads a comment, and a tic
 * flagged there trains people to ignore the linter. `--include-comments`
 * restores the old behaviour when you want to audit internal prose on purpose.
 *
 * No dependencies: runs with plain node in any repo.
 *
 * CAREFUL when touching the regexes: JS \b is ASCII, so it does NOT work next to
 * "é"/"são"/"não". Use the L/R boundaries below (unicode lookaround) whenever
 * the edge touches an accented letter, or the rule silently misses.
 *
 * Rule ids are English. Language-specific rules carry a `pt-` or `en-`
 * prefix; the punctuation ones (dashes, bullets, pipe, emoji, semicolon) carry
 * none. The old Portuguese ids still resolve through LEGACY_IDS.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const L = '(?<![\\p{L}\\p{N}])'; // word start, unicode
const R = '(?![\\p{L}\\p{N}])'; // word end, unicode
const rx = (src) => new RegExp(src, 'giu');

/* Each rule: id, what it matches, and the fix that almost always works.
   `hint` is read by the human AND by the agent that will rewrite the line.
   `family`: only the first rule of a family reports per excerpt, so three
   warnings do not pile up on the same sentence. */
const RULES = [
  {
    id: 'em-dash',
    re: /[—–]/gu,
    hint: 'Dashes (travessão) are forbidden. Replace with a period, comma, colon or parentheses.',
  },
  {
    id: 'bullet-separator',
    /*
     * Only counts as a SEPARATOR when there is a space on at least one side.
     *
     * False positive confirmed on 2026-08-12 (visant-board): `DALL·E` is the
     * product name, with the dot GLUED between letters. A proper name is not
     * punctuation, and flagging it teaches the team to ignore the rule exactly
     * where it is right. A metadata separator always breathes: `a · b`.
     */
    /*
     * And a SEQUENCE of dots is not a separator: it is a password mask
     * (`••••••• (ja configurada)`), measured on 2026-08-12 in byok-panel. Two
     * or more glued together never separate anything: a separator is always one.
     */
    re: /(?:\s[·•∙‧](?![·•∙‧])|(?<![·•∙‧])[·•∙‧]\s)/gu,
    hint: 'The bullet separator (alt+7) is forbidden. In a metadata list, use periods and commas ("34 páginas. 9 etapas, 1 case"). In a label, a colon ("Fase 1: A Estratégia"). In a CTA with a price, a preposition ("Quero o e-book por R$ 47").',
  },
  {
    id: 'hyphen-as-dash',
    re: / -{1,2} /gu,
    hint: 'A loose hyphen became a dash. Make it a period or a comma.',
  },
  {
    id: 'pt-not-x-but-y',
    family: 'negation',
    re: rx(`${L}n[ãa]o\\s+(?:é|s[ãa]o|era|eram|foi|foram)${R}[^.!?;]{0,80}[.,;:]\\s*(?:é|s[ãa]o|era|foi|isso\\s+é)${R}`),
    hint: 'The "não é X, é Y" construction. Cut the negative half and state only the Y. If the X matters, show its consequence instead of denying it.',
  },
  {
    id: 'pt-not-just',
    family: 'negation',
    re: rx(`${L}n[ãa]o\\s+(?:é|s[ãa]o|foi)\\s+(?:apenas|s[óo]|somente)${R}`),
    hint: '"não é apenas X, é Y" promises depth without delivering. Say the Y directly.',
  },
  {
    id: 'pt-defined-by-negation',
    family: 'negation',
    re: rx(`${L}n[ãa]o\\s+(?:é|s[ãa]o)\\s+(?:um|uma|o|a|os|as)?\\s*[^.!?]{2,40}[.!]`),
    hint: 'A sentence that defines by negation ("Não é um teaser."). Delete the whole sentence and let the next statement carry the weight.',
  },
  {
    id: 'pt-not-about',
    family: 'negation',
    re: rx(`${L}n[ãa]o\\s+se\\s+trata\\s+de${R}`),
    hint: 'Same family as "não é X, é Y". State it directly.',
  },
  {
    id: 'pt-trailing-negation',
    family: 'negation',
    re: rx(`,\\s*n[ãa]o\\s+(?:é|foi|s[óo]|apenas|somente|o|a|um|uma|de|pra|para|que)${R}`),
    hint: 'A negation hanging at the end ("feito pra ler, não pra arquivar"). Delete the negative tail. The sentence almost always gets stronger.',
  },
  {
    id: 'pt-is-about',
    re: rx(`${L}(?:é|era|s[ãa]o|eram)\\s+sobre${R}`),
    hint: '"é sobre X" asserts nothing. Replace it with a concrete verb: what the thing DOES.',
  },
  {
    id: 'pt-less-x-more-y',
    re: rx(`${L}menos\\s+[^.!?]{1,40}${L}e\\s+mais${R}`),
    hint: 'The "menos X e mais Y" formula. Say only the Y.',
  },
  {
    id: 'pt-more-than-just',
    re: rx(`${L}mais\\s+(?:do\\s+)?que\\s+(?:apenas|s[óo]|um\\s+simples|uma\\s+simples)${R}`),
    hint: 'A disguised variant of "não é apenas". Cut it.',
  },
  {
    id: 'pt-hype',
    family: 'hype',
    re: rx(
      `${L}(?:revolucion[áa]ri\\w*|transformador\\w*|desbloqu\\w+|potencial\\s+m[áa]ximo|` +
        `eleve\\s+(?:seu|sua)|nunca\\s+foi\\s+t[ãa]o|no\\s+mundo\\s+de\\s+hoje|` +
        `cada\\s+vez\\s+mais\\s+competitivo|game\\s*changer|` +
        `jornada\\s+de\\s+(?:sucesso|transforma\\w+)|descubra\\s+o\\s+(?:poder|segredo))${R}`
    ),
    hint: 'Brochure word. Replace it with a verifiable fact or a number.',
  },
  {
    id: 'pt-guru-opener',
    family: 'guru',
    re: rx(
      `${L}(?:imagine\\s+(?:que|se|s[óo]|comigo)|e\\s+se\\s+eu\\s+te\\s+dissesse|` +
        `prepare-se|chegou\\s+a\\s+hora|j[áa]\\s+parou\\s+pra\\s+pensar|` +
        `deixa\\s+eu\\s+te\\s+contar)${R}`
    ),
    hint: 'Guru opening ("Imagine que...", "Prepare-se"). Start with the fact or the scene, no warm-up.',
  },
  {
    id: 'pt-generic-urgency',
    family: 'urgency',
    re: rx(
      `${L}(?:[úu]ltimas\\s+vagas|vagas\\s+limitadas|[úu]ltima\\s+chance|` +
        `corre\\s+que\\s+(?:acaba|t[áa]\\s+acabando)|n[ãa]o\\s+perca\\s+(?:essa|a)\\s+chance|` +
        `por\\s+tempo\\s+limitado|s[óo]\\s+hoje)${R}`
    ),
    hint: 'Generic urgency. The Club\'s scarcity is real and countable: say the number ("este lote tem 30 vagas", "a cota sobe a cada compra").',
  },
  {
    id: 'pipe-separator',
    jsonOnly: true, // in .md the pipe is a table, not a copy separator
    re: /\|/gu,
    hint: 'A pipe separator is the bullet in disguise. Pick the punctuation: period, comma or colon.',
  },
  {
    id: 'emoji',
    /* Applies to every file: an emoji in visible .tsx/.md is the same defect as
       in .json. Code comments are already masked before this. */
    /* Emoji_Presentation instead of Extended_Pictographic: the latter includes
       © ® ™, which are trademarks and stay (Visionário®, Visant Club®). */
    re: /[\p{Emoji_Presentation}\u{1F300}-\u{1FAFF}]/gu,
    hint: 'Zero emoji in page copy.',
  },
  {
    id: 'semicolon',
    jsonOnly: true,
    re: /;/gu,
    hint: 'A semicolon stalls the read in sales copy. Make it a period.',
  },
  {
    id: 'pt-llm-connector',
    family: 'connector',
    re: rx(
      `(?:^|\\n)\\s*(?:Al[ée]m\\s+disso|Por\\s+fim|Em\\s+resumo|` +
        `Vale\\s+(?:a\\s+pena\\s+)?(?:lembrar|ressaltar|destacar)|Em\\s+outras\\s+palavras)${R}`
    ),
    hint: 'AI-essay connector ("Além disso", "Em resumo"). Start the sentence with the subject.',
  },

  /* ---------- English ----------
   * Same tics, English wording. Both sets run on every input: a PT regex does
   * not match EN text and vice versa, so there is no language switch to forget.
   *
   * Conservative on purpose, because product UI is full of plain verbs that
   * look like hype out of context: "Unlock account", "Transform" (a tool name),
   * "More than 30 templates", "Seamless pattern" (a texture feature). Every
   * hype verb needs a marketing object ("unlock your POTENTIAL", "transform
   * YOUR", "elevate YOUR") before it fires. Calibrated on visantlabs-os
   * (en-US.json and src/): "Confirm your email to unlock your full account" is
   * a feature gate and "seamless white background" is a photo backdrop, so
   * "unlock your" needs a hype object and bare "seamless" needs a hype noun. */
  {
    id: 'en-not-about',
    family: 'negation',
    re: rx(
      `${L}(?:isn['’]t|is\\s+not|wasn['’]t|it['’]s\\s+not|aren['’]t|are\\s+not)\\s+(?:just\\s+|only\\s+|really\\s+)?about${R}` +
        `[^.!?]{1,80}[,;:.]\\s*(?:it|this|that|they|we)(?:['’]s|['’]re|\\s+is|\\s+are|\\s+was)\\s+(?:all\\s+)?about${R}`
    ),
    hint: 'The "isn\'t about X, it\'s about Y" construction. Cut the negative half and say what the thing does.',
  },
  {
    id: 'en-not-x-but-y',
    family: 'negation',
    re: rx(
      `${L}(?:(?:it|this|that)(?:['’]s\\s+not|\\s+is\\s+not|\\s+isn['’]t)|(?:we|they|you)(?:['’]re\\s+not|\\s+are\\s+not|\\s+aren['’]t))${R}` +
        `[^.!?;]{1,80}[,;:.]\\s*(?:it|this|that|we|they|you)(?:['’]s|['’]re|\\s+is|\\s+are)${R}`
    ),
    hint: 'The "it\'s not X, it\'s Y" construction. Cut the negative half and state only the Y.',
  },
  {
    id: 'en-not-just',
    family: 'negation',
    re: rx(
      `${L}(?:(?:isn['’]t|is\\s+not|aren['’]t|are\\s+not|wasn['’]t)\\s+(?:just|only|merely|simply)|` +
        `not\\s+(?:just|only|merely|simply)${R}[^.!?;]{1,60}?${L}but)${R}`
    ),
    hint: '"Not just X, but Y" promises depth without delivering. Say the Y directly.',
  },
  {
    id: 'en-more-than-just',
    re: rx(`${L}more\\s+than\\s+(?:just|merely|a\\s+simple|an?\\s+ordinary)${R}`),
    hint: 'A disguised "not just X". Cut it and name what the thing does.',
  },
  {
    id: 'en-all-about',
    re: rx(`${L}(?:it['’]s|it\\s+is|is|are|was)\\s+all\\s+about${R}`),
    hint: '"It\'s all about X" asserts nothing. Replace it with what the thing DOES.',
  },
  {
    id: 'en-hype',
    family: 'hype',
    re: rx(
      `${L}(?:unlock\\s+(?:your\\s+(?:full\\s+|true\\s+)?(?:potential|creativ\\w+|power|growth|success|future|genius)|` +
        `the\\s+(?:full\\s+|true\\s+)?(?:power|potential)|new\\s+possibilities|endless)|` +
        `(?:full|true)\\s+potential|unleash\\w*|supercharg\\w+|revolutioni[sz]\\w*|revolutionary|` +
        `game[-\\s]?chang\\w+|next[-\\s]level|cutting[-\\s]edge|` +
        `seamlessly|seamless\\s+(?:experience|integration|workflow|collaboration|solution|journey)|` +
        `elevate\\s+your|empower(?:s|ing)?\\s+(?:you|your|teams|businesses|creators|brands)|` +
        `transform\\s+(?:your|the\\s+way|how)|harness\\s+the\\s+power|` +
        `in\\s+today['’]s\\s+(?:fast[-\\s]paced|digital|competitive|ever[-\\s]changing)\\s+(?:world|landscape|age|era|market)|` +
        `ever[-\\s](?:evolving|changing)\\s+landscape|look\\s+no\\s+further)${R}`
    ),
    hint: 'Brochure word. Replace it with a verifiable fact or a number.',
  },
  {
    id: 'en-guru-opener',
    family: 'guru',
    re: rx(
      `${L}(?:imagine\\s+(?:a\\s+world|if)|what\\s+if\\s+I\\s+told\\s+you|let['’]s\\s+dive\\s+in(?:to)?|` +
        `here['’]s\\s+the\\s+thing|picture\\s+this|ever\\s+wondered|buckle\\s+up)${R}`
    ),
    hint: 'Guru opening ("Imagine a world...", "Let\'s dive in"). Start with the fact or the scene, no warm-up.',
  },
  {
    id: 'en-llm-connector',
    family: 'connector',
    re: rx(
      `(?:^|[.!?>"“]\\s*)(?:(?:Moreover|Furthermore|Additionally|Ultimately|In\\s+conclusion|In\\s+summary|Notably),|` +
        `It['’]s\\s+worth\\s+noting|It\\s+is\\s+worth\\s+noting|It\\s+is\\s+important\\s+to\\s+note)`
    ),
    hint: 'AI-essay connector ("Moreover,", "It\'s worth noting that"). Start the sentence with the subject.',
  },
  {
    id: 'en-generic-urgency',
    family: 'urgency',
    re: rx(
      `${L}(?:limited\\s+time\\s+only|for\\s+a\\s+limited\\s+time|act\\s+now|don['’]t\\s+miss\\s+out|` +
        `last\\s+chance|while\\s+supplies\\s+last|before\\s+it['’]s\\s+too\\s+late|spots\\s+are\\s+filling\\s+up)${R}`
    ),
    hint: 'Generic urgency. If the scarcity is real, say the number ("30 seats left", "price goes up on Friday").',
  },
];

/* Old (Portuguese) rule ids -> current ids. Anything that READS a rule id from
   config normalizes through this map, so a config written before the rename
   keeps working. killer-scan (`.killer-voice.json`) keeps a copy of this map,
   because it runs copy-lint as a child process instead of importing it; the
   self-test below checks that every target here is a real rule. */
const LEGACY_IDS = {
  travessao: 'em-dash',
  bolinha: 'bullet-separator',
  'hifen-como-travessao': 'hyphen-as-dash',
  'nao-e-x-e-y': 'pt-not-x-but-y',
  'nao-e-apenas': 'pt-not-just',
  'nao-e-definicao': 'pt-defined-by-negation',
  'nao-se-trata': 'pt-not-about',
  'x-virgula-nao-y': 'pt-trailing-negation',
  'e-sobre': 'pt-is-about',
  'menos-x-mais-y': 'pt-less-x-more-y',
  'mais-que-apenas': 'pt-more-than-just',
  hype: 'pt-hype',
  'abertura-de-guru': 'pt-guru-opener',
  'urgencia-cliche': 'pt-generic-urgency',
  'pipe-separador': 'pipe-separator',
  'ponto-e-virgula': 'semicolon',
  'conector-de-llm': 'pt-llm-connector',
  'selo-de-credibilidade': 'credibility-seal',
};

/* Crutches that go unnoticed once and give away AI the second time. They are
   counted over the WHOLE FILE, not the sentence: the problem is repetition.
   Origin: a reader caught "trajetória real / projeto real / técnica real /
   processo real" in a single piece and posted a screenshot. A credibility
   adjective proves nothing; the number or the scene does. */
const REPEATS = [
  {
    id: 'credibility-seal',
    max: 1,
    /* Two exceptions, both from false positives measured in production:

       "tempo real" ("real time") is an idiom, not a seal. It says WHEN the thing
       happens, and the lookbehind kills only it without weakening "projeto real".

       "autenticado", "autenticar" and "autenticação" are about login, and have
       nothing to do with "autêntico". `aut[êe]ntic\\w+` matched all three because
       `[êe]` accepts the unaccented form. Now the rule lists the endings of the
       ADJECTIVE and the quality, and leaves the verb out. */
    /* Third exception, and the most obvious one once measured: in a Brazilian
       product "real"/"reais" is MONEY before it is a seal. `R$ 47`, "Real
       brasileiro", "1200 reais": none of them defends an argument. The
       lookbehind covers the attached number ("47 reais") and the currency
       name; `R$` in the same unit is handled outside the regex, in the
       currency filter below. */
    /* English joins the same budget (one seal per piece, whichever language):
       "truly", "genuinely", "authentic", "honestly", "real". "real-time" and
       "real estate" are the English "tempo real": they say WHAT, not "trust me".
       `genu[íi]n\\w+` already covers "genuine"/"genuinely" and `honest\\w+`
       covers "honestly", so the English branch does not repeat them. */
    re: rx(
      `${L}(?:(?<!tempo\\s)(?<!\\d\\s)(?<!brasileiro\\s)(?:real|reais)(?![-\\s]+(?:time|estate)${R})|de\\s+verdade|` +
        `na\\s+pr[áa]tica|de\\s+fato|genu[íi]n\\w+|aut[êe]ntic(?:o|a|os|as|idade)|` +
        `honest\\w+|truly|authentic(?:ally|ity)?)${R}`
    ),
    /* A unit that talks about money does not count toward the seal. */
    ignoraUnidade: (text) => /R\$|\bBRL\b|\breal brasileiro\b/i.test(text),
    hint: 'Delete the seal. "Projeto real" is just "projeto", "a truly authentic process" is just "the process"; "de verdade" at the end of a sentence is the defense of someone who does not trust their own argument. If it needs proof, use a number or a scene.',
  },
];

const args = process.argv.slice(2);
const quiet = args.includes('--quiet');
const comentarios = args.includes('--include-comments');
/* --self-test: proves both directions, like the repo's other detectors. Every
   rule in RULES and REPEATS must fire on its bad example, and every clean
   sentence must pass all of them. A rule that went inert shows up here, not in
   production. The clean set carries the English false-positive guards: plain
   UI verbs that only look like hype. */
if (args.includes('--self-test')) {
  const RUIM = {
    'em-dash': 'Rápido — e bonito.',
    'bullet-separator': 'Marca · Site',
    'hyphen-as-dash': 'Rápido - e bonito.',
    'pt-not-x-but-y': 'Não é um site, é uma máquina de venda.',
    'pt-not-just': 'Não é apenas um site.',
    'pt-defined-by-negation': 'Não é um teaser.',
    'pt-not-about': 'Não se trata de design.',
    'pt-trailing-negation': 'Feito pra ler, não pra arquivar.',
    'pt-is-about': 'Branding é sobre pessoas.',
    'pt-less-x-more-y': 'Menos ruído e mais venda.',
    'pt-more-than-just': 'Mais que apenas um logo.',
    'pt-hype': 'Uma solução revolucionária.',
    'pt-guru-opener': 'Imagine que seu site vendesse sozinho.',
    'pt-generic-urgency': 'Últimas vagas para o curso.',
    'pipe-separator': 'Marca | Site',
    emoji: 'Seu site novo 🚀',
    semicolon: 'Rápido; bonito.',
    'pt-llm-connector': 'Além disso, entregamos rápido.',
    'en-not-about': "Branding isn't about logos, it's about trust.",
    'en-not-x-but-y': "It's not a website, it's a sales machine.",
    'en-not-just': 'Not just a template, but a system.',
    'en-more-than-just': 'More than just a logo.',
    'en-all-about': "Design is all about people.",
    'en-hype': 'Unlock your full potential with a revolutionary way to ship.',
    'en-guru-opener': 'Imagine a world where your site sells itself.',
    'en-llm-connector': 'Moreover, we ship fast.',
    'en-generic-urgency': "Limited time only, don't miss out.",
    'credibility-seal': 'A truly authentic process with real results.',
  };
  const LIMPAS = [
    'Seu site novo fica pronto em uma semana.',
    'Your new site ships in one week.',
    'Unlock account',
    'Transform tool',
    'More than 30 templates',
    'Real-time preview of every mockup.',
    'Seamless pattern generator',
    'Confirm your email to unlock your full account.',
    'A seamless white background behind the product.',
    'Empower mode is off.',
    "This isn't available on the free plan.",
  ];
  const falhas = [];
  const dispara = (rule, text) => {
    rule.re.lastIndex = 0;
    return rule.re.test(text);
  };
  for (const rule of [...RULES, ...REPEATS]) {
    for (const limpa of LIMPAS) {
      if (dispara(rule, limpa)) falhas.push(`${rule.id} fired on the clean sentence "${limpa}"`);
    }
    const ruim = RUIM[rule.id];
    if (ruim === undefined) {
      falhas.push(`${rule.id} has no bad example in the self-test`);
      continue;
    }
    if (rule.max !== undefined) {
      const n = (ruim.match(rule.re) || []).length;
      if (n <= rule.max) falhas.push(`${rule.id} counted ${n} on "${ruim}", needs more than ${rule.max}`);
    } else if (!dispara(rule, ruim)) falhas.push(`${rule.id} did not fire on "${ruim}"`);
  }
  const ids = new Set([...RULES, ...REPEATS].map((r) => r.id));
  for (const id of Object.keys(RUIM)) {
    if (!ids.has(id)) falhas.push(`rule ${id} is gone from RULES`);
  }
  for (const [velho, novo] of Object.entries(LEGACY_IDS)) {
    if (!ids.has(novo)) falhas.push(`LEGACY_IDS maps ${velho} to ${novo}, which is not a rule`);
  }
  /* What counts as copy in code and Markdown, both ways: the clean fixtures
     hold code and docs that are not copy (arithmetic, logs, calc(), lists,
     fences, frontmatter) and must pass; the dirty one must fail. */
  const fx = (f) => fileURLToPath(new URL(`./fixtures/${f}`, import.meta.url));
  const run = (...f) => spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--quiet', ...f.map(fx)]).status;
  if (run('clean-code.tsx', 'clean-docs.md') !== 0) falhas.push('fixtures/clean-* flagged code or docs that are not copy');
  if (run('dirty.tsx') !== 1) falhas.push('fixtures/dirty.tsx passed: JSX text is not being linted');
  if (falhas.length) {
    console.error(`✗ copy-lint --self-test\n  ${falhas.join('\n  ')}`);
    process.exit(1);
  }
  console.log(
    `✓ copy-lint --self-test: ${Object.keys(RUIM).length} rules fire (PT and EN), ` +
      `${LIMPAS.length} clean sentences pass all ${ids.size}, ${Object.keys(LEGACY_IDS).length} legacy ids map to live rules`
  );
  process.exit(0);
}

const CODIGO = /\.(?:[cm]?[jt]sx?|vue|svelte|astro)$/i;
const TEXTO = /\.(?:json|md|mdx|html?|txt)$/i;
const PULA = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'out', 'coverage']);

/* A folder becomes the list of copy files inside it; a file passes straight through. */
function expande(alvo) {
  if (!statSync(alvo).isDirectory()) return [alvo];
  return readdirSync(alvo, { withFileTypes: true }).flatMap((e) => {
    if (PULA.has(e.name) || e.name.startsWith('.')) return [];
    const p = join(alvo, e.name);
    if (e.isDirectory()) return expande(p);
    return CODIGO.test(e.name) || TEXTO.test(e.name) ? [p] : [];
  });
}

const alvos = args.filter((a) => !a.startsWith('--'));
if (!alvos.length) {
  console.log('usage: copy-lint.mjs [--quiet] [--include-comments] <file or folder...>');
  process.exit(1);
}
const faltando = alvos.filter((a) => !existsSync(a));
if (faltando.length) {
  console.error(`copy-lint: does not exist: ${faltando.join(', ')}`);
  process.exit(1);
}
const files = alvos.flatMap(expande);

/* A key whose value is someone else's speech. See the note in the main loop. */
const CHAVE_DE_CITACAO = /(^|\.)(?:quote|quote_by|depoimento)$/;

/* Erases code comments by replacing them with spaces, keeping \n so line
   numbers still match the file.
   Walks character by character because a regex cannot tell the `//` of a
   comment from the one in `https://`. If the walk ends inside an open string
   or block, the file has syntax we did not understand (or a stray apostrophe
   in JSX text): it returns the original and lints everything, because erring
   on the side of more is better than silently erasing copy. */
function mascaraComentarios(raw) {
  let out = '';
  let i = 0;
  let estado = 'codigo'; // codigo | linha | bloco | "'" | '"' | '`'
  const vazio = (c) => (c === '\n' ? '\n' : ' ');

  while (i < raw.length) {
    const c = raw[i];
    const prox = raw[i + 1];

    if (estado === 'codigo') {
      if (c === '/' && prox === '/') { estado = 'linha'; out += '  '; i += 2; continue; }
      if (c === '/' && prox === '*') { estado = 'bloco'; out += '  '; i += 2; continue; }
      if (c === "'" || c === '"' || c === '`') estado = c;
      out += c; i++; continue;
    }

    if (estado === 'linha') {
      if (c === '\n') estado = 'codigo';
      out += vazio(c); i++; continue;
    }

    if (estado === 'bloco') {
      if (c === '*' && prox === '/') { estado = 'codigo'; out += '  '; i += 2; continue; }
      out += vazio(c); i++; continue;
    }

    /* Inside a string: only the backslash and the same quote matter.
       A line break closes ' and " because in JS they do not cross lines.
       Without this, an apostrophe in JSX text ("d'água") would open a fake
       string and drag the rest of the file along with it. */
    if ((estado === "'" || estado === '"') && c === '\n') { estado = 'codigo'; out += c; i++; continue; }
    if (c === '\\') { out += raw.slice(i, i + 2); i += 2; continue; }
    if (c === estado) estado = 'codigo';
    out += c; i++;
  }

  return estado === 'codigo' ? out : raw;
}

/* Returns [{ loc, text }], the unit we lint. In json the unit is the key
   (because that is what the author edits), in text it is the line. */
/* In code, copy is what reaches the eye: string literals and JSX text. Linting
   the whole line read `activeIndex - 1` as a hyphen used as a dash (measured on
   shadcn-ui/taxonomy). Template `${...}` expressions are dropped; a line with no
   code punctuation inside JSX is taken as text. */
const STRING_RE = /(['"])((?:\\.|(?!\1).)*)\1|`((?:\\.|[^`])*)`/g;
const JSX_TEXT_RE = />([^<>{}]*\p{L}[^<>{}]*)</gu;
function textOfCode(line) {
  const out = [];
  // Developer logs never reach the screen (measured on vercel/commerce).
  if (/\bconsole\.(log|warn|error|info|debug)\(/.test(line)) return out;
  for (const m of line.matchAll(STRING_RE)) {
    const s = (m[2] ?? m[3] ?? '').replace(/\$\{[^}]*\}/g, ' ');
    // CSS math and variables inside a string are code, not copy.
    if (/\p{L}/u.test(s) && !/calc\(|var\(--/.test(s)) out.push(s);
  }
  for (const m of line.matchAll(JSX_TEXT_RE)) out.push(m[1]);
  const bare = line.trim();
  if (!out.length && /^\p{L}/u.test(bare) && !/[=;(){}<>\[\]]|=>|^(import|export|const|let|var|return|if|else|for|while|function|type|interface)\b/.test(bare)
      && bare.split(/\s+/).length >= 3) out.push(bare);
  return out;
}

/* In Markdown, copy is the prose: frontmatter, fenced code, inline code and the
   list marker are not text (a nested `  - item` read as a dash). */
function textOfMarkdown(raw) {
  const lines = raw.split('\n');
  let fence = null;
  let front = lines[0]?.trim() === '---';
  return lines.map((line, i) => {
    if (front) {
      if (i > 0 && line.trim() === '---') front = false;
      return '';
    }
    const f = line.match(/^\s*(```|~~~)/);
    if (f) {
      fence = fence ? null : f[1];
      return '';
    }
    if (fence || /^( {4}|\t)/.test(line)) return '';
    // Blockquote markers first, then the list marker (`> - item`).
    return line
      .replace(/`[^`]*`/g, ' ')
      .replace(/^\s*(?:>\s*)*/, '')
      .replace(/^(?:[-*+]|\d+[.)])\s+/, '');
  });
}

function units(file) {
  const raw = readFileSync(file, 'utf8');
  if (!file.endsWith('.json')) {
    if (CODIGO.test(file)) {
      if (comentarios) return raw.split('\n').map((text, i) => ({ loc: `L${i + 1}`, text }));
      return mascaraComentarios(raw)
        .split('\n')
        .flatMap((line, i) => textOfCode(line).map((text) => ({ loc: `L${i + 1}`, text })));
    }
    const fonte = /\.mdx?$/i.test(file) ? textOfMarkdown(raw) : raw.split('\n');
    return fonte.map((text, i) => ({ loc: `L${i + 1}`, text }));
  }
  const out = [];
  const walk = (node, path) => {
    if (typeof node === 'string') return out.push({ loc: path, text: node });
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
    }
  };
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error(`copy-lint: ${file} is not valid JSON (${e.message})`);
    process.exit(1);
  }
  walk(data, '');
  return out;
}

/* Length guide per line type, inferred from the key suffix. It is a WARNING,
   never an error: good copy cannot fail over 3 characters. It exists to flag
   the headline that will break into three lines on mobile. */
const LIMITS = [
  // SEO has Google's limit, not the layout's.
  { test: /^meta\.(title|og_title|og_image_alt)$/, max: 60, tipo: 'SEO title' },
  { test: /^meta\.(description|og_description)$/, max: 160, tipo: 'meta description' },
  // The questions inside the book sample are body text, not headlines.
  { test: /^sample\.(q\d+|p\d+)$/, max: 340, tipo: 'body' },
  { test: /(^|\.)(cta|cta_\w+|badge|free_badge)$/i, max: 28, tipo: 'CTA' },
  { test: /(^|\.)(title|q\d*|tier|eyebrow|label|kicker)$/i, max: 60, tipo: 'headline' },
  { test: /(^|\.)(lead|subtitle)$/i, max: 180, tipo: 'lead' },
  { test: /(^|\.)(body|body2|note|trigger|a\d+|_b)$/i, max: 280, tipo: 'body' },
];

function overLimit(loc, text) {
  const rule = LIMITS.find((l) => l.test.test(loc));
  if (!rule || text.length <= rule.max) return null;
  return `${loc} (${rule.tipo}) has ${text.length} characters, guide is ${rule.max}`;
}

let hits = 0;
const byRule = new Map();
const warnings = [];
const porArquivo = new Map();

for (const file of files) {
  const found = [];
  const isJson = file.endsWith('.json');
  const unidades = units(file);
  porArquivo.set(file, unidades);
  for (const { loc, text } of unidades) {
    if (isJson) {
      const w = overLimit(loc, text);
      if (w) warnings.push(`${file}: ${w}`);
      /* A QUOTE IS NOT EDITED. A key ending in `quote` carries a person's
         speech, attributed and verifiable, and rewriting it to fit a style
         rule is forging a testimonial.

         The case that forced this is in /lote: `pedagio.quote` is "Ele não é
         um bom designer, mas é um bom engenheiro", said by Jaques in the lote
         recording. It matches `nao-e-definicao` and still has to stay exactly
         as it was said.

         The LENGTH warning comes out before this and still applies: a quote
         that is too long still breaks the layout, and trimming a quote with
         an ellipsis is a legitimate editorial decision. */
      if (CHAVE_DE_CITACAO.test(loc)) continue;
    }
    const seen = new Set();
    for (const rule of RULES) {
      if (rule.jsonOnly && !isJson) continue;
      if (rule.family && seen.has(rule.family)) continue;
      rule.re.lastIndex = 0;
      const m = rule.re.exec(text);
      if (!m) continue;
      if (rule.family) seen.add(rule.family);
      found.push({ loc, rule, match: m[0].trim(), text });
      byRule.set(rule.id, rule.hint);
      hits++;
    }
  }
  /* Repetition pass: runs after scanning the whole file.
   *
   * The budget is PER PIECE, and in a locale dictionary the piece is NOT the
   * file. Measured in visantlabs-os: `pt-BR.json` has 5173 keys from dozens
   * of independent screens, and the limit of 1 flagged 11 occurrences as if
   * they were the same page. A rule that shouts 11 times teaches people to
   * ignore the linter, which is worse than not having the rule.
   *
   * In JSON the group becomes the first segment of the key (`onboarding.*`,
   * `mockup.*`), the closest to "one piece" the structure offers. In a
   * component it stays per file, which already IS the piece.
   */
  const grupoDe = (loc) => (isJson ? String(loc).split('.')[0] : file);

  for (const rule of REPEATS) {
    const porGrupo = new Map();
    for (const { loc, text } of unidades) {
      if (rule.ignoraUnidade?.(text)) continue;
      rule.re.lastIndex = 0;
      let m;
      while ((m = rule.re.exec(text))) {
        const g = grupoDe(loc);
        if (!porGrupo.has(g)) porGrupo.set(g, []);
        porGrupo.get(g).push({ loc, match: m[0] });
      }
    }
    for (const [grupo, onde] of porGrupo) {
      if (onde.length <= rule.max) continue;
      found.push({
        loc: onde.map((o) => o.loc).join(', '),
        rule,
        match: onde.map((o) => o.match).join('", "'),
        text: `${onde.length} occurrences in ${isJson ? `${grupo}.*` : 'one file'} (limit ${rule.max})`,
      });
      byRule.set(rule.id, rule.hint);
      hits++;
    }
  }

  if (quiet || !found.length) continue;
  console.log(`\n${file}`);
  for (const f of found) {
    /* Two spaces minimum between id and loc: killer-scan parses this line. */
    console.log(`  ${f.rule.id.padEnd(22)}  ${f.loc}`);
    console.log(`    ${f.text.length > 160 ? f.text.slice(0, 157) + '...' : f.text}`);
    console.log(`    ↑ matched: "${f.match}"`);
  }
}

/* Echo: the same sentence living in two files.
   An LP headline usually exists three times (component, og:image card,
   metadata `<title>`) and nothing warns you when you change one and forget
   the others. The social card keeps selling last month's promise. It comes
   out as a WARNING, because duplicating is sometimes the right call: what it
   cannot be is a surprise. Only compares when the linter got 2+ files.

   CODE FILES ARE LEFT OUT, and that is measured, not preference. Running the
   linter on 40 .tsx files of a React app, the echo produced 148 warnings
   against 23 real tics: six to one. And the 148 were junk, because in code the
   "text" left after removing tags and braces is still attribute soup, so two
   components with the same Tailwind class list became a "69-word echo". At a
   ratio like that the team learns to ignore the whole output, and then the
   echo costs the 23 good findings instead of adding one.

   It still applies where it was born to serve: copy JSON, MD and HTML, which
   is where the real headline repeats between the page and the social card. */
const paraEco = files.filter((f) => !CODIGO.test(f));
if (paraEco.length > 1) {
  /* Compares WORDS, not lines: in the component the headline comes split
     across two `<span>`s and in the og:image card it is one string, so
     matching line to line would find nothing. JSX tags and braces go, the
     prose stays. */
  const palavras = (file) =>
    porArquivo
      .get(file)
      .map((u) => u.text)
      .join(' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/[{}]/g, ' ')
      .toLowerCase()
      .match(/[\p{L}\p{N}\p{M}]+/gu) ?? [];

  const MIN_PALAVRAS = 6;
  for (let a = 0; a < paraEco.length; a++) {
    for (let b = a + 1; b < paraEco.length; b++) {
      const A = palavras(paraEco[a]);
      const B = palavras(paraEco[b]);
      /* Longest common run, classic DP with one row of state. */
      let melhor = 0;
      let fim = 0;
      let anterior = new Array(B.length + 1).fill(0);
      for (let i = 1; i <= A.length; i++) {
        const atual = new Array(B.length + 1).fill(0);
        for (let j = 1; j <= B.length; j++) {
          if (A[i - 1] !== B[j - 1]) continue;
          atual[j] = anterior[j - 1] + 1;
          if (atual[j] > melhor) {
            melhor = atual[j];
            fim = i;
          }
        }
        anterior = atual;
      }
      if (melhor < MIN_PALAVRAS) continue;
      const trecho = A.slice(fim - melhor, fim).join(' ');
      warnings.push(
        `${melhor}-word echo between ${paraEco[a]} and ${paraEco[b]}, update both: "${trecho.slice(0, 70)}${trecho.length > 70 ? '…' : ''}"`
      );
    }
  }
}

/* Length warnings always print, and NEVER change the exit code. */
if (warnings.length && !quiet) {
  console.log('\nWarnings (guidance, they do not affect the exit code):');
  for (const w of warnings) console.log(`  ${w}`);
}

if (!hits) {
  if (!quiet) console.log('\n✔ clean copy: no tics found.');
  process.exit(0);
}

if (!quiet) {
  console.log('\nHow to fix:');
  for (const [id, hint] of byRule) console.log(`  ${id}: ${hint}`);
}
console.error(`\n✗ ${hits} occurrence(s) in ${files.length} file(s).`);
process.exit(1);
