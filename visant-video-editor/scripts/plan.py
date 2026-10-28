#!/usr/bin/env python3
# Builds the EDL by ARGUMENT (not by date), with a global shot pool and zero
# repetition. It is the component that separates a "chronological log" from a
# narrated essay.
#
# Expects:
#   _build/manifest.tsv     from ingest.sh
#   _build/frames.tsv       from frames.sh   (entry point of each clip)
#   _build/speech_audio/<block>.m4a   processed narration (audio)
#   _build/speech_video/<block>.mp4   same WITH VIDEO, for face moments
#   (older projects used _build/falas4/ and _build/falasv/: still found when the new folder is missing)
#
# Edit list B: (block, preferred b-roll, breather after?).
#
# Three rules that were expensive to learn:
#  1. Ambient BREATHER only between blocks from a different SOURCE. Between parts
#     of the same speech, it sounds like a cut in the middle of a sentence.
#  2. GLOBAL pool with no repetition. Going back to the start of the list when the
#     block's b-roll runs out makes the whole video spin on the same 6 clips.
#  3. A FACE moment comes from the clip in speech_video/ (3 columns). Since video and
#     audio were cut together by auto-editor, lips stay in sync and the narration
#     has no seam. A face with audio processed separately desyncs.
#
# The previous version's bug: when a block's b-roll list ran out, it went back
# to the start (i % len). Result: the same 6 clips for the whole video, while
# 130 files and 342 s of journey footage sat unused.
import os, subprocess, sys

# Project = env PROJ or the current folder (same as the .sh scripts); reads and writes <PROJ>/_build.
# Legacy: if the script was copied into _build/, use its folder.
PROJ = os.environ.get("PROJ") or os.getcwd()
BASE = os.path.join(PROJ, "_build")
if not os.path.exists(os.path.join(BASE, "manifest.tsv")):
    BASE = os.path.dirname(os.path.abspath(__file__))
    PROJ = os.path.dirname(BASE)
MIN_PLANO, MAX_PLANO = 2.5, 4.0      # medium pulse: the shot breathes
# Speech folders: English names, or the old ones if only those exist (older projects).
def _speech_dir(new, old):
    return new if os.path.isdir(os.path.join(BASE, new)) or not os.path.isdir(os.path.join(BASE, old)) else old
AUDIO_DIR = _speech_dir("speech_audio", "falas4")
VIDEO_DIR = _speech_dir("speech_video", "falasv")
# Ambient breather ONLY between blocks from a different source. Between parts of the
# same speech it sounded like a cut mid-sentence; it was the fairest complaint received.

def dur(p):
    out = subprocess.run(["ffprobe","-v","error","-show_entries","format=duration",
                          "-of","csv=p=0",p], capture_output=True, text=True).stdout.strip()
    try: return float(out)
    except: return 0.0

manifest, best = {}, {}
for ln in open(f"{BASE}/manifest.tsv", encoding="utf-8").read().splitlines()[1:]:
    c = ln.split("\t")
    if len(c) > 2: manifest[c[0]] = float(c[2])
for ln in open(f"{BASE}/frames.tsv", encoding="utf-8").read().splitlines()[1:]:
    c = ln.split("\t")
    if len(c) > 1: best[c[0]] = float(c[1])

# ---- shot pool -----------------------------------------------------------
# A journey take becomes MANY shots (it moves, so each stretch is another scene).
PERCURSO = ["IMG_4479.MOV","IMG_4379.MOV","IMG_4508.MOV","IMG_4481.MOV","IMG_4392.MOV"]

def fatia_percurso(f, passo=3.4):
    d = manifest.get(f, 0); out = []
    t = 2.0
    while t + MAX_PLANO < d - 1.0:
        out.append((f, round(t,2), round(t+passo,2)))
        t += passo + 0.6          # skip a bit so two consecutive shots are not the same
    return out

pool_percurso = []
for f in PERCURSO: pool_percurso += fatia_percurso(f)

