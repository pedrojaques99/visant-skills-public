# Slider simulation

A slider that projects a scenario puts on screen a number that **did not
happen**, next to numbers that did. The whole design exists so that separation
does not fail. It is the same principle as "the UI cannot lie to the database",
turned outward.

## The contract

1. **The real value stays visible and marked on the track.** A tick at today's
   value, and the label says which is which ("real" and "simulado", or "hoje" and
   "projetado"). Two numbers of the same unit and different kinds, unlabeled,
   corrupt the reading of whoever arrives later.
2. **An active simulation is a visible state**, not a silent difference in a
   number. A label on the block is enough; no frame or color needed.
3. **Back to real is one click**, and the control only shows while simulating.
   A dead control does not render.
4. **Stops at the numbers that change the decision.** A round `step` is lazy: the
   useful stops are regime cuts, goals and the real value. Between stops, free
   and fine movement.
5. **Cuts show on the track** before dragging, with the number. The user needs to
   see where things change to know where to drag.
6. **Nothing persists.** Simulation does not write to the database. It only goes
   into the URL if sharing a scenario is part of the request, and then the link
   says it is a scenario.
7. **Keyboard moves it and screen readers speak it.** Radix arrows already work;
   `aria-label` says what the slider controls and `aria-valuetext` returns the
   formatted value, not the raw number.
8. **A meaningful range.** The slider max is a defensible number (the next regime
   cut, double the real value), not `999999`. An arbitrary max makes the whole
   control feel like a guess.

## The state

One state only, and it is `null` when there is no simulation. That kills the
`simulated === real` comparison (which breaks on floating point cents) and makes
"back to real" just `setSim(null)`:

```tsx
const [sim, setSim] = useState<number | null>(null);
const valueInUse = sim ?? real;
const simulating = sim !== null;
```

Deriving everything from `valueInUse` keeps a single source. The mistake that
shows up here is storing the calculation result in state and recomputing it in
an effect: the calculation is pure, so it lives in render.

## Latency

The number **follows the finger**. No debounce on the displayed value, no
animation on the value while dragging, no fetch per movement. If the projection
needs a server, the design is wrong: simulation is local math, and what is not
local math becomes a "projetar" button with a single result.

## Classic mistakes

- Slider without the real value on screen: whoever opens the screen two days
  later no longer knows which number is fact.
- A `step` of one thousand over a domain of two hundred thousand: 200 stops, none
  useful.
- Simulation that changes exported data. The spreadsheet exports the real value,
  and if it exports a scenario, the file name says so.
- Animating the number while dragging.
- A slider as a filter. A filter is a filter (select, period, search); a slider
  is a projection. Swapping them makes the user think they deleted data.
