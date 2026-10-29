# Catalog of slop that gets past the linter

Marks of AI-written interfaces that no detector catches, because the defect is a
decision and not syntax. All of them seen in production at Visant. Each one:
symptom, cause, fix.

Ordered by frequency. The first six show up in almost every card an AI writes
unsupervised.

## 1. Rainbow card

**Symptom.** In a calculation breakdown, every figure painted: revenue green, tax
red, base white, exemption purple.
**Cause.** The AI treats color as a semantic label per value, so every line gets
"its own" color.
**Fix.** Color is the exception. One neutral for everything, and color only where
there is a real exception (limit exceeded, negative balance, overdue deadline).
Cash outflow is marked by the typographic minus (`− R$`), the close of a block by
font weight.
**Test.** If more than two hues appear in the same block of numbers, none of them
means anything.

## 2. Money in `font-mono`

**Symptom.** `font-mono tabular-nums` on a currency figure.
**Cause.** The AI associates "aligned numbers" with a code font.
**Fix.** `tabular-nums` alone. Mono is for serials, hashes, IDs and code; on a
financial card it shouts "terminal" and clashes with the typography of the rest
of the app.

## 3. Spinner instead of skeleton

**Symptom.** A centered `<Loader2 className="animate-spin" />`, and the card
collapses to 40px tall while loading.
**Cause.** Shortest path to a "loading state".
**Fix.** Static structure paints, only the data blurs. Label, rule and title
stay; the value becomes a `Skeleton` of roughly its width. No layout jump, and
the user already reads what is about to arrive.

## 4. Title that repeats the chrome

**Symptom.** The page `h1` says "Resumo Fiscal", the filter says "2026", and the
card repeats "MEI — Resumo Fiscal 2026".
**Cause.** The component was written without looking at the page that holds it.
**Fix.** The card names what it adds ("Cenário MEI"), and the qualifier (year,
regime, base) goes once, quietly, on the right.

## 5. Duplicated data inside the same card

**Symptom.** "Faturamento R$ 222.430,91" at the top and "Receita bruta R$
222.430,91" ten lines below.
**Cause.** Each block was generated in isolation, with its own opening.
**Fix.** The value appears once, in the block where it decides something. In the
others it is a reference and goes, or becomes a caption.

## 6. Uniform spacing

