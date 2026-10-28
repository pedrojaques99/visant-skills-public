#!/usr/bin/env bash
# GATE for visant-video-editor. Run it before assembling a client video.
#
# Every case here is a bug that ALREADY happened in production and fails SILENTLY:
# the build ends with exit 0 and delivers the wrong video. A linter does not catch
# it, the eye does not catch it in a 25 min vlog. Only a test does.
#
# Usage: bash self-test.sh            # run everything
#        bash self-test.sh -v         # show the scripts' output
#        KEEP=1 bash self-test.sh     # keep the sandbox (for debugging)
set -uo pipefail
# portable md5: md5sum (Linux/Git Bash), md5 -q (macOS) or openssl
md5_de() { if command -v md5sum >/dev/null 2>&1; then md5sum | cut -d' ' -f1
           elif command -v md5 >/dev/null 2>&1; then md5 -q
           else openssl md5 -r | cut -d' ' -f1; fi; }

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERBOSE=0; [ "${1:-}" = "-v" ] && VERBOSE=1
SANDBOX="${TMPDIR:-/tmp}/vve-selftest-$$"
OK=0; FALHOU=0; FALHAS=""

mkdir -p "$SANDBOX/src"
limpar() { [ "${KEEP:-0}" = 1 ] && { echo "sandbox: $SANDBOX"; return; }; rm -rf "$SANDBOX"; }
trap limpar EXIT

roda() { if [ "$VERBOSE" = 1 ]; then "$@"; else "$@" >/dev/null 2>&1; fi; }

passou() { OK=$((OK+1)); printf '  \033[32mOK\033[0m   %s\n' "$1"; }
falha()  { FALHOU=$((FALHOU+1)); FALHAS="$FALHAS\n  - $1: $2"; printf '  \033[31mFAIL\033[0m  %s\n         %s\n' "$1" "$2"; }
aval()   { if [ "$2" = "$3" ]; then passou "$1"; else falha "$1" "expected [$3], got [$2]"; fi; }

# ---------------------------------------------------------------- fixtures
# Synthetic, generated on the fly: the skill ships no sample video.
# They cover the shapes that break the pipeline: horizontal, vertical, rotation by
# metadata, no audio track, silent audio, and a still photo.
echo "== generating fixtures"
# $5 = visual source, $6 = tone frequency. The fixtures MUST be distinguishable:
# with testsrc2 on all of them, two cuts from different clips come out byte-identical
# and the cache test passes by mistake (it happened while writing this gate).
fx() { # $1=name  $2=WxH  $3=dur  $4=has_audio  $5=lavfi-source  $6=hz
  local o="$SANDBOX/src/$1"
  if [ "$4" = 1 ]; then
    ffmpeg -nostdin -y -v error -f lavfi -i "$5=size=$2:rate=30:duration=$3" \
      -f lavfi -i "sine=frequency=$6:sample_rate=48000:duration=$3" \
      -c:v libx264 -preset ultrafast -pix_fmt yuv420p -c:a aac -shortest "$o"
  else
    ffmpeg -nostdin -y -v error -f lavfi -i "$5=size=$2:rate=30:duration=$3" \
      -c:v libx264 -preset ultrafast -pix_fmt yuv420p "$o"
  fi
}
fx horiz.mp4     640x360 4  1 testsrc2   440
fx horiz2.mp4    640x360 8  1 smptebars  330
fx horiz3.mp4    640x360 3  1 rgbtestsrc 550
fx vert.mp4      360x640 4  1 testsrc2   440
fx semaudio.mp4  640x360 3  0 smptebars  0
fx longo.mp4     640x360 30 1 testsrc    220
# Rotation by metadata: 640x360 in pixels, 360x640 on screen. This is the fixture
# that DISCRIMINATES: whoever reads only width/height gets vert.mp4 right and this wrong.
# `-metadata rotate=90` does NOT write a display matrix in this ffmpeg; `-display_rotation` does.
ffmpeg -nostdin -y -v error -display_rotation 90 -i "$SANDBOX/src/horiz.mp4" -c copy \
  "$SANDBOX/src/rot90.mp4" 2>/dev/null || cp "$SANDBOX/src/horiz.mp4" "$SANDBOX/src/rot90.mp4"
