# Catálogo de elementos de acabamento

Cada elemento: para que serve, a anatomia (rótulo, valor, qualificador,
evidência), e o erro que ele costuma cometer. Todos herdam as regras da anatomia
única do SKILL.md, e nenhum deles é componente de design system: são composições
sobre `Card`, `Progress`, `Slider`, `Skeleton` e recharts.

Índice: [Medidor de limite](#medidor-de-limite) ·
[Tile de métrica](#tile-de-métrica) · [Sparkline](#sparkline) ·
[Badge de variação](#badge-de-variação) · [Gauge de razão](#gauge-de-razão) ·
[Faixa de regime](#faixa-de-regime) · [Linha de veredito](#linha-de-veredito)

## Medidor de limite

O elemento mais pedido, e o mais errado. Mostra um valor contra um teto.

Anatomia: rótulo (o que é medido) · valor (o percentual do teto, ou o valor
absoluto quando o teto é famoso) · qualificador (o teto, com o número) ·
evidência (barra).

Regras próprias:

- **Fora do domínio, a barra sai.** Acima de 100% a barra satura e passa a mentir.
  Troque pelo excedente em número: "R$ 141.430,91 acima do limite".
- O teto vive no cabeçalho ou no qualificador, uma vez, nunca nos dois.
- Cor só quando estourou. Amarelo em 80% é opinião disfarçada de aviso, e só
  entra se existir uma ação diferente a tomar em 80%.
- Percentual formatado com `Intl.NumberFormat` em `style: 'percent'`, uma casa.

Erro clássico: barra cheia ao lado de "274,6% utilizado".

## Tile de métrica

Número herói com contexto. Um por card, no máximo.

Anatomia: rótulo · valor (`text-3xl font-semibold tabular-nums`) ·
qualificador (a linha que dá a régua) · evidência opcional (sparkline ou barra
fina).

Regras próprias:

- Um tile por superfície carrega peso; dois tiles do mesmo peso viram nenhum.
- Zero não renderiza tile: renderiza estado vazio de uma linha.
- Sem o qualificador, não é tile, é número solto.

## Sparkline

Tendência sem eixo, dentro de uma linha de texto ou ao lado de um tile.

Anatomia: valor ao lado, e a linha como evidência. Sem eixo, sem grade, sem
tooltip, sem legenda.

Regras próprias:

- Menos de 4 pontos não é tendência: mostre o delta em número.
- Sem eixo, a escala é desconhecida, então a sparkline **não pode** ser a única
  fonte de um número; ela acompanha um valor escrito.
- Altura fixa (24 a 40px) e `preserveAspectRatio` livre.

## Badge de variação

O delta contra o período anterior.

Anatomia: valor (o delta, com sinal) · qualificador (contra o quê, sempre
escrito: "vs. jul").

Regras próprias:

- Sem base não existe delta: base zero é `null`, não "+100%".
- Ícone de direção mais número; nunca só cor, nunca só ícone.
- Delta de estoque contra delta de fluxo são coisas diferentes. Estoque (fila,
  saldo, pipeline) não leva filtro de data.

## Gauge de razão

Arco de uma razão fechada (parte de um todo conhecido). Use quando o todo é o
argumento; se o todo não importa, é um tile.

Regras próprias:

- Só para razão entre 0 e 1. Passou de 1, vira medidor de limite.
- O número vive no centro; o arco é evidência, nunca o único portador.
- Meio arco (180°) lê melhor que anel completo em card baixo.

## Faixa de regime

Escala segmentada que mostra em qual faixa um valor caiu (imposto, plano, nível).
É o elemento que transforma "qual regime" de conta em leitura.

Anatomia: rótulo · valor (a faixa atual, por nome) · qualificador (os cortes em
número) · evidência (trilha segmentada com o valor marcado).

Regras próprias:

- Os cortes aparecem como número na trilha, não só como mudança de cor.
- A faixa atual ganha o nome escrito. Cor sozinha obriga a decorar a legenda.
- Faixa indisponível (regime que o valor já excluiu) fica visível e marcada como
  indisponível. Esconder o que foi perdido apaga a explicação.

## Linha de veredito

Uma linha acima de um grupo de cards que diz o que os cards juntos significam.
Existe para quando a tela entrega dois totais e o usuário estava fazendo a
comparação de cabeça.

Anatomia: valor (a conclusão) · qualificador (a evidência resumida) · sem
evidência gráfica própria.

Regras próprias:

- Uma frase, um número, nenhuma cor a não ser que haja exceção real.
- Se a conclusão depende de um dado que não está na tela, a linha diz isso em vez
  de concluir errado.
- Veredito é afirmação. Se o cálculo é hipótese, a linha usa a palavra.
