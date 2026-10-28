# Cases behind the rules

The rules in `SKILL.md` came from these jobs. Paths below were on the original author's machine
and are not shipped; they only say where the reference implementation lived.

## Client Y: site plates for the deck (Oct 2026)

- 7 videos approved. Reference project kept privately (`marca-reels`), with an `entrega.sh` that
  became `scripts/deliver.example.sh`.
- Brand showreel reference project (`marca-showreel`): `src/fx.tsx` held `Mist`, `MistWords`,
  `Grain`, `KenBurns`, `Plate` and the `nevoa()` transition; `brand.ts` held the brand data.
- The site used Mozilla Text while the visual identity in the deck was Zalando Sans: that is why
  the rule says type and palette come from the deck.
- Frantic reel (`src/reel.tsx`) was approved with the Arko® Brand Reel as rhythm reference; the
  slow 1:40 version was rejected.
- Soft/smoky reel v2 (`src/reel2.tsx`) is where the multiply-overlay smoke technique came from.
- Figma layouts assembling: alpha extraction script was `layers-src/matte.mjs` (ImageMagick).

## Product B: real-app showreel (Oct 2026)

- Reference project `produto-showreel`: capture in `scripts/capture.mjs`, cut in
  `src/v6/Punch.tsx`, render + loudness by `scripts/render-fast.ps1 -Only <cut>` (PowerShell).
- The vague line "Ele chega sozinho." was rejected for "Ele mesmo cria o perfil.": copy has to be
  obvious and Brazilian-spoken. Accent was a cyan full stop.
- Language per composition: `src/pt.ts` imported `pt-flag.ts` before the Root, same as the teaser.
- Chat attachment in the OpenBot agent does not accept MP4: remux to `.mov` (`-c copy`) and attach
  from the agent folder.
- Windows-only tip used there: a Google Drive folder link without a logged-in browser. The folder
  id is in Drive for desktop's database
  (`%LOCALAPPDATA%\Google\DriveFS\<account>\mirror_metadata_sqlite.db`, table `items`, column
  `id`; open **read-only**). URL: `https://drive.google.com/drive/folders/<id>`.

## Client T: portfolio cards and studio reel (Oct 2026)

- Reference: a shared `cliente-t/motion/` folder (README + tools) plus `estudio-cliente/reels`
  (scenes) and `estudio-cliente/motion` (Remotion).
- `record.mjs` gained `W`, `H`, `DPR`, `MOBILE=1` and `KEEP_UI=1` in this job.
- Scenes were generated from `portfolio.json` (only `publico:true` with a URL).
- Card packaging script: `tools/pack-cards.ps1` (PowerShell).
- PowerShell gotchas paid there: variables ignore case (`$d` overwrites `$D`) and `R` is an alias
  of `Invoke-History`. Use unique names.
- CC0 track that worked: Free Music Archive, John Bartmann (CC0 album). The MP3 comes from the
  `fileUrl` in the track page HTML.
