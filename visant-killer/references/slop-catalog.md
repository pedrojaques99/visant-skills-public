# Catálogo de slop que passa pelo linter

Marcas de interface escrita por IA que nenhum detector pega, porque o defeito é
decisão e não sintaxe. Todas vistas em produção na Visant. Cada uma: sintoma,
causa, conserto.

Ordem por frequência. As seis primeiras aparecem em quase todo card que uma IA
escreve sem supervisão.

## 1. Card arco-íris

**Sintoma.** Numa memória de cálculo, toda cifra pintada: receita verde, imposto
vermelho, base branca, isenção roxa.
**Causa.** A IA trata cor como rótulo semântico por valor, então cada linha ganha
a "sua" cor.
**Conserto.** Cor é exceção. Um neutro para tudo, e cor só onde existe exceção
real (limite estourado, saldo negativo, prazo vencido). Saída de caixa é marcada
pelo menos tipográfico (`− R$`), fecho de bloco pelo peso da fonte.
**Teste.** Se mais de dois tons aparecem no mesmo bloco de números, nenhum
significa nada.

## 2. Dinheiro em `font-mono`

**Sintoma.** `font-mono tabular-nums` em cifra.
**Causa.** IA associa "número alinhado" a fonte de código.
**Conserto.** `tabular-nums` sozinho. Mono é para serial, hash, ID e código; num
card financeiro ela grita "terminal" e destoa da tipografia do resto do app.

## 3. Spinner no lugar do skeleton

**Sintoma.** `<Loader2 className="animate-spin" />` centralizado, e o card colapsa
para 40px de altura enquanto carrega.
**Causa.** Caminho mais curto para "estado de carregando".
**Conserto.** Estrutura estática pinta, só o dado borra. Rótulo, régua e título
ficam; o valor vira `Skeleton` da largura aproximada. Sem salto de layout, e o
usuário já lê o que vai chegar.

## 4. Título que repete o cromo

**Sintoma.** `h1` da página diz "Resumo Fiscal", o filtro diz "2026", e o card
repete "MEI — Resumo Fiscal 2026".
**Causa.** O componente foi escrito sem olhar a página que o contém.
**Conserto.** O card nomeia o que ele acrescenta ("Cenário MEI"), e o
qualificador (ano, regime, base) vai uma vez, quieto, à direita.

## 5. Dado duplicado dentro do mesmo card

**Sintoma.** "Faturamento R$ 222.430,91" no topo e "Receita bruta R$ 222.430,91"
dez linhas abaixo.
**Causa.** Cada bloco foi gerado isolado, com sua própria abertura.
**Conserto.** O valor aparece uma vez, no bloco onde ele decide algo. Nos outros
ele é referência e sai, ou vira legenda.

## 6. Espaçamento uniforme

**Sintoma.** `space-y-4` em tudo, ou uma régua entre cada par de linhas.
**Causa.** Ritmo constante é o default de quem não decidiu o agrupamento.
**Conserto.** Espaço é o que agrupa. Dentro do bloco aperta, entre blocos abre,
e uma régua só por fronteira de bloco.

## 7. Barra de progresso saturada

**Sintoma.** Barra 100% cheia e vermelha ao lado do texto "274,6% utilizado".
**Causa.** A barra foi escolhida antes de checar o domínio do valor.
**Conserto.** Barra só tem escala enquanto o valor cabe no limite. Passando do
limite ela satura e mente: troque pelo número que diz o quanto passou.

## 8. Alarme com exclamação

**Sintoma.** "Excedeu! Migrar para ME/Simples", "Atenção!", "Cuidado:".
**Causa.** A IA sinaliza urgência com pontuação em vez de ordem e palavra.
**Conserto.** Vermelho é exceção real, e a exceção se comunica pela palavra e
pela posição, não pelo ponto de exclamação. Diga o fato e a consequência.

## 9. Zero renderizado como informação

**Sintoma.** Card cheio de "R$ 0,00" num ano sem lançamento; badge que 100% das
linhas carregam; métrica que ninguém alimentou.
**Conserto.** Zero não renderiza: vira estado vazio de uma linha, que diz o que
falta. Badge universal sai da linha e vira contexto do cabeçalho.

## 10. Denominador zero virando "0,0%"

**Sintoma.** Carga tributária "0,0%" sem receita; taxa de conversão "0%" sem
visita.
**Conserto.** Sem denominador não existe razão: o valor é `null` e a linha não
aparece. "0%" afirma um fato falso.

## 11. Simulação hipotética servida como fato

