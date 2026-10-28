# Verification protocol

Run this before calling any frontend work done. Skipping it is how confident,
wrong work ships.

- [Verify the claim before acting on it](#verify-the-claim-before-acting-on-it)
- [Height budget](#height-budget)
- [Keyboard audit](#keyboard-audit)
- [Design detector](#design-detector)
- [Render audit](#render-audit)
- [Narrow-viewport audit](#narrow-viewport-audit)
- [Build gate](#build-gate)
- [Orphan sweep](#orphan-sweep)
- [Committing in a shared tree](#committing-in-a-shared-tree)
- [Honest reporting](#honest-reporting)

## Verify the claim before acting on it

Whether the claim comes from a critique, a subagent, a ticket, or a user, read
the code and confirm the defect is real before refactoring around it. Cite
`file:line`.

This is cheap and it catches two failure modes: a plausible-but-wrong finding
that would send a whole refactor in the wrong direction, and a finding that is
real but whose stated cause is not.

Diagnose with evidence, not opinion — a table of facts with file references beats
a paragraph of judgement.

## Height budget

For any work surface, count vertical pixels from the top of the viewport to the
first item of real content. List each block and its cost. Then list what is
recoverable and what it buys.

Report the number both before and after. "Cut the chrome" is not a result;
"~460px → ~64px, about two extra rows above the fold" is.

If a change makes content taller (more padding, a new element), say so and name
what financed it. A spacing improvement that reduces items-per-screen with no
offsetting cut is a regression, and reporting it as a win is misreporting.

## Keyboard audit

Tab through the surface. For every stop, confirm:

- Enter activates **that control**, not a global shortcut.
- Links respond to Enter (it is their only activation key).
- Escape leaves text fields.
- The primary action is reachable from inside a text field via `Cmd/Ctrl+Enter`.
- Modifier combos (`Alt+Backspace`, `Cmd+Backspace`, `Shift+Enter`) do not fire
  destructive actions.
- Every shortcut is announced on its control with a `<kbd>`.
- Anything revealed on hover is reachable via `focus-visible`.
- State changes are announced in an `aria-live` region on surfaces whose loop is
  "act → next item".

A shortcut that is not labelled is either undiscovered or accidental.

## Design detector

Run the deterministic pass **before** you open the screen — it catches the
generic-UI tells the eye normalizes after the tenth look. It is cheap and it
front-loads the "AI slop" findings so the manual render audit can focus on data
and layout.

```bash
npx impeccable detect components/ app/   # point at the target repo's real dirs (not every repo has src/)
npx impeccable detect app/leads/          # or scope to the surface you touched
```

It flags contrast, typography drift, layout overflow, brittle motion, and the
generic-AI tells this skill already argues against: `gradient-text`,
`ai-color-palette` (purple/violet gradients, cyan-on-dark), `bounce-easing`,
`border-accent-on-rounded`, `broken-image`. Exit code `2` means findings, `0`
clean, `1` a command failure.

Two rules for using it:

- **It is a curator, not an oracle — triage, never obey blind.** Verify each
  finding at `file:line` like any other claim (see above). A `broken-image` on an
  `<img>` whose `src` is a runtime prop is a false positive the static pass can't
  resolve; a `gradient-text` on a dashboard metric is a real tell worth cutting.
  Confirm before refactoring.
- **It complements the token audit, it does not replace it.** In the target repo,
  look for whatever owns token/hardcoded-value violations (a `package.json`
  script like `audit:design` or `lint:design`; Example: `npm run audit:design`
  backed by `scripts/audit-design-tokens.js`). Impeccable owns the taste-level
  tells. Run both; they overlap little. If the repo has no token audit, say so in
  the report.

To wire it into a repo for real, add `.impeccable/config.json` and a `DESIGN.md`
(token-aware mode), and silence confirmed false positives structurally with
`npx impeccable ignores add-file <pattern>` rather than case-by-case in your head.

## Render audit

**A screen that compiles is not a screen anyone has seen.** Open it.

- Both themes. Semantic tokens usually make this free, but confirm rather than
  assume.
- With real data, not an empty state. Long names, missing fields, large counts.
- Hover state actually captured — confirm the revealed control does not cover
  content and that nothing shifts.
- Baselines across a grid row: cards of differing content length should end
  together.

Watch out for entry animations: a screenshot taken mid-`opacity` transition shows
washed-out content and is not a rendering bug. Wait, then capture.

**But waiting does not always help, and that is the trap.** In an automated or
background tab `requestAnimationFrame` is throttled to a stop, so a
framer-motion/WAAPI entrance never advances past its `initial` — the element sits
at `opacity: 0` **forever**. A hero renders blank, its text is present in the DOM,
and it reads exactly like a real defect. Check before you "fix" it:

```js
document.visibilityState            // 'hidden' → rAF is parked
document.hasFocus()
// and count ticks: 0 in one second confirms it
```

Two cheap tells that it is the environment, not the screen: the copy is in
`innerText` while computed `opacity` is `0`, and the same symptom reproduces on
routes you never touched. Layout measurements stay valid — geometry does not need
rAF — so a narrow-viewport audit in that tab is still trustworthy.

Writing a rule from a defect that turned out to be a measurement artifact is how
a playbook accumulates superstition. Confirm the mechanism first.

If a surface cannot be rendered because the data does not exist, **say so
explicitly** rather than implying it was checked. That statement is part of the
deliverable.

## Narrow-viewport audit

**Horizontal page scroll is a measured number, not a taste call.** Eyeballing a
screen at 390px finds the offender that is 200px out and misses the one that is
10px out — and 10px is enough to make every swipe on the surface feel broken.

Measure `documentElement.scrollWidth − innerWidth`. Positive is a defect. Then
name the **outermost** overflowing element: one bad container produces hundreds of
overflowing descendants, and reporting the leaves sends the fix to the wrong file.

Two filters make the output usable:

- **Drop anything clipped by an ancestor with `overflow-x`.** Every `truncate`
  child is technically wider than its box. Without this filter the real culprits
  drown — one audit went from 248 hits to 2.
- **List internal scrollers separately** (`scrollWidth > clientWidth`). A kanban
  and a data table scroll horizontally *on purpose*; the report must not confuse
  intentional scroll with leakage.

### Getting a real 390px viewport

Device emulation is often unavailable (headless CDP, a locked window, `resize`
silently ignored). CSS zoom and setting a width do not work — **media queries
must respond**, so the layout has to live in a box that is genuinely 390px wide.

An iframe is that box. If the app sends `X-Frame-Options: DENY` (it should),
point the iframe at `about:blank` — which inherits the parent's origin — and fill
it yourself:

```js
const html = await fetch(path, { credentials: 'include' }).then(r => r.text());
const doc  = frame.contentDocument;
doc.open();
doc.write(html.replace(/<head([^>]*)>/i, `<head$1><base href="${location.origin}/">`));
doc.close();
frame.contentWindow.history.replaceState({}, '', path); // before hydration
```

The session cookie applies, so the app hydrates with **real data** — which is the
point, since empty states hide every overflow. `<base href>` resolves the chunks;
`replaceState` runs before hydration so a route keyed on `?tab=` mounts the right
section. Before writing this by hand, look in the target repo for an existing
overflow audit script (Example: `scripts/audit-mobile-overflow.js`).

Modals and sheets are `position: fixed`, so they never enter the document's
`scrollWidth`. Audit them separately, against **their own** right edge.

### Re-measure after every fix

The one non-negotiable. A responsive fix routinely trades one overflow for
another: swapping a calendar's unreadable month grid for a list view removed the
clipped titles and introduced **+215px** of page scroll, because the list is a
`table-layout: auto` table. The first measurement justifies the change; only the
second one proves it. → *every variable*

## Build gate

Typecheck and build must both pass, plus the test suite when one exists.

```bash
npx tsc --noEmit -p tsconfig.app.json   # or the project's config
npm run build
pytest -q                               # or the project's runner
```

When a change alters intended behaviour and an existing test fails, that test was
correct until now. Update it deliberately, and add a test for the new behaviour —
do not delete the assertion to make the suite green.

When the same rule exists in two languages (application code and SQL, frontend
and backend), pin both with one test and note it in a comment beside each copy.
They drift silently otherwise.

## Orphan sweep

After a refactor that replaces components, grep for remaining consumers before
deleting, and delete what has none:

```bash
grep -rn "ComponentName" src --include=*.tsx | grep -v "path/to/ComponentName.tsx"
```

An empty result means orphaned. Leaving dead components behind is how a codebase
accumulates two ways to do everything.

Watch for exports beyond the component itself (helper constants, class strings)
that may still have consumers.

## Committing in a shared tree

Before committing, run `git status` and account for **every** modified file.

A working tree may contain uncommitted work from another session or another
agent. Never `git add -A`. Stage explicitly by file, and when a file might mix
sources, read the diff before staging:

```bash
git diff -U0 -- path/to/file | grep '^[+-]' | grep -v '^[+-][+-]'
```

If work cannot be cleanly separated, say so and ask rather than guessing.

### The index is shared state too

Staging explicitly is not enough. **Anything you leave in the index rides along in
the next commit made in that tree — including one you did not make.**

A `git rm` early in a session left a staged deletion sitting in the index. Hours
later another session committed its own file, and the deletion went with it: a
commit titled after a backend change also deleted 461 lines of a profile modal,
and by the time it was noticed it was already pushed.

So: leave the index clean between units of work. Stage immediately before you
commit, not as you go. Any destructive operation — `git rm`, `git mv` — stages by
default, so pair it with the commit or use `--cached` deliberately.

Before committing, read the **staged** set, not just the working tree:

```bash
git status --short          # left column = index; a stray D/A there is not yours to ship
git diff --cached --stat
```

And after committing in a shared tree, check that the tip is what you think it is
(`git log --oneline -3`) — someone else's commit may have landed underneath you.

## Honest reporting

- State what was verified and what was not.
- Report the trade-off, not only the win. A recommendation with no cost attached
  is propaganda.
- Say when a test failed, with the output.
- Say when a decision was left open, and name the decision.
- Do not describe a screen you have not opened.
