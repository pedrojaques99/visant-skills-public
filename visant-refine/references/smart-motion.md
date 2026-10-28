# Smart animation

Smart means chosen by **the variable it drives**. The easing and duration SSoT
is `visant-motion` (in the target repo, wherever the SKILL.md discovery points:
a `lib/motion.ts`, `--ease-*` and `--dur-*` tokens); this file only holds the
decision of **what** to animate in a data element.

The rule that generates the others: **animate what carries the decision, at the
moment the decision changes.** Everything else is decoration with an attention
cost, and attention spent on decoration is attention that did not go to the
number.

## Decision table

| Situation | Animate? | How |
|---|---|---|
| value the user produces by hand (dragging a slider) | **no** | follows the finger. Animating is latency that looks nice |
| total recalculated after the user released | yes, once | short count up to the new number, `DUR.base`, `EASE_OUT` |
| crossing a limit or changing band | yes | the band's state change **is** the animation; no glow, no pulse on the card |
| chart entrance on first mount | yes, short | `dataviz` calls it reveal: 200 to 300ms, once, never on every re-render |
| entrance of a value the user already read on the previous screen | **no** | animating again says "this changed" when nothing did |
| skeleton becoming a value | no | it is a content swap. No cross-fade, no scale |
| new row in a list the user just created | yes | it is the confirmation of the action |
| ratio bar changing value | yes | `transform` only, and the primitive already transitions |
| number ticking every second | **no** | and the value lives in its own context, or the page re-renders every second |
| hover on a chart point or bar | yes | color and opacity only, `ease`, 100 to 150ms |

## Number counting, when it goes in

Counting up to a number is the most requested animation and the easiest to get
wrong. It is only justified when the number **changed as a consequence of a user
action** and the change is the information. Never on initial load, never on a
ticking number, never on more than one number at a time on the same screen (two
simultaneous counters become a casino).

Short duration, `DUR.base` at most, `EASE_OUT`, `tabular-nums` mandatory or the
width jumps every frame. With `prefers-reduced-motion`, the number appears at the
final value: kill the animation, never the result.

## Never

- `transition-all`, `ease-in` in UI, `animate-bounce`, `scale(0)`.
- Animating `width`, `height`, `margin` or `padding`. Only `transform` and
  `opacity`.
- `@keyframes` for interruptible state: it restarts from zero mid-gesture.
- Stagger on numbers. Cascades are for lists, and short.
- Exit animation running behind an open modal: close the surface first, the
  closing **is** the weighted exit.

## Link to revenue-centric

The attention hierarchy decides what is salient, and motion is the most salient
channel on a still screen: it beats color and size. So motion follows the same
rule as red, only stricter: if everything moves, nothing is an event, and the
user learns to ignore the one movement that mattered.

Before animating, the question is the *cut test* with one word swapped: **which
business variable does this motion move?** Directing the eye to the deciding
number moves decision quality. Celebrating a completed action moves retention.
Decorating a card's entrance moves nothing, and still spends the channel.
