---
name: site-reels
description: 'Records the best scenes of a website or web app (WebGL hero, 3D, scroll) as 1080p MP4 for decks, uploads them to Figma Slides, and builds brand or product showreels in Remotion. Use on "record the site scenes", "site video for the deck", "showreel", "launch video", "gerar vídeo do site", "vídeo pro deck", "reel do produto", /site-reels.'
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
mkdir -p scripts && cp ~/.claude/skills/site-reels/scripts/{record,find-chrome}.mjs scripts/
cp ~/.claude/skills/site-reels/scripts/scenes.example.mjs scenes.mjs   # edit the scenes
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
cp ~/.claude/skills/site-reels/scripts/{snap,find-chrome,patch-timeweb}.mjs scripts/
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

## Brand showreel (Remotion): plates + designed scenes

For a branding showreel (logo, colors, type, layouts, manifesto, mockups), record only **clean
plates** from the site (no text: per-scene CSS hides title/nav) and compose the rest in
**Remotion** (frame-by-frame render, no jitter). Reusable building blocks worth having in
`src/fx.tsx`: `Mist`, `MistWords`, `Grain`, `KenBurns`, `Plate`, a `nevoa()` (mist) transition,
with brand data in `brand.ts`.

- **Visual identity comes from the deck, not the site**: check official type and palette in the
  slides (sites drift from the brand book).
- Scenes that work: opening phrase in mist, recorded reveal, logo construction (`evolvePath` +
  guides measured on the logo raster), manifesto phrase by phrase, pillars with variable `wght`
  axis, palette in bands, typography, layered graphics, 3D with title in
  `mix-blend-difference`, scrolling layout columns, 1/2/3-up mockup montage, product synced to
  the name, closing on the wordmark.
- Review by **stills** (`npx remotion still ... --frame=N` + montage) before rendering.
- Render with `--concurrency=3`: at 8, with Photoshop open, a 32GB machine ran out of memory.
- Loops: `scripts/loop.sh in out [start] [dur] [crossfade]`. Check the seam with
  `magick compare -metric RMSE` between first and last frame (< 0.5% = invisible).
- Bad plate is a discard: a solid of revolution spinning shows no motion; a camera framed for a
  portrait canvas looks small in 16:9.
- **Frantic reel** (approved rhythm): 25–35s, 60fps, `Series` with hard cuts on a 120 BPM grid
  (30 frames), image bursts every 3–6 frames, giant logo crop over a grid, flashing font weights,
  palette blocks rearranging, portrait in a circular mask, graphic burst, kinetic phrase, one-beat
  mockups, closing logo held ~2.5s. **Zero labels**: text only as graphics. A slow 1:40
  showreel was rejected.
- **Soft/smoky reel**: record the hero smoke **with no logo or photo**, black on pure white
  (scene with `storage` = params in localStorage and `block: ['assets/logo.png']`; the blank PNG
  must be transparent; **do not block the video**: a broken video freezes timeweb). Use the plate
  as a `mix-blend-mode: multiply` overlay: opens at the start of the scene, an inverted version
  (`ffmpeg -vf reverse`) closes it; the cut lands on black. Transition at ~1.1s (rate 2), or
  half the scene goes black.
- **Figma Slides layouts assembling**: clone the slide (skipped), duplicate each card 3x with only
  background / logo / text visible, download each node with `download_assets` (scale 2) and delete
  the clones. Slides **does not export transparency**: export logo/text with the slide black and
  then white and extract alpha by difference (ImageMagick). Never return base64 through
  `use_figma` (blows the context).

## Product showreel (real app filmed)

Screens are filmed for real (Playwright + CDP screencast at 2x, steps
`goto/move/click/type/scroll/wait`, pointer trail saved as `<id>.cursor.json`) and the cursor is
redrawn in Remotion on top.

**Rejected, do not repeat:**
- **Gluing a designed reel to the real screen** (illustrated opening + filmed middle + drawn CTA):
  two languages, the character vanishes and returns, the black card between acts stops the rhythm.
  One language per video.
- **Small, sped-up product screen** in a 16:9 window: feed and ranking become an unreadable wall.
- **Zoom that crops the screen** and **text stamped over the video** (giant verb, 01/07 counter,
  gradient): intrusive.
- Empty waiting on screen ("waiting…"): cut straight to the action.
- Vague copy: it has to be obvious and in the audience's plain spoken language.

**The form that works:** per action, **text alone first**, centered and short (2 beats), **then
the whole screen, uncropped**, in a centered window at the capture aspect, on a clean background.
Discreet text (weight 700, per-word entry with light blur), no counter, no gradient. Cuts on the
track grid (14 frames = 128.57 BPM). 40s max.

**Technique that paid off:**
- Speeding a capture: `<OffthreadVideo trimBefore={from} playbackRate={rate}>` and recompute click
  frames `/ rate` (sound and cursor ring).
- Starting another composition mid-way: `<Sequence from={X}><Sequence from={-start}><Comp/></Sequence></Sequence>`.
  Check the first frame of the stretch: a shared element "flying" in shows up loose. Skip a few
  frames and re-place the impact sound that fell before.
- Language per composition with a module-level timeline: a `globalThis` flag set by its own entry
  file imported before the Root.
- Continuous track across cuts: `trimBefore` on the bed so it continues from where the previous
  stretch stopped.
- Loudness: render, measure and normalize with 2-pass `loudnorm` (-14 LUFS / -1 dBTP), copying
  the video. Measure only at the end: Remotion's raw mix goes over 0 dBFS.
- Audit: timestamped contact sheet (`fps=2,drawtext=%{pts\:hms},tile=8x6`) of every render, and
  a dense sheet (fps=6) at every stretch junction.
- A project without git, edited by another session at the same time: new cut in a new file,
  `*.bak-*` backup before editing a shared file, and tell the user.

## Portfolio cards and studio reel

- `record.mjs` with `KEEP_UI=1` (the card shows the site as it is) and the phone preset above.
- Scenes generated from an inventory file (only public items with a live URL); no live URL =
  Ken Burns of the screenshot.
- Card package: crossfade loop from end to start, 2-pass bitrate to a KB ceiling, VP9 WebM
  alongside, WebP poster of frame 1.
- Logo with alpha for the web: `--codec=vp9 --pixel-format=yuva420p` (Safari does not play it) +
  ProRes 4444 for editing; `Config.setVideoImageFormat("png")` keeps the alpha.
- Cut-out/stop-motion look in Remotion: time quantized on twos (24 fps, pose every 2 frames), SVG
  filter per pose (feTurbulence + feDisplacementMap on the edge, feMorphology for a cream border,
  hard offset shadow) with 3 seeds cycling ("boil"), paper texture in multiply. Mascot parts read
  by id from the designer's SVG (DOMParser), so a new branding version drops in without code.
- CC0 music: Free Music Archive (CC0 albums). Tempo and fullest stretch with
  `librosa.beat.beat_track` + windowed RMS (Python, optional).

Origin stories, reference projects and machine-specific tips: `references/cases.md`.
