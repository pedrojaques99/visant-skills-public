# Os erros que geraram cada checagem

Toda checagem do pré-voo nasceu de prejuízo. Este arquivo guarda a versão longa,
para quem quiser saber **por que** o item existe antes de aceitá-lo.

---

## 1. Vault × Drive — cliente K, agosto de 2026

O vault do Visant declarava a tipografia display da marca como **Termina**,
licença paga da Fontfabric.

A pasta de fontes efetivamente entregue ao cliente —
`Drive › cliente K › Id Visual › Fontes` — continha **Syncopate** e **Funnel
Sans**, ambas gratuitas. Não havia Termina em lugar nenhum do material. E
Syncopate era exatamente o caixa-alta largo que aparecia em todos os layouts do
Figma: bastava olhar lado a lado.

Ninguém cruzou as duas coisas. Consequência ao longo de meses de projeto:

| Rodada | Tipografia que subiu | Por quê |
|---|---|---|
| 1 | Archivo | "stand-in geométrico próximo" do Termina |
| 2 | Mozilla Text + JetBrains Mono | outra aproximação, outro palpite |
| 3 | Funnel Display + Funnel Sans | aproximação com boa justificativa — ainda errada |
| 4 | **Syncopate + Funnel Sans** | alguém finalmente abriu a pasta do cliente |

O que torna esse erro específico tão persistente: **fonte ausente não dá erro.**
O navegador cai para `system-ui` em silêncio, o layout continua "funcionando", e
só o olho treinado percebe que o produto mudou de voz.

**Regra que ficou:** a pasta que o cliente recebeu é evidência mais forte que o
campo do vault. Vault é cópia, e cópia envelhece — ou nasce errada.

**Correção estrutural:** o `@visant/brand-tokens` ganhou portão de fonte
(`src/fonts.js`). O CSS gerado passa a importar o que dá para carregar e a
declarar no topo o que não dá, com instrução. Antes disso, cor tinha portão e
travava o build enquanto tipografia era apenas afirmada.

---

## 2. Resolução de foto — mesma sessão

Uma faixa full-bleed foi desenhada primeiro; a origem foi olhada depois. A fonte
tinha **646px** de largura e era exibida em **1440px** — 2,2× de ampliação. A
imagem chegava visivelmente mole, e nenhuma escolha de layout consertava.

O agravante foi o diagnóstico. A varredura feita para responder "existe foto em
alta?" **filtrava por dimensão mínima** e percorria a árvore de forma
incompleta. Resultado: um laudo confiante e errado — *"não existe foto do Eric
em alta resolução"* — que virou base para decisões de layout e para uma
recomendação ao cliente.

A pasta existia. Chamava-se `Fotografia`, estava aninhada de forma incomum
(`Fotografia/Id Visual/Assets`), e continha originais de até **4562×2546**.

**Duas regras ficaram:**

1. **Escolha a fonte pela resolução ANTES de decidir o enquadramento.** Faixa
   larga exige arquivo largo; isso não é negociável por talento de recorte.
2. **Nunca filtre em silêncio.** O `preflight-scan.mjs` lista tudo que leu e
   tudo que pulou, com o motivo. Varredura que esconde é pior que varredura que
   não roda, porque produz confiança falsa — e confiança falsa vira laudo.

---

## 3. A ferramenta que cai — `moodboard-upscale`

Ao tentar contornar o item 2 por ampliação, o `moodboard-upscale` do MCP
respondeu `INTERNAL_ERROR` em 3 de 3 chamadas.

Duas lições, e a segunda é a que importa:

1. Ferramenta de MCP cai. Duas tentativas, não mais — `INTERNAL_ERROR` repetido
   é servidor, não payload.
2. **A alternativa certa quase nunca era a ampliação.** Era procurar o original
   em alta, que existia e ninguém tinha olhado. Ampliar já é plano B; ampliar
   sem ter procurado o original é plano C fantasiado de plano A.

---

## 4. A cicatriz que reabriu

Um campo decorativo `absolute` atravessava a faixa de números do herói.
Corrigido com fundo opaco e comentário explicando o porquê no ponto do conserto.

Duas horas depois, o arquivo foi reescrito inteiro por outro motivo — despoluição
visual — e **o mesmo bug voltou**, porque a reescrita partiu da intenção nova em
vez de partir do arquivo velho. O comentário defensivo morreu junto com o
arquivo que o carregava.

**Regra que ficou:** antes de reescrever um arquivo por completo, leia-o e
liste os comentários defensivos; carregue cada um, ou justifique por escrito por
que deixou de valer. E registre a correção também no `.md` do projeto, na seção
Cicatrizes — é o que sobrevive à reescrita e à troca de quem toca o trabalho.

**Por que não virou detector automático:** a regra line-based para "camada
decorativa cruzando faixa de conteúdo" não distingue o caso real de dezenas de
bordas legítimas dentro de pais que já têm fundo. O próprio `refine-scan` avisa
que detector que grita fora do escopo é detector que a pessoa desliga.

---

## 5. A rodada de perguntas que não houve

Nenhum dos quatro itens acima teria sido pego por uma pergunta ao cliente — mas
o maior retrabalho da sessão, sim.

Três propostas completas foram construídas, medidas, publicadas e só então
receberam a crítica que reorientou tudo: *sem imagem nenhuma, texto demais,
precisa despoluir.* Uma pergunta de trinta segundos no início — **"quanto de
densidade você quer, e as fotos entram nesta rodada?"** — teria economizado uma
reconstrução inteira das três páginas.

E logo depois, a segunda: uma versão "limpa" trocou o grafismo próprio da marca
por uma composição convencional. O dono do trabalho reverteu em uma frase — *a
versão antiga era bem mais dahora*. Também previsível com uma pergunta: **"o
que nesta marca é intocável?"**

**Regra que ficou:** a rodada de perguntas vem primeiro e vem inteira, em uma
tacada. Pergunta em conta-gotas ao longo do trabalho chega sempre depois do
retrabalho que ela evitaria.
