# Motion Rules — full catalog (Emil Kowalski + Apple)

Deep reference for building and auditing. Load when writing motion or running a motion audit.

**Source:** Emil Kowalski's skills — https://github.com/emilkowalski/skills (the `emil-design-eng`, `apple-design`, `improve-animations`, and `review-animations` skills) — themselves distilled from animations.dev and Apple *Designing Fluid Interfaces* (WWDC 2018). The values below are transcribed/condensed from there; go upstream for the full catalog (clip-path animation, hold-to-delete, comparison sliders, WAAPI, 3D transforms, the Sonner principles).

## Contents
- Easing curves
- Duration table
- Springs (when + config)
- Component rules
- Apple fluid principles
- Audit: 8 categories + severity + fixes

## Easing curves

The built-in CSS easings are too weak — they read as sluggish. Use strong custom curves:

```css
--ease-out:    cubic-bezier(0.23, 1, 0.32, 1);    /* enter/exit, responds to input */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);   /* move/morph on screen */
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);    /* iOS-like sheets/drawers */
```

Decision:
- Entering/exiting? → **ease-out** (starts fast = feels responsive).
- Moving/morphing on screen? → **ease-in-out**.
- Hover/color change? → **ease**.
- Constant motion (marquee, progress)? → **linear**.
- **Never `ease-in` on UI** — it delays the initial movement, the exact moment the user is watching. A dropdown with `ease-in` at 300ms *feels* slower than `ease-out` at 300ms.

## Duration table

| Element | Duration |
|---|---|
| Button press feedback | 100-160ms |
| Tooltips, small popovers | 125-200ms |
| Dropdowns, selects | 150-250ms |
| Modals, drawers | 200-300ms (up to 500 for large sheets) |
| Marketing / explanatory / scroll-driven | can be longer, deliberate |

**UI animations stay under 300ms.** A fast spinner makes loading *feel* faster even at identical load time. `ease-out` at 200ms feels faster than `ease-in` at 200ms.

## Springs

Use ONLY for: drag with momentum, elements that should feel "alive", interruptible gestures, decorative mouse-tracking. NOT for menu fades.

Apple's two-parameter model (prefer this):
- **damping ratio** — overshoot. `1.0` = critically damped, no bounce. `<1.0` = bouncy.
- **response** — how fast it reaches target (seconds). Not "duration".

| Interaction | damping | response |
|---|---|---|
| Move/reposition | 1.0 | 0.4 |
| Rotation | 0.8 | 0.4 |
| Drawer/sheet | 0.8 | 0.3 |

Web (Motion/framer-motion): `{ type:"spring", bounce:0, duration:0.4 }` (critically damped) — add `bounce:0.2` ONLY when a flick/throw preceded it. Springs carry velocity through interruption; CSS/keyframes restart from zero.

### Presets and curve editors (when the user picks the motion)

From the DialKit fork on scaena.darkroom.engineering, the reference for a
motion tweak panel:

- **Name a preset by how it moves**, not by its numbers: "Snappy", "Gentle",
  "Bouncy" with one line each ("settles fast, no overshoot"). `0.25, 0.1, 0.25, 1`
  is the implementation, shown in fields under the curve.
