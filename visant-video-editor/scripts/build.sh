#!/usr/bin/env bash
# Assembles the vlog from _build/edl.txt
# Usage:
#   bash _tools/build.sh                      # 16:9 horizontal (default)
#   AR=9:16 bash _tools/build.sh              # vertical (reels)
#   FILL=blur bash _tools/build.sh            # blurred bars instead of cropping
#   MUSIC="../musica.mp3" bash _tools/build.sh
#   OUT=v2 bash _tools/build.sh
set -euo pipefail
# portable md5: md5sum (Linux/Git Bash), md5 -q (macOS) or openssl
md5_de() { if command -v md5sum >/dev/null 2>&1; then md5sum | cut -d' ' -f1
           elif command -v md5 >/dev/null 2>&1; then md5 -q
           else openssl md5 -r | cut -d' ' -f1; fi; }

BASE="${PROJ:-$PWD}"      # project root (_build/ and _out/ live here)
ROOT="${SRC:-$BASE}"          # media folder (SRC= points outside)
BUILD="$BASE/_build"; CLIPS="$BUILD/clips"; OUTDIR="$BASE/_out"
mkdir -p "$CLIPS" "$OUTDIR"
EDL="$BUILD/edl.txt"
[ -f "$EDL" ] || { echo "No $EDL. Run first: bash _tools/ingest.sh"; exit 1; }

AR="${AR:-16:9}"
FILL="${FILL:-auto}"          # auto | blur | crop | black
                              # auto: horizontal -> crop (fills the screen)
                              #       vertical   -> blur  (keeps the framing)
FPS="${FPS:-30}"
OUT="${OUT:-vlog}"
MUSIC="${MUSIC:-}"
MUSIC_DB="${MUSIC_DB:--18}"   # music volume
XFADE="${XFADE:-0}"           # 0 = hard cut (fast/stable)

case "$AR" in
  9:16) W=1080; H=1920 ;;
  16:9) W=1920; H=1080 ;;
  1:1)  W=1080; H=1080 ;;
  *) echo "invalid AR: use 9:16, 16:9 or 1:1"; exit 1 ;;
esac

vf_for() {   # $1 = fill mode
  case "$1" in
    blur)  printf '%s' "split[bg][fg];[bg]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},gblur=sigma=28[bgb];[fg]scale=${W}:${H}:force_original_aspect_ratio=decrease[fgs];[bgb][fgs]overlay=(W-w)/2:(H-h)/2,setsar=1,fps=${FPS},format=yuv420p" ;;
    crop)  printf '%s' "scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=${FPS},format=yuv420p" ;;
    black) printf '%s' "scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${FPS},format=yuv420p" ;;
  esac
}

# picks the fill by looking at the clip's REAL orientation (rotation already applied)
fill_for() {   # $1 = file
  [ "$FILL" != auto ] && { printf '%s' "$FILL"; return; }
  local p sw sh rot t
  # a single probe; nk=0 so it comes as "key=value" and awk picks each field clean
  p="$(ffprobe -v error -select_streams v:0 \
        -show_entries stream=width,height:stream_side_data=rotation \
        -of default=nw=1 "$1" 2>/dev/null)"
  sw="$(printf '%s\n' "$p" | awk -F= '/^width=/   {gsub(/[^0-9]/,"",$2); print $2; exit}')"
  sh="$(printf '%s\n' "$p" | awk -F= '/^height=/  {gsub(/[^0-9]/,"",$2); print $2; exit}')"
  rot="$(printf '%s\n' "$p" | awk -F= '/^rotation=/{gsub(/[^0-9-]/,"",$2); print $2; exit}')"
  rot="${rot:-0}"
  case "${rot#-}" in 90|270) t="$sw"; sw="$sh"; sh="$t" ;; esac
  [ -n "$sw" ] && [ -n "$sh" ] && [ "$sh" -gt 0 ] 2>/dev/null || { printf 'crop'; return; }
  # does it fit by cropping without losing too much? otherwise, blur
  if [ $(( sw * H )) -ge $(( sh * W )) ]; then printf 'crop'; else printf 'blur'; fi
}

# --- vlog basics: audio ---
# An inaudible take is vlog defect #1: phone clips from different days vary
# a lot in volume. Target I=-16 LUFS (streaming/YouTube).
#
#   LOUD=2  two passes (DEFAULT): measures the cut, then applies LINEAR gain.
#           Keeps the dynamics. Costs one audio analysis pass per cut.
#   LOUD=1  one pass: dynamic normalization = COMPRESSES. Fast, but flattens.
#           Measured in the field: LRA dropped to 1.6 LU, dynamics dead. Only when in a hurry.
#   LOUD=0  leaves the audio alone.
#
# 15ms afade at the edges: a hard cut in digital audio clicks. This kills the click.
LOUD="${LOUD:-2}"
ALVO_I="${ALVO_I:--16}"
SR="${SR:-48000}"

