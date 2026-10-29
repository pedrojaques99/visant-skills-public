---
name: visant-frontend
description: 'visant-killer sub-skill: frontend decision system where every interface choice names the business variable it moves; the required deliverable is the route classification table. Use on "redesign this screen", "critique this UI", "visual hierarchy", "redesenhar tela", "criticar interface", "hierarquia visual", "cortar excesso", "empty state".'
---

# Visant Frontend

A decision system for product interfaces, in any repo. The rule that generates
every other rule:

> **A design choice only ships if it names the business variable it moves.**
> If it moves nothing, it is decoration, and decoration costs attention.

## Inherited constraints (read before anything else)

This skill extends **[revenue-centric-design](https://github.com/heliocosta-dev/revenue-centric-design)**
by Richard ([@richardrx](https://x.com/richardrx)), 101 principles on conversion,
activation, retention, pricing, and behavioral science, distilled with the
author's permission. That skill owns **persuasion mechanics**; this one owns the
**product interior and the build**. Where both apply, cite the RCD principle by
name and add the Visant-specific move.

> **Do not apply either skill to betting, casino, gambling, or real-money
> games-of-chance products.** This is a hard condition of the source author's
> reuse permission, not a stylistic preference. Decline and explain.

**Never modify the revenue-centric-design skill.** Reference it; do not edit it.

### The craft layer lives next door

**`visant-refine`** owns the elements this skill does not draw: charts, limit
meters, simulation sliders, gauges, sparklines, delta badges, metric tiles, and
the motion that carries a data change. The split is strict and load-bearing:

> **This skill decides IF the element exists and what variable it moves.**
> **`visant-refine` decides HOW it is drawn, and that every such element on the
> screen reads as one family.**

Load `visant-refine` whenever the ask is "add a chart", "show the limit", "make it
feel designed", "burilar", a slider that projects a scenario, or intelligent
animation. It defers to `dataviz` for chart correctness and to `visant-motion` for
the easing/duration SSoT, and it never justifies an element. If the *cut test*
below produces silence, the fix is deletion, not refinement: a beautiful chart of
a datum nobody uses is slop with better finishing, and it costs more attention
than the ugly version.

## Step 0: classify the surface (a written table, before any fix)

**This step's deliverable is a table on disk, not a conclusion in your head.**
A question has no exit code: when this step ended in one, a round with every
linter at zero was called a complete pass and skipped classification entirely.

```bash
K=~/.claude/skills/visant-killer/scripts/killer-scan.mjs
node $K --init-report AUDIT.md <target>   # one pre-filled row per route
# fill the table, THEN fix anything
node $K --report AUDIT.md <target>
```

`killer-scan` refuses to print "portão aberto" (gate open) without that table,
and rejects a row whose business-variable column is blank, `-`, or "TBD".
Classifying *after* you've edited isn't classifying, it's justifying.

**If the script isn't at that path, the step is still mandatory.** It is a
convenience, not the reason for the step. Check with
`ls ~/.claude/skills/visant-killer/scripts/killer-scan.mjs`; if it's missing
(repo not linked, skill installed alone, client environment), **write the table
by hand** in the project's `.md`, same columns: route, class, business variable,
what persuasion is there. One row per route, variable column never empty. A
gate whose tool vanished is not a license to skip; it becomes manual work.

Applying one surface's instincts to another is the most expensive frontend
error. Classify first; the rules follow from the class.

| Class | Revenue variable | Examples | Persuasion is | Read |
|---|---|---|---|---|
| **A. Acquisition** | conversion rate | client sites, landing, pricing, onboarding, upgrade prompts | **the job**: a hero has work to do | [acquisition-surface.md](references/acquisition-surface.md) |
| **B. Work** | throughput × decision quality | lead queues, kanban, editors, session runners, admin | **noise**: every px of chrome is one less item on screen | [work-surface.md](references/work-surface.md) |
| **C. Trust** | retention / money not lost | billing, destructive actions, data writes, settings | **irrelevant**: reversibility and correctness rule | [trust-surface.md](references/trust-surface.md) |

Classic failure: a gradient hero band on a work queue. It is right on `/pricing`
and wrong on `/leads`, same component, opposite verdict.

When a screen mixes classes, classify **per region**, not per page. A billing row
inside a settings page is C even though the page is B.

## The spine

Twelve principles. Each names its variable. RCD lineage marked where it exists.

1. **Classify before you design.** The surface class determines which rules
   apply. Skipping this produces confident, wrong work. → *all*

2. **Neutrality is omission, inside too.** One primary action per surface. The
   datum that drives the decision gets the most typographic weight. **A disabled
   primary button is a lie**: replace it with quiet text or a different
   affordance. *(RCD 1)* → *conversion, throughput*

3. **Weight is contextual, not intrinsic.** The same datum earns different weight
   on different surfaces, depending on whether the user is **choosing** or
   **processing**. A score is the scan axis in a grid and mere context in an
   already-ordered queue. → *decision quality*

4. **The default is the strategy you shipped.** A default sort, filter, or plan
   is a recommendation with your name on it. Make it good, and make its rule
   legible in one line where the user picks it. *(RCD 6)* → *decision quality*

5. **Zero is not information.** A metric reading zero does not render. Neither
   does a status badge that 100% of rows carry. → *density*

6. **Chrome is a budget.** Count vertical pixels before the first item of real
   content. Spend generously inside the content; pay for it by cutting chrome,
   not by cutting content. → *throughput*

7. **Hover reveals; hover never relayouts.** Reserve the space permanently, float
   the revealed control over it. Nothing revealed only on hover may be the sole
   path to an action: `focus-visible` reaches everything. → *throughput, a11y*

8. **Retention is built in the interior.** *(RCD 7)* RCD stops at the cancellation
   flow; retention is actually earned on the screen the user stares at daily.
   Keyboard, latency, and rhythm are retention features. → *retention*

9. **Your UI must not lie to your database.** An optimistic write that records an
   action which did not happen corrupts the metric you steer by. Data integrity
   is a revenue rule, not a correctness footnote: you cannot optimize a number
   you are falsifying. → *every variable*

10. **Absence is an argument.** An empty state can be the pitch. Before adding a
    visual element, ask **where it will be missing**, not what it costs:
    coverage beats cost. An element absent exactly on your best records is worse
    than no element. *(RCD 4)* → *conversion*

11. **Find the optimal play.** Model the user's best move and check whether it
    pays you. *(A real case of this shape: a product whose optimal user play was
    zero revenue; every rule worked, the combination leaked. See
    acquisition-surface.md.)* → *monetization*

12. **Four layers, one sentence.** Landing, onboarding, product, and pricing must
    say the same thing. Misalignment here makes every downstream design decision
    unwinnable. → *all*

### The cut test

Before shipping a rule, a component, or a pixel, name its variable. No variable
named → it does not ship. Apply this to your own recommendations too.

## Non-negotiables

- **No new design-system components without explicit approval.** Reuse and
  parameterize. When a piece is genuinely missing, look first in the Visant
  library ([ui.visantlabs.com](https://ui.visantlabs.com/llms.txt): 150+ pieces
  already refined and audited, e.g. `empty-state`, `segmented-control`,
  `data-table`, `side-nav`, `billing-toggle`, `cta-surface`), then the official
  primitive (`npx shadcn@latest add …` or the Radix package); never hand-roll
  it. Both install the same way (`npx shadcn@latest add @visant/<name>` with
  `"@visant": "https://ui.visantlabs.com/r/{name}.json"` in `components.json`).
  State what you are adding and why before adding it.
- **Optional field starts collapsed, behind a button.** Always. A field drawn in
  full (label, border, height) *says* "fill me in". When it is optional that
  claim is false, and the cost is paid in reading time by every person who has to
  decide and then decline. Render a ghost `+ <Noun>` button; expand on click.
  Two rules make it safe: it **auto-expands when it already has content** (a
  filled field hidden reads as data loss), and the button names the *noun*, not
  the action. Same cut as "dead controls don't render", one step earlier: the
  form should show exactly what it demands. *(spine 2, 5)* → *completion rate*
- **Verify before acting on a claim.** Read the code and confirm a reported defect
  is real before refactoring around it. Diagnose with `file:line`: evidence, not
  opinion.
- **Typecheck and build must pass before calling anything done.** See
  [verification.md](references/verification.md).
- **Run the design detector before opening the screen.** `npx impeccable detect
  <source dirs>` front-loads the generic-AI tells (gradient text, purple
  gradients, bounce easing, accent-on-rounded, broken images). Triage findings at
  `file:line`: it is a curator, not an oracle. It complements the repo's own
  design audit script, if it has one (look in `package.json` for something like
  `audit:design`), not replaces it. See [verification.md](references/verification.md).
- **Measure the narrow viewport; never judge it by eye.** Any surface a phone can
  reach gets `documentElement.scrollWidth − innerWidth` measured at 390px with
  real data. Positive is a defect, and **re-measure after each fix**: responsive
  changes trade one overflow for another. See [verification.md](references/verification.md).
- **Report faithfully.** Say what was not verified. A screen that compiles is not
  a screen anyone has seen.

### The default path in the target repo

Every product with a design system has pieces that keep getting rewritten by
hand: a media card, a segmented control, a modal, the primary action, an upload
area. Using the piece is the rule; rewriting it by hand is the defect the killer
looks for (`slop-catalog` 24 to 26 and 33). Before writing any of those:

1. **Find where the DS lives.** Look for `components/ui/`, `src/components/ui/`,
   a `components.json`, a catalog/design-system page (grep for `DesignSystem`,
   `Storybook`, `*.stories.tsx`).
2. **List the pieces and their props** for card, selector, dialog, button
   variants and dropzone. Missing a variant: parameterize the piece (with
   approval), don't copy its markup out.
3. **Find the chrome tokens**: radius scale, font weights, how raw opacity
   (`white/NN`) maps to tokens, and whether an always-dark editor declares
   `.dark` on its root.

Three rules that break most often, in any DS:

- **Radius has few names**, one per level (e.g. control / surface / pill). Don't
  reintroduce in-between sizes.
- **Weight:** `semibold` only on the region's main title and on a highlight
  number; the rest of the chrome is `medium`. Raw opacity becomes a token.
- **An always-dark editor declares `dark` on its root and uses tokens.** A fixed
  neutral (`bg-neutral-950`, `neutral-800`) with tokens inside breaks in light
  theme.

A filled-in example of this contract, from one real app:
[ds-visantlabs-os.md](references/ds-visantlabs-os.md). Optional reading; build
the equivalent for the repo you're in.

### Verified in production

Real cases that confirm the spine, each with the variable it protects:
**[19 cases in references/verified-production.md](references/verified-production.md)**.

The four that repeat most: a price written in copy is a claim about the
database; role says *can see*, ownership says *whose action it is*; silent-empty
is the dominant lie and it is almost always told one layer down; and two numbers
in different units side by side with no label corrupt the reading.

## Navigation

| Working on… | Read |
|---|---|
| Queues, lists, editors, dashboards, admin, keyboard flow | [work-surface.md](references/work-surface.md) |
| Inspector, editor sidebar, settings panel (which control for which data) | [work-surface.md](references/work-surface.md) "A control takes the shape of its data", then `visant-refine` control-panels.md |
| Forms and dialogs: decluttering fields, what to do when the screen refuses | [work-surface.md](references/work-surface.md), sections "Forms: an empty field is not a field" and "What the screen says when it refuses" |
| Client sites, landing, onboarding, pricing, upgrade paths | [acquisition-surface.md](references/acquisition-surface.md) |
| Billing, destructive actions, data writes, confirmations | [trust-surface.md](references/trust-surface.md) |
| Component library / registry showcase / demo of a piece / kits (the piece IS the product) | [component-showcase.md](references/component-showcase.md) |
| Implementation in Tailwind v4 + React + Radix | [stack-tailwind-react.md](references/stack-tailwind-react.md) |
| An example DS contract (pieces, chrome tokens, always-dark editor) | [ds-visantlabs-os.md](references/ds-visantlabs-os.md) |
| Charts, limit meters, simulation sliders, crafted elements, motion on a data change | load the **`visant-refine`** skill |
| Checking the work; height budget; keyboard audit; design detector | [verification.md](references/verification.md) |
| Running or writing a design critique | [critique.md](references/critique.md) |

For persuasion mechanics on acquisition surfaces (awareness levels, decoy
effect, GBB pricing, social proof, trial design), load the
`revenue-centric-design` skill and cite the named lever.
