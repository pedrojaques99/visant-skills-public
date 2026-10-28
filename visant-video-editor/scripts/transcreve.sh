#!/usr/bin/env bash
# Transcreve os takes de fala e devolve texto COM TIMECODE, que e o que permite
# montar por argumento em vez de por data.
#
# Gera:
#   _build/transcricao/<arquivo>.txt   uma linha por frase: inicio<TAB>fim<TAB>texto
#   _build/transcricao.tsv             tudo junto: arquivo<TAB>inicio<TAB>fim<TAB>texto
#
# Uso:  SRC=/midia PROJ=/projeto bash transcreve.sh
#       MIN_FALA=25 bash transcreve.sh     # so os takes longos
#       MODELO=medium bash transcreve.sh   # mais preciso, bem mais lento
#
# O CLI `whisper` esta quebrado neste ambiente; usamos faster_whisper como modulo.
set -uo pipefail

BASE="${PROJ:-$PWD}"
ROOT="${SRC:-$BASE}"
MAN="$BASE/_build/manifest.tsv"
OUTDIR="$BASE/_build/transcricao"
TSV="$BASE/_build/transcricao.tsv"
MIN_FALA="${MIN_FALA:-6}"      # abaixo disso quase nunca tem frase inteira
MODELO="${MODELO:-small}"
IDIOMA="${IDIOMA:-pt}"

[ -f "$MAN" ] || { echo "Sem manifest. Roda antes: ingest.sh"; exit 1; }
mkdir -p "$OUTDIR"

# candidatos: video, com faixa de audio, acima do minimo. Ordem: mais longo primeiro,
# porque take longo e onde mora a tese - se voce interromper, ja tem o que importa.
mapfile -t ALVOS < <(awk -F'\t' -v m="$MIN_FALA" 'NR>1 && $2=="video" && $8>0 && $3+0>=m {print $3"\t"$1}' "$MAN" \
                     | sort -rn | cut -f2)

echo "== ${#ALVOS[@]} takes de fala (>= ${MIN_FALA}s), modelo=$MODELO"
[ "${#ALVOS[@]}" -gt 0 ] || { echo "nada a transcrever"; exit 0; }

i=0
for f in "${ALVOS[@]}"; do
  i=$((i+1))
  dst="$OUTDIR/${f%.*}.txt"
  src="$ROOT/$f"
  [ -f "$src" ] || { echo "  ! nao achei $f"; continue; }
  if [ -s "$dst" ] && [ "$dst" -nt "$src" ]; then
    echo "  = [$i/${#ALVOS[@]}] $f (cache)"; continue
  fi
  echo "  + [$i/${#ALVOS[@]}] $f"

  wav="$(mktemp -u).wav"
  ffmpeg -nostdin -y -v error -i "$src" -vn -ac 1 -ar 16000 "$wav" 2>/dev/null || { echo "    (sem audio)"; continue; }

  MODELO="$MODELO" IDIOMA="$IDIOMA" WAV="$wav" DST="$dst" python - <<'PY' || echo "    (falhou)"
import os, sys
from faster_whisper import WhisperModel
mdl = os.environ["MODELO"]; wav = os.environ["WAV"]; dst = os.environ["DST"]
m = WhisperModel(mdl, device="cpu", compute_type="int8")
segs, _ = m.transcribe(wav, language=os.environ["IDIOMA"], vad_filter=True,
                       vad_parameters=dict(min_silence_duration_ms=400))
linhas = []
for s in segs:
    t = s.text.strip()
    if t:
        linhas.append(f"{s.start:.1f}\t{s.end:.1f}\t{t}")
with open(dst, "w", encoding="utf-8") as fh:
    fh.write("\n".join(linhas) + ("\n" if linhas else ""))
print(f"    {len(linhas)} frases")
PY
  rm -f "$wav"
done

# consolida
: > "$TSV"
for t in "$OUTDIR"/*.txt; do
  [ -e "$t" ] || continue
  nome="$(basename "${t%.txt}")"
  awk -F'\t' -v n="$nome" 'NF>=3 {printf "%s\t%s\t%s\t%s\n", n, $1, $2, $3}' "$t" >> "$TSV"
done

echo
echo "== $(wc -l < "$TSV") frases de $(ls "$OUTDIR"/*.txt 2>/dev/null | wc -l) takes"
echo "-> $TSV"
