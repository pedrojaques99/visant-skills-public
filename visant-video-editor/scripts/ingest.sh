#!/usr/bin/env bash
# Varre a pasta feira/, le metadado de cada midia e gera:
#   _build/manifest.tsv  -> tabela completa (ordenada por data de captura)
#   _build/edl.txt       -> roteiro editavel:  arquivo <TAB> in <TAB> out
# Uso: bash _tools/ingest.sh
set -euo pipefail

BASE="${PROJ:-$PWD}"      # raiz do projeto (_build/ e _out/ moram aqui)
ROOT="${SRC:-$BASE}"          # pasta com as midias (SRC= aponta pra fora)
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
  echo "Nenhuma midia em $ROOT ainda. Sobe os videos e roda de novo."
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

# EDL inicial: tudo na ordem cronologica, corte cheio (in=0, out=dur)
{
  echo "# Roteiro do vlog - edite a vontade."
  echo "# formato:  arquivo <TAB> in(s) <TAB> out(s)   |  linha com # = ignorada"
  echo "# reordene as linhas pra mudar a ordem dos cortes."
  awk -F'\t' 'NR>1 { printf "%s\t0\t%s\n", $1, $3 }' "$MAN"
} > "$EDL"

echo "== manifest: $MAN"
column -t -s$'\t' "$MAN" 2>/dev/null || cat "$MAN"
echo
echo "== EDL inicial: $EDL  ($(grep -vc '^#' "$EDL") cortes)"
