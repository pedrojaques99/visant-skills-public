# Distribution: does the page exist outside itself?

There was a strict bar for pixels, motion and finish, and nothing for metadata,
share cards, conversion events, sitemap and robots. In a real session that was
the P0 that separated "pretty landing" from "findable", and whoever got there
got there **outside** the skills.

The asymmetry is the whole argument. A token mistake costs one pixel. A missing
`og:image` costs the click-through rate of **every shared link**, and it never
shows up on any screen you open, in any linter you run, in any screenshot you
take.

## The gate

```bash
node ~/.claude/skills/visant-killer/scripts/dist-scan.mjs <app-root>
node ~/.claude/skills/visant-killer/scripts/dist-scan.mjs --self-test
```

Exit 1 on any HIGH. Always runs on acquisition surfaces (A); on B and C only the
identity block (`title`, `lang`, favicon), because a screen behind login is not
indexed and demanding SEO from it is noise.

## What each finding costs

| Rule | Level | What you lose |
|---|---|---|
| `sem-metadata` | HIGH | search and sharing read the file name |
| `title-placeholder` | HIGH | "Create Next App" has shipped more than once |
| `sem-og-image` | HIGH | shared link without a card: half the clicks |
| `og-relativo-sem-metadataBase` | HIGH | the card URL points to `localhost` in production. The build only warns |
| `sem-description` | HIGH | the search snippet becomes whatever first paragraph Google finds |
| `conversao-nao-medida` | HIGH | the screen converts and nobody knows how much |
| `rota-sem-titulo-proprio` | MEDIUM | public routes with the same `title` compete with each other |
| `sem-sitemap` / `sem-robots` | MEDIUM | discovery depends only on external links |
| `sem-lang` | MEDIUM | screen readers and translators get the language wrong |
| `sem-favicon` | LOW | no brand on the tab or the bookmark |

## What the detector does NOT catch, and you have to see

1. **The rendered card.** `og:image` existing is not `og:image` looking good.
   Open `https://www.opengraph.xyz` or paste the link into a WhatsApp draft.
   Cropped text and a squashed logo pass any script.
2. **The title read out loud.** 60 chars is Google's cut. `description` between
   120 and 160. Outside that it truncates with an ellipsis mid-sentence.
3. **The event in the tool.** The detector sees the *call*; only the dashboard
   proves the event **arrives**. Fire it once for real and check.
4. **What the event names.** `click_button` answers nothing. `lead_sent`,
   `checkout_started`, `plan_chosen` do: the event name is the business
   question you will be able to ask a month from now.

## The right order

Distribution comes **before** polish, not after. It is the inversion the real
session got right too late: spending an afternoon on color tokens for a page
that shares without a card is optimizing the inside of a house with no door.

In practice, for an acquisition surface:

1. `dist-scan` clean of HIGH
2. card seen rendered, title and description read
3. one event fired for real and checked in the dashboard
4. **only then** `killer-scan`, `motion-lint` and the rest
