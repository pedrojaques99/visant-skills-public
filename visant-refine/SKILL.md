---
name: visant-refine
description: 'Sub-skill do visant-killer: desenha gráfico, gauge, sparkline, slider de simulação e tile de métrica com anatomia própria, pra tela parecer desenhada e não montada. Use em "adicionar chart", "gráfico", "slider", "simulador", "medidor", "sparkline", "burilar", "refinar", "deixar mais desenhado".'
---

# Visant Refine

Acabamento. Esta skill assume que a decisão de **incluir** o elemento já foi
tomada e defendida em outro lugar, e responde só como ele é desenhado.

## A hierarquia, e ela não é negociável

| Skill | Decide |
|---|---|
| `visant-frontend` | **se** o elemento existe, e qual variável de negócio ele move. O *cut test* roda lá. |
| `dataviz` | se o gráfico está **correto**: forma, cor por função, validação de paleta, anti-padrão. |
| `visant-motion` | o **SSoT** de easing e duração, e as gotchas de React, Tailwind e Radix. |
| `revenue-centric-design` | **por que** animar isto e não aquilo (para onde a atenção é dirigida). |
| **esta skill** | como o elemento é desenhado, e como ele parece da mesma família dos vizinhos. |

**Refine nunca justifica um elemento.** Se a resposta para "que variável isso
move" for silêncio, o conserto é apagar, não burilar. Um gráfico bonito de um dado
que ninguém usa é slop com acabamento melhor, e custa mais atenção que a versão
feia.

Ordem de trabalho, sempre nesta sequência:

1. Passar o *cut test* do `visant-frontend`. Nomeie a variável por elemento.
2. Inventariar o que já existe. Ver "Antes de desenhar" abaixo.
3. Escolher a forma. Carregue `dataviz` **antes** da primeira linha de gráfico.
4. Desenhar com a anatomia única (tabela abaixo).
5. Só então decidir a animação, com [references/motion-inteligente.md](references/motion-inteligente.md).
6. Verificar como manda o `visant-frontend` (390px com dado real, backend parado,
   teclado), e rodar os dois portões:

```bash
node ~/.claude/skills/visant-refine/scripts/refine-scan.mjs <alvo>   # camada de acabamento
node ~/.claude/skills/visant-killer/scripts/killer-scan.mjs --report AUDIT.md <alvo>
```

O `--report` não é opcional: o `killer-scan` recusa imprimir "portão aberto" sem
a tabela de superfícies e a seção `## Tela vista` (gere o esqueleto com
`--init-report AUDIT.md`). E um zero do `refine-scan` sozinho **não** é passada
completa — foi exatamente assim que uma rodada real pulou o `visant-frontend`
inteiro: dois detectores zerados dão sensação de acabamento porque terminam em
exit code.

`refine-scan` tem seis regras, todas de coisa que compila, passa no lint e mesmo
assim quebra: cor crua em prop de gráfico (só em arquivo que importa recharts),
gráfico sem `ChartState`, `id` de `defs` sem escopo, easing ou duração fora do
SSoT, `transition-all` e `ease-in` em UI, e animação de largura ou altura.
Achado em `components/ui` é suprimido (primitivo upstream) e **contado no fim**,
nunca calado. `--self-test` prova as seis regras nos dois sentidos antes de você
confiar num zero.

## Antes de desenhar

Nada de primitivo novo sem procurar primeiro. No `visant-board` já existem, e é
por isso que quase todo pedido de refino é composição e não construção:

