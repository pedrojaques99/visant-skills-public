# Placar e relatório

## A nota

100 pontos, em três faixas. Portão vale zero ou tudo; julgamento e interrogatório
valem por item respondido com evidência.

| Faixa | Peso | Como pontua |
|---|---|---|
| **Portão** (impeccable, audit:design, copy) | 20 | tudo ou nada. Qualquer erro no alvo derruba os 20. Portão pulado pontua 0 e vai escrito. |
| **Julgamento** (visant-frontend, visant-motion, visant-copy, slop-catalog) | 40 | 40 menos 4 por item confirmado do catálogo de slop que sobreviveu sem conserto e sem justificativa aceita pelo usuário. |
| **Interrogatório** (advogado do diabo) | 40 | proporcional às perguntas do tier respondidas com `arquivo:linha`, mais o bloco fixo F1 a F6. Pergunta respondida com adjetivo em vez de evidência não conta. |

**Por que o portão vale pouco.** Na primeira rodada real da skill (cards fiscais,
2026-08-03) `impeccable` e `audit:design` deram **zero antes e zero depois** do
refactor: os 12 itens de slop, todos, foram pegos por julgamento. O portão tem
poder de veto e quase nenhum poder de discriminação, e uma nota que premia o que
não discrimina ensina a rodar o script e declarar 88. Ele continua sendo
eliminatório, e passou a valer o que mediu.

Leitura da nota:

- **abaixo de 70** — não vai pra PR. Tem defeito de portão ou slop confirmado sem conserto.
- **70 a 89** — vai pra PR com pendência listada e dona nomeada.
- **90 ou mais** — passou. Ainda pode ter decisão de produto pendente, e ela vai no topo do relatório, não no fim.

Nota alta com verificação faltando **não é nota alta**. O que não rodou entra como
desconto explícito, com o motivo.

## Template do relatório

Arquivo em `docs/audits/killer-<alvo>-<AAAA-MM-DD>.md`, ou onde o repo já guarda
auditoria. A nota e a decisão pendente vêm antes de qualquer detalhe: quem lê o
relatório está decidindo, não estudando.

```markdown
# Killer: <alvo>

**Tier** T2 rota · **Nota** 86/100 · **Veredito** vai pra PR com pendência
**Superfície** B trabalho (throughput e qualidade de decisão)

## Decisão pendente (do usuário, não minha)

1. <a pergunta que muda escopo, com a minha recomendação primeiro>

## Portão

| Detector | Antes | Depois |
|---|---|---|
| impeccable | 3 errors | 0 |
| audit:design | 2 errors | 0 |
| copy (vício) | 4 | 0 |
| tsc | pass | pass |
| 390px | +215px | 0 |

Pulado: <nenhum, ou o que foi e por quê>

## Slop consertado

| # | Catálogo | Onde | Conserto |
|---|---|---|---|
| 1 | Card arco-íris | Card.tsx:66-160 | cor virou exceção; menos tipográfico marca saída |

## Slop mantido de propósito

| Catálogo | Onde | Por que fica |
|---|---|---|

## Interrogatório

Q5 <pergunta>
   <resposta com arquivo:linha>
   OBRIGA: <o que muda, ou "nada">

### Bloco fixo

F1 reuso · F2 design system · F3 responsivo e performance · F4 fluxo para o ICP
F5 esconder ou virar ícone · F6 o que falta para o nível Vale do Silício

## O que a rodada consertou nos detectores

Seção obrigatória, mesmo vazia. Toda auditoria em código que você não escreveu
encontra ruído de detector, e ruído não reportado volta como desconfiança no
portão. Falso positivo consertado entra aqui com o caso que foi travado no
fixture; falso negativo também, e esse é o grave.

| Regra | Era acusado | Conserto | Caso no fixture |
|---|---|---|---|

## Proposta de gosto (o usuário escolhe linha por linha)

| Chave | Antes | Depois |
|---|---|---|

## Não verificado

- <o que não rodou, e o que precisaria para rodar>
```

## Regras do relatório

- **Antes e depois de texto, sempre o texto.** O usuário aprova copy lendo copy,
  nunca lendo resumo de copy.
- **Proposta de gosto separada do conserto.** Misturar as duas obriga o usuário a
  revisar o revisor.
- **Nada de "melhorei a hierarquia".** Diga qual elemento subiu, qual caiu, e a
  variável que isso move.
- **"Não verificado" nunca fica vazio por preguiça.** Se estiver vazio de verdade,
  escreva o que foi rodado para provar.
