# Implementation: Tailwind v4 + React + Radix

The principles are stack-agnostic; this file is the Visant implementation.

**Common denominator these patterns assume: Tailwind v4 + React + Radix-family
primitives.** Above that line every repo differs, so check the target repo
before assuming:

- **Build:** look for `vite.config.*` or `next.config.*` (and for Next, is there
  an `app/` folder, i.e. App Router?).
- **Primitives:** is there a `components.json` at the root? Then it is shadcn/ui
  and `npx shadcn@latest add` applies. No `components.json` but `@radix-ui/*`
  packages in `package.json`? Then it is raw Radix with its own `ui/` folder, and
  `npx shadcn add` does not apply.
- **DS pieces:** find the `components/ui/` (or `src/components/ui/`) folder and
  read what already exists (media card, segmented picker, tab strip, dropzone,
  modal) before using the generic snippets below.
- **Icons, motion, toast, i18n, theme:** check `package.json` (e.g.
  `lucide-react`, `framer-motion`, `sonner`, `next-intl`, `next-themes`).

Example of how this varied across three real projects:

- CRM app: Vite, shadcn/ui (`components.json` present), lucide, framer-motion,
  sonner.
- Product app with its own DS: Vite, Radix packages directly, own
  `src/components/ui/`, **no `components.json`**. Its media card, segmented
  picker, narrow tab strips and upload zone were already DS pieces; see
  [ds-visantlabs-os.md](ds-visantlabs-os.md) as an example of such a contract.
- Client sites: Next.js App Router, per template, next-intl, next-themes,
  framer-motion.

Always use semantic theme tokens (`bg-card`, `text-muted-foreground`,
`border-border`, `text-success`, `text-warning`) — never hard-coded colour. That
is what makes both themes work without a second pass.

