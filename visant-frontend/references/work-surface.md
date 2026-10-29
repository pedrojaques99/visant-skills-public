# Work surfaces

Screens the user operates for long stretches: queues, lists, kanban boards,
editors, session runners, admin panels. Revenue variable:
**throughput × decision quality**.

Throughput is items processed per hour. Decision quality is whether the right
items got processed. Every rule below moves one of the two.

- [Chrome budget](#chrome-budget)
- [Hierarchy: weight follows the decision](#hierarchy-weight-follows-the-decision)
- [Hiding](#hiding)
- [Grouping by spacing](#grouping-by-spacing)
- [Hover](#hover)
- [Keyboard](#keyboard)
- [Defaults and ordering](#defaults-and-ordering)
- [Empty and absent](#empty-and-absent)
- [Forms: an empty field is not a field](#forms-an-empty-field-is-not-a-field)
- [What the screen says when it refuses](#what-the-screen-says-when-it-refuses)
- [Columns: what separates a list from a table](#columns-what-separates-a-list-from-a-table)
- [A control pair is one unit, not two ends](#a-control-pair-is-one-unit-not-two-ends)
- [A label becomes an icon when the option HAS a shape](#a-label-becomes-an-icon-when-the-option-has-a-shape)
- [Render tool: preview in a fixed column, controls in another](#render-tool-preview-in-a-fixed-column-controls-in-another)
- [Anti-patterns](#anti-patterns)

## Chrome budget

Count vertical pixels from the top of the viewport to the first item of real
content. On a work surface that number is a budget, and it is almost always
overspent.

Real measurement from a lead queue before redesign:

| Block | px |
|---|---|
| Sticky header | 61 |
| "Back to dashboard" link (duplicated the header nav) | 20 |
| Gradient hero band with a title already in the tab | 88 |
| Six stat tiles, four of them reading zero | 74 |
| Collapsed "search history" card | 46 |
| Filter bar: six always-open selects | 68 |
| gaps | ~100 |
| **Total before the first lead** | **~460** |

All of it was permanent chrome serving occasional tasks. Collapsed to a single
~64px header line, it bought roughly two extra rows of content above the fold.

**Generous spacing is legitimate — but it must be financed.** Padding that makes
each card 15% taller means fewer items on screen. Pay for it by cutting chrome,
never by cutting content. State the trade when reporting; a spacing change that
reduces items-per-screen without a corresponding cut is a regression.

## Hierarchy: weight follows the decision

The datum that drives the user's next action gets the most typographic weight.
Everything else recedes. Cheap and reliable levers, in order: size, weight,
`tabular-nums`, colour, position. Border and background are last resorts.

**Weight is contextual.** The same field earns opposite treatment depending on
what the user is doing:

| Situation | Treatment |
|---|---|
| Grid of candidates — the user is **choosing** | Promote. The score is the scan axis; make it large, coloured by band, top-right of each card so the eye can run down the column. |
| Ordered queue — the user is **processing** | Demote. The list already decided; the score is context. Strip the pill and the icon, keep weight and colour only. |

Getting this wrong in either direction is a real cost: promoted noise slows the
scan, demoted signal forces the user to open items to decide.

## Hiding

- **A metric reading zero does not render.** Not "0 contacted" in success green
  during the first second of a session. The total may render when it is the
  subject of the page; its breakdowns only when non-zero.
- **A badge carried by 100% of rows distinguishes nothing.** A "NEW" status on a
  freshly-fetched list is texture, not information. Render it only once it
  changes.
- **Rare actions go behind `⋯`.** Export, bulk delete, settings. Destructive
  actions especially — they should not live one click from an innocuous button.
- **Filters: show what is filtered, not what could be.** Six open selects
  advertise capability; removable chips report state. Keep the search field
  always visible (it is the one used constantly), put the rest behind one button
  with a count badge.
- **Duplicated navigation is chrome.** A "back to dashboard" link under a sticky
  header that already contains the nav.

## Grouping by spacing

Variable gap *is* the grouping. Uniform `gap-2` throughout a card produces a flat
stack with no perceivable structure; `gap-1` inside a zone and `gap-4` between
zones produces three legible groups with no borders at all.

Box-inside-a-box is noise. A bordered, tinted panel inside a bordered card adds a
frame the eye must parse for no informational gain. Promote the panel's label
typographically and delete the frame.

Three-zone card pattern, in decreasing weight:

1. **Identity + decision** — name, and the datum that drives the action.
2. **Alerts** — only rendered when something is true.
3. **Signal** — supporting facts, pinned to the bottom.

Pin zone 3 with `mt-auto` so cards of differing name lengths share a baseline
across the grid. Without it, every card in a row ends at a different height and
the grid reads as noise.

## Hover

**Hover never changes layout.** Reserve the space permanently and float the
revealed control over it — for example, right-pad the bottom zone so a hover
action rack can occupy that corner without ever covering content, and without
anything shifting when the pointer arrives.

**Nothing revealed only on hover may be the sole path to an action.** Pair every
`group-hover:` with `group-focus-within:`, and keep the same action reachable
from a menu or detail view.

**Reveal on `(hover: hover)`, not on a breakpoint.** `sm:opacity-0
sm:group-hover:` treats screen width as "has a mouse" — but a tablet is wide and
touch, so the control becomes invisible *and* unreachable. Gate the reveal on the
media feature, keep a ≥36px tap target on touch, and pin the idiom in a helper.
Pattern: [stack-tailwind-react.md → Reveal on hover](stack-tailwind-react.md#reveal-on-hover--the-touch-safe-way).

**Selection controls are a special case.** A checkbox may hide until hover, but
must become permanently visible when its row is selected *or* when any selection
is active — otherwise the user loses sight of what they already marked.

Quick actions on hover are usually the single largest throughput win available:
copying a phone number, opening a link, or firing a message without leaving the
list removes an entire open-modal-and-return cycle per item.

## Keyboard

On a surface used for 40-minute stretches, keyboard flow is correctness, not
polish. A global `keydown` listener on `window` is the standard implementation
and the standard source of four bugs:

1. **Blanket `preventDefault` kills focused controls.** A keydown on a focused
   `<button>` or `<a>` bubbles to `window`; cancelling it cancels the control's
   own activation. Tab to "Skip", press Enter, and the app runs the primary
   action instead. In an `<a>`, Enter is the *only* activation key, so the link
   goes dead.
2. **No escape from text fields.** Guarding on "is the user typing" suppresses
   the main shortcut with no substitute. Provide `Cmd/Ctrl+Enter` to fire from
   inside the field and `Escape` to blur out of it.
3. **Shortcuts that ignore `disabled`.** The button is disabled but the shortcut
   still calls the handler. See principle 9 — this is how a UI writes a lie.
4. **Destructive keys without modifier guards.** `Backspace` bound to archive
   means `Alt+Backspace` and `Cmd+Backspace` — both ordinary delete-word combos —
   destroy records. Bind destructive actions to a deliberate key and label it.

**Correct guard order**, which fixes all four:

```
1. modifier combo (Cmd/Ctrl+Enter)  → handle, return
2. typing?                          → handle Escape, otherwise return
3. any other modifier held          → return
4. focus inside button/a/select?    → return
5. bare key                         → handle
```

Every shortcut must be announced on its own control (a `<kbd>` in the button).
An unlabelled shortcut is either undiscovered or triggered by accident — and the
most destructive action must never be the easiest key to hit.

Announce state changes for screen readers. On a surface whose whole loop is
"act → next item", a silent swap means the loop does not exist without sight: an
`aria-live="polite"` region naming the new item closes it.

## Defaults and ordering

The default sort is the strategy the product recommends. Choose it deliberately,
compute it **server-side** (a client-side sort over a paginated list reorders
only the loaded page), and explain its rule in one line where the user picks it —
an unexplained "Recommended" asks for blind trust.

Ordering heuristic that generalizes: **commitments before opportunities.** A
follow-up promised for today outranks an untouched high-score lead, because the
lead is still there tomorrow and the follow-up goes cold. Rank by band first,
then let the quality score break ties inside the band.

**Inside a band, the clock rules — not the priority.** The band already used
priority to decide membership; using it *again* to order within the band makes
the visible dates walk backwards ("tomorrow" above "next week"), and a queue
whose dates don't descend reads as a bug however correct the rule is. Sort the
band by due date; break genuine date ties with priority.

**A queue is what fits in a day; overdue-forever is not queue, it's management.**
A "today" list that ranks by risk with a small window shows only the *oldest*
overdue items — precisely the ones no one will clear today — and buries what's
actually due. Cap the recoverable window (e.g. overdue ≤ N days stays in the
queue); everything older collapses into **one** summary row ("14 overdue >7d →
review"), not N cards competing with the day's real work. The summary carries the
single red dot; the queue stays neutral. A count that doesn't match the list
beside it is noise, so name it for what the bucket actually holds ("due today",
not "open").

When a rule is duplicated across languages — the same "difficult lead" logic in
application code and in SQL — they will drift. Write a test that pins both, and
say so in a comment next to each copy.

## Empty and absent

Absence is information. A record with no logo, no site, or no photo is often
exactly the record worth acting on; render the gap as a deliberate state that
carries the argument, not as a hole in the layout.

Before adding any new visual element, run the **coverage question first**: where
will this be missing? An element absent precisely on the best records is worse
than no element — it trains the eye to skip the rows that matter. Cost comes
second, and is usually lower than assumed (page metadata already fetched during
an existing crawl costs nothing extra).

Do not render a count next to an empty state that already says the same thing
with more context.

## Forms: an empty field is not a field

A form with nine open fields and seven of them blank is not a form, it is the
list of what you have not filled in yet. The eye spends the whole scan before it
finds what matters, and the column grows until the submit button falls below the
fold.

**The single rule:** a field WITH a value renders as a field; an empty optional
field becomes a `+ Noun` button in a strip at the end of the block. It reopens by
itself when it has content: there is no state to remember, having a value is
enough.

The typical mistake is not forgetting the rule, it is applying it to half the
fields: "dimensions" hidden behind a button while date, assignee, priority and
project stay always open and almost always empty. Half a rule is worse than
none, because now there are two modes with no visible criterion for which is
which.

### Mark the exception, never the rule

If eight of nine fields are optional, `(Optional)` shows up eight times to say
what silence already says, and the one required field carries no mark at all:
the information that matters is the only one not written. Invert it: delete the
eight, mark the required one with `*` (plus `aria-required` and an `sr-only`,
because an asterisk is a visual convention, not semantics).

### Help text becomes placeholder

Help text that explains the field's FORMAT belongs in the placeholder: it goes
away on its own the moment it stops being useful (there is text in the field).
As a fixed paragraph, it occupies the line forever, even after it has been read.

Help text that describes what the field ALREADY SHOWS goes entirely. "Leave blank
to use the automatic title" under a field whose placeholder IS the automatic
title, spelled out, is a line spending height to narrate the screen.

A section title that names the obvious also goes. Two columns separated by a
vertical rule do not need "The request" and "Details" above them: the separation
is already drawn, and the labels only add two lines of chrome.

### Preset seeding

Filling fields from a preset (request type, template, last use) is legitimate and
has two non-negotiable rules:

- **Never write over a human answer.** The seed goes into an empty field; leaving
  the preset clears only what the seed itself put there (keep the seeded value in
  a ref and compare). Seeding over the top is how a form starts recording answers
  nobody gave.
- **A seed does not steal focus.** `autoFocus` belongs to the field the PERSON
  opened. A field that opened by itself and grabs the cursor pulls the person out
  of where they were typing, usually into another column.

## What the screen says when it refuses

A silent refusal reads as a system bug, not as a missing field. Three failures
that show up together and disguise themselves as "it doesn't work":

**A disabled button does not explain.** `disabled` until validation passes
produces a click that does nothing, focuses nothing and says nothing, and the
person concludes the integration is down, not that something was left blank.
Keep the button live (disable it only while submitting) and make the click be
what reveals what is missing: a message naming the field + focus on it + its
border in `destructive`. The equivalent keyboard shortcut follows the same path,
or it "breaks" silently.

A consequence that comes with it: if `disabled` was also the double-click guard,
that guard becomes a synchronous ref. `isSubmitting` only takes effect on the
next render, and two clicks in the same tick both go through.

**An error message is never a button label.** `catch { setError(t.createIssue) }`
paints the string "Create request" in red as if it were the cause. Every error
fallback is a sentence that says what happened and what to do; with no known
cause, the HTTP status goes into the text, because it is the one clue that always
exists. And `response.json()` gets a `.catch()` at both call sites: a gateway 502
returns HTML, the parse throws, and the real error becomes the generic message.

**The alert lives where the click happened.** An error `<p>` at the end of a
scrolling dialog's content is born below the fold: the person clicks, "nothing
happens", and the explanation is off screen. Pin the footer (`sticky`) and put
the alert inside it, next to the button.

## Columns: what separates a list from a table

Found on a timesheet whose "dense and organized" list still read as improvised.
None of these lights up in a linter: all four are alignment, and wrong alignment
breaks nothing, it just looks amateur.

**1. A variable-width field in front of the title misaligns the whole page.** An
identifier chip that shrinks to its content (`ABC-745` versus `no task`) makes
every title start at a different x. A fixed width on the chip, with centered
text, is what turns the list into a table: it costs one class and pays for the
whole middle column.

**2. Metadata inside the title cell shows up wherever each title ends.** The same
field (client, project, tag) on a different vertical per row forces re-reading
the row instead of running down the column. Metadata compared across rows is
**its own fixed-width column**, hidden by breakpoint when it does not fit, never
a `<span>` trailing after the text.

**3. The group total has to land in the column of the numbers it sums.**
`justify-between` on the day header ends at the container edge, while the row
durations stop before the actions rail. Two numbers of the same kind, two
verticals, 56px apart, and the eye flags it before knowing why. **The `gap` must
also be the same in both**, or the column closes three pixels crooked.

**4. Column widths hand-written in each block DRIFT silently.** The same grid is
usually drawn in four places: the row, the group header, the toolbar and the
skeleton. Changing one and forgetting the others breaks no build and fails no
test: it only misaligns. Extract the measures into an object of **literal
constants** (`const COL = { time: "sm:w-[5.5rem]", … }`) and compose with `cn()`.
Literal, never `w-[${x}]`: Tailwind scans complete strings and an interpolated
class never makes it into the CSS.

Bonus from the same family: **the skeleton must have the same columns as the
content**. A one-column skeleton that becomes two on load makes the screen shrink
in front of the viewer.

## A control pair is one unit, not two ends

`justify-between` on a wide bar puts the "previous" arrow on one edge and "next"
on the other: a thousand pixels between two buttons used alternately, with the
label floating ownerless in the middle. Prev/next navigation, zoom −/+, wizard
step: the pair is drawn **together**, next to the label it changes, and the
number goes in the column where the other numbers already are.

The generalization holds: `justify-between` is for **zones** (identity × action),
not for members of the same control. The wider the screen, the more expensive
the mistake.

## A label becomes an icon when the option HAS a shape

The test is not saving space, it is translation: the icon pays off when it **is**
the thing, and costs when it merely represents it.

| Becomes an icon | Stays a word |
|---|---|
| "Bars" / "Line": the option is a shape, and the icon also previews the result before the click | "Team" / "Per person": audiences; it would become `Users` versus `User`, two figures told apart by one stroke at 14px |
| "Grid" / "List" | "Monthly" / "Yearly" |
| play, pause, close | any option whose icon needs a caption |

An icon that needs a caption is worse than the caption alone. And an icon without
`title` + `sr-only` is a mute button: the label leaves the screen, not the
document.

A side benefit that often decides the case: the icon group shrinks and gives
width back to the neighbor with a long label. In a narrow panel that is what
makes the whole row fit without truncating.

## A control takes the shape of its data

The primitive library offers a select, a slider and an input, and an agent
reaches for whichever is on top. The control should be chosen by the data:
a choice among 2–5 short options is a segmented control (every option visible,
zero clicks to learn them); a point in 2D is a grid you click once, not two
dropdowns; a vector is one row of fields; a gradient or a curve is its own
picture, edited in place, with the exact numbers beside it. The same move as the
section above, one level up: the icon pays off when it IS the thing, and the
control pays off when it IS the shape of the value.

Measured on a tweak panel redrawn this way (DialKit against its fork): a
gradient went from 11 generic rows to one bar plus a stops table, alignment
from two lists to one click. Full table and panel rules:
`visant-refine` [control-panels.md](../../visant-refine/references/control-panels.md).

The same applies to the chrome around controls: reset, help and destructive
actions appear when the state calls for them (a value changed, a key held, a
menu opened), not permanently on every row.

## Render tool: preview in a fixed column, controls in another

Found on a photo sequencer that stacked upload, controls (order, transition,
format, slider) and the preview/player in a single scrolling column: tweaking a
parameter meant scrolling to see the result, and the previous preview slid above
the fold while the controls grew.

**The rule:** in a "configure → generate → see the result" tool (sequencer,
editor, image generator, any screen with a "render" button), preview and output
live in their own fixed column (`lg:sticky lg:top-*`), separate from the controls
column that scrolls freely. The user adjusts a parameter with the previous result
always visible beside it: no choosing between seeing the control and seeing its
effect.

This holds even before the first render: the preview column is born in the
layout (with an empty state in it, like "nothing rendered yet"), it never appears
only after the first result exists. Otherwise the screen jumps from one column to
two mid-use, and that layout jump is exactly what the rule prevents.

## Anti-patterns

| Pattern | Why it fails |
|---|---|
| Gradient hero on a work surface | Acquisition instinct on class B; 88px for a title already in the tab |
| Control stacked ABOVE the `<h1>`, repeating what the title says | The screen's subject arrives before its name, and the same information takes two heights; it belongs in the header, next to the action |
| Three alignment axes in the same fold (title left, piece centered, action at the edge) | No anchor shares a column; on a wide screen the primary sits over 1000px from the title and the page reads as assembled |
| `justify-between` splitting a PAIR of controls (‹ ›) | A thousand pixels between two alternating buttons; a pair is one unit, see the section above |
| Variable-width chip/badge before the title | Every row starts at a different x; the list never becomes a table |
| Column widths repeated by hand in row, header and skeleton | They drift silently: nothing breaks, it only misaligns |
| Disabled primary button | Promises an action that will not happen; replace with quiet text |
| Primary disabled UNTIL validation passes | The dead click reads as "the system failed", not "a field is missing"; the click has to say what is missing |
| `(Optional)` repeated across many labels | Marks the rule and leaves the exception unmarked; invert it |
| Empty optional field rendered open | Becomes an item on the list of what you have not filled in; `+ Noun` until it has a value |
| Fixed help text under the label explaining the format | A placeholder does the same and disappears once it stops being useful |
| Dropdown for 2–5 short options | Hides choices that fit on screen; a segmented control shows them at zero clicks |
| Two dropdowns for one spatial choice (horizontal + vertical alignment) | Two lists, two clicks, for one point; a 3 × 3 grid is one click |
| One global "Reset" at the bottom of a panel | Far from what it resets and resets too much; reset per section, shown only once something changed |
| Error alert at the end of a scrolling dialog's content | Born below the fold; it lives in the sticky footer, next to the button |
| Button label used as the error-message fallback | "Create request" in red is no cause at all |
| Metric grid of mostly zeros | Occupies the fold to report nothing |
| Uniform gap inside a card | No perceivable grouping; everything reads as one flat list |
| Guessed breakpoints | `lg:grid-cols-3 xl:grid-cols-4` assumes a viewport; use an intrinsic grid |
| Hover control that shifts layout | Content jumps under the pointer |
| Hover-reveal keyed on a breakpoint (`sm:opacity-0`) | Invisible *and* unreachable on touch tablets — use `(hover:hover)` |
| Two full-width buttons stacked | Two primaries means none |
| Client-side sort over paginated data | Sorts the page, not the set |
| Structural-overdue cards filling the day's queue | Shows only what no one will do today; cap the window, summarize the rest |
| Priority re-sorting inside an already-banded queue | Visible dates walk backwards; read as a bug |
| Flex/grid child holding text without `min-w-0` | Its min-content becomes the page's minimum width; `truncate` cannot save it |
| `flex items-center justify-between` on a header with actions | No `flex-wrap`, so a longer button label ("Sincronizando…") pushes the page sideways |
| A 5-tab strip that fits only on desktop | The last tabs are not squeezed, they are *unreachable*; scroll the strip and `shrink-0` the triggers |
| A month calendar grid on a phone | Seven ~50px columns clip every event title to 10–28px; default to a list view below the breakpoint |
| Third-party `<table>` left at `table-layout: auto` | One long title makes the table wider than its container regardless of the wrapper |
| Preview/render stacked in the same column that scrolls with the controls | The result leaves the screen right when you adjust the parameter that changes it; the preview lives in its own fixed column |
