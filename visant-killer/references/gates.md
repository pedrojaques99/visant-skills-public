# Gates: what `killer-scan` runs, the target repo's own gates, written exceptions, CI ratchet

Detail behind Step 2 of [SKILL.md](../SKILL.md). The body keeps the procedure;
this file keeps the contracts.

## How `killer-scan` finds the token gate

Detector 2 resolves in this order and prints the source on a `via` line:

1. an npm script named `audit:design`, `lint:design`, `design:lint` or
   `lint:tokens` (not every repo names it `audit:design`; one called it
   `lint:design` and the gate said SKIPPED with 218 token findings open);
2. a scanner file: `scripts/scan-design-violations.mjs`,
   `scripts/audit-design-system.cjs`, `scripts/scan-design-tokens.mjs` (one repo
   keeps its gate as a file, and the killer used to say "skipped" with the
   scanner right next to it). Only `ERR` counts as gate; `WRN` stays judgment;
3. **the built-in fallback**, only when neither exists. Labeled
   `killer-scan built-in FALLBACK` in the output. It flags, conservatively:
   - `hex-cru`: `#abc` in `.css` declarations, and in `.tsx/.jsx` only inside an
     arbitrary class (`bg-[#1a1a2e]`) or a color string in a style context
     (`style={{ color: '#f00' }}`);
   - `rgb-hsl-cru`: `rgb(`/`rgba(`/`hsl(`/`hsla(` with a literal number
     (`hsl(var(--x))` passes);
   - `paleta-tailwind`: fixed palette classes (`text-purple-500`,
     `bg-slate-900`, `@apply text-red-500`) instead of a semantic token.

   It skips token/theme files (`tokens.*`, `theme.*`, `globals.*`,
   `palette.*`, `variables.*`, `*-theme.*`, `tailwind.config.*`, a `tokens/` or
   `theme/` folder), CSS custom-property definitions (`--x: #fff`), `:root`,
   `.dark`, `[data-theme]` and `@theme` blocks, and comments. Proven both ways
   by `killer-scan --self-test` against `scripts/fixtures/token-fallback-*`.

The run ends with one summary line, `gates: N/4 ran [...]; SKIPPED: ...`. A
skipped gate is never a pass: it goes into the report.

## Discover the target repo's gates

The four detectors are the floor, not the ceiling. Most repos carry their own
design gates, and they find things this skill cannot know about. Before
judging, list them:

```bash
# npm scripts with gate-shaped names
node -e "const s=require('./package.json').scripts||{};for(const[k,v]of Object.entries(s))if(/lint|audit|design|token|ui|theme|a11y|i18n|ratchet|check/i.test(k))console.log(k.padEnd(28),v)"
# scanner files that are not wired to npm
ls scripts/ 2>/dev/null | grep -Ei 'scan|lint|audit|design|token|ui|theme|ratchet'
```

Run what exists **on the target**, not on the whole repo (old debt drowns the
new finding). Write in the report which ones ran and which were skipped, and
why. A repo-level ratchet or CI check goes in the same list.

Example of what a mature repo exposes (a private app of the house; names are
illustrative, do not expect them elsewhere):

```bash
npm run check:ui-ratchet                     # what CI runs (see "CI ratchet")
node scripts/scan-ui-scale.mjs <target>      # micro-label, raw px, weight, radius, accent
                                             # at rest, literal hue, raw opacity
node scripts/scan-ui-slop.mjs                # cyan outside CTA, decorative mono
node scripts/scan-lightmode-breakage.mjs --summary   # what disappears in light theme
node scripts/sync-craft-tokens.mjs --check   # did the token layer reach index.css?
```

## The fourth detector: chrome noise (`ruido-scan`)

It exists because the other three look at one line at a time and none of them
adds up. The defect left over was the whole screen correct and unreadable from
supporting text: an uppercase label on every section, usage instructions next to
a control that already has affordance, the same information said in three sizes,
the word "add" repeated once per list item. Each line alone is defensible, which
is why it passes everything. Catalog entry: [slop-catalog.md](slop-catalog.md)
item 20 ("the page that explains itself"); procedure in any repo, English or
not, no house tokens: [declutter.md](declutter.md).

