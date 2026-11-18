# Render, check and delivery (HyperFrames films)

These are the steps from a finished composition to the delivered file. Do them in order and
don't skip the looking. The Remotion and plates delivery is in `SKILL.md` ("Audit before
delivering") and `scripts/deliver.example.sh`.

## Before rendering

1. Run `npx hyperframes history` before rewriting any file, because the user edits live in the
   Studio and the desktop app. Once the user has edited, **never regenerate over it** with
   `montar.mjs`. Diff first, as described in [showreel-variants.md](showreel-variants.md).
2. Run `hyperframes check` (lint) to catch these traps:
   - no video nested in a timed wrapper;
   - no tween on `letterSpacing`;
   - a nested `.clip` must be visible;
   - no duplicate `<img>` discovery;
   - no media running past EOF.
3. Run `snapshot --at` at every scene change and at the last 3 s, then **look** at the contact
   sheet. Render only after that.
4. Run the release-level pass in [showreel-variants.md](showreel-variants.md): one palette, a
   returning motif, real media before stock, no dead frames.

## Rendering

- Render **one at a time**: renders compete for RAM, and a background render was killed for low
  memory. Don't run a render alongside Photoshop or another GPU job.
- Round clip times down.
- Use CRF 22. Keep grain coarse and slow (`opacity ~.28`); fine grain made a 248MB file.
- For A/B, build the alternative as a flag in the generator (`V=b node montar.mjs`), render both
  and ship both links.

## After rendering (before loudness)

1. Run `blackdetect`. The render, unlike the Studio and the snapshot, can drop a single frame to
   black at some shot starts. One worker, PNG extraction, video pre-roll and shot overlap did not
   fix it.
2. Run `scripts/tapar-pretos.sh in out`. It swaps each isolated black frame for the previous one
   with `freezeframes`, and the audio stays in sync.
3. Normalize loudness with a 2-pass `loudnorm` to the target for the destination ([loudness table](../../visant-video-editor/references/audio.md#target)), copying the video.
4. Make a timestamped contact sheet of the final file
   (`fps=2,drawtext=%{pts\:hms},tile=8x6`) and look at it before sending.

## Delivery

- **Figma Slides:** the limit is 100MB, so aim for < 95MB by raising CRF by 3 until it fits
  (`deliver.example.sh`).
- **Rights:** each film carries a `<slug>.rights.json` (music, SFX, stock). CC BY credit lines go
  into the delivery description. Where SFX credits come from:
  [sound-design.md](sound-design.md).
- **Ref review:** add a short `.md` in the project covering what the refs do, what is slop in
  ours and what the B cut changes.
