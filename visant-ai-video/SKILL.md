---
name: visant-ai-video
description: 'AI video spots end to end: shot list, cast- and product-locked frames, Kling via Visant Labs video-generate without the MCP timeout, manifest-driven ffmpeg build at -14 LUFS. Use on "gerar vídeo com IA", "comercial com IA", "refaz a cena", "Kling", "fal", "troca a cena", "junta as versões", /visant-ai-video.'
metadata:
  family: video
---

# Visant AI Video

Generated spots, not edited footage. For raw footage use `visant-video-editor`; for screen
recordings of a site use `site-reels`.

## Requirements

| Needed for | What | Check |
|---|---|---|
| frames, video | Visant Labs MCP connected (`mcpServers.visant` with an Authorization header in `~/.claude.json`, or `VISANT_TOKEN`) | `visant whoami` |
| uploads | Visant CLI | `visant upload <file> --json` |
| render, build | Python 3, ffmpeg + ffprobe on PATH | `ffmpeg -version` |

## Rules

> **Rule zero: the shot list goes for approval before any render.** One line per scene: framing,
> action, emotion beat, on-screen text. Text costs seconds; a Kling pro take costs minutes, and
> "make it more exciting" after two renders is the most expensive feedback there is.

> **Never call `video-generate` through the MCP tool for Kling pro.** Through Claude Code's MCP
> client it often passes the 300 s idle limit: the result is lost, and the server then blocks the
> same prompt as "Duplicate request". Always use `scripts/render.py` in the background.

- Lock the cast: one reference frame of each person goes into every frame of every scene.
- Lock the product: the official product photo goes into every frame where it appears.
- Every version is a manifest (`spot_vN.json`). Never copy a build script per version.
- Mixed quality is a defect: if one scene is `std` and the others `pro`, say so.

## Flow

`<skill-dir>` = this skill's folder.


1. **Brief and refs.** Collect the product page and photo, the brand folder (logo PNG, font), the
   previous version if any. Save the refs in `<project>/refs/` and upload them with `visant upload <file> --json`.
2. **Shot list** (rule zero). Propose it and wait.
3. **Frames.** Generate them with the MCP tool `ai-generate-image` (`gemini-3-pro-image`, 2K, 9:16; it is fast
   and safe through MCP). End frame first, then the start frame derived from it.
   Templates and the checklist are in [references/frames-and-prompts.md](references/frames-and-prompts.md). Read each frame and run the checklist before rendering.
4. **Render** each scene in the background:
   ```bash
   python -I <skill-dir>/scripts/render.py takes/s2_args.json takes/s2.mp4
   ```
   `s2_args.json` = the `video-generate` arguments ([assets/take.example.json](assets/take.example.json)). It retries
   on Duplicate or fetch failed (new seed from the 3rd try), downloads, writes `takes/s2_sheet.png` and appends
   prompt, seed and URL to `takes/takes.jsonl`. Read the sheet: the product must stay the same product, with no extra hands.
   Draft in `std` only when the user wants to see motion fast; final in `pro`.
5. **Assemble** from a manifest ([assets/spot.example.json](assets/spot.example.json)):
   ```bash
   python -I <skill-dir>/scripts/build.py spot_v1.json --open
   ```
   It handles crossfades, text with fade and ease, an end card with the logo, the music bed, two-pass loudnorm
   (-14 LUFS, -1 dBTP) and `<out>_sheet.png`. `--open` opens Explorer with the file selected.
   Durations come from the real clips (Kling returns about 5.04 s), so texts are timed on the final timeline.
6. **Deliver.** Read the sheet, then report to the user: what changed per scene, what is still std or AI-drawn
   (logo font), and the open question for the next round. Note the version in the project README.

## Recombining versions

"Pegar a cena 1 da v3 com a cena 2 da v4" means copying the manifest and changing `scenes[].file`.
No generation. Before delivering, warn about cast drift between takes (different hair or wardrobe)
and offer to regenerate the frame using the other take's person as the cast reference.

## Delivering on Windows

`explorer.exe /select,"<path>"` breaks on paths with spaces or `@` when it is passed as split
arguments. `build.py --open` passes it as one string. In PowerShell use
`Start-Process explorer.exe -ArgumentList '/select,"<path>"'`. `.mp4` may have no default player;
`ffplay -autoexit` works.

## Neighbors

- `visant-video-editor`: raw footage, silence cuts, loudness. The audio rules are the same.
- `visant-mcp-connect`: when the Visant MCP isn't connected.
- `visant-copy` / `visant-headlines`: on-screen text in the client's voice.
