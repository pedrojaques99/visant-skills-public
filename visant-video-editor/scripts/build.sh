#!/usr/bin/env bash
# Monta o vlog a partir de _build/edl.txt
# Uso:
#   bash _tools/build.sh                      # 16:9 horizontal (default)
#   AR=9:16 bash _tools/build.sh              # vertical (reels)
#   FILL=blur bash _tools/build.sh            # barra borrada em vez de cortar
#   MUSIC="../musica.mp3" bash _tools/build.sh
#   OUT=v2 bash _tools/build.sh
set -euo pipefail

BASE="${PROJ:-$PWD}"      # raiz do projeto (_build/ e _out/ moram aqui)
ROOT="${SRC:-$BASE}"          # pasta com as midias (SRC= aponta pra fora)
BUILD="$BASE/_build"; CLIPS="$BUILD/clips"; OUTDIR="$BASE/_out"
mkdir -p "$CLIPS" "$OUTDIR"
EDL="$BUILD/edl.txt"
[ -f "$EDL" ] || { echo "Sem $EDL. Roda antes: bash _tools/ingest.sh"; exit 1; }

AR="${AR:-16:9}"
FILL="${FILL:-auto}"          # auto | blur | crop | black
                              # auto: horizontal -> crop (enche a tela)
                              #       vertical   -> blur  (preserva enquadramento)
FPS="${FPS:-30}"
OUT="${OUT:-vlog}"
MUSIC="${MUSIC:-}"
MUSIC_DB="${MUSIC_DB:--18}"   # volume da trilha
XFADE="${XFADE:-0}"           # 0 = corte seco (rapido/estavel)

case "$AR" in
  9:16) W=1080; H=1920 ;;
  16:9) W=1920; H=1080 ;;
  1:1)  W=1080; H=1080 ;;
  *) echo "AR invalido: use 9:16, 16:9 ou 1:1"; exit 1 ;;
esac

vf_for() {   # $1 = modo de preenchimento
  case "$1" in
    blur)  printf '%s' "split[bg][fg];[bg]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},gblur=sigma=28[bgb];[fg]scale=${W}:${H}:force_original_aspect_ratio=decrease[fgs];[bgb][fgs]overlay=(W-w)/2:(H-h)/2,setsar=1,fps=${FPS},format=yuv420p" ;;
    crop)  printf '%s' "scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=${FPS},format=yuv420p" ;;
    black) printf '%s' "scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${FPS},format=yuv420p" ;;
  esac
}

# decide o preenchimento olhando a orientacao REAL do clipe (ja com a rotacao aplicada)
fill_for() {   # $1 = arquivo
  [ "$FILL" != auto ] && { printf '%s' "$FILL"; return; }
  local p sw sh rot t
  # uma sondagem so; nk=0 pra vir "chave=valor" e o awk pegar cada campo limpo
  p="$(ffprobe -v error -select_streams v:0 \
        -show_entries stream=width,height:stream_side_data=rotation \
        -of default=nw=1 "$1" 2>/dev/null)"
  sw="$(printf '%s\n' "$p" | awk -F= '/^width=/   {gsub(/[^0-9]/,"",$2); print $2; exit}')"
  sh="$(printf '%s\n' "$p" | awk -F= '/^height=/  {gsub(/[^0-9]/,"",$2); print $2; exit}')"
  rot="$(printf '%s\n' "$p" | awk -F= '/^rotation=/{gsub(/[^0-9-]/,"",$2); print $2; exit}')"
  rot="${rot:-0}"
  case "${rot#-}" in 90|270) t="$sw"; sw="$sh"; sh="$t" ;; esac
  [ -n "$sw" ] && [ -n "$sh" ] && [ "$sh" -gt 0 ] 2>/dev/null || { printf 'crop'; return; }
  # cabe cortando sem perder demais? senao, blur
  if [ $(( sw * H )) -ge $(( sh * W )) ]; then printf 'crop'; else printf 'blur'; fi
}

# --- basico de vlog: audio ---
# Take inaudivel e o defeito n1 de vlog: clipe de celular de dias diferentes
# varia muito de volume. Alvo I=-16 LUFS (streaming/YouTube).
#
#   LOUD=2  dois passos (DEFAULT): mede o corte, depois aplica ganho LINEAR.
#           Preserva a dinamica. Custa uma passada de analise de audio por corte.
#   LOUD=1  um passo: normaliza dinamicamente = COMPRIME. Rapido, mas achata.
#           Medido em campo: LRA caiu pra 1.6 LU, dinamica morta. Use so com pressa.
#   LOUD=0  nao mexe no audio.
#
# afade de 15ms nas pontas: corte seco em audio digital estala. Isso mata o click.
LOUD="${LOUD:-2}"
ALVO_I="${ALVO_I:--16}"
SR="${SR:-48000}"

