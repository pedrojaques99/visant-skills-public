#!/usr/bin/env bash
# Picks the BEST moment of each clip and ranks clips by technical quality.
# It keeps the edit from entering a take at its shaky start, and picks b-roll
# by sharpness instead of by file order.
#
# Writes:
#   _build/frames.tsv   file <TAB> best_t <TAB> sharpness <TAB> brightness <TAB> score
# Readers (plan.py) use the columns by position, so a frames.tsv from an older
# run (header t/nitidez/brilho/nota) still works.
#
# Usage: SRC=/media PROJ=/project bash frames.sh
#        PROBES=5 bash frames.sh     # probes more points per clip (slower; old name PONTOS)
#
# MEASURED LIMIT: the score is TECHNICAL QUALITY, not narrative value. It punishes
# two things that are often the most important in the video:
#   - talking selfie (blown background, few edges) -> but it is the narrative spine
#   - close-up of a flat graphic piece (sign, badge) -> but it is the work's product
# Use the score to (a) pick the entry point of a take and (b) order B-ROLL
# within a chapter. NEVER to decide what goes into the video.
set -uo pipefail

BASE="${PROJ:-$PWD}"
ROOT="${SRC:-$BASE}"
MAN="$BASE/_build/manifest.tsv"
OUT="$BASE/_build/frames.tsv"
PROBES="${PROBES:-${PONTOS:-3}}"
[ -f "$MAN" ] || { echo "No manifest. Run first: ingest.sh"; exit 1; }

# sharpness = edge density after edgedetect. Camera shake and lost focus
# drop this number, which is exactly the b-roll that should not go in.
nitidez() { ffmpeg -nostdin -v error -ss "$2" -i "$1" -frames:v 1 \
  -vf "scale=480:-2,edgedetect=low=0.1:high=0.3,signalstats,metadata=print:file=-" \
  -f null - 2>/dev/null | awk -F= '/YAVG/{printf "%.2f",$2; exit}'; }
brilho()  { ffmpeg -nostdin -v error -ss "$2" -i "$1" -frames:v 1 \
  -vf "scale=480:-2,signalstats,metadata=print:file=-" \
  -f null - 2>/dev/null | awk -F= '/YAVG/{printf "%.0f",$2; exit}'; }

printf 'file\tbest_t\tsharpness\tbrightness\tscore\n' > "$OUT"
tot="$(awk -F'\t' 'NR>1 && $2=="video"' "$MAN" | wc -l)"
i=0

while IFS=$'\t' read -r -u 9 f dur; do
  i=$((i+1))
  src="$ROOT/$f"
  [ -f "$src" ] || continue
  melhor_t=0; melhor_n=0
  # probes inside the core: 20%..80%. The start usually has the camera being
  # raised and the end, being lowered.
  for k in $(seq 1 "$PROBES"); do
    t="$(awk -v d="$dur" -v k="$k" -v n="$PROBES"'BEGIN{printf "%.1f", d*(0.2 + 0.6*(k-1)/(n>1?n-1:1))}')"
    n="$(nitidez "$src" "$t")"; n="${n:-0}"
    maior="$(awk -v a="$n" -v b="$melhor_n" 'BEGIN{print (a>b)?"s":"n"}')"
    [ "$maior" = s ] && { melhor_n="$n"; melhor_t="$t"; }
  done
  b="$(brilho "$src" "$melhor_t")"; b="${b:-0}"
  # score: sharpness penalized by bad exposure. Too dark or blown out cannot
  # be fixed in the edit.
  nota="$(awk -v n="$melhor_n" -v b="$b" 'BEGIN{
    p=1
    if (b<45)  p=0.35
    else if (b<70)  p=0.75
    else if (b>205) p=0.40
    else if (b>185) p=0.80
    printf "%.2f", n*p }')"
  printf '%s\t%s\t%s\t%s\t%s\n' "$f" "$melhor_t" "$melhor_n" "$b" "$nota" >> "$OUT"
  [ $((i % 20)) = 0 ] && echo "  $i/$tot"
done 9< <(awk -F'\t' 'NR>1 && $2=="video" {print $1"\t"$3}' "$MAN")

echo
echo "== best 12:"
tail -n +2 "$OUT" | sort -t$'\t' -k5 -rn | head -12 | awk -F'\t' '{printf "  %-18s t=%-6s score=%-7s (sharpness %s, brightness %s)\n",$1,$2,$5,$3,$4}'
echo "== worst 6 (candidates to leave out):"
tail -n +2 "$OUT" | sort -t$'\t' -k5 -n | head -6 | awk -F'\t' '{printf "  %-18s score=%-7s (sharpness %s, brightness %s)\n",$1,$5,$3,$4}'
echo "-> $OUT"
