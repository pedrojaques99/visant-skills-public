# Advogado do diabo

Banco de perguntas para o Passo 4. Não é checklist de UI: é interrogatório de
conceito. Pergunta boa aqui apaga trabalho de pixel que nunca precisou existir.

**Como usar:** T1 usa as 5 marcadas `[T1]`. T2 usa as 12 marcadas `[T1]` e `[T2]`.
T3 usa todas. O **bloco fixo** (seção 7, F1 a F6) roda em todo tier, sem exceção:
são as seis perguntas que o usuário faz de qualquer jeito, então chegar sem elas
respondidas é chegar incompleto. Responda cada uma **você**, com `arquivo:linha`,
antes de subir qualquer coisa pro usuário.

Índice:
- [1. Existência](#1-existência)
- [2. Decisão](#2-decisão)
- [3. Verdade do dado](#3-verdade-do-dado)
- [4. Hierarquia de atenção](#4-hierarquia-de-atenção)
- [5. Produto, escopo e posicionamento](#5-produto-escopo-e-posicionamento)
- [6. Custo e futuro](#6-custo-e-futuro)
- [7. Bloco fixo: as cinco de casa](#7-bloco-fixo-as-cinco-de-casa)
- [Como reportar a resposta](#como-reportar-a-resposta)

---

## 1. Existência

**Q1 `[T1]` Se eu apagasse isto hoje, quem reclama em 48 horas, e o que essa
pessoa faz no lugar?**
Resposta "ninguém" mata o elemento na hora. Resposta "ela abre a planilha" é pior
que "ninguém": a tela perdeu de uma planilha e ainda custa manutenção.

**Q2 `[T1]` Este elemento existe porque alguém precisa dele, ou porque o dado
estava disponível?**
O vício central de painel administrativo. Dado disponível é matéria-prima, não
motivo. Se a origem foi disponibilidade, o elemento vira linha de log, não card.

**Q3 `[T2]` Qual é a versão disto que caberia numa frase de texto? Por que a tela
é melhor que a frase?**
Se a frase entrega o mesmo, a tela é decoração com custo de render. Se a tela é
melhor, o motivo é comparação, ordenação ou ação, e esse motivo tem que estar
visível no layout.

**Q4 `[T3]` Qual é o menor número de telas que entrega este resultado? Por que não
é esse número?**
Toda tela a mais é uma navegação que o usuário precisa aprender. Sem defesa
escrita, funde.

---

## 2. Decisão

**Q5 `[T1]` Qual decisão isto produz? Escreva a frase que o usuário diz em voz
alta depois de olhar.**
Se a frase for "ok", é relatório, não ferramenta. Ferramenta produz "então vou
fazer X".

**Q6 `[T1]` Qual é o número que decide, e ele é o elemento de maior peso? Se não
é, por quê?**
Mecanismo: **hierarquia de atenção** (RCD). O usuário usa o que é mais saliente,
que raramente é o que retém. Peso é contextual: o mesmo dado pesa diferente numa
grade onde se escolhe e numa fila já ordenada onde se processa.

**Q7 `[T2]` Isto é a resposta, ou a matéria-prima da resposta?**
Se o usuário ainda precisa de calculadora, ou de olhar um segundo card, ou de
somar duas colunas com o dedo, o produto terminou metade do trabalho e chamou de
feature. A pergunta que segue é sempre a mesma: qual conta a interface deveria ter
feito no lugar dele.

**Q8 `[T2]` Qual default você escolheu pelo usuário aqui, e você defende esse
default por escrito?**
Mecanismo: **default é a decisão que você tomou pelo usuário** (RCD 6). Ordenação
inicial, filtro inicial, período inicial e plano pré-marcado são recomendação com
o seu nome. A regra do default tem que caber numa linha visível onde ele escolhe.

**Q9 `[T3]` Modele a jogada ótima do usuário aqui. Ela te paga?**
Produto onde a jogada ótima do usuário é receita zero tem cada regra funcionando e
o conjunto vazando.

**Q10 `[T3]` Onde está o limite que motiva o upgrade, e ele aparece no momento em
que o limite é atingido?**
Mecanismo: **expansão nasce do uso** (RCD 8), nunca de interrupção.

---

## 3. Verdade do dado

**Q11 `[T1]` Este número mente em qual cenário?**
Os quatro clássicos, todos já vistos em produção: fetch que falhou e pinta zero;
denominador zero virando "0,0%"; estoque (fila, saldo, pipeline) recebendo filtro
de data que só evento deveria receber; dois números da mesma unidade e de espécies
diferentes (orçado e realizado) lado a lado sem rótulo que diga qual é qual.

**Q12 `[T2]` Se o backend cair, isto mostra erro ou mostra zero?**
Zero silencioso é a mentira dominante, e ela costuma ser contada uma camada
abaixo: o serviço captura a falha e devolve payload vazio, então o estado de erro
da página fica inalcançável e o conserto parece pronto. Verifique **rodando com o
backend parado**.

**Q13 `[T2]` Que promessa isto faz que o banco não sustenta?**
Preço digitado em copy enquanto o valor cobrado vive no servidor; rótulo de status
que não é o status; contagem que exclui o que a lista inclui. Conserto não é
vigilância, é trava de build.

**Q14 `[T3]` Se a escrita otimista falhar, o que fica registrado?**
UI não pode mentir pro banco. Registrar ação que não aconteceu corrompe a métrica
pela qual o negócio se guia, e número falsificado não se otimiza.

**Q15 `[T3]` Papel ou propriedade? Quem vê isto é quem age aqui?**
Controle pessoal (preferência, "minhas horas", cronômetro) se libera por
propriedade do recurso, não por cargo. Admin olhando o quadro de outra pessoa não
pode ver ação pessoal renderizada no nome dela.

---

## 4. Hierarquia de atenção

**Q16 `[T2]` Quantos pixels verticais até o primeiro dado real?**
Cromo é orçamento. Gaste dentro do conteúdo e pague cortando cromo, nunca
conteúdo.

**Q17 `[T2]` Onde este elemento VAI FALTAR?**
Rode com o melhor registro e com o pior. Ausência é argumento: elemento que falta
exatamente nos seus melhores registros é pior que elemento nenhum. Vazio também
esconde todo estouro de layout, então medir sem dado real é medir nada.

**Q18 `[T2]` O que isto ensina o usuário a fazer errado?**
Cor em tudo ensina que cor não significa nada. Badge que 100% das linhas carregam
ensina a ignorar badge. Primário desabilitado ensina que o botão mente.

**Q19 `[T3]` Se esta tela é a única coisa que o cliente vê do produto, ele
renova?**
Retenção se constrói no interior, na tela que a pessoa encara todo dia. Teclado,
latência e ritmo são feature de retenção (RCD 7).

---

## 5. Produto, escopo e posicionamento

**Q20 `[T3]` Qual feature eu mato para abrir espaço cognitivo para esta?**
Mecanismo: **Swiss Knife Index** = features usadas por mais de 40% dos ativos em
30 dias, dividido por features totais. Abaixo de 0,3 o produto é canivete
desajeitado. Esconder resolve o que apagar não precisa resolver: manda o raro pro
avançado, alcançável pros 3% e sumido pros 97%.

**Q21 `[T3]` Quem é o ICP desta tela? Se a resposta é "a equipe", qual papel? Se
serve dois papéis, qual dos dois está sendo servido pior?**
Quem fala com todos não convence ninguém (RCD 2). Tela que serve dois papéis
costuma servir mal os dois e bem nenhum.

**Q22 `[T3]` Se o concorrente copiar isto pixel a pixel amanhã, o que sobra de
nosso?**
Igual compete por preço, diferente compete por categoria (RCD 5). O diferente
mora em mecanismo, narrativa ou experiência, e precisa ser nomeável em uma frase.

**Q23 `[T3]` A promessa é do tamanho da prova?**
O mercado acredita no que você demonstra (RCD 4). Prova que chega depois da
dúvida chega tarde.

**Q24 `[T3]` As quatro camadas dizem a mesma frase?**
Landing, onboarding, produto e preço. Desalinhamento aqui torna toda decisão de
design a jusante impossível de ganhar, e nenhum conserto de tela resolve.

**Q25 `[T3]` Este é um erro de categoria?**
A pergunta que mais muda preço na Visant: o objeto é a marca ou o site? A
prateleira errada define a régua errada e o valor errado. Vale para qualquer
entregável que o produto nomeia.

---

## 6. Custo e futuro

**Q26 `[T2]` Quem mantém isto em seis meses, e como essa pessoa descobre que
quebrou?**
Regra que só existe na cabeça de quem escreveu não é regra, é sorte. Defeito que é
padrão, e não valor, vira teste que varre a árvore por a forma proibida.

**Q27 `[T3]` Se eu cobrasse por isto, quanto? Se a resposta é "nada", quem paga a
manutenção eterna?**
Preço é filtro (RCD 9). Serve inclusive para tela interna: o que não vale nada
para ninguém é custo com aparência de feature.

**Q28 `[T3]` Qual decisão desta auditoria eu vou lamentar em três meses?**
Última pergunta, sempre. Escreva a resposta no relatório. Ela é a próxima rodada.

---

## 7. Bloco fixo: as seis de casa

Rodam em T1, T2 e T3. Cada uma exige uma busca ou uma medição, nunca uma opinião.

**F1 O quanto estamos reinventando a roda?**
Antes de qualquer construção, procurar: componente já existente no repo, item no
registry da Visant (`visant-registry`), primitivo oficial do shadcn ou do Radix,
lib validada. Custom é fallback, não default.
Como responder: liste o que foi **reusado** e o que foi **escrito novo**, e para
cada novo a busca que justificou. Duas implementações da mesma coisa em rotas
diferentes é dívida: extraia hook ou componente compartilhado, e o dono original
adota primeiro (comportamento inalterado), depois a superfície nova consome.
Sinal de alarme: utilitário de formatação, de data, de moeda ou de status escrito
dentro do componente.

**F2 Nosso design system está consistente?**
Token, não cor crua. Primitivo compartilhado, não cópia. Mesmo padrão de rótulo,
de régua, de raio e de espaçamento que o card vizinho da mesma rota.
Como responder: `npm run audit:design` no alvo em zero erro, mais uma comparação
lado a lado com o componente exemplar da mesma pasta (o que já passou por
revisão). Divergência achada vira ou conserto no alvo, ou proposta de mudança no
exemplar, nunca uma terceira variante.

**F3 Está tudo responsivo e otimizado?**
Responsivo se mede, não se olha: `documentElement.scrollWidth - innerWidth` a
390px com dado real, e remedir depois de **cada** conserto, porque conserto de
responsivo troca um estouro por outro. Default mobile de primitivo se sobrescreve
no consumidor, nunca no primitivo.
Otimizado tem número antes do esforço: o dev do Next mente por dois (StrictMode e
compilação sob demanda), então meça em produção. Suspeitos de sempre: valor que
tica a cada segundo dentro de contexto compartilhado, descrição pesada viajando no
payload de lista, e `keepPreviousData` desmontando componente com estado interno.

**F4 A estratégia end-to-end está progressiva e intuitiva pro ICP?**
Percorra o fluxo inteiro, não a tela: como se chega aqui, o que se faz, e para
onde se vai depois. Landing, onboarding, produto e preço têm que dizer a mesma
frase, e cada passo precisa devolver valor antes de pedir esforço (valor primeiro,
pedido depois).
Como responder: escreva o caminho em passos numerados, marque em qual passo o
usuário descobre o valor (o tempo até o "aha"), e nomeie o passo onde ele
abandona. Se o ICP não estiver nomeado por papel, essa é a resposta.

**F5 O que podemos esconder, compactar ou virar ícone?**
Esconder resolve o que apagar não precisa resolver: o raro vai pro avançado,
alcançável pros 3% e sumido pros 97%. Compactar é fundir duas linhas que dizem a
mesma coisa. Virar ícone só vale com rótulo acessível (`aria-label`) e quando o
significado é universal; ícone obscuro troca um rótulo legível por um enigma, e
isso é regressão disfarçada de densidade.
Como responder: uma tabela com três colunas, esconder / compactar / virar ícone, e
uma quarta com o que **não** deve ser escondido e por quê. Toda linha nomeia
quantos pixels verticais devolve.

**F6 O que falta para ficar no nível de um produto do Vale do Silício?**
Pergunta de fechamento, e a mais fácil de responder com vibe. Não responda com
adjetivo: responda com a lista do que falta, cada item com esforço e alavanca.

O nível se mede em treze detalhes, e nenhum deles é estético:

1. Teclado alcança toda ação, e o atalho aparece onde a ação aparece.
2. `focus-visible` chega em tudo que hover revela.
3. Zero salto de layout entre carregando e carregado (skeleton com a forma final).
4. Escrita otimista com desfazer, nunca modal de confirmação para ação reversível.
5. Erro, vazio e carregando são três estados distintos, e o vazio argumenta.
6. Nada mente: sem zero silencioso, sem denominador zero, sem rótulo que não é o
   status.
7. Latência percebida tratada onde ela nasce (só espera o que a tela precisa; o
   resto sai do caminho crítico).
8. Movimento vindo do SSoT, abaixo de 300ms, interrompível, e respeitando
   `prefers-reduced-motion` sem cancelar o resultado.
9. Densidade defensável: cromo contado em pixels até o primeiro dado real.
10. Um primário por superfície, e primário desabilitado não existe.
11. Default que você defende por escrito, com a regra visível onde se escolhe.
12. Volta na mesma posição depois de agir (a ação não perde o lugar do usuário).
13. Copy na voz da casa, sem vício, e mensagem de erro que diz o que fazer.

Como responder: marque os treze com feito, falta ou não se aplica; depois nomeie
os **três** de maior alavanca por esforço e pare aí. Lista de treze pendências não
é plano, é desânimo.

---

## Como reportar a resposta

Para cada pergunta feita, três linhas no relatório:

```
Q7 Isto é a resposta ou a matéria-prima?
   Matéria-prima. Os dois cards entregam dois totais e nenhum diz qual regime
   custa menos (MeiTaxCard.tsx:60, TaxSummaryCard.tsx:79). A comparação é o
   trabalho, e ela está sendo feita de cabeça pelo usuário.
   OBRIGA: uma linha de veredito no topo, ou fundir os dois cards. Decisão do
   usuário, porque muda escopo.
```

Pergunta sem evidência não entra. Resposta que não obriga nada sai do relatório:
interrogatório que termina em "está tudo bem" não interrogou.
