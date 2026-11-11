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

## "Limpo até demais"

An agent applied these skills to an agent console and took out too much: costs
lost every card, six number tiles became a sentence, a per-row "Ok" became a grey
icon, a fixed max-width left a void. The detectors said zero, and that was the bug:
they only punish what is left over, so the score rises as the screen empties. The
owner: "too clean", "no room to breathe", "full of text". Two rules
were read past their scope ("depth by line" on a dashboard, "cards in cards" as
"cards are bad"). `tela-scan.js` and `regressao.mjs` came from it, and so did the
rule above the score: before and after side by side, shown to the owner.

## Lost its soul

The second over-clean round, and the reason the fix had to change shape. Tucano
(a desktop app for teams of AI agents, 2026-11-11) had a first run with its own
childish theme: blobs, floating faces, fake chips, rounded 900-weight type. The
first pass followed these skills and removed every tell. The detectors went to
zero, and the owner said: "perdeu a alma, ficou sem vida" (it lost its soul, it
has no life). The previous case had already added `tela-scan`, `regressao` and
the before-and-after rule, and all three can only say what was lost after the
fact. Nothing said where to spend before cutting, so every screen got the same
treatment: clean.

The second pass put the life back from the brand's own assets. Each change
became a rule:

| Owner's correction | What changed | Rule |
|---|---|---|
| the hero was only the logo, big | the agent team perched on the toucan's beak, a status walking through their work until "Posso enviar? ✓ Aprovado" | the illustration explains the feature (catalog 66) |
| the builder was a form with a little preview in the corner | canvas + deck: the agent large on its own color, the deck changing per step | the object being made is the protagonist (catalog 67) |
| "too much text" in Settings › Models was answered by removing cards | harness cards with the real logo, agents count and the plan's ring; 2628px down to 1716px | drawn facts, not fewer cards (catalog 64) |
| 1.5–2px outlines, a 2px radio ring, a 3px focus halo | 1px chrome, selection by color | `stroke-scan` (catalog 65) |
| a dot grid behind the canvas | hairline rings of presence spreading from the avatar | textures from the subject (catalog 32) |
| goals and missions in library icons in boxes | one SVG per item in the icon's idiom; presets wear their trade | thumbs when the item is something the product does |
| welcome showed every option at once | first only "I'm new" / "I already use one", then that path; back top-left, before the progress | one thing at a time (work-surface, Hiding) |
| importing from another bot lived in Settings | one `BotImport` door, on the welcome screen and in Settings | discoverability (catalog 21) |

Read by class, the same app gives an example of each kind of screen. **Shine:**
welcome, "what to delegate", the agent being born, the builder. **Alive:**
Settings › Models, the missions list, the questions card. **Sober:** connecting the
AI (keys and permission): a neutral panel, the mascot speaking as the only
personality. **Core components:** `EngineMark` (the official harness logo, one
source), `JobCard`, `QuotaRing`, and the live eye hook. Each was polished once and
spread everywhere.

What changed in the skills: the craft column and the brand moment in the
surface table (`killer-scan` rejects a `shine` row without one), the keep test
beside the cut test, a dead core costs 8 in the score, `regressao` flags lost
brand art, `stroke-scan` became a detector, and the brand idiom
([brand-idiom](../../visant-design/references/brand-idiom.md)) runs before any
cut. Process lessons from the same session: ask early with previews when the
call is the owner's, show the pair before install or push, and while iterating
run only the affected tests and the changed screen
([environment](environment.md#your-own-tools-lie-too-windows-scripts-test-doubles)).

Left out on purpose: the product finding both revenue reviews agreed on (the
agent's first message asks instead of delivering). No screen rule catches it;
it belongs to the product and copy skills.
