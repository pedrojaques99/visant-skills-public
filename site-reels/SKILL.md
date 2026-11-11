---
name: site-reels
description: 'Records a site/app''s best scenes (WebGL, 3D, scroll) as 1080p MP4, uploads to Figma Slides, and builds brand/product showreels in Remotion or HyperFrames (logo reveal + branding burst). Use on "record the site scenes", "site video for the deck", "showreel", "launch video", "gerar vídeo do site", "vídeo pro deck", "reel do produto", /site-reels.'
metadata:
  family: video
---

# Site Reels: site → MP4 → deck

## Requirements

| Needed for | What | Check |
|---|---|---|
| everything | Windows, macOS or Linux with a GPU and a visible desktop (Chrome runs headful) | n/a |
| everything | Node.js 18+ | `node -v` |
| everything | ffmpeg + ffprobe on PATH (or `FFMPEG=<full path>`) | `ffmpeg -version` |
| everything | Chrome, Chromium or Edge (auto-detected, see below) | `node -e "import('./scripts/find-chrome.mjs').then(m=>console.log(m.findChrome()))"` |
| `record.mjs` | `puppeteer-core` + `puppeteer-screen-recorder` (npm, in the project) | `npm ls puppeteer-core puppeteer-screen-recorder` |
| `snap.mjs` | `puppeteer-core` + `timesnap` (brings `timeweb`) | `npm ls timesnap` |
| showreel | Remotion project | `npx remotion --version` |
| audits (optional) | ImageMagick | `magick -version` |
| Figma upload | Figma MCP (`use_figma`, `upload_assets`) + skills `figma-use`, `figma-use-slides` | MCP tool list |

**Chrome detection** (`scripts/find-chrome.mjs`, used by `record.mjs` and `snap.mjs`): `CHROME`
env var if set; else installed Chrome/Edge (Windows: Program Files and LocalAppData; macOS:
`/Applications` and `~/Applications`; Linux: `google-chrome`, `chromium`, `microsoft-edge` on PATH);
else the newest `ms-playwright/chromium-<N>` (or `PLAYWRIGHT_BROWSERS_PATH`); else it stops and
tells you how to set `CHROME` or run `npx playwright install chromium`. On Windows it adds
`--use-angle=d3d11`; on other OSes Chrome keeps its default GPU backend.

## What it does

Records scripted scenes of a site running locally and delivers MP4s ready for Figma (1920×1080,
30fps, x264, < 100MB). Validated engine: **puppeteer-core + puppeteer-screen-recorder** (CDP
screencast + ffmpeg). Never screen-record.

## Run

```
mkdir <proj>-reels && cd <proj>-reels && npm init -y && npm i puppeteer-core puppeteer-screen-recorder
mkdir -p scripts && cp <skill-dir>/scripts/{record,find-chrome}.mjs scripts/
cp <skill-dir>/scripts/scenes.example.mjs scenes.mjs   # edit the scenes
# in the site repo: npx next build && npx next start -p 3100   (production build: smoother WebGL)
OUT="<output folder>/Videos" node scripts/record.mjs scenes.mjs [scene ...]
```

Run the scripts **copied into the project**: ESM resolves `puppeteer-core` from the script's
folder, not from the cwd.

Env: `BASE` (default `http://localhost:3100`), `OUT`, `CHROME`, `FFMPEG`, `W`, `H`, `DPR`,
`MOBILE=1` (touch emulation), `KEEP_UI=1` (keeps the nav), `MIN_FPS` (24). Phone 4:5:
`W=360 H=450 DPR=2 MOBILE=1` gives 720x900.

Each scene = `{ name, path, theme?, trim?, crf?, css?, prepare(page, ctx), act(page, ctx) }`.
`prepare` runs before recording (scroll to the section, wait for 3D to load); `act` is what goes
into the video. `ctx` has `wait`, `scrollTo(page, y|selector, ms)` and
`scrollThrough(page, selector|null, ms, from, to)` with easing. Intro that runs on load:
`page.reload()` inside `act` and use `trim` to cut the loading.

Brand script that works: logo/hero intro (light and dark), hero media swap, 3D section with the
camera entering on scroll, immersive route (walk), footer wordmark and one full page pass.
5–7 scenes of 12–55s.

## Audit before delivering (do not trust the exit code)

- Contact sheet per video: `ffmpeg -i x.mp4 -vf "fps=6/<dur>,scale=480:-1,tile=3x2" -frames:v 1 sheet.png` and **look**.
- 1MB for 19s = blank scene. > 100MB = does not go into Figma (scene `crf` fixes it; 24 for a scene with grain + trails).
- Top strip (`crop=1920:120:0:0`) at several times to catch a leaking nav.
- `LOW-FPS` with a long pause at the start/end is a false alarm (the meter counts still frames); check the contact sheet.
- Designed brand films: run the release-level pass in `references/showreel-variants.md` (one palette via `scripts/duo.sh`, a returning motif, real media before faceless stock, no dead frames). Then `blackdetect` the render and patch isolated black frames with `scripts/tapar-pretos.sh`.

## Known pitfalls

1. **Hidden window freezes rAF** → frozen frames. The launch already passes
   `--disable-backgrounding-occluded-windows --disable-renderer-backgrounding
   --disable-background-timer-throttling --disable-features=CalculateNativeWinOcclusion`.
   `headless: false` on purpose: headless falls back to SwiftShader and WebGL stutters.
2. **Hide-UI CSS disappears** on reload and when React hydration clears `<head>` → the script
   re-attaches a `<style id="reels-hide">` to the body every 100ms.
3. **One invalid selector kills the whole rule**: `\[` in a JS template literal becomes `[` and
   `.z-[60]` invalidates `header, nav, .z-[60]`. One rule per risky selector.
