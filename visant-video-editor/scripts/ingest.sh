#!/usr/bin/env bash
# Scans the media folder, reads each file's metadata and writes:
#   _build/manifest.tsv  -> full table (sorted by capture date)
#   _build/edl.txt       -> editable cut list:  file <TAB> in <TAB> out
# Usage: bash _tools/ingest.sh
set -euo pipefail

BASE="${PROJ:-$PWD}"      # project root (_build/ and _out/ live here)
ROOT="${SRC:-$BASE}"          # media folder (SRC= points outside)
BUILD="$BASE/_build"
mkdir -p "$BUILD"

MAN="$BUILD/manifest.tsv"
EDL="$BUILD/edl.txt"

printf 'file\tkind\tdur\tw\th\trot\tfps\taudio\tcreated\n' > "$MAN"

shopt -s nullglob nocaseglob
files=()
for f in "$ROOT"/*.{mov,mp4,m4v,avi,mkv,jpg,jpeg,png,heic}; do files+=("$f"); done
shopt -u nocaseglob

if [ ${#files[@]} -eq 0 ]; then
  echo "No media in $ROOT yet. Add the videos and run again."
  exit 0
fi

tmp="$(mktemp)"
for f in "${files[@]}"; do
  base="$(basename "$f")"
  ext="${base##*.}"; ext="$(echo "$ext" | tr 'A-Z' 'a-z')"
  case "$ext" in
    jpg|jpeg|png|heic) kind=foto ;;
    *) kind=video ;;
  esac

  json="$(ffprobe -v error -show_entries \
      format=duration:format_tags=creation_time:stream=codec_type,width,height,r_frame_rate:stream_tags=rotate:stream_side_data=rotation \
      -of default=nw=1 "$f" 2>/dev/null || true)"

  dur="$(printf '%s\n' "$json" | awk -F= '/^duration=/{print $2; exit}')"
  w="$(printf '%s\n'   "$json" | awk -F= '/^width=/{print $2; exit}')"
  h="$(printf '%s\n'   "$json" | awk -F= '/^height=/{print $2; exit}')"
  rot="$(printf '%s\n' "$json" | awk -F= '/^rotation=|^rotate=/{print $2; exit}')"
  fps="$(printf '%s\n' "$json" | awk -F= '/^r_frame_rate=/{print $2; exit}')"
  aud="$(printf '%s\n' "$json" | grep -c '^codec_type=audio' || true)"
  cre="$(printf '%s\n' "$json" | awk -F= '/^TAG:creation_time=/{print $2; exit}')"

  [ "$kind" = foto ] && dur="${DUR_FOTO:-3}"
  [ -z "${cre:-}" ] && cre="$(date -r "$f" -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo 1970-01-01T00:00:00Z)"
  [ -z "${dur:-}" ] && dur=0
  [ -z "${rot:-}" ] && rot=0

  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$base" "$kind" "$dur" "${w:-0}" "${h:-0}" "$rot" "${fps:-0}" "$aud" "$cre" >> "$tmp"
done

sort -t$'\t' -k9,9 "$tmp" >> "$MAN"
rm -f "$tmp"

# Initial EDL: everything in chronological order, full cut (in=0, out=dur)
{
  echo "# Vlog cut list: edit freely."
  echo "# format:  file <TAB> in(s) <TAB> out(s)   |  line starting with # = ignored"
  echo "# reorder the lines to change the order of the cuts."
  awk -F'\t' 'NR>1 { printf "%s\t0\t%s\n", $1, $3 }' "$MAN"
} > "$EDL"

echo "== manifest: $MAN"
column -t -s$'\t' "$MAN" 2>/dev/null || cat "$MAN"
echo
echo "== initial EDL: $EDL  ($(grep -vc '^#' "$EDL") cuts)"
