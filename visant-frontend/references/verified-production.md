# Verified in production review

Real cases, each with the spine it confirms and the business variable it
protects. This is EVIDENCE, not rule: the rules live in the skill body. A case
gets in here only after surviving a real review, never as a hypothesis.

- **A price written in copy is a claim about the database.** On a purchase
  surface the charged amount lived in server config and the displayed amount in
  four hand-typed copy strings, with nothing linking them — change one and the
  button advertises a price the checkout will not honour. Same class as spine 9
  but pointing outward: the UI lying to the *customer* about the database. The
  fix is not vigilance, it is a build check that reads the server value and
  fails when a registered price key disagrees, **plus** a scan that rejects an
  unregistered key showing a price, so the fifth CTA cannot slip through.
  Prefer a build-time lock to a runtime fetch when the price is fixed: no
  request in the critical path, no layout shift. *(spine 9)* → *trust, refunds*
- **Role says *can view*; ownership says *whose action it is*.** Gate
  personal/actor-scoped controls (preferences, "my hours", a timer) by whether the
  viewer *owns* the resource, not by their role. An admin inspecting someone else's
  board must not see that person's personal actions rendered under their name — it
  reads as a lie about whose data it is. *(spine 9)* → *data integrity*
- **A promoted link must resolve for every role that can see it.** Before making a
  nav entry more prominent, confirm the route it targets resolves for each role —
  a link that dead-ends for one role is *worse* once it's prominent. → *trust*
- **Dead controls don't render.** A select showing "pick the client first", a
  disabled step in a cascade — hide it until its precondition is met instead of
  showing it inert. Corollary of "a disabled primary is a lie" for dependent
  inputs. *(spine 2, 5)* → *density*
- **An optional field drawn in full is a false demand.** A "log hours" dialog
  asked for two things (when it started, how long it took) but rendered four
  fields, two of them labelled *(opcional)* — task and note. Everyone paid the
  same tax: read the label, decide, decline. Collapsed behind a ghost `+ Tarefa`
  / `+ Nota`, the dialog shows exactly what it demands, and the optional costs
  one click for the minority who wants it. Two guards make it safe:
  **auto-expand when the field already has content** (editing an entry that has
  a note and not seeing the note reads as the note being gone), and the button
  names the *noun*, not the action. *(spine 2, 5)* → *completion rate*
- **A native control has a floor your CSS cannot cross.** `input[type=date]`
  renders its own calendar button, so its min-content width is ~145px in Chrome.
  Inside a `max-w-md` dialog split into three columns each cell got ~125px, the
  control overflowed, and the date clipped — `w-full` cannot shrink past the
  intrinsic minimum. Give native date/time inputs their own column budget
  (`grid-cols-[1.25fr_1fr_1fr]`) and measure, don't eyeball. → *data integrity*
- **When two numbers measure different things, the UI names which is which.**
  Estimate vs. actual, suggested vs. logged, forecast vs. booked — an unlabeled
  number next to a same-unit number of a *different* kind corrupts interpretation.
  Label it or don't show it. *(spine 9)* → *data integrity*
- **Silent-empty is the dominant lie, and the lie is usually told one layer
  down.** A failed fetch that renders "0" is indistinguishable from a true zero and
  steers the user (and you) wrong. An error state and an empty state are different
  states — never collapse them. But adding that error state to the *page* changes
  nothing when the **service** catches the failure and returns an empty payload:
  the branch is unreachable, the screen still says "0 presets", and the fix looks
  done. The tolerant fallback is right for some callers (a picker prefers an empty
  list to a broken screen) and a lie for the surface whose whole job is to display
  the data — so make it opt-in (`load({ throwOnError: true })`) instead of changing
  the return for everyone, and split fatal from cosmetic (a hero counter that
  already hides at zero must not take the page down with it). **Verify by running
  with the backend stopped**; a fix to this class of bug that was never seen
  failing was never verified. → *every variable*
- **Offer the common choice as one click.** For a frequently-set field, presets
  beat a bare input for the 80% case (e.g. Tomorrow / +3 days / next week on a
  due-date popover). The raw input stays for the rest. *(spine 4)* → *throughput*