# `aresample` AFTER loudnorm is not redundant: loudnorm resamples internally
# to 192 kHz, the AAC encoder caps at 96 kHz, and the cut comes out at 96 kHz.
# A cut that falls back (no loudnorm) comes out at 48 kHz. Mixing rates in the
# concat corrupts the audio: 843 "Invalid data found" errors in a 14 min master.
# A uniform rate is a prerequisite of the concat demuxer, not a detail.
DESCLICK="afade=t=in:st=0:d=0.015,areverse,afade=t=in:st=0:d=0.015,areverse,aresample=${SR}"

case "$LOUD" in
  1) AUD_CHAIN="loudnorm=I=${ALVO_I}:TP=-1.5:LRA=11,${DESCLICK}" ;;
  0) AUD_CHAIN="aresample=${SR}" ;;
  *) AUD_CHAIN="" ;;   # 2 = measured per cut, built inside the loop
esac

# pass 1 of two-pass: measures the cut and returns the loudnorm chain already calibrated
cadeia_audio_medida() {   # $1=file  $2=in  $3=out
  local m i tp lra thr
  local rec=(-ss "$2"); [ -n "${3:-}" ] && rec+=(-to "$3")
  # -v info is REQUIRED: print_format=json comes out at info level, and with -v error
  # ffmpeg swallows the measurement. With -v error this always falls back to one
  # pass and LOUD=2 becomes a silent no-op (it happened).
  m="$(ffmpeg -nostdin -v info -hide_banner "${rec[@]}" -i "$1" \
        -af "loudnorm=I=${ALVO_I}:TP=-1.5:LRA=11:print_format=json" \
        -f null - 2>&1 | tr -d ' ",' || true)"
  i="$(  printf '%s\n' "$m" | awk -F: '/input_i/        {print $2; exit}')"
  tp="$( printf '%s\n' "$m" | awk -F: '/input_tp/       {print $2; exit}')"
  lra="$(printf '%s\n' "$m" | awk -F: '/input_lra/      {print $2; exit}')"
  thr="$(printf '%s\n' "$m" | awk -F: '/input_thresh/   {print $2; exit}')"
  # measurement failed (silent cut, no audio track): fall back to one pass, never break the build
  case "${i:-}" in ''|*inf*|*nan*) printf '%s' "loudnorm=I=${ALVO_I}:TP=-1.5:LRA=11,${DESCLICK}"; return ;; esac
  printf '%s' "loudnorm=I=${ALVO_I}:TP=-1.5:LRA=11:linear=true:measured_I=${i}:measured_TP=${tp}:measured_LRA=${lra}:measured_thresh=${thr},${DESCLICK}"
}

echo "== normalizing cuts -> ${W}x${H} @${FPS} (fill=$FILL, loudnorm=$LOUD)"
# Concat list PER PROCESS. With a fixed name, two builds of the same project
# write to the same list and the master comes out with cuts from both: that is
# exactly what happened (47 entries for a 45-line EDL) after an interrupted build
# whose child ffmpeg survived. Same trap #1: fixed name + concurrency.
i=0; list="$CLIPS/concat.$$.txt"; : > "$list"
trap 'rm -f "$list"' EXIT

