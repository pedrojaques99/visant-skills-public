# Design system do visantlabs-os: contrato e tokens de cromo

Estado depois da fase 2 do slop killer (2026-10-05), conferido em
`src/components/ui/`. Antes de escrever card, seletor, modal, CTA ou upload à
mão, leia a peça aqui. Faltou variante: parametrize a peça (com aprovação), não
copie o markup pra fora dela. O catálogo vivo é a `DesignSystemPage`
(`#media-tile`, `#segmented-control`, `#dropzone`, `#buttons`).

## MediaTile (`ui/MediaTile.tsx`)

O único card de mídia. Sem zoom na capa, sem degradê preto, sem blur, sem
`transition-all`: o hover só muda a borda.

| Grupo | Props |
|---|---|
| capa | `src`, `alt` (obrigatório), `aspectRatio` (reserva a caixa antes do load), `layout` `stacked` \| `overlay` \| `masonry`, `imageClassName`, `loading`, `placeholder` (LQIP/thumbhash), `onImageLoad` / `onImageError` |
| sem imagem | `fallback` (nó, ganha do ícone: `<BrandAvatar />`), `fallbackIcon` + `fallbackLabel` |
| texto | `title`, `subtitle`, `subtitleLines` `1` \| `2`, `meta`, `leading` (avatar ao lado do título), `density` `default` \| `compact`, `editableTitle` |
| ação | `onClick(e)` **ou** `href`, `actionLabel`, `selected` (vira toggle com `aria-pressed`) |
| controles | `actions` (revela no hover, sempre no toque e no foco), `persistentActions` (sempre visível), `actionsVisible` `hover` \| `always`, `badge` (canto superior esquerdo), `footer` (barra sob a capa), `busy` |
| raiz | `...rest`: `data-*`, `id`, `draggable`, `onDragStart`, `onContextMenu`, `aria-*` vão pro `div` raiz |

O que quebra se ignorado:

- **Não embrulhe.** Nem em `button`/`a`/`Link` (a ação já é esticada sobre o
  tile), nem em `div` pra pendurar `data-*`, drag ou `onContextMenu`: tudo isso
  vai direto no tile via `...rest`. O `title` nativo **não** passa (o `title` é
  o ReactNode).
- **`persistentActions` vs `actionsVisible="always"`.** Um controle só precisa
  ficar (like com contagem): `persistentActions`, e as ações de dono/admin
  continuam no hover. O modo inteiro pede (seleção em lote): `actionsVisible`.
  A contagem do like mora dentro do botão, não repetida no `meta`.
- **`onClick(e)`** lê `e.shiftKey`/`e.metaKey` direto. `onClickCapture` + ref
  pra descobrir o shift é o padrão antigo.
- **Drag:** `draggable` + `onDragStart` no tile. O botão esticado também fica
  arrastável, o fantasma é o tile inteiro e o `<img>` é `draggable=false`.
  Coberto por teste em jsdom; Firefox real não foi verificado.
- **`editableTitle`** troca o título visível (input de renomear) e fica acima
  da ação esticada, então digitar não dispara `onClick`. Continue passando
  `title` ou `actionLabel`: é o nome acessível.
- **`busy`**: `true` mostra spinner neutro, um nó renderiza como veio. Tem
  `pointer-events-none` e põe `aria-busy`; pra travar ações durante o estado,
  use `inert` nos controles (como o `MockupCard` faz no redraw).
- **`footer` soma altura.** Wrapper com proporção fixa + `overflow-hidden`
  corta a barra: quem define a proporção é o `aspectRatio` do tile.
- **`layout="overlay"`** força proporção 1 sem `aspectRatio` e deixa o título só
  acessível. Rótulo que precisa ser lido (variantes de logo parecidas) pede
  `stacked`; em grade com tile abaixo de ~140px, `density="compact"`.
- Nada interativo em `title`/`subtitle`/`meta`; menu dentro de `actions` com
  `stopPropagation`.

`Thumb` (`ui/Thumb.tsx`) é a capa por baixo e aceita sozinho `fallback` e
`placeholder`. Imagem de conteúdo fora de card também passa por ele.

## SegmentedControl (`ui/SegmentedControl.tsx`)

Escolha única entre 2 e 5 opções (Radix ToggleGroup, `radiogroup`, nunca fica
sem valor). `options[{value,label,icon?}]`, `value`, `onChange`, **`aria-label`
obrigatório**, `size` `xs` \| `sm` \| `md`, `variant` `default` \| `accent`,
`fullWidth`, `scrollable`.

- Os segmentos encolhem e o rótulo trunca com `title` nativo só enquanto está
  cortado. Com espaço, nada muda.
- Cinco abas num painel de 280px: `size="xs" fullWidth` (encolhem por igual) ou
  `size="xs" scrollable` (rola de lado e traz o ativo pra vista).
  `className="overflow-x-auto scrollbar-none"` à mão é o padrão antigo.
- Opções com união de tipos: passe o genérico (`<SegmentedControl<TabType> …>`).

## Modal (`ui/Modal.tsx`)

Painel com `shadow-[var(--e-modal)]`, `rounded-xl` (gaveta mobile
`rounded-t-xl`) e sem blur; o blur fica só no backdrop. `bodyClassName` é o
corpo que rola, mesclado depois do `p-6 sm:p-10 md:p-12` padrão: conteúdo de
borda a borda (toolbar sticky, grade cheia) zera **todo** breakpoint, `p-0
sm:p-0 md:p-0`. Margem negativa pra brigar com o padding é o padrão antigo.

