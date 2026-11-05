# Verification tools: `verify-screens`, `corta-scan`, `corta-url`

Detail behind Step 5 of [SKILL.md](../SKILL.md). Before any measurement, the four
signals in [environment.md](environment.md).

## `verify-screens.mjs`: the app behind login

Opens each route logged in, at the requested widths and themes, and per screen
measures document overflow, `corta-scan`, raw i18n keys, console errors and
`pageerror`, 4xx/5xx responses from `/api`, an empty screen, and whether the
theme applied. Saves a screenshot and `report.json`. Run it from the target repo
(it resolves Playwright from there):

```bash
V=<skill-dir>/scripts/verify-screens.mjs
node $V                                        # navConfig routes, 1366+390, dark, dev-login
node $V --routes home,apps,references --theme both
node $V --scan-paid                            # useEffect that calls paid AI: lock candidates
node $V --self-check                           # parsing only, no browser
```

- **Routes in Git Bash go without a leading slash** (`apps`,
  `settings/api-keys`): MSYS rewrites `/apps` into `C:/Program Files/Git/apps`,
  and `MSYS_NO_PATHCONV=1` breaks the script's own path.
- **Paid-route lock, two layers.** A route in `--skip-paid` (default `/naming`)
  is never opened, and on **every** route a POST to a paid endpoint is aborted in
  the browser and reported as `PAID-BLOCKED`. The second layer catches the paid
  route nobody listed. `--allow-paid` turns both off, and is used only knowing
  who pays. Found a new route that spends on load: add it to
  `DEFAULT_SKIP_PAID`. Why: [cases.md](cases.md#the-paid-route).
- `BLANK-SCREEN` is re-measured once before becoming a finding (it is almost
  always the dev server recompiling), and `api4xx5xx` does not fail on its own:
  a local backend has broken routes that are not the screen's.

Outside the app (published URL, no login): `corta-url.mjs <base> route route`.

## `corta-scan.js`: what the eye misses on an open screen

Paste it in the console of an open screen: `corta('.panel')` returns
`element:reason` for a word eaten by a clipping parent, an overlay covering
another in the same corner, and a piece that left its box. No static detector
sees this: the width of a word only exists after the font loads.

It separates three things the eye confuses, and the separation is the value:

- scrolling is **not** a cut;
- ellipsis and `line-clamp` are **not** a cut;
- a rail that scrolls sideways is **not** a cut;
- and a small badge (< 25% of the area) over an `inset-0` background with
  nothing interactive is **not** a stacked overlay.

Locked in `scripts/fixtures/clip-cases.html`:

```bash
node <skill-dir>/scripts/corta-self-test.mjs
```

Run it from the target repo (it resolves `playwright-core`/`playwright` from the
cwd, with the npx cache as backup). Without either it says `NOT TESTED`, which
is not a pass.

Per-check detail lives in `visant-frontend/references/verification.md`.

## `ritmo-scan.js`: spacing that lies about grouping

Same harness, same two ways (`ritmo()` in the console, or `$V` /
`corta-url.mjs`, which print it as `spacing`). Three rules, all measured on ink
(line boxes, media, boxed regions), never on CSS boxes:

- `proximidade-invertida`: a group's inner gap is larger than the gap that
  separates it from its neighbors. Reports the ink and the authored numbers,
  and the fix.
- `ritmo-chato`: three nested groups with the same gap (catalog 6).
- `irmaos-desalinhados`: identical siblings with a different padding/gap, or one
  gap in a regular list off by 2-8px. More room before a heading is a decision
  and stays silent; so does a drift larger than 8px.

What it separates, and the separation is the value:

- a card (background, border or shadow) is its own region: common region beats
  proximity, so boxed groups are never "inverted";
- `aria-hidden` subtrees are illustrations drawn in DOM, not the interface;
- a stack with a gap above 96px is page layout, not a component;
- an off-scale value is NOT its business (see gates.md "Spacing: two layers").

Locked in `scripts/fixtures/spacing-cases.html` by the same
`corta-self-test.mjs`.

## `tela-scan.js`: what the screen lost

Every other detector punishes what is left over; a screen stripped bare passes
them all ([the case](cases.md#limpo-até-demais)). Same harness (`tela()` in the
console, or `screen` in `$V` and `corta-url.mjs`). Findings are candidates and
never fail the run.

| Axis | Rule | Fires at |
|---|---|---|
| respiro | `vazio-lateral` | one side void >= max(120px, 10% of usable) more than the other, or centered under 60% and under 800px; from 1024px, with data, not on prose or forms |
| respiro | `blocos-colados` | two boxes 2-6px apart, or a heading 0-6px above a box |
| respiro | `texto-denso` | a 600px band >= 34% line boxes, no surface or media in it, not prose |
| hierarquia | `sem-ponto-de-entrada` | first viewport with nothing >= 1.3x body (1.15x if bold), no media >= 20% of it |
| hierarquia | `metrica-sem-destaque` | 3+ main numbers, >= 60% with no size and no surface |
| hierarquia | `numeros-em-frase` | 3+ quantities enumerated in one sentence (a caption under a real tile passes) |
| hierarquia | `tudo-igual` | 15+ runs, >= 90% of the characters in one size and weight, zero surfaces |
| interatividade | `acao-virou-texto` | a lone action verb with no control and no pointer |
| interatividade | `estado-so-texto` | 3+ rows with a status word in neutral ink, no chip, dot or colored icon |
| interatividade | `estado-so-icone` | 3+ rows whose only state is a grey icon or dot |
| interatividade | `parece-clicavel` | pointer, `<a>` with no destination, enabled button or underlined text, with no handler; only where handlers can be read |
| comunicacao | `texto-demais` | 150+ words off links, not prose, under 1.5 visuals per 100 words |
| comunicacao | `rotulo-repetido` | the same short label on >= 80% of 4+ sibling rows; a row with a chart passes |
| comunicacao | `legenda-em-toda-linha` | >= 80% of 5+ stacked rows with a quieter caption of 4+ words |
| comunicacao | `nomes-tecnicos` | 6+ distinct identifiers listed together, not links, not facts on a row, not ticket keys |
| comunicacao | `pilha-de-selos` | 5+ inert chips in one parent, or 3+ rows with 3+ each. The opposite failure |
| comunicacao | `icones-decorativos` | the same neutral icon leading 5+ inert items. The opposite failure |

Target size and accessible name are axe-core (`target-size`, `button-name`,
`link-name`, `aria-command-name`), run by `tela-harness.mjs`; no axe prints NOT
MEASURED. A page with a display-size heading (40px+) is a **showcase**: it draws
fake product UI in plain DOM, so only `texto-denso`, `sem-ponto-de-entrada`,
`metrica-sem-destaque` and `tudo-igual` run there, and the output says so.

### `regressao.mjs`: before against after

```bash
node regressao.mjs snap <url> --out antes.json      # before editing
node regressao.mjs snap <url> --out depois.json
node regressao.mjs diff antes.json depois.json      # also writes lado-a-lado.html
node regressao.mjs git HEAD src/screens             # nobody took a snapshot: same four, from source
```

`perdeu-contentor` (numbers in a box: -2 and -34%; or surfaces: -3 and -50%),
`perdeu-controle` (-2 and -25%), `perdeu-chip` (-2 and -50%), `perdeu-largura`
(-120px and -10% of usable). A loss can be right: `--aceito regra="why"` prints
the reason and clears it. A snapshot holds numbers only; the screenshot beside it
holds the screen. It aborts every request other than GET or HEAD.

### Not measurable: stays with the eye

Whether a box is earning its place, whether the void is a decision, whether a chip
tells the truth, whether the drawn fact is the right one. A zero says nothing was
measured as lost, not that the screen is good.

Locked in `scripts/fixtures/tela/` by `tela-self-test.mjs`.

### Calibration

2026-11-05, Chrome, read-only, after scrolling to the end.

| Run | Pages | Result |
|---|---|---|
| Default, 1440 and 1920 | linear.app, linear.app/pricing, stripe.com, stripe.com/pricing, vercel.com, vercel.com/docs, npm package page, ui.shadcn.com/examples (dashboard, tasks, mail), GitHub issue list, githubstatus.com | zero (9 of the 13 count as showcases, so this zero is partly scope) |
| Default | news.ycombinator.com | 1 known false positive, kept: `texto-demais`. The measure is true; the site is text by design |
| All rules forced, 1440 | shadcn examples, GitHub issue list, npm, vercel docs, stripe.com, githubstatus.com | zero: the real test |
| All rules forced, 1440 | linear.app | 25 on its drawn product UI (`parece-clicavel` 23): why showcases exist |
| Default, logged in, 1920 only | three screens of an agent console already rebuilt with boxes | zero; with surfaces stripped by CSS, `sem-ponto-de-entrada` and `tudo-igual` fire |

What it changed: showcase scope (linear.app's 23 "dead buttons"); side columns
inside `<main>` (a 248px "void"); sr-only text (GitHub's "unread" on every row);
words inside a running line are not labels ("opened"); a row with a chart labels an
axis ("90 days ago"); a centered column also needs to be under 800px
(githubstatus.com at 1920); a caption under a real tile is detail; links do not
count as reading (Hacker News). Most rules have only fired in fixtures so far: no
real bad screen was available to measure, only the synthetic reproduction.

**Any brand, any language.** `tela-self-test` runs the bad and good pair in light, monochrome, serif with square corners, Spanish, German, Arabic right to left and Japanese. The rules read structure, contrast and locale, not one look. Two rules read words (`acao-virou-texto`, `estado-so-texto`), with lists for pt, en, es, fr, de, it; outside them the output says so instead of a clean zero. `regressao git` is a source heuristic for React, Vue, Angular and plain CSS; another stack gets fewer matches, so prefer `snap`.

**Real bad screen (2026-11-05, 1920, logged in, read-only).** The same admin app in three commits: before the cleanup, the version the owner rejected, and the one rebuilt from his feedback.

| Screen | Before | Rejected | Rebuilt |
|---|---|---|---|
| Costs | 0 | `vazio-lateral`, `metrica-sem-destaque`, `numeros-em-frase` | 0 |
| Health | `legenda-em-toda-linha`, `icones-decorativos` | those two, `vazio-lateral`, `estado-so-icone` | 0 |
| Memory | 0 | `vazio-lateral`, `numeros-em-frase` | 0 |
| Security | not measured | `estado-so-icone`, `rotulo-repetido`, `nomes-tecnicos`, `pilha-de-selos`, `icones-decorativos` | `rotulo-repetido` |

`regressao` before against rejected: `perdeu-contentor` and `perdeu-largura` on Costs and Memory, `perdeu-chip` and `perdeu-largura` on Health. Before against rebuilt: nothing on Health and Memory; on Costs, `perdeu-contentor` (24 to 11), because a prices table moved behind a disclosure. A real cut, so `--aceito` with the reason is the right exit. Two readings the owner made by eye match the rules: the old Health's redundancy, and Security's wall of tool names. Not measured here: 1440 and phone width, `regressao snap` with `--storage`.

**Other languages and sites, default rules, 1440 (2026-11-05, read-only).** Zero: shadcn examples, githubstatus, npm, Vercel docs, es.wikipedia, spiegel.de. Candidates, kept and not tuned away: GitHub's public issue list `legenda-em-toda-linha`, rakuten.co.jp `metrica-sem-destaque`, Hacker News `sem-ponto-de-entrada`. A finding is a candidate: a dense site can be dense by decision.
