# Worked case: tax panel

An admin tax panel, in 2026-08. A tax simulation panel that already had two
calculation cards (MEI and Lucro Presumido, two Brazilian tax regimes) and no
visual reading. The request was "charts and sliders that account for the limits,
and smart animations". What went in, what was refused, and why.

## The diagnosis before drawing

The panel delivered two totals and the user was doing in their head two
calculations the screen could do:

1. **"Do I still fit in MEI?"** It existed as a progress bar, and the bar was
   saturated at 100% next to the text "274,6% utilizado". A saturating bar lies.
2. **"When did I go over?"** It existed nowhere. A gauge answers *whether*; only
   the time series answers *when*, and in MEI the month of the overrun is what
   triggers action, because the regime exclusion is retroactive to it.

That decided both forms before any code: **a monthly cumulative with a ceiling
line** (answers when) and **a projection slider** (answers "what if"). No gauge,
no pie, no extra card.

## What went in

**`FiscalSimulator`**, a card above the two calculation cards, with three blocks
in the shared anatomy (label, value, qualifier, evidence):

- **The value in use, and what kind it is.** The big number is the revenue the
  two cards below are using, and the line under it says whether it is booked or
  projected, with the booked value always written out.
- **Projection track.** The repo's `Slider`, domain of 1.5x the booked value with
  a floor that keeps the MEI ceiling inside the track (an arbitrary max makes
  the control feel like a guess), `step` of one thousand, the MEI cut drawn on
  the track **with the number**, and a thin mark at the booked value that never
  leaves. `aria-valuetext` returns formatted currency, not the raw number.
- **Monthly cumulative** in an `AreaChart`, dashed `ReferenceLine` at the ceiling
  labeled "Teto MEI", gradient `id` scoped by `useId()`, and the crossing month
  written next to the block label. Inside `ChartState`, so a year with no
  entries says so instead of drawing an empty axis.

**A scenario does not become fact.** Both calculation cards got `isScenario`,
which lights a "cenário" badge in the header. Without it, whoever opens the
screen later reads projection as result, and the exported spreadsheet (which
still comes from booked data) diverges from the screen with no explanation.

**Mandatory bonus:** `fetchFiscal` did `res.ok ? ... : 0`, so a network outage
rendered zero everywhere, and with the cards' new empty state it started to
claim "sem faturamento lançado". It became a `throw` with an error state on the
route. A wrong number is bad; a wrong sentence is worse.

## What was refused

- **Animated counting on the card numbers.** The value follows the finger on the
  slider; animating the total on every release would fight the next drag and
  turn the screen into two simultaneous counters.
- **A progress bar on the MEI card above 100%.** It had already been replaced by
  the overrun as a number earlier, and the slider did not bring it back.
- **A second axis on the chart** to plot expenses next to the cumulative. Two y
  axes is chart mistake number one; expenses are not this panel's question.
- **Persisting the scenario in the URL.** Sharing a scenario was not in the
  request, and a scenario link without a scenario label is the same lie, now
  traveling.

## The animation that stayed

Only one, and it is the one carrying the decision: **crossing the ceiling
changes the regime band's state**, with a short color transition through the
tokens (`--dur-base`, `--ease-out`). No pulse, no glow, no staged entrance. The
rest of the movement is what the primitives already do: Radix's `Slider`
following the cursor and `Progress` transitioning via `transform`.

Changing the year discards the scenario: one year's projection does not apply to
another, and a scenario that survives a context switch is a scenario that will
be read as fact.

## What the gate caught in the work itself

Running `visant-killer` on what had just been written returned two findings,
worth recording because they are the two easiest mistakes in this layer:

1. `text-[11px]` on a track label. Arbitrary font size, when `text-xs` existed.
   A chart accepts `fontSize: 11` as a JS prop; a class does not.
2. The word "real" three times, counting across files. The finding was a false
   positive of the script (the copy-lint rule counts per document, and six files
   had been merged into one JSON), **and** it was a real copy problem: "real"
   versus "projetado" is ambiguous in a tax panel, where "lucro contábil real" is
   a technical term. It became "lançado" versus "projetado", which is accounting
   vocabulary, and the button became "Limpar cenário".
