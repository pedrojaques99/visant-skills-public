# Measured pitfalls (Premiere 2026 PT-BR + premiere-pro-mcp 1.17, CEP backend)

Effect and property names below are the Portuguese UI names (`Movimento`, `Escala`, `Posição`);
on another locale read them with `get_effect_properties`. Where each was found: `cases.md`.

| Symptom | Cause | Fix |
|---|---|---|
| in/out 1 frame before the plan | `create_subclip` takes seconds and Premiere rounds down (9.2083 × 24 = 220.999 → 220) | XML with whole frames (`premiere_xml.py`) |
| still lasting 43200 s (12 h) | a PNG subclip ignores in/out | still in the XML with `duracao_s` |
| 720x480 sequence, screen at 90.9% width | XML without `<format>`: Premiere falls back to NTSC D1 and corrects non-square pixels | `<format><samplecharacteristics>` with w/h, `square`, `fielddominance none` (the script does it) |
| media `\\\Z:\...` offline + a modal window that freezes everything (Windows) | `pathurl` `file:///Z:/...` | `file://localhost/Z%3A/...` (the script does it; POSIX paths become `file://localhost/Users/...`) |
| media offline with the RIGHT path | XML import does not resolve the file by itself | `relink_media` to the same path |
| `import_fcp_xml` creates a new project | it uses `app.openFCPXML` | `import_media` with the `.xml` |
| marker missing | two markers on the same frame: Premiere sometimes drops one | one frame per marker (the script pushes speech +1 frame) |
| marker without color | FCP7 XML does not carry color into Premiere | `update_marker(time, color)`: 0 green, 1 red, 2 purple, 3 orange, 4 yellow, 5 white, 6 blue, 7 cyan |
| `set_clip_properties_batch`: "Motion Scale is unavailable" | Premiere in PT-BR: "Movimento/Escala/Posição" | `set_effect_property` with the local names |
| clip at Position (960,540) ended in a corner | Motion Position is normalized | `[x/w, y/h]` |
| `create_sequence_from_clips` named "1" | the tool cuts the name at the first dot ("1.1 A primeira...") | name comes from the XML |
| `Could not verify the Windows ACL ... spawnSync powershell.exe ETIMEDOUT` (Windows) | permission check before sending; nothing ran | repeat the call; more common with many in parallel |
| every call times out at 120 s | a modal window is open in Premiere | the user closes it; then check whether the command landed (`list_sequences`) |
| "Legacy CEP cannot safely delete project item" | CEP does not delete items | bin `_descartar` + name `[descartar]` |
| sequence at 29.9992 fps | iPhone MOV is VFR and the sequence inherits the average | fine for a face shot; for locked 30, the XML sets the timebase |
| `export_sequence_review_frames` "did not write any frames" | tool failure in this version | `capture_frame(time_seconds)`, which sometimes fails and passes on the second try |
| sequence 0.3 to 0.7 s shorter than the plan's `duracao_s` | the plan summed fractional seconds and `fonte_in_f/out_f` round each end | under 1 frame per cut; tell the plan generator to sum in frames |
| keyframe applied and the clip does not animate | `add_keyframe(time_seconds)` counts in SOURCE time, not clip time (0 s is before the in) | `inPoint` from `get_clip_properties` |
| `add_keyframe` refuses Position | numbers only | anchor on the face + fixed Position on the target, animate only Scale |
| "Clip not found" with an ID that worked; reading a clip from another sequence | the node ID changes when the active sequence changes (the user clicking in Premiere changes it too) | `get_clip_at_position` right before each operation |
| sequence with 3 s of silence the engine "already tightened" | whisper stretches the word over the pause; measuring pauses by `ws[j].s - ws[i].e` misses the hole | silence from the wav energy (`silencios()` in the project's tighten script) |
| `import_media` of an XML times out at 120 s and nothing lands | XML with an empty `<file id>` on the 1st occurrence (the clip carrying the definition was cut) and no `<!DOCTYPE xmeml>` | the 1st occurrence of each id carries the full `<file>`; check `list_sequences` before repeating |
| "duplicated": each XML import brings a copy of all media | Premiere does not reuse master clips on XML import, and deleting the copy removes the clip from the timeline | `import_media` with `target_bin`, then `move_items_to_bin` of the media into `<bin>/_mídia`; only the sequence stays visible |
| XML import with a clip copied from another export hangs at 120 s | the other XML's `masterclipid` points to other media (or none) | remap to the masterclip the target XML already uses for that file |
| XML import times out and "Resultados da conversão de FCP" (FCP conversion results) appears | Premiere opened the conversion report (modal) for an effect that does not convert, e.g. an unnamed `Efeito <>` on a clip copied from another export | strip `<filter>` with an empty `effect/name` before importing; the report lands in Documents and in the bin |
| `export_as_fcp_xml` times out and the XML is truncated | "Relatórios de tradução" (translation report): Premiere opens a modal on XML EXPORT when something does not translate | the user clicks OK; check the file ends in `</xmeml>` before reading, and export again |
| `import_media` says ok and the sequence does not appear | Premiere ignores re-importing an XML from the SAME path as one already imported | each version in its own file (`aula-N-apertada-vK.xml`) |
| rendered clip comes in at 59.59 fps and longer | concat of sped-up pieces (setpts) leaves time holes at the splice | `fps=60,setpts=N/(60*TB)` after the concat; check `avg_frame_rate` = 60/1 with ffprobe |
| overlay (slide, logo) pushed the whole lesson | `add_to_timeline` is an INSERT with ripple on sync-locked tracks | `overwrite_clip` on an empty track + `set_clip_duration` (a still comes in at 5 s); a PNG without audio does not touch A1 |
| connection still stuck after OK on the dialog | the queue of commands that expired during the modal jams the panel | reopen Window > Extensions > MCP Bridge |
| `remove_from_timeline(ripple=true)` leaves a gap | the DOM rippleEdit does not work in 26.x | `ripple_delete` (dry_run first): closes the gap on all sync-locked tracks, verified |
| sequence marker out of place after swapping a stretch | `add_to_timeline` (insert) moves markers; `ripple_delete` does NOT; `update_marker` does not change time | `delete_marker` + `add_marker` at the matching clip position |
| `set_item_in_out` "did not apply in point" | tool failure in this version | cut the piece in ffmpeg and place the whole item |
| washed-out, gray face on iPhone footage | HLG bt2020 10-bit read as bt709 | HDR→SDR conversion (zscale linear + tonemap hable) before the engine |
| upside-down iPhone video | rotation metadata; judged on a blank page | rotate 180 without re-encoding; check on a frame with people |
| concat of pieces with a 16 ms frame | `-c copy` between pieces of different origin | re-encode to a common format |
| Media Encoder render misses the last change | the job keeps the sequence as it was when queued | new job with another name; delete the old one |
| Media Encoder export ends with seconds of black | `add_to_render_queue` exports the WHOLE sequence and ignores in/out; after `ripple_delete` the sequence end does not shrink | `ffmpeg -t <content end> -c copy` on the MP4 (no re-encode) and check the last frame |
| `ripple_delete` of a 1-frame clip says "ok" and the 1-frame audio/b-roll sits on top of the previous one | the 1-frame partner is not in `alsoRemoved`: it is shifted, not deleted | `get_sequence_structure` afterwards and `remove_from_timeline` of the 1-frame leftovers |
| `trim_clip` "did not apply a verified timeline trim" | structural edit is a no-op in 26.x | cut the piece in ffmpeg with N frames and swap it (`import_media` + `overwrite_clip`) |
| face flashes for 1–2 frames between b-rolls | a hole in the b-roll track (clip starts 2 frames after the previous ends) or a black 1st frame in the b-roll | new track on top with a still of the last good frame for 4 frames; `move_clip` 1 frame when it is just misalignment |
| after `add_track` tracks "move up" one level and a still placed on the new track ERASES real b-roll | `add_track` falls into the QE fallback, which creates the track below; the index you think is the empty track is the b-roll one, and the still comes in at 5 s before `set_clip_duration` (readback says ok; the defect passed 3 exports) | never `add_track` on an edited sequence: make the bridge an N-frame MOV (ffmpeg) and `overwrite_clip` straight onto the b-roll track; check with `get_active_sequence` (track by track) and an exported frame over the whole stretch, not only the splice |
| cut inserted from another engine comes in 8 dB louder | that engine's cuts came out at -16 LUFS, the lesson engine's at -24 | match before inserting (`volume=-8dB` on a copy); `set_clip_volume` fails on that clip |
| `remove_from_timeline` on the video left the audio | the linked clip does not go with it | remove the A1 item too (`get_clip_at_position` on the audio track) |
| Media Encoder queue does not start, or on reopening re-renders the old queue as `*_1.mp4` | `add_to_render_queue` + `start_batch_encode` sometimes never starts; AME keeps the queue between sessions | `export_sequence` (direct and synchronous, skips AME; >120 s becomes a background task, so one call at a time) + a watcher on the output folder; kill AME first |
| grade copied from the take to a hald via `copy_effects_between_clips` comes out as identity | the tool says "copied" and nothing arrives; `apply_effect`/`color_correct` also fail | the user grades in Lumetri and exports a `.cube` (Lumetri > Export .cube); apply with `lut3d` in ffmpeg with an explicit BT.709 matrix; measure against a frame exported from Premiere |
| LUT applied in ffmpeg looks more saturated/warmer than in Premiere | swscale converts YUV↔RGB as BT.601 unless told; OBS MP4 comes with "reserved" primaries | `setparams=...bt709` + `scale=in_color_matrix=bt709:in_range=tv:out_range=pc` before and `out_color_matrix=bt709:out_range=tv` after |

## Keyframes on a still use SOURCE time, which starts at 3600 s

`add_keyframe` says "time relative to clip start", but it writes in source time. For PNG and
Graphics, Premiere gives `inPoint = 3600` (`get_clip_properties`). A keyframe at 0–4 s lands BEFORE
the used stretch and Premiere holds the last value: the card stayed at opacity 0 the whole time,
while the keyframe readback said all was fine. Fix: `time = inPoint + t`. Proof: export one frame
mid-fade and one mid-card; never trust the readback.

House fade for cards (same rhythm as the engine's label, `ROTULO.fade = 0.28`): opacity 0→100 and
scale 96%→base in 0.28 s, opacity 100→0 over the last 0.28 s, bezier on the first keyframe of each
stretch. Full-screen opaque slide: opacity only (scaling shows the edge). Cards back to back
(screenshots 1→2→3): fade only on the first one's entry and the last one's exit, or the screen
blinks. Read the scale first (`get_effect_properties Movimento`): the keyframe overwrites the
scale the user set. Effects/keyframes only touch the ACTIVE sequence: tell the user before
switching.

## A card goes on the HIGHEST track, above the b-roll

Cards placed on V2 vanished because the whole screen was a b-roll on V3, which covers everything
below. Readback and `overwrite_clip` say "ok" anyway. Before placing: list what occupies each
track in the window (saved `get_sequence_structure` + a free-tracks script) and use the highest
free one; if the highest has an engine label at the same instant, go in AFTER it (notice right
after the label, never on top). `move_clip_to_track` moves a clip across tracks keeping keyframes
and position. Always check with `export_frame`. A logo card that repeats what the slide already
shows does not go in.
