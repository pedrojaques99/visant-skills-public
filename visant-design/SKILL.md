---
name: visant-design
description: 'One door for UI, UX and interface work: audit a screen, decide hierarchy, motion, charts and panels, component demos. Routes to the right Visant playbook. Use on "ui", "ux", "interface", "redesign this screen", "looks AI-made", "make it smoother", "add a chart", "tá com cara de IA", "redesenhar tela", "deixa mais suave", /visant-design.'
metadata:
  family: design
  routes: [visant-killer, visant-frontend, visant-motion, visant-refine]
---

# Visant Design

This file holds no design rules. Pick the route, load that playbook, follow it. Load only what the ask needs: each playbook costs context.

## Routes

| The ask | Load | It ends with |
|---|---|---|
| Audit, "looks AI-made", "is this good", before a PR | [visant-killer](../visant-killer/SKILL.md) | gate result, score |
| Only "too much", "cluttered", "too many labels" | [declutter](../visant-killer/references/declutter.md) | what was cut |
| New or redesigned screen, hierarchy, empty state, what to remove | [visant-frontend](../visant-frontend/SKILL.md) | route classification table |
| Animation, transition, hover feel, loading, skeleton, sound | [visant-motion](../visant-motion/SKILL.md) | `motion-lint` clean |
| Chart, gauge, sparkline, slider, metric tile, control panel | [visant-refine](../visant-refine/SKILL.md) | `refine-scan` clean |
| Component demo, showcase, library page, mock product kit | [component-showcase](../visant-frontend/references/component-showcase.md) | one piece, large, in its best state |
| Fake product UI for a hero or feature card, cursor demo | `stageshow`, third party; map its kit to the project's tokens and components | filmed loop, `REHEARSAL.md` |

Load with the Skill tool, or read the linked file. If a playbook is missing, install it: `npx skills add pedrojaques99/visant-skills-public --skill <name>`.

## Several at once

Building a whole screen, the order is fixed: **frontend** decides what exists, **refine** and **motion** shape the parts that need them, **killer** judges the result before the PR. Never start with the audit on something not built yet.

## Before you say done

Compiling is not seeing. If you changed the interface, this is part of the task, whichever route you took:

1. Start the app and measure the real screen at phone and desktop width. It finds horizontal overflow, cut text and stacked overlays:
   `node ${CLAUDE_SKILL_DIR}/../visant-killer/scripts/corta-url.mjs <local-url> home --widths 390,1280`
   If Playwright is missing: `npx playwright install chromium`, then run it again.
2. Fix what it finds, and measure again. Overflow at 390 is a defect, not a detail.
3. React: `node ${CLAUDE_SKILL_DIR}/../visant-killer/scripts/killer-scan.mjs <changed files>`. Fix its findings.
4. Say which widths you measured. If you could not open it, the first line of your answer is "not opened", and the work is not done.

## Before writing a piece

Check whether it already exists: the repo's own primitives first, then [@visant/ui](https://ui.visantlabs.com/llms.txt).

## Neighbors

- **[[visant-killer]]**: audit what exists
- **[[visant-frontend]]**: decide what should exist
- **[[visant-motion]]**: how it moves
- **[[visant-refine]]**: data and controls
- **[[stageshow]]**: a fake product UI for a hero or feature card (third party: `npx skills add benjitaylor/skills --skill stageshow`)
- **[[visant-copy]]**: the words on the screen
- **[[visant-preflight]]**: a large client project, before any screen
