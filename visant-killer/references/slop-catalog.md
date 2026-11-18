# Catalog of slop that gets past the linter

Marks of AI-written interfaces that no detector catches, because the defect is a
decision and not syntax. All of them seen in production at Visant. Each entry:
symptom, fix, test, detector. Causes and real cases live in
[cases.md](cases.md#catalog-case-notes), optional context, never required reading.

Ordered by frequency. The first six show up in almost every card an AI writes
unsupervised.

## 1. Rainbow card

**Symptom.** In a calculation breakdown, every figure painted: revenue green, tax
red, base white, exemption purple.
**Fix.** Color is the exception. One neutral for everything, and color only where
there is a real exception (limit exceeded, negative balance, overdue deadline).
Cash outflow is marked by the typographic minus (`− R$`), the close of a block by
font weight.
**Test.** If more than two hues appear in the same block of numbers, none of them
means anything.

## 2. Money in `font-mono`

**Symptom.** `font-mono tabular-nums` on a currency figure.
**Fix.** `tabular-nums` alone. Mono is for serials, hashes, IDs and code.

## 3. Spinner instead of skeleton

**Symptom.** A centered `<Loader2 className="animate-spin" />`, and the card
collapses to 40px tall while loading.
**Fix.** Static structure paints, only the data blurs. Label, rule and title
stay; the value becomes a `Skeleton` of roughly its width. No layout jump.

## 4. Title that repeats the chrome

**Symptom.** The page `h1` says "Resumo Fiscal", the filter says "2026", and the
card repeats "MEI — Resumo Fiscal 2026".
**Fix.** The card names what it adds ("Cenário MEI"), and the qualifier (year,
regime, base) goes once, quietly, on the right.

## 5. Duplicated data inside the same card

**Symptom.** "Faturamento R$ 222.430,91" at the top and "Receita bruta R$
222.430,91" ten lines below.
**Fix.** The value appears once, in the block where it decides something. In the
others it is a reference and goes, or becomes a caption.

## 6. Uniform spacing

**Symptom.** `space-y-4` on everything, or a rule between every pair of lines.
**Fix.** Space is what groups. Tight inside a block, open between blocks, and a
rule only at a block boundary. Each level at least 2× the one inside it
(8 / 16 / 32), and a card does not need it: the box already groups.
**The four faces:** inverted proximity (more space inside a group than between
groups), flat rhythm (the same gap on three levels), drifting siblings (one card
with `p-5` among `p-6`, an `mt-1` patching a `gap-7`), and a value off the scale
(`p-[13px]`).
**Detector.** The first three: `ritmo-scan.js` in the browser (`ritmo()`, or the
`spacing` line of `verify-screens` and `corta-url`). The fourth lives in the
source, and the repo's scale linter owns it
([gates.md](gates.md#spacing-two-layers)).

## 7. Saturated progress bar

**Symptom.** A bar 100% full and red next to the text "274,6% utilizado".
**Fix.** A bar only has a scale while the value fits the limit. Past the limit it
saturates and lies: replace it with the number that says how far over it went.

## 8. Alarm with exclamation marks

**Symptom.** "Excedeu! Migrar para ME/Simples", "Atenção!", "Cuidado:".
**Fix.** Red is a real exception, and the exception speaks through the word and
the position, not the exclamation mark. State the fact and the consequence.

## 9. Zero rendered as information

**Symptom.** A card full of "R$ 0,00" in a year with no entries; a badge that
100% of the rows carry; a metric nobody fed.
**Fix.** A zero from a failed or unfed source does not render: it becomes a
one-line empty state that says what is missing. A real zero stays on health and
trust surfaces ("0 failed jobs"). A universal badge leaves the row and becomes
header context. Home of the rule: [foundations, States](../../visant-design/references/foundations.md#12-states).
**Detector.** None. Judgment on the open screen, and the `toFixed` sweep below
for the ratio form (10).

## 10. Zero denominator turning into "0,0%"

**Symptom.** Tax burden "0,0%" with no revenue; conversion rate "0%" with no
visits.
**Fix.** Without a denominator there is no ratio: the value is `null` and the
line does not appear. Home: [devils-advocate Q11 and Q12](devils-advocate.md#3-data-truth).

## 11. Hypothetical simulation served as fact

**Symptom.** Revenue 2.7 times the MEI limit, and the card keeps calculating the
MEI's DAS and IRPF with the same typographic authority as the rest.
**Fix.** Either the block does not render, or a line before it says it stayed as
a reference. A correct number in the wrong scenario is a lie by implication.

## 12. Error collapsed into empty

**Symptom.** The fetch fails, the screen shows "0 itens". Variant, eternal
skeleton: the `catch` clears the data but never leaves loading.
**Fix.** Error and empty are different states. Tolerance becomes opt-in
(`load({ throwOnError: true })`) on the surface whose job is to show the data.
Every `catch` ends in a state the screen knows how to paint: an error with "try
again", never loading. A service must not turn a network failure into an empty list.
**Test.** Run it with the backend stopped. A fix never seen failing was not verified.

## 13. All labels shouting

**Symptom.** Three or four `text-xs uppercase tracking-wider` in the same card,
with the same weight.
**Fix.** The next distinction comes from space and rules. At most 2 uppercase
labels per screen. Length, tracking and the hero-eyebrow tell: the
[micro-label tax](../../visant-frontend/references/acquisition-surface.md#the-micro-label-tax-eyebrows-and-letterspaced-mono).
**Detector.** `noise-scan`, rule `shouting-label`.

## 14. Hover-reveal leaning on a breakpoint

**Symptom.** `sm:opacity-0 sm:group-hover:opacity-100`.
**Fix.** `[@media(hover:hover)]:opacity-0` plus
`[@media(hover:hover)]:group-hover:opacity-100` plus `focus-visible:opacity-100`.
Space always reserved; hover reveals, hover never relayouts. A tablet is 640px and
has no hover, so width is not a proxy for a mouse.

## 15. Raw palette color

**Symptom.** `text-purple-400`, `bg-emerald-500/10`.
**Fix.** Design system token.
**Scope.** Only a finding when the repo HAS a token layer to bypass. A repo that
uses Tailwind's palette as its design system is judged on palette chaos instead:
more than 3 accent hue families.

## 16. Token in the wrong format

**Symptom.** None. The color simply does not show: a chart stroke with no color,
an invisible grid, a reference line that does not draw.
**Fix.** Before the first color, open `globals.css` and look at the format: a bare
HSL channel (`--primary: 0 0% 9%`) needs `hsl(var(--primary))`, a full color
(`oklch(...)`, `#hex`) is `var(--x)`. The two errors are symmetric and both pass
`tsc`, lint and review.
**Test.** Only the screen.
**Detector.** `refine-scan` (`visant-refine`) flags bare `var(--x)` in a color prop.

## 17. Decorative motion

**Symptom.** `transition-all`, `ease-in` in UI, `animate-bounce`, entrance with
`scale(0)`, a duration over 300ms on an interactive element.
**Fix.** See `visant-motion`: `EASE_OUT` to enter and exit, explicit scope on the
transition, `transform` and `opacity` only, and the question first (what is used
100 times a day does not animate).

## 18. Blur with nothing behind it

**Symptom.** `backdrop-blur-sm` on a card with an opaque background (`bg-card`)
or over a flat-color page, usually in series.
**Fix.** Delete it where the background is flat: `backdrop-filter` blurs what is
BEHIND the element, so with nothing behind it only costs a compositing layer. Keep
it where something passes underneath (a floating nav over scrolling content, a
modal, an overlay on a photo). A `bg-card` with `backdrop-blur` is always dead code.
**Test.** Open the screen and look at what is behind; no grep solves it.
**Detector.** `noise-scan`, rule `blur-on-card`: flags blur on an element in the
flow and lets through what overlaps (`fixed`/`sticky`/`absolute`, Dialog, Sheet,
Popover and the like by name).

## 19. Shell mounted twice

**Symptom.** The footer (or nav) appears twice on a single route: the app shell
mounts `<Footer />` for every route, and the page mounts it again.
**Fix.** **Only the shell mounts the shell.** Delete the import and the usage in
the page, and lock it with a regression grep (`<Footer|<Navigation` inside
`app/**/page.tsx`), because it comes back when someone copies a landing.
**Test.** Open the route and count `document.querySelectorAll('footer').length`.

## 20. The page that explains itself

**Symptom.** The screen works, the tokens are right, the copy is in voice, and the
person says it is full of text. Each piece of chrome alone is defensible, so no
linter sees it: the damage is the sum. Count what exists before the first pixel
of product.

| Form | How to recognize it |
|---|---|
| shouted label | `uppercase tracking-wider text-micro` on every section. At most 2 uppercase labels per screen (the detector flags 3). Numbers: the [micro-label tax](../../visant-frontend/references/acquisition-surface.md#the-micro-label-tax-eyebrows-and-letterspaced-mono) (entry 13) |
| teaches how to use | "clique para abrir", "arrasta um cartão pra outra coluna". Instruction next to a control that already has an affordance |
| caption of what comes next | "as dez peças abaixo cobrem…". Narrates what the page shows two centimeters later, and lies at the first reorder |
| verb per item | five items where each carries the word `add`. From the third on it is texture |
| the same info in two sizes | thesis in the header, an "opening" repeating it below, the first block's note repeating it again |

**Fix.** *Does this survive if I delete it?* If the person finds out by using it,
delete. Two exceptions only: a gesture with no native affordance (a keyboard
modifier, a shortcut), and an order that carries meaning (`01 fonte → 05 saída` on
an audio bench). The exception stays with the reason written on the line, naming
the rule.
**Test.** More than three blocks of text before the first pixel of content, the
screen is explaining itself.
**Detector.** `node <skill-dir>/scripts/noise-scan.mjs <target>`. It also enters
the `killer-scan` scoreboard as the fourth gate.

## 21. Two doors for the same gesture

**Home of the rule** (other files link here).

**Symptom.** Two fields asking for the same thing on the same screen: two urls,
two uploads, two searches, same shape, one under the other.
**Fix.** Rarely "delete one": both are usually needed. Move one ELSEWHERE, so each
screen has a single door and the door says what the screen does.
**Test.** Count the doors of the same kind per screen. Two, ask out loud which is
which. If the answer needs the code, the screen does not answer.
**Detector.** `noise-scan`, rule `repeated-door`, the only rule that runs ACROSS
files. It flags the two doors only **on the same screen** (common ancestor in the
import graph, with no early `return` or ternary separating them).
**Judgment, not detector.** The same name for different things on different
screens is a vocabulary defect: does each name repeated across screens mean the
same thing? Sister tools, the same job with the same selector in a different
place, show only with the frames side by side.

## 22. The highlight that highlights everything

**Symptom.** Three out of three cards lit with the accent color, and the item that
really matters indistinguishable from the rest.
**Fix.** The highlight receives the condition that decides (`on: q.live`), not a
fixed `on: true` in the item factory. State that is not the highlight becomes a
badge, a number or text weight. One highlight per region.
**Test.** Count the pieces lit at the same time. More than one per region, the
highlight means nothing.
**Detector.** `noise-scan`, rule `highlight-at-rest`.

## 23. The word cut in half

**Symptom.** A piece of a word inside a card, a button or a badge ("tirar da"). Or
two overlays in the same corner, and the top one hides the ACTION.
**Fix.** A width ceiling on every overlay (`max-width: calc(100% - 12px)`) and let
it wrap; a category verb becomes an ICON; a corner taken by another overlay shifts
one slot, instead of stacking. The width of a word only exists after the font
loads, so only the open screen knows.
**Test.** Open the screen at the width that squeezes (390px) and run the detector.
**Detector.** `corta-scan.js` in the browser console: `corta('.painel')`. It
separates cutting from scrolling, ellipsis and a rail that scrolls sideways, and a
small badge (< 25% of the area) over an `inset-0` background is not a stacked overlay.

## 24. Synthetic cover

**Symptom.** A media card without an image gets an invented "cover": a gradient
picked by a hash of the name, a giant initial, a dot grid.
**Fix.** A real cover (screenshot, thumb, logo) or an honest empty: neutral token
background and the icon of the item's TYPE, the same on all of them. Use the
design system's `MediaTile`.
**Test.** Two synthetic covers side by side in different colors: the user will
look for what the color means.
**Detector.** `noise-scan`, rule `synthetic-cover`. A gradient that SHOWS the
brand palette (a guideline swatch) is brand data and passes.

## 25. Image tile without `onError`

**Symptom.** A blur, smudge or eternal skeleton in place of the photo; or the
browser's broken-image icon.
**Fix.** A content image goes through `Thumb`/`MediaTile`, which has a fallback and
reserves the box; whoever must react to the failure uses the tile's
`onImageError`. The filter lives on the server: an item without a servable image
does not enter the grid.
**Detector.** `noise-scan`, rule `tile-img-no-onerror` (`<img>` with
`object-cover`/`aspect-*` and no `onError`; upload preview, blob and build asset
stay out).

## 26. Masonry without reserved height

**Symptom.** A column grid where the 1st column is right and the others become a
stack of thin lines, or everything jumps when the images arrive.
**Fix.** Reserve the box with `aspectRatio` (from metadata, or a fixed ratio per
type) before `onLoad`.
**Test.** Open with the network on "Slow 3G": the grid must not move.

## 27. The same information said three times in the shell

**Symptom.** The breadcrumb says "Meus Mockups", the page header says "Salvos",
the rail says "outputs".
**Fix.** One name per screen, from a single key (`nav.<section>.label`). Inside the
shell, the shell says where you are: the page does not repeat the title.
**Test.** Read the screenshot top to bottom: does the screen's name appear more
than once?

## 28. A "credit" regex deciding the paywall

**Symptom.** A user with balance sees "Comprar créditos" when the provider goes
down: `/crédit/i.test(error.message)` matched "seu crédito foi estornado".
**Fix.** Decide by code: status 402 or `code: 'insufficient_credits'`. A message is
for showing, never for branching (a substring of translated text never matches in
the other language).

## 29. `charged = true` without reading the return

**Symptom.** A balance that grows by itself: an admin, BYOK or unlimited account
gains credit on every error.
**Fix.** `charged` comes from the charge's return, and the refund gives back only
what was charged. Backend slop that the open screen gives away, hence the
paid-route lock in `verify-screens.mjs`.

## 30. Staircase list

**Symptom.** The grid items come in one after another, each 50ms later. With 30
items the last one waits 1.5s, on every filter and every return to the page.
**Fix.** On a work screen the list comes in whole, at once (or only the container
animates). A stagger belongs only to marketing and acquisition surfaces, 30 to 80
ms per item and capped ([visant-motion](../../visant-motion/SKILL.md)).
**Detector.** `noise-scan`, rule `stagger-by-index`. It cannot tell the surface, so
a capped stagger on a marketing surface takes a written exception.

## 31. The card that jumps

**Home of the rule** (other files link here).

**Symptom.** A card rises (`hover:-translate-y-1`) or its image grows
(`group-hover:scale-105`) on mouse over.
**Fix.** Hover never moves the element: it changes color, border or shadow. It
does not exist on touch and says nothing the border would not. A scale below 1 on
`active:` (sinking) is something else and stays.
**Detector.** `noise-scan`, rule `hover-lift`. Warn-only: unless the brand defines
it, and an icon that grows inside a fixed button does not count.

## 32. Dot grid background

**Symptom.** A repeated `radial-gradient` with `background-size`, an SVG of
circles or `<GridDots>` behind a page, panel or empty cover.
**Fix.** Flat token background. A large radial glow (an ellipse without
`background-size`) is something else and passes.
**Detector.** `noise-scan`, rule `dot-grid`.

## 33. Primitive rewritten by hand

**Symptom.** A cyan CTA written in the class (`bg-brand-cyan/10
border-brand-cyan/30`), `<label border-dashed><input hidden/></label>` as an
upload area, a button group playing selector, a media card with its own `<img>`.
Each one slightly different from its neighbor.
**Fix.** Use the house primitives: `Button` variants, `Dropzone`,
`SegmentedControl`, `MediaTile`, `Modal`. Contract in
the repo's design-system contract, if it has one.
**Test.** Two screens, the same gesture: are the two controls the same component?

## 34. Scroll indicator in the hero

**Symptom.** "Role", "Scroll", "Scroll down", "Explore", a mouse icon, an arrow or
a line that drips/bounces at the foot of the hero, centered.
**Fix.** Delete it, with its copy key and its `@keyframes`, unless it is the only
cue and the fold hides content (a cut-off row is the usual cue instead). Nobody
needs to be taught to scroll, and a loop pulls the eye off the headline. If the
fold looks "closed", the fix is composition (image crop, content bleeding into the
next section).
**Test.** Remove it. Does anyone still know there is more below?
**Detector.** Quick sweep below.

> **35 to 46: one core in focus.** Show the core with a clear hierarchy, the least
> at a time, and never lose what matters. The rest is revealed in sequence
> ([hide in sequence](../../visant-frontend/references/work-surface.md#hiding)).
> Entries 35 to 41 apply this. A component showcase is the example, not the scope.
> About 140 pieces of a library were opened one by one, all green on tsc and lint,
> and the defects only existed by looking
> ([procedure](../../visant-frontend/references/component-showcase.md)). Entries
> 42 to 46 are library hygiene found in the same round.

## 35. The frame that speaks for the piece

**Symptom.** A component's demo wrapped in a fake navbar, a "Briefing" card, an
invented toolbar, a caption "passe o mouse", "clique pra ver"; the piece takes a
third of the frame.
**Fix.** The core large, in the smallest credible context, with no instructions.
If the piece does not explain itself, the defect is in its affordance. On a
product screen the same holds: the chrome around the core is never louder than it.
**Test.** Cover the piece with your finger: is more than one line of stuff left
in the demo?

## 36. Stacked variations

**Symptom.** 4 skeletons, 6 loaders, 3 toggles, 4 frames side by side on the same
stage, each one squeezed.
**Fix.** One variation in focus at a time: one large, with a discreet selector
(tiny text or arrows) that switches and replays. A variant matrix or
comparison a person needs in product UI stays. Reveal it in sequence (a step, a
tab), never delete it.
**Test.** At tile size, can each variation be read? If not, show one.

## 37. Piece that is born dim

**Symptom.** Glow, perspective, tilt, menu or island only appear on hover; at rest
the piece is a neutral rectangle.
**Fix.** The core is born in its best state: hover intensifies it, it does not
reveal it. The pretty state does not exist on touch, on the tile, in the
screenshot or in the shared link. A secondary action revealed on hover in
reserved space is not this: it stays, with a `focus-visible` and touch path.

## 38. Secondary control louder than the piece

**Symptom.** Chips with a border and brand color to switch the demo mode, a switch
labeled "Mostrar modo X", a state selector bigger than the component.
**Fix.** The core is louder than its controls: tiny text at the foot, no box, no
brand; or the modes go to the panel knobs. No toggle with an instruction label. A
control a person needs keeps its place and its target size, only quieter.

## 39. Permanent label that depends on state

**Symptom.** "Apagar selecionados", "0 itens", "Nada aberto ainda" visible with
nothing selected or open.
**Fix.** Hide in sequence: the label is born with the state. The button is
icon-only until there is a selection, and a zeroed facet goes away instead of
showing zero. The action stays reachable the moment it has something to act on.

## 40. Amateur animation

**Symptom.** A 200° spin, overshoot on everything, 20+ particles per item, a big
jump, a spring that bounces three times.
**Fix.** Cut the amplitude in half and again: a ~12° spin, scale of 0.4–0.9, few
weak particles, no overshoot on an element that disappears. Good motion is barely
noticed (`visant-motion`, "amplitude").

## 41. Everything moving at the same time

**Symptom.** A queue moving, images arriving, a % bar, a toast and an error all
animating together.
**Fix.** One focus of motion at a time: states in sequence (sent → generating →
ready → exporting), the rest still. Nothing that matters is dropped, it waits its turn.

## 42. Client copy leaking into the library

**Symptom.** A reusable piece's demo with the name, slogan, product or theme of an
agency client.
**Fix.** Generic, short text in spoken pt-BR; fictional person names. When
harvesting, swap the copy in the same pass, and sweep the whole library when a
case shows up (a library sells to every client).

## 43. The scaled stage lying

**Symptom.** Cursor/dot far from the pointer, a drag that moves more than the
finger, a 3D canvas crooked or in the corner, a menu cut when it opens.
**Fix.** The stage applies `transform: scale`, so: portal to `body`; delta divided
by the scale; `resize={{ offsetSize: true }}` in R3F; dropdown in a portal; a box
(`preview`) the real size of the piece. Full table in `component-showcase.md` §3.
**Test.** Run the piece with the stage at `scale(0.5)` and drag.

## 44. System scrollbar and a list that scrolls sideways

**Symptom.** A white track with arrows in the dark theme; a list/search with
horizontal scroll because one column does not fit.
**Fix.** At the root: `scrollbar-width: thin` and `scrollbar-color` in the line
tone. List: `overflow-x: hidden`, columns that truncate, and common data is not
repeated on every row.

## 45. Category in internal jargon

**Symptom.** Filters "Aquisição", "Superfície de trabalho", "Fundação"; subfilter
`ui / block / lib`.
**Fix.** Category by what the thing IS (Controles, Dados, Navegação, Mídia, Texto,
Efeitos, 3D…), type in Portuguese, aliases for the old names in the route.
**Test.** Would a first-time visitor know what is behind each label?

## 46. Clickable without a hand cursor

**Symptom.** A card, tile button, tab or arrow that responds to a click with the
arrow cursor; a drag without `grab`.
**Fix.** One rule in the shell (`:is(button,[role=button],a[href],summary)
:not(:disabled){cursor:pointer}`), because the Tailwind v4 preflight leaves
`button` with `cursor: default`; `grab`/`grabbing` on what is dragged.

## Warn-only signals (47 to 57)

None of these has yet a case from a round with `file:line`: they are suspicion and
a test, not a verdict. **Their detectors are warn-only:** they print `[WARN]` and
never fail the run or the gate. When one shows up in a real report, it gets the
case and can move up. The same holds for `hover-lift` (31).

The common thread: **ornament that imitates care**. Each is what a carefully made
LP has, copied without the reason it was there.

Before fixing by hand, check whether the piece already exists refined in the
Visant library ([ui.visantlabs.com](https://ui.visantlabs.com), `npx shadcn@latest
add @visant/<name>`): a tag becomes `chip`, divider and box disappear into a
`section-intro` or `step-cards`, an over-detailed panel becomes `gauge` or
`measure-bar`.

### 47. Tag on everything

**Symptom.** Decoration as tags: "Novo", "IA", "Beta" on every card, a badge above the title, three tags under the description, the same chip on every row.
**Fix.** A chip earns its place in three uses: it filters or chooses, it says a state that decides (waiting, failed, overdue), or it organizes kind or source in a mixed list so the eye scans by it. One per item, in the same position on every row ([taste](../../visant-design/references/taste.md) §3). Several per item, or one on 100% of rows, becomes running text or goes. Related to 13 and 45.
**Test.** For each chip: which row would I find slower without it? No answer, it goes. Removing chips that answer is the opposite failure (`perdeu-chip` in regressao).
**Detector.** `noise-scan`, rule `tag-everywhere` (6+ inert badges, chips or hand-made pills in one file; a clickable chip is a filter and passes). It is a suspicion: a file holding several components, each with its one state chip, passes on review.

### 48. One word in italics in the headline

**Symptom.** "Design que *converte*": an `<em>` (almost always an italic serif) on
one word of the title.
**Fix.** Emphasis comes from the sentence, not the font, unless the brand defines
it. Italics where the language asks for it (a work's title, a foreign word).
**Test.** Read aloud, does the italic word change the meaning? If not, it is a tic.
**Detector.** `noise-scan`, rule `italic-headline-word` (`<em>`, `<i>` or `italic`
inside an h1/h2 or display-size text; a heading italic as a whole passes).

### 49. Instrument Serif with negative tracking

**Symptom.** A headline in Instrument Serif (or the free display serif of the
moment) with `tracking-tight`, `tracking-[-0.04em]` or a negative `letter-spacing`.
**Fix.** The font is the brand's. Negative tracking only where that font asks for
it at that size, measured on the screenshot, never by default, unless the brand
defines it.
**Test.** Swap in the brand font. If the page loses its "look", the look was borrowed.
**Detector.** `noise-scan`, rule `display-serif-tight` (Instrument Serif or
`font-serif` plus negative tracking on the same element).

### 50. Over-detailed UI

**Symptom.** A dashboard mock in the hero with forty tiny elements, micro-icons, a
sparkline in every corner, invented numbers.
**Fix.** Show the one thing the product does, at a size that reads. Related to 20 and 24.
**Test.** Shrink the screenshot to 50%. Whatever became texture goes.

### 51. A divider between everything

**Symptom.** `<hr>`, `border-t`, `divide-y`, `<Separator>` separating blocks that
spacing already separated.
**Fix.** Space and alignment group. A line only in a table and a dense list.
**Test.** Delete the dividers. If the grouping stays readable, they stay deleted.
**Detector.** `noise-scan`, rule `divider-everywhere` (8+ in one file; table rows,
list items, sticky bars, vertical separators and toolbar, sidebar or menu files pass).

### 52. Opacity ladder

**Symptom.** `text-white/90`, `/70`, `/50`, `/40` in the same block; `bg-primary/5`,
`/10`, `/20` on neighboring cards.
**Fix.** Two or three text tones from the token (`foreground`, `muted`).
Hierarchy by transparency is a raw color under another name (15). Related to 1.
**Test.** More than three levels of gray in the same block: none of them means anything.
**Detector.** `noise-scan`, rule `opacity-ladder` (one color utility in 4+ opacity
steps in one file; `hover:`/`focus:` states and `text-sm/6` line height do not count).

### 53. A bordered box around everything

**Symptom.** Every group in a `border rounded-xl` box; a box inside a box.
**Fix.** One level of container. Group by space; a border only where there is a
real limit (input, table, clickable area, the main data of an operation screen).
It forbids a box in a box, not boxes: see 64. Rule home:
[foundations, Grouping](../../visant-design/references/foundations.md#3-grouping).
**Test.** A box inside a box is almost always one too many.
**Detector.** `noise-scan`, rule `box-in-box` (2+ in one file; fields, buttons,
links, tags, tabs, swatches and anything inside a `fixed`/`absolute` layer pass).

### 54. Diagram, and the more detailed the worse

**Symptom.** A flowchart of nodes and arrows, an isometric, an "architecture"
explaining what fit in one sentence.
**Fix.** A diagram only when the relation does not fit in a sentence and the reader
will come back to consult it.
**Test.** Describe the diagram in one sentence. If it fit, swap it for the sentence.

### 55. Code breadcrumb as ornament

**Symptom.** `~/projects/app`, `$ npm install`, `// serviços`, `<Hero />`,
`src/app/page.tsx` decorating a page that is not for developers.
**Fix.** Only in a product for developers, and only when it is a real command
someone copies. Related to 2.
**Test.** Does whoever reads this page open a terminal? If not, it goes.
**Detector.** `noise-scan`, rule `code-crumb` (visible text only; inside
`pre`/`code`/`kbd`, as a code-block caption or next to a copy button it passes).

### 56. Numbered section

**Symptom.** "01 — Serviços", "/02", "§3" above each section.
**Fix.** A number only where the order matters (steps of a process), unless the
brand defines it.
**Test.** Swap two sections. If the number does not change the meaning, it goes.
**Detector.** `noise-scan`, rule `numbered-section` (2+ in one file; numbers
generated in a `.map` stay with the eye).

### 57. Mono on everything

**Symptom.** `font-mono` on eyebrow, label, button, nav, date, counter, card
caption: the code font becomes the page's second font.
**Fix.** Mono only on what is really code: serial, hash, ID, command, a snippet
someone copies. The rest uses the text font, with `tabular-nums` where numbers need
to align. Generalizes 2 and 55; uppercase mono on a label is already the
`shouting-label` rule.
**Test.** Swap all mono for the text font. Whatever got worse (ID, hash, command)
comes back; the rest stays.
**Detector.** `noise-scan`, rule `mono-everywhere` (10+ in one file, outside
`pre`/`code`/`kbd` and ID-like content).

## Signals from tool panels (58–63)

From a tool panel redrawn side by side with its fork. Suspicion and test, like
47–57, until a round gives them a `file:line`. The common thread: **every control
drawn as the same generic row**, so the panel says nothing about its data. Rules
and the full case: `visant-refine`
[control-panels.md](../../visant-refine/references/control-panels.md).

### 58. Dropdown for a handful of options

**Symptom.** `<Select>` with 2–5 short items (Mode: Grid / Sphere / Spiral).
**Fix.** Segmented control with a sliding highlight. Dropdown from 6 options or long labels up.
**Test.** Count the items. Do they fit in the row?

### 59. Two lists for one point

**Symptom.** "Horizontal ▾" and "Vertical ▾" side by side (alignment, anchor, origin).
**Fix.** A 3 × 3 grid: one click sets both, the highlight slides to the pick.
**Test.** Is the value a position? Then the control is a place.

### 60. Numbers without their unit

**Symptom.** A panel of `50`, `1.0`, `16`, `0.50`: degrees, multiplier, pixels and seconds look alike.
**Fix.** Unit after the value, one tone dimmer; values in `tabular-nums`.
**Test.** Cover the labels: can you tell which number is a duration?

### 61. A structure flattened into rows

**Symptom.** "Color 1 / Stop 1 / Color 2 / Stop 2 / … / Add stop / Remove stop", or
`Ease 0.25, 0.1, 0.25, 1` as one string.
**Fix.** The picture of the value edited in place (bar with stops, curve with handles)
plus a table with a `−` per row and a `+` in the header.
**Test.** "Remove stop": which one? If the button cannot say, it is on the wrong row.

### 62. Chrome that does not depend on state

**Symptom.** A global "Reset" at the bottom, a caption under every control, three
action icons on every row, a dependent control visible while its switch is Off.
**Fix.** Reset per section, only when something changed; help on demand; rare
actions behind one `⋯`; dependent controls only while they apply.
**Test.** Does the panel look the same before and after the user touched it? Then the chrome says nothing.

### 63. The mode below what it changes

**Symptom.** A curve, a preview or a list, and only BELOW it the "Type" selector that reinterprets it.
**Fix.** The selector first (tabs above the graph), then the picture, then the numbers.
**Test.** Read top to bottom: do you meet the content before knowing what kind it is?

### 64. Clean to the bone

**Symptom.** After a cleanup: no cards, numbers at body size, a state reduced to a grey icon, six tiles turned into a sentence, a frame with a void beside it. On a first run: the mascot, the illustration and the brand color gone, the screen correct and lifeless. Every detector at zero.
**Fix.** Boxes back on main data, chips back on states, the column back to its width. Text that repeats becomes a drawn fact (a count, a ring, a logo), keeping the cards that carry it. On a `shine` region the brand moment comes back from the brand's own idiom, not as ornament ([brand-idiom](../../visant-design/references/brand-idiom.md)).
**Test.** Before and after side by side, shown to the owner. Would they miss what went? The swap test: with a competitor's logo, could the screen be theirs?
**Detector.** `tela-scan.js` on the open screen, `regressao.mjs` against the previous state (`perdeu-marca` for brand art), and the `shine` row without a brand moment in `--report` ([verification.md](verification.md#tela-scanjs-what-the-screen-lost)). With no user in the loop, put the before and after in the report and stop.

## Signals from an over-clean first run (65–67)

From a desktop agents app redesigned in a first-run pass (case in [cases.md](cases.md#lost-its-soul)). Each one is a cleanup that went in the right direction and stopped at the wrong place.

### 65. Heavy stroke on every card

**Symptom.** Cards with 1.5–2px outlines, a 2px radio ring, a 3px focus halo that also shows on a mouse click, the selected item said by color alone or by a heavy border alone.
**Fix.** 1px chrome. Selection is color and a second cue: the accent mixed into the border (~55%) and a tint behind, plus a check, a weight or a shape on the chosen one. A 2px border on a selected or invalid state is that second cue, not a heavy stroke. Focus shows on `:focus-visible` only, 2px with a 2px offset, at least 3:1 against its neighbor ([foundations §8](../../visant-design/references/foundations.md#8-interaction)). Anything else over 1px carries a written reason.
**Detector.** `stroke-scan.mjs` (CSS, style objects, Tailwind, shadcn defaults). Warn-only until a second case is recorded: it was built from one.

### 66. Illustration that is only brand

**Symptom.** A large mascot or logo beside the first-run title, saying nothing about what the product does.
**Fix.** Draw the sentence the title says, in the brand's idiom: the team perched on the mascot, a status walking through the work until "approved". Each one makes the other easier to read.
**Test.** Cover the title. Does the drawing still say what the product does?

### 67. The core object in a corner preview

**Symptom.** A builder whose form fills the screen and whose result (the agent, the document, the design) is a small card in a corner.
**Fix.** Canvas + deck: the object large on its own color, standing still; the controls in a deck beside it that changes per step. The same canvas carries the moment it is born.
**Test.** Squint. Is the biggest thing on screen the thing being made?

## Quick sweep

```bash
# new signals (47–57): candidates, never a verdict (noise-scan has rules for all but 50 and 54)
rg -c '<Badge|rounded-full[^"]*text-(xs|\[1[01]px\])' --glob '*.tsx'      # tag on everything (47): look at the high-count file
rg '<em\b|italic' --glob '*.tsx' | rg '<h[12]|text-[4-7]xl'               # italics in the headline (48)
rg -i 'instrument.?serif|tracking-tighter|tracking-\[-|letter-spacing: *-' --glob '*.{tsx,css}'   # (49)
rg -c 'divide-y|<hr|<Separator|border-t\b' --glob '*.tsx'                 # divider between everything (51)
rg -o '(text|bg|border)-[a-z-]+/[0-9]{1,2}\b' --glob '*.tsx' | sort | uniq -c | sort -rn   # opacity ladder (52)
rg -U 'border[^"]*rounded[\s\S]{0,400}border[^"]*rounded' --glob '*.tsx' # box inside a box (53)
rg '>\s*(~/|\$ |// )|src/app/' --glob '*.tsx'                             # code breadcrumb (55)
rg '>\s*(/?0[1-9]\b|§ ?[0-9])' --glob '*.tsx'                             # numbered section (56)
rg -c 'font-mono' --glob '*.tsx' | sort -t: -k2 -rn | head                # mono on everything (57): the top is where it became a second font

# tool panels (58–63): candidates, never a verdict
rg -U '<Select[\s\S]{0,600}?</Select>' --glob '*.tsx' | rg -c '<SelectItem'   # few items in a Select (58): segmented?
rg -i '(horizontal|vertical).{0,40}<Select' --glob '*.tsx'                    # two lists for one point (59)
rg '>\s*(Add|Remove|Adicionar|Remover) [a-z]+\s*<' --glob '*.tsx'            # add/remove away from the row (61)
rg -i '>\s*(Reset|Resetar|Redefinir)( all| tudo)?\s*<' --glob '*.tsx'         # global reset (62)

# component showcase (35–46): candidates, never a verdict
rg -i '"(passe o (mouse|ponteiro)|mova o ponteiro|clique pra|arraste pra)' --glob '**/demos/*.tsx'   # frame that speaks (35)
rg 'fixed' --glob '**/demos/*.tsx'                                         # fixed inside the scaled stage (43)
rg 'clientX|movementX' --glob 'registry/**/*.tsx' | rg -v 'scale|offsetWidth'  # delta not divided by the scale (43)
rg '<Canvas' --glob '*.tsx' | rg -v offsetSize                             # canvas measuring the scaled size (43)
rg 'rotate: *[0-9]{3}|rotate\([0-9]{3}deg' --glob '*.tsx'                  # amateur spin (40)
rg 'font-mono' --glob '*.tsx' | rg -i 'currenc|valor|preco|total'
rg 'animate-spin' --glob '*.tsx'
rg 'transition-all|ease-in\b|scale\(0|animate-bounce' --glob '*.tsx'
rg 'sm:group-hover|md:group-hover' --glob '*.tsx'
rg 'text-(purple|emerald|indigo|violet|sky)-[0-9]' --glob '*.tsx'
rg 'bg-(card|background|popover)\b[^"''']*backdrop-blur' --glob '*.tsx'   # blur with nothing behind
rg '<(Footer|Navigation)\b' --glob '**/page.tsx'                      # shell mounted 2x
rg 'toFixed\(1\)\}%|toFixed\(2\)\}%' --glob '*.tsx'   # zero-denominator candidate
rg '<img' --glob '*.tsx' | rg -v 'onError|Thumb'      # tile without fallback (25)
rg -i '/cr[eé]dit/i' --glob '*.tsx'                   # paywall by substring (28)
rg 'charged = true' server/                           # refund of what was not charged (29)
rg -i '"(role|scroll|scroll down|explore|descubra mais)"|animate-bounce|nudge|scroll-indicator|ScrollHint|MouseIcon' --glob '*.{tsx,json}'   # scroll indicator in the hero (34)
```

Grep finds a candidate, not a verdict. Each hit is confirmed by reading
`file:line`.

For entries 20, 21, 22 and 23 do not use grep: the defect does not live in any
line. 20 lives in the sum of the lines; 21, BETWEEN two files; 22, in the
repetition of a correct line; 23, in the width that only exists after the font
loads. That is why the first three are rules of `noise-scan.mjs` and the last one
is `corta-scan.js`, which runs in the browser with the screen open. Entry 6 is the
same story: `ritmo-scan.js` measures it after layout.
