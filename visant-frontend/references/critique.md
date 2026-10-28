# Design critique

Format for reviewing an existing Visant surface. Use it when asked to critique,
audit, or "look at" a screen — and use it on your own work before presenting it.

A critique that produces only improvements is propaganda. The tension section is
mandatory.

## Before writing

1. **Classify the surface** (A / B / C — see SKILL.md). The class determines
   which rules apply. A critique that judges a work surface by acquisition rules
   is confidently wrong.
2. **Read the code**, not just the screenshot. Every finding cites `file:line`.
3. **Measure**, do not estimate. Count the chrome pixels. Tab through the
   keyboard flow. Open both themes.

## Output shape

### 1. Diagnosis in one sentence

The single central problem. If it takes a paragraph, the diagnosis is not done.

### 2. Findings, prioritized

**P0** — correctness: data integrity, keyboard traps, destructive-action hazards,
anything that produces a wrong number or an irreversible mistake. These are bugs
that happen to live in the design layer.

**P1** — structural: hierarchy, chrome budget, grouping, primary-action clarity.

**P2** — polish. A table is fine; do not spend prose on them.

Every finding states:

- what is wrong
- **why it is wrong, naming the principle and the variable it costs**
- the concrete fix, with real class names and components that exist in this
  project
- `file:line`

A finding that cannot name the variable it costs is a preference. Cut it or
label it as taste.

### 3. Keyboard flow

Required on any work surface. What exists, what breaks when focus is in a text
field, what is missing, and the corrected guard order. See
[work-surface.md](work-surface.md#keyboard).

### 4. Height budget

Table of vertical pixels before the first item of content, then the recoverable
total and what it buys. See [verification.md](verification.md#height-budget).

### 5. What NOT to change

List what is already right and why, so a careless rewrite does not destroy it.
Be specific — subtle correct decisions (a local `Set` that decouples the user's
rhythm from network latency; a `key` that forces remount so draft state does not
leak between records) are exactly what a redesign breaks first.

This section is not padding. It is the part that makes the critique safe to act
on.

### 6. One real tension

A trade-off where the recommendation has a genuine cost. State the cost, give the
options with what each loses, and make a recommendation anyway.

Worked example: a strategy panel inside a card violated the box-in-a-box rule and
cost 28px. The orthodox fix was to drop the frame and promote the label
typographically. But that panel was the only element on the screen that
*interrupted* — in a 40-minute session the user goes on autopilot, and the panel
was, in practice, a request for attention. Removing the frame risks the user
skipping the content that is the product's actual differentiator.

The honest options were: keep the box and accept a stated violation; drop it and
bet that typographic weight interrupts as well as colour does; or move the
content after the action, which breaks the mental model. The recommendation was
the second, **with a stated trigger to revisit** — if after three real sessions
the user notices they stopped reading it, the box comes back, and then it is an
informed decision rather than design debt.

That shape — cost, options, recommendation, revisit trigger — is what a tension
section should produce.

## Tone

Direct. No preamble, no flattery, no "great work overall". Findings are about the
code, never about the person who wrote it. Where a finding is uncertain, say so
and say what would settle it.
