# Declutter a screen: the pattern, usable in any repo

This is the half of `visant-killer` that depends on nothing from Visant: not the
tokens, not `copy-lint`, not the design system. It works on a client repo, an
English repo, a repo you just cloned.

The defect it attacks is cataloged as entry 20 of
[slop-catalog.md](slop-catalog.md), "the page that explains itself". Summary:
**the screen works, passes every linter, and is still unreadable from so much
helper text.** Each line of chrome, on its own, is defensible; the damage is the
sum, and no linter sums.

## When to use

When the sentence you heard is one of these:

> "tá cheio de texto", "poluído", "muita label", "carregado", "não tá nível
> Apple", "parece dashboard genérico", "tá com cara de template"
> ("too much text", "cluttered", "too many labels", "looks like a template")

If the sentence is about a bug, slowness or a broken layout, the target is
something else: go back to `SKILL.md`.

## Step 1: Measure before you opine

```bash
node ~/.claude/skills/visant-killer/scripts/noise-scan.mjs <target>
```

Runs on any repo with `.tsx`/`.jsx`. Bilingual (Portuguese and English). Needs
no install, no config, and no linter in the repo.

Nine rules, all with the same output format (`file:line`):

| rule | what it flags | floor |
|---|---|---|
| `shouting-label` | `uppercase` + `tracking-*` + micro body size, three or more on the same screen | 3 |
| `usage-instruction` | imperative glued to the mechanism: "clique **para**", "arraste **o**", "click **to**", "hover over" | 1 |
| `caption-of-what-follows` | a sentence narrating the content right below: "as peças **abaixo**", "the panels **below**" | 1 |
| `verb-per-item` | a constant action word repeated once per list item ("add", "copiar", "open") | 1 |
| `same-info-twice` | two sentences on the same screen sharing 50%+ of their content words | 1 |
| `arrow-glyph` | `→` in text where a library icon belongs | 1 |
| `hand-drawn-icon` | a hand-drawn UI glyph SVG (16/20/24 grid) that an import would replace; icon files and brand marks stay out | 1 |
| `highlight-at-rest` | highlight hardcoded to `true` in an item factory: the whole list lights up | 1 |
| `repeated-door` | the same data entry point named in two files (the only rule ACROSS files) | 1 |

**A finding is a cut candidate, not an automatic fix.** One of those lines may be
the only one that actually guides.

The last two aren't about text, and that's why they exist: the case that
produced them was a screen *without* leftover prose. `noise-scan` returned zero,
and the user looked at the screenshot and said "still a lot of AI slop". What was
there was **accumulated decisions**: two identical forms on the same tab, three
out of three covers lit in cyan, and a word cut in half. Prose was the old
symptom; these two rules are the same defect without text.

## Step 2: The question that settles all of them

> **Does this survive if I delete it?**

If the answer is "yes, people find out by using it", delete it. Discovering that
a card drags costs one gesture; reading that it drags costs a line on every page
load, forever.

If the answer is "no, nobody would find out", it stays, and becomes an
**exception with a written reason** (Step 4).

## Step 3: The count the detector doesn't do

The script counts patterns. It doesn't count **accumulation**, which is the real
defect. That's yours, and it takes thirty seconds:

1. Open the screen.
2. Count the text blocks **before the first pixel of content**. More than three,
   the page is explaining itself.
3. Read the headline, the intro and the first label in sequence. If all three
   say the same thing in three sizes, two of them die.
4. **Count the highlights.** How many pieces are lit with the accent color at
   the same time? More than one per region and the accent highlights nothing,
   and the fact that matters (what is LIVE, the current step) becomes
   indistinguishable from the rest.
5. **Count the entry points of the same type.** Two fields asking for the same
   thing (two urls, two uploads, two searches) on the same screen: either one
   goes, or the names start stating the difference. If both write to different
   places and nothing on screen says so, it's a lottery, not an interface.
6. **Run `corta-scan.js`** (console, at 390px). A half-cut word and a stacked
   overlay aren't seen by scanning with your eyes, they're seen in measured
   pixels.

On a real showcase that number was **eleven**. After the cut, three.

## Step 4: An exception that justifies itself

Two exceptions are legitimate, and only two:

1. **A gesture with no native affordance**: a keyboard modifier (`shift` for fine
   adjustment), resizing the window, a shortcut. No pixel can announce that.
2. **Order that carries meaning**: numbering `01 source → 05 output` on an audio
   bench guides; numbering `1. 2. 3.` on a feature list is a decorative ordinal.

The detector honors the exception **if the reason is written**: a comment within
the eight lines above the finding, naming the rule.

```tsx
/* EXCEÇÃO ao `noise-scan/usage-instruction`: o `shift` para ajuste fino é invisível
   por natureza, não existe pixel que anuncie um modificador de teclado. */
<span>arrasta pra cima e pra baixo, shift para fino</span>
```

It's the only way to silence the detector, and it forces whoever silences it to
say why. A by-value `ignore` doesn't exist here on purpose: a silent ignore hides
the next case.

## Step 5: If the detector is wrong, fix the RULE

Confirmed on three outside repos, this is the part that saves the most time.
Symptom of a badly written rule: **lots of findings, almost none true.**

Real cases and what each one taught:

| false positive | cause | fix |
|---|---|---|
| `React.useState<string \| null>` read as two sentences | a TS generic uses the same signs as a tag | a "code smell" sieve before extracting text |
| `tente "animacao", "vintage", "arrastar"` | a verb in quotes is an EXAMPLE | strip quoted content before matching |
| "Ao rolar, a barra encosta" | a subordinate clause describes, it doesn't command | strip `ao/quando/se/when/while` + the next word |
| "Supabase Service **Role** Key" | `role` is the imperative of "rolar" (to scroll) in Portuguese | a verb only counts when glued to the mechanism (`role a`, `role até`) |
| "Scale down slightly on **click**" | `click` as a noun | same (`click to`, `click here`) |
| "Choose the model shown on the Overview tab" | a form field label | the loose verb left the rule: a label explains a field that doesn't explain itself |

After fixing the rule, **lock the case in the fixture**:

```bash
# add the case to scripts/fixtures/noise-cases.tsx with the EXPECTED result
node ~/.claude/skills/visant-killer/scripts/noise-scan.mjs --self-test
```

## Step 6: Porting to a new repo

Nothing to install. Three things to check on the first round:

1. **The right folder.** The script ignores `node_modules`, `dist`, `.next`,
   `.claude`, `worktrees` and the like. If the repo keeps agent worktrees inside
   itself, the same file used to be counted three times: that's how 54 findings
   became 13.
2. **The language.** The rules speak Portuguese and English. Another language
   needs the gesture verbs added, and only that: the class rules
   (`shouting-label`) and the overlap rules (`same-info-twice`) are language-agnostic.
3. **The size convention.** `shouting-label` looks for `text-xs`, `text-micro`,
   `text-rotulo` and `text-[10px|11px]`. A repo with its own type scale needs
   that scale's name in the rule, or the rule finds nothing.

## Reference numbers

Run on four repos, after the rule was narrowed:

| repo | files | candidates |
|---|---|---|
| component showcase (after the cut) | 80 | **0** |
| marketing site | 35 | 12 |
| studio panel app | 160 | 13 |
| agent dashboard | 84 | 18 |

Zero on the first **doesn't mean a clean screen**: the detector counts chrome, it
doesn't judge whether what's left deserves the space it takes. Step 3 is still
yours.