- [Intrinsic grid](#intrinsic-grid)
- [`min-w-0` — why a flex/grid child pushes the page sideways](#min-w-0--why-a-flexgrid-child-pushes-the-page-sideways)
- [A table sets its own width unless you take it away](#a-table-sets-its-own-width-unless-you-take-it-away)
- [The primitive's mobile default is not yours](#the-primitives-mobile-default-is-not-yours)
- [Three-zone card](#three-zone-card)
- [Reveal on hover — the touch-safe way](#reveal-on-hover--the-touch-safe-way)
- [Hover action rack](#hover-action-rack)
- [Hover-revealed selection](#hover-revealed-selection)
- [Controlled dialog opened from a menu](#controlled-dialog-opened-from-a-menu)
- [Tabbed modal with one primary action](#tabbed-modal-with-one-primary-action)
- [Close the surface before the exit ritual](#close-the-surface-before-the-exit-ritual)
- [Split a per-second value into its own context](#split-a-per-second-value-into-its-own-context)
- [Route group is the chrome boundary](#route-group-is-the-chrome-boundary)
- [A class name assembled at runtime does not exist](#a-class-name-assembled-at-runtime-does-not-exist)
- [A regression guard that reads source](#a-regression-guard-that-reads-source)
- [Keyboard guard order](#keyboard-guard-order)

## Reveal on hover — the touch-safe way

`sm:opacity-0 sm:group-hover:opacity-100` is the trap. It uses **width as a proxy
for "has a mouse"**, and the proxy is wrong on the most common field device: a
tablet has ≥640px and *no* hover, so the control renders invisible **and**
unreachable — no intermediate state ever hints it's there. Ask the real question
with `(hover: hover)`, and always pair it with `focus-visible` for the keyboard:

```ts
// lib/utils — one helper so the idiom lives in exactly one place
export const REVEAL_ON_HOVER =
  "transition-opacity focus-visible:opacity-100 " +
  "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100";
```

```jsx
// pointer device: hidden until the row is hovered.
// touch (no hover): always visible — never a dead control.
<Button className={cn("h-9 w-9 sm:h-7 sm:w-7", REVEAL_ON_HOVER)} … />
```

Keep the tap target ≥36px on touch even when the pointer version is 28px
(`h-9 w-9 sm:h-7 sm:w-7`). The [source-guard test](#a-regression-guard-that-reads-source)
keeps the `sm:opacity-0` shape from creeping back.

## Intrinsic grid

Do not guess breakpoints. Let the card declare its minimum comfortable width and
let the column count fall out:

```jsx
<div className="grid gap-5 grid-cols-[repeat(auto-fill,minmax(min(22rem,100%),1fr))]">
```

The inner `min(22rem,100%)` prevents overflow on viewports narrower than the
minimum. This replaces `sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` and is
correct at every width, including ones never tested.

Raise the `22rem` when card content grows (adding a logo to the identity zone
squeezes the name); lower it for sparse cards.

## `min-w-0` — why a flex/grid child pushes the page sideways

A flex or grid item defaults to `min-width: auto`, which means **its min-content
is a floor**: the track cannot get narrower than the widest unbreakable thing
inside it. One forgotten `min-w-0` and the item silently becomes the page's
minimum width.

```jsx
{/* Reads as "one column on mobile, sidebar on large". It is not. */}
<div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
  <section className="min-w-0">…</section>
  <aside>…</aside>              {/* ← 612px of min-content on a 387px screen */}
</div>
```

The `minmax(0,…)` in the template only guards the large breakpoint. On mobile the
grid collapses to a single `auto` track sized by the **largest item min-content** —
so the aside dragged both columns 240px past the viewport.

Rules that follow:

- Every flex/grid child that holds text gets `min-w-0`. Not just the one you
  expect to be long — the floor is set by whichever child is worst.
- `truncate` **needs** `min-w-0` on itself and on every flex ancestor between it
  and the constrained box. Truncation cannot shrink a box whose floor is
  min-content.
- Siblings drift: fixing one child and not the other is the common shape of this
  bug, because the fixed one stops being the offender and hides the other.
- The same reasoning applies one level up — an app-shell content pane beside a
  sidebar needs `min-w-0` or a wide kanban expands the page instead of scrolling
  inside its own section.

→ *throughput*

## A table sets its own width unless you take it away

`<table>` defaults to `table-layout: auto`: column widths come from content, and
a long unbreakable string makes the table wider than its container regardless of
`max-w-full` on the wrapper. Third-party widgets (FullCalendar's list view,
generated report tables) hit this constantly.

```css
.fc-list-table { table-layout: fixed; width: 100%; }
.fc-list-event-title { overflow-wrap: anywhere; }
.fc-list-event-time { width: 6.5rem; white-space: normal; }  /* short, predictable → own width */
```

`table-layout: fixed` moves the decision from the content to you; `overflow-wrap:
anywhere` lets the long cell break. Give short, predictable columns an explicit
width or `fixed` will divide the space evenly and break "Dia todo" one letter per
line. → *throughput*

## The primitive's mobile default is not yours

shadcn's `Sheet` with `side="right"` is `w-3/4 … sm:max-w-sm`. Correct for a nav
drawer; wrong for a panel that holds an entire form, which then lives in 75% of a
phone screen with a dead overlay beside it.

Fix it **at the consumer**, never in the primitive — the default is right for its
other callers:

```jsx
<SheetContent className="w-full sm:max-w-2xl">   {/* tw-merge: w-full beats w-3/4 */}
```

Same shape for a `TabsList` that outgrows the screen: the primitive is
`inline-flex`, so five triggers simply run off the edge and the last tab becomes
unreachable. The consumer makes the strip scroll and the triggers rigid:

```jsx
<TabsList className="w-full justify-start overflow-x-auto overflow-y-hidden scrollbar-none">
  <TabsTrigger className="shrink-0" …/>
```

`shrink-0` is what turns "squeezed to illegible" into "scrolls" — without it the
flex just compresses the triggers and there is nothing to scroll. And confirm
`scrollbar-none` actually **exists** in the stylesheet: an undefined utility class
fails silently and looks like it worked. → *throughput, a11y*

## Three-zone card

```jsx
<motion.div className="group relative flex flex-col gap-4 rounded-2xl border
  border-border bg-card p-5 shadow-sm transition-colors hover:bg-accent/40
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">

  {/* 1 — identity + decision. pr-7 reserves the checkbox column for the
       WHOLE zone: the deciding datum sits top-right and would otherwise be
       covered by the absolutely-positioned control. */}
  <div className="flex items-start justify-between gap-4 pr-7">…</div>

  {/* 2 — alerts: rendered only when something is true */}
  {(overdue || flagged || status !== "new" || tags) && (
    <div className="flex flex-wrap items-center gap-1.5">…</div>
  )}

  {/* 3 — signal. mt-auto pins it to the bottom so cards of differing
       name lengths share a baseline. pr-24 permanently reserves the
       hover-rack corner so nothing shifts and nothing is covered. */}
  <div className="mt-auto flex items-center gap-3 pr-24 text-xs">…</div>
</motion.div>
```

`gap-4` between zones with tighter spacing inside each is what makes the three
groups legible without borders.

The rule behind it, for any unboxed stack: **inside < between**, each level at
least 2× the one inside it (`gap-2` inside a field, `gap-4` between fields,
`gap-8` between sections). Never the same `space-y-*` on three levels, never an
`mt-1` patching a gap, never `p-[13px]`. `ritmo-scan.js` (visant-killer) measures
the first two on the open screen; the scale linter catches the third.

## Hover action rack

```jsx
export function RackAcoes({ children }) {
  return (
    <div className="absolute bottom-4 right-4 flex items-center gap-0.5
      rounded-full border border-border bg-card/95 p-0.5 shadow-sm backdrop-blur
      transition-opacity group-focus-within:opacity-100
      [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100">
      {children}
    </div>
  )
}
```

Two guards, both non-optional. `group-focus-within` makes the rack keyboard
reachable. And the reveal is gated on `(hover: hover)`, **not** a bare
`opacity-0 group-hover:` — a plain `opacity-0` hides the whole rack on touch,
where there's no hover to bring it back (see
[Reveal on hover](#reveal-on-hover--the-touch-safe-way)). Each action stops
propagation, since the card itself is clickable:

```jsx
onClick={(e) => { e.stopPropagation(); acao() }}
```

Use native `title` for labels rather than a tooltip primitive when the rack sits
inside a virtualized or animated list — fewer moving parts, no provider needed.

## Hover-revealed selection

```jsx
<div className={cn("absolute right-4 top-4 transition-opacity",
  selecionado || haSelecao
    ? "opacity-100"
    : "group-focus-within:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100")}>
  <Checkbox checked={selecionado} onCheckedChange={alternar}
            onClick={(e) => e.stopPropagation()} />
</div>
```

The reveal branch is gated on `(hover: hover)` for the same touch reason as the
rack. `haSelecao` (any row selected on the page) is the part that is easy to miss:
without it, selected rows stay visible but *unselected* ones vanish, and the user
loses the sense of what is selectable.

## Controlled dialog opened from a menu

`AlertDialogTrigger` inside a `DropdownMenuItem` does not work — the menu
unmounts on close and takes the trigger with it, so the dialog never opens.

Split the dialog from its trigger and lift the open state:

```jsx
// dialog: no trigger, controlled
export function DeleteDialog({ aberto, onAbertoChange, descricao, ... }) {
  return <AlertDialog open={aberto} onOpenChange={onAbertoChange}>…</AlertDialog>
}

// parent owns the state
const [aberto, setAberto] = useState(false)
<DropdownMenuItem variant="destructive" onSelect={() => setAberto(true)}>…
<DeleteDialog aberto={aberto} onAbertoChange={setAberto} />
```

Give the dialog an overridable `descricao` so a caller deleting a different
entity can state the true consequence — see [trust-surface.md](trust-surface.md).

## Tabbed modal with one primary action

```jsx
<DialogContent className="flex max-h-[86vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
  <DialogHeader className="border-b border-border px-6 pb-5 pt-6">…</DialogHeader>

  <Tabs value={aba} onValueChange={setAba} className="flex min-h-0 flex-1 flex-col gap-0">
    <div className="px-6 pt-5"><TabsList className="w-full">…</TabsList></div>

    {/* min-h fixes the body height: without it the modal grows and shrinks
        per tab and the footer's primary action dances under the cursor */}
    <div className="min-h-[24rem] flex-1 overflow-y-auto px-6 py-6">…</div>
  </Tabs>

  <footer className="flex items-center justify-between gap-3 border-t
    border-border bg-muted/30 px-6 py-4">
    <DropdownMenu>…</DropdownMenu>       {/* everything secondary */}
    {primariaDaAba}                       {/* exactly one */}
  </footer>
</DialogContent>
```

Reset the active tab when the subject changes (`useEffect` on the entity id),
otherwise reopening shows the previous entity's tab and draft state.

When nothing is pending, render quiet text instead of a disabled primary:

```jsx
{alterado
  ? <Button onClick={salvar}>Save changes</Button>
  : <span className="text-xs text-muted-foreground">All saved</span>}
```

A status action inside the modal (Complete / Approve) whose real feedback is a
row leaving the list behind it needs **no in-button spinner**. If the modal
closes on click (next pattern), the spinner can never even show — and several of
them on sibling buttons, all flipping together on one action, only confuse. Drop
the spinner, the `submitting` prop that fed it, and any state left orphaned by
its removal. A loading affordance no one can reach is chrome.

## Close the surface before the exit ritual

When you complete an item from a modal and the satisfying part is the **row
collapsing out of the list**, closing order matters. The naive version awaits the
write (which runs the row's ~300ms exit animation via a `completing` flag) and
*then* closes the modal — so the animation plays **behind** the open modal,
invisible, and the modal sits ~300ms doing nothing before it closes. You pay for
the animation and hide it.

Close the surface **first**; the modal closing is itself the "exit with weight",
and the row then collapses in full view:

```jsx
// dialog action handler — capture the item, close, THEN write
onSetStatus={(status) => {
  if (!selected) return
  const item = selected
  setSelected(null)              // close first → row animates in view behind
  void actions.setStatus(item, status)
}}
```

Same principle as skipping the ritual when a kanban card changes column: the
column-move *is* the exit, so a second collapse animation would be redundant.
Pick exactly one visible exit per surface. On a rare write failure the optimistic
row returns via revalidation + an error toast — acceptable, since the modal is
already gone.

## Split a per-second value into its own context

A value that updates on a timer poisons any context it shares. A running-timer
provider that put `elapsed` (reticking every second) in the same object as
`{ running, start, stop, … }` made the whole context a new reference each second
— so **every** consumer re-rendered once a second: an entire page, plus ~120
cards on the board, for a one-digit clock.

Give the ticking value its own provider; only the components that render the
number subscribe:

```jsx
const TimerContext   = createContext(null)   // running, start, stop — stable
const ElapsedContext = createContext(0)       // the tick — changes every second

<TimerContext.Provider value={api}>
  <ElapsedContext.Provider value={elapsed}>{children}</ElapsedContext.Provider>
</TimerContext.Provider>

export const useTimer   = () => useContext(TimerContext)
export const useElapsed = () => useContext(ElapsedContext)  // subscribe ONLY to show the clock
```

Generalizes to anything high-frequency in shared state: scroll position, mouse
coords, a live counter. Isolate the churn.

## Route group is the chrome boundary

Deciding "app shell vs marketing chrome" by matching path strings in a root
layout means every new route lands on the wrong side **by omission** — the
allowlist is one edit permanently behind the routes. In Next.js App Router, let
the **folder** be the rule: put the shell in a route group's `layout.tsx` and the
membership becomes structural, with no default-wrong case.

Example from a real repo (in the target repo, find where the shell is decided
today, usually the root `app/layout.tsx`):

```
app/team/
  layout.tsx          ← app-shell: one auth gate + nav + providers for the zone
  page.tsx  horas/  leaderboard/   ← all inherit the shell, no per-route gate
  [memberId]/         ← the board — its own sidebar/header, sits OUTSIDE the group
```

A single server-side auth gate in the group layout also kills the
copy-pasted-login-screen-per-page smell (one gate, not four).

## A class name assembled at runtime does not exist

Tailwind's scanner reads source text. A class produced by string surgery is never
in the source, so it is never generated — the element ships unstyled and nothing
in typecheck, lint, or the build says a word.

```tsx
// A category chip derived from the config's text colour:
categoryConfig.color.replace('text-', 'bg-').replace('-400', '-500/20')
```

What makes this worse than "the class is missing" is that the same expression
fails **two different ways** when the source values mix a raw palette class with a
semantic token:

| input | output | what shipped |
|---|---|---|
| `text-purple-400` | `bg-purple-500/20` | never generated → chip with no fill or border |
| `text-success` | `bg-success` | `-400` never matched → **solid, fully opaque** fill under same-colour text |

So half the chips are invisible and half are illegible, from one line. Put the
finished classes in the config, written out:

```ts
branding: { color: 'text-purple-400', badgeClass: 'bg-purple-500/20 border-purple-500/30 text-purple-400' }
```

A `safelist` also works, but it decouples the fix from the place the mistake is
made. The literal is the cheaper contract.

Same family as `scrollbar-none` above: **classes are strings, and nothing
typechecks a string.** Whenever a class is computed rather than written, read the
computed style on the rendered element — not the `className`. → *trust*

## A regression guard that reads source

Some defects are **patterns, not values** — a hook called without a required
argument, a hover-reveal keyed on a breakpoint. Typecheck, lint, and unit tests
all pass them, because each individual call is well-typed and behaves. A vitest
that greps the tree for the banned *shape* catches them, and catches the ones a
manual sweep misses (this exact test found two more than the human pass did):

```ts
const FILES = collect(["components", "app"])   // recurse for .ts/.tsx
  .map(p => ({ path: p, src: readFileSync(p, "utf8") }))

it("no control is revealed by breakpoint instead of (hover:hover)", () => {
  const bad = FILES.filter(f => /sm:opacity-0[^"'`]*sm:group-hover:opacity-100/.test(f.src))
  expect(bad.map(f => f.path)).toEqual([])   // message names REVEAL_ON_HOVER as the fix
})

// A "sanity" assertion is mandatory: a guard that silently walks zero files is a
// green test that checks nothing.
it("actually scanned the zone", () => expect(FILES.length).toBeGreaterThan(20))
```

Point `collect([...])` at the target repo's source folders (e.g. `src`,
`components`, `app`). Use sparingly — one per genuinely systemic, invisible-to-other-tooling defect,
not for anything a type or a unit test already covers.

### Test the exemption, not only the detection

A guard has three ways to be green and useless, and the third is the one that
survives longest:

1. it scanned nothing (the sanity assertion above),
2. its detection pattern is wrong (obvious the first time you run it),
3. its **allowlist** swallows real hits — it scans, it matches, then it exempts.

A live case: a slop scanner exempted lines that looked technical, via
`\b(?:px|dpi|kb|mb|…)\b`. That reads Tailwind spacing utilities as units —
**`mb-2` is "MB", `px-4` is "px"** — so any `className` carrying padding or margin
silently suppressed the finding. `font-mono uppercase mb-2` never appeared in a
single report, for months, while the scanner reported a clean file.

Nothing surfaces this except asserting the exemption directly, in both
directions:

```ts
it.each([
  ["font-mono uppercase mb-2", true],   // spacing utility is NOT a unit → must flag
  ["font-mono uppercase px-4", true],
  ["{w}px × {h}px", false],             // genuine unit → must stay exempt
  ["Max 2MB", false],
  ["16:9 Aspect", false],
])("%s → flagged=%s", (line, flagged) => expect(SUPPRESS.test(line)).toBe(!flagged))
```

The fix is usually anchoring: require the unit to be glued to a number or to
stand alone as a word — `(?:(?<=\d)|(?<![\w-]))UNIT(?![\w-])`.

When investigating why a guard missed something real, suspect the exemption
before the scope. "It doesn't scan that folder" is the comfortable answer and was
wrong here — the walker covered the whole tree the entire time. → *every variable*

## Keyboard guard order

```js
const aoTeclar = (evento) => {
  const digitando = estaDigitando(evento.target)

  // 1. modifier combo first — the escape hatch from inside a text field
  if ((evento.metaKey || evento.ctrlKey) && evento.key === "Enter") {
    evento.preventDefault(); acaoPrimaria(); return
  }
  // 2. typing: only Escape, to blur out
  if (digitando) {
    if (evento.key === "Escape") evento.target.blur()
    return
  }
  // 3. any other modifier is a system/browser combo — Alt+Backspace is delete-word
  if (evento.metaKey || evento.ctrlKey || evento.altKey || evento.shiftKey) return
  // 4. focus inside a control: the key belongs to the control
  if (estaEmControle(evento.target)) return
  // 5. bare keys
  …
}
```

```js
export function estaDigitando(alvo) {
  if (!(alvo instanceof HTMLElement)) return false
  const tag = alvo.tagName
  return tag === "INPUT" || tag === "TEXTAREA" || alvo.isContentEditable
}

export function estaEmControle(alvo) {
  if (!(alvo instanceof HTMLElement)) return false
  return Boolean(alvo.closest(
    "button, a[href], select, [role='button'], [role='menuitem']"))
}
```

Check `isContentEditable`, not just `tagName`. Announce every shortcut with a
`<kbd>` on its own control.
