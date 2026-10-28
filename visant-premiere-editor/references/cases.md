# Cases behind the rules

Where the rules in `SKILL.md` and `pitfalls.md` came from. Context, not instructions.

- **Course "IA para Designers" (Sep–Oct 2026).** Every row of the pitfalls table was seen while
  assembling this course in Premiere 2026 PT-BR with premiere-pro-mcp 1.17 (CEP), first on
  23/09/2026. The course project held the lesson engine and the project-side scripts this skill
  names: `aulas.py` (common encode, `aulas.COMUM(N)`), `aula_tela.py` and `premiere_plano.py`
  (plan generators), `aperta_final.py` (tighten; `silencios()`, `completo()`), `aprende.py`,
  `fala.py`, `agente.py`, `rampa.py`, `onde.py`, `trecho.py`, `fonte_iphone.py` (HLG→SDR via
  zscale + tonemap hable, `--gira 180`), `entrega.py`, `legenda_whisper.py`, `sensor_export.py`,
  `cor_aplica.py` / `cor_curso.py` (LUT with explicit BT.709), and `render.py` (another engine,
  -16 LUFS, vs the lesson engine's -24).
- **Whisper over the pause.** In lesson 1.1 a single word spanned 4.7 s over a pause, which is why
  silence is measured from the wav energy.
- **Keyframes on stills (06/10/2026).** A card stayed at opacity 0 the whole time because the
  keyframes landed before `inPoint = 3600`; the readback said all was fine.
- **Card on the highest track (06/10/2026).** In lesson 2.8 the notices went to V2 and vanished
  under a full-screen b-roll on V3. In lesson 2.1 a logo card ("Conectar no Figma, no Drive…")
  was dropped because the slide already showed it.
- **Ending learned from the user.** The user redid a lesson ending by hand; `aprende.py` was
  written to diff their export against the generated one and replay it (`edicao_dono.tsv`).
- **Media Encoder queue.** The AME queue sometimes never started, or re-rendered an old queue as
  `*_1.mp4` on reopening; `export_sequence` became the fallback.
- **Color.** `copy_effects_between_clips` reported "copied" and delivered an identity grade; the
  user's Lumetri `.cube` applied in ffmpeg with an explicit BT.709 matrix matched Premiere.
