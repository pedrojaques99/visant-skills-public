# False positive: when the defect is in the rule, not in the code

Before spending a round on a list of findings, measure the payoff. A `grep`
detector flags **syntax**; the rule it tries to defend is about **intent**, and
the gap shows up as mass noise.

Symptom that the defect is in the rule and not in the code: **many findings,
almost none real**. In one real audit a repo's `lint:design` returned 104 hex
colors with about 1 real one. The rest were extracted palettes, WCAG reference
points (`#fff` and `#000`, which cannot become tokens without breaking the
contrast math), third-party brand colors, canvas and WebGL (which do not read
CSS custom properties), email HTML, and an HTML entity (`&#9662;`) the regex read
as a color.

The procedure, in this order:

1. **Group findings by folder before reading lines.** Concentration in a `lib/`,
   a `__tests__/` or a canvas engine is the signature of a badly scoped rule,
   not of tech debt.
2. **Read the intent written in the rule itself.** "duration-300+ *on
   interactive elements*" and "backdrop-blur *on cards*" already carried the
   scope in the title, and the `grep` ignored it. Restricting each rule to the
   intent it declares dropped 20 findings to 4 and 49 to about 20, without
   loosening anything.
3. **Only then fix what is left**, which is the real finding.

A scoped rule needs a **reason written inside the rule**, with the case that
created it. An exclusion with no justification is `audit-ignore` under another
name, and whoever reads it later cannot tell a decision from giving up.

Third-party repos are the cheapest calibration. On 2026-10-28 `noise-scan` ran
on vercel/commerce, shadcn-ui/taxonomy and steven-tey/precedent: 17 findings,
11 of them `hand-drawn-icon` on tech logos (Simple Icons ships on the same 24
grid as UI glyphs) and on a dedicated `icons/` folder, plus 2 `hover-lift` on an
icon scaling inside a fixed button. Scoping both rules to their declared intent
(a UI glyph in a regular component; a card or image that rises) left 6, and the
`hand-drawn-icon` survivors are a shield and a triangle that `lucide-react`,
already installed, ships. Kept on purpose: `caption-of-what-follows` on "Enter
your email **below** to create your account". It is shadcn's default auth copy,
and the same repo's login page says "Enter your email to sign in to your
account" with no pointer, which is the fix. Exempting form or auth context would
also exempt "fill in the form below", the canonical case of the rule.

Three things this does **not** authorize: loosening a detector because the fix is
work; scoping without checking the case on screen (the blur case required
opening the page and seeing what was behind it); and treating high volume as
proof the rule is wrong, because sometimes the repo really is dirty. What decides
is the hit rate read at `file:line`, never the size of the list.

Before trusting a "zero" from the copy gate, prove the extractor:

```bash
node ~/.claude/skills/visant-killer/scripts/killer-scan.mjs --self-test
```

It runs extraction against `scripts/fixtures/copy-extractor.tsx`, which carries
the contract inside it (a line with `EXTRAI` must come out, a line with `IGNORA`
must not), and fails both ways. The false **negative** is what matters: a string
that was never extracted makes the gate say zero about text nobody checked, and
that looks like success. That is how copy inside an interpolated template
(`` `Acima de ${x}. Obrigatória.` ``) was found slipping through. A new case that
escapes: add it to the fixture, never replace one. The same self-test also
proves the built-in token fallback both ways (`fixtures/token-fallback-*`).

Gates (all must stay at zero **in the target**, never in the whole repo):

| Gate | Zero means |
|---|---|
| `impeccable detect` | no generic-AI tell: gradient text, template purple, bounce, glow, accent on rounded |
| token (`audit:design` errors, or the built-in fallback) | no raw color and no value outside the token |
| copy (voice) | no em-dash, bullet separator, "não é X, é Y", "é sobre X", emoji, semicolon, guru opener, repeated credibility badge |
| chrome noise (`noise-scan`) | no screen explaining itself to death |

If the repo has no token gate of its own, `killer-scan` runs its built-in
fallback and says so. **A skipped gate is reported, never omitted.** After the
gate, and only after, run `tsc` and the lint.
