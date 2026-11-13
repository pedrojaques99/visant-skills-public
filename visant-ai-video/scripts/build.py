"""Assemble a spot from a manifest (spot.json): scenes with crossfades, on-screen text,
end card with logo, music bed, two-pass loudnorm, contact sheet.

Usage: python -I build.py <spot.json> [--open]
Every version is its own small manifest (spot_v4.json, spot_v5.json): swapping a scene is a
one-line change, never a copied script. Paths in the manifest are relative to the manifest.
See assets/spot.example.json for every field.
"""
import json, os, shutil, subprocess, sys, tempfile


def run(cmd, **kw):
    return subprocess.run(cmd, check=True, capture_output=True, text=True, **kw)


def probe_dur(f):
    return float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).stdout)


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    man_path = os.path.abspath(sys.argv[1])
    root = os.path.dirname(man_path)
    m = json.load(open(man_path, encoding="utf-8"))
    P = lambda p: p if os.path.isabs(p) else os.path.join(root, p)

    W, H = m.get("size", [1080, 1920]); fps = m.get("fps", 24); xf = m.get("xfade", 0.5)
    scenes = [P(s["file"]) for s in m["scenes"]]
    for s in scenes:
        if not os.path.exists(s):
            sys.exit(f"missing scene: {s}")
    durs = [m["scenes"][i].get("dur") or probe_dur(s) for i, s in enumerate(scenes)]
    ec = m.get("endcard"); ec_dur = ec.get("dur", 3.0) if ec else 0; ec_xf = ec.get("xfade", 0.6) if ec else 0

    tmp = tempfile.mkdtemp(prefix="aivideo_")
    shutil.copy(P(m["font"]), os.path.join(tmp, "font.ttf"))   # drawtext hates Windows drive colons
    tid = [0]

    def txt(t):
        tid[0] += 1; name = f"t{tid[0]}.txt"
        open(os.path.join(tmp, name), "w", encoding="utf-8", newline="").write(t["text"])
        s, d, y = t["start"], t["dur"], t["y"]
        alpha = f"min(1,max(0,(t-{s})/0.4))*min(1,max(0,({s}+{d}-t)/0.4))"
        ease = f"30*pow(1-min(1,max(0,(t-{s})/0.5)),3)"
        return (f"drawtext=fontfile=font.ttf:textfile={name}:fontsize={t.get('size', 76)}:"
                f"fontcolor=0x{t.get('color', 'F1F1F1')}:shadowcolor=black@0.55:shadowx=0:shadowy=3:"
                f"x=(w-text_w)/2:y='{y}+{ease}':alpha='{alpha}':enable='between(t,{s},{s + d})'")

    norm = f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={fps},setsar=1,format=yuv420p,settb=1/{fps}"
    fc = [f"[{i}:v]{norm}[c{i}]" for i in range(len(scenes))]
    inputs = sum([["-i", s] for s in scenes], [])
    n = len(scenes)

    if ec:
        shutil.copy(P(ec["logo"]), os.path.join(tmp, "logo.png"))
        inputs += ["-loop", "1", "-framerate", str(fps), "-t", str(ec_dur), "-i", "logo.png"]
        lw = ec.get("logo_w", 760); bar = ec.get("bar_color", "BFFF53")
        parts = [f"[bg][lg]overlay=x=(W-w)/2:y='(H-h)/2-80+60*pow(1-min(1,max(0,(t-0.2)/0.6)),3)':eval=frame",
                 f"drawbox=x={W // 2 - 140}:y={H // 2 + 40}:w='280*(1-pow(1-min(1,max(0,(t-0.7)/0.5)),3))':h=6:color=0x{bar}:t=fill"]
        if ec.get("text"):
            parts.append(txt({"text": ec["text"], "start": 0.9, "dur": ec_dur - 0.9, "y": H // 2 + 80,
                              "size": ec.get("text_size", 54), "color": ec.get("text_color", "F1F1F1")}))
        fc += [f"color=c=0x{ec.get('bg', '001302')}:s={W}x{H}:r={fps}:d={ec_dur},format=yuv420p,settb=1/{fps}[bg]",
               f"[{n}:v]format=rgba,scale={lw}:-1[lg]", ",".join(parts) + "[endc]"]

    # chain crossfades
    last, t_end = "c0", durs[0]
    for i in range(1, n):
        off = t_end - xf
        fc.append(f"[{last}][c{i}]xfade=transition=fade:duration={xf}:offset={off:.3f}[x{i}]")
        last, t_end = f"x{i}", off + durs[i]
    if ec:
        off = t_end - ec_xf
        tail = f"[{last}][endc]xfade=transition=fade:duration={ec_xf}:offset={off:.3f}"
        total = off + ec_dur
    else:
        tail, total = f"[{last}]null", t_end
    over = [txt(t) for t in m.get("texts", [])]
    fc.append(",".join([tail] + over + [f"fade=t=out:st={total - 0.5:.3f}:d=0.5,format=yuv420p[v]"]))

    mu = m.get("music")
    if mu:
        inputs += ["-i", P(mu["file"])]
        a_idx = n + (1 if ec else 0)
        fc.append(f"[{a_idx}:a]atrim=start={mu.get('start', 0)}:duration={total:.3f},asetpts=PTS-STARTPTS,"
                  f"afade=t=in:d=0.3,afade=t=out:st={total - 1.2:.3f}:d=1.2[aud]")
    open(os.path.join(tmp, "fc.txt"), "w", encoding="ascii").write(";\n".join(fc))

    out = P(m["out"]); os.makedirs(os.path.dirname(out), exist_ok=True)
    maps = ["-map", "[v]"] + (["-map", "[aud]", "-c:a", "pcm_s16le"] if mu else [])
    run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex_script", "fc.txt", *maps, "-t", f"{total:.3f}",
         "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "tmp.mov"], cwd=tmp)

    if mu:
        lufs = m.get("loudness", -14)
        meas = run(["ffmpeg", "-hide_banner", "-i", "tmp.mov", "-af", f"loudnorm=I={lufs}:TP=-1:LRA=11:print_format=json",
                    "-f", "null", "-"], cwd=tmp).stderr
        j = json.loads(meas[meas.rindex("{"):meas.rindex("}") + 1])
        ln = (f"loudnorm=I={lufs}:TP=-1:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:"
              f"measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true")
        run(["ffmpeg", "-v", "error", "-y", "-i", "tmp.mov", "-c:v", "copy", "-af", f"{ln},aresample=48000",
             "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out], cwd=tmp)
    else:
        run(["ffmpeg", "-v", "error", "-y", "-i", "tmp.mov", "-c", "copy", "-movflags", "+faststart", out], cwd=tmp)

    # contact sheet: 8 evenly spaced frames
    sheet = os.path.splitext(out)[0] + "_sheet.png"
    run(["ffmpeg", "-v", "error", "-y", "-i", out, "-vf", f"fps=8/{total:.3f},scale=270:-1,tile=8x1", "-frames:v", "1", sheet])
    loud = ""
    if mu:
        e = run(["ffmpeg", "-hide_banner", "-i", out, "-af", "ebur128=peak=true", "-f", "null", "-"]).stderr
        summ = e[e.rfind("Summary:"):].splitlines()
        loud = " | " + " ".join(" ".join(l.split()) for l in summ if l.strip().startswith(("I:", "Peak:")))
    shutil.rmtree(tmp, ignore_errors=True)
    print(f"OK {out} ({total:.2f}s){loud}\nsheet: {sheet}")

    if "--open" in sys.argv and os.name == "nt":
        subprocess.Popen(f'explorer.exe /select,"{out}"')   # string form keeps the quotes intact


if __name__ == "__main__":
    main()
