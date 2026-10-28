# Devil's advocate

Question bank for Step 4. Not a UI checklist: it is a concept interrogation. A
good question here erases pixel work that never needed to exist.

**How to use:** T1 uses the 5 marked `[T1]`. T2 uses the 12 marked `[T1]` and `[T2]`.
T3 uses all of them. The **fixed block** (section 7, F1 to F6) runs in every tier, no
exceptions: they are the six questions the user asks anyway, so arriving without
them answered is arriving incomplete. Answer each one **yourself**, with
`file:line`, before escalating anything to the user.

Index:
- [1. Existence](#1-existence)
- [2. Decision](#2-decision)
- [3. Data truth](#3-data-truth)
- [4. Attention hierarchy](#4-attention-hierarchy)
- [5. Product, scope and positioning](#5-product-scope-and-positioning)
- [6. Cost and future](#6-cost-and-future)
- [7. Fixed block: the six house questions](#7-fixed-block-the-six-house-questions)
- [How to report the answer](#how-to-report-the-answer)

---

## 1. Existence

**Q1 `[T1]` If I deleted this today, who complains within 48 hours, and what does
that person do instead?**
"Nobody" kills the element on the spot. "They open the spreadsheet" is worse than
"nobody": the screen lost to a spreadsheet and still costs maintenance.

**Q2 `[T1]` Does this element exist because someone needs it, or because the data
was available?**
The core vice of admin dashboards. Available data is raw material, not a reason.
If the origin was availability, the element becomes a log line, not a card.

**Q3 `[T2]` What is the version of this that would fit in one sentence of text? Why
is the screen better than the sentence?**
If the sentence delivers the same, the screen is decoration with a render cost. If
the screen is better, the reason is comparison, ordering or action, and that
reason has to be visible in the layout.

**Q4 `[T3]` What is the smallest number of screens that delivers this result? Why
isn't it that number?**
Every extra screen is a navigation the user has to learn. Without a written
defense, merge.

---

## 2. Decision

**Q5 `[T1]` What decision does this produce? Write the sentence the user says out
loud after looking.**
If the sentence is "ok", it is a report, not a tool. A tool produces "so I'll do X".

**Q6 `[T1]` What is the number that decides, and is it the heaviest element? If
not, why?**
Mechanism: **attention hierarchy** (RCD). The user uses what is most salient,
which is rarely what retains. Weight is contextual: the same data weighs
differently in a grid where you choose and in an already sorted queue where you
process.

**Q7 `[T2]` Is this the answer, or the raw material of the answer?**
If the user still needs a calculator, or a second card, or to add two columns with
a finger, the product did half the work and called it a feature. The follow-up
question is always the same: which calculation should the interface have done for
them.

**Q8 `[T2]` What default did you pick for the user here, and do you defend that
default in writing?**
Mechanism: **a default is the decision you made for the user** (RCD 6). Initial
sort, initial filter, initial period and preselected plan are recommendations with
your name on them. The default's rule has to fit in a visible line where they
choose.

**Q9 `[T3]` Model the user's optimal play here. Does it pay you?**
A product where the user's optimal play is zero revenue has every rule working and
the whole leaking.

**Q10 `[T3]` Where is the limit that motivates the upgrade, and does it show up at
the moment the limit is hit?**
Mechanism: **expansion is born from usage** (RCD 8), never from interruption.

---

## 3. Data truth

**Q11 `[T1]` In which scenario does this number lie?**
The four classics, all seen in production: a fetch that failed and paints zero; a
zero denominator becoming "0,0%"; a stock (queue, balance, pipeline) receiving a
date filter that only events should receive; two numbers of the same unit and
different kinds (budgeted and actual) side by side with no label saying which is
which.

**Q12 `[T2]` If the backend goes down, does this show an error or a zero?**
Silent zero is the dominant lie, and it is usually told one layer down: the
service catches the failure and returns an empty payload, so the page's error
state becomes unreachable and the fix looks done. Verify **by running with the
backend stopped**.

**Q13 `[T2]` What promise does this make that the database doesn't back?**
Price typed in copy while the charged value lives on the server; a status label
that isn't the status; a count that excludes what the list includes. The fix isn't
vigilance, it is a build lock.

**Q14 `[T3]` If the optimistic write fails, what gets recorded?**
UI can't lie to the database. Recording an action that didn't happen corrupts the
metric the business steers by, and a faked number can't be optimized.

**Q15 `[T3]` Role or ownership? Is the person seeing this the one who acts here?**
Personal controls (preference, "my hours", timer) are unlocked by ownership of the
resource, not by role. An admin looking at someone else's board can't see a
personal action rendered under that person's name.

---

## 4. Attention hierarchy

**Q16 `[T2]` How many vertical pixels until the first real data?**
Chrome is a budget. Spend it inside the content and pay by cutting chrome, never
content.

**Q17 `[T2]` Where WILL this element be missing?**
Run with the best record and with the worst. Absence is an argument: an element
missing exactly on your best records is worse than no element. Empty also hides
every layout overflow, so measuring without real data measures nothing.

**Q18 `[T2]` What does this teach the user to do wrong?**
Color on everything teaches that color means nothing. A badge that 100% of rows
carry teaches people to ignore badges. A disabled primary teaches that the button
lies.

**Q19 `[T3]` If this screen is the only thing the customer sees of the product, do
they renew?**
Retention is built in the interior, on the screen the person faces every day.
Keyboard, latency and rhythm are retention features (RCD 7).

---

## 5. Product, scope and positioning

**Q20 `[T3]` Which feature do I kill to open cognitive room for this one?**
Mechanism: **Swiss Knife Index** = features used by more than 40% of actives in 30
days, divided by total features. Below 0.3 the product is a clumsy pocketknife.
Hiding solves what deleting doesn't need to solve: send the rare thing to
advanced, reachable for the 3% and gone for the 97%.

**Q21 `[T3]` Who is this screen's ICP? If the answer is "the team", which role? If
it serves two roles, which of the two is served worse?**
Whoever talks to everyone convinces no one (RCD 2). A screen serving two roles
usually serves both badly and neither well.

**Q22 `[T3]` If a competitor copies this pixel by pixel tomorrow, what is left that
is ours?**
Same competes on price, different competes on category (RCD 5). The difference
lives in mechanism, narrative or experience, and has to be nameable in one
sentence.

**Q23 `[T3]` Is the promise the size of the proof?**
The market believes what you demonstrate (RCD 4). Proof that arrives after the
doubt arrives late.

**Q24 `[T3]` Do the four layers say the same sentence?**
Landing, onboarding, product and pricing. Misalignment here makes every downstream
design decision unwinnable, and no screen fix solves it.

**Q25 `[T3]` Is this a category error?**
The question that moves price the most at Visant: is the object the brand or the
site? The wrong shelf sets the wrong yardstick and the wrong value. It applies to
any deliverable the product names.

---

## 6. Cost and future

**Q26 `[T2]` Who maintains this in six months, and how does that person find out
it broke?**
A rule that only exists in the author's head isn't a rule, it's luck. A defect that
is a pattern, not a value, becomes a test that sweeps the tree for the forbidden
shape.

**Q27 `[T3]` If I charged for this, how much? If the answer is "nothing", who pays
the eternal maintenance?**
Price is a filter (RCD 9). It applies to internal screens too: what is worth
nothing to anyone is cost dressed as a feature.

**Q28 `[T3]` Which decision of this audit will I regret in three months?**
Last question, always. Write the answer in the report. It is the next round.

---

## 7. Fixed block: the six house questions

They run in T1, T2 and T3. Each one demands a search or a measurement, never an
opinion.

**F1 How much are we reinventing the wheel?**
Before building anything, search: an existing component in the repo, an item in
the Visant registry (`visant-registry`), an official shadcn or Radix primitive, a
validated lib. Custom is the fallback, not the default.
How to answer: list what was **reused** and what was **written new**, and for each
new one the search that justified it. Two implementations of the same thing on
different routes are debt: extract a shared hook or component, the original
consumer adopts it first (behavior unchanged), then the new surface consumes it.
Alarm signal: a formatting, date, currency or status utility written inside the
component.

**F2 Is our design system consistent?**
Token, not raw color. Shared primitive, not a copy. Same label, ruler, radius and
spacing pattern as the neighboring card on the same route.
How to answer: the repo's token gate (`audit:design` or equivalent; without one,
the `killer-scan` fallback) at zero errors on the target, plus a side-by-side
comparison with the exemplary component in the same folder (the one that already
passed review). A divergence found becomes either a fix on the target or a change
proposal on the exemplar, never a third variant.

**F3 Is everything responsive and optimized?**
Responsive is measured, not eyeballed: `documentElement.scrollWidth - innerWidth`
at 390px with real data, and re-measure after **each** fix, because a responsive
fix trades one overflow for another. A primitive's mobile default is overridden in
the consumer, never in the primitive.
Optimized has a number before the effort: the Next dev server lies by a factor of
two (StrictMode and on-demand compilation), so measure in production. Usual
suspects: a value that ticks every second inside a shared context, a heavy
description traveling in a list payload, and `keepPreviousData` unmounting a
component with internal state.

**F4 Is the end-to-end strategy progressive and intuitive for the ICP?**
Walk the whole flow, not the screen: how you get here, what you do, and where you
go next. Landing, onboarding, product and pricing have to say the same sentence,
and each step has to return value before asking for effort (value first, ask
later).
How to answer: write the path as numbered steps, mark the step where the user
discovers the value (time to "aha"), and name the step where they drop off. If the
ICP isn't named by role, that is the answer.

**F5 What can we hide, compact or turn into an icon?**
Hiding solves what deleting doesn't need to solve: the rare thing goes to
advanced, reachable for the 3% and gone for the 97%. Compacting is merging two
lines that say the same thing. Turning into an icon only counts with an accessible
label (`aria-label`) and when the meaning is universal; an obscure icon trades a
readable label for a riddle, and that is a regression dressed as density.
How to answer: a table with three columns, hide / compact / turn into icon, and a
fourth with what should **not** be hidden and why. Every row names how many
vertical pixels it gives back.

**F6 What is missing to reach the level of a Silicon Valley product?**
Closing question, and the easiest to answer on vibes. Don't answer with an
adjective: answer with the list of what's missing, each item with effort and
leverage.

The level is measured in thirteen details, and none of them is aesthetic:

1. Keyboard reaches every action, and the shortcut shows where the action shows.
2. `focus-visible` reaches everything hover reveals.
3. Zero layout shift between loading and loaded (skeleton with the final shape).
4. Optimistic write with undo, never a confirmation modal for a reversible action.
5. Error, empty and loading are three distinct states, and empty makes a case.
6. Nothing lies: no silent zero, no zero denominator, no label that isn't the
   status.
7. Perceived latency handled where it is born (wait only for what the screen
   needs; the rest leaves the critical path).
8. Motion from the SSoT, under 300ms, interruptible, and respecting
   `prefers-reduced-motion` without canceling the result.
9. Defensible density: chrome counted in pixels until the first real data.
10. One primary per surface, and a disabled primary doesn't exist.
11. A default you defend in writing, with the rule visible where people choose.
12. Comes back to the same position after acting (the action doesn't lose the
    user's place).
13. Copy in the house voice, no vices, and error messages that say what to do.

How to answer: mark the thirteen as done, missing or not applicable; then name the
**three** with the highest leverage per effort and stop there. A list of thirteen
pending items isn't a plan, it's discouragement.

---

## How to report the answer

For each question asked, three lines in the report:

```
Q7 Is this the answer or the raw material?
   Raw material. The two cards deliver two totals and neither says which tax
   regime costs less (MeiTaxCard.tsx:60, TaxSummaryCard.tsx:79). The comparison
   is the work, and the user is doing it in their head.
   FORCES: a verdict line at the top, or merge the two cards. The user's call,
   because it changes scope.
```

A question without evidence doesn't go in. An answer that forces nothing leaves the
report: an interrogation that ends in "everything is fine" didn't interrogate.
