# Foundations

The fundamentals, as tests you run on a screenshot. A principle you cannot test on this screen does not apply to it. Never cite a law as decoration: name it only when it changes what gets built.

Run them in this order. A wrong answer high up makes everything below it wasted work.

## 1. The job

Before any pixel, write one line: **who arrives, what they came to do, which number moves if it works.**

| The screen is | It serves | The number |
|---|---|---|
| Acquisition (landing, pricing, signup, onboarding) | someone deciding | conversion, activation |
| Work (queue, table, editor, admin) | someone repeating a task | tasks per hour, errors |
| Trust (payment, permission, deletion, health, money) | someone who fears a mistake | completion, support tickets |

The surface decides the rules. Density that serves a work screen kills a landing. Persuasion that serves a landing insults a work screen.

## 2. Attention

- **Squint test.** Blur the screenshot. What you still see first must be what the job needs first. If it is the logo or a decoration, the hierarchy is wrong.
- **One primary action per view.** Two filled buttons of the same color mean none is primary.
- **Hierarchy uses size, weight, color and position.** Use the fewest that work. Start by quieting everything else before making the important thing louder.
- **Isolation draws the eye** (Von Restorff effect). It works once per view. A highlight on everything is a highlight on nothing.
- **First and last positions are remembered best** (serial position effect). Put the key actions of a nav at the ends, not the middle.

## 3. Grouping

Gestalt is why a screen with every token right can still read wrong.

- **Proximity.** A group reads tighter than the layout around it, so hierarchy and order show without a line. Inside a group, at most half the gap between groups; in a dense list, a third (8 inside an item, 24 between items). A label is closer to its value than to the next group. Measure the rendered gaps, the eye misses a few pixels (`ritmo-scan` in visant-killer does it). Spacing rules elsewhere link here.
- **Similarity.** Things that look the same must behave the same. A blue word that is not a link is a lie.
- **Common region.** Before adding a box, try space alone. A card inside a card is almost always one box too many. That forbids nesting, not cards: main data on an operation screen keeps its box.
- **Alignment.** Every element shares an edge with something. Count the distinct left edges: fewer is calmer.

## 4. Type

- One family, sometimes two. Hierarchy comes from size and weight, and two or three weights are enough.
- A scale with real jumps (for example 12, 14, 16, 20, 24, 32). Sizes 1px apart read as a mistake.
- Reading text: about 45 to 75 characters per line (Bringhurst) and line height near 1.5. Large headings go tighter, near 1.1 to 1.2.
- Numbers that get compared in columns: tabular figures, aligned right.
- Sentence case. Long strings in tracked capitals read slower and look templated.

## 5. Color

- Neutrals plus one accent. The accent means "act here" and nothing else.
- Status colors mean status. Never decoration.
- Color is never the only signal (WCAG 1.4.1). Add a word or an icon.
- Contrast: text at least 4.5:1, large text 3:1, controls and meaningful graphics 3:1 (WCAG 2.2, 1.4.3 and 1.4.11). Measure it. Quiet gray on white fails more often than it looks.
- Dark mode is its own palette. On dark, depth comes from lighter surfaces, not shadow.

## 6. Layout

- Spacing from a scale, usually multiples of 4 or 8. What matters is that gaps say what belongs together.
- Content sets the width. A form stretched to 1400px is not responsive, it is unread.
- The phone is its own layout. At 320 CSS px the content reflows without horizontal scroll (WCAG 1.4.10).
- Targets: 24 px is the accessibility floor (WCAG 2.5.8). For touch use Apple's 44 pt or Material's 48 dp.
- Pixels above the first real content are a budget. Count them on a work screen.

## 7. Cognitive load

