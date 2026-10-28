# Pitfalls: the silent failures of this pipeline

Every item here once delivered a wrong video with `exit 0`. Ordered by how much it costs to find
out late. All of them have a case in `scripts/self-test.sh`; if you touch the pipeline, the gate is
what stops a relapse.

## Index

- [Rule zero: test the consequence, not the cause](#rule-zero)
- [1. Fixed-name temp file between concurrent scripts](#1)
- [2. Cache keyed by position](#2)
- [3. Rotation via metadata](#3)
- [4. `set -e` inside a pipe loop](#4)
- [5. `ffprobe -of csv=p=0` returns a trailing comma](#5)
- [6. Windows ffmpeg builds without glob](#6)
- [7. concat demuxer does not accept msys paths (Windows)](#7)
- [8. A photo with `-ss` produces no frame](#8)
- [9. Photos have no `creation_time`](#9)
- [10. Google Drive for desktop: virtual files](#10)
- [11. `-v error` swallows the two-pass loudnorm measurement](#11)
- [12. loudnorm resamples to 192 kHz and mixes cut sample rates](#12)
- [Corrected folklore: ffmpeg eating stdin](#folklore)

---

<a id="rule-zero"></a>
## Rule zero: test the consequence, not the cause

The most valuable gate case is the dumbest one: **does every cut in the EDL reach the concat?** It
does not know why a cut would vanish. That is why it catches causes not yet diagnosed, including
the one you will introduce tomorrow.

A cause test ("is `-nostdin` there?") only proves you remembered a known cause. An invariant test
proves the video is whole.

---

<a id="1"></a>
## 1. Fixed-name temp file between concurrent scripts

**Root cause of the most confusing abort this pipeline ever had.** `cutlist.sh` and
`breakdown.sh` wrote the same `_build/.edl.tmp`. Running together (one in background, which is
normal here because ingest is slow), one read the other's file half-written, the `join` columns
misaligned, `printf '%03d'` got a filename, and `set -e` killed the loop midway.

Symptom: the breakdown stopped at 7 of 148 items, **exit 0**.

Rule: every temp file gets the script prefix **and `$$`**. `mktemp` works too. Never a guessable
shared `.tmp` name.

**It relapsed three times in this codebase**, in different files:
1. `.edl.tmp` shared between `cutlist.sh` and `breakdown.sh`
2. `concat.txt` shared between two simultaneous builds: 47 entries for a 45-line EDL, i.e. a
   master with cuts from two edits
3. the fix for (2) itself: the list became per-process **and was deleted on EXIT**, blinding the
   three gate cases that inspect it

The conclusion worth more than the rule: **documenting did not stop the relapse, the test did.**
Corollary of (3): a work file may be per-process, but always leave a fixed-name copy
(`concat.last.txt`) for after-the-fact inspection. Without it you lose the check that warns
when a cut goes missing.

---

<a id="2"></a>
## 2. Cache keyed by position

Naming a cut by position (`001.mp4`) makes the cut from an old EDL get reused for a **different**
clip when the EDL changes. Wrong video in the right place, without a single warning.

Rule: the key is `md5(file|in|out|fill|W|H|fps|loud)`. Anything that changes a pixel or the
waveform must be in the key. Changed an audio parameter and forgot to include it? The cache
serves the old audio.

---

<a id="3"></a>
## 3. Rotation via metadata

Phones record 1920x1080 **in pixels** and set `rotation=-90` in the display matrix. Reading
width/height without the rotation classifies a vertical clip as horizontal, and cropping to 16:9
destroys the framing.

```bash
ffprobe -v error -select_streams v:0 \
  -show_entries stream=width,height:stream_side_data=rotation \
  -of default=nw=1 file.MOV
```

If `|rotation|` is 90 or 270, **swap width and height** before deciding.

To build a test fixture: `-metadata:s:v:0 rotate=90` **does not write** the display matrix in
recent ffmpeg. Use `-display_rotation 90` on the input with `-c copy`.

---

<a id="4"></a>
## 4. `set -e` inside a pipe loop

`cmd | while read ...; do ... done` runs the body in a subshell. A command that fails there
**aborts the whole loop** under `set -e`, and the script continues as if it had finished. Partial
count, exit 0.

Rule: in a loop body, every command that can fail on bad data gets an explicit `|| true` or an
`if ...; then ... else` with a message. And always close with a count test (input = output).

---

<a id="5"></a>
## 5. `ffprobe -of csv=p=0` returns a trailing comma

Asking for stream fields plus side_data, the output comes as `1920,1080,` with a trailing comma.
`[ "$h" -gt 0 ]` with `1080,` fails, and inside an `||` that falls to the wrong default
**silently**.

Rule: `-of default=nw=1` and parse `key=value` with awk, stripping non-digits.

---

<a id="6"></a>
## 6. Windows ffmpeg builds without glob

```
Pattern type 'glob' was selected but globbing is not supported by this libavformat build
```

Image sequence input must be `-i '%03d.jpg'` with `-start_number`, and the numbering **cannot
have gaps**: the demuxer stops at the first missing file. (The scripts already do this on every
OS.)

Corollary: number the file with your own sequential counter, and draw the logical number (of the
cut) inside the image with `drawtext`.

---

<a id="7"></a>
## 7. concat demuxer does not accept msys paths (Windows)

On Windows the ffmpeg is a native build and the shell is Git Bash. A `/tmp/...` or `/h/...` path
inside `concat.txt` gives:

```
Impossible to open '/c/tmp/...'
```

Rule: the concat list lives **in the same folder as the cuts** and references only the relative
basename. (Harmless on macOS/Linux, so the scripts always do it.)

---

<a id="8"></a>
## 8. A photo with `-ss` produces no frame

`ffmpeg -ss 0.3 -i photo.jpg -frames:v 1` fails. In a loop that opens a gap in the numbering and
breaks the contact sheet (see #6).

Rule: no `-ss` for still images.

---

<a id="9"></a>
## 9. Photos have no `creation_time`

Phone photos usually carry no `creation_time` in the container. The natural fallback is mtime,
which on Google Drive is the **upload time**, not the capture time.

Consequence: chronological order of photos is fiction. For videos it is reliable. Tell the user
before they see a day-3 photo in the middle of day 1, and offer to place photos by hand in the
EDL.

To read real EXIF: `exiftool -DateTimeOriginal` (not installed by default).

---

<a id="10"></a>
## 10. Google Drive for desktop: virtual files

On a Drive for desktop mount (on Windows e.g. `H:\Meu Drive\...`) a file is virtual until read.
Every `ffprobe`/`ffmpeg` forces a download.

Practical consequence: ingesting ~170 files takes minutes, and encoding 2.5 GB takes an hour.
**Run in background** and tell the user the cost before, not after. Never run the whole pipeline
in foreground thinking it is fast.

---

<a id="11"></a>
## 11. loudnorm: `-v error` swallows the two-pass measurement

`loudnorm` prints `print_format=json` at **info** level. Running the measurement pass with
`-v error` returns an empty string; the code falls back to one pass and `LOUD=2` becomes a
**silent no-op**: same command, same output, no error.

That is exactly what happened while writing this skill, and it only showed up because the docs'
own claim was verified: one pass and two passes gave identical results.

Rule: the measurement pass uses `-v info`. And the gate measures the consequence (dynamics
preserved), not the presence of the flag.

On the real effect of one pass: it compresses, but less than first claimed. Measured numbers in
[audio.md](audio.md). The original "LRA of 1.6 LU" claim came from event footage and **was not
attributable to one pass**: it was a trait of the material (short clips, constant ambience).

---

<a id="12"></a>
## 12. loudnorm resamples to 192 kHz and mixes cut sample rates

`loudnorm` resamples **internally** to 192 kHz. The AAC encoder does not go above 96 kHz, so the
cut comes out at **96 kHz**, even if the input was 48 kHz and even with `aresample=48000`
**before** the filter.

A cut that takes the alternate path (no audio, no loudnorm) comes out at 48 kHz.

The concat demuxer requires **identical** parameters across cuts. Mixed rates give:

```
[dec:aac] Error submitting packet to decoder: Invalid data found when processing input
[aac] Number of scalefactor bands in group (42) exceeds limit (41).
```

Measured: **843 errors** in a 14-min master, with `exit 0`.

Rule: `aresample=<rate>` **after** loudnorm, and `-ar <rate>` on the encoder. Both: they are
independent fixes, and one covers the other if someone touches the filter.

10-second proof:

```bash
ffmpeg -i in.m4a -af "aresample=48000,loudnorm=I=-16:TP=-1.5:LRA=11" -c:a aac out.m4a
ffprobe -v error -select_streams a:0 -show_entries stream=sample_rate -of csv=p=0 out.m4a
# 96000  <- the input rate does not matter
```

**Why it passed 22 tests:** all fixtures followed the same audio path, and a uniformly wrong rate
concatenates without complaint. The defect only shows when cuts of the same EDL take
**different** paths. Fixture lesson: cover the main AND the alternate path **in the same build**,
not in separate builds.

And when fixing: the audio chain went into the cache key (`a2`). Without it, the old 96 kHz cut
would keep being served and the fix would never reach the master. See [#2](#2).

---

<a id="folklore"></a>
## Corrected folklore: ffmpeg eating stdin

There is a classic, real bug: `ffmpeg` inside `while read` consumes the loop's stdin and skips
iterations. Keeping `-nostdin` and reading the EDL through a dedicated descriptor
(`read -u 9` / `done 9<`) costs nothing and is good practice.

**But that is not what broke here.** The diagnosis was made by symptom similarity and was wrong:
a controlled mutation (removing `-nostdin` and putting the loop back on stdin) **does not
reproduce** the failure with this ffmpeg version, neither in a file loop nor a pipe loop. The real
cause was #1, the temp file collision.

The lesson worth more than the bug: a one-hour build restart was done on a presumed cause. Before
acting on an expensive hypothesis, **reproduce the defect with a controlled mutation**. That is
what the gate is for.
