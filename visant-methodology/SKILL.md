---
name: visant-methodology
description: 'Visant''s official brand-building methodology: 9 stages in 3 phases and the dependency cascade between them. Use to generate or audit a full branding, or to write the prompt for one stage. Use on "Visant methodology", "full branding", "audit branding", "metodologia Visant", "branding completo", "auditar branding".'
---

# Visant Methodology

> "Marca não se desenha no feeling. É consequência de um processo bem feito."
> (A brand is not designed on gut feeling. It is the consequence of a well-run
> process.)

Stage names are kept in Portuguese (with English in parentheses) because they are
the official terms used in Visant's material and deliverables.

## Structure: 3 phases, 9 stages (cascade)

Each stage feeds the next. Skipping stages weakens the brand.

---

## PHASE 1: A ESTRATÉGIA (strategy, the brain)

### Stage 01: Mensagem Central & Pilares (central message and pillars)

**Mensagem Central** = an INTERNAL technical sentence (not a slogan).

```
PRODUCT + DIFFERENTIATOR + EMOTIONAL LINK = Mensagem Central
```

- **Product:** what is technically being sold.
- **Differentiator:** what sets the offer apart from others in the same field.
- **Emotional link (Elo Emocional):** the feeling that creates connection.

**The 3 Pillars:** core values. A good pillar: if violated, the brand stops being
itself. A good pillar: the brand can DO it, not just say it.

**Example (a racket-sports matchmaking app):**
- MC: "A matchmaking app for racket sports whose edge is the social side: it makes players feel part of a community."
- Pillars: Belonging | Shared Progress | Ease

---

### Stage 02: Pesquisa de Mercado & Persona (market research and persona)

**Research ≠ inspiration.** A moodboard is not a diagnosis.

**3 layers to map:**
1. What competitors deliver **well** (do not compete there)
2. What everyone delivers **badly** (opportunity)
3. What **nobody** delivers (free territory)

> The market's unresolved frustration is the gold.

**Visant persona:** focus on **pains, longings and hidden needs**, not
demographics.
- ~8 named pains/desires (Dor 01, Dor 02, Desejo 01...)
- Name, age, real context
- Questions: what do they want and cannot get? What do they try to solve alone
  and fail? What do they fear?

---

### Stage 03: Arquétipos & Tom de Voz (archetypes and tone of voice)

**A brand is a person.** Mix of primary + secondary (only one = one-dimensional).

**Key question:** "If this brand were a person, how would it behave at a bar
table with strangers?"

**Visant's 12 archetypes:**
1. O Explorador / Explorer (curiosity, challenge)
2. O Cara Comum / Everyman (belonging, authenticity)
3. O Herói / Hero (overcoming, conquest)
4. O Sábio / Sage (knowledge, clarity)
5. O Cuidador / Caregiver (protection, safety)
6. O Governante / Ruler (authority, control)
7. O Mago / Magician (innovation, disruption)
8. O Rebelde / Rebel (change, freedom)
9. O Criador / Creator (originality, expression)
10. O Prestativo / Helper (serving, making easy)
11. O Amante / Lover (desire, sensoriality)
12. O Bobo / Jester (humor, irreverence)

**Tone of voice = 3 tone pillars**, each with an example sentence.

---

### Stage 04: Manifesto

Condenses the strategy into words that breathe. **If the Mensagem Central faces
inward, the Manifesto faces outward.**

**3 movements:**
1. **Provocation:** a question/image the reader recognizes ("yes, that's me")
2. **Tension:** the problem that exists: frustration, lack, discomfort
3. **Promise:** what the brand does, with whom, for what. A final impact sentence.

**Slogan suggestion:** the manifesto's final sentence becomes a slogan candidate.

---

## PHASE 2: A IDENTIDADE VISUAL (visual identity, the face)

### Stage 05: Logotipo & Geometria (logo and geometry)

**3 steps:** Concept → Sketch → Construction & Test

- List what the symbol must communicate (from the Pillars and Archetype)
- A logo built on a grid = professionalism and longevity
- Apply it to layouts BEFORE refining (an isolated logo deceives)

