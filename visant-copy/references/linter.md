# copy-lint reference

Commands and the two warnings are in SKILL.md.

## What it accepts

| input | how it reads | where it reports |
|---|---|---|
| `.json` (any structure, must be valid JSON) | every string value, at any depth | the dotted key (`hero.title`) |
| code (`.js .jsx .ts .tsx .mjs .cjs .vue .svelte .astro`) | line by line, comments masked | `L<n>` |
| any other text (`.md`, `.html`, `.txt`) | line by line, no masking | `L<n>` |

- **Files or folders**, one or many. A folder is walked for the types above,
  skipping `*.generated.*`, `node_modules`, `.git`, `.next`, `dist`, `build`, `out`, `coverage`
  and dot-folders.
- Invalid JSON or a missing path stops with a one-line error and exit 1.
- Emoji runs on every file. Semicolon and pipe separator run **only on
  `.json`** (in `.md` the pipe is a table, in code `;` is syntax).
- Flags: `--summary` (counts per rule and file, for audits), `--skip=text` (drops
  paths containing the text, repeatable), `--quiet` (exit code only, for CI), `--include-comments` (lint code
  comments too), `--self-test` (every PT and EN rule fires, clean sentences pass).
- **Ids are English**, `pt-`/`en-` when language-specific (`pt-not-x-but-y`,
  `en-hype`), bare for punctuation (`em-dash`, `bullet-separator`, `semicolon`).
  Old PT ids (`travessao`, `bolinha`) still work in config. EN hype needs a
  marketing object: "Unlock account" passes, "unlock your potential" fails.
