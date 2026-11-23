# Cases that became rules

Stories explaining why a rule in SKILL.md exists. The rule lives there; this file
only holds the context, for whoever wants to understand it before disagreeing.

## Repetition budget per piece

The `credibility-seal` rule (formerly `selo-de-credibilidade`) has a limit of 1, and the limit is per page. Run
on an app's `pt-BR.json` (5173 keys, dozens of independent screens), it flagged
11 occurrences as if they were the same piece. A rule that shouts 11 times
teaches people to ignore the linter, which is worse than not having the rule.

Two fixes came out of it: the JSON group became the first key segment, and
"real"/"reais" as money left the count. After that, the same file returned three
groups of 2 and 3 occurrences, each one inspectable, instead of a block of 11
nobody reads.

## The wrong task on the fold

On a landing for a mockup library, the product sold the render, but the
designer's time went into **finding** the file. The headline swapped the state
("Você tem centenas de mockups parados no disco.") for the task ("Ache o mockup
certo sem abrir um PSD."), and the render moved down to the body, as a
consequence of having found it. The three rows are in the before/after table of
`voice.md`.

## Echoes in a React landing

On a landing with copy inside the components, changing only the `<h1>` left the
social card (`opengraph-image.tsx`) and the `<title>` selling the old promise.
That is how those two rows went to the top of the "where echoes hide" table.

## The skill was stricter than the author

The voice was written from one landing, then compared with the studio's own essay,
manifesto and post. "Para" won where the skill demanded "pra", "eu" appeared
where it restricted first person, and sentences ran longer than the stated 12
words. The landing was right for a landing. Hence the registers, and hence
"copy the traits, never the slips": the same originals also carry a loose hyphen and
three seals.

## Linter green, line empty

On the skills page, `Audita antes do PR` passed every rule. A visitor still had no
idea what they would get. The same audit ran the linter over `src/`: 2,206 lines of
output, most from generated JSON, deliberate bad samples and CLI commands. So
`--summary`, `--skip` and the skipping of `*.generated.*` exist, and
[audit.md](audit.md) starts from what is painted on screen.

## The owner renamed the course

A 39-lesson course had names that confused its own author: topics ("Onde
construir e Efeitos Visuais"), series prefixes ("Exemplo 02: ..."), and a module
numbered 3.x sitting in fifth place. A suggested pass, built from each lesson's
description and the opening of its transcript, went into a spreadsheet with a
"new name" column the owner could edit. Comparing his final column with the
suggestion is where the rules in
[voice.md → Naming a lesson](voice.md#naming-a-lesson-module-or-list-item) came
from:

| Suggested | Owner's final | What it taught |
|---|---|---|
| Por que a gente usa IA: tempo | O tempo é nosso ouro (kept) | a title with voice stays |
| IA sem perder a tua cara | Sua ferramenta, IA que cria do seu jeito | "sua" over "tua"; ownership over fear |
| App de halftone no Google AI Studio | Onde experimentar com IA sem custo | gain over tool name, for beginners |
| Dar memória ao agente | Não deixe seu agente esquecer, crie uma memória | problem, then move |
| Transformar o que deu certo numa skill | O que deu certo pode virar uma skill | possibility over order |
| Site 5: publicar | Publicando o site | no series prefix; gerund for the doing |
| O que fica com você (module, kept in suggestion) | Onde nosso tempo vale mais? | the reader's question as a module name |
| Onze serviços pra vender com o que você aprendeu | Como vender e faturar com a IA? | money said plainly, no count |
| Na prática: do Drive pro Figma, sem mão | Demanda no Figma + Drive (MCP) | working noun stays, cute slang goes |

He also wrote "Na prática:" on three lessons; `copy:lint` flagged it as a
repeated seal and he chose to drop it. 17 of the 39 suggested lesson names went
through word for word and most of the rest kept the suggestion's idea, so the
pass is worth doing; the owner's column is what calibrates it.

## Quotes are not edited

The linter skips keys ending in `quote`, `quote_by` or `depoimento`. A quote is a
person's words, attributed and verifiable, and rewriting it to fit a style rule
is falsifying a testimonial. A recorded quote on a Visant landing matched the
"não é" rule and still had to stay exactly as it was said. The length warning
still applies, since trimming a quote with ellipses is a legitimate editorial
call.