if [ -z "$(ffprobe -v error -select_streams v:0 -show_entries stream_side_data=rotation \
           -of default=nw=1:nk=1 "$SANDBOX/src/rot90.mp4" 2>/dev/null)" ]; then
  echo "   WARNING: fixture rot90 came out without a display matrix; the rotation case discriminates nothing"
fi
ffmpeg -nostdin -y -v error -f lavfi -i "color=c=red:size=640x360:duration=1" -frames:v 1 \
  "$SANDBOX/src/foto.jpg"
# MODERATE dynamics (LRA ~9, below the target of 11): the only range where
# loudnorm's linear mode actually applies. With LRA above the target ffmpeg
# turns linear off by itself and both modes match; such a fixture tests nothing.
ffmpeg -nostdin -y -v error -f lavfi -i "testsrc2=size=640x360:rate=30:duration=20" \
  -f lavfi -i "sine=frequency=440:duration=20:sample_rate=48000" \
  -filter_complex "[1:a]volume='0.35+0.3*sin(2*PI*t/6)':eval=frame[a]" \
  -map 0:v -map '[a]' -c:v libx264 -preset ultrafast -pix_fmt yuv420p -c:a aac \
  "$SANDBOX/src/dinamica.mp4"
echo "   $(ls "$SANDBOX/src" | wc -l) fixtures"

export PROJ="$SANDBOX/proj"
export SRC="$SANDBOX/src"
mkdir -p "$PROJ"
edl() { printf "$1" > "$PROJ/_build/edl.txt"; }

echo
echo "== gate"

# ---------------------------------------------------------------- 1. ingest
roda bash "$AQUI/ingest.sh"
n="$(awk 'NR>1' "$PROJ/_build/manifest.tsv" 2>/dev/null | wc -l | tr -d ' ')"
aval "ingest reads every media file in the folder" "$n" "9"

# ---------------------------------------------------------------- 2. COUNT
# The pipeline's most important invariant: every cut in the cut list has to reach
# the concat. Anything that stops the loop midway (`set -e` in a pipe subshell,
# ffmpeg eating stdin, a parse error) exits 0 with an incomplete video.
# It does not test a CAUSE, it tests the CONSEQUENCE: it catches causes we do not know yet.
edl 'horiz.mp4\t0\t1\nhoriz2.mp4\t0\t1\nhoriz3.mp4\t0\t1\nvert.mp4\t0\t1\nsemaudio.mp4\t0\t1\n'
roda bash "$AQUI/build.sh"
n="$(grep -c '^file ' "$PROJ/_build/clips/concat.ultimo.txt" 2>/dev/null || echo 0)"
aval "every cut in the cut list reaches the concat (5 of 5)" "$n" "5"

# ---------------------------------------------------------------- 3. CACHE
# A cache key by POSITION (001.mp4) reuses a cut from an old cut list for a
# different clip: wrong video, silently.
edl 'horiz.mp4\t0\t1\n'
roda bash "$AQUI/build.sh" ; h1="$(md5_de < "$PROJ/_out/vlog.mp4")"
edl 'horiz2.mp4\t0\t1\n'
roda bash "$AQUI/build.sh" ; h2="$(md5_de < "$PROJ/_out/vlog.mp4")"
if [ "$h1" != "$h2" ]; then passou "different clip in the same slot re-encodes"
else falha "different clip in the same slot re-encodes" "identical video came out: cache collided by position"; fi

