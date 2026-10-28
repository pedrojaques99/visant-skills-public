# Tools: what already exists, and when to use it instead of the scripts

House rule: do not reinvent. This skill's scripts do **EDL-driven assembly** (decide cut order
and length, normalize format, concatenate). The tools below do things the scripts do not, and do
them better.

Check what is installed before promising anything:

```bash
for t in ffmpeg ffprobe auto-editor whisper ffmpeg-normalize exiftool; do
  printf '%-18s ' "$t"; command -v $t >/dev/null && echo ok || echo "-"
done
python -c "import faster_whisper" && echo "faster_whisper ok"
```

## auto-editor: silence cutting (jump cut)

`pip install auto-editor` (tested with v29.3.1). It does what `roteiro.sh` does **not**: cuts the
silence *inside* a take. `roteiro.sh` decides which takes go in and for how long; `auto-editor`
cleans the middle of each.

```bash
auto-editor take.mp4 --margin 0.2s -o take-clean.mp4
```

Tested: a 7s take with 3s of silence in the middle → 4.43s.

When to use: long speech takes (>25s), interviews, testimonials, tutorials: anything where the
person talks, thinks, breathes, resumes.

When **not** to use: b-roll, ambience, music, drone. There is no speech, and the "silence" is the
content.

Recommended flow for a speech-heavy vlog:

```bash
# 1. clean the long takes BEFORE ingest
mkdir -p clean
for f in TAKE_*.MOV; do auto-editor "$f" --margin 0.25s -o "clean/$f"; done
# 2. run the normal pipeline pointing to the clean folder
SRC=./clean bash ingest.sh && bash roteiro.sh && bash build.sh
```

Options that matter: `--margin` (breath before/after speech; 0.2–0.3s sounds natural, 0 sounds
robotic), `--edit audio:threshold=4%` (sensitivity), `--silent-speed` (speeds up instead of
cutting).

## whisper: subtitles and transcription

`transcreve.sh` uses **faster-whisper as a Python module** (`pip install faster-whisper`), not the
`whisper` CLI: the openai-whisper CLI has broken on invocation (traceback in `runpy`) on the
author's Windows setup. Before promising subtitles, test whichever you have:

```bash
python -c "import faster_whisper" && echo ok
whisper --help 2>&1 | head -3
```

If neither works, the options are: the API, `faster-whisper`, or `whisper.cpp`. Do not promise
automatic subtitles without having run it once.

When it works, the `.srt` can be burned in:

```bash
ffmpeg -i vlog.mp4 -vf "subtitles=vlog.srt:force_style='FontSize=18'" -c:a copy subtitled.mp4
```

## ffmpeg-normalize: batch loudness

Optional (`pip install ffmpeg-normalize`). A Python wrapper over `loudnorm`, two passes by default
and fewer ways to get it wrong.

`build.sh` already does two passes per cut (`LOUD=2`), so it is not needed. Worth it when the job
is audio only, or to normalize a whole folder at once:

```bash
ffmpeg-normalize *.mp4 -t -16 -o out/ --audio-codec aac
```

## exiftool: real photo date

Optional. Solves pitfall #9 in [pitfalls.md](pitfalls.md): a photo without `creation_time` falls
back to mtime, which is the upload time.

```bash
exiftool -DateTimeOriginal -s3 photo.jpg
```

Without it, chronological order of photos is not reliable: tell the user instead of delivering an
edit with a photo on the wrong day.

## What NOT to bring in

- **moviepy / editly / ffmpeg-python**: Python/JS layers over ffmpeg. The pipeline here is bash +
  ffmpeg directly, runs with no dependencies and the gate covers it. Swapping in a wrapper only
  adds failure surface.
- **Scene detector** (`ffmpeg -vf select=gt(scene\,0.4)`): useful to slice a long continuous
  recording. Phone footage already comes sliced into one file per take, and `creation_time` does
  that job better.
