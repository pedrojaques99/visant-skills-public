# Work surfaces

Screens the user operates for long stretches: queues, lists, kanban boards,
editors, session runners, admin panels. Revenue variable:
**throughput × decision quality**.

Throughput is items processed per hour. Decision quality is whether the right
items got processed. Every rule below moves one of the two.

- [Chrome budget](#chrome-budget)
- [Hierarchy: weight follows the decision](#hierarchy-weight-follows-the-decision)
- [Hiding](#hiding)
- [Grouping by spacing](#grouping-by-spacing)
- [Hover](#hover)
- [Keyboard](#keyboard)
- [Defaults and ordering](#defaults-and-ordering)
- [Empty and absent](#empty-and-absent)
- [Anti-patterns](#anti-patterns)

## Chrome budget

Count vertical pixels from the top of the viewport to the first item of real
content. On a work surface that number is a budget, and it is almost always
overspent.

Real measurement from a lead queue before redesign:

| Block | px |
|---|---|
| Sticky header | 61 |
| "Back to dashboard" link (duplicated the header nav) | 20 |
| Gradient hero band with a title already in the tab | 88 |
| Six stat tiles, four of them reading zero | 74 |
| Collapsed "search history" card | 46 |
| Filter bar: six always-open selects | 68 |
| gaps | ~100 |
| **Total before the first lead** | **~460** |

All of it was permanent chrome serving occasional tasks. Collapsed to a single
~64px header line, it bought roughly two extra rows of content above the fold.

**Generous spacing is legitimate — but it must be financed.** Padding that makes
each card 15% taller means fewer items on screen. Pay for it by cutting chrome,
never by cutting content. State the trade when reporting; a spacing change that
reduces items-per-screen without a corresponding cut is a regression.

## Hierarchy: weight follows the decision

The datum that drives the user's next action gets the most typographic weight.
Everything else recedes. Cheap and reliable levers, in order: size, weight,
`tabular-nums`, colour, position. Border and background are last resorts.

**Weight is contextual.** The same field earns opposite treatment depending on
what the user is doing:

| Situation | Treatment |
|---|---|
| Grid of candidates — the user is **choosing** | Promote. The score is the scan axis; make it large, coloured by band, top-right of each card so the eye can run down the column. |
| Ordered queue — the user is **processing** | Demote. The list already decided; the score is context. Strip the pill and the icon, keep weight and colour only. |

Getting this wrong in either direction is a real cost: promoted noise slows the
scan, demoted signal forces the user to open items to decide.

## Hiding

- **A metric reading zero does not render.** Not "0 contacted" in success green
  during the first second of a session. The total may render when it is the
  subject of the page; its breakdowns only when non-zero.
- **A badge carried by 100% of rows distinguishes nothing.** A "NEW" status on a
  freshly-fetched list is texture, not information. Render it only once it
  changes.
- **Rare actions go behind `⋯`.** Export, bulk delete, settings. Destructive
  actions especially — they should not live one click from an innocuous button.
- **Filters: show what is filtered, not what could be.** Six open selects
  advertise capability; removable chips report state. Keep the search field
  always visible (it is the one used constantly), put the rest behind one button
  with a count badge.
- **Duplicated navigation is chrome.** A "back to dashboard" link under a sticky
  header that already contains the nav.

## Grouping by spacing

Variable gap *is* the grouping. Uniform `gap-2` throughout a card produces a flat
stack with no perceivable structure; `gap-1` inside a zone and `gap-4` between
zones produces three legible groups with no borders at all.

Box-inside-a-box is noise. A bordered, tinted panel inside a bordered card adds a
frame the eye must parse for no informational gain. Promote the panel's label
typographically and delete the frame.

Three-zone card pattern, in decreasing weight:

1. **Identity + decision** — name, and the datum that drives the action.
2. **Alerts** — only rendered when something is true.
3. **Signal** — supporting facts, pinned to the bottom.

Pin zone 3 with `mt-auto` so cards of differing name lengths share a baseline
across the grid. Without it, every card in a row ends at a different height and
the grid reads as noise.

## Hover

**Hover never changes layout.** Reserve the space permanently and float the
revealed control over it — for example, right-pad the bottom zone so a hover
action rack can occupy that corner without ever covering content, and without
anything shifting when the pointer arrives.

**Nothing revealed only on hover may be the sole path to an action.** Pair every
`group-hover:` with `group-focus-within:`, and keep the same action reachable
from a menu or detail view.

**Reveal on `(hover: hover)`, not on a breakpoint.** `sm:opacity-0
sm:group-hover:` treats screen width as "has a mouse" — but a tablet is wide and
touch, so the control becomes invisible *and* unreachable. Gate the reveal on the
media feature, keep a ≥36px tap target on touch, and pin the idiom in a helper.
Pattern: [stack-tailwind-react.md → Reveal on hover](stack-tailwind-react.md#reveal-on-hover--the-touch-safe-way).

**Selection controls are a special case.** A checkbox may hide until hover, but
must become permanently visible when its row is selected *or* when any selection
is active — otherwise the user loses sight of what they already marked.

Quick actions on hover are usually the single largest throughput win available:
copying a phone number, opening a link, or firing a message without leaving the
list removes an entire open-modal-and-return cycle per item.

## Keyboard

On a surface used for 40-minute stretches, keyboard flow is correctness, not
polish. A global `keydown` listener on `window` is the standard implementation
and the standard source of four bugs:

1. **Blanket `preventDefault` kills focused controls.** A keydown on a focused
   `<button>` or `<a>` bubbles to `window`; cancelling it cancels the control's
   own activation. Tab to "Skip", press Enter, and the app runs the primary
   action instead. In an `<a>`, Enter is the *only* activation key, so the link
   goes dead.
2. **No escape from text fields.** Guarding on "is the user typing" suppresses
   the main shortcut with no substitute. Provide `Cmd/Ctrl+Enter` to fire from
   inside the field and `Escape` to blur out of it.
3. **Shortcuts that ignore `disabled`.** The button is disabled but the shortcut
   still calls the handler. See principle 9 — this is how a UI writes a lie.
4. **Destructive keys without modifier guards.** `Backspace` bound to archive
   means `Alt+Backspace` and `Cmd+Backspace` — both ordinary delete-word combos —
   destroy records. Bind destructive actions to a deliberate key and label it.

**Correct guard order**, which fixes all four:

```
1. modifier combo (Cmd/Ctrl+Enter)  → handle, return
2. typing?                          → handle Escape, otherwise return
3. any other modifier held          → return
4. focus inside button/a/select?    → return
5. bare key                         → handle
```

Every shortcut must be announced on its own control (a `<kbd>` in the button).
An unlabelled shortcut is either undiscovered or triggered by accident — and the
most destructive action must never be the easiest key to hit.

Announce state changes for screen readers. On a surface whose whole loop is
"act → next item", a silent swap means the loop does not exist without sight: an
`aria-live="polite"` region naming the new item closes it.

## Defaults and ordering

The default sort is the strategy the product recommends. Choose it deliberately,
compute it **server-side** (a client-side sort over a paginated list reorders
only the loaded page), and explain its rule in one line where the user picks it —
an unexplained "Recommended" asks for blind trust.

Ordering heuristic that generalizes: **commitments before opportunities.** A
follow-up promised for today outranks an untouched high-score lead, because the
lead is still there tomorrow and the follow-up goes cold. Rank by band first,
then let the quality score break ties inside the band.

**Inside a band, the clock rules — not the priority.** The band already used
priority to decide membership; using it *again* to order within the band makes
the visible dates walk backwards ("tomorrow" above "next week"), and a queue
whose dates don't descend reads as a bug however correct the rule is. Sort the
band by due date; break genuine date ties with priority.

**A queue is what fits in a day; overdue-forever is not queue, it's management.**
A "today" list that ranks by risk with a small window shows only the *oldest*
overdue items — precisely the ones no one will clear today — and buries what's
actually due. Cap the recoverable window (e.g. overdue ≤ N days stays in the
queue); everything older collapses into **one** summary row ("14 overdue >7d →
review"), not N cards competing with the day's real work. The summary carries the
single red dot; the queue stays neutral. A count that doesn't match the list
beside it is noise, so name it for what the bucket actually holds ("due today",
not "open").

When a rule is duplicated across languages — the same "difficult lead" logic in
application code and in SQL — they will drift. Write a test that pins both, and
say so in a comment next to each copy.

## Empty and absent

Absence is information. A record with no logo, no site, or no photo is often
exactly the record worth acting on; render the gap as a deliberate state that
carries the argument, not as a hole in the layout.

Before adding any new visual element, run the **coverage question first**: where
will this be missing? An element absent precisely on the best records is worse
than no element — it trains the eye to skip the rows that matter. Cost comes
second, and is usually lower than assumed (page metadata already fetched during
an existing crawl costs nothing extra).

Do not render a count next to an empty state that already says the same thing
with more context.

## Formulário: campo vazio não é campo

Um formulário com nove campos abertos e sete em branco não é um formulário — é a
lista do que você ainda não preencheu. O olho gasta a varredura inteira antes de
achar o que importa, e a coluna cresce até o botão de enviar sair da dobra.

**A regra única:** campo COM valor aparece como campo; campo opcional vazio vira
`+ Substantivo` numa faixa de botões no fim do bloco. Ele reabre sozinho quando
tem conteúdo — não há estado a lembrar, ter valor já basta.

O erro típico não é esquecer a regra, é aplicá-la a metade dos campos: "medidas"
escondido atrás de um botão enquanto data, responsável, prioridade e projeto
ficam sempre abertos e quase sempre vazios. Meia regra é pior que nenhuma,
porque passam a existir dois modos sem critério visível pra qual é qual.

### Marcar a exceção, nunca a regra

Se oito de nove campos são opcionais, `(Opcional)` aparece oito vezes pra dizer
o que o silêncio já diz — e o único obrigatório fica sem marca nenhuma, ou seja,
a informação que importa é a única não escrita. Inverta: apague os oito, marque
o obrigatório com `*` (mais `aria-required` e um `sr-only`, porque asterisco é
convenção visual, não semântica).

### Enunciado vira placeholder

Texto de ajuda que explica o FORMATO do campo pertence ao placeholder: ele some
sozinho no instante em que deixa de ser útil (há texto no campo). Como parágrafo
fixo, ocupa a linha pra sempre, inclusive depois de lido.

Texto de ajuda que descreve o que o campo JÁ MOSTRA sai inteiro. "Em branco, usa
o título automático" embaixo de um campo cujo placeholder É o título automático,
escrito por extenso, é uma linha gastando altura pra narrar a tela.

Título de seção que nomeia o óbvio também sai. Duas colunas separadas por régua
vertical não precisam de "A demanda" e "Detalhes" em cima — a separação já está
desenhada, e os rótulos só somam duas linhas de chrome.

### Semente de preset

Preencher campo por preset (tipo de demanda, template, último uso) é legítimo e
tem duas regras que não se negociam:

- **Nunca escreve por cima de resposta humana.** A semente entra em campo vazio;
  sair do preset limpa apenas o que ela mesma pôs (guarde o valor semeado num
  ref e compare). Semear por cima é como um formulário passa a gravar resposta
  que ninguém deu.
- **Semente não rouba foco.** `autoFocus` é do campo que a PESSOA abriu. Um
  campo que se abriu sozinho e puxa o cursor tira a pessoa de onde ela estava
  digitando — normalmente pra outra coluna.

## O que a tela diz quando recusa

Recusa silenciosa é lida como bug do sistema, não como campo faltando. Três
falhas que aparecem juntas e se disfarçam de "não funciona":

**Botão desabilitado não explica.** `disabled` até a validação passar produz um
clique que não faz nada, não foca nada e não diz nada — e a pessoa conclui que a
integração caiu, não que faltou preencher. Deixe o botão vivo (desabilite só
durante o envio) e faça o clique ser o que revela o que falta: mensagem nomeando
o campo + foco nele + a borda dele em `destructive`. O atalho de teclado
equivalente segue o mesmo caminho, senão ele "quebra" em silêncio.

Consequência que vem junto: se o `disabled` era também a trava de duplo-clique,
ela vira um ref síncrono — `isSubmitting` só vale no próximo render, e dois
cliques no mesmo tick entram os dois.

**Mensagem de erro nunca é rótulo de botão.** `catch { setError(t.createIssue) }`
pinta a string "Criar Demanda" de vermelho como se fosse a causa. Todo fallback
de erro é uma frase que diz o que houve e o que fazer; sem causa conhecida, o
status HTTP entra no texto, porque é a única pista que sempre existe. E
`response.json()` leva `.catch()` nos dois pontos: um 502 de gateway devolve
HTML, o parse estoura, e o erro real vira a mensagem genérica.

**O alerta mora onde o clique aconteceu.** Um `<p>` de erro no fim do conteúdo
de um dialog que rola nasce abaixo da dobra: a pessoa clica, "nada acontece", e
a explicação está fora da tela. Prenda o rodapé (`sticky`) e ponha o alerta
dentro dele, encostado no botão.

## Colunas: o que separa lista de tabela

Verificado numa folha de horas em 2026-08-12, onde a lista "densa e organizada"
ainda lia como improviso. Nenhum destes acende num linter: os quatro são
alinhamento, e alinhamento errado não quebra nada, só parece amador.

**1. O campo de largura variável na frente do título desalinha a página
inteira.** Um chip de identificador que encolhe ao conteúdo (`ABC-745` contra
`sem tarefa`) faz cada título começar num x diferente. Largura fixa no chip, com
o texto centralizado, é o que transforma a lista em tabela — custa uma classe e
paga a coluna do meio inteira.

**2. Metadado dentro da célula do título aparece onde cada título termina.** O
mesmo campo (cliente, projeto, tag) numa vertical diferente por linha obriga a
reler a linha em vez de descer a coluna. Metadado que se compara entre linhas é
**coluna própria** de largura fixa, escondida por breakpoint quando não couber —
nunca um `<span>` correndo atrás do texto.

**3. O total do agrupamento tem que cair na coluna dos números que ele soma.**
`justify-between` no cabeçalho do dia fecha na borda do container, enquanto as
durações das linhas param antes do trilho de ações. Dois números da mesma
natureza, duas verticais, 56px de desencontro — e o olho acusa antes de saber
por quê. **O vão (`gap`) também precisa ser o mesmo nos dois**, ou a coluna
fecha torta por três pixels.

**4. Largura de coluna escrita à mão em cada bloco DERIVA em silêncio.** A mesma
grade costuma ser desenhada por quatro lugares — a linha, o cabeçalho do grupo,
a barra de ferramentas e o esqueleto. Mudar num e esquecer nos outros não quebra
build, não acende teste: só desalinha. Extraia as medidas para um objeto de
**constantes literais** (`const COL = { time: "sm:w-[5.5rem]", … }`) e componha
com `cn()`. Literal, nunca `w-[${x}]` — o Tailwind varre string completa e classe
interpolada não entra no CSS.

Bônus da mesma família: **o esqueleto tem que ter as mesmas colunas do conteúdo**.
Um esqueleto de uma coluna que vira duas ao carregar faz a tela encolher na
frente de quem olha.

## Par de controles é uma unidade, não duas pontas

`justify-between` numa barra larga põe a seta "anterior" numa borda e a "próxima"
na outra — mil pixels entre dois botões que se usam alternadamente, com o rótulo
boiando no meio sem dono. Navegação prev/next, zoom −/+, passo de wizard: o par
se desenha **junto**, colado no rótulo que ele muda, e o número vai pra coluna
onde os outros números já estão.

Vale a generalização: `justify-between` é para **zonas** (identidade × ação), não
para membros do mesmo controle. Quanto mais larga a tela, mais caro o erro.

## Rótulo vira ícone quando a opção TEM desenho

A régua não é economia de espaço, é tradução: o ícone paga quando ele **é** a
coisa, e cobra quando apenas a representa.

| Vira ícone | Continua palavra |
|---|---|
| "Barras" / "Linha" — a opção é uma forma, e o ícone ainda mostra o resultado antes do clique | "Time" / "Por pessoa" — audiências; viraria `Users` contra `User`, dois bonecos separados por um traço a 14px |
| "Grade" / "Lista" | "Mensal" / "Anual" |
| play, pause, fechar | qualquer opção cujo ícone precise de legenda |

Ícone que precisa de legenda é pior que a legenda sozinha. E ícone sem `title` +
`sr-only` é botão mudo: o rótulo sai da tela, não do documento.

Ganho colateral que costuma decidir o caso: o grupo de ícones encolhe e devolve
largura pro vizinho de rótulo comprido — em painel estreito é o que faz a linha
inteira caber sem truncar.

## Ferramenta de render: preview numa coluna fixa, controles noutra

Verificado no sequenciador de fotos do `auto-video-editor-ai` em 2026-08-18: a
tela tinha upload, controles (ordem, transição, formato, slider) e o
preview/player empilhados numa única coluna que rolava junto. Ajustar um
parâmetro e rolar pra baixo pra ver o resultado — ou pior, renderizar de novo e
perder de vista o preview anterior porque ele ficou acima da dobra enquanto os
controles cresciam.

**A regra:** numa ferramenta de "configura → gera → vê o resultado" (sequenciador,
editor, gerador de imagem, qualquer tela com um botão "renderizar"), preview e
output vivem numa coluna própria, fixa (`lg:sticky lg:top-*`), separada da
coluna de controles que rola livre. O usuário ajusta um parâmetro com o
resultado anterior sempre visível ao lado — não precisa escolher entre ver o
controle ou ver o efeito dele.

Isso vale mesmo antes do primeiro render: a coluna de preview já nasce no
layout (com um estado vazio nela, tipo "nada renderizado ainda"), nunca aparece
só depois que o primeiro resultado existe — senão a tela pula de uma coluna pra
duas no meio do uso, e é exatamente esse pulo de layout que a regra evita.

## Anti-patterns

| Pattern | Why it fails |
|---|---|
| Gradient hero on a work surface | Acquisition instinct on class B; 88px for a title already in the tab |
| Controle empilhado ACIMA do `<h1>`, repetindo o que o título diz | O sujeito da tela chega antes do nome dela, e a mesma informação ocupa duas alturas; ele pertence ao cabeçalho, ao lado da ação |
| Três eixos de alinhamento na mesma dobra (título à esquerda, peça central, ação na borda) | Nenhuma âncora compartilha coluna; em tela larga o primário fica a mais de 1000px do título e a página lê como montada |
| `justify-between` separando um PAR de controles (‹ ›) | Mil pixels entre dois botões alternados; par é unidade, ver a seção acima |
| Chip/badge de largura variável antes do título | Cada linha começa num x diferente; a lista nunca vira tabela |
| Larguras de coluna repetidas à mão em linha, cabeçalho e esqueleto | Derivam em silêncio: nada quebra, só desalinha |
| Disabled primary button | Promises an action that will not happen; replace with quiet text |
| Primário desabilitado ATÉ a validação passar | O clique morto é lido como "o sistema falhou", não como "faltou campo"; o clique tem que dizer o que falta |
| `(Opcional)` repetido em vários rótulos | Marca a regra e deixa a exceção sem marca — inverta |
| Campo opcional vazio renderizado aberto | Vira item na lista do que você não preencheu; `+ Substantivo` até ter valor |
| Enunciado fixo abaixo do rótulo explicando o formato | Placeholder faz o mesmo e some quando deixa de ser útil |
| Alerta de erro no fim do conteúdo de um dialog que rola | Nasce abaixo da dobra; mora no rodapé sticky, colado ao botão |
| Rótulo de botão usado como fallback de mensagem de erro | "Criar Demanda" em vermelho não é causa nenhuma |
| Metric grid of mostly zeros | Occupies the fold to report nothing |
| Uniform gap inside a card | No perceivable grouping; everything reads as one flat list |
| Guessed breakpoints | `lg:grid-cols-3 xl:grid-cols-4` assumes a viewport; use an intrinsic grid |
| Hover control that shifts layout | Content jumps under the pointer |
| Hover-reveal keyed on a breakpoint (`sm:opacity-0`) | Invisible *and* unreachable on touch tablets — use `(hover:hover)` |
| Two full-width buttons stacked | Two primaries means none |
| Client-side sort over paginated data | Sorts the page, not the set |
| Structural-overdue cards filling the day's queue | Shows only what no one will do today; cap the window, summarize the rest |
| Priority re-sorting inside an already-banded queue | Visible dates walk backwards; read as a bug |
| Flex/grid child holding text without `min-w-0` | Its min-content becomes the page's minimum width; `truncate` cannot save it |
| `flex items-center justify-between` on a header with actions | No `flex-wrap`, so a longer button label ("Sincronizando…") pushes the page sideways |
| A 5-tab strip that fits only on desktop | The last tabs are not squeezed, they are *unreachable*; scroll the strip and `shrink-0` the triggers |
| A month calendar grid on a phone | Seven ~50px columns clip every event title to 10–28px; default to a list view below the breakpoint |
| Third-party `<table>` left at `table-layout: auto` | One long title makes the table wider than its container regardless of the wrapper |
| Preview/render empilhado na mesma coluna que rola com os controles | O resultado sai da tela bem na hora de ajustar o parâmetro que o muda; preview mora em coluna própria e fixa |
