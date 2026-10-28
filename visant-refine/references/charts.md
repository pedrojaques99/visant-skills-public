# Charts (recharts)

Complement to `dataviz`, which owns form, color by function and anti-patterns.
This file only holds what is specific to the stack. The examples use recharts;
if the SKILL.md discovery found another lib, the rules carry over.

## Token map

Never hex in JSX, never raw Tailwind palette. And **the wrapper is not optional**
when tokens store bare HSL channels (`--primary: 0 0% 9%`):
`stroke="var(--primary)"` yields the string `0 0% 9%`, which is not a color. The
stroke just does not show: no type error, no lint warning, no visual detector
finding. That is exactly how a chart gets committed without color.

```tsx
// One series: the series color is the primary itself; text uses a text token.
<Line dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />

// Grid and axis are recessive, always.
<CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
<XAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={false} />
```

Before writing the first color, check the token format in the repo's
`globals.css`: bare channels need `hsl(var(--x))`; a token that is already a full
color (`oklch(...)`, `#hex`) needs bare `var(--x)`. Getting the format wrong is
invisible when reading the code.

| Function | Token |
|---|---|
| single series, magnitude | `hsl(var(--primary))` |
| second series, comparison with the past | `hsl(var(--muted-foreground))` |
| exception (overran, late, negative) | `hsl(var(--destructive))` |
| goal hit | `hsl(var(--success))` |
| grid and axis | `hsl(var(--border))` and `hsl(var(--muted-foreground))` |

More than two series on a working panel means the question was not decided. Cut
the series or split into two charts. Never two y axes.

## States

Every chart goes inside a state wrapper (the repo's `ChartState`, or the
equivalent the SKILL.md discovery found; if none exists, it is the first piece to
ask for): bar-shaped skeleton, no layout shift, and an empty state that speaks.
An empty framed axis is the chart equivalent of "0 items" that was really a
network error.

Error is a separate state from empty. If the fetch failed, the chart does not say
"no data for this period".

## Limits and goals

A limit is a fact, so it is a line, not a background color:

```tsx
<ReferenceLine
  y={MEI_ANNUAL_LIMIT}
  stroke="var(--destructive)"
  strokeDasharray="4 4"
  label={{ value: 'Teto MEI', position: 'insideTopRight',
           fill: 'var(--muted-foreground)', fontSize: 11 }}
/>
```

- Dashed for a legal limit or goal; solid only for the data.
- The label carries the name. An unlabeled line forces memorizing the legend.
- Marking **where** it crossed is worth more than marking that it crossed: in a
  cumulative chart, the month it passed the ceiling is the information that
  triggers action.

## Cumulative crossing a band

The right form for "when do I go over the limit": cumulative area by month, a
`ReferenceLine` at each cut, and the crossing point labeled. Not a pie, not bars
per month (which hide the cumulative), and not a gauge (which loses the when).

```tsx
<AreaChart data={cumulative} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
  <defs>
    {/* id scoped per instance: two charts with the same id overwrite each other */}
    <linearGradient id={`fill-${instanceId}`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.18} />
      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
    </linearGradient>
  </defs>
  <Area dataKey="cumulative" stroke="var(--primary)" strokeWidth={2}
        fill={`url(#fill-${instanceId})`} />
</AreaChart>
```

React's `useId()` solves the scope. Without it, repeated `clipPath` and `defs`
across two charts on the same page collide, and the bug shows up as one of the
two charts missing its fill.

## Sparkline

No axis, no grid, no tooltip, fixed height, `dot={false}`. If the series has
fewer than 4 points, do not draw: write the delta.

## Tooltip

If the repo already has a custom chart tooltip that formats currency, reuse it.
Build your own only if the content is structurally different, and then it is born
next to the other one, with the same spacing and the same label style.

## Chart-specific verification

- Render and **look**: the `dataviz` validator checks color, not label collision
  or overflow.
- Measure at 390px: charts are the main source of horizontal overflow, and
  `ResponsiveContainer` needs a parent with defined width and `min-w-0`.
- Empty year, empty month and a single point: all three render without breaking
  the axis.