**Symptom.** `space-y-4` on everything, or a rule between every pair of lines.
**Cause.** A constant rhythm is the default of whoever did not decide the
grouping.
**Fix.** Space is what groups. Tight inside a block, open between blocks, and a
rule only at a block boundary. Each level at least 2× the one inside it
(8 / 16 / 32), and a card does not need it: the box already groups.
**The four faces**, because "crazy spacing" is rarely one wrong number:
inverted proximity (more space inside a group than between groups, so the label
pairs with the wrong value), flat rhythm (the same gap on three levels),
drifting siblings (one card with `p-5` among `p-6`, an `mt-1` patching a
`gap-7`), and a value off the scale (`p-[13px]`).
**Detector.** The first three: `ritmo-scan.js` in the browser (`ritmo()`, or the
`spacing` line of `verify-screens` and `corta-url`). The fourth lives in the
source, and the repo's scale linter owns it
([gates.md](gates.md#spacing-two-layers)).

## 7. Saturated progress bar

**Symptom.** A bar 100% full and red next to the text "274,6% utilizado".
**Cause.** The bar was chosen before checking the domain of the value.
**Fix.** A bar only has a scale while the value fits the limit. Past the limit it
saturates and lies: replace it with the number that says how far over it went.

## 8. Alarm with exclamation marks

**Symptom.** "Excedeu! Migrar para ME/Simples", "Atenção!", "Cuidado:".
**Cause.** The AI signals urgency with punctuation instead of order and wording.
**Fix.** Red is a real exception, and the exception speaks through the word and
the position, not the exclamation mark. State the fact and the consequence.

## 9. Zero rendered as information

**Symptom.** A card full of "R$ 0,00" in a year with no entries; a badge that
100% of the rows carry; a metric nobody fed.
**Fix.** Zero does not render: it becomes a one-line empty state that says what
is missing. A universal badge leaves the row and becomes header context.

## 10. Zero denominator turning into "0,0%"

**Symptom.** Tax burden "0,0%" with no revenue; conversion rate "0%" with no
visits.
**Fix.** Without a denominator there is no ratio: the value is `null` and the
line does not appear. "0%" asserts a false fact.

## 11. Hypothetical simulation served as fact

**Symptom.** Revenue 2.7 times the MEI limit, and the card keeps calculating the
MEI's DAS and IRPF with the same typographic authority as the rest.
**Cause.** The math is mathematically valid, so the AI presents it as valid.
**Fix.** Either the block does not render, or a line before it says it stayed as
a reference. A correct number in the wrong scenario is a lie by implication.

## 12. Error collapsed into empty

**Symptom.** The fetch fails, the screen shows "0 itens".
**Cause.** The service catches the failure and returns an empty payload, so the
page's error state is unreachable even after being written.
**Fix.** Error and empty are different states. Tolerance becomes opt-in
(`load({ throwOnError: true })`) on the surface whose job is to show the data.
**Verification.** Run it with the backend stopped. A fix never seen failing was
not verified.

**Variant: eternal skeleton.** The `catch` clears the data but never leaves
loading (or never stores the error), and the skeleton pulses forever. Worse than
empty: it says "coming". Seen in the 2026-10 round in Naming and in the Profile
referral, and in `mockupApi.getAll`, where a network failure became an empty
list in the SERVICE, before the page had a chance. Every `catch` ends in a state
the screen knows how to paint: an error with "try again", never loading.

## 13. All labels shouting

**Symptom.** Three or four `text-xs uppercase tracking-wider` in the same card,
with the same weight.
**Fix.** If everything is a section header, there is no hierarchy. One label
level per card, and the next distinction comes from space and rules.

## 14. Hover-reveal leaning on a breakpoint

**Symptom.** `sm:opacity-0 sm:group-hover:opacity-100`.
**Cause.** Width used as a proxy for "has a mouse". A tablet is 640px and has no
hover, so the control is invisible and unreachable.
**Fix.** `[@media(hover:hover)]:opacity-0` plus
`[@media(hover:hover)]:group-hover:opacity-100` plus `focus-visible:opacity-100`.
Space always reserved; hover reveals, hover never relayouts.

## 15. Raw palette color

**Symptom.** `text-purple-400`, `bg-emerald-500/10`.
**Cause.** The Tailwind palette is the default of whoever did not read the token.
**Fix.** Design system token. Worth checking: a raw color has already slipped
past two detectors at once in this repo.
**Scope.** Only a finding when the repo HAS a token layer to bypass. A repo that
uses Tailwind's palette as its design system (no semantic color layer) is judged
on palette chaos instead: more than 3 accent hue families.

## 16. Token in the wrong format

**Symptom.** None. The color simply does not show: a chart stroke with no color,
an invisible grid, a reference line that does not draw.
**Cause.** The token was read in another repo's format. Where the CSS stores a
bare HSL channel (`--primary: 0 0% 9%`), `var(--primary)` delivers the string
`0 0% 9%`, which is not a color; where the token is already a full color
(`oklch(...)`, `#hex`), the `hsl(var(--x))` wrapper produces an invalid color the
other way. The two errors are symmetric and both pass `tsc`, lint, visual
detector and code review, because the line **looks** right.
**Fix.** Before the first color, open `globals.css` and look at the format.
Then, a greppable rule (`refine-scan` from `visant-refine`) that flags bare
`var(--x)` in a color prop.
**Verification.** Only the screen. This is the most literal case of "compiling
is not someone having seen it": a chart was committed and pushed with no color
at all.

## 17. Decorative motion

**Symptom.** `transition-all`, `ease-in` in UI, `animate-bounce`, entrance with
`scale(0)`, duration above 300ms on an interactive element.
**Fix.** See `visant-motion`: `EASE_OUT` to enter and exit, explicit scope on
the transition, `transform` and `opacity` only, and the question first (what is
used 100 times a day does not animate).

## 18. Blur with nothing behind it

**Symptom.** `backdrop-blur-sm` on a card with an opaque background (`bg-card`)
or over a flat-color page. It shows up in series, because it was copied from a
card where the effect really existed.
**Cause.** `backdrop-filter` blurs what is BEHIND the element. With no content
behind, it creates a GPU compositing layer and changes not a pixel. Pure cost
that passes any linter, because the class is spelled right.
**Fix.** Delete it where the background is flat. Keep it where something passes
underneath: a floating nav over scrolling content, a modal, an overlay on a
photo, the animated background of the home page. A `bg-card` (opaque) with
`backdrop-blur` is always dead code.
**Verification.** Open the screen and look at what is behind; no grep solves it.
Found in the boxy-app audit (2026-08-06): 49 occurrences, ~20 with nothing
behind.
**Detector.** `noise-scan`, rule `blur-on-card` (2026-10-05): flags blur on an
element in the flow and lets through what overlaps (`fixed`/`sticky`/`absolute`,
Dialog, Sheet, Popover and the like by name).

## 19. Shell mounted twice

**Symptom.** The footer (or nav) appears twice on a single route. In the code,
two calls that are right in isolation: the app shell mounts `<Footer />` for
every route, and the page mounts `<Footer />` again.
**Cause.** Whoever writes the page does not see the shell. And the defect has no
static symptom: both files compile, pass tsc, lint and the copy gate. It only
shows with the page open and scrolled to the end, which is exactly where nobody
looks.
**Fix.** One rule: **only the shell mounts the shell**. Delete the import and the
usage in the page. Lock it with a regression grep (`<Footer|<Navigation` inside
`app/**/page.tsx`), because it comes back every time someone creates a new
landing by copying another.
**Verification.** Open the route and count
`document.querySelectorAll('footer').length`. Found in boxy-app (2026-08-06),
the Mockup Store LP, reported by the user with a screenshot; none of the three
detectors saw it.

## 20. The page that explains itself

**The most expensive on the list, and the only one that exists only in the
SUM.** The nineteen above are defects of a piece: you look at the card and see
it. This one you only see by looking at the whole screen and counting.

**Symptom.** The screen works, the code passes everything, the tokens are right,
the copy is in the house voice. And the person opens it and says "tá cheio de
texto, tá poluído". Counting what exists before the first pixel of product in a
real showcase: position tag, title, thesis, count line, command, command
caption, context label, opening sentence, block label, the word "add" five
times, block note. **Eleven blocks of text**, and the same information said
three times in three sizes.

**Cause.** Each piece of chrome, alone, is defensible, and that is exactly why it
gets through. The label names the section. The note orients. The instruction
helps whoever arrives. The ordinal gives order. No line is "wrong"; the damage is
the sum, and no linter sums.

Agents write this by default, and the cause is psychological before it is
technical: the agent **has just decided on a structure** and wants the structure
to show, so it captions what it did. It is the signature of someone explaining
their own work instead of delivering it. The same instinct that makes a junior
comment every line.

**The five forms, in the order they appear:**

| Form | How to recognize it |
|---|---|
| shouted label | `uppercase tracking-wider text-micro` on every section. One is an eyebrow; five is a generic dashboard. See entry 13 |
| teaches how to use | "clique para abrir", "arrasta um cartão pra outra coluna", "passe o mouse". Instruction next to a control that already has an affordance |
| caption of what comes next | "as dez peças abaixo cobrem…", "o gráfico ao lado mostra". Narrates what the page shows two centimeters later, and lies at the first reorder |
| verb per item | a list of five items where each one carries the word `add`. The second already informs nothing; from the third on it is texture |
| the same info in two sizes | thesis in the header, an "opening" repeating it below, the first block's note repeating it again |

**Fix.** The question that solves all five: *does this survive if I delete it?*
If the answer is "yes, the person finds out by using it", delete. Finding out
that a card drags costs one gesture; reading that it drags costs a line on every
page load, forever.

Two legitimate exceptions, and only two:

1. **Gesture with no native affordance.** Keyboard modifier (`shift` for fine
   adjustment), resizing the window, a shortcut. No pixel announces that.
2. **Order that carries meaning.** Numbering `01 fonte → 05 saída` on an audio
   bench really orients; numbering `1. 2. 3.` on a feature list is a decorative
   ordinal.

The exception stays **with the reason written on the line**, naming the rule.
`noise-scan` reads that comment and releases the hit; it is the only way to
silence the detector, and it forces whoever silences it to say why.

**Test.** Count the blocks of text before the first pixel of content. More than
three, the screen is explaining itself. And read the thesis, the opening and the
first note in sequence: if all three say the same thing, two die.

**Detector.** `node ~/.claude/skills/visant-killer/scripts/noise-scan.mjs <target>`.
It runs alone and also enters the `killer-scan` scoreboard as the fourth gate.

## 21. Two doors for the same gesture

**Symptom.** Two fields asking for the same thing on the same screen: two urls,
two uploads, two searches. Same shape, the same icons beside them, one under the
other.

**Real case** (jukebox, 2026-09-11). The "sua caixa" tab had the url field of the
ROOM; the footer just below, coming from another file, had the url field of the
BOX. Different databases, different permissions, and the label of one
(`<Group cap="link ou arquivo">`) was **literally** the placeholder of the
other. Nothing on the screen said which was which.

**Cause.** An agent that builds by region. Each door was written in one session,
in one file, solving one request, and neither session looked at the assembled
screen. It is the most likely defect of code made in parallel, and the least
likely to be seen by whoever wrote either half.

**Fix.** Rarely "delete one": both are usually needed. It is moving one
ELSEWHERE, so each screen has a single door and the door says what the screen
does. In the real case, pasting a link became an action of the queue tab, which,
as a bonus, was the only tab with no way to add a record.

**Test.** Count the doors of the same kind per screen. Two, ask out loud which is
which. If the answer needs the code, the screen does not answer.

**Detector.** `noise-scan`, rule `repeated-door`, the only rule in the skill
that runs ACROSS files, because this defect does not fit in one. Since
2026-10-05 it only flags the two doors **on the same screen** (common ancestor in
the import graph, with no early `return` or ternary separating them): from 25
hits, almost all false, it went to 2 real ones.

**Form 2 went back to judgment.** The same name for different things on
different screens ("link ou arquivo" for the room's textures and for the music
box) is a vocabulary defect, not a layout one, and the detector no longer
enforces it. Auditor's question: does each name repeated across screens mean the
same thing?

## 22. The highlight that highlights everything

**Symptom.** Three out of three cards lit with the accent color. The whole grid
in cyan, purple, whatever, and the item that really matters indistinguishable
from the rest.

**Real case** (jukebox, 2026-09-11). Every record in the queue came with
`on: true`, and the `.on` class lights border, shadow and name. With three
records in the box and all three in the queue, "no ar" looked the same as "3º na
fila". The screen's only highlight had been spent on a fact a 9px badge already
told.

**Cause.** The highlight was written in the item factory, and the factory runs
once per item. `on: true` is a correct line; it is only a defect on the third
repetition, and whoever wrote it saw the screen with one item.

**Fix.** The highlight receives the condition that decides (`on: q.live`). State
that is not the highlight becomes a badge, a number or text weight. One
highlight per region.

**Test.** Count the pieces lit at the same time. More than one per region, the
highlight means nothing, and "meaning" is its only job.

**Detector.** `noise-scan`, rule `highlight-at-rest`.

## 23. The word cut in half

**Symptom.** A piece of a word inside a card, a button or a badge. It reads
"tirar da". Or two overlays in the same corner, and the top one hides precisely
the ACTION.

**Real case** (jukebox, 2026-09-11). The action pill had `white-space: nowrap`
and lived in a 96px square with `overflow: hidden`. "tirar da fila" at 10px does
not fit in 96px: the rest was cut, and the piece left over landed on top of the
badge that already said the same thing.

**Cause.** The width of a word does not exist in the code; it exists after the
font loads and layout happens. `tsc` passes, lint passes, the test passes, the
gate passes. **Only the open screen knows.**

**Fix.** A width ceiling on everything that is an overlay (`max-width: calc(100%
- 12px)`) and let it wrap; a category verb becomes an ICON, which has no word
width; and a corner taken by another overlay shifts one slot, instead of
stacking.

**Test.** Open the screen at the width that squeezes (390px) and run the
detector. By eye this escapes: the leftover piece looks like a short word.

**Detector.** `corta-scan.js` in the browser console: `corta('.painel')`. It
separates cutting from scrolling, from ellipsis and from a rail that scrolls
sideways, the three things the eye confuses with cutting. And it separates a
badge from a hidden piece: a small badge (< 25% of the area) over an `inset-0`
background with nothing interactive, like "Pública" over the cover of a brand
card, is not a stacked overlay.

## 24. Synthetic cover

**Symptom.** A media card without an image gets an invented "cover": a gradient
picked by a hash of the name, a giant initial in the middle, a dot grid. The
list looks full and colorful, and no cover means anything.
**Cause.** The AI is horrified by emptiness and fills it with decoration that
looks like data.
**Fix.** A real cover (screenshot, thumb, logo) or an honest empty: neutral
token background and the icon of the item's TYPE, the same on all of them. The
design system's `MediaTile` exists for this; a media card rewritten by hand is
what lets the synthetic cover come back.
**Test.** Two synthetic covers side by side in different colors: the user will
look for what the color means.
**Detector.** `noise-scan`, rule `synthetic-cover` (hue from a hash of the name,
or data colors turned into a gradient near a missing image). A gradient that
SHOWS the brand palette (a guideline swatch) is brand data and passes.

## 25. Image tile without `onError`

**Symptom.** A blur, smudge or eternal skeleton in place of the photo; or the
browser's broken-image icon.
**Cause.** A raw `<img>` with no fallback, and bad data nobody filters. In the
2026-10 round the references `MasonryCard` had no `onError`, and the server
accepted `/api/local-image?path=Z:\` as "has an image" (a path on the curator's
machine, dead on any other).
**Fix.** A content image goes through `Thumb`/`MediaTile`, which has a fallback
and reserves the box; whoever needs to react to the failure (drop the item from
the list) uses the tile's `onImageError`, not a `div` around it. And the filter
lives on the server: an item without a servable image does not enter the grid.
**Detector.** `noise-scan`, rule `tile-img-no-onerror` (`<img>` with
`object-cover`/`aspect-*` and no `onError`; upload preview, blob and build asset
stay out).

## 26. Masonry without reserved height

**Symptom.** A column grid where the 1st column is right and the others become a
stack of thin lines, or everything jumps when the images arrive.
**Cause.** A tile with no height before the image loads: the algorithm
distributes zero-height items. Seen in `MyOutputsPage` + `Masonry`.
**Fix.** Reserve the box with `aspectRatio` (from metadata, or a fixed ratio per
type) before `onLoad`. `Thumb` does this since 2026-10.
**Test.** Open with the network on "Slow 3G": the grid must not move.

## 27. The same information said three times in the shell

**Symptom.** The breadcrumb says "Meus Mockups", the page header says "Salvos",
the rail says "outputs". Or the right name, repeated at the top, in the title
and in the subtitle.
**Cause.** Each layer (shell, page, component) was written without seeing the
others, and each one "introduces itself".
**Fix.** One name per screen, from a single key (`nav.<section>.label`). Inside
the shell, the shell says where you are: the page does not repeat the title
(`useInAppShell()` hides the duplicated header).
**Test.** Read the screenshot top to bottom: does the screen's name appear more
than once?

## 28. A "credit" regex deciding the paywall

**Symptom.** A user with balance sees "Comprar créditos" when the provider goes
down.
**Cause.** `/crédit/i.test(error.message)` decides the modal. The 503 message
was "seu crédito foi estornado", and it matched. And a substring of translated
text never matches in the other language.
**Fix.** Decide by code: status 402 or `code: 'insufficient_credits'` from the
server. A message is for showing, never for branching.

## 29. `charged = true` without reading the return

**Symptom.** A balance that grows by itself: an admin, BYOK or unlimited account
gains credit on every error.
**Cause.** The route sets `charged = true` after calling the charge, without
checking whether it charged. Admin, BYOK and unlimited are not charged, but the
`catch` refunds 1 credit. Found in `generate-naming` and twice in
`node-builder.ts`, and it only showed because verification opened `/naming` on
the real database.
**Fix.** `charged` comes from the charge's return, and the refund gives back only
what was charged. It is backend slop, but the open screen is what gives it away:
hence the paid-route lock in `verify-screens.mjs`.

## 30. Staircase list

**Symptom.** The grid items come in one after another, each 50ms later. Pretty
with 4 items; with 30, the last one waits 1.5s, on every filter and every return
to the page.
**Cause.** The agent wants the list to "come alive" and writes
`delay: index * 0.05`.
**Fix.** The list comes in whole, at once (or only the container animates). A
work screen does not stage a show.
**Detector.** `noise-scan`, rule `stagger-by-index`.

## 31. The card that jumps

**Symptom.** A card rises (`hover:-translate-y-1`) or its image grows
(`group-hover:scale-105`) on mouse over. Measured in 2026-10: 26 cards in
AdminPage with the same `-translate-y-1`.
**Cause.** A 2021 landing template applied to a work screen.
**Fix.** Hover changes color, border or shadow. It does not exist on touch and
says nothing the border would not. A scale below 1 on `active:` (sinking) is
something else and stays.
**Detector.** `noise-scan`, rule `hover-lift`.

## 32. Dot grid background

**Symptom.** A repeated `radial-gradient` with `background-size`, an SVG of
circles or `<GridDots>` behind a page, panel or empty cover.
**Cause.** "AI product" texture copied from a landing; it fills emptiness with
noise. In the 2026-10 round it lived in `PageShell` and came out on every route.
**Fix.** Flat token background. A large radial glow (an ellipse without
`background-size`) is something else and passes.
**Detector.** `noise-scan`, rule `dot-grid`.

## 33. Primitive rewritten by hand

**Symptom.** A cyan CTA written in the class (`bg-brand-cyan/10
border-brand-cyan/30`), `<label border-dashed><input hidden/></label>` as an
upload area, a button group playing selector, a media card with its own
`<img>`. Each one slightly different from its neighbor.
**Cause.** The primitive did not exist when the screen was written, or the agent
did not look. Each copy diverges in radius, focus, hover and fallback.
**Fix.** The house primitives (2026-10): `Button variant="primary"` (tool CTA)
and `variant="brand"` (showcase only), `Dropzone`, `SegmentedControl`,
`MediaTile`, `Modal` (`bodyClassName` instead of a negative margin). Contract in
`visant-frontend/references/ds-visantlabs-os.md`.
**Test.** Two screens, the same gesture: are the two controls the same
component?

## 34. Scroll indicator in the hero

**Symptom.** "Role", "Scroll", "Scroll down", "Explore", a mouse icon, an arrow
or a line that drips/bounces at the foot of the hero, centered.
**Cause.** Landing template ornament the AI puts in every full-screen hero.
Nobody needs to be taught to scroll a page; the indicator only takes the noblest
spot of the fold with an obvious instruction and a loop that pulls the eye.
**Fix.** Always delete it, with its copy key and its `@keyframes`. If the fold
looks "closed", the fix is composition (image crop, content bleeding into the
next section), never a sign telling people to scroll.
**Detector.** Quick sweep below. The house owner's rule (2026-10-19, client Y).

> **35 to 46: the showcase round (2026-10-20).** The owner opened ~140 pieces of
> `@visant/ui` one by one and left ~100 one-sentence reports. All of them passed
> tsc, lint, `casa-lint`, `interacao-check` and `palco-check`. The defects below
> only exist by looking: they are decisions, not syntax. The full showcase
> procedure is in `visant-frontend/references/component-showcase.md`.

## 35. The frame that speaks for the piece

**Symptom.** A component's demo wrapped in a fake navbar, a "Briefing" card, an
invented toolbar, a caption "passe o mouse", "clique pra ver", "mova o
ponteiro"; the piece takes a third of the frame.
**Cause.** The agent "contextualizes" the piece by building a screen around it,
and each part of the screen competes with it for the eye. Reports: "mal
apresentado", "foco no componente cara", "não entendi a necessidade do card".
**Fix.** The piece large and centered, in the smallest credible context; no
instructions. If the piece does not explain itself, the defect is in its
affordance.
**Test.** Cover the piece with your finger: is more than one line of stuff left
in the demo?

## 36. Stacked variations

**Symptom.** 4 skeletons, 6 loaders, 3 toggles, 4 frames side by side on the
same stage, each one squeezed.
**Cause.** Showing "everything the piece does" at once. On the tile none of them
shows.
**Fix.** **One at a time**: one large variation and a discreet selector (tiny
text or arrows) that switches and replays. The owner's word, repeated on 6
pieces: "UM POR VEZ".

## 37. Piece that is born dim

**Symptom.** Glow, perspective, tilt, menu or island only appear on hover; at
rest the piece is a neutral rectangle.
**Cause.** The beautiful state was designed as a response, not as presentation.
It does not exist on touch, on the tile, in the screenshot or in the shared
link.
**Fix.** Born in its best state ("nascer em perspectiva e brilhando por
default"); hover intensifies, it does not reveal.

## 38. Secondary control louder than the piece

**Symptom.** Chips with a border and brand color to switch the demo mode
("Ligação / Timer / Música"), a switch labeled "Mostrar modo X", a state
selector bigger than the component.
**Cause.** The demo control uses the same visual vocabulary as the piece.
**Fix.** Tiny text at the foot, no box, no brand; or the modes go to the panel
knobs. No toggle with an instruction label ("toggle com label não dá").

## 39. Permanent label that depends on state

**Symptom.** "Apagar selecionados", "0 itens", "Nada aberto ainda" visible with
nothing selected or open.
**Fix.** The label is born with the state: the button is icon-only until there
is a selection; the "0" disappears (a zeroed facet goes away instead of showing
zero).

## 40. Amateur animation

**Symptom.** A 200° spin, overshoot on everything, 20+ particles per item, a big
jump, a spring that bounces three times. Report: "animação tá mt amadora kkk".
**Cause.** Amplitude mistaken for quality.
**Fix.** Cut the amplitude in half and again: a ~12° spin, scale of 0.4–0.9, few
weak particles, no overshoot on an element that disappears. Good motion is
barely noticed (see `visant-motion`, "amplitude").

## 41. Everything moving at the same time

**Symptom.** A screen with a queue moving, images arriving, a % bar, a toast and
an error all animating together. Report: "mt coisa espremida e acontecendo ao
mesmo tempo".
**Fix.** One focus of motion at a time: states in sequence (sent → generating →
ready → exporting), the rest still.

## 42. Client copy leaking into the library

**Symptom.** A reusable piece's demo with the name, slogan, product or theme of
an agency client ("Tema cliente K", "Altura do jogador", diffuser and candle).
**Cause.** The piece was harvested from a project and the demo came along.
**Fix.** Generic, short text in spoken pt-BR; fictional person names. When
harvesting, swap the copy in the same pass. Sweep the whole library when a case
shows up: "tem q ser agnóstico, todos os da library".

## 43. The scaled stage lying

**Symptom.** Cursor/dot far from the pointer, a drag that moves more than the
finger, a 3D canvas crooked or in the corner, a menu cut when it opens, a piece
"cortando as bordas".
**Cause.** The stage applies `transform: scale`: `position: fixed` measures from
the box, the pointer delta is in screen px, the canvas measures the already
scaled size, and `overflow`/`contain` clips whatever is not in a portal.
**Fix.** Portal to `body`; delta divided by the scale; `resize={{
offsetSize: true }}` in R3F; dropdown in a portal; a box (`preview`) the real
size of the piece. Full table in `component-showcase.md` §3.
**Test.** Run the piece with the stage at `scale(0.5)` and drag.

## 44. System scrollbar and a list that scrolls sideways

**Symptom.** A white track with arrows in the dark theme; a list/search with
horizontal scroll because one column ("Componente") does not fit.
**Fix.** At the root: `scrollbar-width: thin` and `scrollbar-color` in the line
tone. List: `overflow-x: hidden`, columns that truncate, and common data is not
repeated on every row.

## 45. Category in internal jargon

**Symptom.** Filters "Aquisição", "Superfície de trabalho", "Fundação"; subfilter
`ui / block / lib`. Report: "não entendi a tag aquisição e as subtags".
**Fix.** Category by what the thing IS (Controles, Dados, Navegação, Mídia,
Texto, Efeitos, 3D…), type in Portuguese, aliases for the old names in the
route.

## 46. Clickable without a hand cursor

**Symptom.** A card, tile button, tab or arrow that responds to a click with the
arrow cursor; a drag without `grab`. Reports: "cursor pointer tb obviamente",
"rail: cursor pointer".
**Cause.** The Tailwind v4 preflight leaves `button` with `cursor: default`.
**Fix.** One rule in the shell (`:is(button,[role=button],a[href],summary)
:not(:disabled){cursor:pointer}`); `grab`/`grabbing` on what is dragged.

## New signals, not yet measured in a round (47–57)

Signals 47–57 by Pedro Jaques (2026-10-28).
Unlike the 46 above, none of them has yet a case from a round with
`file:line`: they count as suspicion and as a test, not as a verdict. When one
shows up in a real report, it gets the case and moves up.

The common thread: **ornament that imitates care**. Each one is what a carefully
made LP has, copied without the reason it was there.

Before fixing by hand, check whether the piece already exists refined in the
Visant library ([ui.visantlabs.com](https://ui.visantlabs.com), `npx shadcn@latest
add @visant/<name>`): a tag becomes `chip`, divider and box disappear into a
`section-intro` or `step-cards`, an over-detailed panel becomes `gauge` or
`measure-bar`. A piece from there has already passed this audit; a piece
rewritten on the spot is a candidate again.

### 47. Tag on everything

**Symptom.** A chip or pill on every card ("Novo", "IA", "Beta", the category), a
badge above the title, three tags under the description.
**Fix.** A tag only when it filters or changes a user decision. The rest becomes
running text or goes. Related to 13 and 45.
**Test.** Delete them all. If nothing was lost, they do not come back.
**Detector.** `noise-scan`, rule `tag-everywhere` (6+ badges, chips or hand-made
pills in one file; a clickable chip is a filter and passes).

### 48. One word in italics in the headline

**Symptom.** "Design que *converte*": an `<em>` (almost always an italic serif)
on one word of the title.
**Fix.** Emphasis comes from the sentence, not the font. Italics only where the
language asks for it (a work's title, a foreign word).
**Test.** Read aloud, does the italic word change the meaning? If not, it is a
tic.
**Detector.** `noise-scan`, rule `italic-headline-word` (`<em>`, `<i>` or
`italic` inside an h1/h2 or display-size text; a heading italic as a whole
passes).

### 49. Instrument Serif with negative tracking

**Symptom.** A headline in Instrument Serif (or the free display serif of the
moment) with `tracking-tight`, `tracking-[-0.04em]` or a negative
`letter-spacing`. It became the uniform of generated LPs.
**Fix.** The font is the brand's. Negative tracking only where that font asks
for it at that size, measured on the screenshot, never by default.
**Test.** Swap in the brand font. If the page loses its "look", the look was
borrowed.
**Detector.** `noise-scan`, rule `display-serif-tight` (Instrument Serif or
`font-serif` plus negative tracking on the same element).

### 50. Over-detailed UI

**Symptom.** A dashboard mock in the hero with forty tiny elements, micro-icons,
a sparkline in every corner, invented numbers.
**Fix.** Show the one thing the product does, at a size that reads. Density
simulates sophistication and proves nothing. Related to 20 and 24.
**Test.** Shrink the screenshot to 50%. Whatever became texture goes.

### 51. A divider between everything

**Symptom.** `<hr>`, `border-t`, `divide-y`, `<Separator>` separating blocks that
spacing already separated.
**Fix.** Space and alignment group. A line only in a table and a dense list.
**Test.** Delete the dividers. If the grouping stays readable, they stay
deleted.
**Detector.** `noise-scan`, rule `divider-everywhere` (8+ in one file; table
rows, list items, sticky bars, vertical separators and toolbar, sidebar or menu
files pass).

### 52. Opacity ladder

**Symptom.** `text-white/90`, `/70`, `/50`, `/40` in the same block;
`bg-primary/5`, `/10`, `/20` on neighboring cards.
**Fix.** Two or three text tones from the token (`foreground`, `muted`) and
that is it. Hierarchy by transparency is a raw color under another name (15).
Related to 1.
**Test.** More than three levels of gray in the same block: none of them means
anything.
**Detector.** `noise-scan`, rule `opacity-ladder` (one color utility in 4+
opacity steps in one file; `hover:`/`focus:` states and `text-sm/6` line height
do not count).

### 53. A bordered box around everything

**Symptom.** Every group in a `border rounded-xl` box; a box inside a box.
**Fix.** One level of container. Group by space; a border only where there is a
real limit (input, table, clickable area). Related to 35.
**Test.** A box inside a box is always one too many.
**Detector.** `noise-scan`, rule `box-in-box` (2+ in one file; fields, buttons,
links, tags, tabs, swatches and anything inside a `fixed`/`absolute` layer
pass).

### 54. Diagram, and the more detailed the worse

**Symptom.** A flowchart of nodes and arrows, an isometric, an "architecture"
explaining what fit in one sentence.
**Fix.** A diagram only when the relation does not fit in a sentence and the
reader will come back to consult it. Otherwise, the sentence.
**Test.** Describe the diagram in one sentence. If it fit, swap it for the
sentence.

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
**Fix.** A number only where the order matters (steps of a process).
**Test.** Swap two sections. If the number does not change the meaning, it goes.
**Detector.** `noise-scan`, rule `numbered-section` (2+ in one file; numbers
generated in a `.map` stay with the eye).

### 57. Mono on everything

**Symptom.** `font-mono` on eyebrow, label, button, nav, date, counter, card
caption: the code font becomes the page's second font.
**Fix.** Mono only on what is really code: serial, hash, ID, command, a snippet
someone copies. The rest uses the text font, with `tabular-nums` where numbers
need to align. Generalizes 2 (money) and 55 (code breadcrumb); uppercase mono on
a label is already the `shouting-label` rule of `noise-scan`.
**Test.** Swap all mono for the text font. Whatever got worse (ID, hash,
command) comes back; the rest stays.
**Detector.** `noise-scan`, rule `mono-everywhere` (10+ in one file, outside
`pre`/`code`/`kbd` and ID-like content).

## Signals from tool panels (58–63)

From the DialKit 2.0.2 panel against its fork on
[scaena.darkroom.engineering](https://scaena.darkroom.engineering) (2026-10-29),
the same controls redrawn side by side. Suspicion and test, like 47–57, until a
round gives them a `file:line`. The common thread: **every control drawn as the
same generic row**, so the panel says nothing about its data. Rules and the
full case: `visant-refine` [control-panels.md](../../visant-refine/references/control-panels.md).

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

For entries 20, 21, 22 and 23 do not use grep, and the reason is the same for
all four: the defect does not live in any line. 20 lives in the sum of the
lines; 21, BETWEEN two files; 22, in the repetition of a correct line; 23, in
the width that only exists after the font loads. Grep takes one line at a time;
that is why the first three are rules of `noise-scan.mjs` and the last one is
`corta-scan.js`, which runs in the browser with the screen open. Entry 6 is
the same story: inside-vs-between is two numbers from two files, so
`ritmo-scan.js` measures it after layout.
