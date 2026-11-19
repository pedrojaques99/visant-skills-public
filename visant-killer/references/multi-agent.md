# Several agents at once

A T3 target split across parallel agents breaks in four known places, and each
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

## The seam belongs to nobody

Exclusive ownership protects each file, not the joints between them. In one round
five agents each came back green on their slice (types, tests, lint), and three
adversarial reviews found 24 bugs (12, then 10, then 2), every one of them between
slices. So after parallel agents, one [fresh reviewer](devils-advocate.md#fresh-reviewer)
reads the **whole diff**: it gets the code and never the authors' defense, and it
gets the seam classes that showed up, to hunt for by name:

- **A hidden panel still reads and writes the URL.** Tabs kept mounted while
  hidden (keep-alive) share generic params (`?search=`, `?sub=`): one tab's search
  filtered another behind it, and a tabs hook canonicalized the URL while hidden,
  writing into the neighbor's address.
- **An inner tab stacks history.** A panel's own tabs pushed entries, so "back"
  reopened the panel it was supposed to close.
- **One rule, two implementations.** The same "day" computed in UTC in one place
  and in local time in another: each slice is right, and they disagree at midnight.

## Baselines

If the repo has a CI ratchet ([gates.md](gates.md#ci-ratchet)), re-record the
baseline once, by whoever closes the round, after all edits.
