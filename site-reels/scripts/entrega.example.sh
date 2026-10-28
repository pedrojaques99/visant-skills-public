#!/bin/sh
# Monta as entregas a partir das placas 60fps (snap.mjs): reveals, loops sem emenda, 3D limpo.
# Cada arquivo sai < 95MB (limite do Figma: 100MB): o crf sobe de 3 em 3 até caber.
# uso: sh entrega.sh   (env: V = pasta Videos do cliente, SHOW = public/plates do showreel)
V="${V:-D:/clientes/marca/videos}"
P="$V/placas60"
SHOW="${SHOW:-D:/dev/marca-showreel/public/plates}"
LOOP="$HOME/.claude/skills/site-reels/scripts/loop.sh"
MAX=95000000

# enc <in> <out> [ss] [dur]: reencoda subindo o crf até caber
enc() {
  crf=20
  while :; do
    ffmpeg -y -loglevel error ${3:+-ss "$3"} ${4:+-t "$4"} -i "$1" -an -c:v libx264 -preset slow -crf $crf -pix_fmt yuv420p -movflags +faststart "$2"
    [ "$(stat -c %s "$2")" -lt $MAX ] && break
    crf=$((crf + 3))
  done
  echo "ok $(basename "$2") crf=$crf $(($(stat -c %s "$2") / 1000000))MB"
}
# loop <in> <out> <ss> <dur> <crossfade>
loop() {
  crf=18
  while :; do
    sh "$LOOP" "$1" "$2" "$3" "$4" "$5" $crf >/dev/null
    [ "$(stat -c %s "$2")" -lt $MAX ] && break
    crf=$((crf + 3))
  done
  echo "ok $(basename "$2") crf=$crf $(($(stat -c %s "$2") / 1000000))MB"
}

mkdir -p "$V/logo-reveal" "$V/loops" "$V/3d-limpo"
enc "$P/reveal-noir-dark.mp4" "$V/logo-reveal/logo-reveal-noir-dark.mp4"
enc "$P/reveal-seda-dark.mp4" "$V/logo-reveal/logo-reveal-seda-dark.mp4"
enc "$P/reveal-seda-light.mp4" "$V/logo-reveal/logo-reveal-papel-light.mp4"

loop "$P/loop-logo-seda-light.mp4" "$V/loops/logo-loop-seda-light.mp4" 1 12 2
loop "$P/loop-logo-noir-dark.mp4" "$V/loops/logo-loop-noir-dark.mp4" 1 12 2
loop "$P/3d-arvore-light.mp4" "$V/loops/3d-arvore-loop-light.mp4" 1 15 3
loop "$P/3d-arvore-dark.mp4" "$V/loops/3d-arvore-loop-dark.mp4" 1 15 3
loop "$P/wordmark-tinta-light.mp4" "$V/loops/wordmark-tinta-loop-light.mp4" 6.2 5.8 1
loop "$P/wordmark-tinta-dark.mp4" "$V/loops/wordmark-tinta-loop-dark.mp4" 6.2 5.8 1

enc "$P/3d-caminhada-light.mp4" "$V/3d-limpo/3d-caminhada-light.mp4" 0 23 # o fim da rota é campo vazio
enc "$P/3d-caminhada-dark.mp4" "$V/3d-limpo/3d-caminhada-dark.mp4" 0 23

# placas pro showreel (Remotion lê de public/plates)
for f in reveal-noir-dark 3d-arvore-light 3d-caminhada-light wordmark-tinta-light; do cp "$P/$f.mp4" "$SHOW/$f.mp4"; done
echo "placas copiadas pro showreel"
