# Auditing copy

The linter finds tics. Most bad lines have none. An audit reads what the visitor
reads and answers four questions per line, in the order below.

## 1. Get the real text

List what is painted on the screen, per route: headings, leads, buttons, captions,
sheets, `<title>`, social card. Leave out deliberate bad samples, generated files
and code. For a large page, delegate the listing and keep the text verbatim.

Then run the tic map, without the noise:

```bash
L=<skill-dir>/scripts/copy-lint.mjs
node $L --summary src/                # counts per rule and per file
node $L --skip=samples src/app/page   # drop paths containing "samples"
```

`*.generated.*` is already skipped when walking a folder. Many findings and almost
none real means the target is wrong or the rule is: read before reporting a count.

## 2. The four questions

| question | how it fails | example |
|---|---|---|
| **Would a stranger know what they get?** | the line describes the mechanism, a noun list, or inside vocabulary | `Audita antes do PR`, `Movimento e espera`, "portão aberto" |
| **Is it true?** | the claim promises more than the product does, or the demo beside it contradicts it | "altera tudo sozinho" next to "Audita e não muda nada" |
| **Does the page agree with itself?** | the same fact changes between routes: a count, a price, a name | "6 skills" on one route and "12 skills" on another |
| **Does it sound like someone?** | correct and impersonal: no scene, no number, no position, wrong register | a sentence any competitor could sign |

Check claims against the code or the skill itself, and numbers against their source
of truth. If the source is unknown, ask and mark the row as pending.

## 3. Deliver a table

An audit changes nothing yet: tics are rows too, and you end by asking which to apply.

| where | today | fails | proposal |
|---|---|---|---|
| `file:line` | exact text | which question | a line ready to paste |

Order by what the reader sees first and by harm: false claims first, then what sits
above the fold, then the rest. Say which routes were not read. A page with no
problems is a valid result, and padding the table is not.
