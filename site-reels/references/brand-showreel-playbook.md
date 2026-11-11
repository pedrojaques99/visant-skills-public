# Brand showreel playbook (from the reference films)

Read this **before** writing the story or the SPEC of any brand showreel. The guide was distilled from shot-by-shot analyses (decupagens) of the following reference films:
- Arko (Visant)
- Caixa rebrand (Tátil)
- Introducing Claude Opus 5.5
- Unsigned (brand kit / app)
- a glitch y2k reel
- a collage vintage reel
- two component scenes (a metal card and a perspective track)

Each claim cites the film and the second it happens at. The full decupagens live next to the frames in the project's refs folder (`docs/refs/<slug>.md`, with frames in `frames/<slug>/`).

## The one rule
**A showreel is not a slideshow.** A sequence of full-frame mockups with a gentle push-in is the default to avoid. It was scored 2/10.

Every ref changes subject by **transformation inside the shot** or by a **graphic event born from the content**, never by "next picture":
- **Caixa:** 28% of the film (40 s) has no detected cut. An outline becomes a Bézier stroke and then becomes the logo (28–34.5 s), and a single 9.25 s shot goes grid → drawn icon → library → hover.
- **Arko:** the piece becomes the next layout. Photos shrink into palette blocks (6.54–8.21), colours become masks orbiting a portrait (8.21–9.79), and the tunnel's vanishing point becomes the text box (11.29–11.42).
- **Unsigned:** it builds inside the shot. Lines, nodes, typing and pieces enter the frame, so at 37.6 cuts/min it feels faster than it is.

## Structure that works
1. **Brand system before the drop, applications after it.**
   - Arko holds logo, type, palette and shapes for 0–13 s, and cuts to the night street exactly on the +9 dB jump at 13.0.
   - Caixa puts the drop on the cut to real photos (87.67).
2. **The symbol is a seed.**
   - Caixa: the logo collapses into the X (40.6), the X shrinks and multiplies into rows sliding in opposite directions, and a zoom-out turns the rows into the pattern (scene 1, 0–5 s).
   - Collage: the brand word is built letter by letter across supports (H, E, HE, HEX; 0–4.7).
3. **A burst needs one fixed axis.**
   - Caixa: 18 real applications at 0.33 s each, with the logo or X locked at the same point and scale (36.3–45.8). It is the only burst in the film.
   - Arko: 9 applications at 2 frames each with the symbol locked (19.5–21.9), then a breath on the 3D symbol.
4. **Alternate an animated pattern with a real product about every 1 s.**
   - Both use the same 3 colours, so the cut doesn't jump (Caixa scene 1).
   - The pattern never stops: it slides, recedes or reshapes inside its module.
5. **Show the system in use, not as a manual** (Caixa scene 2): a variable-weight slider, typing, a counting number, a blind revealing the background, and a cursor lighting icons.
6. **Recap with a living bento**, where each card is a loop (Caixa), then end in a cell that becomes the signature.
7. **End card:** a still logo for 2.1–2.3 s (Memorable, Whop), a mutating seal (a16z), or 6.4 s of silence on the logo (Caixa 135.1).

## Composition (instead of full-frame mocks)
- **Giant crop, then reveal**, at roughly a 10× scale jump:
  - Arko: a glyph in edit mode, then the logo (1.67–3.29); the font name at 94%, then the specimen card (4.92–5.08).
  - Whop: 4.8% → 66.7%.
- **Many layouts from one image:** a grid of 12 copies, then 3, then perspective panels (glitch 2.13–3.67). Three windows of the same scene at 7%, 18% and 27% (glitch 0.5–2.0).
- **Layering:**
  - collage with overlap and opacity;
  - an isometric stack where one piece lifts out;
  - split screens inside a colour frame;
  - a hero card with works escaping behind it (Unsigned).
