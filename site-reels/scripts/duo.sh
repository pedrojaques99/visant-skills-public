#!/usr/bin/env bash
# Brand duotone for b-roll and photos, so every shot speaks the brand palette.
# Usage: INK=0d0d0d LIGHT=c5faff OUT=assets/broll/duo bash duo.sh <file> [<file> ...]
# Defaults: Visant ink -> light cyan. Video comes out all-intra (-g 1): headless seeks never stall.
set -e
INK=${INK:-0d0d0d}; LIGHT=${LIGHT:-c5faff}; OUT=${OUT:-duo}
h() { printf '%d' "0x${1:$2:2}"; }
r0=$(h $INK 0); g0=$(h $INK 2); b0=$(h $INK 4); r1=$(h $LIGHT 0); g1=$(h $LIGHT 2); b1=$(h $LIGHT 4)
k() { awk -v a=$1 -v b=$2 'BEGIN{printf "%.4f", (b-a)/255}'; }
LUT="format=gray,format=rgb24,lutrgb=r='$r0+val*$(k $r0 $r1)':g='$g0+val*$(k $g0 $g1)':b='$b0+val*$(k $b0 $b1)',eq=contrast=1.12"
mkdir -p "$OUT"
for f in "$@"; do
  n=$(basename "$f"); o="$OUT/$n"
  [ -f "$o" ] && continue
  case "$n" in
    *.mp4|*.mov) ffmpeg -v error -y -i "$f" -an -vf "$LUT,scale=1920:-2" -c:v libx264 -crf 18 -g 1 -pix_fmt yuv420p "${o%.*}.mp4" ;;
    *) ffmpeg -v error -y -i "$f" -vf "$LUT" -q:v 2 "$o" ;;
  esac
  echo "$o"
done
