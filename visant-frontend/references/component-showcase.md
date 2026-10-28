# Component showcase (library, registry, showcase)

The surface where the piece IS the product: a component library catalog (the
Visant one is `@visant/ui` at [ui.visantlabs.com](https://ui.visantlabs.com)),
the page of one piece, the demo of a kit. Distilled from ~100 bug reports filed
while opening the showcase piece by piece. Each rule below came from a report
that repeated across several pieces, so treat it as a pattern, not taste.

There is one business variable here: **the person understands the piece in 2
seconds and wants to install it.** Anything that competes with the piece for
attention loses.

## 1. The demo shows the piece, it doesn't talk about it

Most repeated report: "badly presented", "focus on the component", "too many labels".

- **The piece large, centered, in a minimal and believable context.** No fake
  navbar, no "Briefing" card around it, no invented toolbar, no "hover me" or
  "click to see" caption, no example counter. If the piece needs instructions
  to be understood, the fix is in its affordance.
- **One at a time.** Variations stacked side by side (4 skeletons, 6 loaders, 3
  toggles) squeeze each other and none shows. Show ONE, large, with a discreet
  selector (small text or arrows) that switches and replays the animation.
- **Born in its best state.** Gleam, perspective, open menu, expanded island:
  the piece already appears doing what it does. A good state hidden behind
  hover doesn't exist in the tile, on touch, or in a screenshot.
- **Demo controls collapsed by default.** Knobs live in the piece's side panel;
  on the piece itself, at most a quiet selector.
- **The secondary control is quieter than the piece.** A mode selector becomes
  small text at the foot, no box, no brand color. If the eye goes to the
  selector first ("Call / Timer / Music"), the hierarchy is inverted.
- **Conditional label.** Text that only makes sense with a state appears with
  the state ("Delete 3" only exists when 3 are selected).
- **Agnostic text.** Demo copy is generic and short, in plain spoken language.
  Never a client's name, slogan, product or theme (a library sells to every
  client; a whole library once had to be swept for this).
- **No toggle with an instruction label.** "Show mode X" next to a switch is
  documentation on screen. Modes go to the knobs or become one-at-a-time
  variations.

## 2. A variation is a prop, not a new piece

Requests like "make variations", "more layout options", "transition options":
the answer is a prop (`variant`, `layout`, `transition`, `motion`, `animation`)
with 3–5 named values, backward compatible with the old default, and the demo
showing one at a time. A new piece only when the gesture is different.

## 3. The stage lies: scale, clipping and focus

A showcase usually draws the piece at natural size and applies
`transform: scale` to fit the tile. That breaks things that work on a normal
page:

| Symptom | Cause | Fix |
|---|---|---|
| dot/cursor far from the pointer | `position: fixed` measures from the transformed box | portal to `body`, mounted only while the pointer is on the demo |
| drag moves more/less than the finger | pointer delta in screen px | divide by the scale (`offsetWidth / rect.width`) |
| 3D canvas skewed or in a corner | R3F/three measuring the already-scaled size | `resize={{ offsetSize: true }}`; measure the container, not the window |
| menu/select clipped when opening | dropdown inside `overflow:hidden` / `contain: paint` | portal (Radix `Portal`) or a demo box sized for the open menu |
| piece "cutting its edges" | `preview` (natural box) smaller than the piece | the box measures the piece + breathing room |
| focus ring clipped | the piece's mask/overflow | room for the ring, focus via `box-shadow: var(--focus)` |

Gate: if the showcase repo has stage checks (centering/overflow, and click,
keyboard, drag and focus measured in pixels), run them over the whole catalog.
In the Visant library they are `palco-check` and `interacao-check`.

## 4. The shell disappears, the brand shows

- The shell (header, grid, filters) reads only the house tokens; the client's
  brand paints only the stage. A themed piece (a vintage kit) still respects
  the brand where it is stroke/accent (`--brand` on border, curve, background;
  never on text).
- **Thin scrollbar in the line color**, declared at the root (`:root {
  scrollbar-width: thin; scrollbar-color: … }`). The system default is the
  brightest thing on screen in dark theme.
- **A list never scrolls sideways.** `overflow-x: hidden`, columns that
  truncate, and the common datum ("Component" on every row) disappears: only
  what departs from the default announces itself.
- **Everything clickable has `cursor: pointer`; anything draggable,
  `grab`/`grabbing`.** Tailwind v4's preflight leaves `button` at
  `cursor: default`.

## 5. Taxonomy by what the piece is

A category in internal jargon ("Acquisition", "Work surface") doesn't say where
to find a slider. Group by what the thing IS (Controls, Data, Navigation,
Cards, Feedback, Sections, Media, Text, Effects, 3D, Shaders…), keep aliases
for old names in the route, and hide empty categories. The type axis also
speaks plain language (Component, Full section, Utility, Hook, Theme), not
`ui/block/lib`.

In the grid, prefer **a density button** (large/medium/small cards, remembered
between visits) over a list mode: the showcase sells a live piece, and a
description row with no stage sells nothing.

## 6. Kits: a mock product, not documentation

A kit (several pieces together) looks like a real product in an app or browser
window: a task app with rich data, an end-to-end studio site, a studio rack, a
living brand book. Zero technical labels per fold ("01 font", "Fold 3"). The
pieces reveal themselves through an **inspection layer**: hover (and focus, and
a "Show pieces" on touch) lights up the region and shows the names with a link
to the piece page and a copy of the `add` command. One primitive, reused in
every room.

And **one focus of motion at a time**: a screen with a queue, images arriving,
an export with %, an error and a toast all animating together reads as "too
much squeezed in, happening at once". Sequence the states.

## 7. The review loop with whoever curates the library

- **Bug reports from the showcase** (a button on the tile in dev, appending to a
  reports file) and **curation** (1–5 score + comment on the piece page; a low
  score archives it from the showcase, a hard delete goes through a script with
  dry-run). The curator reads the library piece by piece and leaves short
  sentences; treat each one as truth about what they saw.
- Group reports by area and give each agent files that don't overlap; shared
  files (catalog, registry) stay with whoever orchestrates.
- Close each report by script (e.g. `npm run bugs -- --resolve <id>`, if the
  repo has it) only after seeing the piece again.