- **Three models, one selector above the graph**: Easing (cubic-bezier),
  Time (spring by `bounce` + `duration`, Motion's `visualDuration` model) and
  Physics (`stiffness`/`damping`/`mass`). Time is the default a designer reads;
  Physics is for whoever is matching a native spec. The selector goes ABOVE the
  curve: the mode reinterprets the picture, so it is read first.
- **The curve is the control and the numbers are fields**: drag the handles, or
  type each of the 4 bezier values in its own field. One string with 4 numbers
  is not editable.
- **Copy/paste a curve between transitions** from the section's `⋯` menu. Motion
  consistency is reuse; a panel that makes each transition retype its curve
  breeds 12 almost-equal easings (the SSoT drift this skill exists to stop).
- **Defaults and Custom tabs**: the house tokens are the Defaults (`--ease-*`,
  `DUR.*`); a custom curve saved by the user lives in Custom and never edits a
  token in place.
- **Interface motion in the panel itself**: a segmented highlight slides with a
  shared `layoutId` (Motion), reset springs values back, a conditional control
  slides in. All of it is UI motion: under 250ms, and none under
  `prefers-reduced-motion`.

## Component rules

- **Buttons must feel pressed:** `transform: scale(0.97)` on `:active`, ~160ms ease-out. Put it on the shared Button primitive once.
- **Never `scale(0)`:** start `scale(0.95)` + opacity — nothing appears from nothing.
- **Origin-aware popovers:** scale from the trigger (`transform-origin` = trigger). Modals are the exception — keep centered.
- **Tooltips:** delay the first, then open adjacent ones instantly (skip delay + animation).
- **Transitions, not keyframes, for rapidly-triggered UI** (toasts, toggles) — transitions retarget smoothly.
- **`@starting-style`** (modern CSS) or the `data-mounted` pattern for entry animations without JS.
- **Stagger:** 30-80ms between items, capped total. Long stagger reads slow. Never block interaction on it.
- **Asymmetric timing:** slow where the user decides (hold-to-delete 2s), fast where the system responds (release 200ms).
- **Blur to mask imperfect crossfades:** `filter: blur(2px)` during the transition (keep < 20px, expensive in Safari).

## Waiting & pending states

The wait is a designed surface, not a fallback (SKILL §4). Numbers:

| Threshold | Meaning |
|---|---|
| ~100ms | perceived as instant — show nothing at all |
| ~300ms | loader **delay**: below this, never mount a loader (it flashes) |
| ~500ms | loader **minimum on-screen** once mounted (anti-blink) |
| ~1s | attention starts drifting — content must be arriving progressively |
| ~5s | needs narration: what step is running, what comes next |
| ~10s | needs an out: cancel, run in background, notify me |

```ts
// the anti-flicker pair, as one hook
const show = useDelayedFlag(isPending, { delay: 300, minVisible: 500 });
```

- **Shimmer:** `linear`, `infinite`, 1.2–1.6s, translating a gradient with `transform` (never `background-position` — that repaints). Legit `@keyframes`: nothing interrupts it. Amplitude low — a skeleton that pulses hard competes with the content it's standing in for.
- **Skeleton fidelity:** same box sizes, radii and gaps as the real row. Wrong-size skeletons cause a layout jump on arrival, which is worse than no skeleton. Don't skeleton text you can't size (variable-length titles → one fixed bar, not three).
- **Skeleton → content:** crossfade `DUR.base` + `y: 4→0` on the first block only. Never a hard swap, never a stagger long enough to out-live the fetch.
- **Determinate vs indeterminate:** a bar implies a known %. If the number is invented, use narration or streaming instead. Progress that stalls at 90% teaches users the UI lies.
- **Progress is `linear`** and should never animate backwards; clamp instead.
- **Streaming (AI, search, long lists):** partial content IS the loader. Fade in each chunk; do not hold everything behind one spinner. Never animate the caret/cursor faster than ~1s.
- **Optimistic first:** if the action is reversible, apply it immediately + undo toast (`sonner`) and there is no loading state to design.
- **5s+ is the delight budget.** Rare-frequency by the frequency rule → this is where brand illustration, a looping character, or a narrated sequence belongs. Loop must be seamless and calm at 25% speed; it will be watched longer than any other animation in the app.
- **Reduced motion:** shimmer → static tint; looping illustration → single static frame; progress readout and step labels stay (information, not decoration).
- **Empty state** = waiting on first data. Illustration + the one action that ends it. Whether it earns space is `visant-frontend`'s call.
- **Skeleton → error** is the forgotten branch, and the harshest: the skeleton spent seconds promising content. Swap in place, keep the box, retry inside it. No collapse, no bounce, no red flash — an error is information, not a jump scare. Same crossfade as the success path, so failing costs the user no extra motion.

## Route & view transitions

Full patterns + CSS: the official `vercel-react-view-transitions` skill (`npx skills add https://github.com/vercel-labs/agent-skills --skill vercel-react-view-transitions`). What matters here is the numbers and the traps.

| Layer | Duration | Curve |
|---|---|---|
| `::view-transition-old` (exit) | 150ms | `ease-in` is legitimate **here only** |
| `::view-transition-new` (enter) | 210ms, delayed by the exit | `ease-out` |
| positional slide / morph | 400ms | `ease-in-out` |

- Directional offset ~60px. Enough to say "forward"; more turns into an object the eye has to track.
- Blur 3px mid-morph masks pixel interpolation on a shared element — cheap, and it hides what would otherwise read as a smear.
- Activated by Transitions, `<Suspense>`, `useDeferredValue` — **not** by plain `setState`. In Next's App Router every route navigation is a Transition, so it fires automatically.
- The morph only pairs if the destination renders in the same commit (i.e. prefetched). If it suspends to a fallback first, no pair forms and the content plays its enter animation instead. That's correct behavior, not a bug — but it means the morph is a *prefetch-dependent* effect, so don't hang comprehension on it.
- Named participants skip hit-testing while the transition runs, so never name something the user clicks in rapid succession.
- Requires transition types + `view-transition-class` (Chromium 125+, recent Safari/Firefox). Without support the app works, it just doesn't animate — so treat it as enhancement, never as the only signal that something happened.

## Scroll-driven animation

- Native: `animation-timeline: scroll()` for progress-through-scroller, `view()` for element-in-viewport, scoped with `animation-range`. Runs off the main thread — it cannot jank the way a JS scroll handler can.
- Always gate: `@supports (animation-timeline: view()) { … }`. Keep any JS path as fallback, never as the default.
- These are not interactive UI. Long and deliberate is fine; the <300ms ceiling does not apply.

## Apple fluid principles (gesture/drag work)

- **Respond on pointer-down, not release.** Feedback continuous DURING the interaction, not only at the end.
- **1:1 tracking** with `setPointerCapture`, respect the grab offset.
- **Interruptibility is #1:** animate from the *presentation* (live) value; never lock input during a transition; blend velocity on reversal (no "brick wall").
- **Momentum projection:** project the resting point from release velocity (`current + (v/1000)·d/(1−d)`, d≈0.998), then snap to the nearest target — makes a flick feel thrown.
- **Rubber-band** at boundaries (progressive resistance), don't hard-stop.
- **Decompose 2D into independent X/Y springs.**
- **Translucent chrome** (`backdrop-filter`) for depth; content scrolls under.

## Performance

- Animate ONLY `transform` and `opacity` (GPU; skip layout+paint). Never `width/height/margin/padding`.
- framer-motion shorthand `x`/`y`/`scale` are NOT hardware-accelerated (rAF on main thread) — under load use the full `transform: "translateX(…)"` string, or CSS animations (off main thread).
- Update `transform` directly on the element, not a CSS var on the parent (var change recalcs all children).

## Accessibility

- `prefers-reduced-motion: reduce` → gentler, not zero. Keep opacity/color; drop movement/spring/parallax.
- `prefers-reduced-transparency: reduce` → frostier/solid surfaces, drop blur.
- Gate hover animations behind `@media (hover: hover) and (pointer: fine)` (touch fires false hovers on tap).

## Audit — 9 categories

1. Purpose & frequency · 2. Easing & duration · 3. Physicality & origin · 4. Interruptibility · 5. Performance · 6. Accessibility · 7. Cohesion & tokens · 8. Missed opportunities · 9. Waiting states · 10. Navigation & passage.

Categories 1-8 are largely mechanical — run `scripts/motion-lint.mjs --json` and start from its output instead of grepping by hand. 9 and 10 are the ones no scanner sees: audit 9 by listing every `isLoading`/`isPending`/`useSWR`/`Suspense`/`empty` branch and asking what the user looks at during each; audit 10 by asking whether the passage makes a *true* claim (a slide that says "forward" on a sideways move is worse than no animation).

Then measure the deployed URL with `scripts/measure-motion.mjs` — dropped frames and reduced-motion leaks are findings too, and they're the only ones a user can actually feel.

### Severity

**HIGH (feel-breaking):**
- `ease-in` on a UI enter/exit
- `scale(0)` entrance
- animation on a keyboard/high-frequency action (100+/day: ⌘K, shortcuts, list nav)
- UI-interactive animation > 300ms
- framer-motion `x`/`y` shorthand dropping frames under load
- dropped frames / jank
- loader with no delay/min-visible guard on a fast endpoint (visible blink)
- fake determinate progress (invented %)

**MEDIUM:**
- `transition-all` that animates layout/size/transform (color-only = LOW)
- wrong/weak easing (Material/default) on a prominent interaction
- wrong `transform-origin` (popover from center)
- non-interruptible `@keyframes` on rapidly-triggered UI
- missing reduced-motion handling
- missing press feedback on a primary custom CTA
- hardcoded cubic-bezier/duration that should reference the SSoT
- bare spinner where the layout is known (skeleton fits)
- skeleton whose boxes don't match the real row → layout jump on arrival
- several waiting animations on one surface at once
- reversible action that spins instead of applying optimistically
- view-transition pseudo-elements not zeroed under `prefers-reduced-motion` (the global `*` guard does not reach them)
- named `ViewTransition` without `default="none"` → it animates on every unrelated transition
- enter/exit wrapper placed in `layout.tsx`, where it can never fire

**LOW:** color-only `transition-all`, token consolidation, stagger polish, blur-masked crossfades, 5s+ wait or empty state with no illustration/narration (delight budget left on the table).

### Fix table

| Issue | Fix |
|---|---|
| `transition: all` / `transition-all` | specify props: `transition-transform`, `transition-colors`, `transition-[…,box-shadow,opacity]` |
| `scale(0)` entry | `scale(0.95)` + `opacity:0` |
| `ease-in` on UI | `EASE_OUT` (or custom strong curve) |
| `transform-origin: center` on popover | trigger origin / Radix `--radix-*-content-transform-origin` (modals exempt) |
| animation on keyboard action | remove it |
| duration > 300ms on UI | reduce to 150-250 (`DUR.base`/`DUR.fast`) |
| hover anim without media query | add `@media (hover:hover) and (pointer:fine)` |
| keyframes on rapid element | CSS transition (interruptible) |
| framer `x`/`y` under load | full `transform` string |
| same enter/exit speed | exit faster than enter |
| all appear at once | stagger 30-80ms, capped |
| hardcoded curve/duration | import from the repo motion SSoT (e.g. `lib/motion.ts`) / `var(--ease-*)` / `var(--dur-*)` |
| spinner on a known layout | skeleton matching the real boxes + crossfade |
| loader flashes / blinks | 300ms delay + 500ms minimum visible |
| skeleton shifts layout on load | match sizes, radii and gaps to the real row |
| invented `%` progress bar | narrated steps, or stream partials |
| spinner on a reversible action | optimistic patch + undo toast |
| 5s+ wait with a static spinner | narration + illustration/loop (rare-frequency = delight budget) |
| shimmer via `background-position` | translate a gradient with `transform`, `linear`, 1.2–1.6s |

Report findings by leverage (impact ÷ effort). Fix shared/core primitives first — they propagate to every route. "The motion here is already right" is a valid result. Long, deliberate marketing/scroll/3D animations are audited-and-kept, not defects.