- **An illustration recedes until it becomes the mockup:** full-screen art pulls back into a stadium screen or billboard (Caixa 72.5, 77.4).
- **Real people in their natural colour, with the brand in the frame:** cards on the brand colour, and next to each photo a card holding the palette taken from it (Caixa 88.7–98.4).
- **Grid rules from the older decupagens:**
  - margins of 3–8%;
  - only giant type bleeds;
  - a 56/44 split;
  - text screens are 66–99% plain background.

## Transitions (the grammar)
- **Match cut by shape:** Opus keeps the horizon arc at y ≈ 48% through 37 cuts in 20 s while the material under it changes (planet, cell, ceramic, engraving, fabric).
- **Flat brand shape covering 100% for about 0.2 s** to hide a cut (Caixa 64.0; scene 1 18.3). This is a mask, not a "wipe" of giant rays.
- **An object or crop does the scale jump, not the camera:** the eye on the card becomes the whole iris (collage 0.9→1.0).
- **A graphic event at each cut in glitch styles:**
  - background-only inversion for 2 frames (glitch 3.67);
  - block mosaic;
  - datamosh;
  - growing colour stain (collage 2.0–2.4).
- **Black title cards about 0.30 s long (an eighth note)** interrupt a collage that comes back further along, and then all the cards return in a 5×2 grid (Unsigned 12.93–13.83, 16.35).
- **Perspective track** (component scene): planes land on a perspective track with ease-out to 1.5 s, then the camera dives with ease-in and the shot ends at peak speed. It works as a transition shot.

## Type
- **A signature gesture per film:**
  - Arko: the freshly typed letter is born orange; parentheses and a pill shape repeat.
  - Unsigned: the italic flickers every 1–2 frames, and `{ }` open before the text.
  - Opus: one lowercase serif word at a time, ~2% above the arc. It holds while the material changes, and "discover" lasts 3.48 s, growing from 7% to 15% and curving with the arc.
- **Text enters in its final position:** words land without pushing the earlier ones.
- **No box behind text.** Accent colour on a word once or twice per film, no more.

## Rhythm
| Film | Cuts/min | Median shot | Tempo |
|---|---|---|---|
| Arko | 91.6 | 0.52 s | ~149 BPM; big cuts every bar (1.58–1.67 s) before the drop, 2-frame bursts after it |
| Unsigned | 37.6 | 1.00 s | ~98 BPM; the shot builds inside itself |
| Caixa | low, by act | long shots | ~110–112 BPM; 28% of the film with no cut |
| Opus 5.5 | 111 | steps 1.1 → 0.49 → 0.38 → 0.27 → 0.20 s, then the title at 1.24 s | ambient, tonal |
| Glitch | — | — | an 8-bar loop at 129 BPM, played twice; main shot changes on the bar turn (7.38, 11.17, 14.88) |

**Silence before the hit:** 0.2–0.3 s at about -35 dB, then the cut (Arko 6.26–6.54, 18.16–18.42; Opus under "Opus 5.5").

## Music and sound
- **The music follows the structure, not every beat.** In Caixa, cuts land on the beat no more often than chance (27% against 21%). What lines up is the structure:
  - a break and a riser under the giant line;
  - the drop on the cut to real people;
  - the last beat on the tagline.
- **Genres used:**
  - driving electronic/pop in 4/4 (Caixa, Arko);
  - tonal cinematic ambient with a 20 dB swell (Opus, no SFX at all);
  - minimal electronic loops (glitch, collage).
- **Rejected by the user:** felt piano or neoclassical piano tracks, and EDM, corporate or trailer music.
- **Closer to what the user wants:** afro house ("better, still not the one"), then bossa nova, jazz-funk or nu-disco with a real band groove.
- **SFX:** interface ticks locked to typing in the intro and no kick (Arko, Unsigned). A low hit on the logo (Opus 17.25).
- **Finding CC0 music:**
  - Search in parallel through an agent. Free Music Archive's CC0 filter works; check the license on each track's own page and save it in `<slug>.rights.json`.
  - Use librosa for structure: windowed RMS and onsets, with stems from demucs when useful. `beat_track` gets the BPM wrong often, so confirm it with kick or onset autocorrelation.
  - Cut each excerpt so the strongest hit lands on the film's drop time.
  - A track can be edited on the beat (`kilcut.py` pattern): keep the bars the user liked, jump over a breakdown, and land the track's own drop on the hit, with 30 ms crossfades at the splice.
