---
name: visant-copy
description: 'Escreve e revisa toda copy voltada ao público da Visant na voz falada brasileira da casa, e opera copy:lint / copy:build / copy.json. Use em "copy", "headline", "texto da landing", "reescrever a dobra", "essa copy tá confusa", "tirar cara de IA", "burilar a copy", em título e description de SEO, no card social, e em auditoria de travessão e emoji.'
---

# Visant Copy

Duas coisas moram aqui: **como a copy Visant soa** e **como ela é operada**. No
visantismo o SSoT é `copy.json` e o HTML é view gerada, então nunca edite texto
direto no `.html`. Nos outros repos a copy mora no componente e o cuidado é
outro, o eco: a mesma frase em quatro arquivos. Em qualquer um dos dois, nunca
escreva copy Visant sem passar pelas proibições abaixo.

## Regra zero: propor, nunca aplicar

**Só entra no arquivo o conserto de vício que o linter aponta.** Headline, lead
ou frase que passa limpo fica intocada, mesmo se você achar que soa flat.

Melhoria de estilo vai como **tabela de propostas no relatório** (chave, antes,
depois), e o usuário escolhe linha por linha. Reescrever o que já estava bom
queima confiança e faz o usuário ter que revisar o revisor.

**A exceção é o pedido explícito.** "Essa copy tá confusa, tem que ser na pegada
X" é ordem de serviço, não convite pra debate: aplica, mostra a tabela
antes/depois, e deixa **uma ou duas alternativas de UMA linha** no fim, pra troca
custar um Edit e não uma rodada nova. Devolver só opção quando o usuário já disse
a direção empurra o trabalho de volta pra ele.

## As proibições

Absolutas. Valem em headline, corpo, CTA, FAQ, e-mail, legenda, alt text,
mensagem de erro, meta description. Sem exceção "porque nesse caso ficou bom".

1. **Travessão (— ou –) nunca.** Ponto, vírgula, dois-pontos ou parênteses.
2. **Bolinha separadora (`·`, o alt+7) nunca.** Nem em lista de metadado, nem em
   CTA com preço, nem em rótulo de fase, nem no card social. Em lista vira ponto
   e vírgula ("34 páginas. 9 etapas, 1 case inteiro"), em rótulo vira dois-pontos
   ("Fase 1: A Estratégia"), em CTA vira preposição ("Quero o e-book por R$ 47").
