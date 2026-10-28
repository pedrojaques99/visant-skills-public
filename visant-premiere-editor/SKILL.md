---
name: visant-premiere-editor
description: 'Assembles a rough cut in Premiere Pro via premiere-pro-mcp from a JSON cut plan: frame-exact cuts, markers, punch-ins, cards, b-roll, -14 LUFS delivery. Use on "build it in Premiere", "Premiere rough cut", "punch-in", "cover with b-roll", "monta no Premiere", "marcadores pra narrar", "exporta as aulas", /visant-premiere-editor.'
---

# Visant Premiere Editor

## Requirements

| Needed for | What | Check |
|---|---|---|
| everything | Windows or macOS with Adobe Premiere Pro (measured on 2026 / 26.x) | open Premiere |
| everything | premiere-pro-mcp with the CEP backend and the MCP Bridge panel open (Window > Extensions > MCP Bridge); measured on 1.17 | MCP tool `verify_premiere_connection` |
| everything | ffmpeg + ffprobe on PATH | `ffprobe -version` |
| `premiere_xml.py` | Python 3 + `opentimelineio` + `otio-fcp-adapter` (`pip install opentimelineio otio-fcp-adapter`) | `python -c "import opentimelineio as o; o.adapters.from_name('fcp_xml')"` |
| `figma_cards.py` | Python 3 (stdlib only) + Figma MCP (`use_figma`, `get_screenshot`) with skills `figma-use`, `figma-use-slides` | `python --version` |

Works with Premiere in English or Portuguese (PT-BR). The XML holds no effect names; the MCP calls
take the UI names, mapped in `PREMIERE_NAMES` in `scripts/premiere_xml.py`. Another UI language:
add its column there. Unsure which names this Premiere uses: save a `get_effect_properties`
readback and run `python scripts/premiere_xml.py --names <file>`.

**Shipped here:** `scripts/premiere_xml.py` (plan → FCP7 XML, motion table, checker),
`scripts/figma_cards.py` (cards JS for Figma Slides) and `scripts/icons/` (Simple Icons, CC0).
Old Portuguese plan/batch keys, `--saida`/`--conferir` and `Edição N (não apresentar)` rows still
work (`python scripts/premiere_xml.py --self-test` proves old and new plans give the same XML).
**Not shipped, project-side:** the scripts named in the tighten, learn, b-roll and delivery
sections (`aperta_final.py`, `aprende.py`, `fala.py`, `agente.py`, `rampa.py`, `onde.py`,
`trecho.py`, `fonte_iphone.py`, `entrega.py`, `legenda_whisper.py`, `sensor_export.py`). They live
next to the project's lesson engine because they need its plan and source wavs. If the project
does not have them, do those steps by hand with ffmpeg and the MCP, following the same rules.

## Role

The agent assembles the rough cut; the person editing refines it in Premiere. No music, color or
b-roll in the rough cut unless asked.

Input: a cut plan in JSON (format at the top of `scripts/premiere_xml.py`). Another stage makes
the plan: speech-based breakdown and cuts in `visant-video-editor`, or the project's own scripts.
This skill does not decide cuts, it only carries the plan into Premiere without losing a frame.

> **Rule zero: never assemble cut by cut through the MCP.** `create_subclip` +
> `create_sequence_from_clips` misses by 1 frame per end (Premiere rounds seconds down) and a PNG
> subclip becomes 12 hours. The path is XML.

## Flow

0. **The user may be working in Premiere right now.** `set_active_sequence` switches their
   screen, and a clip's node ID changes when the active sequence changes. Before each edit,
   re-read the ID with `get_clip_at_position`, and warn before a round of changes.
1. **Connection, read-only.** `verify_premiere_connection` (backend `cep`) and
   `get_project_info`. If a call times out at 120 s, a dialog is open in Premiere: ask the user to
   close it and fire nothing else until they do.
2. **Check the source** with `ffprobe`: resolution, fps (`r_frame_rate` and `avg_frame_rate`),
   audio present, rotation. iPhone MOV is VFR and Premiere interprets it at 29.9992.