**Sintoma.** Faturamento 2,7 vezes o limite do MEI, e o card segue calculando DAS
e IRPF do MEI com a mesma autoridade tipográfica do resto.
**Causa.** A conta é matematicamente válida, então a IA a apresenta como válida.
**Conserto.** Ou o bloco não renderiza, ou uma linha antes dele diz que aquilo
ficou como referência. Número correto no cenário errado é mentira por implicação.

## 12. Erro colapsado em vazio

**Sintoma.** Fetch falha, tela mostra "0 itens".
**Causa.** O serviço captura a falha e devolve payload vazio, então o estado de
erro da página fica inalcançável mesmo depois de escrito.
**Conserto.** Erro e vazio são estados diferentes. Tolerância vira opt-in
(`load({ throwOnError: true })`) na superfície cujo trabalho é exibir o dado.
**Verificação.** Rodar com o backend parado. Conserto nunca visto falhando não foi
verificado.

**Variante: skeleton eterno.** O `catch` limpa o dado mas não sai do loading (ou
não grava o erro), e o skeleton fica pulsando pra sempre. Pior que o vazio: diz
"já vem". Visto na rodada 2026-10 no Naming e no referral do Perfil, e no
`mockupApi.getAll`, onde falha de rede virava lista vazia no SERVIÇO, antes de
a página ter chance. Todo `catch` termina num estado que a tela sabe pintar:
erro com "tentar de novo", nunca loading.

## 13. Rótulos todos gritando

**Sintoma.** Três ou quatro `text-xs uppercase tracking-wider` no mesmo card, com
o mesmo peso.
**Conserto.** Se tudo é cabeçalho de seção, não há hierarquia. Um nível de rótulo
por card, e a distinção seguinte vem de espaço e régua.

## 14. Hover-reveal apoiado em breakpoint

**Sintoma.** `sm:opacity-0 sm:group-hover:opacity-100`.
**Causa.** Largura usada como proxy de "tem mouse". Tablet tem 640px e não tem
hover, então o controle fica invisível e inalcançável.
**Conserto.** `[@media(hover:hover)]:opacity-0` mais
`[@media(hover:hover)]:group-hover:opacity-100` mais `focus-visible:opacity-100`.
Espaço reservado sempre; hover revela, hover nunca faz relayout.

## 15. Cor crua da palette

**Sintoma.** `text-purple-400`, `bg-emerald-500/10`.
**Causa.** Palette do Tailwind é o default de quem não leu o token.
**Conserto.** Token do design system. Vale checar: cor crua já passou batido por
dois detectores de uma vez neste repo.

## 16. Token no formato errado

**Sintoma.** Nenhum. A cor simplesmente não aparece: traço de gráfico sem cor,
grade invisível, linha de referência que não desenha.
**Causa.** O token foi lido no formato de outro repo. Onde o CSS guarda canal HSL
solto (`--primary: 0 0% 9%`), `var(--primary)` entrega a string `0 0% 9%`, que não
é cor; onde o token já é cor completa (`oklch(...)`, `#hex`), o envelope
`hsl(var(--x))` produz cor inválida do outro jeito. Os dois erros são simétricos e
os dois passam por `tsc`, lint, detector visual e revisão de código, porque a
linha **parece** certa.
**Conserto.** Antes da primeira cor, abrir o `globals.css` e olhar o formato.
Depois, uma regra grepável (`refine-scan` do `visant-refine`) que acuse `var(--x)`
pelado em prop de cor.
**Verificação.** Só a tela. Este é o caso mais literal de "compilar não é alguém
ter visto": um gráfico foi commitado e empurrado sem cor nenhuma.

## 17. Movimento decorativo

**Sintoma.** `transition-all`, `ease-in` em UI, `animate-bounce`, entrada com
`scale(0)`, duração acima de 300ms em elemento interativo.
**Conserto.** Ver `visant-motion`: `EASE_OUT` para entrar e sair, escopo explícito
na transição, `transform` e `opacity` só, e a pergunta primeiro (o que se usa 100
vezes por dia não anima).

## 18. Blur que não tem nada atrás

