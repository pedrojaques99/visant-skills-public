#!/bin/sh
# EXAMPLE delivery script: builds the deliverables from the 60fps plates (snap.mjs):
# reveals, seamless loops, clean 3D. Copy it into your project and rename the plates.
# Each file ends < 95MB (Figma video limit is 100MB): crf goes up by 3 until it fits.
#
# usage:  V=/path/to/client/Videos [SHOW=/path/to/showreel/public/plates] sh entrega.sh
#   V     folder with the client's videos (plates are read from $V/plates60)   REQUIRED
#   SHOW  Remotion showreel public/plates folder to copy plates into          optional
#   LOOP  path to loop.sh (default: next to this script, else ~/.claude/skills/site-reels/scripts)
# Works on Linux, macOS and Git Bash on Windows (file size via wc -c, no GNU stat).
V="${V:?set V=<client Videos folder>, e.g. V=\"\$HOME/clients/brand/videos\"}"
P="$V/plates60"
SHOW="${SHOW:-}"
HERE="$(cd "$(dirname "$0")" && pwd)"
LOOP="${LOOP:-$HERE/loop.sh}"
[ -f "$LOOP" ] || LOOP="$HOME/.claude/skills/site-reels/scripts/loop.sh"
MAX=95000000

size() { wc -c < "$1" | tr -d ' '; }

# enc <in> <out> [ss] [dur]: re-encode raising crf until it fits
enc() {
  crf=20
  while :; do
    ffmpeg -y -loglevel error ${3:+-ss "$3"} ${4:+-t "$4"} -i "$1" -an -c:v libx264 -preset slow -crf $crf -pix_fmt yuv420p -movflags +faststart "$2"
    [ "$(size "$2")" -lt $MAX ] && break
    crf=$((crf + 3))
  done
  echo "ok $(basename "$2") crf=$crf $(($(size "$2") / 1000000))MB"
}
# loop <in> <out> <ss> <dur> <crossfade>
loop() {
  crf=18
  while :; do
    sh "$LOOP" "$1" "$2" "$3" "$4" "$5" $crf >/dev/null
    [ "$(size "$2")" -lt $MAX ] && break
    crf=$((crf + 3))
  done
  echo "ok $(basename "$2") crf=$crf $(($(size "$2") / 1000000))MB"
}

# --- example plate names below: replace with your scenes ---
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

enc "$P/3d-caminhada-light.mp4" "$V/3d-limpo/3d-caminhada-light.mp4" 0 23 # the end of the route is an empty field
enc "$P/3d-caminhada-dark.mp4" "$V/3d-limpo/3d-caminhada-dark.mp4" 0 23

# plates for the showreel (Remotion reads from public/plates)
if [ -n "$SHOW" ]; then
  mkdir -p "$SHOW"
  for f in reveal-noir-dark 3d-arvore-light 3d-caminhada-light wordmark-tinta-light; do cp "$P/$f.mp4" "$SHOW/$f.mp4"; done
  echo "plates copied to the showreel"
fi
