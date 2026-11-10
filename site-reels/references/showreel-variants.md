# Showreel variants

Deep technique for each kind of showreel, once the plates/footage exist (see
`SKILL.md` → Run / `snap.mjs` / Product showreel capture). Pick the variant
that matches the brief; each is independent, don't borrow tempo/structure
across them.

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

## Brand film in HyperFrames (code-only: logo reveal + branding burst)

Validated on Clube® (24.7s, 1920×1080, 30fps). Use when the brief is "logo reveal / branding film
like the Kargul reference" and the identity must feel built, not slid in. Remotion plates above
stay for site recordings; this is for fully designed films.

**Structure that worked** (one language, hard cuts on a beat grid, no labels):
1. **Logo reveal, 3–4 camera angles** on the real vector: extract anchors/handles from the SVG
   (`svg-pathdata`), draw outline by `pathLength` dash (set `pathLength` as an attribute, not a
   GSAP property), then anchors, fill, solid. Camera = CSS 3D (`perspective`) over a perspective
   grid; change angle on beats, never just slide in.
2. **Burst of applied identity**: each screen a different layout (full, split, giant word, ticker,
   palette, track, checker, circuit, b-roll). **Never repeat a mockup**; if the idea runs out,
   shorten the film. B-roll only as duotone (brand ink + accent via ffmpeg) with the logo on top.
3. **Bento scene** with real brand media (the spinning 3D emblem video, colorkeyed over the card)
   and animated bits (runner on a path skeletonized from the image, pings on nodes).
4. **End card with depth, not a static hold**: after the hit, extruded logo (8 offset copies,
   darker tint), slow push-in + 3D sway (`transformPerspective`, rotationY −12→12), drifting
   light + vignette, ® pop. Never leave the last 3s still.

**Tempo**: map the film to a beat grid (`plan.json`, ramp ~100→138 BPM); scenes, wipes and the
final hit snap to it. Sound (SFX, break track, stems as Studio lanes, levels) lives in
[[sound-design-de-sfx-para-motion]]; render, loudness and delivery in
[[render-e-entrega-de-reels-hyperframes]].

**Workflow rules**:
- The generator (`montar.mjs`) writes `index.html` + scene files; once the user edits in the
  Studio, **never regenerate over it**. Diff first (normalize `data-hf-id`, style spacing):
  back up, regenerate, report real differences per scene, restore. Edit the single scene file
  and mirror the change in the generator.
- Grain: coarse and slow (`opacity ~.28`); fine grain made a 248MB file. CRF 22.
- Lint traps: no video nested in a timed wrapper, don't tween `letterSpacing`, nested `.clip`
  must be visible, no duplicate `<img>` discovery, media must not run past EOF.
- Check with `hyperframes check`, then `snapshot --at` at the last 3s and each scene change and
  **look** at the contact sheet; render only after.
- Feedback that shaped it: too long on b-roll, repeated mockups, empty screens, heavy grain,
  intrusive cut sounds, keyboard SFX rejected (use mouse clicks/drags + engine).

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