**Sintoma.** `backdrop-blur-sm` num card com fundo opaco (`bg-card`) ou sobre uma
página de cor chapada. Aparece em série, porque foi copiado de um card onde o
efeito realmente existia.
**Causa.** `backdrop-filter` borra o que está ATRÁS do elemento. Sem conteúdo
atrás, ele cria camada de composição na GPU e não muda um pixel. É custo puro
que passa por qualquer linter, porque a classe está escrita certa.
**Conserto.** Apagar onde o fundo é chapado. Manter onde algo passa por baixo:
nav flutuante sobre conteúdo que rola, modal, overlay em cima de foto, fundo
animado da home. Um `bg-card` (opaco) com `backdrop-blur` é sempre dead code.
**Verificação.** Abrir a tela e olhar o que está atrás — nenhum grep resolve.
Achado no audit do boxy-app (2026-08-06): 49 ocorrências, ~20 sem nada atrás.
**Detector.** `ruido-scan`, regra `blur-em-card` (2026-10-05): acusa o blur em
elemento no fluxo e deixa passar o que sobrepõe (`fixed`/`sticky`/`absolute`,
Dialog, Sheet, Popover e afins pelo nome).

## 19. Shell montado duas vezes

**Sintoma.** Rodape (ou nav) aparece duplicado numa rota so. No codigo, duas
chamadas que estao certas isoladamente: o shell do app monta `<Footer />` para
toda rota, e a page monta `<Footer />` de novo.
**Causa.** Quem escreve a page nao ve o shell. E o defeito nao tem sintoma
estatico: os dois arquivos compilam, passam no tsc, no lint e no portao de copy.
So aparece com a pagina aberta e rolada ate o fim, que e justamente onde ninguem
olha.
**Conserto.** Uma regra: **so o shell monta o shell**. Apaga o import e o uso na
page. Trava com grep de regressao (`<Footer|<Navigation` dentro de `app/**/page.tsx`),
porque isso volta toda vez que alguem cria landing nova copiando outra.
**Verificacao.** Abrir a rota e contar `document.querySelectorAll('footer').length`.
Achado no boxy-app (2026-08-06), LP do Mockup Store, reportado pelo usuario com
print — nenhum dos tres detectores viu.

## 20. A página que se explica

**A mais cara da lista, e a única que só existe no SOMATÓRIO.** As dezenove
acima são defeitos de peça: você olha o card e vê. Esta você só vê olhando a
tela inteira e contando.

**Sintoma.** A tela funciona, o código passa em tudo, os tokens estão certos, a
copy está na voz da casa. E a pessoa abre e diz "tá cheio de texto, tá poluído".
Contando o que existe antes do primeiro pixel de produto numa vitrine real:
etiqueta de posição, título, tese, linha de contagem, comando, legenda do
comando, rótulo de contexto, frase de abertura, rótulo do bloco, cinco vezes a
palavra "add", nota do bloco. **Onze blocos de texto**, e a mesma informação
dita três vezes em três tamanhos.

**Causa.** Cada peça de cromo, sozinha, é defensável — e é exatamente por isso
que passa. O rótulo nomeia o trecho. A nota orienta. A instrução ajuda quem
chega. O ordinal dá ordem. Nenhuma linha está "errada"; o dano é a soma, e
nenhum linter soma.

Agente escreve isso por default, e a causa é psicológica antes de ser técnica:
ele **acabou de decidir uma estrutura** e quer que a estrutura apareça, então
legenda o que fez. É a assinatura de quem explica o próprio trabalho em vez de
entregá-lo. O mesmo instinto que faz um júnior comentar cada linha.

**As cinco formas, na ordem em que aparecem:**

| Forma | Como se reconhece |
|---|---|
| rótulo gritado | `uppercase tracking-wider text-micro` em todo trecho. Um é eyebrow; cinco é dashboard genérico. Ver entrada 13 |
| ensina a usar | "clique para abrir", "arrasta um cartão pra outra coluna", "passe o mouse". Instrução ao lado de um controle que já tem afordância |
| legenda do que vem | "as dez peças abaixo cobrem…", "o gráfico ao lado mostra". Narra o que a página mostra dois centímetros depois, e mente na primeira reordenação |
| verbo por item | uma lista de cinco itens em que cada um traz a palavra `add`. A segunda já não informa; da terceira em diante é textura |
| a mesma info em dois tamanhos | tese no cabeçalho, "abertura" repetindo abaixo, nota do primeiro bloco repetindo de novo |

**Conserto.** A pergunta que resolve as cinco: *isto sobrevive se eu apagar?* Se
a resposta for "sim, a pessoa descobre mexendo", apaga. Descobrir que um card
arrasta custa um gesto; ler que ele arrasta custa uma linha em todo carregamento
de página, para sempre.

Duas exceções legítimas, e só duas:

1. **Gesto sem afordância nativa.** Modificador de teclado (`shift` para ajuste
   fino), redimensionar a janela, atalho. Não existe pixel que anuncie isso.
2. **Ordem que carrega significado.** Numerar `01 fonte → 05 saída` numa bancada
   de áudio orienta de verdade; numerar `1. 2. 3.` numa lista de features é
   ordinal decorativo.

