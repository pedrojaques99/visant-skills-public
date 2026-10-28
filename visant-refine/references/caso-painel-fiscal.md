# Caso trabalhado: painel fiscal

`/admin/fiscal` em 2026-08-03. Painel de simulação de imposto que já tinha dois
cards de memória de cálculo (MEI e Lucro Presumido) e nenhuma leitura visual. O
pedido foi "charts e sliders que contabilizam os limites e animações inteligentes".
O que entrou, o que foi recusado, e por quê.

## O diagnóstico antes de desenhar

O painel entregava dois totais e o usuário fazia de cabeça duas contas que a tela
tinha como fazer:

1. **"Eu ainda caibo no MEI?"** Existia como barra de progresso, e a barra estava
   saturada em 100% ao lado do texto "274,6% utilizado". Barra que satura mente.
2. **"Quando eu estourei?"** Não existia em lugar nenhum. Medidor responde *se*;
   só a série temporal responde *quando*, e no MEI o mês do estouro é o que gera
   ação, porque o desenquadramento é retroativo a ele.

Isso decidiu as duas formas antes de qualquer código: **um acumulado por mês com
linha de teto** (responde quando) e **um slider de projeção** (responde "e se").
Nenhum gauge, nenhuma pizza, nenhum card a mais.

## O que entrou

**`FiscalSimulator`**, um card acima dos dois cards de cálculo, com três blocos na
anatomia única (rótulo, valor, qualificador, evidência):

- **Valor em uso, e de que espécie ele é.** O número grande é o faturamento que os
  dois cards abaixo estão usando, e a linha embaixo dele diz se é lançado ou
  projetado, com o lançado sempre escrito por extenso.
- **Trilha de projeção.** `Slider` do repo, domínio de 1,5x o lançado com piso que
  mantém o teto do MEI dentro da trilha (máximo arbitrário faz o controle parecer
  chute), `step` de mil, corte do MEI desenhado na trilha **com o número**, e uma
  marca fina no valor lançado que nunca sai. `aria-valuetext` devolve moeda
  formatada, não o número cru.
- **Acumulado por mês** em `AreaChart`, `ReferenceLine` tracejada no teto com
  rótulo "Teto MEI", `id` de gradiente escopado por `useId()`, e o mês do
  cruzamento escrito ao lado do rótulo do bloco. Dentro de `ChartState`, então ano
  sem lançamento diz isso em vez de desenhar eixo vazio.

**Cenário não vira fato.** Os dois cards de cálculo receberam `isScenario`, que
acende um selo "cenário" no cabeçalho. Sem isso, quem abre a tela depois lê
projeção como resultado, e a planilha exportada (que continua saindo do dado
lançado) passa a divergir do que está na tela sem explicação.

**Bônus obrigatório:** o `fetchFiscal` fazia `res.ok ? ... : 0`, então rede fora do
ar renderizava zero em tudo, e com o estado vazio novo dos cards passou a afirmar
"sem faturamento lançado". Virou `throw` com estado de erro na rota. Número errado
é ruim; frase errada é pior.

## O que foi recusado

- **Contagem animada nos números dos cards.** O valor segue o dedo no slider;
  animar o total a cada soltada brigaria com o arraste seguinte e transformaria a
  tela em dois contadores simultâneos.
- **Barra de progresso no card do MEI acima de 100%.** Já tinha sido trocada pelo
  excedente em número numa rodada anterior, e o slider não a trouxe de volta.
- **Segundo eixo no gráfico** para plotar despesa junto do acumulado. Dois eixos y
  é o erro número um de gráfico; despesa não é a pergunta deste painel.
- **Persistir o cenário na URL.** Compartilhar cenário não estava no pedido, e link
  de cenário sem rótulo de cenário é a mesma mentira, agora viajando.

## A animação que ficou

Uma só, e é a que carrega a decisão: **cruzar o teto muda o estado da faixa de
regime**, com transição de cor curta pelos tokens (`--dur-base`, `--ease-out`).
Sem pulso, sem brilho, sem entrada encenada. O resto do movimento é o que os
primitivos já fazem: o `Slider` do Radix seguindo o cursor e o `Progress`
transicionando por `transform`.

Trocar de ano descarta o cenário: projeção de um ano não vale para outro, e
cenário que sobrevive à troca de contexto é cenário que vai ser lido como fato.

## O que o portão pegou no próprio trabalho

Rodar o `visant-killer` no que eu tinha acabado de escrever devolveu dois achados,
e vale registrar porque são os dois erros mais fáceis de cometer nesta camada:

1. `text-[11px]` num rótulo de trilha. Tamanho arbitrário de fonte, quando `text-xs`
   existia. Gráfico aceita `fontSize: 11` em prop de JS; classe não.
2. A palavra "real" três vezes, contando entre arquivos. O achado era falso
   positivo do meu script (a regra do copy-lint conta por documento, e eu tinha
   juntado seis arquivos num JSON só), **e** era um problema de copy de verdade:
   "real" contra "projetado" é ambíguo num painel fiscal, onde "lucro contábil
   real" é termo técnico. Virou "lançado" contra "projetado", que é o vocabulário
   da contabilidade, e o botão virou "Limpar cenário".
