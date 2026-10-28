# O pipeline de copy (SSoT)

Índice:
1. O contrato
2. Rodar
3. Adicionar ou renomear chave
4. Registrar uma página nova
5. Erros do check e o que cada um significa
6. Montar o pipeline num repo que ainda não tem
7. Onde o preço mora de verdade

---

## 1. O contrato

Um JSON de copy por página, na **raiz** do repo. Ele é a única fonte.

```
copy.json        → index.html      → docs/COPY.md         (landing Visant Club)
copy.ebook.json  → ebook.html      → docs/COPY-EBOOK.md   (landing do e-book)
```

- O JSON é **dado**. O `.html` e o `.md` são **views geradas**.
- Chave = atributo `data-copy` no HTML = nome da layer no Figma. Os três batem,
  de propósito: dá pra rastrear uma palavra do Figma ao deploy.
- A injeção acontece em **build time**. Já existiu um `js/copy.js` que dava
  `fetch('copy.json')` e reescrevia headline depois do paint: causava flash de
  conteúdo e CLS, e deixou o HTML divergir do JSON em 14 pontos sem o check
  perceber (ele só olhava a presença da chave, nunca o valor). Não voltar pra
  hidratação no browser.
- Um JSON por página é obrigatório porque o check exige que **toda chave do JSON
  esteja usada no HTML dela**. Um arquivo compartilhado faria a landing do e-book
  reprovar por causa das chaves do Club.

## 2. Rodar

```bash
npm run copy:lint    # vícios de linguagem (FORA do gate, roda à mão)
npm run copy:build   # injeta nos HTMLs e regera os COPY*.md
npm run copy:check   # exit 1 se qualquer view divergir
npm run check        # o gate completo (fonts, copy, price, csp, links, lint)
```

`copy:lint` fica de fora do `check` de propósito: vício de linguagem é decisão
editorial, e derrubar deploy por causa de uma vírgula trava correção urgente de
preço. `copy:check` continua no gate, porque HTML fora de sync é bug de verdade.

`build` e `check` usam a **mesma** função de render, então é impossível o check
passar com HTML stale.

Commit sempre com os três juntos: `copy.json` + `index.html` + `docs/COPY.md`.

## 3. Adicionar ou renomear chave

Nomenclatura: `secao.elemento` em lowercase, com o prefixo de seção registrado
em `PAGES[].sections` do `scripts/copy.mjs`. Numeração de item usa dois dígitos
quando a ordem importa (`inside.item01.title`).

Adicionar:
1. Chave no JSON, dentro do bloco da seção dela.
2. `data-copy="secao.elemento"` no elemento do HTML. O conteúdo escrito à mão no
   HTML pode ser qualquer coisa: o build sobrescreve.
3. `npm run copy:build`.

Renomear: mudar nos dois lugares no mesmo commit, senão o build aborta com chave
órfã (o que é o comportamento desejado).

**Injetar em atributo (meta tags):** `data-copy-attr="content"` no elemento faz
o build escrever no atributo em vez do conteúdo do nó. É o que põe SEO e social
no SSoT:

```html
<title data-copy="meta.title">…</title>
<meta name="description" data-copy="meta.description" data-copy-attr="content" content="">
<meta property="og:title" data-copy="meta.og_title" data-copy-attr="content" content="">
<meta name="twitter:title" data-copy="meta.og_title" data-copy-attr="content" content="">
```

Vários elementos podem apontar pra **mesma chave** (og: e twitter: compartilham
valor). Chaves do bloco: `meta.title`, `meta.description`, `meta.og_title`,
`meta.og_description`, `meta.og_image_alt`. Antes disso essas tags viviam soltas
no `<head>` e drift(av)am em silêncio: a description do index passou meses
anunciando uma headline que já tinha mudado.

**Quebra de linha:** `\n` no JSON vira `<br>` no HTML. Todo o resto é escapado
(`&`, `<`, `>`, `"`), porque copy é conteúdo e não markup. Pra negrito dentro de
um parágrafo, o caminho é dividir em duas chaves ou usar CSS no elemento, nunca
tag dentro do JSON.

## 4. Registrar uma página nova

Só precisa de uma entrada em `PAGES` no `scripts/copy.mjs`:

```js
{
  copy: 'copy.nova.json',
  html: 'nova.html',
  md: 'docs/COPY-NOVA.md',
  title: 'Nome da página, Landing Copy',
  note: 'Aviso que vai no fim do MD gerado (ex.: de onde vem o preço real).',
  sections: { nav: 'Nav', hero: 'Hero', /* prefixo → título humano */ },
}
```

Faltando o prefixo em `sections`, o MD ainda gera (usa o prefixo cru como
título), então não quebra, só fica feio. Registrar.

## 5. Erros do check

| mensagem | causa | conserto |
|---|---|---|
| `data-copy="x" não existe no copy.json` | HTML pede chave que o JSON não tem | criar a chave ou tirar o atributo |
| `chave "x" sem uso no index.html` | chave órfã no JSON | usar no HTML ou apagar do JSON |
| `index.html está fora de sync` | alguém editou texto no HTML, ou esqueceu o build | `npm run copy:build` (o texto escrito à mão no HTML é descartado) |
| `docs/COPY.md está stale` | MD editado à mão ou build não rodado | `npm run copy:build`, e nunca editar o MD |

## 6. Montar o pipeline num repo novo

Copiar `scripts/copy.mjs` do visantismo é o caminho mais curto. Dependência
única: `node-html-parser` (preserva o markup original, só reescreve o conteúdo
dos nós com `data-copy`). Adicionar em `package.json`:

```json
"copy:build": "node scripts/copy.mjs build",
"copy:check": "node scripts/copy.mjs check"
```

e pendurar o `copy:check` no `check` geral que o CI/deploy roda.

Em repo Next/React o mesmo princípio vale sem o parser de HTML: o JSON é
importado e lido por chave, e o gate passa a ser "toda chave do JSON é
referenciada em algum componente". O que não muda nunca: **texto de interface
não é escrito dentro do componente.**

## 7. Onde o preço mora de verdade

- **Landing do Club:** preço, número do fundador e total de vagas são preenchidos
  em **runtime** por `js/ratchet.js` a partir de `/api/sold`. A copy não carrega
  esses números.
- **Landing do e-book:** o preço cobrado é resolvido no **servidor**
  (`api/_config.js` → `PRODUCTS`). O texto do JSON é só exibição. Mudou o preço
  lá, muda aqui também, nas duas ou três chaves que citam `R$ 47` (nav, hero,
  gate da amostra, CTA final).

Antes de aprovar copy com número, conferir contra essas fontes. Copy que mente
sobre preço é a única que gera chargeback.