## Button: `primary` vs `brand`

| Variante | É | Onde |
|---|---|---|
| `primary` | ciano tingido, texto `foreground` | a UMA ação principal de ferramenta ou painel (Comprimir, Exportar) |
| `brand` | ciano cheio, texto preto | só vitrine: landing, pricing, paywall, fim de onboarding |

Um painel tem no máximo uma ação ciano, e ela é `primary`. Os dois nunca
dividem painel. Chip ou estado selecionado não é `primary`. `font-semibold`
explícito num `<Button>` é redundante (a base já é `font-medium`), e `toolbar`
agora é `text-xs` regular, sem caixa-alta.

## Dropzone (`ui/Dropzone.tsx`)

`onFiles(File[])`, `accept`, `multiple`, `disabled`, `label`, `hint`, `icon`,
`size` `sm` \| `md`. É um `<input type="file">` de verdade (Tab alcança, Enter e
Espaço abrem). Dentro de `MiniAppShell`/`ToolEditorShell`, que já tratam o
arraste, passe `dropTarget={false}`, senão o arquivo é processado duas vezes.

## Tokens de cromo

Valem pro chrome do app. Ficam de fora as superfícies que renderizam a MARCA do
cliente (`brand/guidelines/preview/**`, `BrandReadOnlyView`, documento de
orçamento, preview de tema) e o admin.

**Raio: três nomes.** `rounded-md` = controle (botão, input, chip),
`rounded-xl` = superfície (card, painel, dialog), `rounded-full` = pílula,
avatar, ponto. No `index.css`, `sm` desenha igual a `md` e `lg`/`2xl` igual a
`xl`; o codemod deixa um nome por nível sem mudar pixel:

```bash
node scripts/codemod-radius-scale.mjs           # dry-run: lista as trocas
node scripts/codemod-radius-scale.mjs --apply   # sm→md, lg/2xl/3xl→xl
```

O `3xl` é o único que muda de valor, e o codemod não o toca em superfície de
marca. Não reintroduza `sm`/`lg`/`2xl`/`3xl`.

**Peso.** `font-semibold` só no título principal de cada região e em número de
destaque (saldo, preço, score); `bold`/`black` viram `semibold`. Título de
seção, label, botão, nome de card e badge são `font-medium`.

**Opacidade crua vira token** (o mapa que a fase 2 aplicou):

| Era | Vira |
|---|---|
| `text-white/NN` | `text-foreground` ou `text-muted-foreground` |
| `bg-white/<10` | `bg-muted` |
| `bg-white/≥10`, hover | `bg-accent` (no visantlabs-os `--accent` é o neutro de hover) |
| `border-white/<20` | `border-border` |
| `border-white/≥20`, hover | `border-border-hover` |
| foco | `border-ring` |
| selecionado | `bg-accent` + `border-ring` (precisa continuar diferente do não selecionado) |
| scrim sem foto embaixo | `bg-background/80` |
| scrim sobre mídia | fica `bg-black/NN`, com exceção escrita (ver `visant-killer`) |

Nunca `border-foreground/*`: o linter reverte pra dark. Use `border-ring`.

**Matiz.** Vermelho, âmbar e verde são `destructive`/`warning`/`success`.
Categórico é `chart-1..5`, na tinta e na borda, com `text-foreground`: o
`chart-N` não serve como cor de texto (o `chart-1` escuro tem L 0.49 sobre fundo
escuro; `chart-4`/`5` claros, L 0.77 a 0.83 sobre branco).

**Micro-label.** Mono + caixa-alta + tracking só em valor técnico (hex,
extensão, código). Label vira sans `text-xs`.

## Editor sempre escuro: `.dark` no root, tokens dentro

Canvas, `/create`, Studio3D, ImageLab e as mini-ferramentas de editor são
escuros nos dois temas. A regra: **o root do editor declara a classe `dark` e o
editor usa tokens.** O `index.css` define os tokens sob `.dark {}` e a variante
dark é `&:is(.dark *)`, então a subárvore resolve os tokens escuros mesmo com o
app no tema claro, e nada muda no tema escuro.

Já declarado: `CanvasPage` (root e `contentClassName="… dark"`),
`ToolEditorShell` (`<AppShell className="dark text-foreground">`),
`Studio3DPage` (`<div className="dark contents">`).

Dois antipadrões:

- Token num painel `bg-neutral-950` sem `.dark` acima: no tema claro o
  `text-foreground` fica escuro sobre escuro.
- Trocar `white/NN` por `neutral-800` fixo pra fugir disso. Foi o paliativo da
  fase 2 em 3d-studio e riso. Com o `.dark` no root, a troca certa é pra token.

Portal (popover, dialog, tooltip do Radix) renderiza no `body`, fora da
subárvore: confira no tema claro o que o editor abre por portal.

O `scan-lightmode-breakage` trata arquivo que declara a classe `dark` solta
como palco sempre escuro (suprime o arquivo e conta no `--summary`), e exclui as
pastas de editor por caminho. Ele lê por arquivo: filho em outro arquivo que só
vive dentro do editor leva `// lightmode-ignore-file: <regra> — só renderiza
dentro do editor .dark`.
