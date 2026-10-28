---
name: visant-preflight
description: 'Pré-voo de projeto grande de cliente: rodada de perguntas ao dono do trabalho + cinco checagens de premissa (vault × Drive, fonte carregável, resolução de foto, arquivos de marca, número com fonte). Use ANTES de "criar site", "redesenhar", "nova proposta", "montar campanha", "hidratar a marca" — sempre que errar a premissa custaria mais de um dia.'
---

# Visant Pré-voo

Esta skill existe porque a casa erra sempre no mesmo lugar: **não na execução,
na premissa.** O trabalho sai bem-feito em cima de um dado que estava errado
desde o começo, e o retrabalho custa dias.

> **Nada de grande porte começa sem duas coisas: a rodada de perguntas
> respondida, e as cinco checagens verdes ou explicitamente dispensadas.**

O pré-voo inteiro leva 15 minutos. Cada um dos erros que ele previne já custou
mais de um dia.

## Quando rodar

Rode quando a tarefa for **grande o bastante para doer**: site novo, redesenho,
proposta com mockup, campanha, hidratação de marca, migração. Se for ajuste
pontual em coisa que já existe, não rode — pré-voo em tarefa pequena é
burocracia e você vai (com razão) parar de rodar.

Sinal prático: se você vai produzir mais de meio dia de trabalho antes do
primeiro retorno do cliente, rode.

---

## Parte 1 — A rodada de perguntas

**Esta parte não é opcional e não é automatizável.** É a que mais faltava.

Antes de desenhar qualquer coisa, faça as perguntas abaixo **ao dono do
trabalho** e escreva as respostas. Não presuma nenhuma. Se ele responder "tanto
faz", escreva "tanto faz" — isso também é resposta e vira liberdade explícita
em vez de aposta silenciosa.

Use a ferramenta de pergunta do harness quando houver escolha fechada; use
conversa quando for aberta. **Faça em UMA rodada**, não em conta-gotas ao longo
do trabalho.

### 1.1 A aposta

- **Qual é a única frase que este trabalho precisa provar?** Se não couber numa
  frase, o escopo ainda não está fechado.
- **Qual variável de negócio ele move?** Conversão, retenção, ticket, custo por
  reunião. Se não move nenhuma, é decoração — e decoração custa atenção.
- **Quem é a pessoa do outro lado, e em que estágio de consciência ela chega?**
  (Schwartz — ver `revenue-centric-design`.) Headline fala no estágio atual;
  prova empurra um estágio adiante.
- **O que NÃO é para fazer?** A pergunta que mais economiza tempo e a que
  ninguém faz.

### 1.2 A referência e o gosto

- **Existe algo que o cliente já aprovou** — layout, peça, campanha — que eu
  devo herdar em vez de reinventar? *(Regra da casa: minerar antes de desenhar.)*
- **Tem alguma coisa que ele odeia?** Vale mais que dez referências que ele ama.
- **Quantas alternativas ele quer ver?** Uma redonda ou três apostas distintas.
  São trabalhos diferentes; combinar antes evita entregar o formato errado.

### 1.3 O que trava a publicação

- **O que ainda depende de terceiro?** Copy, foto, número, jurídico, domínio.
- **Qual desses é caminho crítico?** Ele define a ordem do trabalho: comece pelo
  que não depende de ninguém.
- **Existe restrição regulatória?** (OAB, ANVISA, CVM, LGPD.) Descobrir isso
  depois do layout pronto significa refazer o layout.

### 1.4 O acordo de pronto

- **Onde isso vai ser visto?** Link publicado, PDF, Figma, call. Muda tudo.
- **Vai ao ar ou é proposta?** Se é proposta, `noindex` e nada de dado real
  sensível.
- **Quando é a conversa de retorno?** Define profundidade.

> **Saída obrigatória da Parte 1:** as respostas escritas no `.md` do projeto,
> antes da primeira linha de código ou do primeiro frame. Resposta que ficou só
> na conversa vira suposição na semana seguinte.

---

## Parte 2 — As cinco checagens

As duas primeiras são automáticas:

```bash
node ~/.claude/skills/visant-preflight/scripts/preflight-scan.mjs \
  --assets "H:/Meu Drive/Clientes/<Marca>" \
  --fonts "Familia Display,Familia Corpo" \
  --report PREVOO.md
```

`--strict` faz reprovar com exit 1. `--self-test` valida o próprio script.

### 1. Vault × fonte de verdade — eles concordam?

O vault do Visant **não é a verdade, é uma cópia** — e cópia envelhece. Cruze
com a pasta da marca no Drive e com o arquivo do Figma.

Confira nesta ordem: **tipografia, cores, logo, tagline.**

Para auditar e reconciliar de fato, carregue a **[[visant-brand-sync]]**.

