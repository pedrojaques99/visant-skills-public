#!/usr/bin/env bash
# Ponta a ponta: le a midia -> propoe o roteiro -> monta -> decupa.
#
# Uso:
#   SRC=/pasta/da/midia PROJ=/pasta/do/projeto bash tudo.sh
#   SRC=... TETO_MIN=8 bash tudo.sh          # vlog de ~8 min
#   SRC=... PERFIL=youtube bash tudo.sh      # take de fala inteiro, sem teto
#   SRC=... PERFIL=reels bash tudo.sh        # 9:16, enxuto
#
# Roda em background quando a midia esta no Google Drive: cada arquivo e virtual
# e cada leitura forca download. Ver references/armadilhas.md #10.
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
  *) echo "PERFIL invalido: use youtube, reels ou registro"; exit 1 ;;
esac
export OUT="${OUT:-vlog}"

echo "### 1/4 ingest   (midia: $SRC)"
bash "$AQUI/ingest.sh" > /dev/null
awk -F'\t' 'NR>1{n++; t+=$3} END{printf "     %d midias, %.1f min de bruto\n", n, t/60}' \
  "$PROJ/_build/manifest.tsv"

echo "### 2/4 roteiro  (perfil=${PERFIL:-youtube} AR=$AR TETO_MIN=$TETO_MIN)"
bash "$AQUI/roteiro.sh" | sed 's/^/     /'

echo "### 3/4 build"
bash "$AQUI/build.sh" 2>&1 | grep -v "EXIF buffer\|Last message repeated" | sed 's/^/     /'

echo "### 4/4 decupagem"
THUMBS="${THUMBS:-1}" bash "$AQUI/decupagem.sh" 2>&1 | grep -E "thumbs|->|!" | sed 's/^/     /'