Exceção fica **com o motivo escrito na linha**, citando a regra pelo nome. O
`ruido-scan` lê esse comentário e libera o achado — é a única forma de calar o
detector, e ela obriga quem cala a dizer por quê.

**Teste.** Conte os blocos de texto antes do primeiro pixel de conteúdo. Mais de
três, a tela está se explicando. E leia a tese, a abertura e a primeira nota em
sequência: se as três dizem a mesma coisa, duas morrem.

**Detector.** `node ~/.claude/skills/visant-killer/scripts/ruido-scan.mjs <alvo>`
— roda sozinho e também entra no placar do `killer-scan` como quarto portão.

## 21. Duas portas pro mesmo gesto

**Sintoma.** Dois campos que pedem a mesma coisa na mesma tela: duas urls, dois
uploads, duas buscas. Mesma forma, os mesmos ícones ao lado, um embaixo do
outro.

**Caso real** (jukebox, 2026-09-11). A aba "sua caixa" tinha o campo de url da
SALA; o rodapé logo abaixo, vindo de outro arquivo, tinha o campo de url da
CAIXA. Bancos diferentes, permissões diferentes — e o rótulo de um
(`<Group cap="link ou arquivo">`) era **literalmente** o placeholder do outro.
Nada na tela dizia qual era qual.

**Causa.** Agente que constrói por região. Cada porta foi escrita numa sessão,
num arquivo, resolvendo um pedido — e nenhuma das duas sessões olhou a tela
montada. É o defeito mais provável de código feito em paralelo, e o menos
provável de ser visto por quem escreveu qualquer uma das metades.

**Conserto.** Raramente é "apague uma": as duas costumam ser necessárias. É
mudar uma DE LUGAR, pra cada tela ter uma porta só e a porta dizer o que a tela
faz. No caso real, colar link virou ação da aba fila — que, de bônus, era a
única aba sem nenhum jeito de acrescentar disco.

**Teste.** Conte as portas do mesmo tipo por tela. Duas, pergunte em voz alta
qual é qual. Se a resposta precisa do código, a tela não responde.

**Detector.** `ruido-scan`, regra `porta-repetida` — a única regra da skill que
roda ENTRE arquivos, porque este defeito não cabe em um. Desde 2026-10-05 ela
só acusa as duas portas **na mesma tela** (ancestral comum no grafo de imports,
sem `return` antecipado nem ternário separando): de 25 achados quase todos
falsos foi pra 2 reais.

**A forma 2 voltou a ser julgamento.** O mesmo nome pra coisas diferentes em
telas diferentes ("link ou arquivo" pras texturas da sala e pra caixa de
música) é defeito de vocabulário, não de layout, e o detector não cobra mais.
Pergunta do auditor: cada nome repetido entre telas quer dizer a mesma coisa?

## 22. O realce que realça tudo

**Sintoma.** Três de três cards acesos com a cor de destaque. A grade inteira em
ciano, roxo, o que for — e o item que importa de verdade indistinguível do
resto.

**Caso real** (jukebox, 2026-09-11). Todo disco que estava na fila vinha
`on: true`, e a classe `.on` acende borda, sombra e nome. Com três discos na
caixa e os três na fila, "no ar" ficava igual a "3º na fila". O único destaque
da tela tinha sido gasto num fato que um selo de 9px já contava.

**Causa.** O realce foi escrito na fábrica do item, e a fábrica roda uma vez por
item. `on: true` é uma linha correta; ela só é defeito na terceira repetição —
e quem escreveu viu a tela com um item.

**Conserto.** O realce recebe a condição que decide (`on: q.live`). Estado que
não é o destaque vira selo, número ou peso de texto. Um destaque por região.

**Teste.** Conte as peças acesas ao mesmo tempo. Mais de uma por região, o
destaque não significa nada — e "significar" é a única função dele.

**Detector.** `ruido-scan`, regra `realce-que-nao-decide`.

## 23. A palavra pela metade

**Sintoma.** Um pedaço de palavra dentro de um card, um botão ou um selo. Lê-se
"tirar da". Ou dois overlays no mesmo canto, e o de cima esconde justamente a
AÇÃO.

**Caso real** (jukebox, 2026-09-11). A pílula de ação tinha `white-space:
nowrap` e vivia num quadrado de 96px com `overflow: hidden`. "tirar da fila" a
10px não cabe em 96px: o resto foi cortado, e o pedaço que sobrou pousou em cima
do selo que já dizia a mesma coisa.

