# Animação inteligente

Inteligente quer dizer escolhida pela **variável que ela dirige**. O SSoT de
easing e duração é o `visant-motion` (`lib/motion.ts`, tokens `--ease-*` e
`--dur-*`); aqui fica só a decisão de **o que** animar num elemento de dado.

A regra que gera as outras: **anima o que carrega a decisão, na hora em que a
decisão muda.** Todo o resto é enfeite com custo de atenção, e atenção gasta em
enfeite é atenção que não foi para o número.

## Tabela de decisão

| Situação | Anima? | Como |
|---|---|---|
| valor que o usuário produz com a mão (arrastando slider) | **não** | segue o dedo. Animar é latência com boa aparência |
| total recalculado depois que o usuário soltou | sim, uma vez | contagem curta até o novo número, `DUR.base`, `EASE_OUT` |
| cruzar um limite ou mudar de faixa | sim | a mudança de estado da faixa **é** a animação; sem brilho, sem pulso no card |
| entrada do gráfico na primeira montagem | sim, curta | `dataviz` chama de reveal: 200 a 300ms, uma vez, e nunca a cada re-render |
| entrada de valor que o usuário já leu na tela anterior | **não** | animar de novo diz "isto mudou" quando nada mudou |
| skeleton virando valor | não | é troca de conteúdo. Sem cross-fade, sem escala |
| linha nova numa lista que o usuário acabou de criar | sim | ela é a confirmação da ação |
| barra de razão mudando de valor | sim | só `transform`, e o primitivo já transiciona |
| número que tica a cada segundo | **não** | e o valor vive em contexto próprio, senão a página re-renderiza por segundo |
| hover em ponto ou barra de gráfico | sim | só cor e opacidade, `ease`, 100 a 150ms |

## Contagem de número, quando entra

Contar até o número é a animação mais pedida e a mais fácil de errar. Ela só se
justifica quando o número **mudou por consequência de uma ação do usuário** e a
mudança é a informação. Nunca no carregamento inicial, nunca em número que tica,
nunca em mais de um número ao mesmo tempo na mesma tela (dois contadores
simultâneos viram cassino).

Duração curta, `DUR.base` no máximo, `EASE_OUT`, `tabular-nums` obrigatório senão
a largura pula a cada quadro. Com `prefers-reduced-motion`, o número aparece no
valor final: zera a animação, nunca o resultado.

## O que nunca

- `transition-all`, `ease-in` em UI, `animate-bounce`, `scale(0)`.
- Animar `width`, `height`, `margin` ou `padding`. Só `transform` e `opacity`.
- `@keyframes` para estado interrompível: reinicia do zero no meio do gesto.
- Stagger em número. Cascata é para lista, e curta.
- Animação de saída rodando atrás de um modal aberto: fecha a superfície primeiro,
  o fechamento **é** a saída com peso.

## Ligação com o revenue-centric

A hierarquia de atenção decide o que é saliente, e movimento é o canal mais
saliente que existe numa tela parada: ele ganha da cor e do tamanho. Por isso
movimento segue a mesma regra do vermelho, e é mais estrita: se tudo se move,
nada é evento, e o usuário aprende a ignorar o único movimento que importava.

Antes de animar, a pergunta é a do *cut test*, com uma palavra trocada: **qual
variável de negócio esse movimento move?** Dirigir o olho para o número que decide
move qualidade de decisão. Celebrar uma ação concluída move retenção. Enfeitar a
entrada de um card não move nada, e ainda gasta o canal.