**Of its fifteen rules, nine are not about text.** Three came from a panel that
passed the four detectors, `tsc`, a UI audit and 2347 tests:

- `realce-que-nao-decide`: a hand-written highlight (`on: true`) inside an item
  factory. It runs once per item, the whole list lights up, and the screen's
  only emphasis is spent on a fact a badge already told.
- `porta-repetida`: **the rule that does not fit in one file.** The same data
  door (a field with `placeholder`) in two components **of the same screen**:
  people choose by luck. "Same screen" means a common ancestor up to two levels
  up in the import graph (`grafo.mjs`), no lazy `import()`, no router/barrel as
  parent, and no early `return` or ternary separating the two sides; `common.*`
  keys are left out. The first version gave 25 findings, almost all false; now 2
  real. The finding points at both ends. **Form 2** (one name for different
  things on different screens) left the detector and went back to judgment: it
  is vocabulary, see `slop-catalog.md` item 21.
- `icone-desenhado-a-mao`: what a library import would replace.

Six more were all seen **by opening the screen** after the detectors went
green. One line of reason each; the full case is in the catalog.

| Rule | Catches | Why |
|---|---|---|
| `capa-sintetica` | hue from a hash of the name, data colors turned into a gradient next to a missing image | an invented cover looks like data and means nothing (catalog 24) |
| `img-de-tile-sem-onerror` | `<img>` with `object-cover`/`aspect-*` and no `onError` | a broken URL becomes a split icon or an eternal blur; 128 dead refs on one route (25) |
| `cascata-por-indice` | `delay`/`animationDelay` = `index * ...` | the 30th item waits 1.5s on every filter (30) |
| `hover-que-levanta` | `hover:-translate-y-*`, `hover:scale` > 1, `whileHover` with `y<0` | 26 admin cards jumping; it does not exist on touch (31) |
| `grade-de-pontos` | repeated `radial-gradient`, SVG of circles, `<GridDots>` | template texture; it lived in the page shell and shipped on every route (32) |
| `blur-em-card` | `backdrop-blur` on an in-flow element | with nothing behind it blurs nothing, it only costs GPU (18) |

- **Its finding is a cut candidate, not an automatic fix.** One of those lines
  may be the only one that really guides. Confirm at `file:line`.
- **The exception exists and must justify itself** (format below). A gesture
  with no native affordance (keyboard modifier, window resize) is the most common
  legitimate exception; the other is the static detector that cannot see a
  runtime swap (`porta-repetida` with a composer that disappears when the chat
  panel is open).

## Written exception: one contract, every scanner

A legitimate line is released with a comment **on the same line or up to 8
above**, naming scope and rule, with a reason. A mute allowlist is forbidden.

| Scanner | Line | Whole file | Rules |
|---|---|---|---|
| `ruido-scan` (this skill) | `EXCEPTION to ruido-scan/<rule>: reason` | `// noise-ignore-file: <rule>, reason` | the 15 in the script (`ensina-a-usar`, `porta-repetida`, `blur-em-card`...) |
| token fallback (this skill) | `EXCEPTION to token-fallback/<rule>: reason` | none (rename to a theme file if the whole file is tokens) | `hex-cru`, `rgb-hsl-cru`, `paleta-tailwind` |
| repo `scan-ui-slop` | `EXCEÇÃO ao ui-slop/<rule>: reason` (accepts `ruido-scan/<rule>`) | none | `cyan` or `cyan-non-cta`, `mono` or `mono-uppercase` |
| repo `scan-ui-scale` | `EXCEÇÃO ao ui-scale/<rule>: reason` | `// ui-scale-ignore-file: <rule> — reason` | `micro-label`, `px-cru`, `peso-pesado`, `raio-sortido`, `accent-repouso`, `matiz-cru`, `opacidade-cru` |
| repo `scan-design-violations` | `EXCEÇÃO ao audit:design/<rule>: reason` | `// audit:design-ignore-file: <rule> — reason` | the rule `id` in the script |
| repo `scan-lightmode-breakage` | `EXCEÇÃO ao lightmode/<rule>: reason` | `// lightmode-ignore-file: <rule> — reason` | `dark-surface-no-token`, `light-only-text`, `dark-only-border` |