3. **Generate the XML**: `python scripts/premiere_xml.py <plan.json> --out <dir>`.
4. **Import into the open project**: `import_media` with the `.xml` (`suppress_ui: true`). Do not
   use `import_fcp_xml`, which creates ANOTHER project. One lesson per call.
5. **Relink**: XML media comes in offline even with the right path. `search_project_items` with
   `offline_only`, then `relink_media` of each item to the same path. Up to 4 in parallel works.
6. **Punch-in** (face shots only): `python scripts/premiere_xml.py --motion <plan.json>` gives the
   table. Apply with `set_effect_property` on Motion > Scale (Movimento > Escala), in %, and
   normalized Position (Posição) `[x/w, y/h]`. `set_clip_properties_batch` fails on a PT-BR UI.
   **Animated push-in** (only with the user's approval, showing first and last frame sheets
   first): `add_keyframe` only accepts numbers, so Position does not animate. Put the
   Anchor Point (Ponto de ancoragem) on the face `[cx/w, cy/h]` and Position on the target
   `[0.5, 0.38]`, and animate only Scale. Keyframe time is SOURCE time: use `inPoint` from
   `get_clip_properties` and `inPoint + duration − 1 frame`.
7. **Marker colors**: the XML carries no color. Use `update_marker(time_seconds, color=1)` (red)
   on shot markers; speech stays default (0, green).
8. **Read back and check**: `get_full_sequence_info`. When the result goes to a file (large
   output), run `python scripts/premiere_xml.py --check <plan.json> <file>`. When it comes
   inline, check cut count, total frames, markers, format and A1.
9. **Look at frames**: `capture_frame` at 2 or 3 points (one punch-in of each scale and the most
   suspicious cut) against the reference render, if any. A Position stuck at the clamp limit means
   a badly detected face.
10. **Save** (`save_project`) and **tidy**: sequences and media in one bin per delivery. CEP does
    not delete project items: test leftovers go to a bin `_descartar (teste do agente)` and the
    sequence name gets `[descartar]`, for the user to delete.

## Tightening an already edited sequence (pauses, drags, fumbles)

When the user already edited the sequence by hand, **do not regenerate from the engine**: their
edit is lost. The path is an XML round trip into a new sequence alongside:

1. `create_project_backup` of the `.prproj`.
2. For each lesson: `set_active_sequence` (warn first, it switches the user's screen) and
   `export_as_fcp_xml` to `_apertada/aula-N.xml`.
3. Run the project's tighten script (`aperta_final.py _apertada/aula-N.xml`). It outputs
   `aula-N-apertada.xml` + `.cortes.tsv`, each cut with time, reason and word.
4. `import_media` of the tightened XML with `target_bin` (the user's bin), media into
   `<bin>/_mídia`, then step 5 (relink) and 8 (check). The original stays intact for comparison;
   re-import gets `--sufixo v2` and never overwrites a tightened version the user already edited.

Tightening rules: silence is measured **from the audio** (< -45 dB), never from the gap between
whisper words, because whisper stretches a word over the pause (one word spanned 4.7 s). A pause
> 0.15 s keeps 0.10 s. A drag is a word of up to 3 letters with continuous sound > 0.40 s,
measured inside whisper's edges, because in running speech the sound does not stop between
words. From a drag only the vowel's core is removed, keeping 0.15 s of head and 0.08 s of tail.
Badge and label move only with the cut; b-roll is cut along. The script aborts when a `.mov`
piece's duration does not match the plan: sign the engine's plan changed after the render and
the word→frame map is wrong.

## Learning from the user's edit

When the user fixes a generated sequence by hand (e.g. redid the ending), do not guess what they
meant. Export their version and compare with yours: `python aprende.py <mine.xml> <theirs.xml>`.
The comparison is per raw stretch and shows what they RESTORED, what they CUT FURTHER and which
words are in each stretch. To repeat their ending on a new version:
`aprende.py <new.xml> <theirs.xml> --fecho MM:SS.s <out.xml> "<name>"`. Their clips go in at the
end with volume and cut, and `masterclipid` is remapped, because their id points to other media
and the import hangs. A change that repeats becomes a number in the skill or a line in the
script (`fecho.tsv`, `roteiro.tsv`), not another hand fix.

For their edit to survive every new version: `aprende.py <mine> <theirs> --grava` writes
`edicao_dono.tsv` (cut/keep per raw stretch) and the tighten script repeats it on its own. A
boring stretch (dictating a prompt) becomes a ramp: a line in `rampas.tsv` (`rampa.py`: speeds up
in steps up to 3x, voice always audible, no zoom (the user zooms by hand), and an ACELERADO badge).

Content cuts (rambling, sentence said twice, stumble) belong to the agent and stay separate:
`fala.py <module> <lesson>` prints speech per sentence with source time;
`agente.py <module> <lesson> <source> "start|end" ... --grava` finds the stretch by text and
writes `edicao_agente.tsv`, which the tighten script reads together with the user's. A cut that
changes a promise (course mentioned, price, deadline) goes in, but goes to a question.

## Cards: notices and logos, made in Figma

The card is born in the lesson deck (Figma Slides), never drawn in Premiere:
1. `python scripts/figma_cards.py <batch.json> <batch.js>` (format at the top of the script;
   icons in `scripts/icons/`, Simple Icons CC0 in the official color; a brand not there goes in
   as text, never an invented logo).
2. Run the JS with `use_figma`. Each lesson gets a row `Edit N (do not present)` (an existing
   `Edição N (não apresentar)` row is reused); if the row fills up, it opens `Edit N b`.
3. `get_screenshot` with `contentsOnly` of each card → PNG in `_build/aulaN/sobre/`.
4. In Premiere: `import_media`, `overwrite_clip` on the HIGHEST free track, `set_clip_duration`,
   `set_effect_property` (normalized Position, Scale), house fade (`references/pitfalls.md`).
   Find the second of the line with the project's `onde.py <module> <lesson> <xml|json> "phrase"`.

A card that repeats what the slide already shows does not go in.

## Covering speech with b-roll and timelapse

A long face stretch with no screen needs b-roll. Rules:
- **Video-only copy** (`ffmpeg -an`) of each b-roll: camera audio never goes into A1.
- **Cut the exact piece in ffmpeg** (`cortes/<lesson>_<tl>_<source>.mov`) and place it whole:
  `set_item_in_out` does not apply the in point in this version.
- Track above the face and below the cards; never over a card or an engine label.
- **Look at every frame first**: Claude's sidebar, account picker, e-mail, client name. Blur
  (`boxblur` on the region) or swap the b-roll. When in doubt, swap.
- iPhone source: convert HDR→SDR and fix rotation BEFORE cutting the piece.

## Swapping a rendered piece already in the sequence

A redone piece (speech cut, color) gets a NEW NAME (`-2.mov`): re-importing the same path is
ignored. `import_media` → `remove_from_timeline` of the video AND the audio (they come out
separately) → `overwrite_clip` at 0 → `get_sequence_structure` to check the duration. A Media
Encoder job already queued keeps the old version: queue a new job with another name and ask the
user to delete the old one.

## Delivery

1. Sequence name is the file name: `Aula N · Título`, no `v2`/`apertada`/`nova`. The tighten
   script outputs `· nova`; the user approves and the suffix goes.
2. `save_project`, `check_offline_media` = 0, and per lesson: `set_active_sequence` →
   `add_to_render_queue` (preset `01 - Match Source - High bitrate`, output `<N · Título>.mp4`,
   no `?` in the name) and `start_batch_encode` (the user does not need to press ▶). If the queue
   never starts, use `export_sequence` instead (see pitfalls). The MP4 carries the whole
   sequence: trim the black at the end with `ffmpeg -t ... -c copy`. Watch the output folder
   (the project's `sensor_export.py`).
3. Loudness: 2-pass loudnorm to -14 LUFS / -1.5 dBTP with the video copied, then `.srt`/`.vtt`
   from whisper (the project's `entrega.py` + `legenda_whisper.py`). Re-run only on what is
   missing.

## Report

One table per sequence: cuts, frames, duration vs plan, markers, format, tracks. Say what changed
relative to the plan (frame pulled, marker pushed, position fixed by hand) and send the fix to
whoever generates the plan.

Measured pitfalls, with cause and fix: `references/pitfalls.md`. Read before the session's first
import. Where the rules came from: `references/cases.md`.
