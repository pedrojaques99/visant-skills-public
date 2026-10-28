# Audio: the number one vlog defect

An inaudible take ruins a vlog faster than any image mistake. Phone footage from different days,
places and mic distances varies 15 to 20 LU between takes. Without normalizing, the viewer
touches the volume twice and leaves.

## Target

| Destination | Integrated LUFS | True peak |
|---|---|---|
| YouTube, Instagram, TikTok | **-16** | -1.5 dBTP |
| Spotify / podcast | -14 | -1.0 dBTP |
| Broadcast EBU R128 | -23 | -1.0 dBTP |

`build.sh` uses -16 by default (`ALVO_I=-16`). Streaming turns down what is above target but
**does not raise** what is below: erring low is a permanent loss.

## One pass vs two passes

The decision that most affects quality, and the wrong one is the naive default.

**One pass** (`LOUD=1`): `loudnorm=I=-16` in a single pass. The filter does not know the future,
so it chases the target by **compressing** in real time.

Measured on a moderate-dynamics fixture (the gate case `LOUD=2 preserva dinamica`):

| | I | LRA |
|---|---|---|
| source | -28.1 | 8.8 |
| one pass | -16.4 | **8.0** |
| two passes | -16.1 | **8.8** |

Two passes keeps the source's **exact** dynamic range and lands closer to target. One pass eats
0.8 LU and misses the target by 0.4.

> **Where this matters.** If the measured LRA of the material is **higher** than the target LRA
> (11), ffmpeg turns linear mode off by itself and both modes give identical results. Tested:
> material with LRA 21.8 comes out the same in both. So the two-pass advantage shows on normal
> dynamics material, which is most vlogs.

**Two passes** (`LOUD=2`, default): measures the cut, then applies **linear gain** with the
measured values:

```bash
# pass 1: measure (needs -v info: with -v error the JSON is swallowed, see pitfalls.md#11)
ffmpeg -nostdin -v info -i cut.mp4 \
  -af loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | tail -14

# pass 2: apply what was measured
ffmpeg -i cut.mp4 -af \
  loudnorm=I=-16:TP=-1.5:LRA=11:linear=true:measured_I=-23.4:measured_TP=-5.2:measured_LRA=7.1:measured_thresh=-34.1 \
  -c:v copy out.mp4
```

Cost: one audio analysis pass per cut (fast; video is the bottleneck). `build.sh` does it per cut
inside the loop, and the cache avoids re-measuring.

When `LOUD=1` is justified: preview, draft, deadline. Never on the master.

## Per cut, not on the master

Normalizing only the master gets the average right and leaves the weak take weak. Normalizing per
cut is what guarantees **no** take is inaudible. That is why `loudnorm` lives in the loop and not
only at the concat.

The master gets only `alimiter=limit=0.95`, to hold splice transients.

## De-click

A hard cut in digital audio clicks: the wave is cut mid-cycle. A 15 ms `afade` at each end fixes
it, is inaudible as a fade and removes the click.

```
afade=t=in:st=0:d=0.015,areverse,afade=t=in:st=0:d=0.015,areverse
```

The double `areverse` is the trick to fade the **end** without knowing the cut length up front.

## Uniform sample rate is a prerequisite

`loudnorm` runs at 192 kHz inside; AAC caps at 96 kHz. A cut with loudnorm comes out at 96 kHz, a
cut on the alternate path at 48 kHz, and the concat demuxer **requires identical rates**. Mixing
corrupts the master's audio with `exit 0`.

Always `aresample=48000` **after** loudnorm plus `-ar 48000` on the encoder. Detail and proof in
[pitfalls.md](pitfalls.md#12).

## Clip without an audio track

It must not break the concat or desync the rest. `build.sh` mixes in an `anullsrc` at weight 0
(`amix ... weights='1 0'`), and if the cut has no audio at all the fallback maps the silence
directly. Covered by the gate.

## Music bed

```bash
MUSIC=track.mp3 MUSIC_DB=-18 bash build.sh
```

-18 dB keeps the track under the voice. If the vlog is ambience only, no speech, -12 holds. The
track goes in **after** per-cut loudnorm and before the limiter, so it does not skew each take's
measurement.

<a id="desk-mic"></a>
## Desk mic (OBS, video lesson): strong denoise muffles the voice

Counterintuitive: a desk mic (headset, lavalier, USB) picks up more room hiss than a vlog phone
mic, and the temptation is to clean hard. Tested with `afftdn=nr=10:nf=-30` (right in the middle of
the filter docs' "normal" range): the result sounded **worse**, voice muffled, "underwater". High
`nr` in `afftdn` (FFT denoiser) smears fricatives and plosives together with the noise, because
consonants spread energy over the same spectrum as the hiss. The ear notices the loss of clarity
before it notices the noise is gone.

Fix:

```
highpass=f=80,afftdn=nr=3:nf=-40,equalizer=f=3200:width_type=o:width=1.2:g=4,
acompressor=threshold=-20dB:ratio=2:attack=8:release=150:makeup=1.4
```

- `afftdn nr=3` (or drop the filter): just enough for obvious hum/hiss, never enough to touch
  consonants.
- **Presence boost** (`equalizer` at ~3–3.5 kHz, +3 to +4 dB, narrow band) solves the "clearer"
  request that denoise does NOT: it is selective gain, not subtraction, so it eats no detail.
- Light compressor (`ratio=2`, not 3+): compressing more flattens the transient that gives the
  sense of clarity, stacking on top of the denoiser's muffling.

If the request is "louder and clearer" and the current result "got muffled", the denoiser is the
first suspect, not loudnorm. Test removing `afftdn` entirely before touching the LUFS target.

## Verify (always, do not trust the filter)

```bash
ffmpeg -hide_banner -nostats -i master.mp4 -af ebur128 -f null - 2>&1 | tail -12
```

Read `I:` (integrated, must match target ±1) and `LRA:` (dynamic range: below 3 LU means
over-compression; a healthy vlog sits between 5 and 12).
