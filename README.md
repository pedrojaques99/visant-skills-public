# visant-skills-public

[Claude Code](https://docs.claude.com/en/docs/claude-code/skills) skills from
[Visant](https://visantlabs.com): how to decide interface, motion and copy, how
to audit a screen before the PR, and how to cut video, from a recorded website
to a Premiere rough cut. They work in any repo: each skill first discovers what
the target repo already has (gates, primitives, tokens) and only then acts. The
detectors are real scripts, and `npm test` proves every rule both ways against
fixtures.

## Install

```bash
npx skills add pedrojaques99/visant-skills-public                       # pick from the list
npx skills add pedrojaques99/visant-skills-public --skill visant-killer # just one
```

Or copy a skill folder into `~/.claude/skills/`. Then just ask, in English or
Portuguese: "audit this screen", "tá com cara de IA", "make this smoother",
"edit this lesson".

## What the killer catches

A typical AI pricing card, in a shadcn project with no design lint of its own:

```tsx
<section className="border rounded-2xl p-8">
  <span className="font-mono text-xs uppercase tracking-widest text-white/50">01 / Pricing</span>
  <h1 className="text-5xl font-serif tracking-tighter">Design that <em>converts</em></h1>
  <p className="text-white/70">Unlock your full potential — a revolutionary way to ship.</p>
  <div className="border rounded-xl p-4 text-purple-500">
    <span className="text-white/40">per month</span>
    <span className="text-white/90">$49</span>
  </div>
</section>
```

```text
$ node visant-killer/scripts/killer-scan.mjs demo/src

[OK]      impeccable   (AI tell)     zero
[FAIL]    audit:design (token)       1 finding(s)
            src/Pricing.tsx:7  tailwind-palette  <div className="border rounded-xl p-4 text-purple-500">
            via killer-scan built-in FALLBACK; token layer found (shadcn components.json): palette classes bypass it
[FAIL]    copy         (tic)         2 finding(s)
            src/Pricing.tsx:6  em-dash
            src/Pricing.tsx:6  en-hype
[FAIL]    noise        (chrome)      3 finding(s)
            src/Pricing.tsx:5  italic-headline-word  <em> italic inside <h1> headline
            src/Pricing.tsx:5  display-serif-tight  display serif + negative tracking
            src/Pricing.tsx:4  opacity-ladder  text-white: /50 /70 /40 /90

gates: 4/4 ran [impeccable, audit:design (fallback), copy, noise]; none skipped
GATE CLOSED: 3 detector(s) with findings. A gate finding becomes a fix, not a proposal.
```

That is only the script half. The skill then judges what no detector sees
(does each element move a business variable?), opens the screen in a browser,
argues against its own verdict and scores the result.

## Tested on repos we don't own

Every detector was run, from outside, on three public Next.js projects with no
Visant code, then calibrated until what remained was defensible:

| Repo | Token gate | Noise gate | Distribution |
|---|---|---|---|
| [vercel/commerce](https://github.com/vercel/commerce) | passes: no token layer, Tailwind palette used as the design system (3 neutral, 3 accent hues) | 2: `hover-lift` on a product image and gallery buttons | 1 LOW: checkout hands off to Shopify, no `begin_checkout` event |
| [shadcn-ui/taxonomy](https://github.com/shadcn-ui/taxonomy) | 9: palette classes that bypass its CSS-variable tokens (`text-red-600`, `bg-slate-50`) | 2: a hand-drawn lucide `Shield` while lucide-react is installed; "Enter your email below…" | 1 HIGH (public routes without description), a route without title, no sitemap |
| [steven-tey/precedent](https://github.com/steven-tey/precedent) | 4 raw hex (Twitter blue as a one-off class, a gauge circle) + 1 palette-chaos finding (4 accent hues) | 2: the Vercel triangle, a CTA that grows on hover | clean |

What the calibration fixed, so it holds on any repo: palette classes only count
as a bypass when there is a token layer to bypass; SVGs in an `icons/` folder
and brand logos are not "hand-drawn icons"; components are never routes; a
hosted checkout is not an unmeasured form. Each fix is locked by a fixture.

## Interface

| Skill | What it does | Needs |
|---|---|---|
| [`visant-killer`](visant-killer/SKILL.md) | **Start here.** Anti-slop UI audit: detectors as a hard gate, judgment through the skills below, a devil's advocate pass and a score | Node 20+; Playwright optional (screen checks) |
| [`visant-frontend`](visant-frontend/SKILL.md) | Interface decisions: every element names the business variable it moves, or it goes | nothing |
| [`visant-motion`](visant-motion/SKILL.md) | Easing/duration tokens for CSS and framer-motion, `motion-lint`, URL measurement | Node 20+ |
| [`visant-refine`](visant-refine/SKILL.md) | Charts, gauges, sparklines, sliders and metric tiles with one shared anatomy | Node 20+ |
| [`visant-copy`](visant-copy/SKILL.md) | Brazilian Portuguese copy in a spoken voice, with `copy-lint` against AI tells in PT and English copy | Node 20+ |

## Video

| Skill | What it does | Needs |
|---|---|---|
| [`site-reels`](site-reels/SKILL.md) | Records a website's best scenes (WebGL hero, scroll, 3D) as 1080p MP4 and builds brand or product showreels in Remotion | Chrome or Edge, ffmpeg, Node |
| [`visant-premiere-editor`](visant-premiere-editor/SKILL.md) | Builds the rough cut in Premiere Pro from a JSON cut plan: frame-exact cuts, markers, punch-ins, cards, b-roll, -14 LUFS delivery | Premiere Pro + [premiere-pro-mcp](https://github.com/leancoderkavy/premiere-pro-mcp), Python |
| [`visant-video-editor`](visant-video-editor/SKILL.md) | Vlogs, event videos and lessons from raw footage: breakdown, silence cuts that never clip a word, loudness, chapters | bash, ffmpeg, Python, faster-whisper |

## Process

| Skill | What it does | Needs |
|---|---|---|
| [`visant-methodology`](visant-methodology/SKILL.md) | Visant's 9-stage brand-building method and the dependency cascade between stages | nothing |
| [`visant-preflight`](visant-preflight/SKILL.md) | Preflight for a big project: one question round plus five premise checks (source of truth, fonts, photo resolution, brand files, sourced numbers) | Node 20+ |
| [`visant-mcp-connect`](visant-mcp-connect/SKILL.md) | Connects and runs the Visant Labs MCP | a Visant Labs account |

Each SKILL.md opens with its exact requirements and how to check them.

## Pair it with the library

The interface skills look for a finished piece before writing one:
[**@visant/ui**](https://ui.visantlabs.com), 150+ React components in a shadcn
registry, already through `visant-killer`. The code lands in your project; it
is not an npm package.

```bash
# components.json → "registries": { "@visant": "https://ui.visantlabs.com/r/{name}.json" }
npx shadcn@latest add @visant/gauge
```

Index for agents: [ui.visantlabs.com/llms.txt](https://ui.visantlabs.com/llms.txt).

## Run the detectors yourself

Node 20+, no build step.

```bash
npm install
npm test                                              # every detector's self-test, both ways
node visant-killer/scripts/killer-scan.mjs <app/src>  # the whole gate, from any folder
node visant-motion/scripts/motion-lint.mjs <app>
node visant-copy/scripts/copy-lint.mjs <file-or-folder>
bash visant-video-editor/scripts/self-test.sh         # needs ffmpeg
```

## Credits

Much of this stands on other people's work. Each skill credits its sources in
its own text; the summary:

| What | By | Used in |
|---|---|---|
| [impeccable](https://impeccable.style) | Paul Bakaus ([pbakaus/impeccable](https://github.com/pbakaus/impeccable)) | `visant-killer` gate |
| [revenue-centric-design](https://github.com/heliocosta-dev/revenue-centric-design) | principles by Richard ([@richardrx](https://x.com/richardrx)), packaged by heliocosta-dev | `visant-frontend`, `visant-killer` |
| [Emil Kowalski skills](https://github.com/emilkowalski/skills) | Emil Kowalski ([animations.dev](https://animations.dev)) | `visant-motion` principles |
| [agent-skills](https://github.com/vercel-labs/agent-skills) (`vercel-react-view-transitions`) | Vercel | `visant-motion` |
| [premiere-pro-mcp](https://github.com/leancoderkavy/premiere-pro-mcp) | premiere-pro-mcp contributors | `visant-premiere-editor` |
| [OpenTimelineIO](https://opentimeline.io) | Academy Software Foundation | `visant-premiere-editor` (FCP7 XML) |
| [Simple Icons](https://simpleicons.org) (CC0) | Simple Icons contributors; marks belong to their owners | `visant-premiere-editor` card logos |
| [Remotion](https://www.remotion.dev), [puppeteer-screen-recorder](https://github.com/prasanaworld/puppeteer-screen-recorder), timesnap | Remotion; prasanaworld; Tungs | `site-reels` |
| [FFmpeg](https://ffmpeg.org), [auto-editor](https://github.com/WyattBlue/auto-editor), [faster-whisper](https://github.com/SYSTRAN/faster-whisper) | FFmpeg; WyattBlue; SYSTRAN | `visant-video-editor` |
| [shadcn/ui](https://ui.shadcn.com), [Radix](https://www.radix-ui.com), [Playwright](https://playwright.dev) | shadcn; WorkOS; Microsoft | `visant-killer`, `visant-frontend` |

Slop signals 47–57 in the killer's catalog are by Pedro Jaques. Missing
someone? Open an issue.

## How this repo is made

This repo is the source: these skills live nowhere else. Every commit passes a
gate that blocks client names and a secret scanner
([gitleaks](https://github.com/gitleaks/gitleaks)); real client cases appear
anonymized ("client K"). PRs welcome.

```bash
node link.mjs            # Windows: which ~/.claude/skills folders already point here
node link.mjs --apply    # point them here with junctions (needs a clean git tree)
```

## License

MIT, see [LICENSE](LICENSE). Third-party tools and skills credited above keep
their own licenses.
