#!/usr/bin/env bash
# Transcribes the speech takes and returns text WITH TIMECODE, which is what lets
# you assemble by argument instead of by date.
#
# Writes:
#   _build/transcripts/<file>.txt   one line per sentence: start<TAB>end<TAB>text
#   _build/transcripts.tsv          all together: file<TAB>start<TAB>end<TAB>text
#
# Usage: SRC=/media PROJ=/project bash transcribe.sh
#        MIN_SPEECH=25 bash transcribe.sh          # only the long takes
#        WHISPER_MODEL=medium bash transcribe.sh   # more accurate, much slower
#        WHISPER_LANG=pt bash transcribe.sh        # force the language (default: auto-detect)
#
# Old names still work when the new one is unset: MIN_FALA, MODELO, IDIOMA, and a
# _build/transcricao/ cache from an older run is reused (copied into transcripts/).
#
# Uses faster_whisper as a Python module (pip install faster-whisper); the `whisper`
# CLI already broke on invocation. PYTHON=<interpreter> picks the python (default: python, else python3).
set -uo pipefail

BASE="${PROJ:-$PWD}"
ROOT="${SRC:-$BASE}"
MAN="$BASE/_build/manifest.tsv"
OUTDIR="$BASE/_build/transcripts"
TSV="$BASE/_build/transcripts.tsv"
MIN_SPEECH="${MIN_SPEECH:-${MIN_FALA:-6}}"     # below this there is almost never a whole sentence
WHISPER_MODEL="${WHISPER_MODEL:-${MODELO:-small}}"
WHISPER_LANG="${WHISPER_LANG:-${IDIOMA:-}}"     # empty = whisper detects it

[ -f "$MAN" ] || { echo "No manifest. Run first: ingest.sh"; exit 1; }
# cache from an older run (folder name before the English rename): keep it, with
# its timestamps, so already transcribed takes are not transcribed again.
if [ ! -d "$OUTDIR" ] && [ -d "$BASE/_build/transcricao" ]; then
  cp -Rp "$BASE/_build/transcricao" "$OUTDIR"
fi
mkdir -p "$OUTDIR"
if [ -z "${PYTHON:-}" ]; then
  for p in python python3; do
    "$p" -c "import sys; sys.exit(sys.version_info[0] < 3)" 2>/dev/null && { PYTHON="$p"; break; }
  done
fi
[ -n "${PYTHON:-}" ] || { echo "No Python 3 on PATH (or set PYTHON=)"; exit 1; }
"$PYTHON" -c "import faster_whisper" 2>/dev/null || { echo "Missing faster-whisper: $PYTHON -m pip install faster-whisper"; exit 1; }

# candidates: video, with an audio track, above the minimum. Order: longest first,
# because the long take is where the thesis lives; if you interrupt, you already have what matters.
# while-read instead of mapfile: also runs on macOS bash 3.2
ALVOS=()
while IFS= read -r l; do ALVOS+=("$l"); done < <(awk -F'\t' -v m="$MIN_SPEECH" 'NR>1 && $2=="video" && $8>0 && $3+0>=m {print $3"\t"$1}' "$MAN" \
                     | sort -rn | cut -f2)

echo "== ${#ALVOS[@]} speech takes (>= ${MIN_SPEECH}s), model=$WHISPER_MODEL, language=${WHISPER_LANG:-auto}"
[ "${#ALVOS[@]}" -gt 0 ] || { echo "nothing to transcribe"; exit 0; }

i=0
for f in "${ALVOS[@]}"; do
  i=$((i+1))
  dst="$OUTDIR/${f%.*}.txt"
  src="$ROOT/$f"
  [ -f "$src" ] || { echo "  ! not found: $f"; continue; }
  if [ -s "$dst" ] && [ "$dst" -nt "$src" ]; then
    echo "  = [$i/${#ALVOS[@]}] $f (cache)"; continue
  fi
  echo "  + [$i/${#ALVOS[@]}] $f"

  wav="$(mktemp -u).wav"
  ffmpeg -nostdin -y -v error -i "$src" -vn -ac 1 -ar 16000 "$wav" 2>/dev/null || { echo "    (no audio)"; continue; }

  WHISPER_MODEL="$WHISPER_MODEL" WHISPER_LANG="$WHISPER_LANG" WAV="$wav" DST="$dst" "$PYTHON" - <<'PY' || echo "    (failed)"
import os, sys
from faster_whisper import WhisperModel
mdl = os.environ["WHISPER_MODEL"]; wav = os.environ["WAV"]; dst = os.environ["DST"]
m = WhisperModel(mdl, device="cpu", compute_type="int8")
segs, _ = m.transcribe(wav, language=os.environ["WHISPER_LANG"] or None, vad_filter=True,
                       vad_parameters=dict(min_silence_duration_ms=400))
linhas = []
for s in segs:
    t = s.text.strip()
    if t:
        linhas.append(f"{s.start:.1f}\t{s.end:.1f}\t{t}")
with open(dst, "w", encoding="utf-8") as fh:
    fh.write("\n".join(linhas) + ("\n" if linhas else ""))
print(f"    {len(linhas)} sentences")
PY
  rm -f "$wav"
done

# consolidate
: > "$TSV"
for t in "$OUTDIR"/*.txt; do
  [ -e "$t" ] || continue
  nome="$(basename "${t%.txt}")"
  awk -F'\t' -v n="$nome" 'NF>=3 {printf "%s\t%s\t%s\t%s\n", n, $1, $2, $3}' "$t" >> "$TSV"
done

echo
echo "== $(wc -l < "$TSV") sentences from $(ls "$OUTDIR"/*.txt 2>/dev/null | wc -l) takes"
echo "-> $TSV"
