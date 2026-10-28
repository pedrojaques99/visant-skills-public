# Despoluir uma tela — o padrão, aplicável em qualquer repo

Esta é a metade do `visant-killer` que não depende de nada da Visant: nem dos
tokens, nem do `copy-lint`, nem do design system. Serve para repo de cliente,
repo em inglês, repo que você acabou de clonar.

O defeito que ela ataca está catalogado como entrada 20 do
[slop-catalog.md](slop-catalog.md), "a página que se explica". Resumo: **a tela
funciona, passa em todos os linters, e ainda assim é ilegível de tanto texto de
apoio.** Cada linha de cromo, sozinha, é defensável; o dano é o somatório, e
nenhum linter soma.

## Quando usar

Quando a frase que você ouviu for alguma destas:

> "tá cheio de texto", "poluído", "muita label", "carregado", "não tá nível
> Apple", "parece dashboard genérico", "tá com cara de template"

Se a frase for sobre bug, lentidão ou layout quebrado, o alvo é outro: volte
para o `SKILL.md`.

## Passo 1 — Medir antes de opinar

```bash
node ~/.claude/skills/visant-killer/scripts/ruido-scan.mjs <alvo>
```

Roda em qualquer repo com `.tsx`/`.jsx`. Bilíngue (português e inglês). Não
precisa de instalação, config, nem de o repo ter linter nenhum.

Nove regras, todas com o mesmo formato de saída (`arquivo:linha`):

| regra | o que acusa | piso |
|---|---|---|
| `rotulo-gritado` | `uppercase` + `tracking-*` + corpo micro, três ou mais na mesma tela | 3 |
| `ensina-a-usar` | imperativo colado ao mecanismo: "clique **para**", "arraste **o**", "click **to**", "hover over" | 1 |
| `legenda-do-que-vem` | frase que narra o conteúdo logo abaixo: "as peças **abaixo**", "the panels **below**" | 1 |
| `verbo-por-item` | palavra de ação constante repetida uma vez por item de lista ("add", "copiar", "open") | 1 |
| `mesma-info-dois-tamanhos` | duas frases da mesma tela com 50%+ de palavras de conteúdo em comum | 1 |
| `seta-glifo` | `→` em texto onde devia haver ícone de biblioteca | 1 |
| `icone-desenhado-a-mao` | SVG 24×24 desenhado à mão, que um import substituiria | 1 |
| `realce-que-nao-decide` | realce fixo em `true` na fábrica de um item — a lista toda acende | 1 |
| `porta-repetida` | a mesma porta de dado nomeada em dois arquivos (a única regra ENTRE arquivos) | 1 |

**Achado é candidato a corte, não conserto automático.** Uma dessas linhas pode
ser a única que orienta de verdade.

As duas últimas não são de texto, e é por isso que elas existem: o caso que as
gerou (2026-09-11) era uma tela *sem* prosa sobrando — o `ruido-scan` dava zero,
e o usuário olhou o print e disse "muito slop de IA ainda". O que havia era
**acúmulo de decisão**: dois formulários iguais na mesma aba, três de três capas
acesas em ciano, e uma palavra cortada pela metade. Prosa era o sintoma antigo;
estas duas regras são o mesmo defeito sem texto.

## Passo 2 — A pergunta que resolve todas

> **Isto sobrevive se eu apagar?**

Se a resposta for "sim, a pessoa descobre mexendo", apaga. Descobrir que um card
arrasta custa um gesto; ler que ele arrasta custa uma linha em todo carregamento
de página, para sempre.

Se a resposta for "não, ninguém descobriria", ela fica — e vira **exceção com
motivo escrito** (Passo 4).

## Passo 3 — A contagem que o detector não faz

O script conta padrões. Ele não conta **acúmulo**, que é o defeito de verdade.
Isso é seu, e leva trinta segundos:

1. Abra a tela.
2. Conte os blocos de texto **antes do primeiro pixel de conteúdo**. Mais de
   três, a página está se explicando.
3. Leia em sequência a chamada, a introdução e o primeiro rótulo. Se as três
   dizem a mesma coisa em três tamanhos, duas morrem.
4. **Conte os realces.** Quantas peças estão acesas com a cor de destaque ao
   mesmo tempo? Mais de uma por região e o destaque não destaca nada — e o fato
   que importa (o que está NO AR, o passo atual) fica indistinguível do resto.
