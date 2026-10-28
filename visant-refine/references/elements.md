# Finishing element catalog

Each element: what it is for, its anatomy (label, value, qualifier, evidence),
and the mistake it usually makes. All inherit the shared anatomy rules from
SKILL.md, and none of them is a design system component: they are compositions
over `Card`, `Progress`, `Slider`, `Skeleton` and the chart lib.

Index: [Limit meter](#limit-meter), [Metric tile](#metric-tile),
[Sparkline](#sparkline), [Change badge](#change-badge),
[Ratio gauge](#ratio-gauge), [Regime band](#regime-band),
[Verdict line](#verdict-line)

## Limit meter

The most requested element, and the most often wrong. Shows a value against a
ceiling.

Anatomy: label (what is measured), value (percent of the ceiling, or the
absolute value when the ceiling is well known), qualifier (the ceiling, with the
number), evidence (bar).

Own rules:

- **Outside the domain, the bar goes.** Above 100% the bar saturates and starts
  lying. Replace it with the overrun as a number: "R$ 141.430,91 acima do limite".
- The ceiling lives in the header or the qualifier, once, never both.
- Color only when it overran. Yellow at 80% is opinion disguised as a warning,
  and only goes in if there is a different action to take at 80%.
- Percent formatted with `Intl.NumberFormat` in `style: 'percent'`, one decimal.

Classic mistake: a full bar next to "274,6% utilizado".

## Metric tile

A hero number with context. One per card, at most.

Anatomy: label, value (`text-3xl font-semibold tabular-nums`), qualifier (the
line that gives the ruler), optional evidence (sparkline or thin bar).

Own rules:

- One tile per surface carries weight; two tiles of equal weight become none.
- Zero does not render a tile: it renders a one-line empty state.
- Without the qualifier it is not a tile, it is a loose number.

## Sparkline

Axis-less trend, inside a line of text or next to a tile.

Anatomy: value beside it, and the line as evidence. No axis, no grid, no tooltip,
no legend.

Own rules:

- Fewer than 4 points is not a trend: show the delta as a number.
- Without an axis the scale is unknown, so the sparkline **cannot** be the only
  source of a number; it accompanies a written value.
- Fixed height (24 to 40px) and free `preserveAspectRatio`.

## Change badge

The delta against the previous period.

Anatomy: value (the delta, signed), qualifier (against what, always written:
"vs. jul").

Own rules:

- No base, no delta: a zero base is `null`, not "+100%".
- Direction icon plus number; never color alone, never icon alone.
- Stock delta and flow delta are different things. Stock (queue, balance,
  pipeline) takes no date filter.

## Ratio gauge

An arc for a closed ratio (part of a known whole). Use it when the whole is the
argument; if the whole does not matter, it is a tile.

Own rules:

- Only for ratios between 0 and 1. Past 1, it becomes a limit meter.
- The number lives in the center; the arc is evidence, never the only carrier.
- A half arc (180°) reads better than a full ring in a short card.

## Regime band

A segmented scale showing which band a value fell into (tax, plan, tier). It is
the element that turns "which regime" from a calculation into a reading.

Anatomy: label, value (the current band, by name), qualifier (the cuts as
numbers), evidence (segmented track with the value marked).

Own rules:

- Cuts show as numbers on the track, not only as a color change.
- The current band gets its name written. Color alone forces memorizing the
  legend.
- An unavailable band (a regime the value already excluded) stays visible and
  marked unavailable. Hiding what was lost erases the explanation.

## Verdict line

One line above a group of cards that says what the cards mean together. It exists
for when the screen delivers two totals and the user was comparing in their head.

Anatomy: value (the conclusion), qualifier (the summarized evidence), no visual
evidence of its own.

Own rules:

- One sentence, one number, no color unless there is a real exception.
- If the conclusion depends on data not on screen, the line says so instead of
  concluding wrong.
- A verdict is an assertion. If the calculation is a hypothesis, the line uses
  that word.
