# Verification tools: `verify-screens`, `corta-scan`, `corta-url`

Detail behind Step 5 of [SKILL.md](../SKILL.md). Before any measurement, the four
signals in [environment.md](environment.md).

## `verify-screens.mjs`: the app behind login

Opens each route logged in, at the requested widths and themes, and per screen
measures document overflow, `corta-scan`, raw i18n keys, console errors and
`pageerror`, 4xx/5xx responses from `/api`, an empty screen, and whether the
theme applied. Saves a screenshot and `report.json`. Run it from the target repo
(it resolves Playwright from there):

```bash
V=~/.claude/skills/visant-killer/scripts/verify-screens.mjs
node $V                                        # navConfig routes, 1366+390, dark, dev-login
node $V --routes home,apps,references --theme both
node $V --scan-paid                            # useEffect that calls paid AI: lock candidates
node $V --self-check                           # parsing only, no browser
```

- **Routes in Git Bash go without a leading slash** (`apps`,
  `settings/api-keys`): MSYS rewrites `/apps` into `C:/Program Files/Git/apps`,
  and `MSYS_NO_PATHCONV=1` breaks the script's own path.
- **Paid-route lock, two layers.** A route in `--skip-paid` (default `/naming`)
  is never opened, and on **every** route a POST to a paid endpoint is aborted in
  the browser and reported as `PAID-BLOCKED`. The second layer catches the paid
  route nobody listed. `--allow-paid` turns both off, and is used only knowing
  who pays. Found a new route that spends on load: add it to
  `DEFAULT_SKIP_PAID`. Why: [cases.md](cases.md#the-paid-route).
- `BLANK-SCREEN` is re-measured once before becoming a finding (it is almost
  always the dev server recompiling), and `api4xx5xx` does not fail on its own:
  a local backend has broken routes that are not the screen's.

Outside the app (published URL, no login): `corta-url.mjs <base> route route`.

## `corta-scan.js`: what the eye misses on an open screen

Paste it in the console of an open screen: `corta('.panel')` returns
`element:reason` for a word eaten by a clipping parent, an overlay covering
another in the same corner, and a piece that left its box. No static detector
sees this: the width of a word only exists after the font loads.

It separates three things the eye confuses, and the separation is the value:

- scrolling is **not** a cut;
- ellipsis and `line-clamp` are **not** a cut;
- a rail that scrolls sideways is **not** a cut;
- and a small badge (< 25% of the area) over an `inset-0` background with
  nothing interactive is **not** a stacked overlay.

Locked in `scripts/fixtures/clip-cases.html`:

```bash
node ~/.claude/skills/visant-killer/scripts/corta-self-test.mjs
```

Run it from the target repo (it resolves `playwright-core`/`playwright` from the
cwd, with the npx cache as backup). Without either it says `NOT TESTED`, which
is not a pass.

Per-check detail lives in `visant-frontend/references/verification.md`.

## `ritmo-scan.js`: spacing that lies about grouping

Same harness, same two ways (`ritmo()` in the console, or `$V` /
`corta-url.mjs`, which print it as `spacing`). Three rules, all measured on ink
(line boxes, media, boxed regions), never on CSS boxes:

- `proximidade-invertida`: a group's inner gap is larger than the gap that
  separates it from its neighbors. Reports the ink and the authored numbers,
  and the fix.
- `ritmo-chato`: three nested groups with the same gap (catalog 6).
- `irmaos-desalinhados`: identical siblings with a different padding/gap, or one
  gap in a regular list off by 2-8px. More room before a heading is a decision
  and stays silent; so does a drift larger than 8px.

What it separates, and the separation is the value:

- a card (background, border or shadow) is its own region: common region beats
  proximity, so boxed groups are never "inverted";
- `aria-hidden` subtrees are illustrations drawn in DOM, not the interface;
- a stack with a gap above 96px is page layout, not a component;
- an off-scale value is NOT its business (see gates.md "Spacing: two layers").

Locked in `scripts/fixtures/spacing-cases.html` by the same
`corta-self-test.mjs`.