edl 'horiz.mp4\t0\t1\n'
saida="$(bash "$AQUI/build.sh" 2>&1)"
if printf '%s' "$saida" | grep -q '(cache)'; then passou "repeated cut hits the cache"
else falha "repeated cut hits the cache" "re-encoded what was identical"; fi

# ---------------------------------------------------------------- 4. ROTATION
# A vertical clip cropped to 16:9 has its framing destroyed. The decision
# depends on reading the display matrix, not the pixel width.
# Clear the cache first: a cache line does not print the fill decision.
rm -rf "$PROJ/_build/clips"
edl 'vert.mp4\t0\t1\n'
out="$(bash "$AQUI/build.sh" 2>&1 | grep -E '^  \+ ')"
if printf '%s' "$out" | grep -q 'fill=blur'; then passou "vertical goes in with blur, not crop"
else falha "vertical goes in with blur, not crop" "picked: $(printf '%s' "$out" | grep -o 'fill=[a-z]*' | head -1)"; fi

rm -rf "$PROJ/_build/clips"
edl 'horiz.mp4\t0\t1\n'
out="$(bash "$AQUI/build.sh" 2>&1 | grep -E '^  \+ ')"
if printf '%s' "$out" | grep -q 'fill=crop'; then passou "horizontal fills the screen with crop"
else falha "horizontal fills the screen with crop" "picked: $(printf '%s' "$out" | grep -o 'fill=[a-z]*' | head -1)"; fi

# THE CASE THAT DISCRIMINATES: 640x360 in pixels, vertical on screen. Reading
# width/height without the display matrix gets vert.mp4 right by luck and this wrong.
rm -rf "$PROJ/_build/clips"
edl 'rot90.mp4\t0\t1\n'
out="$(bash "$AQUI/build.sh" 2>&1 | grep -E '^  \+ ')"
if printf '%s' "$out" | grep -q 'fill=blur'; then passou "rotation by metadata treated as vertical"
else falha "rotation by metadata treated as vertical" "read the pixels, not the display matrix: $(printf '%s' "$out" | grep -o 'fill=[a-z]*' | head -1)"; fi

# ---------------------------------------------------------------- 5. NO AUDIO
# A clip with no audio track must not break the concat or desync the rest.
edl 'semaudio.mp4\t0\t2\nhoriz.mp4\t0\t2\n'
roda bash "$AQUI/build.sh"
na="$(ffprobe -v error -select_streams a -show_entries stream=codec_type -of csv=p=0 "$PROJ/_out/vlog.mp4" 2>/dev/null | wc -l | tr -d ' ')"
aval "clip without audio does not break: master comes out with 1 track" "$na" "1"

# ---------------------------------------------------------------- 5b. UNIFORM RATE
# The concat demuxer requires IDENTICAL parameters across cuts. loudnorm resamples
# to 192 kHz internally and AAC caps at 96 kHz, so a cut with loudnorm came out at
# 96 kHz and a cut through the fallback at 48 kHz. Result: 843 "Invalid data found"
# errors and corrupted audio in a 14 min master, with exit 0.
# The mix only shows up when cuts take DIFFERENT audio paths: that is why the
# cut list here mixes a clip with audio and a clip without.
rm -rf "$PROJ/_build/clips"
edl 'horiz.mp4\t0\t2\nsemaudio.mp4\t0\t2\ndinamica.mp4\t0\t3\nfoto.jpg\t0\t2\n'
roda bash "$AQUI/build.sh"
taxas="$(for c in "$PROJ"/_build/clips/*.mp4; do
           ffprobe -v error -select_streams a:0 -show_entries stream=sample_rate \
             -of default=nw=1:nk=1 "$c" 2>/dev/null
         done | sort -u | tr '\n' ' ')"
aval "every cut comes out at the same sample rate (got: ${taxas:-none})" "$(echo $taxas)" "48000"

# And the master must have no decoding error at the joins.
erros="$(ffmpeg -nostdin -v error -i "$PROJ/_out/vlog.mp4" -f null - 2>&1 \
          | grep -c "Invalid data\|scalefactor" || true)"
