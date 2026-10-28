#!/usr/bin/env bash
# Decupagem: transforma o roteiro numa folha de corte legivel + capitulos de YouTube
# + folha de contato (grade de thumbs) pra revisao visual.
#
# Gera:
#   DECUPAGEM.md          tabela: posicao no timeline, arquivo, dia, duracao, tipo, fill
#   CAPITULOS.txt         capitulos prontos pra colar na descricao do YouTube
#   _build/contato/*.jpg  folha de contato, 1 thumb por corte
#
# Uso: bash _tools/decupagem.sh          (sem thumbs, rapido)
#      THUMBS=1 bash _tools/decupagem.sh (com folha de contato)
set -euo pipefail

BASE="${PROJ:-$PWD}"      # raiz do projeto (_build/ e _out/ moram aqui)
SRC="${SRC:-$BASE}"           # pasta com as midias
MAN="$BASE/_build/manifest.tsv"
EDL="$BASE/_build/edl.txt"
THUMBS="${THUMBS:-0}"
[ -f "$MAN" ] && [ -f "$EDL" ] || { echo "Falta manifest/edl. Roda ingest.sh e roteiro.sh."; exit 1; }

# Temporario morre no EXIT (ver roteiro.sh).
DEC_TMPS="$BASE/_build/.dec.meta.$$.tmp $BASE/_build/.dec.edl.$$.tmp $BASE/_build/.dec.join.$$.tmp"
trap 'rm -f $DEC_TMPS' EXIT

DEC="$BASE/DECUPAGEM.md"
CAP="$BASE/CAPITULOS.txt"

# arquivo -> dia, dur original, orientacao real
awk -F'\t' 'NR>1{
  rot=$6; w=$4; h=$5
  if (rot=="90"||rot=="-90"||rot=="270"||rot=="-270") { t=w; w=h; h=t }
  ori = (w>=h) ? "horiz" : "vert"
  split($9,a,"T")
  printf "%s\t%s\t%s\t%s\n", $1, a[1], $3, ori
}' "$MAN" | sort > "$BASE/_build/.dec.meta.$$.tmp"

grep -v '^#' "$EDL" | awk -F'\t' '{printf "%d\t%s\t%s\t%s\n", NR, $1, $2, $3}' \
  | sort -t$'\t' -k2,2 > "$BASE/_build/.dec.edl.$$.tmp"

join -t$'\t' -1 2 -2 1 "$BASE/_build/.dec.edl.$$.tmp" "$BASE/_build/.dec.meta.$$.tmp" \
  | sort -t$'\t' -k2,2n > "$BASE/_build/.dec.join.$$.tmp"
# colunas: arquivo, ordem, in, out, dia, dur_orig, ori

# ---------- DECUPAGEM.md ----------
{
  echo "# Decupagem — vlog da feira"
  echo
  echo "Gerado por \`_tools/decupagem.sh\`. Uma linha por corte, na ordem do vídeo."
  echo "Para tirar um corte: comente a linha dele em \`_build/edl.txt\` com \`#\` e rode \`build.sh\`."
  echo
  awk -F'\t' '
  BEGIN {
    print "| # | entra em | corte | arquivo | dia | bruto | usado | tipo | enquadr. |"
    print "|---|---|---|---|---|---|---|---|---|"
  }
  {
    file=$1; ord=$2; tin=$3; tout=$4; dia=$5; durorig=$6+0; ori=$7
    usado = tout - tin
    tipo = (durorig > 25) ? "**fala**" : (durorig > 6 ? "médio" : "b-roll")
    if (file ~ /\.(jpg|jpeg|png|PNG|JPG|heic)$/) tipo = "foto"
    enq = (ori == "vert") ? "vertical → blur" : "horizontal"
    h = int(acc/3600); m = int((acc%3600)/60); s = int(acc%60)
    printf "| %d | %02d:%02d:%02d | %.1fs | `%s` | %s | %.0fs | %.0f%% | %s | %s |\n",
           ord, h, m, s, usado, file, substr(dia,9,2)"/"substr(dia,6,2), durorig,
           (durorig>0 ? usado*100/durorig : 100), tipo, enq
    acc += usado
  }
  END {
    printf "\n**Total: %d cortes, %d min %02d s**\n", NR, int(acc/60), acc%60
  }' "$BASE/_build/.dec.join.$$.tmp"
} > "$DEC"

# ---------- CAPITULOS.txt (bloco por dia) ----------
{
  echo "# Capitulos pro YouTube - colar na descricao"
  echo "# (YouTube exige que o primeiro seja 00:00)"
  echo
  awk -F'\t' '
  {
    usado = $4 - $3; dia = $5
    if (dia != atual) {
      h = int(acc/3600); m = int((acc%3600)/60); s = int(acc%60)
      if (NR == 1) { h=0; m=0; s=0 }
      printf "%02d:%02d:%02d  Dia %s/%s\n", h, m, s, substr(dia,9,2), substr(dia,6,2)
      atual = dia
    }
    acc += usado
  }' "$BASE/_build/.dec.join.$$.tmp"
} > "$CAP"

# ---------- folha de contato ----------
if [ "$THUMBS" = 1 ]; then
  TH="$BASE/_build/contato"; mkdir -p "$TH"; rm -f "$TH"/*.jpg
  echo "== extraindo thumbs (1 por corte)"
  # numeracao do ARQUIVO e sequencial e sem buraco (o tile le %03d e para no primeiro
  # que falta); o numero do CORTE vai desenhado na imagem.
  seq=0
  awk -F'\t' '{printf "%s\t%s\t%s\n", $2, $1, $3}' "$BASE/_build/.dec.join.$$.tmp" \
  | while IFS=$'\t' read -r ord file tin; do
      rotulo="$(printf '%03d' "$ord")"
      case "$(echo "${file##*.}" | tr 'A-Z' 'a-z')" in
        jpg|jpeg|png|heic) pos=() ;;                        # foto: -ss num estatico falha
        *) pos=(-ss "$(awk -v t="$tin" 'BEGIN{printf "%.1f", t+0.3}')") ;;
      esac
      seq=$(( seq + 1 ))
      if ffmpeg -nostdin -y -v error "${pos[@]}" -i "$SRC/$file" -frames:v 1 \
        -vf "scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2:color=0x111111,drawtext=text='$rotulo':x=6:y=6:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.6" \
        "$TH/$(printf '%03d' "$seq").jpg" 2>/dev/null
      then :; else seq=$(( seq - 1 )); echo "   ! sem thumb: $file"; fi
    done
  n="$(ls "$TH"/*.jpg 2>/dev/null | wc -l)"
  if [ "$n" -gt 0 ]; then
    # esse build do ffmpeg no Windows nao tem glob: entrada por sequencia numerica
    ffmpeg -nostdin -y -v error -framerate 1 -start_number 1 -i "$TH/%03d.jpg" \
      -vf "tile=6x8:padding=4:color=0x111111" -frames:v 10 "$TH/folha-%02d.jpg" \
      || echo "   ! falhou montar a folha"
    echo "   $n thumbs, $(ls "$TH"/folha-*.jpg 2>/dev/null | wc -l) folha(s) -> $TH"
  fi
fi

rm -f "$BASE/_build/.dec.meta.$$.tmp" "$BASE/_build/.dec.edl.$$.tmp" "$BASE/_build/.dec.join.$$.tmp"
echo "-> $DEC"
echo "-> $CAP"
sed -n '1,12p' "$CAP"