> **Caso real (cliente K).** O vault dizia *Termina*, licença paga que a marca
> nunca teve; a pasta entregue ao cliente tinha **Syncopate + Funnel Sans**.
> Ninguém cruzou, e o site shipou **três tipografias erradas em meses**.
> [Versão longa](references/casos.md#1-vault--drive--cliente-k-agosto-de-2026).

### 2. As fontes carregam?

Automático no script. Família que não está no Google Fonts não é
necessariamente erro — face paga e licenciada é decisão legítima. O que não pode
é **sumir em silêncio**: ou você tem o arquivo e carrega via `next/font/local` /
`@font-face`, ou troca a família.

Sintoma que denuncia: o layout "está certo" mas o site parece de outra marca.

> O motor de tokens já checa isso na origem: `@visant/brand-tokens` emite
> `@import` do que dá para carregar e **declara** no topo do CSS o que não dá
> (`packages/brand-tokens/src/fonts.js`). Se o projeto consome tokens, o aviso
> chega junto.

### 3. A fotografia aguenta o layout?

Automático no script. Ele lista **toda** imagem com resolução e o papel que ela
suporta, e diz explicitamente o que pulou.

| Papel | Largura mínima do arquivo |
|---|---|
| Faixa full-bleed | 2000px |
| Retrato de herói | 1000px |
| Célula de grade | 700px |
| Thumb | 400px |

**Escolha a fonte pela resolução ANTES de decidir o enquadramento**, nunca o
contrário. Ampliação aparece, e nenhuma escolha de layout compensa arquivo
pequeno.

> **Caso real.** Faixa full-bleed desenhada antes de olhar a origem: 646px
> esticados na largura da tela. E a varredura que "provou" não existir foto em
> alta filtrava por dimensão e escondeu uma pasta com originais de 4562px — o
> laudo estava errado e virou decisão de layout.
> [Versão longa](references/casos.md#2-resolução-de-foto--mesma-sessão).
>
> Daí a regra do script: **nunca filtrar em silêncio.** Varredura que esconde é
> pior que varredura que não roda, porque produz confiança falsa.

### 4. Os arquivos de marca existem de verdade?

Logo em **vetor** (SVG/PDF), não PNG de apresentação. Variantes claro/escuro.
Ícone quadrado para favicon. Grafismos próprios.

Se não existir, **não redesenhe a marca**: peça. Logo redesenhado por
aproximação é a falha mais cara e mais difícil de reverter.

### 5. Todo número tem fonte?

Cada dado que vai ao ar precisa de origem anotada ao lado, no arquivo de
conteúdo. Número extraído de layout **não é fonte primária** — sobe marcado como
pendente ou não sobe.

> Número que não se sustenta não é prova, é passivo. E na hora que o cliente
> perguntar de onde veio, a resposta precisa viajar junto com o dado, não na
> memória de quem montou.

---

---

## Parte 3 — Cicatrizes: não reintroduza o bug que você já matou

Correção de defeito visual **mora no código como comentário no ponto do
conserto**, com o porquê. E existe um jeito específico de perdê-la:
**reescrever o arquivo inteiro.**

> **Caso real, na mesma sessão.** Um campo decorativo `absolute` atravessava a
> faixa de números. Corrigido, com comentário. Duas horas depois o arquivo foi
> reescrito por outro motivo e o mesmo bug voltou — a reescrita partiu da
> intenção nova, não do arquivo velho.
> [Versão longa](references/casos.md#4-a-cicatriz-que-reabriu).

Duas regras, e elas são baratas:

1. **Antes de reescrever um arquivo por completo, leia-o e liste os comentários
   defensivos** — os que começam com "bg opaco é obrigatório", "medido em
   navegador", "não trocar por", "sem isso o X quebra". Carregue cada um para a
   versão nova, ou justifique por escrito por que deixou de valer.
2. **Toda correção achada no navegador vira uma linha na seção Cicatrizes** do
   `.md` do projeto. É o que sobrevive à reescrita e à troca de quem está
   tocando o trabalho.

```markdown
## Cicatrizes
- Campo de barras é do herói: a faixa de prova precisa de `bg` opaco, senão a
  decoração atravessa o número. (medido, 13/08)
- Nav claro sobre campo de Equilíbrio some. Nav de duas cores → só marca + ação.
- Foto: escolher a fonte pela resolução ANTES do enquadramento.
```

**Por que não virou detector automático.** Foi avaliado e recusado: a regra
line-based não distingue o caso real de dezenas de bordas legítimas. O próprio
`refine-scan` avisa — *detector que grita fora do escopo é detector que a pessoa
desliga*. Cicatriz escrita custa uma linha e não gera falso positivo.

---

## O relatório

O pré-voo termina num bloco no `.md` do projeto:

```markdown
## Pré-voo — <data>

**A aposta:** <a frase única>
**Variável:** <o que move>
**Não é para fazer:** <o que ficou fora>
**Formato de entrega:** <link / proposta / PDF> · retorno em <quando>

| Checagem | Situação |
|---|---|
| Vault × Drive | ✅ / ⚠ <o que divergiu> |
| Fontes carregáveis | ✅ / ⚠ <família e plano> |
| Resolução de foto | ✅ teto <N>px / ⚠ <o que não dá para fazer> |
| Arquivos de marca | ✅ / ⚠ <o que falta> |
| Números com fonte | ✅ / ⚠ <o que está pendente> |

**Caminho crítico:** <o que trava a publicação e de quem depende>
```

Um ⚠ não impede começar. Impede **fingir que não existe** — e define a ordem do
trabalho: tudo que não depende do item travado vai primeiro.

---

## Regra de ouro

> **Toda checagem deste pré-voo nasceu de um erro que já aconteceu.**

Se você inventar uma sexta, ela só entra aqui depois de custar um dia a alguém.
E se uma das cinco parar de pegar erro por um ano inteiro, tire — checklist que
nunca acusa nada treina a pessoa a assinar sem ler.

## Vizinhança

- **[[visant-brand-sync]]** — reconciliar o vault quando o pré-voo achar divergência
- **[[visant-new-site]]** — o fluxo de site de cliente, que começa por este pré-voo
- **[[revenue-centric-design]]** — estágio de consciência, ICP, prova
- **[[visant-frontend]]** — classificar a superfície depois que o pré-voo passou
- **[[visant-killer]]** — o portão de saída, no fim; este é o de entrada
