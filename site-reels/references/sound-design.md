# Sound design for showreels: SFX, track and mix

## The owner's favorite folders come first (2026-11-25)

Four folders are marked as favorites. Look there before anything else:

- `7panel_studio/backend/assets/samples/Zero-G - CE07 Dream Zone` (textures, pads)
- `7panel_studio/backend/assets/samples/- VHULTO SAMPLING THE WORLD DRUMKIT -` (drums, percussion)
- `jaques.dsgn/sfx_music/Jacão Ambients/assets/cc0` (CC0 sounds)
- `jaques.dsgn/sfx_music/Jacão Ambients/assets/sfx` (own SFX)

The list lives in `7panel_studio/backend/assets/som_pastas.json` (key `favoritas`). Two of
them sit inside the packs folder: that is fine, they are the approved part of it. The ban list
(`studio-hf/_motor/sfx-banidos.json`) still applies on top, so a banned slot stays banned even inside
a favorite folder. "Never default to the packs" below means the rest of the packs.


Music *choice* (genres the user accepts or rejects, structure over beat) is in
[brand-showreel-playbook.md](brand-showreel-playbook.md) → "Music and sound". This file covers
where the SFX come from, how to cut them and how they go into the film.

## Banned (never use again)

`studio-hf/_motor/sfx-banidos.json` is the list, and `kit_freesound.py` refuses any slot that
points at it. The user called these "slop artificial":

- **The whole old 40-slot kit** shared by four client films up to v4:
  - the synthesized and drum-machine `d-*` sounds (hats, claves, kick, sub, UI, glass pluck,
    riser, wood, tom);
  - the muddy `w-*` whooshes;
  - the weak `m-*` mouse clicks;
  - the digital snaps and the TV switch.
- **Tonal or metallic whooshes.** Measure the spectral flatness between 1.5 and 9 kHz around the
  peak; below 0.3 sounds like metal. The "metal swoosh" on one client film was fs800300.