pool_curto = {}
for f, d in manifest.items():
    if f in PERCURSO or not f.lower().endswith(".mov"): continue
    t = best.get(f, max(0.0, d*0.2))
    if d - t < MIN_PLANO: t = max(0.0, d - MAX_PLANO)
    take = min(MAX_PLANO, d - t)
    if take >= 1.6: pool_curto[f] = (f, round(t,2), round(t+take,2))

usados = set()
def pega(prefs, n):
    """n shots, preferring the files in prefs, never repeating."""
    saida = []
    for f in prefs:
        if len(saida) >= n: break
        if f in pool_curto and f not in usados:
            usados.add(f); saida.append(pool_curto[f]); continue
        # Preference also applies to JOURNEY takes: 4379 is the whole arrival by
        # car, and without this it never went where it belonged (the opening).
        for (pf, a, b) in pool_percurso:
            if len(saida) >= n: break
            if pf != f or (pf, a) in usados: continue
            usados.add((pf, a)); saida.append((pf, a, b))
    for f, a, b in pool_percurso:      # fill with journey shots
        if len(saida) >= n: break
        k = (f, a)
        if k in usados: continue
        usados.add(k); saida.append((f, a, b))
    for f, plano in pool_curto.items(): # last resort: any free clip
        if len(saida) >= n: break
        if f in usados: continue
        usados.add(f); saida.append(plano)
    return saida

def percurso(n=1):
    return pega([], n)

# ---- blocks: voice + where the image comes from -------------------------
B = [
 # (block, preferred b-roll, breather after?)
 # THE ARRIVAL opens the video: car, road, the pavilion appearing
 ("01frio",      ["IMG_4377.MOV","IMG_4378.MOV","IMG_4379.MOV","IMG_4381.MOV"], False),
 # THE SETUP right after: facade sticker, ladder, crane with the banner
 ("02noite",     ["IMG_4290.MOV","IMG_4315.MOV","IMG_4289.MOV","IMG_4316.MOV",
                  "IMG_4322.MOV","IMG_4323.MOV","IMG_4324.MOV"], False),
 # same speech (4521) continues straight: no breather in between
 ("03materiais", ["IMG_4413.MOV","IMG_4415.MOV","IMG_4417.MOV","IMG_4414.MOV",
                  "IMG_4418.MOV","IMG_4491.MOV","IMG_4486.MOV","IMG_4493.MOV",
                  "IMG_4408.MOV","IMG_4409.MOV","IMG_4410.MOV","IMG_4401.MOV",
                  "IMG_4429.MOV","IMG_4484.MOV"], False),
 ("04processo",  ["IMG_4422.MOV","IMG_4427.MOV","IMG_4412.MOV","IMG_4411.MOV"], True),
 ("05marca",     ["IMG_4421.MOV","IMG_4425.MOV","IMG_4480.MOV","IMG_4393.MOV",
                  "IMG_4390.MOV","IMG_4388.MOV","IMG_4420.MOV"], True),
 ("06gigantes",  ["IMG_4383.MOV","IMG_4384.MOV","IMG_4385.MOV","IMG_4382.MOV",
                  "IMG_4392.MOV","IMG_4395.MOV"], True),
 ("07ninguem",   ["IMG_4477.MOV"], True),
 ("08quarenta",  ["IMG_4464.MOV","IMG_4496.MOV","IMG_4498.MOV","IMG_4402.MOV"], True),
 ("09magnitude", ["IMG_4405.MOV","IMG_4426.MOV","IMG_4494.MOV","IMG_4485.MOV"], True),
 ("10real",      ["IMG_4466.MOV","IMG_4505.MOV","IMG_4506.MOV","IMG_4467.MOV",
                  "IMG_4499.MOV","IMG_4462.MOV","IMG_4458.MOV","IMG_4492.MOV"], True),
 ("11fecho",     ["IMG_4503.MOV","IMG_4471.MOV","IMG_4469.MOV","IMG_4470.MOV"], False),
]

