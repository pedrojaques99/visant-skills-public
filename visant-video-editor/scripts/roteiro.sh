#!/usr/bin/env bash
# Gera uma PROPOSTA de roteiro (_build/edl.txt) a partir do manifest.
#
# Ideia: clipe longo = espinha dorsal (aparado no comeco, onde a fala comeca).
#        clipe curto = costura/b-roll (entra inteiro, mas e o primeiro a sair).
#        Se estourar o teto: primeiro aperta o cap dos medios/longos, depois
#        afina o b-roll por amostragem uniforme. Narrativa nunca desaparece.
#
# Uso:
#   bash _tools/roteiro.sh                # ~5 min (default)
#   TETO_MIN=3 bash _tools/roteiro.sh     # vlog curto
#   TETO_MIN=0 bash _tools/roteiro.sh     # sem teto, usa tudo que passa no filtro
#   FOTOS_POR_DIA=0 bash _tools/roteiro.sh
#   COMP_LONG=0.20 bash _tools/roteiro.sh  # take de fala mais longo (usa teto sobrando)
set -euo pipefail

BASE="${PROJ:-$PWD}"      # raiz do projeto (_build/ e _out/ moram aqui)
MAN="$BASE/_build/manifest.tsv"
EDL="$BASE/_build/edl.txt"
TMP="$BASE/_build/.cand.$$.tmp"
[ -f "$MAN" ] || { echo "Sem manifest. Roda antes: bash _tools/ingest.sh"; exit 1; }

MAX_LONG="${MAX_LONG:-14}"      # teto pra clipe longo (>25s)
MAX_MED="${MAX_MED:-7}"         # teto pra clipe medio (6-25s)
MIN_CLIP="${MIN_CLIP:-1.5}"     # abaixo disso e piscada, fora
COMP_LONG="${COMP_LONG:-0.06}"  # inclinacao da compressao do take longo (fala)
COMP_MED="${COMP_MED:-0.40}"    # idem, take medio
DUR_FOTO="${DUR_FOTO:-2.5}"
FOTOS_POR_DIA="${FOTOS_POR_DIA:-3}"
TETO_MIN="${TETO_MIN:-5}"       # duracao alvo em minutos (0 = sem teto)

[ -f "$EDL" ] && cp "$EDL" "$EDL.bak"

# Temporario morre no EXIT, nao no fim do caminho felizk: saida por erro deixava
# lixo em _build/, e com nome fixo isso colidia com o outro script rodando junto.
ROT_TMPS="$BASE/_build/.cand.$$.tmp $BASE/_build/.rot.$$.tmp"
trap 'rm -f $ROT_TMPS' EXIT

gera_cand() {   # $1=MAX_LONG  $2=MAX_MED  -> TMP com peso narrativo na col 1
  awk -F'\t' -v ml="$1" -v mm="$2" -v mc="$MIN_CLIP" \
             -v cl="$COMP_LONG" -v cm="$COMP_MED" \
             -v df="$DUR_FOTO" -v fpd="$FOTOS_POR_DIA" '
    NR == 1 { next }
    {
      file = $1; kind = $2; dur = $3 + 0
      split($9, a, "T"); dia = a[1]
      if (kind == "foto") {
        if (fpd <= 0) next
        if (++fotos[dia] > fpd) next
        printf "foto\t%s\t0\t%.1f\n", file, df
        next
      }
      if (dur < mc) next
      # LIM_LONG/LIM_MED = fronteira de CLASSIFICACAO (fixa).
      # ml/mm = teto de DURACAO do corte. Sao coisas diferentes: se a fronteira
      # andasse junto com o teto, apertar o teto jogaria b-roll pra narrativa.
      # teto PROPORCIONAL, nao plano: take maior continua sendo corte maior.
      # Cap plano dava 41 cortes de 5.0s identicos - ritmo de esteira, nao de vlog.
      # cl/cm = INCLINACAO da compressao. E ela, nao o cap, que costuma limitar:
      # com cl=0.06 um take de 125s vira 14s e subir o cap nao muda nada. Quem
      # tem teto sobrando gasta a folga aqui, na narrativa - nao no cap.
      if (dur > 25) {
        if (ml <= 0) o = dur                 # ml=0 -> take longo entra inteiro
        else { o = 8 + (dur - 25) * cl; if (o > ml) o = ml }
        printf "longo\t%s\t0\t%.1f\n", file, o
      } else if (dur > 6) {
        if (mm <= 0) o = dur                 # mm=0 -> medio entra inteiro
        else { o = 2.5 + (dur - 6) * cm; if (o > mm) o = mm }
        printf "medio\t%s\t0\t%.1f\n", file, o
      } else {
        printf "curto\t%s\t0\t%.1f\n", file, dur
      }
    }' "$MAN" > "$TMP"
}

piso() { awk -F'\t' '$1=="longo" || $1=="medio" { t += $4 } END { printf "%d", t+0 }' "$TMP"; }

if [ "$TETO_MIN" != 0 ]; then
  alvo=$(( TETO_MIN * 60 * 80 / 100 ))     # narrativa ocupa no maximo 80% do teto
  # Aperta a INCLINACAO junto com os caps. Mexer so no cap nao adiantava quando a
  # inclinacao era o limitador: TETO_MIN=15 chegou a entregar 16.0 min - teto pedido
  # e nao cumprido, que e pior que teto errado.
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
if [ "$TETO_MIN" != 0 ]; then
  KEEP_MOD="$(awk -F'\t' -v teto="$(( TETO_MIN * 60 ))" '
    { if ($1=="longo" || $1=="medio") fixo += $4; else { flex += $4; n++ } }
    END {
      sobra = teto - fixo
      if (sobra <= 0 || n == 0) { print (n ? n : 1); exit }
      frac = sobra / flex
      if (frac >= 1) { print 1; exit }
      # TETO E TETO: arredondar pra CIMA. Com int(1/frac+0.5), frac=0.8 dava k=1
      # e nenhum b-roll saia - o teto de 15 min entregava 16.0.
      r = 1/frac; k = int(r); if (r > k) k = k + 1
      print (k < 2 ? 2 : k)
    }' "$TMP")"
fi

awk -F'\t' -v k="$KEEP_MOD" '
  {
    if ($1 == "longo" || $1 == "medio") keep = 1
    else keep = (k <= 1) ? 1 : (++c % k == 1)
    if (keep) {
      printf "%s\t%s\t%s\n", $2, $3, $4
      tot += $4; n++
      if      ($1 == "longo") nl++
      else if ($1 == "medio") nm++
      else if ($1 == "foto")  nf++
      else                    nc++
    }
  }
  END {
    printf "#RESUMO %d cortes = %d longo + %d medio + %d b-roll + %d foto  |  %.1f min  |  1 de cada %d b-roll\n",
           n, nl, nm, nc, nf, tot/60, k
  }' "$TMP" > "$BASE/_build/.rot.$$.tmp"

{
  echo "# Roteiro PROPOSTO - roteiro.sh (TETO_MIN=$TETO_MIN MAX_LONG=$MAX_LONG MAX_MED=$MAX_MED MIN_CLIP=$MIN_CLIP)"
  echo "# ordem = cronologica por captura. Comente com # o que nao quer; reordene pra mudar o corte."
  grep '^#RESUMO' "$BASE/_build/.rot.$$.tmp"
  grep -v '^#RESUMO' "$BASE/_build/.rot.$$.tmp"
} > "$EDL"
rm -f "$TMP" "$BASE/_build/.rot.$$.tmp"

grep '^#RESUMO' "$EDL" | sed 's/^#RESUMO //'
echo "-> $EDL"