# `aresample` DEPOIS do loudnorm nao e redundancia: o loudnorm reamostra
# internamente pra 192 kHz, o encoder AAC trava em 96 kHz, e o corte sai a 96 kHz.
# Corte que cai no fallback (sem loudnorm) sai a 48 kHz. Misturar taxa no concat
# corrompe o audio: 843 erros "Invalid data found" num master de 14 min.
# Taxa uniforme e pre-requisito do concat demuxer, nao detalhe.
DESCLICK="afade=t=in:st=0:d=0.015,areverse,afade=t=in:st=0:d=0.015,areverse,aresample=${SR}"

case "$LOUD" in
  1) AUD_CHAIN="loudnorm=I=${ALVO_I}:TP=-1.5:LRA=11,${DESCLICK}" ;;
  0) AUD_CHAIN="aresample=${SR}" ;;
  *) AUD_CHAIN="" ;;   # 2 = medido por corte, montado dentro do loop
esac

# passo 1 do dois-passos: mede o corte e devolve a cadeia loudnorm ja calibrada
cadeia_audio_medida() {   # $1=arquivo  $2=in  $3=out
  local m i tp lra thr
  local rec=(-ss "$2"); [ -n "${3:-}" ] && rec+=(-to "$3")
  # -v info e OBRIGATORIO: o print_format=json sai em nivel info, e com -v error
  # o ffmpeg engole a medicao. Com -v error isso cai sempre no fallback de um
  # passo e o LOUD=2 vira no-op silencioso (ja aconteceu).
  m="$(ffmpeg -nostdin -v info -hide_banner "${rec[@]}" -i "$1" \
        -af "loudnorm=I=${ALVO_I}:TP=-1.5:LRA=11:print_format=json" \
        -f null - 2>&1 | tr -d ' ",' || true)"
  i="$(  printf '%s\n' "$m" | awk -F: '/input_i/        {print $2; exit}')"
  tp="$( printf '%s\n' "$m" | awk -F: '/input_tp/       {print $2; exit}')"
  lra="$(printf '%s\n' "$m" | awk -F: '/input_lra/      {print $2; exit}')"
  thr="$(printf '%s\n' "$m" | awk -F: '/input_thresh/   {print $2; exit}')"
  # medicao falhou (corte mudo, sem faixa de audio): cai pro um-passo, nunca quebra o build
  case "${i:-}" in ''|*inf*|*nan*) printf '%s' "loudnorm=I=${ALVO_I}:TP=-1.5:LRA=11,${DESCLICK}"; return ;; esac
  printf '%s' "loudnorm=I=${ALVO_I}:TP=-1.5:LRA=11:linear=true:measured_I=${i}:measured_TP=${tp}:measured_LRA=${lra}:measured_thresh=${thr},${DESCLICK}"
}

echo "== normalizando cortes -> ${W}x${H} @${FPS} (fill=$FILL, loudnorm=$LOUD)"
# Lista do concat POR PROCESSO. Com nome fixo, dois builds do mesmo projeto
# escrevem na mesma lista e o master sai com cortes dos dois - foi exatamente
# isso (47 entradas pra um EDL de 45) depois de um build interrompido cujo
# ffmpeg filho sobreviveu. Mesma armadilha #1: nome fixo + concorrencia.
i=0; list="$CLIPS/concat.$$.txt"; : > "$list"
trap 'rm -f "$list"' EXIT