aval "master decodes with no audio error" "$erros" "0"

# ---------------------------------------------------------------- 5c. NARRATION
# EDL columns 4/5: video from one file, voice from another. The case discriminates
# hard: the video is a clip WITHOUT an audio track. If the narration does not go in,
# the cut comes out silent, and silent is exactly how the failure would show in the vlog.
rm -rf "$PROJ/_build/clips"
printf 'semaudio.mp4\t0\t3\tdinamica.mp4\t2\n' > "$PROJ/_build/edl.txt"
roda bash "$AQUI/build.sh"
vol="$(ffmpeg -nostdin -hide_banner -nostats -i "$PROJ/_out/vlog.mp4" -af volumedetect -f null - 2>&1 \
        | awk -F': ' '/mean_volume/{gsub(/ dB/,"",$2); print $2; exit}')"
ok="$(awk -v v="${vol:--99}" 'BEGIN{print (v > -50) ? "sim" : "nao"}')"
aval "narration goes into a silent video (mean_volume=${vol:-?} dB)" "$ok" "sim"

# and the old 3-column EDL still works
rm -rf "$PROJ/_build/clips"
edl 'horiz.mp4\t0\t2\n'
roda bash "$AQUI/build.sh"
n="$(grep -c '^file ' "$PROJ/_build/clips/concat.ultimo.txt" 2>/dev/null || echo 0)"
aval "3-column EDL still works (backward compatible)" "$n" "1"

# ---------------------------------------------------------------- 5d. CRLF
# The EDL is edited by people, and Windows editors write \r at the end of the line.
# The \r sticks to the last field and ffmpeg rejects the argument. Unhandled, the
# narration failed on EVERY cut and the message did not say why.
rm -rf "$PROJ/_build/clips"
printf 'semaudio.mp4\t0\t3\tdinamica.mp4\t2\r\nhoriz.mp4\t0\t2\r\n' > "$PROJ/_build/edl.txt"
roda bash "$AQUI/build.sh"
n="$(grep -c '^file ' "$PROJ/_build/clips/concat.ultimo.txt" 2>/dev/null || echo 0)"
aval "EDL with CRLF assembles both cuts" "$n" "2"
vol="$(ffmpeg -nostdin -hide_banner -nostats -i "$PROJ/_out/vlog.mp4" -af volumedetect -f null - 2>&1 \
        | awk -F': ' '/mean_volume/{gsub(/ dB/,"",$2); print $2; exit}')"
ok="$(awk -v v="${vol:--99}" 'BEGIN{print (v > -50) ? "sim" : "nao"}')"
aval "narration survives CRLF (mean_volume=${vol:-?} dB)" "$ok" "sim"

# ---------------------------------------------------------------- 6. DURATION
# The concat demuxer with an msys path fails in this native Windows ffmpeg.
# If the duration does not match the sum of the cuts, some cut vanished.
edl 'horiz.mp4\t0\t2\nhoriz2.mp4\t0\t3\nhoriz3.mp4\t0\t1\n'
roda bash "$AQUI/build.sh"
d="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$PROJ/_out/vlog.mp4" 2>/dev/null)"
ok="$(awk -v d="${d:-0}" 'BEGIN{print (d>5.4 && d<6.6) ? "sim" : "nao"}')"
aval "master duration = sum of the cuts (6s +-0.6)" "$ok" "sim"

# ---------------------------------------------------------------- 7. AUDIO
# Streaming target. If it misses, a take ends up inaudible in the middle of the vlog.
i="$(ffmpeg -hide_banner -nostats -i "$PROJ/_out/vlog.mp4" -af ebur128 -f null - 2>&1 \
      | awk '/I:/{v=$2} END{print v}')"
