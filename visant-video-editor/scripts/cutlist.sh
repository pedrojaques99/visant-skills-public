#!/usr/bin/env bash
# Writes a PROPOSED cut list (_build/edl.txt) from the manifest.
#
# Idea: long clip  = backbone (trimmed at the start, where the speech begins).
#       short clip = stitching/b-roll (goes in whole, but is the first to go).
#       If it exceeds the ceiling: first tighten the cap of medium/long clips,
#       then thin the b-roll by uniform sampling. Narrative never disappears.
#
# Usage:
#   bash cutlist.sh                       # ~5 min (default)
#   MAX_MIN=3 bash cutlist.sh             # short vlog
#   MAX_MIN=0 bash cutlist.sh             # no ceiling, uses everything that passes the filter
#   PHOTOS_PER_DAY=0 bash cutlist.sh
#   COMP_LONG=0.20 bash cutlist.sh        # longer speech take (uses spare ceiling)
#
# Old names still work when the new one is unset: TETO_MIN, FOTOS_POR_DIA, DUR_FOTO,
# and manifest kind `foto` (manifests written by older runs).
set -euo pipefail

BASE="${PROJ:-$PWD}"      # project root (_build/ and _out/ live here)
MAN="$BASE/_build/manifest.tsv"
EDL="$BASE/_build/edl.txt"
TMP="$BASE/_build/.cand.$$.tmp"
[ -f "$MAN" ] || { echo "No manifest. Run first: bash ingest.sh"; exit 1; }

MAX_LONG="${MAX_LONG:-14}"      # cap for a long clip (>25s)
MAX_MED="${MAX_MED:-7}"         # cap for a medium clip (6-25s)
MIN_CLIP="${MIN_CLIP:-1.5}"     # below this it is a blink, out
COMP_LONG="${COMP_LONG:-0.06}"  # compression slope of the long take (speech)
COMP_MED="${COMP_MED:-0.40}"    # same, medium take
PHOTO_DUR="${PHOTO_DUR:-${DUR_FOTO:-2.5}}"
PHOTOS_PER_DAY="${PHOTOS_PER_DAY:-${FOTOS_POR_DIA:-3}}"
MAX_MIN="${MAX_MIN:-${TETO_MIN:-5}}"   # target duration in minutes (0 = no ceiling)

[ -f "$EDL" ] && cp "$EDL" "$EDL.bak"

# Temp files die on EXIT, not at the end of the happy path: an error exit left
# junk in _build/, and with a fixed name that collided with the other script running alongside.
ROT_TMPS="$BASE/_build/.cand.$$.tmp $BASE/_build/.rot.$$.tmp"
trap 'rm -f $ROT_TMPS' EXIT

gera_cand() {   # $1=MAX_LONG  $2=MAX_MED  -> TMP with narrative weight in col 1
  awk -F'\t' -v ml="$1" -v mm="$2" -v mc="$MIN_CLIP" \
             -v cl="$COMP_LONG" -v cm="$COMP_MED" \
             -v df="$PHOTO_DUR" -v fpd="$PHOTOS_PER_DAY" '
    NR == 1 { next }
    {
      file = $1; kind = $2; dur = $3 + 0
      split($9, a, "T"); dia = a[1]
      if (kind == "photo" || kind == "foto") {   # foto = manifest from an older run
        if (fpd <= 0) next
        if (++fotos[dia] > fpd) next
        printf "photo\t%s\t0\t%.1f\n", file, df
        next
      }
      if (dur < mc) next
      # LIM_LONG/LIM_MED = CLASSIFICATION boundary (fixed).
      # ml/mm = DURATION cap of the cut. They are different things: if the boundary
      # moved with the cap, tightening the cap would push b-roll into narrative.
      # PROPORTIONAL cap, not flat: a bigger take is still a bigger cut.
      # A flat cap gave 41 identical 5.0s cuts: conveyor-belt rhythm, not a vlog.
      # cl/cm = compression SLOPE. It, not the cap, is usually the limiter:
      # with cl=0.06 a 125s take becomes 14s and raising the cap changes nothing.
      # Spare ceiling is spent here, on the narrative, not on the cap.
      if (dur > 25) {
        if (ml <= 0) o = dur                 # ml=0 -> long take goes in whole
        else { o = 8 + (dur - 25) * cl; if (o > ml) o = ml }
        printf "long\t%s\t0\t%.1f\n", file, o
      } else if (dur > 6) {
        if (mm <= 0) o = dur                 # mm=0 -> medium goes in whole
        else { o = 2.5 + (dur - 6) * cm; if (o > mm) o = mm }
        printf "medium\t%s\t0\t%.1f\n", file, o
      } else {
        printf "short\t%s\t0\t%.1f\n", file, dur
      }
    }' "$MAN" > "$TMP"
}