- **Synthesized tracks** (each film's `synth.py`) and **Playhouse "Paris Core"**, which has a
  sampled French voice ("horrível").

Every slot is now a real recording: thud, luggage drop, wooden floor, rubber stamp, brick on tile,
glass tap, cloth or paper, and airy whooshes. The riser is an airy whoosh played in reverse.

## Where SFX come from

The old pack whooshes and clicks (`7panel_studio/backend/assets/samples`) were rejected hard
("muito ruins", 2026-11). What gives them away is a muddy low end, a long tail and a soft attack.
**Never default to the packs.**

1. **Curated kit first.** In the studio's sound library, the collections `Triagem · Whoosh` (16)
   and `Triagem · Clique` (15) hold top-rated CC0 originals from Freesound. The user favourites
   the approved ones, and **the favourites are the showreel kit**. Pull from favourites. If none
   are marked yet, ask before using the unreviewed triage.
2. **Real-object foley beats synth SFX.** The user's own picks: masking tape, camera iris and
   film load, radio tuning, snap buttons, brick on tile, zipper. A 0.1–0.3 s slice of one of
   these makes a better click than any "UI click".
3. **Need more:** paste Freesound links into the Biblioteca (Pastas → "Links do Freesound") or run
   `node app/server/freesound.js <links|ids>` in the sound library project. It downloads the
   **original** through OAuth, names it `Title - author (fs<id>)`, stores licence, credit and tags,
   and catalogues it. Files land in the library's `freesound` folder.
4. **Mine the best automatically:** call `/apiv2/search/text/` with
   `duration:[0.2 TO 2.5]` (whoosh) or `[0.02 TO 1]` (click),
   `license:"Creative Commons 0" num_ratings:[8 TO *]` and `sort=rating_desc`. Rank by the
   Bayesian rating `(avg·n + 3.5·10)/(n + 10)` plus `0.15·log10(downloads)`. Put the top results
   in a new `Triagem ·` collection for the user to approve. The API allows 30 requests/min, and each
   sound costs 2.
5. **Fallback:** Pixabay SFX via firecrawl, because curl gets a 403 (the client pipeline below).

**Licence:** prefer CC0. CC BY (Eelke, trip_sound) needs the credit line. It is already stored in
the sound's `credito`; copy it into `<slug>.rights.json` and the delivery description.

## The showreel kit (studio-hf)

The films share one SFX kit with fixed slot names: `click-1..5`, `tick-1..5`, `swoosh-1..3`,
`whip-1..6`, `snap-1..3`, `ui-1..4`, `drag-1..2`, `sub`, `kick`, `rise`, `pluck`, `stamp` and `tv`.
`montar.mjs` writes cues that point at these names, so **swapping a sound never touches a cue**.

- **Build the kit:** `python _motor/kit_freesound.py` (slot → Freesound id map in `kit_freesound.json`)
  builds `_motor/kit-v5/` plus `_previa-kit.wav` for listening. Each new sound gets:
  - its peak aligned to the old one's instant;
  - the same length;
  - its level matched to the old envelope;
  - a per-family high-pass (whoosh 120–180 Hz, click 200, tick 300), which cuts the muddy low end.
- **Apply it:** add `--aplicar pragen-hatlen grupo-viva mizz`. Only `pragen-hatlen/assets/audio/kit-v4/` keeps the old (banned) kit, as the timing and level reference the builder aligns against. Never point a cue at it.
- **Swap a slot:** check the spectral centroid. A "click" under ~1.5 kHz or a whoosh under ~500 Hz
  is a thud; replace it or raise its `hp`.
- **Only the sound changed?** Don't re-render. `python _motor/remixar_sfx.py FILM in.mp4 out.mp4`
  rebuilds the SFX bed from the `index.html` cues and swaps the audio, copying the video. It
  matches the HyperFrames mix at 0.1–0.3 ms; check with `--conferir`. Then run the film's
  `entregar-v5.sh` (tracks plus loudnorm).

## Cinema treatment per brand (`_motor/som_cinema.py`, pedalboard)

Raw downloads are never final. Every kit sound goes through one brand profile, and
`kit_freesound.py --aplicar` picks the profile from `FILMES`. Each profile chains:

1. pitch down, keeping the duration;
2. high-pass;
3. low shelf for body;
4. a −2 dB dip at 3.2 kHz to take the harshness out;
5. a high shelf for the profile's top end;
6. glue compression;
7. reverb.

The level is matched back to the source afterwards. `remixar_sfx.py` also glues the SFX bus
(2:1 compression plus half the profile's room) and keeps −1 dBFS of headroom before the
delivery's loudnorm.

| Profile | Films | Character |
|---|---|---|
| `luxo` | two luxury client films | −3 st, +4 dB at 120 Hz, silky top (−3 dB at 7 kHz), light saturation, large dark room |
| `corrida` | a racing client film | −1 st, fast 4:1 compression (punch), presence, short room so the rhythm flows |
| `lab` | Visant 360 | −2 st, air on top (+1.5 dB at 10 kHz), subtle stereo chorus, large bright room |
| `cinema` | GRUPO VIVA, Mizz | −2 st, full low end, clean mids, medium room |

Don't pitch ambiences (wind, forest): they sound fake. Designed "cinematic boom/impact/echo hit"
sounds (Pixabay) are swapped for real foley, such as a whump, a wooden thud or a glass tap
through the room.

## Cutting

- Trim to the transient, never use a whole file.
- **Whooshes:** 0.25–0.8 s, with the peak landing on the cut.
- **Clicks:** 30–120 ms.
- Add a 5 ms fade-in and fade-out at both ends.
- **Silence before the hit:** 0.2–0.3 s at about -35 dB, then the cut.
- **Typing intros:** interface ticks locked to the keystrokes, no kick. Keyboard SFX were
  rejected; use mouse clicks and drags plus the engine.
- **Logo:** one low hit. Intrusive cut sounds were rejected, so not every cut gets a whoosh.

## Into the film

- **HyperFrames (studio-hf):** bring the sound in with the editor's "trazer"
  (`POST /m/som/peca/:peca/trazer`). It copies into `assets/sfx/biblioteca` and records the use.
  Never point at a path outside the film folder: the render needs the file next to the film.
  SFX, break track and stems go in as Studio lanes. Snap cue times to the beat grid in
  `plan.json`.
- **Premiere delivery (client pattern):** `sfx/sfx_plan.json` holds the cues.
  `_tools/sfx_build.py sfx_plan.json --versao N` generates the pieces, `xml/sfx-vN.xml`, the mix
  and a preview. `_tools/timeline.py` reads the cuts straight from the `.prproj`. If the owner
  changes the cut, re-run `timeline.py`, adjust the cue `t` values and build a new version. A
  Premiere rough-cut skill, if installed, covers the cut itself.

## Track and mix

- **Music with drive** (racing, sport): FMA's CC0 catalogue is thin for drum & bass and breakbeat; most of it is CC BY or NC. Use Pixabay Music instead (Pixabay Content License: commercial use, no credit). `audio/pixabay_musica.py busca|baixa` goes through firecrawl because curl gets a 403, and writes a `.rights.json`. Find the drop with librosa (largest 2 s energy rise that stays high for 18 s), cut so it lands on the film's drop, and dip −16 dB for 0.26 s before it. Measure the delivered file (pre-drop, dip, drop, sustain) instead of trusting the cut.

- **Compare tracks** by rendering the film **with no music in the composition**, then mixing each
  candidate with ffmpeg (`amix` plus a 2-pass loudnorm). Rendering with the default track still
  inside shipped two songs playing at once (GRUPO VIVA v3 and v4).
- Use librosa for structure (windowed RMS, onsets) and demucs stems when useful. Confirm the BPM
  with kick or onset autocorrelation, because `beat_track` often gets it wrong.
- Final loudness is part of delivery: [render-and-delivery.md](render-and-delivery.md).