| Precisa de | Já existe |
|---|---|
| gráfico | `recharts` 2.x, mais `CustomChartTooltip` e `ChartState` em `components/admin/finance/` |
| estados do gráfico | `ChartState` (skeleton em forma de barra, e vazio que fala) |
| slider | `components/ui/slider.tsx` (Radix) |
| barra de razão | `components/ui/progress.tsx` |
| esqueleto | `components/ui/skeleton.tsx` |
| easing e duração | `lib/motion.ts` e os tokens `--ease-*` e `--dur-*` |
| peça já refinada, de qualquer projeto | a library da Visant, [ui.visantlabs.com](https://ui.visantlabs.com/llms.txt): `gauge`, `sim-slider`, `measure-bar`, `activity-heatmap`, `streamgraph`, `count-up`, `elastic-slider`, `skeleton-rail` |

Componente de design system não se cria nem se edita sem autorização explícita.
Falta a peça: procure primeiro na library da Visant
(`npx shadcn@latest add @visant/<nome>`, com
`"@visant": "https://ui.visantlabs.com/r/{name}.json"` no `components.json`;
a ficha de cada uma em `/r/<nome>.md`), depois o primitivo oficial
(`npx shadcn@latest add ...`). Avise antes. Sobrescrita de default de primitivo vai **no consumidor**.

## A anatomia única

O que faz uma tela parecer desenhada não é cada elemento ser bonito, é todos
contarem a mesma coisa na mesma ordem. Todo elemento de acabamento carrega estes
quatro papéis, sempre na mesma sequência visual:

| Papel | O que é | Como aparece |
|---|---|---|
| **rótulo** | o nome do que está sendo medido | `text-xs uppercase tracking-wider text-muted-foreground` |
| **valor** | o número que decide | maior peso do bloco, `tabular-nums`, neutro |
| **qualificador** | a régua que dá sentido ao valor (limite, meta, período, base) | `text-xs text-muted-foreground`, colado no valor |
| **evidência** | a forma que mostra o valor contra a régua | barra, gauge, sparkline, faixa |

Regras que valem para os quatro, em qualquer elemento:

- **Cor é exceção.** Um neutro, e cor só onde existe exceção real. Texto usa token
  de texto, nunca a cor da série. Cor segue a entidade, nunca a posição no ranking.
- **Nenhum número sem régua.** Valor sem qualificador é trivia. "R$ 25.201,42" não
  diz nada; "11,3% da receita bruta" diz.
- **Sem denominador não existe razão.** Denominador zero é `null` e a linha não
  renderiza. "0,0%" afirma fato falso.
- **A forma só vale dentro do domínio dela.** Barra de razão tem escala enquanto o
  valor cabe no limite; passando dele ela satura e mente, e o número que diz o
  quanto passou substitui a barra. Isso não é detalhe, é a regra que mais aparece.
- **Vazio, erro e carregando são três estados**, e os três têm desenho.
- **A mesma família nas duas pontas:** ao adicionar o segundo elemento de um tipo,
  extraia o primeiro. Duas variantes da mesma coisa é o começo de três.

Catálogo dos elementos, cada um com anatomia, props e o erro que ele costuma
cometer: [references/elementos.md](references/elementos.md).

## Gráfico

Carregue `dataviz` e siga o procedimento dele. O que muda na Visant, e não está lá:

- **Cor de série sai de token, e o formato do token se confere antes da primeira
  linha.** Onde o CSS guarda canal HSL solto (`--primary: 0 0% 9%`, o caso do
  visant-board) a prop precisa do envelope: `stroke="hsl(var(--primary))"`. O
  `var(--primary)` pelado entrega a string `0 0% 9%`, que não é cor, e o traço
  desaparece sem erro em `tsc`, lint ou detector. Palette crua do Tailwind e hex
  no JSX também não entram: `text-purple-400` já passou batido por dois
  detectores neste repo.
- **`ChartState` envolve todo gráfico.** Eixo vazio com moldura é o "0 itens" da
  dataviz.
- **`id` de `clipPath` e de `defs` colide por nome.** Dois gráficos na mesma página
  com o mesmo `id` se sobrescrevem; escope por instância.
- **Limite e meta são `ReferenceLine`**, com rótulo, não uma cor de fundo. A linha
  é o fato; a cor seria opinião.
- **`description` e payload pesado ficam fora do dado do gráfico.**

Receitas prontas em recharts (limite com `ReferenceLine`, acumulado que cruza a
faixa, sparkline sem eixo, gauge de razão) e o mapa de token por função:
[references/charts.md](references/charts.md).

## Simulação por slider

Um slider que projeta cenário é uma máquina de mentir se o desenho não separar
projeção de fato. O contrato mínimo:

1. **O valor real fica na tela, sempre**, marcado na própria trilha, e o rótulo
   diz qual é qual. Dois números da mesma unidade e de espécies diferentes sem
   rótulo corrompem a leitura.
2. **Parada nos limites que importam.** O slider para nos números que mudam a
   decisão (o teto do MEI, o teto do Simples), não em múltiplos redondos.
3. **A faixa é desenhada na trilha**, para o usuário ver onde o regime muda antes
   de arrastar.
4. **Voltar ao real é um clique**, e ele aparece só quando há simulação em curso.
5. **Nada persiste.** Simulação não escreve no banco, e a URL só carrega o estado
   se o compartilhamento for parte do pedido.
6. **Teclado move**, `aria-valuetext` fala o valor formatado.

Contrato completo, com o padrão de estado e os erros clássicos:
[references/simuladores.md](references/simuladores.md).

## Animação inteligente

Inteligente quer dizer **escolhida pela variável**, não pela oportunidade. A regra
que gera as outras: anima o que carrega a decisão, na hora em que a decisão muda.

- Valor que o usuário está produzindo com a mão (arrastando o slider) **não anima**:
  ele segue o dedo. Animar aqui é latência com boa aparência.
- Valor que muda **por consequência** (o total que o slider recalculou, depois que
  ele soltou) pode contar até o novo número, curto, uma vez.
- **Cruzar um limite é evento**, e evento merece peso: a mudança de estado da faixa
  é a animação, não um brilho no card.
- Nada anima na montagem se o usuário já leu aquele número na navegação anterior.
- Cem vezes por dia não anima.

Tabela de decisão por caso, com os valores do SSoT:
[references/motion-inteligente.md](references/motion-inteligente.md).

## Caso trabalhado: o painel fiscal

`/admin/fiscal` é o exemplo canônico dos três assuntos juntos, e está escrito passo
a passo (o que entrou, o que foi recusado e por quê) em
[references/caso-painel-fiscal.md](references/caso-painel-fiscal.md). Leia antes de
refinar qualquer painel de número, porque os erros são os mesmos: barra que satura,
projeção que se confunde com fato, e animação em cima do dado errado.