- **Fewer equal choices decide faster** (Hick's law). Group them, set a default, hide the rare ones. It says nothing against long lists people scan for a known item.
- **"7 plus or minus 2" is not a limit on menu items.** Miller wrote about short-term memory. Don't use it to justify a design.
- **Recognition over recall** (Nielsen). Show the options and the state. Don't make people remember them from another screen.
- **Familiar beats clever** (Jakob's law). People spend most of their time on other products. A reinvented date picker costs attention you needed elsewhere.
- **Progressive disclosure.** Show what most people need now, and put the rest one step away.
- **Count the concepts in view, not only the controls.** On a work surface, every open section, tab, chip and floating group competes for the same glance. Each one can be right alone and the sum still too much. When the count grows, group by intent or move the group to the task it belongs to. On a panel, the selection decides what is in view: [control panels](../../visant-refine/references/control-panels.md#the-selection-decides-the-panel). Across a work surface, one rail tab per task: [mode rail](../../visant-frontend/references/work-surface.md#mode-rail-one-tab-per-task).
- **The default is a decision.** Most people keep it. Choose it for them.

## 8. Interaction

- **Near and big gets hit faster** (Fitts's law). The frequent action is large and close to where the pointer or thumb already is. A dangerous one is not next to it.
- **Response time** (Nielsen): under 0.1s feels instant, under 1s keeps the flow, past 10s attention is gone. Show progress for anything over about 1s.
- **Every state exists:** empty, loading, error, partial, success. An error says what happened and how to fix it, in place, keeping what was typed. Zero and empty: [§12](#12-states).
- **Undo beats confirmation** when the action can be reversed. Save the dialog for what cannot.
- **Keyboard.** Everything reachable. What only appears on hover does not exist on touch.
- **Focus** shows on `:focus-visible` only, never on a mouse click. 2px with a 2px offset (or an equivalent inset ring), at least 3:1 against what is next to it. That meets WCAG 2.4.7 and the 2.4.13 area guidance without a 3px ring.
- **Selection** is never said by color alone: color and a second cue (a check, a weight, a shape).
- **Hover reveals, never relayouts.** Reserve the space and float the revealed control over it. Nothing is reachable only on hover: `focus-visible` and a touch path reach it too.

## 9. Forms

Forms are where intent is lost.

- Ask less. For each field: what breaks if it is gone?
- One column. Labels above the field and always visible. A placeholder is not a label.
- Validate when the person leaves the field, not on each keystroke. The error sits next to the field.
- Use the right `type`, `inputmode` and `autocomplete`: it saves work on a phone.
- Say why you ask for anything sensitive, right where you ask.

## 10. Conversion

Clarity first. Most landings that don't convert were not understood.

- **Five-second test.** What is it, who is it for, what do I do next? A stranger must be able to answer from the first screen.
- **Say the outcome in the customer's words,** then how. Adjectives (fast, smart, seamless) prove nothing.
- **Message match.** The promise that brought them, the page, the signup and the product say one thing.
- **Proof the size of the promise,** placed next to the ask: a specific number, a named customer, a screenshot of the real product.
- **Reduce the risk at the point of decision:** what is free, how to cancel, what happens next.
- **Pricing.** Name who each plan is for. Show what changes between tiers, not the same list three times. Mark one plan as the default.
- **Never lie.** A "free" button in front of paid plans, fake scarcity and invented numbers win a click and lose the customer. If you lack a real number, ask for it or leave a visible placeholder; never invent one.
- **It is a hypothesis.** Say what you expect to move and how to measure it. Nobody can promise a lift from a redesign.

## 11. Audit checklist

Nielsen's 10 usability heuristics. Answer from the screen:

1. Can I tell what is going on?
2. Does it speak my language, not the system's?
3. Can I back out or undo?
4. Is it consistent, inside and with what I know?
5. Does it prevent the error before reporting it?
6. Can I see my options, or must I remember them?
7. Is there a shortcut for someone who does this all day?
8. Is everything here necessary?
9. Does an error say what to do?
10. If I need help, is it where I am?

## 12. States

The one home for zero, repeated badges and the empty state. Other files link here.

- **Zero.** A zero from a failed or unfed source does not render: show the error, or nothing. A measured zero stays on health and trust surfaces, where "0 failed jobs" is the answer. A breakdown that reads zero is noise until it moves. A total may stay when it is the subject of the page.
- **A badge on 100% of rows distinguishes nothing.** Render it once rows differ, and say it once where the whole list is in view. When it leaves, the row leaves that slot empty: a row whose caption falls back (status, then role, then presence) must not hand the slot to the next fallback, or the cut caption comes back as a longer, cut one or as a word the group heading already says. Look at the row after the change, not only at the caption you removed.
- **Empty.** The empty state is an invitation: the product's object, one line of what will appear, one action that starts filling it. Zeros stay hidden until a first item. The absence of a field on a record can itself be the signal: draw the gap as a deliberate state, not a hole. An empty shared space is a content problem, so seed it.

## Sources

Nielsen Norman Group, [10 usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) and [response times](https://www.nngroup.com/articles/response-times-3-important-limits/). W3C, [WCAG 2.2](https://www.w3.org/TR/WCAG22/). Jon Yablonski, [Laws of UX](https://lawsofux.com). Robert Bringhurst, *The Elements of Typographic Style*. Going deeper: Vercel's [Web Interface Guidelines](https://vercel.com/design/guidelines), [revenue-centric-design](https://github.com/heliocosta-dev/revenue-centric-design), [Impeccable](https://impeccable.style).
