#!/bin/sh
# Loop perfeito: o fim dissolve no começo, sem salto.
# uso: loop.sh in.mp4 out.mp4 [inicio_s=1] [dur_s=12] [crossfade_s=2] [crf=18]
# Saída tem dur-crossfade segundos; o último quadro emenda no primeiro.
IN="$1"; OUT="$2"; SS="${3:-1}"; D="${4:-12}"; C="${5:-2}"; CRF="${6:-18}"
FF="${FFMPEG:-ffmpeg}"
"$FF" -y -loglevel error -ss "$SS" -t "$D" -i "$IN" -filter_complex \
 "[0:v]split[a][b];[a]trim=start=$C:end=$D,setpts=PTS-STARTPTS[main];[b]trim=start=0:end=$C,setpts=PTS-STARTPTS[head];[main][head]xfade=transition=fade:duration=$C:offset=$(awk "BEGIN{print $D-2*$C}")[v]" \
 -map "[v]" -an -c:v libx264 -preset slow -crf "$CRF" -pix_fmt yuv420p -movflags +faststart "$OUT" && echo "loop ok: $OUT"