ok="$(awk -v i="${i:-99}" 'BEGIN{d=i-(-16); if(d<0)d=-d; print (d<=2.5) ? "sim" : "nao"}')"
aval "loudness at -16 LUFS +-2.5 (got ${i:-?})" "$ok" "sim"

# ---------------------------------------------------------------- 7b. TWO PASSES
# loudnorm prints its measurement at INFO level. With `-v error` ffmpeg swallows
# the JSON, the measurement comes back empty, the code falls back to one pass and
# LOUD=2 becomes a SILENT no-op: same command, same output, no error. It happened.
# The test measures the consequence: two passes preserve the source dynamics.
lra_de() { ffmpeg -hide_banner -nostats -i "$1" -af ebur128 -f null - 2>&1 \
            | tail -14 | awk '/^ *LRA:/{l=$2} END{print l+0}'; }
lra_src="$(lra_de "$SRC/dinamica.mp4")"
for modo in 1 2; do
  rm -rf "$PROJ/_build/clips"
  edl 'dinamica.mp4\t0\t20\n'
  LOUD=$modo OUT="loud$modo" roda bash "$AQUI/build.sh"
done
lra1="$(lra_de "$PROJ/_out/loud1.mp4")"
lra2="$(lra_de "$PROJ/_out/loud2.mp4")"
ok="$(awk -v s="$lra_src" -v a="$lra1" -v b="$lra2" 'BEGIN{
  da=s-a; if(da<0)da=-da; db=s-b; if(db<0)db=-db
  print (db<=0.3 && db<da) ? "sim" : "nao" }')"
aval "LOUD=2 preserves dynamics (source=$lra_src 1pass=$lra1 2pass=$lra2)" "$ok" "sim"

# ---------------------------------------------------------------- 8. FADE
# Opens from black. A bright frame 0 = the fade was not applied.
y="$(ffmpeg -hide_banner -nostats -i "$PROJ/_out/vlog.mp4" \
      -vf "select=eq(n\,0),signalstats,metadata=print:key=lavfi.signalstats.YAVG" \
      -f null - 2>&1 | awk -F= '/YAVG/{print int($2); exit}')"
ok="$(awk -v y="${y:-255}" 'BEGIN{print (y<40) ? "sim" : "nao"}')"
aval "master opens from black (YAVG frame 0 = ${y:-?})" "$ok" "sim"

# ---------------------------------------------------------------- 9. CUT LIST
# Duration ceiling respected, and a long take (narrative) never dropped.
roda bash "$AQUI/ingest.sh"
TETO_MIN=1 roda bash "$AQUI/roteiro.sh"
if grep -q 'longo.mp4' "$PROJ/_build/edl.txt"; then passou "cut list keeps the long take under a tight ceiling"
else falha "cut list keeps the long take under a tight ceiling" "the narrative take was dropped"; fi

# A CEILING IS A CEILING. Two regressions already made it ignored: (a) the tightening
# loop only touched the cap while the SLOPE was the limiter; (b) the b-roll thinning
# rounded down and removed nothing. TETO_MIN=15 delivered 16.0.
# Narrative may exceed the ceiling (it is never sacrificed); b-roll may not.
TETO_MIN=2 COMP_LONG=0.9 MAX_LONG=90 roda bash "$AQUI/roteiro.sh"
tot="$(grep -v '^#' "$PROJ/_build/edl.txt" | awk -F'\t' '{t+=$3-$2} END{printf "%.1f", t/60}')"
ok="$(awk -v t="${tot:-99}" 'BEGIN{print (t <= 2.4) ? "sim" : "nao"}')"
aval "2 min ceiling respected even with an aggressive slope (got ${tot} min)" "$ok" "sim"

TETO_MIN=0 roda bash "$AQUI/roteiro.sh"
n="$(grep -vc '^#' "$PROJ/_build/edl.txt")"
ok="$(awk -v n="$n" 'BEGIN{print (n>=6) ? "sim" : "nao"}')"
aval "without a ceiling the cut list does not drop all b-roll (got $n cuts)" "$ok" "sim"

