# Spatial surfaces (canvas, maps, free-form editors)

Screens where content doesn't flow in a column: geographic maps, editing
canvases, infinite boards, any surface the user pans/zooms instead of
scrolling. Still class **B — work** (the variable is still throughput ×
decision quality), but the chrome doesn't live "above the first item", it
lives **over** the content.

## Full-bleed with floating docks

The canvas/map occupies 100% of the viewport. Menus, filters and telemetry
live in floating, translucent panels (glassmorphism: blur + subtle border +
semi-transparent background), never pushing the canvas into a fixed-column
grid — that would reintroduce exactly the problem this pattern exists to
avoid.

- **One dock per function**, not one per feature added. Same rule as "one
  stage, one home per control" in work-surface.md: more than one bar of
  general tools in the same corner needs a reason.
- Docks sit over the canvas with a deliberate z-index; they are not part of
  the canvas's own document flow, so they don't compete for space with its
  `flex`/`grid`.

## Clickable pins with state

Each pin summarizes its main datum right on the map — status, badge, note —
without requiring a click to learn the basics (the same "weight follows the
decision" logic from work-surface.md, applied to a point in space instead of
a table row).

Clicking the pin or the canvas point opens the **side panel**
(see [work-surface.md → Side panel (non-blocking inspector)](work-surface.md#side-panel-non-blocking-inspector)),
never a separate detail component — otherwise the product ends up with two
detail panels doing the same job, the
[two doors for the same gesture](../../visant-killer/references/slop-catalog.md#21-two-doors-for-the-same-gesture)
anti-pattern.

## Resize invalidation

Maps and canvases (Mapbox, Leaflet, Konva, Fabric, R3F) don't re-render on
their own when their container changes size — a grey or clipped band is left
until the next event fires. Always attach a `ResizeObserver` on the
container that calls the library's own invalidation method (`map.resize()`,
`stage.batchDraw()`, etc.) whenever the side panel opens/closes or the
window resizes. Specifically test the moment the side panel opens: it's the
most common width change and the easiest one to forget to test.

## Neighbors

- [work-surface.md](work-surface.md): general chrome budget and the side
  panel pins open
- `visant-motion`: the dock's enter/exit transition follows the same rules
  as any other overlay
- `visant-refine`: telemetry inside a dock (gauges, sparklines) is drawn
  there; this page only decides that it exists and where it lives