# reads the cut list from descriptor 9, not stdin: ffmpeg inside the loop ate
# stdin and silently skipped cuts. -nostdin on every ffmpeg is the belt; this is the suspenders.
while IFS=$'\t' read -r -u 9 f tin tout afile ain || [ -n "${f:-}" ]; do
  case "${f:-}" in ''|\#*) continue ;; esac
  # CRLF: the EDL is a file a PERSON edits, and Windows editors write \r.
  # The \r sticks to the last field and ffmpeg rejects the argument; here it
  # showed up as "narration failed" on every cut, without saying why.
  f="${f%$'\r'}"; tin="${tin%$'\r'}"; tout="${tout%$'\r'}"
  afile="${afile%$'\r'}"; ain="${ain%$'\r'}"
  afile="${afile:-}"; ain="${ain:-0}"
  # looks in the raw media and, if not found, in the project itself: that is how
  # a chapter card (generated in _build/) enters the cut list without touching the
  # source folder, which the gate requires untouched.
  src="$ROOT/$f"
  [ -f "$src" ] || src="$BASE/$f"
  [ -f "$src" ] || { echo "  ! not found: $f, skipping"; continue; }
  tin="${tin:-0}"; tout="${tout:-}"
  i=$((i+1)); n="$(printf '%03d' "$i")"
  ext="$(echo "${f##*.}" | tr 'A-Z' 'a-z')"
  fl="$(fill_for "$src")"; VF="$(vf_for "$fl")"

  # Cache keyed by CONTENT, never by position. Naming by position (001.mp4)
  # made cut 001 of an old cut list get reused for another clip when the cut
  # list changed: silently, with the wrong video in its place.
  # The "a2" suffix versions the AUDIO CHAIN. Without it, fixing the audio would
  # leave the old cuts (96 kHz) in the cache and the fix would not reach the master.
  # NARRATION (EDL columns 4 and 5): video from one file, audio from another.
  # It is what separates "competent assembly" from an essay: the voice leads and
  # the image proves, instead of showing the person talking for 20 s.
  asrc=""
  if [ -n "$afile" ]; then
    asrc="$ROOT/$afile"; [ -f "$asrc" ] || asrc="$BASE/$afile"
    [ -f "$asrc" ] || { echo "  ! narration not found: $afile, using the clip's own audio"; asrc=""; }
  fi

  key="$(printf '%s|%s|%s|%s|%s|%s|%s|%s|%s|%s' \
          "$f" "$tin" "$tout" "$fl" "$W" "$H" "$FPS" "$LOUD-$SR-a2" "${afile:-}" "$ain" | md5_de | cut -c1-12)"
  dst="$CLIPS/${key}.mp4"

  if [ -f "$dst" ] && [ "$dst" -nt "$src" ]; then
    echo "  = ${n} $f (cache)"; echo "file '$(basename "$dst")'" >> "$list"; continue
  fi
  # OVERRUN WARNING: asking past the end of the clip is not an ffmpeg error; it
  # delivers a shorter cut. With narration that desyncs the voice from the rest
  # of the video, silently. Better to shout here than to find out by watching.
  if [ -n "${tout:-}" ]; then
    dsrc="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$src" 2>/dev/null)"
    est="$(awk -v o="$tout" -v d="${dsrc:-0}" 'BEGIN{print (d>0 && o>d+0.05) ? "s" : "n"}')"
    [ "$est" = s ] && echo "  ! ${n} $f asks up to ${tout}s but the clip has ${dsrc}s: the cut will come out short"
  fi
  echo "  + ${n} $f  [${tin} -> ${tout:-end}]  fill=$fl"

  # two-pass: measures the cut now (the cache above already avoided re-measuring).
  # With narration, measure the NARRATION: it is what will be heard.
  if [ "$LOUD" = 2 ]; then
    if [ -n "$asrc" ]; then
      dur_v="$(awk -v a="$tin" -v b="${tout:-0}" 'BEGIN{printf "%.2f", b-a}')"
      AUD_CHAIN="$(cadeia_audio_medida "$asrc" "$ain" "$(awk -v a="$ain" -v d="$dur_v" 'BEGIN{printf "%.2f", a+d}')")"
    else
      AUD_CHAIN="$(cadeia_audio_medida "$src" "$tin" "$tout")"
    fi
  fi

  # narration path: video on one side, voice on the other, duration driven by the video
  if [ -n "$asrc" ]; then
    dur_v="$(awk -v a="$tin" -v b="${tout:-0}" 'BEGIN{printf "%.2f", b-a}')"
    ffmpeg -nostdin -y -v error -ss "$tin" -to "${tout}" -i "$src" \
      -ss "$ain" -t "$dur_v" -i "$asrc" \
      -f lavfi -t "$dur_v" -i anullsrc=r=${SR}:cl=stereo \
      -filter_complex "[0:v]${VF}[v];[1:a]aresample=${SR},${AUD_CHAIN}[a0];[2:a]anull[a1];[a0][a1]amix=inputs=2:duration=first:dropout_transition=0:weights='1 0'[a]" \
      -map '[v]' -map '[a]' -c:v libx264 -preset veryfast -crf 20 -c:a aac -ar "$SR" -b:a 160k "$dst" 2>/dev/null \
    || { echo "    ! narration failed, falling back to the clip audio"; asrc=""; }
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

[ "$i" -gt 0 ] || { echo "No valid cut in the EDL."; exit 1; }

# Stable copy of the list. The working list is per process (concurrency) and
# dies on EXIT, but without a fixed-name copy there is no way to check what was
# assembled after the build, and the gate went blind to 3 cases because of that.
cp -f "$list" "$CLIPS/concat.ultimo.txt" 2>/dev/null || true

echo "== joining $i cuts"
final="$OUTDIR/${OUT}.mp4"

# total duration, to anchor the fade out
TOT="$(awk -F"'" '/^file /{print $2}' "$list" | while read -r c; do
  ffprobe -v error -show_entries format=duration -of csv=p=0 "$CLIPS/$c"; done \
  | awk '{t+=$1} END{printf "%.2f", t}')"

FADE_IN="${FADE_IN:-0.8}"
FADE_OUT="${FADE_OUT:-1.5}"
fo_at="$(awk -v t="$TOT" -v d="$FADE_OUT" 'BEGIN{printf "%.2f", (t-d<0?0:t-d)}')"

# opens from black and closes to black: basic vlog punctuation.
# alimiter on the master: after per-cut loudnorm, it holds transient peaks.
VMASTER="fade=t=in:st=0:d=${FADE_IN},fade=t=out:st=${fo_at}:d=${FADE_OUT}"
AMASTER="afade=t=in:st=0:d=${FADE_IN},afade=t=out:st=${fo_at}:d=${FADE_OUT},alimiter=limit=0.95"

echo "   total ${TOT}s | fade in ${FADE_IN}s, fade out at ${fo_at}s"

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
echo "== done: $final"
ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$final"
