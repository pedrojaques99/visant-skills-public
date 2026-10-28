# Cases behind the rules

The stories that produced some of the rules in `SKILL.md`. Evidence, not rules:
the rule lives in the body; this file says where it came from.

## Why §1 and §2 come first

The skill used to open with the SSoT bootstrap, which only matters once per
repo, and buried the decision rules and the gotchas below it. What survives in
behaviour is the first screen an agent reads, so the first screen became what
you use every time, and the bootstrap moved to the end (§10), where you look for
it exactly when you need it.

## Amplitude, not duration (gotcha 8)

A "black hole" delete animation: 200° spin, overshoot on the vanishing dot and
22 dust grains per row. The verdict from the person who asked for it: "tá mt
amadora kkk" (it looks really amateur). The fix kept the timing and cut the
amplitude: ~12° spin, row shrinks to 40%, 12 faint grains, neighbours pulled
≤ 4px, no overshoot on anything that disappears.

## One focus of motion per surface (gotcha 9)

A screen where the queue ticked, four images streamed in, an export counted %,
an error shook and a toast slid, all at once, was reported as "mt coisa
espremida e acontecendo ao mesmo tempo" (too much squeezed in, happening at the
same time). Sequencing the states (sent → generating → ready → exporting) fixed
it.

## Sound palette (§2b)

The analog-object palette came out of a long round of user reports on a
component library. Pitched sounds with reverb were rejected as tiring; a
parametric-curve editor that played a sound on every drag pixel got "tirar sfx
de arrastar aqui" (remove the drag sfx here), which is where the "a drag must
not play on every pixel" rule and the "stays silent while being tweaked" rule
came from.

## `--fix` exists because most of an audit is mechanical (§7)

In one audit round, 48 of 55 findings were `duration: 0.6` wanting to be
`DUR.slow`. Mechanical, and it still ate most of the session by hand. That is
why `motion-lint --fix` delegates to the codemods, and why the codemods refuse
the changes that are design decisions.

## Reuse before rebuilding: a reference implementation (§6)

In the Visant task board (a Next.js app), the status-write + completion ritual
(celebrate → row exit → optimistic patch → undo) lives in one hook consumed by
both the board and the home on the same SWR key. A per-second running clock was
split into its own context so the ritual's consumers don't re-render every
second. That repo was the canonical reference for the SSoT starter in
`assets/motion-ssot-starter/`.