3. **"Não é X, é Y" nunca.** Nem partido em duas frases ("Não é uma lista. É uma
   cascata."). Nem a frase que define pela negativa ("Não é slogan.").
4. **"É sobre X" nunca.** Não afirma nada. Troque pelo verbo do que a coisa faz.
5. **"Não é apenas X, é X e Y" nunca.** Nem "mais que apenas", "menos X e mais
   Y", "não se trata de".
6. **Negação pendurada no fim nunca.** "Feito pra ler, não pra arquivar." Apaga
   o rabo e a frase fica mais forte.
7. **Emoji nunca. Ponto-e-vírgula nunca.** (`©`, `®`, `™` são marca e ficam.)
8. **Abertura de guru nunca.** "Imagine que", "E se eu te dissesse", "Prepare-se
   pra", "Chegou a hora de". Comece pelo fato ou pela cena.
9. **Urgência clichê nunca.** "Últimas vagas", "corre que acaba", "por tempo
   limitado". A escassez do Club é contável: diga o número ("este lote tem 30
   vagas", "a cota sobe a cada compra").
10. **Selo de credibilidade no máximo uma vez por página.** "real", "de
    verdade", "na prática", "de fato", "genuíno", "autêntico". Uma passa. Duas
    o leitor conta e posta print ("trajetória real, projeto real, técnica real,
    processo real"). Adjetivo não prova; número e cena provam. `Sete anos de
    projeto real` → `Sete anos entregando marca`.

**A regra que resolve de 3 a 6: corte a metade negativa.** A frase que sobra é
quase sempre a certa. Se o contraste é mesmo o argumento, mostre a
**consequência** em vez de negar: em vez de "não é falta de talento, é falta de
ordem", escreva "Talento você já tem. O que falta é ordem."

Rodar o linter é obrigatório antes de entregar copy:

```bash
npm run copy:lint                                    # dentro do visantismo
node ~/.claude/skills/visant-copy/scripts/copy-lint.mjs copy.json  # em outro repo
node ~/.claude/skills/visant-copy/scripts/copy-lint.mjs hero.tsx page.tsx og.tsx
```

Exit 1 com a chave, o trecho e o conserto. Dois avisos saem **fora do exit
code**, porque copy boa não pode reprovar por detalhe:

- **tamanho por tipo de linha** (headline 60, CTA 28, lead 180, corpo 280, SEO
  title 60, meta description 160), pra flagrar a headline que quebra em três
  linhas no mobile;
- **eco**, quando a mesma frase mora em dois dos arquivos passados na mesma
  chamada. Por isso **passe os arquivos juntos**, nunca um por vez.

Em arquivo de código, **comentário não é lintado**. É proposital: JSDoc que
explica decisão de design pro próximo dev não é copy, e apontar vício ali treina
a pessoa a ignorar o linter. `--include-comments` volta atrás quando você quer
auditar a prosa interna.

### Orçamento de repetição é por PEÇA, e o arquivo nem sempre é a peça

O `selo-de-credibilidade` tem limite 1, e o limite é de uma página. Rodado no
`pt-BR.json` do visantlabs-os — **5173 chaves, dezenas de telas independentes** —
ele acusava 11 ocorrências como se fossem a mesma peça. Regra que grita 11 vezes
ensina a pessoa a ignorar o linter, que é pior que não ter a regra.

Duas correções, e as duas valem como princípio pra qualquer regra de repetição:

- **em JSON o grupo é o primeiro segmento da chave** (`onboarding.*`,
  `mockup.*`), o mais perto de "uma peça" que a estrutura oferece. Em componente
  segue por arquivo, que já É a peça;
- **moeda não é selo.** Em produto brasileiro "real"/"reais" é dinheiro antes de
  ser retórica: `R$ 47`, "Real brasileiro", "1200 reais". Unidade que fala de
  dinheiro sai da conta.

Depois disso o mesmo arquivo devolve três grupos de 2 e 3 ocorrências, cada um
inspecionável, em vez de um bloco de 11 que ninguém lê. O resíduo é semântico e
regex não resolve: "produtos reais" e "projeto real" têm a mesma forma e
significados opostos. Confirme no `arquivo:linha` antes de mexer, sempre.

## A voz

Padrão vindo da landing do e-book (`copy.ebook.json`). Em ordem de importância:

1. **Brasileiro falado, dose média.** "pra", "a gente", "tá". Sem "cê", "mano",
   "tá ligado". Imperativo curto: "Lê e julga", "Observa uma coisa".
2. **Frase curta atrás de frase curta.** Média de 12 palavras. **Fragmento sem
   verbo é recurso**, sempre como golpe depois da frase longa: "…e a marca se
   comporta de outro jeito três meses depois. Toda vez."
3. **Cena no lugar de adjetivo.** Nunca "inconsistência de marca". Escreva o que
   se vê: "Um post fala uma coisa, o atendimento fala outra, o site parece de
   outra empresa."
4. **A culpa começa no autor.** Confessa antes de cobrar: "A gente começava pelo
   logo também. Perdeu semanas assim, até inverter a ordem." Acusar o leitor
   direto ("você começa pelo logo porque é a parte divertida") só depois da
   confissão, se depois.
5. **Número cru, sem arredondar pra impressionar.** `R$450k`, `160+ lives`,
   `34 páginas`, `7 dias`.
6. **Admite limite.** "Se algo não funcionou pra gente, tá escrito que não
   funcionou." É o que mais separa a voz de um texto de IA.
7. **Humor por deboche do mercado**, seco e sem sinalização: "Sem aula de 40
   horas ensinando a centralizar retângulo." Alveja a prática, nunca a pessoa.
8. **Palavrão leve, no máximo um por página**, e só onde o argumento dói:
   "porcaria", "cagada". Nunca no CTA nem na headline principal.
9. **Objeção na voz do leitor.** FAQ é o que a pessoa pensa, com as palavras
   dela: "Já faço branding há anos. Vou ver algo novo?". A resposta abre
   respondendo ("Serve.", "É."), nunca com "Ótima pergunta".

Detalhe linha a linha, vocabulário, anglicismo, dinheiro, CTA, glossário de
marca e a tabela antes/depois: `references/voz.md`. Leia antes de escrever peça
nova ou reescrever seção inteira.

### A dobra nomeia a TAREFA, não o estado

Vale pra H1, para o `<title>` e pro card social, e é o erro mais caro porque
passa em todo linter.

Copy de estado descreve o mundo do leitor e deixa ele montando sozinho o que
ganha: "Você tem centenas de mockups parados no disco." Está certa, é dor
verdadeira, e não pede nada. Copy de tarefa nomeia o verbo que a pessoa foi ali
fazer: "Ache o mockup certo sem abrir um PSD."

O teste é uma pergunta: **qual verbo o leitor digitaria no Google?** Se a
headline não tem esse verbo, ela fala do estado. E cuidado com a tarefa errada:
antes de escrever, confira qual etapa realmente dói. Naquela LP o produto
vendia o render, mas o tempo do designer ia embora em **achar** o arquivo, então
o render desceu pro corpo, como consequência de já ter achado.

Quando a dor precisa aparecer (e às vezes precisa), ela vai na **seção seguinte**,
abrindo o mecanismo. Na dobra você tem 5 segundos e gastar os cinco descrevendo o
problema é gastar a vez.

## Glossário de marca (SSoT de termos)

| termo | o que é | onde usa |
|---|---|---|
| **Visionário®** | plano vitalício, pagamento único | tier, CTA, FAQ, subtítulo de planos |
| **Visantista** | assinante mensal, e o gentílico da comunidade | plano mensal, comunidade |
| **Visantismo** | o movimento e a marca da landing | logo, nav, footer |
| **Visant** | a agência / empresa | corpo de texto, autoria |
| ~~Fundador~~ | **aposentado.** Era sinônimo solto de Visionário e criava duas marcas pro mesmo plano | não usar |

`js/ratchet.js` ainda escreve "Fundador nº X" em runtime no hero. Se for mexer
nele, unifique pra Visionário.

## O pipeline (SSoT)

**Copy vive no JSON. HTML e Markdown são views geradas.** Editar texto no `.html`
é sempre erro: o próximo build sobrescreve e o check quebra o deploy.

```bash
npm run copy:lint    # vícios de linguagem (fora do gate, roda à mão)
npm run copy:build   # injeta o json nos HTMLs e regera os docs/COPY*.md
npm run copy:check   # exit 1 se qualquer view divergir (está no npm run check)
```

Fluxo: editar o JSON, `copy:lint`, `copy:build`, commitar json + html + md juntos.

**SEO mora no SSoT também.** `meta.title`, `meta.description`, `meta.og_title`,
`meta.og_description` e `meta.og_image_alt` são chaves como qualquer outra,
injetadas em atributo via `data-copy-attr="content"`. Antes viviam soltas no
`<head>` e drift(av)am em silêncio.

Mecânica completa (chave nova, página nova, `data-copy-attr`, `\n` virando
`<br>`, erro de chave órfã, montar em repo novo): `references/pipeline.md`.

## Quando não existe `copy.json` (LP em React)

Fora do visantismo, a copy costuma morar dentro do componente e **o componente é
o SSoT**. Não monte um `copy.json` no meio de uma tarefa de texto: virar a
arquitetura do repo é decisão de outro momento, e o usuário pediu copy.

O risco muda de forma. Não tem build pra sincronizar view, então a mesma frase
existe copiada em três a quatro lugares, e trocar só o `<h1>` deixa o resto
vendendo a promessa do mês passado. **Depois de mudar a headline, procure os
ecos** (foi assim que o card social e o `<title>` apareceram):

```bash
rg -n "trecho da frase antiga" src   # e repita com 4 ou 5 palavras do meio
```

Onde eles se escondem, em ordem de esquecimento:

| lugar | arquivo típico |
|---|---|
| `<h1>` e lead | `components/**/hero.tsx` |
| card de link | `app/**/opengraph-image.tsx`, e o `alt` exportado nele |
| `<title>` e description | `app/**/page.tsx` (e o `twitter`/`openGraph` do mesmo objeto) |
| `alt` de print e `figcaption` | o mesmo hero |
| seção que repete o argumento | `components/**/` da mesma pasta |

Fecha com `npx tsc --noEmit`: string em JSX é código, e vírgula perdida numa
reescrita quebra o build, não o texto.

O `<title>` é o único que troca de voz: ele responde a busca, então carrega o
substantivo que a pessoa procura ("mockups"), enquanto o `<h1>` carrega o verbo.

## Ordem de trabalho ao receber "revisa/escreve a copy"

1. Ler o JSON inteiro da página (ou o componente inteiro) antes de tocar em
   qualquer chave. Inclui os comentários: eles guardam o PORQUÊ da linha atual, e
   copy que contraria a decisão documentada ali é retrabalho.
2. Rodar `copy:lint` pra ter o mapa dos vícios.
3. **Aplicar só os consertos de vício**, e a reescrita que o usuário pediu com
   direção. Todo o resto vira proposta em tabela.
4. Conferir cada número contra a fonte de verdade (preço no servidor via
   `price:check`, nº de lives, nº de membros). A skill não guarda esses valores
   de propósito: eles envelhecem. Na dúvida, pergunte antes de publicar.
5. **Caçar o eco** da frase antiga (`rg`, ou o aviso de eco do linter passando os
   arquivos juntos) e atualizar card social, `<title>`, description e `alt`.
6. Se mexeu em comentário de código, atualizar o que ele explica: comentário que
   defende a copy velha mente pro próximo dev.
7. Rodar `copy:lint`, `copy:build` e `copy:check` de novo. Em repo React, o
   `tsc --noEmit`.
8. Reportar o antes/depois das linhas mudadas. O usuário aprova texto lendo
   texto, nunca lendo resumo do texto.