piso() { awk -F'\t' '$1=="long" || $1=="medium" { t += $4 } END { printf "%d", t+0 }' "$TMP"; }

if [ "$MAX_MIN" != 0 ]; then
  alvo=$(( MAX_MIN * 60 * 80 / 100 ))     # narrative takes at most 80% of the ceiling
  # Tightens the SLOPE along with the caps. Touching only the cap did not help when
  # the slope was the limiter: MAX_MIN=15 once delivered 16.0 min, a ceiling asked
  # for and not met, which is worse than a wrong ceiling.
  for _ in $(seq 1 60); do
    gera_cand "$MAX_LONG" "$MAX_MED"
    [ "$(piso)" -le "$alvo" ] && break
    COMP_LONG="$(awk -v c="$COMP_LONG" 'BEGIN{ printf "%.4f", (c*0.85 < 0.02 ? 0.02 : c*0.85) }')"
    COMP_MED="$( awk -v c="$COMP_MED"  'BEGIN{ printf "%.4f", (c*0.85 < 0.05 ? 0.05 : c*0.85) }')"
    if   [ "$MAX_MED"  -gt 4 ]; then MAX_MED=$(( MAX_MED - 1 ))
    elif [ "$MAX_LONG" -gt 8 ]; then MAX_LONG=$(( MAX_LONG - 2 ))
    fi
  done
else
  gera_cand "$MAX_LONG" "$MAX_MED"
fi

KEEP_MOD=1
if [ "$MAX_MIN" != 0 ]; then
  KEEP_MOD="$(awk -F'\t' -v teto="$(( MAX_MIN * 60 ))" '
    { if ($1=="long" || $1=="medium") fixo += $4; else { flex += $4; n++ } }
    END {
      sobra = teto - fixo
      if (sobra <= 0 || n == 0) { print (n ? n : 1); exit }
      frac = sobra / flex
      if (frac >= 1) { print 1; exit }
      # A CEILING IS A CEILING: round UP. With int(1/frac+0.5), frac=0.8 gave k=1
      # and no b-roll was removed; the 15 min ceiling delivered 16.0.
      r = 1/frac; k = int(r); if (r > k) k = k + 1
      print (k < 2 ? 2 : k)
    }' "$TMP")"
fi

awk -F'\t' -v k="$KEEP_MOD" '
  {
    if ($1 == "long" || $1 == "medium") keep = 1
    else keep = (k <= 1) ? 1 : (++c % k == 1)
    if (keep) {
      printf "%s\t%s\t%s\n", $2, $3, $4
      tot += $4; n++
      if      ($1 == "long")   nl++
      else if ($1 == "medium") nm++
      else if ($1 == "photo")  nf++
      else                    nc++
    }
  }
  END {
    printf "#SUMMARY %d cuts = %d long + %d medium + %d b-roll + %d photo  |  %.1f min  |  1 of every %d b-roll\n",
           n, nl, nm, nc, nf, tot/60, k
  }' "$TMP" > "$BASE/_build/.rot.$$.tmp"

{
  echo "# PROPOSED cut list: cutlist.sh (MAX_MIN=$MAX_MIN MAX_LONG=$MAX_LONG MAX_MED=$MAX_MED MIN_CLIP=$MIN_CLIP)"
  echo "# order = chronological by capture. Comment out with # what you do not want; reorder to change the cut."
  grep '^#SUMMARY' "$BASE/_build/.rot.$$.tmp"
  grep -v '^#SUMMARY' "$BASE/_build/.rot.$$.tmp"
} > "$EDL"
rm -f "$TMP" "$BASE/_build/.rot.$$.tmp"

grep '^#SUMMARY' "$EDL" | sed 's/^#SUMMARY //'
echo "-> $EDL"