# Blocks whose take shows a face. 4521 and 4522 are screen recordings: they stay out.
# The clip in speech_video/ has video AND audio cut together by auto-editor, so using it
# directly (3 columns) keeps the lips in sync. Inserting the face with audio
# processed separately would desync; that is why it could not be done before.
COM_ROSTO = {"05marca","06gigantes","07ninguem","09magnitude","10real"}
ROSTO_CADA = 15.0     # one face moment every ~15s of narration
ROSTO_DUR  = 3.5

linhas = ["# VLOG: no cards, voice leads, journey stitches, no shot repeats"]
for idx, (voz, prefs, respiro) in enumerate(B):
    vp = f"{BASE}/{AUDIO_DIR}/{voz}.m4a"
    if not os.path.exists(vp):
        print(f"  ! missing {voz}", file=sys.stderr); continue
    d = dur(vp)
    # Allocates GREEDILY until the whole speech is covered. Splitting into equal
    # slices truncated the block when a shot had less room than the slice, and
    # what got lost was always the END of the sentence.
    off = 0.0
    planos = pega(prefs, max(1, round(d / 3.2)))
    fila = list(planos)
    # Targets computed FROM THE BLOCK LENGTH: the fixed "every 15s" rule never
    # fired on a short block, and the leftover check killed the last target.
    alvos = []
    if voz in COM_ROSTO:
        t0 = min(10.0, d * 0.35)
        t = t0
        while t <= d - (ROSTO_DUR + 0.5):
            alvos.append(t); t += ROSTO_CADA
    prox_rosto = alvos.pop(0) if alvos else 1e9
    while off < d - 0.05:
        # FACE moment: video and audio come from the speech clip itself, at the same
        # position. A 3-column line = the build uses its audio, and the narration
        # continues seamlessly because it is the same file and the same clock.
        if off >= prox_rosto and d - off >= ROSTO_DUR:
            dur_r = min(ROSTO_DUR, d - off)
            linhas.append(f"_build/{VIDEO_DIR}/{voz}.mp4	{off:.2f}	{off+dur_r:.2f}")
            off += dur_r
            prox_rosto = alvos.pop(0) if alvos else 1e9
            continue
        # Leftover shorter than the minimum shot: stretch the last shot instead of
        # asking for another. Without this the loop discarded shot after shot
        # (cap < 0.8) and drained the whole pool, leaving later blocks with no image.
        if d - off < 0.8 and linhas and linhas[-1].count("	") == 4:
            c = linhas[-1].split("	")
            fim = float(c[2]) + (d - off)
            lim = manifest.get(c[0], fim)
            c[2] = f"{min(fim, lim):.2f}"
            linhas[-1] = "	".join(c)
            off = d
            break
        if not fila:
            fila = pega(prefs, 4)   # refill STILL preferring the block's theme
            if not fila: break
        f, a, b = fila.pop(0)
        cap = min(MAX_PLANO, b - a, d - off)
        if cap < 0.8: continue
        linhas.append(f"{f}\t{a:.2f}\t{a+cap:.2f}\t_build/{AUDIO_DIR}/{voz}.m4a\t{off:.2f}")
        off += cap
    # BREATHER: only when the next speech comes from another source/topic
    if respiro and idx < len(B) - 1:
        for (f, a, b) in percurso(1):
            linhas.append(f"{f}\t{a:.2f}\t{min(b, a+3.0):.2f}")

open(f"{BASE}/edl.txt","w",encoding="utf-8",newline="\n").write("\n".join(linhas)+"\n")
cortes = [l for l in linhas if not l.startswith("#")]
tot = sum(float(l.split("\t")[2]) - float(l.split("\t")[1]) for l in cortes)
arquivos = len(set(l.split("\t")[0] for l in cortes))
print(f"  {len(cortes)} cuts | {arquivos} distinct files | {tot:.1f}s ({tot/60:.1f} min)")
