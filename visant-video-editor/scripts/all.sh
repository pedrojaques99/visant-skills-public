#!/usr/bin/env bash
# End to end: reads the media -> proposes the cut list -> assembles -> breaks down.
#
# Usage:
#   SRC=/media/folder PROJ=/project/folder bash all.sh
#   SRC=... MAX_MIN=8 bash all.sh            # ~8 min vlog
#   SRC=... PROFILE=youtube bash all.sh      # whole speech take, no ceiling
#   SRC=... PROFILE=reels bash all.sh        # 9:16, lean
#
# Old names still work: TETO_MIN (= MAX_MIN), PERFIL (= PROFILE), profile `registro` (= archive).
#
# Run it in the background when the media is on Google Drive: every file is virtual
# and every read forces a download. See references/pitfalls.md #10.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PROJ="${PROJ:-$PWD}"
export SRC="${SRC:-$PROJ}"
mkdir -p "$PROJ"

PROFILE="${PROFILE:-${PERFIL:-youtube}}"
MAX_MIN="${MAX_MIN:-${TETO_MIN:-}}"     # empty = profile default
case "$PROFILE" in
  youtube)  export AR="${AR:-16:9}"; export MAX_MIN="${MAX_MIN:-0}"
            export MAX_LONG="${MAX_LONG:-0}"; export MAX_MED="${MAX_MED:-7}" ;;
  reels)    export AR="${AR:-9:16}"; export MAX_MIN="${MAX_MIN:-1}"
            export MAX_LONG="${MAX_LONG:-8}"; export MAX_MED="${MAX_MED:-4}" ;;
  archive|registro)
            export AR="${AR:-16:9}"; export MAX_MIN="${MAX_MIN:-0}"
            export MAX_LONG="${MAX_LONG:-0}"; export MAX_MED="${MAX_MED:-0}" ;;
  *) echo "invalid PROFILE: use youtube, reels or archive"; exit 1 ;;
esac
export OUT="${OUT:-vlog}"

echo "### 1/4 ingest     (media: $SRC)"
bash "$HERE/ingest.sh" > /dev/null
awk -F'\t' 'NR>1{n++; t+=$3} END{printf "     %d media files, %.1f min of raw footage\n", n, t/60}' \
  "$PROJ/_build/manifest.tsv"

echo "### 2/4 cutlist    (profile=$PROFILE AR=$AR MAX_MIN=$MAX_MIN)"
bash "$HERE/cutlist.sh" | sed 's/^/     /'

echo "### 3/4 build"
bash "$HERE/build.sh" 2>&1 | grep -v "EXIF buffer\|Last message repeated" | sed 's/^/     /'

echo "### 4/4 breakdown"
THUMBS="${THUMBS:-1}" bash "$HERE/breakdown.sh" 2>&1 | grep -E "thumbs|->|!" | sed 's/^/     /'
