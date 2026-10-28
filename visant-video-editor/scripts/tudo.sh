#!/usr/bin/env bash
# End to end: reads the media -> proposes the cut list -> assembles -> breaks down.
#
# Usage:
#   SRC=/media/folder PROJ=/project/folder bash tudo.sh
#   SRC=... TETO_MIN=8 bash tudo.sh          # ~8 min vlog
#   SRC=... PERFIL=youtube bash tudo.sh      # whole speech take, no ceiling
#   SRC=... PERFIL=reels bash tudo.sh        # 9:16, lean
#
# Run it in the background when the media is on Google Drive: every file is virtual
# and every read forces a download. See references/pitfalls.md #10.
set -euo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PROJ="${PROJ:-$PWD}"
export SRC="${SRC:-$PROJ}"
mkdir -p "$PROJ"

case "${PERFIL:-youtube}" in
  youtube)  export AR="${AR:-16:9}"; export TETO_MIN="${TETO_MIN:-0}"
            export MAX_LONG="${MAX_LONG:-0}"; export MAX_MED="${MAX_MED:-7}" ;;
  reels)    export AR="${AR:-9:16}"; export TETO_MIN="${TETO_MIN:-1}"
            export MAX_LONG="${MAX_LONG:-8}"; export MAX_MED="${MAX_MED:-4}" ;;
  registro) export AR="${AR:-16:9}"; export TETO_MIN="${TETO_MIN:-0}"
            export MAX_LONG="${MAX_LONG:-0}"; export MAX_MED="${MAX_MED:-0}" ;;
  *) echo "invalid PERFIL: use youtube, reels or registro"; exit 1 ;;
esac
export OUT="${OUT:-vlog}"

echo "### 1/4 ingest   (media: $SRC)"
bash "$AQUI/ingest.sh" > /dev/null
awk -F'\t' 'NR>1{n++; t+=$3} END{printf "     %d media files, %.1f min of raw footage\n", n, t/60}' \
  "$PROJ/_build/manifest.tsv"

echo "### 2/4 roteiro  (profile=${PERFIL:-youtube} AR=$AR TETO_MIN=$TETO_MIN)"
bash "$AQUI/roteiro.sh" | sed 's/^/     /'

echo "### 3/4 build"
bash "$AQUI/build.sh" 2>&1 | grep -v "EXIF buffer\|Last message repeated" | sed 's/^/     /'

echo "### 4/4 decupagem"
THUMBS="${THUMBS:-1}" bash "$AQUI/decupagem.sh" 2>&1 | grep -E "thumbs|->|!" | sed 's/^/     /'
