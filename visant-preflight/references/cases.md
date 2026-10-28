# The mistakes behind each check

Every preflight check was born from a loss. This file holds the long version,
for whoever wants to know **why** an item exists before accepting it.

---

## 1. Brand source of truth: client K

Visant's brand vault declared the brand's display typeface as **Termina**, a paid
Fontfabric license.

The font folder actually delivered to the client
(`Drive › client K › Visual Identity › Fonts`) contained **Syncopate** and
**Funnel Sans**, both free. There was no Termina anywhere in the material. And
Syncopate was exactly the wide uppercase that appeared in every Figma layout:
looking side by side was enough.

Nobody crossed the two. Consequence over months of project:

| Round | Typeface shipped | Why |
|---|---|---|
| 1 | Archivo | "close geometric stand-in" for Termina |
| 2 | Mozilla Text + JetBrains Mono | another approximation, another guess |
| 3 | Funnel Display + Funnel Sans | well-justified approximation, still wrong |
| 4 | **Syncopate + Funnel Sans** | someone finally opened the client's folder |

What makes this mistake so persistent: **a missing font does not error.** The
browser falls back to `system-ui` silently, the layout keeps "working", and only
a trained eye notices the product changed voice.

**Rule that stayed:** the folder the client received is stronger evidence than
the vault field. The vault is a copy, and copies age, or are born wrong.

**Structural fix:** `@visant/brand-tokens` got a font gate (`src/fonts.js`). The
generated CSS imports what can load and declares at the top what cannot, with
instructions. Before that, color had a gate that blocked the build while
typography was merely asserted.

---

## 2. Photo resolution

A full-bleed band was designed first; the source was looked at afterwards. The
source was **646px** wide and displayed at **1440px**, a 2.2x upscale. The image
arrived visibly soft, and no layout choice fixed it.

The aggravating factor was the diagnosis. The scan run to answer "is there a
high-res photo?" **filtered by minimum dimension** and walked the tree
incompletely. Result: a confident and wrong verdict ("there is no high-res photo
of the founder") that became the basis for layout decisions and a recommendation
to the client.

The folder existed. It was called `Fotografia`, nested in an unusual way
(`Fotografia/Id Visual/Assets`), and held originals up to **4562×2546**.

**Two rules stayed:**

1. **Choose the source by resolution BEFORE deciding the framing.** A wide band
   needs a wide file; cropping talent does not negotiate that.
2. **Never filter silently.** `preflight-scan.mjs` lists everything it read and
   everything it skipped, with the reason. A scan that hides is worse than a scan
   that does not run, because it produces false confidence, and false confidence
   becomes a verdict.

---

## 3. The tool that goes down: `moodboard-upscale`

Trying to get around item 2 by upscaling, the MCP `moodboard-upscale` tool
returned `INTERNAL_ERROR` on 3 of 3 calls.

Two lessons, and the second is the one that matters:

1. MCP tools go down. Two attempts, no more: repeated `INTERNAL_ERROR` is the
   server, not the payload.
2. **The right alternative was almost never upscaling.** It was finding the
   high-res original, which existed and nobody had looked at. Upscaling is
   already plan B; upscaling without having searched for the original is plan C
   dressed up as plan A.

---

## 4. The scar that reopened

A decorative `absolute` field cut through the hero's numbers band. Fixed with an
opaque background and a comment explaining why at the fix site.

Two hours later, the file was rewritten entirely for another reason (visual
decluttering) and **the same bug came back**, because the rewrite started from
the new intent instead of the old file. The defensive comment died with the file
that carried it.

**Rule that stayed:** before rewriting a file completely, read it and list the
defensive comments; carry each one, or justify in writing why it no longer
applies. And record the fix in the project's `.md` too, in the Scars section:
it is what survives the rewrite and a change of hands.

**Why it did not become an automatic detector:** a line-based rule for
"decorative layer crossing a content band" cannot tell the real case from dozens
of legitimate edges inside parents that already have a background. `refine-scan`
itself warns that a detector that shouts out of scope is one people turn off.

---

## 5. The question round that never happened

None of the four items above would have been caught by a question to the client,
but the biggest rework of the session would.

Three complete proposals were built, measured, published, and only then received
the critique that reoriented everything: *no images at all, too much text, needs
decluttering.* A thirty-second question at the start (**"how much density do you
want, and do photos go in this round?"**) would have saved a full rebuild of all
three pages.

Right after came the second: a "clean" version swapped the brand's own graphic
language for a conventional composition. The owner of the work reverted it in
one sentence: *the old version was way cooler*. Also predictable with one
question: **"what in this brand is untouchable?"**

**Rule that stayed:** the question round comes first and comes whole, in one go.
Questions drip-fed through the work always arrive after the rework they would
have prevented.
