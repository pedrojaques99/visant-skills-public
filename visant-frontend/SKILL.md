---
name: visant-frontend
description: 'Sub-skill do visant-killer: sistema de decisão de frontend da Visant, onde toda escolha de interface nomeia a variável de negócio que move. Entrega obrigatória é a tabela de classificação das rotas. Use em "redesenhar tela", "criticar interface", "hierarquia visual", "cortar excesso", "empty state".'
---

# Visant Frontend

A decision system for Visant product interfaces. The rule that generates every
other rule:

> **A design choice only ships if it names the business variable it moves.**
> If it moves nothing, it is decoration, and decoration costs attention.

## Inherited constraints (read before anything else)

This skill extends **[revenue-centric-design](https://github.com/heliocosta-dev/revenue-centric-design)**
by Richard ([@richardrx](https://x.com/richardrx)) — 101 principles on conversion,
activation, retention, pricing, and behavioral science, distilled with the
author's permission. That skill owns **persuasion mechanics**; this one owns the
**product interior and the build**. Where both apply, cite the RCD principle by
name and add the Visant-specific move.

> **Do not apply either skill to betting, casino, gambling, or real-money
> games-of-chance products.** This is a hard condition of the source author's
> reuse permission, not a stylistic preference. Decline and explain.

**Never modify the revenue-centric-design skill.** Reference it; do not edit it.

### The craft layer lives next door

**`visant-refine`** owns the elements this skill does not draw: charts, limit
meters, simulation sliders, gauges, sparklines, delta badges, metric tiles, and
the motion that carries a data change. The split is strict and load-bearing:

> **This skill decides IF the element exists and what variable it moves.**
> **`visant-refine` decides HOW it is drawn, and that every such element on the
> screen reads as one family.**

Load `visant-refine` whenever the ask is "add a chart", "show the limit", "make it
feel designed", "burilar", a slider that projects a scenario, or intelligent
animation. It defers to `dataviz` for chart correctness and to `visant-motion` for
the easing/duration SSoT — and it never justifies an element. If the *cut test*
below produces silence, the fix is deletion, not refinement: a beautiful chart of
a datum nobody uses is slop with better finishing, and it costs more attention
than the ugly version.

## Step 0 — Classify the surface (a written table, before any fix)

**This step's deliverable is a table on disk, not a conclusion in your head.**
That is a fix, not ceremony. This skill used to end Step 0 in a *question*, and
a question has no exit code — so in a real round someone ran `motion-lint` and
`refine-scan`, saw both at zero, called it a complete pass, and skipped this
skill entirely without noticing. An agent always gravitates to what closes at
zero. Now this closes too:

```bash
K=~/.claude/skills/visant-killer/scripts/killer-scan.mjs
node $K --init-report AUDIT.md <target>   # one pre-filled row per route
# fill the table, THEN fix anything
node $K --report AUDIT.md <target>
```

`killer-scan` refuses to print "portão aberto" without that table, and rejects a
row whose business-variable column is blank, `-`, or "TBD" — filling it with
nothing is the bureaucratic version of skipping the step. Classifying *after*
you've edited isn't classifying, it's justifying.

**Se o script não estiver nesse caminho, o passo continua obrigatório.** Ele é
uma conveniência, não a razão do passo. Sem script:

```bash
ls ~/.claude/skills/visant-killer/scripts/killer-scan.mjs   # existe?
```

Se não existir — repo não linkado, skill instalada solta, ambiente de cliente —
**escreva a tabela à mão** no `.md` do projeto, com as mesmas colunas: rota,
classe, variável de negócio, o que a persuasão é ali. Uma linha por rota, coluna
de variável nunca vazia. Depois siga o resto da skill normalmente.

O que não vale é o que já aconteceu: não achar o script e tratar o passo como
pulado. Gate cuja ferramenta sumiu não vira licença — vira trabalho manual.

Applying one surface's instincts to another is the most expensive frontend error
Visant makes. Classify first; the rules follow from the class.

| Class | Revenue variable | Examples | Persuasion is | Read |
|---|---|---|---|---|
| **A. Acquisition** | conversion rate | client sites, landing, pricing, onboarding, upgrade prompts | **the job** — a hero has work to do | [acquisition-surface.md](references/acquisition-surface.md) |
| **B. Work** | throughput × decision quality | lead queues, kanban, editors, session runners, admin | **noise** — every px of chrome is one less item on screen | [work-surface.md](references/work-surface.md) |
| **C. Trust** | retention / money not lost | billing, destructive actions, data writes, settings | **irrelevant** — reversibility and correctness rule | [trust-surface.md](references/trust-surface.md) |

Classic failure: a gradient hero band on a work queue. It is right on `/pricing`
and wrong on `/leads` — same component, opposite verdict.

When a screen mixes classes, classify **per region**, not per page. A billing row
inside a settings page is C even though the page is B.

## The spine

Twelve principles. Each names its variable. RCD lineage marked where it exists.

1. **Classify before you design.** The surface class determines which rules
   apply. Skipping this produces confident, wrong work. → *all*

2. **Neutrality is omission — inside too.** One primary action per surface. The
   datum that drives the decision gets the most typographic weight. **A disabled
   primary button is a lie** — replace it with quiet text or a different
   affordance. *(RCD 1)* → *conversion, throughput*

3. **Weight is contextual, not intrinsic.** The same datum earns different weight
   on different surfaces, depending on whether the user is **choosing** or
   **processing**. A score is the scan axis in a grid and mere context in an
   already-ordered queue. → *decision quality*

4. **The default is the strategy you shipped.** A default sort, filter, or plan
   is a recommendation with your name on it. Make it good, and make its rule
   legible in one line where the user picks it. *(RCD 6)* → *decision quality*

5. **Zero is not information.** A metric reading zero does not render. Neither
   does a status badge that 100% of rows carry. → *density*

6. **Chrome is a budget.** Count vertical pixels before the first item of real
   content. Spend generously inside the content; pay for it by cutting chrome,
   not by cutting content. → *throughput*

7. **Hover reveals; hover never relayouts.** Reserve the space permanently, float
   the revealed control over it. Nothing revealed only on hover may be the sole
   path to an action — `focus-visible` reaches everything. → *throughput, a11y*

8. **Retention is built in the interior.** *(RCD 7)* RCD stops at the cancellation
   flow; retention is actually earned on the screen the user stares at daily.
   Keyboard, latency, and rhythm are retention features. → *retention*

9. **Your UI must not lie to your database.** An optimistic write that records an
   action which did not happen corrupts the metric you steer by. Data integrity
   is a revenue rule, not a correctness footnote — you cannot optimize a number
   you are falsifying. → *every variable*

10. **Absence is an argument.** An empty state can be the pitch. Before adding a
    visual element, ask **where it will be missing**, not what it costs —
    coverage beats cost. An element absent exactly on your best records is worse
    than no element. *(RCD 4)* → *conversion*

11. **Find the optimal play.** Model the user's best move and check whether it
    pays you. *(A real case of this shape: a product whose optimal user play was
    zero revenue — every rule worked, the combination leaked. See
    acquisition-surface.md.)* → *monetization*

12. **Four layers, one sentence.** Landing, onboarding, product, and pricing must
    say the same thing. Misalignment here makes every downstream design decision
    unwinnable. → *all*

### The cut test

Before shipping a rule, a component, or a pixel, name its variable. No variable
named → it does not ship. Apply this to your own recommendations too.

## Non-negotiables

- **No new design-system components without explicit approval.** Reuse and
  parameterize. When a piece is genuinely missing, look first in the Visant
  library ([ui.visantlabs.com](https://ui.visantlabs.com/llms.txt): 150+ pieces
  already refined and audited, e.g. `empty-state`, `segmented-control`,
  `data-table`, `side-nav`, `billing-toggle`, `cta-surface`), then the official
  primitive (`npx shadcn@latest add …` or the Radix package) — never hand-roll
  it. Both install the same way (`npx shadcn@latest add @visant/<name>` with
  `"@visant": "https://ui.visantlabs.com/r/{name}.json"` in `components.json`).
  State what you are adding and why before adding it.
- **Optional field starts collapsed, behind a button.** Always. A field drawn in
  full — label, border, height — *says* "fill me in". When it is optional that
  claim is false, and the cost is paid in reading time by every person who has to
  decide and then decline. Render a ghost `+ <Noun>` button; expand on click.
  Two rules make it safe: it **auto-expands when it already has content** (a
  filled field hidden reads as data loss), and the button names the *noun*, not
  the action. This is the same cut as "dead controls don't render", one step
  earlier — the form should show exactly what it demands. *(spine 2, 5)* →
  *completion rate*
- **Verify before acting on a claim.** Read the code and confirm a reported defect
  is real before refactoring around it. Diagnose with `file:line` — evidence, not
  opinion.
- **Typecheck and build must pass before calling anything done.** See
  [verification.md](references/verification.md).
- **Run the design detector before opening the screen.** `npx impeccable detect
  components/ app/` front-loads the generic-AI tells (gradient text, purple
  gradients, bounce easing, accent-on-rounded, broken images). Triage findings at
  `file:line` — it is a curator, not an oracle. It complements `npm run
  audit:design`, not replaces it. See [verification.md](references/verification.md).
- **Measure the narrow viewport; never judge it by eye.** Any surface a phone can
  reach gets `documentElement.scrollWidth − innerWidth` measured at 390px with
  real data. Positive is a defect, and **re-measure after each fix** — responsive
  changes trade one overflow for another. See [verification.md](references/verification.md).
- **Report faithfully.** Say what was not verified. A screen that compiles is not
  a screen anyone has seen.

### O caminho padrão no visantlabs-os (DS 2026-10)

Peças que a rodada de 2026-10 achou reescritas à mão em dezenas de lugares.
Usar a peça é a regra; escrever de novo à mão é o defeito que o killer procura
(`slop-catalog` 24 a 26 e 33). **Contrato inteiro, tokens de cromo e a regra do
editor escuro: [ds-visantlabs-os.md](references/ds-visantlabs-os.md).**

| Precisa de… | Use | Não escreva |
|---|---|---|
| card de mídia | `MediaTile` (`ui/MediaTile.tsx`) | `<img>` + degradê + `scale` no hover + ações `opacity-0`, nem `div` em volta pra drag/`data-*` |
| escolha única entre 2 e 5 opções | `SegmentedControl` (`size="xs" scrollable` em painel estreito) | linha de botões com ativo pintado à mão |
| dialog | `Modal` (`bodyClassName` pra conteúdo de borda a borda) | portal à mão, margem negativa contra o padding |
| a ação principal de ferramenta ou painel | `Button variant="primary"` | `bg-brand-cyan/10 border-brand-cyan/30` à mão. Ciano cheio é `brand`, só em vitrine, nunca no mesmo painel |
| área de upload | `Dropzone` | `div` com `onDrop` |

Três regras que mais quebram:

- **Raio tem três nomes:** `md` controle, `xl` superfície, `full` pílula.
  `node scripts/codemod-radius-scale.mjs --apply` converte o resto sem mudar
  pixel (só o `3xl` muda de valor).
- **Peso:** `semibold` só no título principal da região e em número de
  destaque; o resto do chrome é `medium`. Opacidade crua (`white/NN`) vira
  token pelo mapa do reference.
- **Editor sempre escuro declara `dark` no root e usa tokens.** Neutro fixo
  (`bg-neutral-950`, `neutral-800`) com token dentro quebra no tema claro.

### Verificado em produção

Casos reais que confirmam as espinhas, cada um com a variável que protege:
**[19 casos em references/producao-verificada.md](references/producao-verificada.md)**.

Os quatro que mais se repetem: preço escrito na copy é afirmação sobre o banco;
papel diz *pode ver*, posse diz *de quem é a ação*; vazio-silencioso é a mentira
dominante e ela quase sempre é contada uma camada abaixo; e dois números de
unidades diferentes lado a lado sem rótulo corrompem a leitura.

## Navigation

| Working on… | Read |
|---|---|
| Queues, lists, editors, dashboards, admin, keyboard flow | [work-surface.md](references/work-surface.md) |
| Formulários e dialogs: despoluir campos, o que fazer quando a tela recusa | [work-surface.md](references/work-surface.md) — seções "Formulário: campo vazio não é campo" e "O que a tela diz quando recusa" |
| Client sites, landing, onboarding, pricing, upgrade paths | [acquisition-surface.md](references/acquisition-surface.md) |
| Billing, destructive actions, data writes, confirmations | [trust-surface.md](references/trust-surface.md) |
| Component library / registry showcase / demo of a piece / kits de peças (a peça É o produto) | [vitrine-de-componentes.md](references/vitrine-de-componentes.md) |
| Implementation in Tailwind v4 + React + Radix | [stack-tailwind-react.md](references/stack-tailwind-react.md) |
| visantlabs-os: MediaTile, SegmentedControl, Modal, Button, Dropzone, tokens de cromo, editor escuro | [ds-visantlabs-os.md](references/ds-visantlabs-os.md) |
| Charts, limit meters, simulation sliders, crafted elements, motion on a data change | load the **`visant-refine`** skill |
| Checking the work; height budget; keyboard audit; design detector | [verification.md](references/verification.md) |
| Running or writing a design critique | [critique.md](references/critique.md) |

For persuasion mechanics on acquisition surfaces — awareness levels, decoy
effect, GBB pricing, social proof, trial design — load the
`revenue-centric-design` skill and cite the named lever.