**Causa.** A largura de uma palavra não existe no código — ela existe depois de
a fonte carregar e o layout acontecer. `tsc` passa, o lint passa, o teste passa,
o portão passa. **Só a tela aberta sabe.**

**Conserto.** Teto de largura em tudo que é overlay (`max-width: calc(100% -
12px)`) e deixar quebrar; verbo de categoria vira ÍCONE, que não tem largura de
palavra; e canto ocupado por outro overlay desloca uma vaga, em vez de empilhar.

**Teste.** Abra a tela na largura que aperta (390px) e rode o detector. A olho
isso escapa — o pedaço que sobrou parece uma palavra curta.

**Detector.** `corta-scan.js` no console do navegador:
`corta('.painel')`. Ele separa corte de rolagem, de reticências e de trilho que
rola de lado — as três coisas que a vista confunde com corte. E separa selo de
peça escondida: selo pequeno (< 25% da área) sobre um fundo `inset-0` sem nada
interativo, como "Pública" sobre a capa do card de marca, não é overlay
empilhado.

## 24. Capa sintética

**Sintoma.** Card de mídia sem imagem ganha "capa" inventada: gradiente
sorteado por hash do nome, inicial gigante no meio, grade de pontos. A lista
parece cheia e colorida, e nenhuma capa quer dizer nada.
**Causa.** A IA tem horror a vazio e preenche com decoração que parece dado.
**Conserto.** Capa real (print, thumb, logo) ou vazio honesto: fundo neutro do
token e o ícone do TIPO de item, igual em todos. O `MediaTile` do design system
existe pra isso; card de mídia reescrito à mão é o que deixa a capa sintética
voltar.
**Teste.** Duas capas sintéticas lado a lado com cores diferentes: o usuário vai
procurar o que a cor significa.
**Detector.** `ruido-scan`, regra `capa-sintetica` (matiz de hash do nome, ou
cores de dado viradas degradê perto de imagem ausente). Degradê que MOSTRA a
paleta da marca (swatch de guideline) é dado da marca e passa.

## 25. Tile de imagem sem `onError`

