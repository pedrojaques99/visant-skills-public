# Brand idiom: where the life comes from

Cleaning removes the tells. Done alone, it also pulls every product toward the same neutral kit, and the owner says "it lost its soul". The fix is not decoration back. Spend craft where it pays, and build that craft from the brand's own assets, so two products cleaned by the same skill stop looking alike.

Branding is core: this runs before anything is cut or built.

## 1. Extract the idiom (3 to 5 assets)

Before touching a screen, write down the assets that only this product has. Put them in the project (`docs/brand-idiom.md` or the design-system page) so every later screen draws from the same list.

- **Shape.** The logo's geometry: its curves, its angle, its flat round forms. It works at scale as a field, a mask or a cut.
- **Color as a field.** The brand color as a surface to stand on, not just an accent dot.
- **Character.** A mascot, a mark or a face, if one exists. It can be alive: an eye that follows the pointer, a blink, a reaction when something is done.
- **The subject's own units.** What the product is about, drawn: rings of presence for agents, notes for music, plots for maps.
- **Display type.** The family the brand already speaks in.

Sources, cheapest first: the brand guideline (the Visant MCP `brand-guidelines-get`, when connected), the logo files and the marketing site, then the app itself. If the brand has none of these yet, say so. That gap is the owner's decision, not something the agent invents.

## 2. Decide where to spend (the craft column)

Classify each route and each core component in the surface table ([visant-frontend Step 0](../../visant-frontend/SKILL.md)), adding craft and brand moment:

| Craft | When | Gets | Stays quiet |
|---|---|---|---|
| **shine** | seen the first time, where the person decides to stay, or what they came to make | one brand moment from the idiom, the object on the largest surface, orchestrated motion | everything that does not serve the moment |
| **alive** | lists, tables, settings, logs | density, drawn facts, a live signal (state, real logo, ring) | ornament |
| **sober** | money, permission, approval, deletion | clarity; personality only in the tone | the rest |

Both extremes are defects: decoration on a work screen, and a shine screen stripped bare.

## 3. Rules for a shine region

- **Name the moment before you cut.** Write one line: what makes the eye shine here? Anything removed from a shine region is replaced in the same change, never with nothing.
- **The illustration explains the feature.** Pure brand art beside a title is decoration. Draw the sentence the title says: the team perched on the mascot, a status walking through their work until "approved". Each one makes the other easier to read.
- **The object being made is the protagonist.** Canvas + deck: the object large, on its own color, standing still; the controls in a deck beside it that changes per step. A small preview card in a corner inverts the hierarchy.
- **Textures come from the subject.** Hairline rings from an avatar, the product's own geometry. Dot grids, noise and mesh are every AI canvas (catalog 32).
- **One moment per screen, then a thread.** Later steps carry a quieter echo: the mascot's eye alive at 52px, a smile when the thing is born. Under `prefers-reduced-motion` the moment still reads standing still.

## 4. Core components get the biggest budget

A component is core when it appears on three or more screens, or it is the object the product is about (the agent's avatar, the approval card, the harness logo). Polishing it once reaches every screen, so it gets:

- **Every state:** rest, hover, focus, active, selected, loading, empty, done, error.
- **Hover that previews the outcome:** what the click will open, change or send. It can also reveal the secondary action in reserved space, and on a core piece react in the idiom. A hover that only darkens the background is the floor, not the target.
- **Hairline strokes:** 1px chrome, selection by color (`stroke-scan`).
- **One source:** a shared module, imported everywhere. Brand marks come from the official asset, never redrawn per screen.

## 5. Thumbs, when the item is something the product does

Missions, templates, presets and goals get a small drawing in the idiom, each showing the work it stands for. A preset can wear its trade, like a magnifier on the researcher. A row of data (log, transaction, setting) does not.

Brand art is not an icon. UI icons come from the library (killer prohibition). Illustrations, marks and thumbs are drawn as SVG in one module (`*Art`, `*Mark`) and stay in the brand's palette.

## 6. The swap test

Swap the logo in your head for a competitor's. If the screen could still be theirs, the idiom is missing and the cleanup only removed things. Put the answer in the report.

## 7. Decide it with the owner, once, with previews

Design and brand calls are the owner's. One checkpoint, after the table and the idiom and before building, settles them:

- Show 2 to 3 directions for the shine regions and the core components, **your recommendation first**.
- Use the cheapest preview that decides: ASCII or a wireframe for structure (where the object sits, what is hidden); a real frame or screenshot when the decision is visual (color field, illustration, the moment itself).
- After the pick, work to the end. Before install, push or "done", show the before and after side by side.

Ask only what the code and the idiom cannot answer. A question the brand guideline already answers wastes the owner's time.