In the repo scanners' whole-file form the dash is literal syntax those scripts
parse; keep it as written.

This skill's own scanners (`ruido-scan`, token fallback) accept `EXCEPTION to`
and the original Portuguese `EXCEÇÃO ao` (`EXCECAO` without accents also
counts), and `ruido-ignore-file:` as well as `noise-ignore-file:`, so markers
already written keep working. The repo scanners in the last four rows match only
`EXCEÇÃO ao`, so there it stays in Portuguese.

```tsx
{/* EXCEÇÃO ao ui-scale/opacidade-cru: scrim over the customer photo */}
<div className="absolute inset-0 bg-black/60" />
```

- **Exact name, right scope.** `ui-scale/peso` does not release `peso-pesado`,
  and `ui-slop/opacidade-cru` does not release `ui-scale`. A line two scanners
  flag takes two comments (scrim with `text-white`: `ui-scale/opacidade-cru` and
  `lightmode/light-only-text`).
- **A real reason:** at least 8 letters, may continue on the next comment line.
  An exception below the finding does not count. `ruido-scan` checks only the
  word and the rule name; the reason is still mandatory by contract.
- **`--fix` never touches an excepted line** (`scan-design-violations`).
- The contract is locked in `--self-test` in the repo's scripts that implement
  it.
- The **copy** gate has no per-line exception: only `.killer-voice.json` at the
  target root, `{"dispensa":["bolinha"],"motivo":"..."}`, a reason of 40+
  characters, and only delimiter rules (`bolinha`, `travessao`,
  `pipe-separador`, `hifen-como-travessao`).
- A light-mode scanner may also suppress files that declare a loose `dark`
  class (always-dark stage) and editor folders. The dark-editor rule for the
  house app is in `visant-frontend/references/ds-visantlabs-os.md`.

## CI ratchet

Pattern for a repo that has more debt than one round can clear: CI compares the
app total of each scanner with a committed baseline and fails if any total goes
up. In the house app, `npm run check:ui-ratchet` runs in
`.github/workflows/test.yml`: the `scan-ui-slop` self-test, `check:ui-slop`,
`check:ui-scale` and `i18n:check --strict`, against
`scripts/.ui-slop-baseline.json` and `scripts/.ui-scale-baseline.json`.

When to re-record (`--save-baseline` on each scanner):

- **Only when the total dropped.** `--check` says so ("improved; run
  --save-baseline to tighten"). Re-record in the same commit as the cleanup,
  otherwise the slack becomes room for regression.
- **Never to absorb a rise.** A total that went up is fixed in code or with a
  written exception. Re-recording over it is `audit-ignore` under another name.
- **Measure the whole app**, never combined with `--page` or a target. With
  parallel agents, re-record once, by whoever closes the round, after the edits.

## How `--roots` ranks

It joins findings from every detector by the file they live in and keeps only
**shared** pieces (`components/ui`, `components/shared`, `lib/ui`, or imported
by 5+ files), sorted by `fan-out × findings`. Fan-out comes from `grafo.mjs`
(who imports whom, no dependencies, tsconfig aliases resolved) and is measured
over the whole project, not the slice: the screen that inherits the defect may
be outside the target. Shows 15; `--all` lists everything.

## What `--init-report` writes

One row **per route**, read from the router (a real page, not a component file;
a redirect leaves the table and becomes a note), with the **Shell** column
suggested from `navConfig` (whoever mentions the path). Shell is a hint, not a
classification: confirm it. A repo without a readable router falls back to one
row per UI file. The table header is read by name (`surface`/`superfície`,
`variable`/`variável`, `route`/`rota`, `file`/`arquivo`), and the seen-screens
section must keep the heading `## Screen seen` (or the older `## Tela vista`),
which the script parses.