*Note: visual stage. AI generates conceptual guidelines, not the logo itself.*

---

### Stage 06: Cromatismo & Tipografia (color and typography)

Palette + typography = **80% of a brand's tone**.

**Palette: a named color is a color with purpose.**
Each color gets a name that says when to use it.
Example: "Matchday Green" (#9BAE00), the game-day green, dense, mature.

**Type pair (at least 2 families):**
- **Headline:** emphasis, large titles, visual accent.
- **Body (legibility):** running text, neutral, clear at small sizes.

---

### Stage 07: Sistema Gráfico & Layouts (graphic system and layouts)

> A strong brand is recognized even without the logo showing.

**4 components:**
1. **Patterns:** for backgrounds, fabrics, packaging.
2. **Graphic elements (grafismos):** the brand's own shapes/illustrations.
3. **Image rules:** how it photographs, crops, which filters it applies.
4. **Editorial grids:** the grid that organizes posts, pages, presentations.

---

## PHASE 3: O RITUAL (the ritual, delivery)

### Stage 08: Apresentação (presentation, 40 slides)

**The client needs to see the PROCESS before seeing the RESULT.**

3 principles:
1. Narrative before the result (suspense)
2. One decision at a time
3. Confidence and authority

### Stage 09: Manual & Entrega (brand system)

3 layers: Understanding (manual) | Operation (files) | Preservation (usage rules)

---

## The Visant Decalogue

1. A brand is not designed on gut feeling. It is the consequence of a well-run
   process.
2. With strategy and visual theme defined, aesthetics gain a unique personality.
3. Discovering the audience's desires is what makes clients buy a brand.
4. Market research is essential to find what nobody is doing.
5. A strong brand is recognized even without the logo showing.
6. A well-made presentation sells the process.
7. The work only ends when the brand withstands time on its own.
8. Processes free mental space for you to be creative.
9. Good brand immersion is what most prevents change requests.
10. The goal is to turn clients into fans before they know the product.

---

## Applying it in an AI generator

Visant Labs' branding generator (the "branding machine", `branding-generate` in
`visant-mcp-connect`) follows this cascade. When generating branding with any AI,
follow it strictly:

| Step | Visant stage | BrandingData field | Depends on |
|------|---|---|---|
| 1 | Mensagem Central & Pilares | `centralMessage`, `pillars` | prompt |
| 2 | Market research | `marketResearch` (3 layers) | step 1 |
| 3 | Persona | `persona` (8 pains/desires) | steps 1-2 |
| 4 | Archetypes & tone of voice | `archetypes`, `toneOfVoice` | steps 1-3 |
| 5 | Manifesto & slogan | `manifesto`, `sloganSuggestion` | steps 1-4 |
| 6 | SWOT analysis | `swot` | steps 1-3 |
| 7 | Color palette | `colorPalette` (named colors) | steps 1-5 |
| 8 | Type pair | `typography` | steps 1-5 |
| 9 | Graphic system | `graphicSystem` | steps 5-8 |
| 10 | Logo concept | `logoConcept` | steps 1-5, 7-8 |

**Golden rule:** every generation prompt MUST receive the outputs of the previous
stages as context. The cascade is what makes the AI generate with coherence
instead of genericness.

---

## Glossary

| Term | Definition |
|---|---|
| Brand System | Full package of final deliverables |
| Cascata (cascade) | Dependency logic: each stage feeds the next |
| Cromatismo Dinâmico | Validating palettes by applying them to real layouts |
| Elo Emocional | The feeling the brand conveys (3rd ingredient of the MC) |
| Identidade Flexível | A graphic system that holds up on any surface |
| Manifesto | Emotional, public declaration of the brand's existence |
| Mensagem Central | Internal technical sentence: Product + Differentiator + Emotional link |
| Mix Arquetípico | Combination of primary and secondary archetype |
| Pilares | 3 values that, if violated, make the brand stop being itself |
| Sistema Gráfico | Visual elements that let the brand be recognized without the logo |