- **Comparing tracks:** render the film **with no music in the composition**, then mix each candidate with ffmpeg (`amix` plus a 2-pass loudnorm). Rendering with the default track still inside shipped two songs playing at once.

## Production techniques that worked (GRUPO VIVA v4)
- **Cinematic logo open, as a material match cut:**
  - Use the brand's official 3D renders (transparent PNGs) in 4–5 materials: chrome, bronze, dark, glass.
  - Lock them all to the same bbox: scale the ring's height to a fixed px, centred.
  - Cut on the beat while one continuous camera push runs across the cuts, on a dark radial-gradient background. This is the Opus shape-held continuity applied to the symbol.
- **Grid forming with a camera:**
  - Put the symbol field inside a CSS `perspective` wrapper.
  - Start at `rotationX` about 62° with fog at the horizon, then tilt to flat with `expo.inOut` while the rows slide in opposite directions.
- **Locked-axis burst, implemented:**
  - Measure the brand mark in each application image on a gridded 1000 px view: centre and symbol width in source px.
  - Then `scale = LOCK / symbolWidth`, `left = 960 - cx*scale`, `top = 540 - cy*scale`.
  - Use the 4K source images (mock raw fills), since the mark is often tiny. A 1.12→1 settle per cut keeps it alive.
- **Figma Motion for layouts:**
  - Clone the brand's designed 1920×1080 layouts into a new section, and never animate the originals.
  - Keyframe the children with `applyManualKeyframeTrack`: staggered rise and fade, opposite column slides along a rotated axis, a card sliding in, a photo push.
  - `export_video` at WIDTH 1920. At most 5 exports run at once; retry the rest after.
- **Mockup studio (Vintageuiuxlibrary) for devices:** put the Figma Motion exports on laptop, phone or tablet with camera recipes (`notebook-orbita`, `mesa-para-heroi`, camera by scenes). Render one scene at a time; a batch hung for 15 min.
- **Letters appear by mask, never by scale:**
  - Clip the wordmark area.
  - Move each letter on y (210 → 0) with a stagger.
  - Use a precise selector: `[id^="x-t"]` also matched the container `x-tag` and pushed the whole line down.
- **GSAP:** never place a tween before 0 in a composition timeline. A negative position shifted every shot in the scene by about 0.3 s.

## Pre-production checklist
0. Create the client's project in jaques-os (if the studio app is in use) before the first render; otherwise the film folder is filed under the wrong owner.
1. Watch the refs' contact sheets again (`docs/refs/frames/<slug>/sheets`) and pick **2 refs** to steal from, by name and timestamp.
2. Write the story as **transformations**: what becomes what. A list of pictures is not a story.
3. Pick the **seed** (symbol or shape), the **fixed axis** for the one burst, and the **signature type gesture**.
4. Pick the music first. Map the structure (intro / break / riser / drop / tag) to the film's acts, and put a silence before the hit.
5. Keep one palette and treat the real photos inside brand frames.
6. Run the release-level pass in `showreel-variants.md`. Patch black frames with `scripts/tapar-pretos.sh`.

## Anti-patterns that were scored low
- **The slideshow:** one full-frame mockup after another with a slow push, 1.3–1.9 s each.
- **An invented construction grid:** thin radial guides and a circle behind a logo outline draw that don't come from the brand's real construction.
- **A generic wipe:** giant flat rays of brand colour sweeping across the frame.
- **Piano music.**
- **Distorting the logo:** `scaleX` or `scaleY` squash or stretch to make the wordmark appear or disappear ("nunca anime assim"). The brand's misuse rules forbid it too. Reveal by mask or slide at true proportions.
- **AI icon art on texture backgrounds, a generic 3D tunnel, or the same hero clip twice** (Visant 360 review).
