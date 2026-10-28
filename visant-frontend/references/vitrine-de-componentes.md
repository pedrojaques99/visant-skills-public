# Vitrine de componentes (library, registry, showcase)

A superfície onde a peça É o produto: o catálogo do `@visant/ui`
([ui.visantlabs.com](https://ui.visantlabs.com)), a ficha de
uma peça, a demo de um kit. Destilado de ~100 bug reports do dono numa sessão só
(2026-10-20), abrindo peça por peça na vitrine. Cada regra abaixo nasceu de um
report que se repetiu em várias peças, então vale como padrão, não como gosto.

A variável de negócio aqui é uma só: **a pessoa entende a peça em 2 segundos e
quer instalar.** Tudo que disputa atenção com a peça perde.

## 1. A demo mostra a peça, não fala dela

Report mais repetido: "mal apresentado", "foco no componente", "mt label".

- **A peça grande, centrada, num contexto mínimo e crível.** Nada de navbar
  falsa, card de "Briefing" em volta, barra de ferramentas inventada, legenda
  "passe o mouse", "clique pra ver", contador de exemplos. Se a peça precisa de
  instrução pra ser entendida, o conserto é na afordância dela.
- **Um por vez.** Variações empilhadas lado a lado (4 skeletons, 6 loaders, 3
  toggles) espremem cada uma e nenhuma aparece. Mostre UMA, grande, com um
  seletor discreto (texto miúdo ou setas) que troca e re-toca a animação.
- **Nasce no melhor estado.** Brilho, perspectiva, menu aberto, ilha expandida:
  a peça já aparece fazendo o que faz. Estado bom escondido atrás de hover não
  existe no ladrilho, no toque nem no print.
- **Controles da demo recolhidos por padrão.** Os knobs vivem no painel da ficha;
  na peça, quando muito, um seletor quieto.
- **O controle secundário é mais quieto que a peça.** Seletor de modo vira texto
  miúdo no pé, sem caixa, sem cor de marca. Se o olho vai primeiro pro seletor
  ("Ligação / Timer / Música"), a hierarquia está invertida.
- **Rótulo condicional.** Texto que só faz sentido com estado aparece com o
  estado (o "Apagar 3" só existe quando há 3 selecionados).
- **Texto agnóstico.** Copy de demo é genérica e curta, em pt-BR falado. Nunca
  nome, slogan, produto ou tema de cliente (a library inteira foi varrida por
  isso: "tá aparecendo texto do meu cliente").
- **Toggle com rótulo-instrução não.** "Mostrar modo X" ao lado de um switch é
  documentação na tela. Os modos vão pros knobs ou viram variações "um por vez".

## 2. Variação é prop, não peça nova

Pedidos como "faça variações", "mais opções de layout", "opções de transição":
a resposta é uma prop (`variant`, `layout`, `transition`, `motion`, `animation`)
com 3–5 valores nomeados, compatível com o padrão antigo, e a demo mostrando
um por vez. Peça nova só quando o gesto é outro.

## 3. O palco mente: escala, recorte e foco

A vitrine desenha a peça no tamanho natural e aplica `transform: scale` pra
caber no ladrilho. Isso quebra coisas que funcionam numa página normal:

| Sintoma | Causa | Conserto |
|---|---|---|
| ponto/cursor longe do ponteiro | `position: fixed` mede da caixa transformada | portal pro `body`, montado só enquanto o ponteiro está na demo |
| arrasto anda mais/menos que o dedo | delta do ponteiro em px de tela | dividir pela escala (`offsetWidth / rect.width`) |
| canvas 3D torto ou no canto | R3F/three medindo o tamanho já escalado | `resize={{ offsetSize: true }}`; medir o container, não a janela |
| menu/select cortado ao abrir | dropdown dentro de `overflow:hidden` / `contain: paint` | portal (Radix `Portal`) ou caixa da demo do tamanho do menu aberto |
| peça "cortando as bordas" | `preview` (caixa natural) menor que a peça | a caixa mede a peça + respiro; `palco-check` acusa |
| anel de foco cortado | máscara/overflow da peça | espaço pro anel, foco por `box-shadow: var(--focus)` |

Portão: `palco-check` (centro e transbordo) e `interacao-check` (clique,
teclado, arrasto e foco medidos em pixel) rodam no acervo inteiro.

## 4. A casca some, a marca aparece

- A casca (cabeçalho, grade, filtros) lê só os tokens da casa; a marca do
  cliente pinta só o palco. Peça temática (kit vintage) ainda respeita a marca
  onde é traço/realce (`--brand` em borda, curva, fundo; nunca em texto).
- **Barra de rolagem fina e no tom da linha**, declarada na raiz (`:root {
  scrollbar-width: thin; scrollbar-color: … }`). A padrão do sistema é a coisa
  mais clara da tela no tema escuro.
- **Lista nunca rola de lado.** `overflow-x: hidden`, colunas que truncam, e o
  dado comum ("Componente" em toda linha) some: só o que foge do padrão se
  anuncia.
- **Tudo que se clica tem `cursor: pointer`; o que se arrasta, `grab`/`grabbing`.**
  O preflight do Tailwind v4 deixa `button` com `cursor: default`.

## 5. Taxonomia pelo que a peça é

Categoria em jargão interno ("Aquisição", "Superfície de trabalho") não diz onde
achar um slider. Agrupe pelo que a coisa É (Controles, Dados, Navegação, Cards,
Feedback, Seções, Mídia, Texto, Efeitos, 3D, Shaders…), mantenha apelido dos
nomes antigos na rota e esconda categoria vazia. O eixo de tipo também fala
português (Componente, Seção inteira, Utilitário, Hook, Tema), não `ui/block/lib`.

Na grade, prefira **um botão de densidade** (cards grandes/médios/pequenos,
lembrado entre visitas) a um modo lista: a vitrine vende peça viva, e uma linha
de descrição sem palco não vende nada.

## 6. Kits: produto mock, não documentação

Um kit (várias peças juntas) parece um produto de verdade numa janela de app ou
navegador: app de demandas com dados ricos, site de estúdio de ponta a ponta,
rack de estúdio, brand book vivo. Zero rótulo técnico por dobra ("01 fonte",
"Dobra 3"). As peças se revelam por uma **camada de inspeção**: hover (e foco, e
um "Mostrar peças" no toque) acende a região e mostra os nomes com link pra ficha
e cópia do `add`. Um primitivo só, reaproveitado em todas as salas.

E **um foco de movimento por vez**: tela com fila, imagens chegando, exportação
com %, erro e toast, tudo animando junto, é "mt coisa espremida e acontecendo ao
mesmo tempo". Sequencie os estados.

## 7. O ciclo com o dono

- **Bug report na vitrine** (botão no ladrilho em dev → `bugs/reports.jsonl`) e
  **curadoria** (nota 1–5 + comentário na ficha; ≤ 2 arquiva da vitrine, "excluir
  de vez" apaga por script com dry-run). O dono lê a library peça a peça e deixa
  frases curtas; trate cada uma como verdade sobre o que ele viu.
- Agrupe os reports por área e dê a cada agente arquivos que não se cruzam;
  arquivos compartilhados (catálogo, registry) ficam com quem orquestra.
- Feche cada report por script (`npm run bugs -- --resolve <id>`) só depois de
  ver a peça de novo.