4. **Do not hide `[data-cursor]`**: sites tag the 3D canvas and carousels with it. Target the
   custom cursor element (fixed + mix-blend + pointer-events-none).
5. **Lazy-loaded 3D** (IntersectionObserver + dynamic import): wait 5–7s after reaching the
   section. Reading the WebGL canvas comes back empty without `preserveDrawingBuffer`: use a
   fixed wait or a screenshot.
6. Screencast delivers ~32 unique frames/s → **record at 30fps** (60 gives irregular repeated
   frames). Default `trim` 0.3s drops the first cached frame.
7. **Screencast stutters on a loaded machine** (Photoshop open, parallel render): the MP4 says
   "30fps" with 9–18 unique frames/s. `record.mjs` measures (`mpdecimate=hi=64:lo=24:frac=0.05`)
   and re-records up to 2x below `MIN_FPS` (24). For WebGL/3D plates prefer `snap.mjs`.
8. Cookie banner: accept it in `prepare` (generic click on "Accept/Aceitar/OK") before recording.
9. A tool page without scrolling (generator, effect editor) records still: the scene has to
   **interact** (upload a file to `input[type=file]`, click presets by button text). A custom
   slider does not respond to a synthetic `input`.

## 60fps locked plates: `snap.mjs` (deterministic)

`scripts/snap.mjs` injects **timeweb** (timesnap's virtual clock: rAF, performance.now,
setTimeout and video), advances 1/60s per frame and screenshots. Independent of machine load.
Scene: `{ name, path, theme, css, dur, wait (real ms to load 3D), pre (virtual ms before
scrolling, 2000; **0 for an intro that runs on load**), start (virtual s skipped),
scroll: { sel, from, to, at, len } | { bottom: [from, to] in screen heights },
frame(page, t) (e.g. mouse) }`. Scrolling is a function of virtual time.

```
npm i puppeteer-core timesnap && mkdir -p scripts
cp <skill-dir>/scripts/{snap,find-chrome,patch-timeweb}.mjs scripts/
npm pkg set scripts.postinstall="node scripts/patch-timeweb.mjs" && npm run postinstall
FPS=60 OUT=... node scripts/snap.mjs scenes-snap.mjs [scene]
```

- **Do not use `timesnap()` itself**: with Next + R3F + Lenis it recorded a blank page and left
  frozen stretches on the WebGL hero (rAF does not run). The own loop (goTo + scrollTo +
  screenshot) worked everywhere: 60/60 unique frames.
- **timeweb patch is mandatory**: it swaps `video.play()` for a version with no Promise and no
  `playing` event → `video.play().catch()` throws and the page goes blank.
- `preserveDrawingBuffer: true` forced on getContext (turn off with `preserve: false`).
- Frames go to the OS temp dir, never to a synced drive (thousands of jpgs syncing).
- **No GPU work in parallel** (Remotion render, Photoshop): WebGL loses its context and records
  seconds of background only. The script warns `FLASH` (frame flashing by luminance); a long blank
  stretch only shows on the contact sheet. Look.
- Real smoothness audit: `magick compare -metric MAE` between neighbor frames at full resolution.
  0 = repeated frame.
- Delivery: `scripts/deliver.example.sh` (copy and rename the plates; `V=` required) builds
  reveals, loops (`loop.sh`) and clean 3D, raising crf by 3 until < 95MB.

## Upload to Figma Slides (hidden, without disturbing the team)

The MP4 **does not go in through MCP**: `use_figma` has no network and the Plugin API does not
create video from bytes; `upload_assets` only accepts images (≤ 10MB). So:

1. Cover of each video: `ffmpeg -ss <t> -i x.mp4 -frames:v 1 -q:v 2 _capas/x.jpg`.
2. `use_figma` (skills `figma-use` + `figma-use-slides`): `createSlideRow(idx)` before the final
   slide, `row.name = 'WIP · Motion (hidden)'`, one `createSlide(idx, i)` per video with
   `isSkippedSlide = true`, black background, a 1920×1080 rectangle named `VIDEO · x.mp4` and the
   instruction in `speakerNotes`.
3. `upload_assets` with the rectangles' `nodeIds` → multipart POST of the covers.
4. The user drags the MP4 onto the rectangle (replaces the cover with the video). Say this
   clearly; never promise an inserted video.

`getSlideGrid()` omits skipped slides: check the structure via `SLIDE_GRID.children[i].children`.

## Showreel variants

**Before writing the story of any brand showreel, read [brand-showreel-playbook.md](references/brand-showreel-playbook.md):** what the reference films do, the transition grammar, rhythm and music, and the anti-patterns that scored 2/10 (slideshow, invented grids, ray wipes, piano).

Once plates/footage exist, pick the variant that matches the brief. Full
technique for each → [showreel-variants.md](references/showreel-variants.md).

| Brief | Variant |
|---|---|
| Logo, colors, type, layouts, manifesto, mockups — clean plates + Remotion | Brand showreel (Remotion) |
| "Logo reveal / branding film like the Kargul reference", fully designed | Brand film in HyperFrames (code-only) |
| Real app filmed, cursor redrawn on top | Product showreel |
| Site/portfolio cards, studio reel | Portfolio cards and studio reel |

Origin stories, reference projects and machine-specific tips: `references/cases.md`.

## Neighbors

- **[[visant-video-editor]]**: footage from a camera
- **[[visant-premiere-editor]]**: a rough cut in Premiere
- **[[sound-design-de-sfx-para-motion]]**: SFX, break track and stems for the film
- **[[render-e-entrega-de-reels-hyperframes]]**: HyperFrames render, check and delivery
