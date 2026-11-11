# Score and report

## The score

100 points in three bands. The gate is worth zero or everything; judgment and
interrogation are worth one item at a time, answered with evidence.

| Band | Weight | How it scores |
|---|---|---|
| **Gate** (impeccable, token, copy, chrome noise) | 20 | all or nothing. Any error in the target drops the 20. A skipped gate scores 0 and is written down. |
| **Judgment** (visant-frontend, visant-motion, visant-copy, slop-catalog) | 40 | 40 minus 4 per confirmed slop-catalog item that survived with no fix and no justification the user accepted, minus 8 per **dead core**: a `shine` region without its brand moment, or a core component without its states. |
| **Interrogation** (devil's advocate) | 40 | proportional to the tier's questions answered with `file:line`, plus the fixed block F1 to F7. A question answered with an adjective instead of evidence does not count. |

**Why a dead core costs double.** Every other deduction punishes what is left
over, so a cleanup that deletes the reason to stay used to score higher. Slop is a
tell; a dead core is a lost reason to stay. It weighs more than a slop item and
less than the gate: it is judgment, confirmed on the screen, not a syntax veto.

**Why the gate is worth little.** In the skill's first real round (a set of
finance cards) `impeccable` and the token gate gave **zero before and zero
after** the refactor: all 12 slop items were caught by judgment. The gate has
veto power and almost no discriminating power, and a score that rewards what
does not discriminate teaches people to run the script and declare 88. It is
still eliminatory, and now it is worth what it measured.

Reading the score:

- **below 70**: does not go to PR. It has a gate defect or confirmed slop with no fix.
- **70 to 89**: goes to PR with the open items listed and an owner named.
- **90 or more**: passed. There may still be a pending product decision, and it goes at the top of the report, not the bottom.

A high score with verification missing **is not a high score**. What did not run
goes in as an explicit deduction, with the reason.

## Report template

File at `docs/audits/killer-<target>-<YYYY-MM-DD>.md`, or wherever the repo
already keeps audits. Score and pending decision come before any detail: whoever
reads the report is deciding, not studying.

```markdown
# Killer: <target>

**Tier** T2 route · **Score** 86/100 · **Verdict** goes to PR with open items
**Surface** B work (throughput and decision quality)

## Pending decision (the user's, not mine)

1. <the question that changes scope, with my recommendation first>

## Gate

| Detector | Before | After |
|---|---|---|
| impeccable | 3 errors | 0 |
| token (audit:design or fallback) | 2 errors | 0 |
| copy (voice) | 4 | 0 |
| tsc | pass | pass |
| 390px | +215px | 0 |

Skipped: <none, or which one and why>

## Slop fixed

| # | Catalog | Where | Fix |
|---|---|---|---|
| 1 | Rainbow card | Card.tsx:66-160 | color became the exception; a typographic minus marks outflow |

## Craft

| Region or core component | Craft | Brand moment (or what stays quiet) | Swap test |
|---|---|---|---|
| first run | shine | the mascot alive, art that tells the feature | passes: the drawing is this brand's |

## Slop kept on purpose

| Catalog | Where | Why it stays |
|---|---|---|

## Interrogation

Q5 <question>
   <answer with file:line>
   FORCES: <what changes, or "nothing">

### Fixed block

F1 reuse · F2 design system · F3 responsive and performance · F4 flow for the ICP
F5 hide or turn into an icon · F6 what is missing for Silicon Valley level · F7 swap test

## What this round fixed in the detectors

Required section, even if empty. Every audit of code you did not write finds
detector noise, and unreported noise comes back as distrust in the gate. A fixed
false positive goes here with the case locked in the fixture; a false negative
too, and that one is the serious one.

| Rule | Was flagging | Fix | Fixture case |
|---|---|---|---|

## Taste proposal (the user picks line by line)

| Key | Before | After |
|---|---|---|

## Not verified

- <what did not run, and what it would take to run it>
```

## Report rules

- **Before and after of text: always the text.** The user approves copy by
  reading copy, never a summary of copy.
- **Taste proposal kept apart from the fix.** Mixing them forces the user to
  review the reviewer.
- **No "I improved the hierarchy".** Say which element went up, which went down,
  and the variable that moves.
- **"Not verified" is never empty out of laziness.** If it really is empty,
  write what was run to prove it.
