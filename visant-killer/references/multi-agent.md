# Several agents at once

A T3 target split across parallel agents breaks in three known places, and each
one has a rule.

## Exclusive file ownership

Each agent gets a list of files (or a folder) and edits only that. A shared
primitive (`src/components/ui/*`, the shell, `index.css`) has ONE owner, and
whoever needs a change there asks instead of editing. Two agents in the same
file means one agent's `Edit` erasing the other's with no error at all.

## i18n by fragment, merged once

Nobody edits `src/locales/*.json` in parallel. Each agent writes
`<folder>/<scope>.json` in the format
`{"pt-BR":{"a.b":"..."},"en-US":{"a.b":"..."}}`, and at the end one agent
merges, once. If the repo has a merge script, use it. The house app's looks like
this:

```bash
node scripts/i18n-merge-fragments.mjs <folder>                  # dry-run: conflicts and single-locale keys
node scripts/i18n-merge-fragments.mjs <folder> --apply
node scripts/i18n-merge-fragments.mjs <folder> --apply --override a.b,c.d
```

The merge never overwrites an existing key: a different value becomes a
conflict in the report. `--override` is an exception named **key by key** (an
approved translation or name), never a general force.

## A shared dev server lies during the round

One agent's HMR recompiles the route another is measuring: an empty screen and
an "unapplied" theme appear and vanish. Measure after edits have stopped, or
re-measure whatever flagged before calling it a bug.

## Baselines

If the repo has a CI ratchet ([gates.md](gates.md#ci-ratchet)), re-record the
baseline once, by whoever closes the round, after all edits.