# ---------------------------------------------------------------- 10. BREAKDOWN
# tile= needs uniform thumb size and numbering with no gaps; this Windows ffmpeg
# also has no glob. A photo with -ss fails and leaves a gap.
edl 'horiz.mp4\t0\t1\nvert.mp4\t0\t1\nfoto.jpg\t0\t2\n'
roda bash "$AQUI/decupagem.sh"
THUMBS=1 roda bash "$AQUI/decupagem.sh"
n="$(ls "$PROJ/_build/contato"/[0-9]*.jpg 2>/dev/null | wc -l | tr -d ' ')"
aval "a thumb for every cut, photo included" "$n" "3"
if ls "$PROJ/_build/contato"/folha-*.jpg >/dev/null 2>&1; then passou "contact sheet assembles (no glob, uniform thumbs)"
else falha "contact sheet assembles (no glob, uniform thumbs)" "no folha-*.jpg generated"; fi
if [ -s "$PROJ/DECUPAGEM.md" ] && grep -q '| 1 |' "$PROJ/DECUPAGEM.md"; then passou "DECUPAGEM.md has a cut row"
else falha "DECUPAGEM.md has a cut row" "empty table: the file x manifest join failed"; fi
if [ -s "$PROJ/CAPITULOS.txt" ] && grep -q '00:00:00' "$PROJ/CAPITULOS.txt"; then passou "CAPITULOS.txt starts at 00:00:00"
else falha "CAPITULOS.txt starts at 00:00:00" "YouTube rejects chapters that do not start at zero"; fi

# ---------------------------------------------------------------- 11. CONCURRENCY
# REAL ROOT CAUSE of the abort in the field: roteiro.sh and decupagem.sh wrote the same
# `_build/.edl.tmp`. Running together (one in the background), one read the other's
# file half-written, the columns misaligned and `set -e` killed the loop midway, with
# exit 0 and a truncated breakdown. It was not ffmpeg eating stdin, as it looked.
roda bash "$AQUI/ingest.sh"
edl 'horiz.mp4\t0\t1\nhoriz2.mp4\t0\t1\nhoriz3.mp4\t0\t1\n'
( TETO_MIN=0 bash "$AQUI/roteiro.sh" >/dev/null 2>&1 ) &
p1=$!
( bash "$AQUI/decupagem.sh" >/dev/null 2>&1 ) &
p2=$!
wait $p1 $p2
sobrou="$(ls "$PROJ/_build"/.*.tmp 2>/dev/null | wc -l | tr -d ' ')"
aval "concurrent scripts leave no orphan temp file" "$sobrou" "0"
if [ -s "$PROJ/DECUPAGEM.md" ] && grep -q '^| [0-9]' "$PROJ/DECUPAGEM.md"; then
  passou "breakdown survives roteiro.sh running alongside"
else
  falha "breakdown survives roteiro.sh running alongside" "truncated table: temp file collided"
fi

# ---------------------------------------------------------------- 12. SOURCE
# The pipeline must never write to the client's media folder.
antes="$(ls -la "$SANDBOX/src" | md5_de)"
edl 'horiz.mp4\t0\t1\n'
roda bash "$AQUI/build.sh"
depois="$(ls -la "$SANDBOX/src" | md5_de)"
aval "source folder untouched" "$depois" "$antes"

# ---------------------------------------------------------------- result
echo
if [ "$FALHOU" = 0 ]; then
  printf '\033[32m== GATE OPEN\033[0m  %d/%d\n' "$OK" "$((OK+FALHOU))"
  exit 0
else
  printf '\033[31m== GATE CLOSED\033[0m  %d/%d passed%b\n' "$OK" "$((OK+FALHOU))" "$FALHAS"
  echo
  echo "Do not assemble a client video with the gate closed: these failures are silent."
  exit 1
fi
