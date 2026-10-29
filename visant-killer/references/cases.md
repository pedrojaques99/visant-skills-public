# Cases behind the rules

The [SKILL.md](../SKILL.md) body keeps each rule with one line of why. This is
the longer story of where each one came from, kept so nobody "simplifies" a
rule back into the bug it fixed. Every case here really happened in an audit
round; none is illustrative.

## A green gate is not a seen screen

A frozen `AnimatePresence` in a lead-capture form passed `tsc`, ESLint,
`motion-lint`, `impeccable`, the token gate and `copy-lint`. The step was stuck
and nobody had opened the screen. Six green gates, one broken funnel: the
difference between that round and a good one was not another detector, it was
having looked. That is why `killer-scan` cannot say "gate open" without the
surface table and the `## Screen seen` section.

## Report first, detectors second

In one round someone ran `motion-lint` and `refine-scan`, saw both at zero and
called it a full pass, skipping `visant-frontend` without noticing. It was not
carelessness. Detectors end in a script, and a script feels like completion;
classifying surfaces ended in a question, which has no exit code. Agents always
gravitate to what closes at zero. Hence `--init-report` before any fix.

## Root first

In a 455-file round the biggest wins were containers, not leaves: a page shell
with a dot grid, a glass panel with blur by default, mono and English baked into
`CardDescription` / `EmptyState` / `StatusBadge`, and a thumbnail that
collapsed. Those were fixed **after** dozens of screens, one by one; fixing the
shared piece first would have cleared about half the findings at once. Hence
`--roots`.

## Hover that runs over the neighbor

Measured on a client page: a `w-4` stroke scaling 2.5x inside a flex row slid
under the label next to it. Hover reveals; hover does not run over things.

## The word cut by a parent

A screenshot showed **"tirar da"** inside a card: half of "tirar da fila",
clipped by `overflow: hidden` on a 96px card with `white-space: nowrap`. No line
was wrong in any file; the cut only exists after the font loads. This created
both the `nowrap` prohibition and `corta-scan.js`.

The first `corta-scan` flagged eleven lines of a scrolled list, with the
"eaten" amount growing in arithmetic progression: the signature of a defect in
the rule, not the screen. It now separates scroll, ellipsis/`line-clamp` and a
horizontal rail from a real cut. And a small badge (< 25% of the area) over an
`inset-0` background with nothing interactive is not a stacked overlay (a
"Pública" badge over a brand card cover). All locked in
`scripts/fixtures/clip-cases.html`.

## Noisy gate on legacy code

On new, uniform code the gate gets almost everything right. On legacy code one
real round produced **6 false positives in 12 findings**: a `prev.year - 1`
read as an em-dash, a type signature, a `;` that belonged to `&quot;`. Fixing
without reading the line is writing bugs with the detector's blessing.

## Loading skills from memory

In one round, whoever tried to load all four judgment skills loaded three and
used `revenue-centric-design` from memory. Skill memory is not the skill. Hence
loading by tier, and writing down what was not loaded.

## The paid route

Opening a naming route on the real database charged and refunded credits: a
session saved in the `deck` phase with an empty deck fires the paid generation
on mount. Hence the two layers in `verify-screens.mjs`: `--skip-paid` routes
never open, and every POST to a paid endpoint is aborted in the browser and shows
up as `PAID-BLOCKED`.

## Copy hidden in a `.ts` lib

A classifier in a lib returned `reason: "proporção casa com a superfície — preenche
sem cortar"`, with an em-dash, and the render panel passed that string straight
to the user. The copy gate said zero because it only read `.tsx`. The extractor
now reads copy-bearing props in `.ts` too.

## The detector that said "skipped" next to the scanner

One repo named its token gate `lint:design`; another kept it as a file,
`scripts/scan-design-violations.mjs`. In both cases `killer-scan` printed
SKIPPED with the scanner right there: a silent skip read as a pass. The fix was
aliases first, then the file lookup, and now a built-in fallback so no repo ends
up with zero token check.

## Dev server lying

In a real session half the initial findings came from the environment: a route
compiling for 115s, partial hydration read as a bug, CDP cutting off at 45s. See
[environment.md](environment.md).

## "Does it fix the crazy spacing?"

A question under the repo's launch post (2026-10-29), and the honest answer was
"only by judgment": catalog 6 and question F2, no detector. `ritmo-scan.js` was
built for it, and its first version made the classic mistake: it also judged
values off the grid at runtime, and returned 29 on linear.app and 27 on
stripe.com, pages that are on the grid (7px + 1px of border is 8; optical
padding; `auto` margins computed to px). That rule left for the source linters
that already exist. The grouping rules were narrowed by the same calibration
(vertical text stacks, component scale, `aria-hidden` out) until the three
reference sites gave zero, and the first real finding was on the house's own
landing: a CTA with `mt-1` patching a `gap-7`.
