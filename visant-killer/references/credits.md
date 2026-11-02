# Credits and lineage

This skill is the door; judgment comes from the house skills it loads:
`visant-frontend` (cut test, surfaces), `visant-motion` (`motion-lint`),
`visant-refine` (`refine-scan`) and `visant-copy` (`copy-lint`). From outside:

| What | By | How it enters here |
|---|---|---|
| [`impeccable`](https://impeccable.style) | Paul Bakaus ([pbakaus/impeccable](https://github.com/pbakaus/impeccable), Apache-2.0) | gate 1 of `killer-scan` (`npx impeccable detect`) |
| [`revenue-centric-design`](https://github.com/heliocosta-dev/revenue-centric-design) | principles by Richard ([@richardrx](https://x.com/richardrx)), packaged by heliocosta-dev | ammunition for Step 4; the "RCD n" citations in `devils-advocate` |
| [Emil Kowalski skills](https://github.com/emilkowalski/skills) (`emil-design-eng`, `apple-design`, `improve-animations`, `review-animations`) | Emil Kowalski, from [animations.dev](https://animations.dev) and Apple's *Designing Fluid Interfaces* (WWDC 2018) | via `visant-motion`: the origin of the motion principles |
| `vercel-react-view-transitions` | Vercel ([vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills)) | via `visant-motion`: route transitions |
| `dataviz` | Anthropic (Claude skill) | via `visant-frontend`: chart correctness |
| [shadcn/ui](https://ui.shadcn.com) and [Radix](https://www.radix-ui.com) | shadcn; WorkOS | official primitive instead of an invented component |
| [Playwright](https://playwright.dev) | Microsoft | `corta-scan` and `verify-screens` open the real screen |

A new skill this one starts using or distilling enters this table in the same
commit.

The isolated reviewer, the `## Not checked` section and the stop rule are distilled from [Stageshow](https://github.com/benjitaylor/skills/tree/main/stageshow) (Benji Taylor, MIT).
