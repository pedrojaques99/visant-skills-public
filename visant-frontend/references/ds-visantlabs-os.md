# Example of a real design system: one product app's contract and chrome tokens

**This is an example, not a requirement.** It documents the design system of
one real Visant product app (visantlabs-os, a Vite + Radix app with its own
`src/components/ui/`), as it stood after a slop-cleanup pass. Use it to see
what a "default path" table and chrome-token contract look like, then **build
the equivalent for the target repo**: find its `ui/` folder, its catalog page
(if any), and the pieces people keep rewriting by hand.

In that app: before hand-writing a card, selector, modal, CTA or upload, read
the piece here. Missing a variant: parameterize the piece (with approval), don't
copy its markup out of it. The live catalog is the `DesignSystemPage`
(`#media-tile`, `#segmented-control`, `#dropzone`, `#buttons`).

## The default path (what the cleanup found rewritten by hand in dozens of places)

| Need… | Use | Don't write |
|---|---|---|
| media card | `MediaTile` (`ui/MediaTile.tsx`) | `<img>` + gradient + `scale` on hover + `opacity-0` actions, nor a `div` around it for drag/`data-*` |
| single choice among 2 to 5 options | `SegmentedControl` (`size="xs" scrollable` in a narrow panel) | a row of buttons with a hand-painted active state |
| dialog | `Modal` (`bodyClassName` for edge-to-edge content) | a hand-rolled portal, negative margin fighting the padding |
| the main action of a tool or panel | `Button variant="primary"` | hand-written `bg-brand-cyan/10 border-brand-cyan/30`. Solid cyan is `brand`, showcase only, never in the same panel |
| upload area | `Dropzone` | a `div` with `onDrop` |

## MediaTile (`ui/MediaTile.tsx`)

The only media card. No cover zoom, no black gradient, no blur, no
`transition-all`: hover only changes the border.

| Group | Props |
|---|---|
| cover | `src`, `alt` (required), `aspectRatio` (reserves the box before load), `layout` `stacked` \| `overlay` \| `masonry`, `imageClassName`, `loading`, `placeholder` (LQIP/thumbhash), `onImageLoad` / `onImageError` |
| no image | `fallback` (a node, wins over the icon: `<BrandAvatar />`), `fallbackIcon` + `fallbackLabel` |
| text | `title`, `subtitle`, `subtitleLines` `1` \| `2`, `meta`, `leading` (avatar next to the title), `density` `default` \| `compact`, `editableTitle` |
| action | `onClick(e)` **or** `href`, `actionLabel`, `selected` (becomes a toggle with `aria-pressed`) |
| controls | `actions` (revealed on hover, always on touch and focus), `persistentActions` (always visible), `actionsVisible` `hover` \| `always`, `badge` (top-left corner), `footer` (bar under the cover), `busy` |
| root | `...rest`: `data-*`, `id`, `draggable`, `onDragStart`, `onContextMenu`, `aria-*` go to the root `div` |

What breaks if ignored:

- **Don't wrap it.** Not in `button`/`a`/`Link` (the action is already
  stretched over the tile), nor in a `div` to hang `data-*`, drag or
  `onContextMenu`: all of that goes straight on the tile via `...rest`. The
  native `title` does **not** pass through (`title` is the ReactNode).
- **`persistentActions` vs `actionsVisible="always"`.** One control needs to
  stay (a like with a count): `persistentActions`, and the owner/admin actions
  stay on hover. The whole mode asks for it (batch selection): `actionsVisible`.
  The like count lives inside the button, not repeated in `meta`.
- **`onClick(e)`** reads `e.shiftKey`/`e.metaKey` directly. `onClickCapture` +
  a ref to detect shift is the old pattern.
- **Drag:** `draggable` + `onDragStart` on the tile. The stretched button is
  draggable too, the ghost is the whole tile and the `<img>` is
  `draggable=false`. Covered by a jsdom test; real Firefox was not verified.
- **`editableTitle`** swaps the visible title (rename input) and sits above the
  stretched action, so typing doesn't fire `onClick`. Keep passing `title` or
  `actionLabel`: it's the accessible name.
- **`busy`**: `true` shows a neutral spinner, a node renders as given. It has
  `pointer-events-none` and sets `aria-busy`; to lock actions during the state,
  use `inert` on the controls.
- **`footer` adds height.** A wrapper with a fixed ratio + `overflow-hidden`
  clips the bar: the tile's `aspectRatio` is what sets the ratio.
- **`layout="overlay"`** forces ratio 1 without `aspectRatio` and leaves the
  title accessible-only. A label that must be read (similar logo variants) asks
  for `stacked`; in a grid with tiles under ~140px, `density="compact"`.
- Nothing interactive in `title`/`subtitle`/`meta`; a menu inside `actions`
  with `stopPropagation`.

`Thumb` (`ui/Thumb.tsx`) is the cover underneath and accepts `fallback` and
`placeholder` on its own. A content image outside a card also goes through it.

## SegmentedControl (`ui/SegmentedControl.tsx`)

Single choice among 2 to 5 options (Radix ToggleGroup, `radiogroup`, never left
without a value). `options[{value,label,icon?}]`, `value`, `onChange`,
**`aria-label` required**, `size` `xs` \| `sm` \| `md`, `variant` `default` \|
`accent`, `fullWidth`, `scrollable`.

- Segments shrink and the label truncates with a native `title` only while it
  is clipped. With room, nothing changes.
