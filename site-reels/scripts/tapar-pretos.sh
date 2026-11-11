#!/usr/bin/env bash
# Replaces isolated black frames (1 frame, a HyperFrames render glitch at some cuts) with the previous frame.
# Longer blacks (iris, opening) are kept. Usage: bash tapar-pretos.sh <in.mp4> <out.mp4>
set -e
IN="$1"; OUT="$2"; FPS=30
F=$(ffmpeg -hide_banner -i "$IN" -vf "blackdetect=d=0.01:pix_th=0.06" -an -f null - 2>&1 \
  | grep -o "black_start:[0-9.]* black_end:[0-9.]*" \
  | awk -v fps=$FPS '{split($1,a,":");split($2,b,":"); s=a[2]; e=b[2]; n=int(s*fps+0.5); m=int(e*fps+0.5); if (m-n==1 && s>0.5) printf "%d ", n}')
if [ -z "$F" ]; then cp "$IN" "$OUT"; echo "no isolated black frame"; exit 0; fi
# freezeframes takes the video twice: the source and where the replacement frame comes from
FC=""; prev="0:v"; i=0
for n in $F; do FC="${FC}[$prev][1:v]freezeframes=first=$n:last=$n:replace=$((n-1))[v$i];"; prev="v$i"; i=$((i+1)); done
ffmpeg -v error -y -i "$IN" -i "$IN" -filter_complex "${FC%;}" -map "[$prev]" -map 0:a -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p -c:a copy "$OUT"
echo "frames replaced: $F"