5. **Conte as portas do mesmo tipo.** Dois campos que pedem a mesma coisa
   (duas urls, dois uploads, duas buscas) na mesma tela: ou um sai, ou os nomes
   passam a dizer a diferença. Se os dois escrevem em lugares diferentes e nada
   na tela diz isso, é sorteio, não interface.
6. **Rode o `corta-scan.js`** (console, a 390px). Palavra pela metade e overlay
   empilhado não se veem correndo o olho — se veem em pixel medido.

Numa vitrine real esse número era **onze**. Depois do corte, três.

## Passo 4 — Exceção que se justifica

Duas exceções são legítimas, e só duas:

1. **Gesto sem afordância nativa** — modificador de teclado (`shift` para ajuste
   fino), redimensionar a janela, atalho. Não existe pixel que anuncie isso.
2. **Ordem que carrega significado** — numerar `01 fonte → 05 saída` numa
   bancada de áudio orienta; numerar `1. 2. 3.` numa lista de features é ordinal
   decorativo.

O detector honra a exceção **se o motivo estiver escrito**: um comentário nas
oito linhas acima do achado, citando a regra pelo nome.

```tsx
/* EXCEÇÃO ao `ruido-scan/ensina-a-usar`: o `shift` para ajuste fino é invisível
   por natureza — não existe pixel que anuncie um modificador de teclado. */
<span>arrasta pra cima e pra baixo, shift para fino</span>
```

É a única forma de calar o detector, e ela obriga quem cala a dizer por quê.
`ignore` por valor não existe aqui de propósito: ignore mudo esconde o próximo
caso.

## Passo 5 — Se o detector estiver errado, arrume a REGRA

Confirmado em três repos de fora, esta é a parte que mais economiza tempo.
Sintoma de regra mal escrita: **muito achado, quase nenhum verdadeiro.**

Casos reais e o que cada um ensinou:

| falso positivo | causa | conserto |
|---|---|---|
| `React.useState<string \| null>` lido como duas frases | genérico de TS usa os mesmos sinais de uma tag | peneira de "cheiro de código" antes de extrair texto |
| `tente "animacao", "vintage", "arrastar"` | verbo entre aspas é EXEMPLO | tirar o conteúdo entre aspas antes de casar |
| "Ao rolar, a barra encosta" | oração subordinada descreve, não manda | tirar `ao/quando/se/when/while` + palavra seguinte |
| "Supabase Service **Role** Key" | `role` é imperativo de "rolar" em português | verbo só conta colado ao mecanismo (`role a`, `role até`) |
| "Scale down slightly on **click**" | `click` como substantivo | idem (`click to`, `click here`) |
| "Choose the model shown on the Overview tab" | rótulo de campo de formulário | verbo solto saiu da regra: rótulo explica campo que não se explica sozinho |

Depois de arrumar a regra, **trave o caso no fixture**:

```bash
# adicione o caso em scripts/fixtures/ruido-casos.tsx com o ESPERADO
node ~/.claude/skills/visant-killer/scripts/ruido-scan.mjs --self-test
```

## Passo 6 — Portar para um repo novo

Nada a instalar. Três coisas para conferir na primeira rodada:

1. **A pasta certa.** O script ignora `node_modules`, `dist`, `.next`, `.claude`,
   `worktrees` e afins. Se o repo guarda worktree de agente dentro de si, o
   mesmo arquivo era contado três vezes — foi assim que 54 achados viraram 13.
2. **A língua.** As regras falam português e inglês. Outra língua exige
   acrescentar os verbos de gesto, e só isso: as regras de classe (`rotulo-gritado`)
   e de sobreposição (`mesma-info`) são agnósticas.
3. **A convenção de tamanho.** `rotulo-gritado` procura `text-xs`, `text-micro`,
   `text-rotulo` e `text-[10px|11px]`. Repo com escala tipográfica própria precisa
   do nome dela na regra, ou a regra não acha nada.

## Números de referência

Rodado em quatro repos, depois de a regra ser estreitada:

| repo | arquivos | candidatos |
|---|---|---|
| vitrine @visant/ui (depois do corte) | 80 | **0** |
| visant-club | 35 | 12 |
| 7panel_studio | 160 | 13 |
| agent-dashboard | 84 | 18 |

Zero no primeiro **não quer dizer tela limpa**: o detector conta cromo, não
julga se o que sobrou merece o lugar que ocupa. O Passo 3 continua sendo seu.