- Five tabs in a 280px panel: `size="xs" fullWidth` (shrink evenly) or
  `size="xs" scrollable` (scrolls sideways and brings the active one into view).
  A hand-written `className="overflow-x-auto scrollbar-none"` is the old pattern.
- Options with a union type: pass the generic (`<SegmentedControl<TabType> …>`).

## Modal (`ui/Modal.tsx`)

Panel with `shadow-[var(--e-modal)]`, `rounded-xl` (mobile drawer
`rounded-t-xl`) and no blur; blur stays on the backdrop only. `bodyClassName`
is the scrolling body, merged after the default `p-6 sm:p-10 md:p-12`:
edge-to-edge content (sticky toolbar, full grid) zeroes **every** breakpoint,
`p-0 sm:p-0 md:p-0`. A negative margin fighting the padding is the old pattern.

## Button: `primary` vs `brand`

| Variant | Is | Where |
|---|---|---|
| `primary` | tinted cyan, `foreground` text | the ONE main action of a tool or panel (Compress, Export) |
| `brand` | solid cyan, black text | showcase only: landing, pricing, paywall, end of onboarding |

A panel has at most one cyan action, and it is `primary`. The two never share
a panel. A chip or selected state is not `primary`. An explicit
`font-semibold` on a `<Button>` is redundant (the base is already
`font-medium`), and `toolbar` is now regular `text-xs`, no uppercase.

## Dropzone (`ui/Dropzone.tsx`)

`onFiles(File[])`, `accept`, `multiple`, `disabled`, `label`, `hint`, `icon`,
`size` `sm` \| `md`. It is a real `<input type="file">` (Tab reaches it, Enter
and Space open it). Inside a shell that already handles drag-and-drop, pass
`dropTarget={false}`, or the file is processed twice.

## Chrome tokens

They apply to the app's chrome. Left out: surfaces that render the client's
BRAND (brand guideline previews, read-only brand views, quote documents, theme
previews) and the admin.

**Radius: three names.** `rounded-md` = control (button, input, chip),
`rounded-xl` = surface (card, panel, dialog), `rounded-full` = pill, avatar,
dot. In that app's `index.css`, `sm` draws the same as `md` and `lg`/`2xl` the
same as `xl`; a codemod leaves one name per level without changing a pixel:

```bash
node scripts/codemod-radius-scale.mjs           # dry-run: lists the swaps
node scripts/codemod-radius-scale.mjs --apply   # sm→md, lg/2xl/3xl→xl
```

`3xl` is the only one that changes value, and the codemod doesn't touch it on a
brand surface. Don't reintroduce `sm`/`lg`/`2xl`/`3xl`.

**Weight.** `font-semibold` only on the main title of each region and on a
highlight number (balance, price, score); `bold`/`black` become `semibold`.
Section title, label, button, card name and badge are `font-medium`.

**Raw opacity becomes a token** (the map the cleanup applied):

| Was | Becomes |
|---|---|
| `text-white/NN` | `text-foreground` or `text-muted-foreground` |
| `bg-white/<10` | `bg-muted` |
| `bg-white/≥10`, hover | `bg-accent` (in this app `--accent` is the hover neutral) |
| `border-white/<20` | `border-border` |
| `border-white/≥20`, hover | `border-border-hover` |
| focus | `border-ring` |
| selected | `bg-accent` + `border-ring` (must stay different from unselected) |
| scrim with no photo under it | `bg-background/80` |
| scrim over media | stays `bg-black/NN`, with a written exception (see `visant-killer`) |

Never `border-foreground/*`: the linter reverts it to dark. Use `border-ring`.

**Hue.** Red, amber and green are `destructive`/`warning`/`success`.
Categorical is `chart-1..5`, on fill and border, with `text-foreground`:
`chart-N` doesn't work as a text color (the dark `chart-1` has L 0.49 on a dark
background; the light `chart-4`/`5`, L 0.77 to 0.83 on white).

**Micro-label.** Mono + uppercase + tracking only on a technical value (hex,
extension, code). A label becomes sans `text-xs`.

## Always-dark editor: `.dark` on the root, tokens inside

Canvas, the create flow, the 3D studio, the image lab and the editor
mini-tools are dark in both themes. The rule: **the editor root declares the
`dark` class and the editor uses tokens.** `index.css` defines the tokens under
`.dark {}` and the dark variant is `&:is(.dark *)`, so the subtree resolves the
dark tokens even with the app in light theme, and nothing changes in dark theme.

In that app it is declared on the canvas page root, the tool editor shell
(`<AppShell className="dark text-foreground">`) and the 3D studio page
(`<div className="dark contents">`).

Two anti-patterns:

- A token in a `bg-neutral-950` panel with no `.dark` above it: in light theme
  `text-foreground` goes dark on dark.
- Swapping `white/NN` for a fixed `neutral-800` to dodge that. It was the
  cleanup's stopgap in two editors. With `.dark` on the root, the right swap is
  to a token.

A portal (Radix popover, dialog, tooltip) renders in `body`, outside the
subtree: check in light theme what the editor opens through a portal.

That repo's `scan-lightmode-breakage` treats a file that declares a bare `dark`
class as an always-dark stage (suppresses the file and counts it in
`--summary`), and excludes editor folders by path. It reads per file: a child
in another file that only lives inside the editor carries
`// lightmode-ignore-file: <rule> (only renders inside the .dark editor)`.
