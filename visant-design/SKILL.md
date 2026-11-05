---
name: visant-design
description: 'End-to-end UI/UX: removes AI slop, redesigns screens around what they must achieve, and verifies on the real screen. Use on "clean the AI slop", "improve the UI", "improve the UX", "redesign this screen", "limpa o slop", "melhora o design", "melhora a ui", "ui ux end-to-end", "tá com cara de IA", any UI or UX polish, /visant-design.'
metadata:
  family: design
  routes: visant-killer visant-frontend visant-motion visant-refine
---

# Visant Design

Takes "clean the slop" or "improve the UX" to a finished screen you have looked at. Rulebooks can't see your product or your result; this process makes you see both.

`<skill-dir>` is the folder holding this file. Other playbooks are next to it: read `../<name>/SKILL.md`. If one is missing: `npx skills add pedrojaques99/visant-skills-public --skill <name>`.

**Work to the end without stopping to ask.** Ask only what the code cannot answer and would change what gets built. Follow the product's own design system and components; only create a new one if nothing exists.

Pick one track:

| The ask | Track |
|---|---|
| "Clean the slop", "looks AI-made", remove the tells | [Clean](#clean) |
| "Improve", "redesign", "UI/UX end-to-end", "this looks bad" | [End to end](#end-to-end) |
| Several screens with no pattern between them | [Many screens](#many-screens) |
| "Audit", "review", "is this good" | [visant-killer](../visant-killer/SKILL.md): change nothing until the user answers its closing question |
| One detail: motion, chart, panel, component demo | [Single topic](#single-topic) |

## Clean

Keep the design. Remove the tells.

1. `node <skill-dir>/scripts/check.mjs <ui paths> --url <running app>`
2. Fix every finding at its cause. Hiding what a finding points at does not count.
3. Read the images. Fix the tells no detector sees: decorative gradients, purple as "AI", glow, emoji as icons, a card nested in a card (the nesting is the tell; a card alone is not), eyebrow labels over every heading, hype words, invented numbers.
4. Run it again until it is clean. Report what you removed.
5. Compare before and after side by side and show the owner before shipping. The score is not the verdict: it improves with every box you delete, and a screen stripped of its cards scored zero while its owner called it "too clean". `node ../visant-killer/scripts/regressao.mjs git HEAD <ui paths>` flags lost boxes, controls, chips and width.

## End to end

1. **See it first.** Start the app and run `check.mjs` as above. Read the screenshots before reading the code. If the app cannot start, say so and fix that first.
2. **Name the job.** Write one line per screen: who arrives, what they came to do, which number moves. Read the file for that surface:
   - Landing, pricing, signup, onboarding: [acquisition](../visant-frontend/references/acquisition-surface.md)
   - Queue, table, editor, admin: [work](../visant-frontend/references/work-surface.md)
   - Payment, permission, deletion, money: [trust](../visant-frontend/references/trust-surface.md)
3. **Diagnose from the image.** Run [foundations.md](references/foundations.md) on the screenshot, in order. List what is wrong, biggest first.
4. **Cut before adding.** For each element ask which decision it helps. No answer, it goes. Most screens get better by losing things, but a main number keeps its emphasis (box, scale, rule: whatever the brand's system uses), a state keeps a visible signal, an action keeps its target. Too much text becomes a drawn fact (bar, chip, icon with a tooltip), never a pile of badges.
5. **Build.** The product's tokens and components first. Motion and data get their playbook only if this screen needs them. Write copy from what the product really does; a number you don't have stays a visible placeholder.
6. **Look at the result.** Run `check.mjs` again and read the new screenshots at every width, next to the old ones, and show the owner the pair: the score is not the verdict. Ask the most exacting designer's question: what would I screenshot and send back? Fix the biggest thing and repeat, up to three rounds.
7. **Report.** What changed and which number each change is meant to move; what you cut and why; the widths you looked at; what you did not check. A redesign is a hypothesis: say how to measure it.

If `check.mjs` says NOT VERIFIED, the first line of your answer says so. The work is not done. Stop any server you started. `check.mjs` runs in Chromium: a custom touch gesture that never ran on a real iPhone goes under what you did not check.

## Many screens

Each screen looks right alone, so fixing them one at a time hardens the disagreement. Write the pattern first.

1. **See them together.** Run `check.mjs` and put the sister screens' screenshots side by side. List what each one does differently: the same control in another place, another name, another empty state.
2. **Write the pattern.** A short list in the repo: which control does each job, where it lives, what it is called. If a choice is really the owner's, ask once.
3. **Change the shared piece, not each screen.** Fix or extract the one component and have the screens import it. A shared piece reaches every screen using it, so list them first and look at all of them after.
4. **Then each screen,** from step 3 of [End to end](#end-to-end). Report the pattern with the work.

## Single topic

| The ask | Read |
|---|---|
| Animation, transition, loading, skeleton | [visant-motion](../visant-motion/SKILL.md) |
| Chart, gauge, slider, metric tile, control panel | [visant-refine](../visant-refine/SKILL.md) |
| Hierarchy or what to remove on one screen | [visant-frontend](../visant-frontend/SKILL.md) |
| Too cluttered, too many labels | [declutter](../visant-killer/references/declutter.md) |
| Component demo, library page, mock product | [component-showcase](../visant-frontend/references/component-showcase.md) |
| Fake product UI for a hero, cursor demo | `stageshow`, third party: `npx skills add benjitaylor/skills --skill stageshow` |

Before writing a component, check the repo's primitives, then [@visant/ui](https://ui.visantlabs.com/llms.txt).

## Neighbors

- **Feedback**: when the work is delivered, ask once per session, in one line, what helped and what was missing; it goes to https://ui.visantlabs.com/skills#feedback
- **[[visant-killer]]**: audit what exists
- **[[visant-frontend]]**: decide what should exist
- **[[visant-motion]]**: how it moves
- **[[visant-refine]]**: data and controls
- **[[stageshow]]**: a fake product UI for a hero or feature card
- **[[visant-copy]]**: the words on the screen
- **[[visant-preflight]]**: a large client project, before any screen
