#!/usr/bin/env bash
# Escolhe o MELHOR momento de cada clipe e ranqueia os clipes por qualidade tecnica.
# Serve pra montagem nao entrar no take pelo comeco tremido, e pra escolher b-roll
# por nitidez em vez de por ordem de arquivo.
#
# Gera:
#   _build/frames.tsv   arquivo <TAB> melhor_t <TAB> nitidez <TAB> brilho <TAB> nota
#
# Uso:  SRC=/midia PROJ=/projeto bash frames.sh
#       PONTOS=5 bash frames.sh     # sonda mais pontos por clipe (mais lento)
#
# LIMITE MEDIDO: a nota e QUALIDADE TECNICA, nao valor narrativo. Ela pune duas
# coisas que costumam ser as mais importantes do video:
#   - selfie falando (fundo estourado, pouca borda) -> mas e a espinha narrativa
#   - close de peca grafica plana (placa, cracha) -> mas e o produto do trabalho
# Use a nota pra (a) escolher o ponto de entrada do take e (b) ordenar B-ROLL
# dentro de um capitulo. NUNCA pra decidir o que entra no video.
set -uo pipefail

BASE="${PROJ:-$PWD}"
ROOT="${SRC:-$BASE}"
MAN="$BASE/_build/manifest.tsv"
OUT="$BASE/_build/frames.tsv"
PONTOS="${PONTOS:-3}"
[ -f "$MAN" ] || { echo "Sem manifest. Roda antes: ingest.sh"; exit 1; }

# nitidez = densidade de borda depois do edgedetect. Camera tremida e foco perdido
# derrubam esse numero, que e exatamente o b-roll que nao deve entrar.
nitidez() { ffmpeg -nostdin -v error -ss "$2" -i "$1" -frames:v 1 \
  -vf "scale=480:-2,edgedetect=low=0.1:high=0.3,signalstats,metadata=print:file=-" \
  -f null - 2>/dev/null | awk -F= '/YAVG/{printf "%.2f",$2; exit}'; }
brilho()  { ffmpeg -nostdin -v error -ss "$2" -i "$1" -frames:v 1 \
  -vf "scale=480:-2,signalstats,metadata=print:file=-" \
  -f null - 2>/dev/null | awk -F= '/YAVG/{printf "%.0f",$2; exit}'; }

printf 'file\tt\tnitidez\tbrilho\tnota\n' > "$OUT"
tot="$(awk -F'\t' 'NR>1 && $2=="video"' "$MAN" | wc -l)"
i=0

while IFS=$'\t' read -r -u 9 f dur; do
  i=$((i+1))
  src="$ROOT/$f"
  [ -f "$src" ] || continue
  melhor_t=0; melhor_n=0
  # sonda dentro do miolo: 20%..80%. O comeco costuma ter o movimento de levantar
  # a camera e o fim, o de abaixar.
  for k in $(seq 1 "$PONTOS"); do
    t="$(awk -v d="$dur" -v k="$k" -v n="$PONTOS" 'BEGIN{printf "%.1f", d*(0.2 + 0.6*(k-1)/(n>1?n-1:1))}')"
    n="$(nitidez "$src" "$t")"; n="${n:-0}"
    maior="$(awk -v a="$n" -v b="$melhor_n" 'BEGIN{print (a>b)?"s":"n"}')"
    [ "$maior" = s ] && { melhor_n="$n"; melhor_t="$t"; }
  done
  b="$(brilho "$src" "$melhor_t")"; b="${b:-0}"
  # nota: nitidez penalizada por exposicao ruim. Escuro demais ou estourado nao
  # se conserta na montagem.
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
echo "== melhores 12:"
tail -n +2 "$OUT" | sort -t$'\t' -k5 -rn | head -12 | awk -F'\t' '{printf "  %-18s t=%-6s nota=%-7s (nitidez %s, brilho %s)\n",$1,$2,$5,$3,$4}'
echo "== piores 6 (candidatos a ficar de fora):"
tail -n +2 "$OUT" | sort -t$'\t' -k5 -n | head -6 | awk -F'\t' '{printf "  %-18s nota=%-7s (nitidez %s, brilho %s)\n",$1,$5,$3,$4}'
echo "-> $OUT"