**Sintoma.** Borrão, blur ou skeleton eterno no lugar da foto; ou o ícone de
imagem quebrada do navegador.
**Causa.** `<img>` cru sem fallback, e dado ruim que ninguém filtra. Na rodada
2026-10 o `MasonryCard` das referências não tinha `onError`, e o servidor
aceitava `/api/local-image?path=Z:\` como "tem imagem" (caminho da máquina de
quem curou, morto em qualquer outra).
**Conserto.** Imagem de conteúdo passa pelo `Thumb`/`MediaTile`, que tem
fallback e reserva caixa; quem precisa reagir à falha (tirar o item da lista)
usa `onImageError` do tile, não um `div` em volta. E o filtro mora no servidor: item sem imagem servível
não entra na grade.
**Detector.** `ruido-scan`, regra `img-de-tile-sem-onerror` (`<img>` com
`object-cover`/`aspect-*` e sem `onError`; preview de upload, blob e asset do
build ficam de fora).

## 26. Masonry sem altura reservada

**Sintoma.** Grade em colunas onde a 1ª coluna está certa e as outras viram uma
pilha de linhas finas, ou tudo pula quando as imagens chegam.
**Causa.** Tile sem altura antes de a imagem carregar: o algoritmo distribui
itens de altura zero. Visto em `MyOutputsPage` + `Masonry`.
**Conserto.** Reservar a caixa com `aspectRatio` (do metadado, ou uma proporção
fixa por tipo) antes do `onLoad`. O `Thumb` faz isso desde 2026-10.
**Teste.** Abrir com a rede em "Slow 3G": a grade não pode se mexer.

## 27. A mesma informação dita três vezes no shell

**Sintoma.** Breadcrumb diz "Meus Mockups", o cabeçalho da página diz "Salvos",
o rail diz "outputs". Ou o nome certo, repetido no topo, no título e no
subtítulo.
**Causa.** Cada camada (shell, página, componente) foi escrita sem ver as
outras, e cada uma "se apresenta".
**Conserto.** Um nome por tela, vindo de uma chave só (`nav.<seção>.label`).
Dentro do shell, quem diz onde você está é o shell: a página não repete o título
(`useInAppShell()` esconde o cabeçalho duplicado).
**Teste.** Leia o print de cima pra baixo: o nome da tela aparece mais de uma
vez?

## 28. Regex de "crédito" decidindo paywall

**Sintoma.** Usuário com saldo vê "Comprar créditos" quando o provedor cai.
**Causa.** `/crédit/i.test(error.message)` decide o modal. A mensagem do 503 era
"seu crédito foi estornado", e casou. E substring de texto traduzido nunca casa
no outro idioma.
**Conserto.** Decidir por código: status 402 ou `code: 'insufficient_credits'`
do servidor. Mensagem é pra mostrar, nunca pra ramificar.

## 29. `charged = true` sem ler o retorno

**Sintoma.** Saldo que cresce sozinho: conta admin, BYOK ou ilimitada ganha
crédito a cada erro.
**Causa.** A rota marca `charged = true` depois de chamar a cobrança, sem olhar
se cobrou. Admin, BYOK e ilimitado não são cobrados, mas o `catch` estorna 1
crédito. Achado no `generate-naming` e duas vezes no `node-builder.ts`, e só
apareceu porque a verificação abriu `/naming` na base real.
**Conserto.** `charged` vem do retorno da cobrança, e o estorno devolve só o
que foi cobrado. É slop de backend, mas quem denuncia é a tela aberta: por isso
a trava de rota paga do `verify-screens.mjs`.

## 30. Lista em escadinha

**Sintoma.** Os itens da grade entram um depois do outro, cada um 50ms mais
tarde. Bonito com 4 itens; com 30, o último espera 1,5s, a cada filtro e a cada
volta pra página.
**Causa.** Agente quer que a lista "ganhe vida" e escreve `delay: index * 0.05`.
**Conserto.** A lista entra inteira, de uma vez (ou só o container anima). Tela
de trabalho não encena.
**Detector.** `ruido-scan`, regra `cascata-por-indice`.

## 31. O card que pula

**Sintoma.** Card sobe (`hover:-translate-y-1`) ou a imagem cresce
(`group-hover:scale-105`) ao passar o mouse. Medido em 2026-10: 26 cards do
AdminPage com o mesmo `-translate-y-1`.
**Causa.** Template de landing de 2021 aplicado a tela de trabalho.
**Conserto.** Hover muda cor, borda ou sombra. Não existe no toque e não diz
nada que a borda não diria. Escala menor que 1 no `active:` (afundar) é outra
coisa e fica.
**Detector.** `ruido-scan`, regra `hover-que-levanta`.

## 32. Fundo de grade de pontos

**Sintoma.** `radial-gradient` repetido com `background-size`, SVG de círculos
ou `<GridDots>` atrás de página, painel ou capa vazia.
**Causa.** Textura de "produto de IA" copiada de landing; preenche vazio com
ruído. Na rodada 2026-10 morava no `PageShell` e saía em toda rota.
**Conserto.** Fundo do token, chapado. Brilho radial grande (elipse sem
`background-size`) é outra coisa e passa.
**Detector.** `ruido-scan`, regra `grade-de-pontos`.

## 33. Primitivo reescrito à mão

**Sintoma.** CTA ciano escrito na classe (`bg-brand-cyan/10
border-brand-cyan/30`), `<label border-dashed><input hidden/></label>` como
área de upload, grupo de botões fazendo papel de seletor, card de mídia com
`<img>` próprio. Cada um um pouco diferente do vizinho.
**Causa.** O primitivo não existia quando a tela foi escrita, ou o agente não
procurou. Cada cópia diverge em raio, foco, hover e fallback.
**Conserto.** Os primitivos da casa (2026-10): `Button variant="primary"` (CTA
de ferramenta) e `variant="brand"` (só em vitrine), `Dropzone`,
`SegmentedControl`, `MediaTile`, `Modal` (`bodyClassName` no lugar de margem
negativa). Contrato em `visant-frontend/references/ds-visantlabs-os.md`.
**Teste.** Duas telas, o mesmo gesto: os dois controles são o mesmo componente?

## 34. Indicador de scroll na hero

**Sintoma.** "Role", "Scroll", "Scroll down", "Explore", ícone de mouse, seta ou
linha que escorre/quica no pé da hero, centralizado.
**Causa.** Enfeite de template de landing que a IA põe em toda hero de tela
cheia. Ninguém precisa ser ensinado a rolar uma página; o indicador só ocupa o
ponto mais nobre da dobra com uma instrução óbvia e um loop que puxa o olho.
**Conserto.** Apagar sempre, com a chave de copy e a `@keyframes` dele. Se a
dobra parece "fechada", o conserto é composição (corte de imagem, conteúdo
vazando para a próxima seção), nunca uma placa mandando rolar.
**Detector.** Varredura rápida abaixo. Regra do dono da casa (2026-10-19, cliente Y).

> **35 a 46: a rodada da vitrine (2026-10-20).** O dono abriu ~140 peças do
> `@visant/ui` uma a uma e deixou ~100 reports de uma frase. Todas passavam por
> tsc, lint, `casa-lint`, `interacao-check` e `palco-check`. Os defeitos abaixo
> só existem olhando: são decisões, não sintaxe. O procedimento completo de
> vitrine está em `visant-frontend/references/vitrine-de-componentes.md`.

## 35. A moldura que fala pela peça

**Sintoma.** A demo de um componente embrulhado em navbar falsa, card de
"Briefing", barra de ferramentas inventada, legenda "passe o mouse", "clique pra
ver", "mova o ponteiro"; a peça ocupa um terço do quadro.
**Causa.** O agente "contextualiza" a peça montando uma tela em volta, e cada
pedaço da tela disputa o olho com ela. Reports: "mal apresentado", "foco no
componente cara", "não entendi a necessidade do card".
**Conserto.** A peça grande e centrada, no menor contexto crível; instrução
nenhuma. Se a peça não se explica, o defeito está na afordância dela.
**Teste.** Tape a peça com o dedo: sobrou mais de uma linha de coisa na demo?

## 36. Variações empilhadas

**Sintoma.** 4 skeletons, 6 loaders, 3 toggles, 4 molduras lado a lado no mesmo
palco, cada uma espremida.
**Causa.** Mostrar "tudo que a peça faz" de uma vez. No ladrilho nenhuma aparece.
**Conserto.** **Um por vez**: uma variação grande e um seletor discreto (texto
miúdo ou setas) que troca e re-toca. A palavra do dono, repetida em 6 peças:
"UM POR VEZ".

## 37. Peça que nasce apagada

**Sintoma.** Brilho, perspectiva, tilt, menu ou ilha só aparecem no hover; em
repouso a peça é um retângulo neutro.
**Causa.** O estado bonito foi desenhado como resposta, não como apresentação.
Não existe no toque, no ladrilho, no print nem no link compartilhado.
**Conserto.** Nasce no melhor estado ("nascer em perspectiva e brilhando por
default"); o hover intensifica, não revela.

## 38. Controle secundário mais alto que a peça

**Sintoma.** Chips com borda e cor de marca pra trocar o modo da demo
("Ligação / Timer / Música"), switch com rótulo "Mostrar modo X", seletor de
estados maior que o componente.
**Causa.** O controle da demo usa o mesmo vocabulário visual da peça.
**Conserto.** Texto miúdo no pé, sem caixa, sem marca; ou os modos vão pros
knobs do painel. Toggle com rótulo-instrução não ("toggle com label não dá").

## 39. Rótulo permanente que depende de estado

**Sintoma.** "Apagar selecionados", "0 itens", "Nada aberto ainda" visíveis
sem nada selecionado ou aberto.
**Conserto.** O rótulo nasce com o estado: o botão é só ícone até haver
seleção; o "0" some (a faceta zerada apaga em vez de mostrar zero).

## 40. Animação amadora

**Sintoma.** Giro de 200°, overshoot em tudo, 20+ partículas por item, pulo
grande, mola que quica três vezes. Report: "animação tá mt amadora kkk".
**Causa.** Amplitude confundida com qualidade.
**Conserto.** Corte a amplitude pela metade e de novo: giro de ~12°, escala de
0,4–0,9, poucas partículas fracas, sem overshoot em elemento que some. O
movimento bom quase não se nota (ver `visant-motion`, "amplitude").

## 41. Tudo se mexendo ao mesmo tempo

**Sintoma.** Tela com fila andando, imagens chegando, barra de %, toast e erro
animando juntos. Report: "mt coisa espremida e acontecendo ao mesmo tempo".
**Conserto.** Um foco de movimento por vez: os estados em sequência (enviado →
gerando → pronto → exportando), o resto parado.

## 42. Copy de cliente vazando na library

**Sintoma.** Demo de peça reutilizável com nome, slogan, produto ou tema de um
cliente da agência ("Tema cliente K", "Altura do jogador", difusor e vela).
**Causa.** A peça foi colhida de um projeto e a demo veio junto.
**Conserto.** Texto genérico, curto, pt-BR falado; nomes de pessoa fictícios.
Ao colher, troque a copy na mesma passada. Varrer a library inteira quando
aparecer um caso: "tem q ser agnóstico, todos os da library".

## 43. O palco escalado mentindo

**Sintoma.** Cursor/ponto longe do ponteiro, arrasto que anda mais que o dedo,
canvas 3D torto ou no canto, menu cortado ao abrir, peça "cortando as bordas".
**Causa.** O palco aplica `transform: scale`: `position: fixed` mede da caixa,
o delta do ponteiro está em px de tela, o canvas mede o tamanho já escalado, e
`overflow`/`contain` recorta o que não está em portal.
**Conserto.** Portal pro `body`; delta dividido pela escala; `resize={{
offsetSize: true }}` no R3F; dropdown em portal; caixa (`preview`) do tamanho
real da peça. Tabela completa em `vitrine-de-componentes.md` §3.
**Teste.** Rode a peça com o palco em `scale(0.5)` e arraste.

## 44. Barra de rolagem do sistema e lista que rola de lado

**Sintoma.** Trilho branco com setas no tema escuro; lista/busca com scroll
horizontal porque uma coluna ("Componente") não cabe.
**Conserto.** Na raiz: `scrollbar-width: thin` e `scrollbar-color` no tom da
linha. Lista: `overflow-x: hidden`, colunas que truncam, e o dado comum não se
repete em toda linha.

## 45. Categoria em jargão interno

**Sintoma.** Filtros "Aquisição", "Superfície de trabalho", "Fundação";
subfiltro `ui / block / lib`. Report: "não entendi a tag aquisição e as subtags".
**Conserto.** Categoria pelo que a coisa É (Controles, Dados, Navegação, Mídia,
Texto, Efeitos, 3D…), tipo em português, apelido pros nomes antigos na rota.

## 46. Clicável sem mãozinha

**Sintoma.** Card, botão de ladrilho, aba ou seta que responde ao clique com o
cursor de seta; arrasto sem `grab`. Reports: "cursor pointer tb obviamente",
"rail: cursor pointer".
**Causa.** O preflight do Tailwind v4 deixa `button` com `cursor: default`.
**Conserto.** Uma regra na casca (`:is(button,[role=button],a[href],summary)
:not(:disabled){cursor:pointer}`); `grab`/`grabbing` no que se arrasta.

## Varredura rápida

```bash
# vitrine de componentes (35–46): candidatos, nunca veredito
rg -i '"(passe o (mouse|ponteiro)|mova o ponteiro|clique pra|arraste pra)' --glob '**/demos/*.tsx'   # moldura que fala (35)
rg 'fixed' --glob '**/demos/*.tsx'                                         # fixed dentro do palco escalado (43)
rg 'clientX|movementX' --glob 'registry/**/*.tsx' | rg -v 'scale|offsetWidth'  # delta sem dividir pela escala (43)
rg '<Canvas' --glob '*.tsx' | rg -v offsetSize                             # canvas medindo tamanho escalado (43)
rg 'rotate: *[0-9]{3}|rotate\([0-9]{3}deg' --glob '*.tsx'                  # giro amador (40)
rg 'font-mono' --glob '*.tsx' | rg -i 'currenc|valor|preco|total'
rg 'animate-spin' --glob '*.tsx'
rg 'transition-all|ease-in\b|scale\(0|animate-bounce' --glob '*.tsx'
rg 'sm:group-hover|md:group-hover' --glob '*.tsx'
rg 'text-(purple|emerald|indigo|violet|sky)-[0-9]' --glob '*.tsx'
rg 'bg-(card|background|popover)[^"''']*backdrop-blur' --glob '*.tsx'   # blur sem nada atrás
rg '<(Footer|Navigation)' --glob '**/page.tsx'                      # shell montado 2x
rg 'toFixed\(1\)\}%|toFixed\(2\)\}%' --glob '*.tsx'   # candidato a denominador zero
rg '<img' --glob '*.tsx' | rg -v 'onError|Thumb'      # tile sem fallback (25)
rg -i '/cr[eé]dit/i' --glob '*.tsx'                   # paywall por substring (28)
rg 'charged = true' server/                           # estorno do que não cobrou (29)
rg -i '"(role|scroll|scroll down|explore|descubra mais)"|animate-bounce|nudge|scroll-indicator|ScrollHint|MouseIcon' --glob '*.{tsx,json}'   # indicador de scroll na hero (34)
```

Grep acha candidato, não veredito. Cada achado se confirma lendo `arquivo:linha`.

Para as entradas 20, 21, 22 e 23 não use grep, e o motivo é o mesmo nas quatro:
o defeito não mora em nenhuma linha. A 20 mora na soma das linhas; a 21, ENTRE
dois arquivos; a 22, na repetição de uma linha correta; a 23, na largura que só
existe depois de a fonte carregar. Grep pega uma linha por vez — por isso as
três primeiras são regra do `ruido-scan.mjs` e a última é o `corta-scan.js`, que
roda no navegador com a tela aberta.
