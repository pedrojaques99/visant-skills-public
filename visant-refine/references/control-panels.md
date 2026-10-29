# Control panels: inspector, tweak panel, editor sidebar

A panel of parameters (an editor's inspector, a mockup/canvas sidebar, a
generator's settings, a motion tweak panel) is a work surface used hundreds of
times a session. It is where "assembled" shows fastest: every control is a
generic row, so the panel is a column of dropdowns and sliders that all look
alike and say nothing about the data they hold.

**First, do not build it if it is a dev tool.** A panel only the team uses
(tuning a shader, a spring, a 3D scene) is an install:
[Leva](https://github.com/pmndrs/leva), [Tweakpane](https://tweakpane.github.io/docs/)
or DialKit. These rules are for a panel the CUSTOMER uses, built with the
repo's own primitives.

## The reference case: DialKit 2.0.2 against its fork (scaena)

[scaena.darkroom.engineering](https://scaena.darkroom.engineering) shows the
upstream panel and a fork side by side, with the same controls in 17 slides.
The fork adds no feature anyone asked for; it redraws each control from the
shape of its data. Measured in the screenshots (2026-10-29):

| Control | Upstream | Fork | What changed |
|---|---|---|---|
| Background gradient | 11 rows: Type ▾, Gradient Type ▾, Color 1, Stop 1, Color 2, Stop 2, Color 3, Stop 3, Angle, "Add stop", "Remove stop" | Solid/Gradient/Media tabs, Linear ▾ + swap + reset, a gradient bar with draggable stops, a stops table (position · color · opacity · −), Save | the preview IS the control; 11 generic rows become one picture plus one table |
| Alignment | Horizontal ▾ + Vertical ▾ | 3 × 3 dot grid | a spatial choice gets a spatial control: one click instead of two lists |
| Scale | nested "Scale" folder with sliders | one row `X 1.25 · Y 1.25 · Z 1.25` + lock | a vector is one value with three parts |
| Layout mode | Mode: Grid ▾ | `Grid · Sphere · Spiral` segmented | 3 options, all visible, zero clicks to know them |
| Easing | curve, then "Type" below it, then `Ease 0.25, 0.1, 0.25, 1` as one string | `Easing · Time · Physics` ABOVE the curve, then 4 fields | the mode comes before what it changes; 4 numbers are 4 fields |
| Values | `50`, `1.0`, `16`, `0.50` | `50°`, `1.0×`, `16px`, `0.50s` | a number without a unit is trivia (refine rule: no number without a ruler) |
| Reset | full-width "Reset" button at the bottom | reset icon in each folder header, only after a value changed | chrome that exists only when there is something to undo |
| Versions | "Version 1" | "V1", rename/lock/delete behind one menu | three rare actions behind one icon |
| Loose controls | Opacity, Outline, Tint floating at the top | grouped under a named "Look" folder | a control without a group has no place to be found |
| Nested folders | solid divider, boxed rows | dashed divider, quieter rows | depth by line, not by box inside a box |

The pattern under all ten: **the control takes the shape of the data, the
chrome takes the shape of the state, and depth is drawn with lines, not boxes.**

## 1. The control takes the shape of the data

Choose the control from the data, never from what the primitive library has
on top.

| Data | Control | Not |
|---|---|---|
| 2–5 short options | segmented control (repo's `SegmentedControl`, or Radix `ToggleGroup`) with a sliding highlight | a dropdown: it hides options that would fit |
| 6+ options, or long labels | dropdown | a segmented control that truncates or wraps |
| on/off that reveals more | `Off · On` segmented, and the dependent controls appear only while On (section 3) | a checkbox far from what it controls |
| one point in 2D (anchor, alignment, origin) | 3 × 3 grid (or a 2D pad for a continuous point) | two dropdowns, horizontal + vertical |
| a vector (scale, position, rotation, padding per side) | one row of fields, letter as label; a lock for uniform | three stacked sliders |
| a bounded number | the row IS the slider: fill as background, label left, value right | a separate slider under a separate label |
| an unbounded or precise number | a field: scrub by dragging the letter/label, type on click, arrows ±1, Shift ±10 | a slider with an invented max (refine `simulators.md`: an arbitrary max makes the whole track lie) |
| a color | swatch + hex field; a click in hex selects all; channel modes (RGB, HSL, OKLCH, P3) as a segmented choice; eyedropper | a native `<input type="color">` alone |
| a gradient, a curve, a timeline | the picture of it, editable in place (stops on the bar, handles on the curve, clips on the track), plus the exact numbers as fields | a list of N "Color k / Stop k" rows |
| an ordered list of items | header with `+`, each row with its own `−`, drag to reorder | "Add" and "Remove" buttons at the end (remove WHICH one?) |

The test: cover the labels. If you can still tell what each control edits from
its shape, the panel is designed. If every row is the same grey bar, it is
assembled.

## 2. Row anatomy (the refine anatomy, at panel scale)

The shared anatomy of this skill fits a panel row exactly:

| Role | In a panel row |
|---|---|
| label | left, `text-xs`/`text-sm`, muted; no colon |
| value | right, `font-mono tabular-nums` so the column does not jitter while scrubbing |
| qualifier | the unit, right after the value, one tone dimmer (`°`, `×`, `px`, `s`, `%`) |
| evidence | the slider fill behind the row, or the swatch, or the curve |

And three rules that keep a column of rows readable:

- **Normalize what you display.** Hex uppercase (`#FF5A1F`), fixed decimals per
  control (`0.40s`, never `0.4s` then `0.45s`), so a column scans as a table.
- **Shorter is a feature.** "V1" for the version, "Look" for the folder. A
  panel is ~280px wide; every long label pushes a value into truncation.
- **One row, one height.** Segmented, field, slider and dropdown rows share the
  same height, so the panel has a rhythm and a grid (the `ritmo-scan` of the
  killer flags a row that drifts).

## 3. The chrome takes the shape of the state

What the panel shows around the controls depends on what happened, not on
what might happen:

- **Reset lives in the folder header and appears only when a value in that
  folder differs from its default.** It is a signal ("you changed something
  here") before it is an action. On click the values spring back. Never one
  global "Reset" at the bottom: it is far from what it resets, and it resets
  what you did not want to.
- **Conditional controls.** A control that only matters while another is On
  (Outline Width under Outline) exists only then, and slides in and out
  (height + opacity, 150–250ms, nothing under `prefers-reduced-motion`).
- **Rare actions go behind one menu** (`⋯` in the folder header: copy, paste,
  reset; in the version picker: rename, lock, delete). Three icons per row is
  chrome paid on every row for an action used once a week.
- **Help on demand, not on screen.** No permanent caption under each control
  and no native `title` tooltip (slow, unstyled, absent on touch). Either a
  hold-to-explain mode (hold `H`: the hovered control explains itself, the rest
  dims) taught once by a footer line that disappears after the first use, or a
  `?` per folder. On touch, the `?` is the only door: say which one ships.
- **Exclusive folders (accordion) are a choice, not a default.** They keep a
  small panel short; they forbid comparing two folders. In an inspector used all
  day, let several stay open and pin each header instead.

## 4. Depth by line and tone, not by box

- **Sticky folder headers that stack**, not only the panel title, with a short
  gradient fade at the top and bottom edges of the scroll: you always know which
  folder the row under your pointer belongs to, and the fade says "there is
  more" without a scrollbar.
- **Nested folder = dashed divider** under its header. A box inside a box
  inside the panel box is catalog 53.
- **Quiet rows, loud values.** Row background one step from the panel, value in
  the foreground token, label muted. Hover turns value and label to full
  foreground; nothing grows (no `scale` on hover, killer hard prohibition).
- **Every control belongs to a named folder.** Loose controls at the top of a
  panel are the controls nobody decided where to put.

## 5. Input discipline

- **A click lights the field; only the keyboard draws a ring.** That is
  `:focus-visible`, not `:focus`. A ring after every mouse click is noise.
- **A click in a field whose value is replaced whole (hex, a name) selects all.**
- **Three ways into every number**: drag (scrub), type, arrow keys. Each one is
  a different precision; a panel that only drags cannot hit `0.25`, one that
  only types is slow.
- **The mode selector comes before what it changes.** Tabs `Easing · Time ·
  Physics` above the curve, gradient type above the bar. A selector under its
  content is read after the content it reinterprets.
- **Snapping is opt-in by modifier** (hold Cmd/Ctrl while dragging a clip, a
  stop, a handle): magnetism by default fights the user who wants 0.47.

## 6. Prove the panel the way scaena does

A redesigned panel is shown against the old one **with the same controls and
the same values**, side by side, before anyone judges it. The comparison is
the argument: rows per decision (11 → 7 for the gradient), clicks per change
(2 → 1 for alignment), and what the eye finds without reading.

## Checklist before shipping a panel

- [ ] Every control chosen by the data table in section 1 (labels covered, shapes still say what they edit)
- [ ] Values `tabular-nums`, units dimmer, display normalized
- [ ] No global Reset; per-folder reset only when dirty
- [ ] Conditional controls hidden until they apply
- [ ] Rare actions behind one `⋯`
- [ ] No permanent help captions; help mode or `?`, touch door named
- [ ] Sticky headers, dashed nesting, no box in a box
- [ ] `:focus-visible` only; select-all on replace-whole fields; drag + type + arrows on numbers
- [ ] Mode selectors above their content
- [ ] Shown side by side with the previous version, same values