- **Hover-reveal must ask `(hover: hover)`, never a breakpoint.** `sm:opacity-0
  sm:group-hover:opacity-100` uses width as a proxy for "has a mouse" — and a
  tablet has ≥640px with *no* hover, so the control is invisible **and**
  unreachable, with no intermediate state to hint it exists. Reveal with
  `[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100`
  plus `focus-visible:opacity-100`. Sharpens spine 7; pattern +
  source-guard test in [stack-tailwind-react.md](stack-tailwind-react.md). → *throughput, a11y*
- **The exit animation must not play behind an open modal.** Completing from a
  dialog ran the list row's collapse *under* the still-open modal (invisible)
  and held the modal ~320ms waiting for it. Close the surface first — the dialog
  closing **is** the exit with weight — then the row collapses in view. Mirror of
  "a kanban column-move is already the exit, so skip the ritual." → *retention*
- **When feedback moves, delete the feedback it replaced.** Once the dialog
  closed on click, its per-button submit spinners could never show — three
  firing together had only ever confused, and were now dead. Remove the spinner,
  the `statusSubmitting` prop, and the orphaned `submitting` state it left. A
  loading affordance no one can reach is chrome. *(spine 6)* → *density*
- **A value that ticks every second gets its own context.** `elapsed` lived in
  the shared timer context, so a one-digit clock re-rendered every subscriber
  once a second — a whole page, and ~120 cards on the board. Split the tick into
  its own provider; only the components that render the number subscribe. → *throughput*
- **Extract the action into a hook; the original owner adopts it first.** When the
  write/optimism/undo lives inside one big component, only that component can act
  and a new surface can only *link* to it. Extract to a hook, make the original
  consume it (behaviour unchanged, tests green), **then** let the new surface use
  it — never a second implementation to diverge. Two surfaces on the **same SWR
  key** share optimistic state for free. *(spine 9)* → *data integrity*
- **The folder is the chrome rule, not a pathname allowlist.** Deciding
  app-shell vs marketing-chrome by matching path strings puts every new route on
  the wrong side by omission. A Next.js route group (`(app)/`) with the shell in
  its `layout.tsx` makes membership structural — no default-wrong case. → *trust*
- **Horizontal page scroll is a defect with an address, and the address is
  usually `min-w-0`.** A flex/grid child defaults to `min-width: auto`, so its
  min-content becomes the floor for the whole track — one forgotten `min-w-0` on
  a sidebar pushed a page 240px sideways at 390px. Fix the **outermost**
  offender: a single bad container generates hundreds of overflowing descendants,
  and the leaves point at the wrong file. Pattern in
  [stack-tailwind-react.md](stack-tailwind-react.md). → *throughput*
- **A responsive fix is not done until it is re-measured.** Swapping a calendar's
  month grid (which clipped event titles to 10–28px) for a list view fixed the
  legibility and introduced **+215px** of page scroll — the list is a
  `table-layout: auto` table. The measurement that justifies a change is not the
  measurement that proves it. → *every variable*
- **An empty state hides every overflow.** A CRM's tabs measured clean on a period
  with no deals and broke on one with real ones. Layout verification without real
  data is verification of nothing — same failure as reviewing a card with a
  three-character name. *(spine 10)* → *decision quality*
- **A primitive's mobile default belongs to the primitive, not to you.** shadcn's
  right-side `Sheet` is `w-3/4`: right for a nav drawer, wrong for a panel holding
  a whole form, which then lives in 75% of a phone. Override **at the consumer**
  (`w-full sm:max-w-2xl`) — editing the primitive to suit one caller breaks the
  others silently. → *throughput*
- **An undefined utility class fails silently and looks like it worked.**
  `scrollbar-none` had been on a header for months and never existed in any
  stylesheet. Classes are strings; nothing typechecks them. When a fix depends on
  a custom utility, confirm it resolves — read the computed style, not the
  className. → *trust*
- **A regression guard can read source, not behaviour.** Some defects are
  patterns, not values — `isDoneIssue` called without its status resolver, a
  hover-reveal keyed on a breakpoint. A vitest that greps the tree for the banned
  shape catches them where typecheck/lint/unit can't, and found two more
  occurrences than the manual sweep did. → *every variable*
