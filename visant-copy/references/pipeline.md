# The copy pipeline (SSoT)

Only applies if the repo uses Visant's pipeline (`copy*.json` at the root plus
`copy:build` / `copy:check` scripts). Section 6 shows how to set it up in a repo
that does not have it yet, if that is ever the task.

Index:
1. The contract
2. Running
3. Adding or renaming a key
4. Registering a new page
5. Check errors and what each means
6. Setting up the pipeline in a repo that lacks it
7. Where the price really lives

---

## 1. The contract

One copy JSON per page, at the repo **root**. It is the only source.

```
copy.json        → index.html      → docs/COPY.md         (Visant Club landing)
copy.ebook.json  → ebook.html      → docs/COPY-EBOOK.md   (e-book landing)
```

- The JSON is **data**. The `.html` and the `.md` are **generated views**.
- Key = `data-copy` attribute in the HTML = layer name in Figma. All three match
  on purpose: a word can be traced from Figma to deploy.
- Injection happens at **build time**. Hydrating copy in the browser
  (`fetch('copy.json')` after paint) caused content flash and CLS, and let the
  HTML drift from the JSON without the check noticing. Do not go back to it.
- One JSON per page is mandatory because the check requires **every JSON key to
  be used in its HTML**. A shared file would fail one landing because of another's
  keys.

## 2. Running

```bash
npm run copy:lint    # language tics (OUTSIDE the gate, run by hand)
npm run copy:build   # injects into the HTMLs and regenerates COPY*.md
npm run copy:check   # exit 1 if any view diverges
npm run check        # the full gate (fonts, copy, price, csp, links, lint)
```

`copy:lint` stays out of `check` on purpose: a language tic is an editorial
decision, and blocking a deploy over a comma stalls an urgent price fix.
`copy:check` stays in the gate, because an out-of-sync HTML is a real bug.

`build` and `check` use the **same** render function, so the check cannot pass
with a stale HTML.

Always commit the three together: `copy.json` + `index.html` + `docs/COPY.md`.

## 3. Adding or renaming a key

Naming: `section.element` in lowercase, with the section prefix registered in
`PAGES[].sections` of `scripts/copy.mjs`. Item numbering uses two digits when
order matters (`inside.item01.title`).

Adding:
1. Key in the JSON, inside its section's block.
2. `data-copy="section.element"` on the HTML element. Whatever is handwritten in
   the HTML can be anything: the build overwrites it.
3. `npm run copy:build`.

Renaming: change both places in the same commit, or the build aborts with an
orphan key (which is the desired behavior).

**Injecting into an attribute (meta tags):** `data-copy-attr="content"` on the
element makes the build write the attribute instead of the node content. That is
what puts SEO and social in the SSoT:

```html
<title data-copy="meta.title">…</title>
<meta name="description" data-copy="meta.description" data-copy-attr="content" content="">
<meta property="og:title" data-copy="meta.og_title" data-copy-attr="content" content="">
<meta name="twitter:title" data-copy="meta.og_title" data-copy-attr="content" content="">
```

Several elements can point to the **same key** (og: and twitter: share a value).
Block keys: `meta.title`, `meta.description`, `meta.og_title`,
`meta.og_description`, `meta.og_image_alt`. Loose in the `<head>`, these tags
drift silently: a description can announce for months a headline that already
changed.

**Line breaks:** `\n` in the JSON becomes `<br>` in the HTML. Everything else is
escaped (`&`, `<`, `>`, `"`), because copy is content, not markup. For bold
inside a paragraph, split into two keys or use CSS on the element, never a tag
inside the JSON.

## 4. Registering a new page

It only needs an entry in `PAGES` in `scripts/copy.mjs`:

```js
{
  copy: 'copy.nova.json',
  html: 'nova.html',
  md: 'docs/COPY-NOVA.md',
  title: 'Nome da página, Landing Copy',
  note: 'Aviso que vai no fim do MD gerado (ex.: de onde vem o preço real).',
  sections: { nav: 'Nav', hero: 'Hero', /* prefix → human title */ },
}
```

If a prefix is missing from `sections`, the MD still generates (using the raw
prefix as the title), so nothing breaks, it just looks bad. Register it.

## 5. Check errors

The messages are printed in Portuguese by the script.

| message | cause | fix |
|---|---|---|
| `data-copy="x" não existe no copy.json` | HTML asks for a key the JSON lacks | create the key or remove the attribute |
| `chave "x" sem uso no index.html` | orphan key in the JSON | use it in the HTML or delete it from the JSON |
| `index.html está fora de sync` | someone edited text in the HTML, or forgot the build | `npm run copy:build` (text handwritten in the HTML is discarded) |
| `docs/COPY.md está stale` | MD edited by hand or build not run | `npm run copy:build`, and never edit the MD |

## 6. Setting up the pipeline in a new repo

Copying `scripts/copy.mjs` from Visant's landing repo is the shortest path. Single
dependency: `node-html-parser` (keeps the original markup, only rewrites the
content of nodes with `data-copy`). Add to `package.json`:

```json
"copy:build": "node scripts/copy.mjs build",
"copy:check": "node scripts/copy.mjs check"
```

and hang `copy:check` on the general `check` that CI/deploy runs.

In a Next/React repo the same principle holds without the HTML parser: the JSON
is imported and read by key, and the gate becomes "every JSON key is referenced
in some component". What never changes in this pipeline: **interface text is not
written inside the component.**

## 7. Where the price really lives

- **Club landing:** price, founder number and total seats are filled at
  **runtime** by `js/ratchet.js` from `/api/sold`. The copy does not carry those
  numbers. If it still writes "Fundador nº X", unify it to Visionário.
- **E-book landing:** the charged price is resolved on the **server**
  (`api/_config.js` → `PRODUCTS`). The JSON text is display only. If the price
  changes there, it changes here too, in the two or three keys that quote
  `R$ 47` (nav, hero, sample gate, final CTA).

Before approving copy with a number, check it against these sources. Copy that
lies about price is the only kind that causes chargebacks.
