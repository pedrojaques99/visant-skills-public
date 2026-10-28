# Cases behind the rules

Short history of where the rules in `SKILL.md` and the references came from. Read for context,
not for instructions.

- **Event vlog (trade fair footage, ~170 phone files on Google Drive for desktop).** Source of the
  pipeline itself, the cache-by-content rule, the photo-date pitfall and the "run in background,
  say the cost first" rule: ingest took minutes and encoding 2.5 GB took an hour. The "LRA 1.6 LU"
  number first blamed on one-pass loudnorm came from this material and was later shown to be a
  trait of the footage (see `pitfalls.md#11`).
- **Narrated essay edit.** `planeja.py` used to wrap the b-roll list per block (`i % len`): the
  whole video spun on the same 6 clips while 130 files and 342 s of footage sat unused. Hence the
  global no-repeat pool. The breath of ambience between pieces of the same speech "sounded like a
  cut mid-sentence", the fairest complaint received, hence "breath only between different sources".
- **Open lesson from 9 raw OBS clips (~90 min).** Source of `course-lessons.md`: sentence-level
  cuts on whisper boundaries, the scream removed by literal cut after a working duck was still
  rejected ("remove", not "hide"), and two words that lost about half a phoneme each at that cut.
  The user asked for "YouTube rhythm", which turned out to mean little silence, not none.
- **Course "IA para Designers".** The lesson-ending rule (the closing evaluation got cut after a
  stalled attempt) came from this course; its project had an ending gate, `edicao/fecho.py`, that
  flagged every lesson whose next word in the raw came within 3 s. That script lives in the course
  project, not in this skill.