# le o roteiro pelo descritor 9, nao pelo stdin: ffmpeg dentro do loop comia
# o stdin e pulava cortes em silencio. O -nostdin em cada ffmpeg e o cinto; isso e o suspensorio.
while IFS=$'\t' read -r -u 9 f tin tout afile ain || [ -n "${f:-}" ]; do
  case "${f:-}" in ''|\#*) continue ;; esac
  # CRLF: o EDL e um arquivo que a PESSOA edita, e editor de Windows grava \r.
  # O \r vai colado no ultimo campo e o ffmpeg recusa o argumento - aqui isso
  # aparecia como "narracao falhou" em todo corte, sem dizer por que.
  f="${f%$'\r'}"; tin="${tin%$'\r'}"; tout="${tout%$'\r'}"
  afile="${afile%$'\r'}"; ain="${ain%$'\r'}"
  afile="${afile:-}"; ain="${ain:-0}"
  # procura na midia bruta e, se nao achar, no proprio projeto: e assim que
  # cartela de capitulo (gerada em _build/) entra no roteiro sem sujar a pasta
  # de origem, que o portao exige intocada.
  src="$ROOT/$f"
  [ -f "$src" ] || src="$BASE/$f"
  [ -f "$src" ] || { echo "  ! nao achei $f - pulando"; continue; }
  tin="${tin:-0}"; tout="${tout:-}"
  i=$((i+1)); n="$(printf '%03d' "$i")"
  ext="$(echo "${f##*.}" | tr 'A-Z' 'a-z')"
  fl="$(fill_for "$src")"; VF="$(vf_for "$fl")"

  # Cache com chave de CONTEUDO, nunca de posicao. Nomear por posicao (001.mp4)
  # fazia o corte 001 de um roteiro velho ser reaproveitado pra outro clipe
  # quando o roteiro mudava - silenciosamente, com o video errado no lugar.
  # O sufixo "a2" versiona a CADEIA DE AUDIO. Sem ele, consertar o audio deixaria
  # os cortes velhos (96 kHz) no cache e o conserto nao chegaria no master.
  # NARRACAO (coluna 4 e 5 do EDL): video de um arquivo, audio de outro.
  # E o que separa "montagem competente" de ensaio: a voz conduz e a imagem prova,
  # em vez de mostrar a pessoa falando por 20 s.
  asrc=""
  if [ -n "$afile" ]; then
    asrc="$ROOT/$afile"; [ -f "$asrc" ] || asrc="$BASE/$afile"
    [ -f "$asrc" ] || { echo "  ! narracao nao achada: $afile - usando audio do proprio clipe"; asrc=""; }
  fi

  key="$(printf '%s|%s|%s|%s|%s|%s|%s|%s|%s|%s' \
          "$f" "$tin" "$tout" "$fl" "$W" "$H" "$FPS" "$LOUD-$SR-a2" "${afile:-}" "$ain" | md5sum | cut -c1-12)"
  dst="$CLIPS/${key}.mp4"

  if [ -f "$dst" ] && [ "$dst" -nt "$src" ]; then
    echo "  = ${n} $f (cache)"; echo "file '$(basename "$dst")'" >> "$list"; continue
  fi
  # AVISO DE ESTOURO: pedir alem do fim do clipe nao da erro no ffmpeg - ele
  # entrega um corte mais curto. Com narracao isso dessincroniza a voz do resto
  # do video, em silencio. Melhor gritar aqui do que descobrir vendo.
  if [ -n "${tout:-}" ]; then
    dsrc="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$src" 2>/dev/null)"
    est="$(awk -v o="$tout" -v d="${dsrc:-0}" 'BEGIN{print (d>0 && o>d+0.05) ? "s" : "n"}')"
    [ "$est" = s ] && echo "  ! ${n} $f pede ate ${tout}s mas o clipe tem ${dsrc}s - o corte vai sair curto"
  fi
  echo "  + ${n} $f  [${tin} -> ${tout:-fim}]  fill=$fl"

  # dois-passos: mede o corte agora (o cache acima ja evitou remedir).
  # Com narracao, mede a NARRACAO - e ela que vai ser ouvida.
  if [ "$LOUD" = 2 ]; then
    if [ -n "$asrc" ]; then
      dur_v="$(awk -v a="$tin" -v b="${tout:-0}" 'BEGIN{printf "%.2f", b-a}')"
      AUD_CHAIN="$(cadeia_audio_medida "$asrc" "$ain" "$(awk -v a="$ain" -v d="$dur_v" 'BEGIN{printf "%.2f", a+d}')")"
    else
      AUD_CHAIN="$(cadeia_audio_medida "$src" "$tin" "$tout")"
    fi
  fi

  # caminho da narracao: video de um lado, voz do outro, duracao mandada pelo video
  if [ -n "$asrc" ]; then
    dur_v="$(awk -v a="$tin" -v b="${tout:-0}" 'BEGIN{printf "%.2f", b-a}')"
    ffmpeg -nostdin -y -v error -ss "$tin" -to "${tout}" -i "$src" \
      -ss "$ain" -t "$dur_v" -i "$asrc" \
      -f lavfi -t "$dur_v" -i anullsrc=r=${SR}:cl=stereo \
      -filter_complex "[0:v]${VF}[v];[1:a]aresample=${SR},${AUD_CHAIN}[a0];[2:a]anull[a1];[a0][a1]amix=inputs=2:duration=first:dropout_transition=0:weights='1 0'[a]" \
      -map '[v]' -map '[a]' -c:v libx264 -preset veryfast -crf 20 -c:a aac -ar "$SR" -b:a 160k "$dst" 2>/dev/null \
    || { echo "    ! narracao falhou, caindo pro audio do clipe"; asrc=""; }
    if [ -n "$asrc" ]; then echo "file '$(basename "$dst")'" >> "$list"; continue; fi
  fi

  case "$ext" in
    jpg|jpeg|png|heic)
      d="${tout:-3}"
      ffmpeg -nostdin -y -v error -loop 1 -t "$d" -i "$src" \
        -f lavfi -t "$d" -i anullsrc=r=48000:cl=stereo \
        -filter_complex "[0:v]scale=${W}*1.15:${H}*1.15:force_original_aspect_ratio=increase,crop=${W}*1.15:${H}*1.15,zoompan=z='min(zoom+0.0008,1.12)':d=${d}*${FPS}:s=${W}x${H}:fps=${FPS},setsar=1,format=yuv420p[v]" \
        -map "[v]" -map 1:a -c:v libx264 -preset veryfast -crf 20 -c:a aac -ar "$SR" -b:a 128k -shortest "$dst"
      ;;
    *)
      durargs=(-ss "$tin"); [ -n "$tout" ] && durargs+=(-to "$tout")
      ffmpeg -nostdin -y -v error "${durargs[@]}" -i "$src" \
        -f lavfi -i anullsrc=r=48000:cl=stereo \
        -filter_complex "[0:v]${VF}[v];[0:a]aresample=48000,asetpts=N/SR/TB,${AUD_CHAIN}[a0];[1:a]anull[a1];[a0][a1]amix=inputs=2:duration=first:dropout_transition=0:weights='1 0'[a]" \
        -map '[v]' -map '[a]' -c:v libx264 -preset veryfast -crf 20 -c:a aac -ar "$SR" -b:a 160k "$dst" 2>/dev/null \
      || ffmpeg -nostdin -y -v error "${durargs[@]}" -i "$src" \
        -f lavfi -i anullsrc=r=48000:cl=stereo \
        -filter_complex "[0:v]${VF}[v]" \
        -map "[v]" -map 1:a -c:v libx264 -preset veryfast -crf 20 -c:a aac -ar "$SR" -b:a 128k -shortest "$dst"
      ;;
  esac
  echo "file '$(basename "$dst")'" >> "$list"
