#!/bin/sh
# Seamless loop: the end dissolves into the start, no jump.
# usage: loop.sh in.mp4 out.mp4 [start_s=1] [dur_s=12] [crossfade_s=2] [crf=18]
# Output is dur-crossfade seconds long; the last frame joins the first.
IN="$1"; OUT="$2"; SS="${3:-1}"; D="${4:-12}"; C="${5:-2}"; CRF="${6:-18}"
FF="${FFMPEG:-ffmpeg}"
"$FF" -y -loglevel error -ss "$SS" -t "$D" -i "$IN" -filter_complex \
 "[0:v]split[a][b];[a]trim=start=$C:end=$D,setpts=PTS-STARTPTS[main];[b]trim=start=0:end=$C,setpts=PTS-STARTPTS[head];[main][head]xfade=transition=fade:duration=$C:offset=$(awk "BEGIN{print $D-2*$C}")[v]" \
 -map "[v]" -an -c:v libx264 -preset slow -crf "$CRF" -pix_fmt yuv420p -movflags +faststart "$OUT" && echo "loop ok: $OUT"
