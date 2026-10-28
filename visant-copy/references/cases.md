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

## Quotes are not edited

The linter skips keys ending in `quote`, `quote_by` or `depoimento`. A quote is a
person's words, attributed and verifiable, and rewriting it to fit a style rule
is falsifying a testimonial. A recorded quote on a Visant landing matched the
"não é" rule and still had to stay exactly as it was said. The length warning
still applies, since trimming a quote with ellipses is a legitimate editorial
call.
