# Acquisition surfaces

Client sites, landing pages, pricing, onboarding, upgrade prompts. Revenue
variable: **conversion rate**.

Here persuasion is the job. Directing attention is not manipulation — an
interface that refuses to direct converts worse (RCD 1: *neutrality is
omission*).

**Load the `revenue-centric-design` skill for the mechanics** — awareness levels,
decoy effect, anchoring, GBB pricing, social proof placement, trial design,
empty-state activation. Cite the named lever. This file covers only what is
Visant-specific and what RCD does not carry.

- [The four-layer alignment test](#the-four-layer-alignment-test)
- [The optimal-play test](#the-optimal-play-test)
- [Client sites: brand fidelity over taste](#client-sites-brand-fidelity-over-taste)
- [Onboarding: order encodes the thesis](#onboarding-order-encodes-the-thesis)
- [The micro-label tax (eyebrows and letterspaced mono)](#the-micro-label-tax-eyebrows-and-letterspaced-mono)
- [Where work-surface rules still apply](#where-work-surface-rules-still-apply)

## The four-layer alignment test

Run this before touching any acquisition surface. Write one sentence per layer:

| Layer | What it currently says |
|---|---|
| Landing | |
| Onboarding | |
| Product | |
| Pricing | |

If the four sentences are not the same sentence, no amount of interface work
will fix the funnel — you are optimizing a screen inside a contradiction.

A diagnosis of this shape (anonymized) produced the test: *the landing sold one
concept, onboarding delivered a different tool, the product delivered a third
thing, and pricing billed for a fourth unit — four misaligned layers.* The fix
was one sentence that named a single value unit and billed on it, and every layer
was rebuilt to say that one thing.

The alignment sentence should also name the **unit of value**, and that unit
should be the **unit of billing**. When they differ, pricing feels arbitrary and
expansion has no natural trigger.

## The optimal-play test

Model the smartest user's best move and check whether it pays you.

A real finding of this shape (anonymized): a product's *optimal user play was
zero revenue* — one account, bring-your-own-key, API/MCP access, unlimited usage,
all at the cheapest tier. Nothing was broken; every rule worked as written. The
*combination* was the leak, and it only appeared once someone played the user's
side of the board.

Procedure:

1. Write the cheapest path to the product's full value.
2. Price it.
3. If a sophisticated user reaches full value at or near zero, the packaging is
   the bug — not the interface.

Related pricing principle: **charge for the moat, not the commodity.** If users
can supply the commodity input themselves and still need you, the commodity was
never the value. Discount for it; never let it zero out the platform fee.

## Client sites: brand fidelity over taste

Client sites are acquisition surfaces for *the client*, and the conversion
argument is that the site reads as **that brand** rather than as a template.

Two rules, both learned expensively (see the `visant-new-site` skill for the full
workflow):

1. **Derive the visual concept from the brand's own existing layouts**, not from
   imagination. If the brand has Figma mockups, match them: hero treatment, type
   scale, colour field, graphic devices.
2. **Use the real assets in every fold** — actual logos, the pattern system,
   real photography. Placeholders are a fallback, never a deliverable. Generic
   stock plus invented patterns reads as AI slop and destroys the one argument
   the site had.

A hero band here is correct. It carries the promise, and RCD 4 applies: *your
promise is the size of your proof* — the proof is the brand's own material.

## Onboarding: order encodes the thesis

Onboarding order is a claim about what matters. If the thesis is "your brand is
the context that makes output good", then a persona that reaches a tool before
ingesting a brand produces a generic first output and the aha-moment becomes
structurally impossible — regardless of how well the screens are designed.

Check every path through onboarding against the alignment sentence. A path that
skips the unit of value is a path that cannot activate.

## The micro-label tax (eyebrows and letterspaced mono)

Verified on a real e-book landing page. Two habits that read as
craft and are actually costing legibility on the exact elements that sell.

**A tracked-caps eyebrow sitting above an oversized hero headline is the default
AI SaaS hero. Do not ship it.** It is a shape the market now reads as
template. If the category has to be stated (it usually does), state it where the
reader already is: in the CTA label, or in the spec line under it. Removing the
eyebrow costs nothing when "E-book" already appears in the button.
Section eyebrows deeper in the page are fine — the tell is specifically
eyebrow-above-hero-h1. → *conversion*

**Uppercase and wide tracking are for labels of two or three words, never for a
line of data.** The spec line ("34 páginas · 9 etapas · 1 case inteiro ·
leitura de uma tarde") answers the question that closes a cheap purchase: what
does this cost me in time. Set as tracked caps at 11px it was the least legible
element in the fold and the most decisive. Caps removes word shape (ascenders
and descenders), which is exactly what scanning uses. → *conversion*

Concrete floors, both enforced by `npx impeccable detect`:

| Rule | Value | Why |
|---|---|---|
| Functional text (links, labels, meta, nav, buttons) | **≥ 11px** | below it fails on high-DPI and small viewports; `0.68rem`/`0.7rem` do not clear it, `0.72rem` does |
| Tracking on lowercase text | **≤ 0.02em** | tracking on lowercase breaks character grouping and slows reading |
| Tracking on short uppercase labels | **≤ 0.16em** | `0.22em` and `0.32em` are costume, not hierarchy |
| Uppercase run length | **≤ ~24 chars** | past that it is body text wearing a label's clothes |

Count the distinct font sizes you introduce, too. Fifteen sizes inside one
page block is not a ramp, it is drift: `0.96`/`0.98` and `1.08`/`1.10`/`1.12`
are invisible differences that cost a hierarchy. Collapse to a handful of steps.

## Where work-surface rules still apply

Class A relaxes the density rules, not the honesty rules. Still binding:

- Principle 9 — the UI must not lie to the database. Analytics events that fire
  for actions that did not happen poison the funnel data used to judge the very
  design being tested.
- Principle 2 — one primary action per screen. Two competing CTAs is the
  acquisition-surface version of two stacked full-width buttons.
- The verification protocol. Both themes, real keyboard, honest reporting.
- No new design-system components without approval.
