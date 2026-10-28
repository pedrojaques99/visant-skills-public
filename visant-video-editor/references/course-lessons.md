# Video lesson / course: sentence-level breakdown, no b-roll

Learned cutting an open lesson out of 9 raw OBS clips (~90 min, mostly dead silence or a recording
left running). The material had a good sentence here, fifteen minutes of nothing there, and a
background scream in the middle of a sentence.

## Find the cut boundary without guessing

Whisper (`transcribe.sh`, uses `faster_whisper` small on CPU) returns segments with
`start`/`end`. Two facts used to cut safely:

1. **Zero gap between segments = a real speech boundary**, not a cut mid-word. When a segment's
   `end` equals the next `start`, whisper's VAD decided there is a pause (however small): cutting
   exactly there steals no sound from either sentence.
2. **A big gap (>0.5 s) between two segments you keep** is a real pause: tighten it to a small
   residue (~0.1–0.15 s each side), do not delete it entirely. Zero silence between EVERY sentence
   sounds robotic; "YouTube rhythm" means *little* silence, not *none*.

Practice: take the raw `start`/`end` from whisper, pick the sentences that stay, and around each
apply a small margin (`start - 0.05` to `start - 0.1`, `end + 0.1` to `end + 0.15`), **always
checking the real neighbor in the source file**: if the unwanted neighbor is less than 0.15 s
away, the margin must be smaller than that distance, or the cut catches the tip of the speech you
meant to drop (a sliver of a stray word inside the next cut).

When two segments you keep are **contiguous with zero gap** (a sentence whisper split into ~2 s
pieces by VAD, with no real pause between them; common in running speech), **do not** cut between
them: join them as a single `atrim`/`trim`, from the start of the first to the end of the last.
Cutting there would invent a splice where speech never stopped.

## Find a bad audio event (scream, bump, peak)

Quick script, RMS over 20 ms windows compared with the local moving median (1 s of context):

```python
import numpy as np
rms = [...]  # RMS per 20ms window
local_med = [np.median(rms[max(0,i-50):i+51]) for i in range(len(rms))]
for i, v in enumerate(rms):
    base = max(local_med[i], 0.015)
    if v > base * 2.3 and v > 0.11:
        print("peak/scream", i * 0.02)
```

**Tell a real event from natural speech emphasis**: a real peak (scream, bump) shows up in **many
consecutive frames** (>0.3–0.5 s sustained). Normal emphasis passes the same threshold but in 1–2
frames (20–40 ms): a stronger consonant or vowel, not an event. Do not treat them the same: report
the sustained cluster as a cut candidate, and treat short blips as normal (no fix needed).

Energy drops (`v < 0.006` with a high base) are almost always just natural pauses between words,
**not** a mic dropout. A real mic dropout looks different: abrupt silence IN THE MIDDLE of a word
whisper transcribed as continuous (no pause in the segment, but the audio falls to zero). If you
do not find that specific pattern, do not invent a fix for "choppy audio": report it to the user
and ask for the approximate timestamp before touching anything.

## Literal cut, not duck, and why

First attempt (wrong): lower the volume only over the event window with a Gaussian curve
(`volume=eval=frame:volume='1-K*exp(-((t-center)/sigma)^2)'`). It failed in two measured ways:

1. **A Gaussian is weak at the edges.** If the peak lasts 0.6 s but the Gaussian is strong only
   near the center, attenuation at the edge (where the event is also loud) is -3 to -7 dB, almost
   nothing. Compare the peak inside/outside the cut window BEFORE calling it solved: if event peak
   vs. neighboring speech does not flip, the attenuation did not take.
2. **Compressor + loudnorm afterwards can mask the measurement.** `acompressor` with makeup gain
   and `loudnorm` (global linear gain) do not know that stretch was lowered on purpose. If the
   limiter (`alimiter`) clamps both the ducked region and its neighbor at the same ceiling, raw
   peak stops telling them apart and the duck seems to "vanish" when only the wrong meter was used.
   **Measure RMS over a narrow window, not raw peak**, to confirm the duck held.

A flat plateau with soft `tanh` edges (not Gaussian) fixed the weak-edge attenuation:

```
volume=eval=frame:volume='1-P*0.5*(tanh((t-t0)/w)-tanh((t-t1)/w))'
```

`P` = depth (e.g. `1 - 10^(-30/20)` for -30 dB), `t0`/`t1` = plateau start/end (with slack beyond
the measured event), `w` = edge softness (~0.05 s).

**Even so, a literal cut is better by default.** Once the duck worked, the user still asked for a
cut: a good duck is still "hiding", and the original request was "remove". Rule: ask what the
request is before picking the technique. If you can cut without breaking a sentence in progress,
cut. Duck only when the event falls right in the middle of a sentence that must stay whole, and
even then say it is a compromise.

A literal cut can steal the tail of one word and the start of the next (if the event falls right
on a boundary between two sentences; in the original case two words lost about half a phoneme
each). Tell the user explicitly; in practice the sentence context usually covers the loss.

## Desk mic audio (OBS, not phone)

See [audio.md](audio.md#desk-mic) for why NOT to use strong denoise here: it is the opposite of
what seems intuitive (a desk mic has more room noise than a phone, and the temptation is to clean
more).