done 9< "$EDL"

[ "$i" -gt 0 ] || { echo "Nenhum corte valido no EDL."; exit 1; }

# Copia estavel da lista. A lista de trabalho e por processo (concorrencia) e
# morre no EXIT - mas sem uma copia de nome fixo nao da pra conferir o que foi
# montado depois do build, e o portao ficou cego a 3 casos por causa disso.
cp -f "$list" "$CLIPS/concat.ultimo.txt" 2>/dev/null || true

echo "== juntando $i cortes"
final="$OUTDIR/${OUT}.mp4"

# duracao total, pra ancorar o fade de saida
TOT="$(awk -F"'" '/^file /{print $2}' "$list" | while read -r c; do
  ffprobe -v error -show_entries format=duration -of csv=p=0 "$CLIPS/$c"; done \
  | awk '{t+=$1} END{printf "%.2f", t}')"

FADE_IN="${FADE_IN:-0.8}"
FADE_OUT="${FADE_OUT:-1.5}"
fo_at="$(awk -v t="$TOT" -v d="$FADE_OUT" 'BEGIN{printf "%.2f", (t-d<0?0:t-d)}')"

# abre do preto e fecha no preto - pontuacao basica de vlog.
# alimit no master: depois do loudnorm por corte, segura pico de transiente.
VMASTER="fade=t=in:st=0:d=${FADE_IN},fade=t=out:st=${fo_at}:d=${FADE_OUT}"
AMASTER="afade=t=in:st=0:d=${FADE_IN},afade=t=out:st=${fo_at}:d=${FADE_OUT},alimiter=limit=0.95"

echo "   total ${TOT}s | fade in ${FADE_IN}s, fade out em ${fo_at}s"

if [ -n "$MUSIC" ] && [ -f "$ROOT/$MUSIC" ]; then
  ffmpeg -nostdin -y -v error -f concat -safe 0 -i "$list" -i "$ROOT/$MUSIC" \
    -filter_complex "[0:v]${VMASTER}[v];[1:a]volume=${MUSIC_DB}dB[m];[0:a][m]amix=inputs=2:duration=first:dropout_transition=0,${AMASTER}[a]" \
    -map '[v]' -map '[a]' -c:v libx264 -preset medium -crf 20 -c:a aac -b:a 192k -movflags +faststart "$final"
else
  ffmpeg -nostdin -y -v error -f concat -safe 0 -i "$list" \
    -filter_complex "[0:v]${VMASTER}[v];[0:a]${AMASTER}[a]" \
    -map '[v]' -map '[a]' -c:v libx264 -preset medium -crf 20 -c:a aac -b:a 192k -movflags +faststart "$final"
fi

echo
echo "== pronto: $final"
ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$final"
