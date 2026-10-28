"""Cut plan (json) -> FCP7 XML that Premiere imports frame-exact, plus the checker.

    python premiere_xml.py <plan.json> [...]             writes <plan>.xml next to it (or --saida DIR)
    python premiere_xml.py --motion <plan.json>          Scale/Position table to apply through the MCP
    python premiere_xml.py --conferir <plan.json> <readback.json>
                                                         checks a saved get_full_sequence_info against the plan

Plan format (same as aula_tela.py and premiere_plano.py; keys stay as they are):
  sequencia: {nome, w, h[, fps]}   fps: here or at the root
  cortes[]:  tipo "clip" (default) -> arquivo, fonte_in_f, fonte_out_f
             tipo "still"          -> arquivo (png), duracao_s
             optional motion       -> {scale %, position [x, y] px}
  optional marcadores[]: {s, tipo "plano"|"fala", texto}  (s on the json clock)

Why XML and not cut by cut through the MCP: Premiere rounds in/out in seconds
down (9.2083 x 24 = 220.999 -> frame 220) and a PNG subclip ignores the
duration. In XML everything is a whole frame. Motion does NOT go in the XML
(untested): it is applied afterwards through the MCP with the --motion table.
"""

from __future__ import annotations

import io
import json
import os
import subprocess
import sys
import urllib.parse

import opentimelineio as otio


def ler(plano: str) -> dict:
    return json.load(io.open(plano, encoding="utf-8"))


def fps_de(d: dict) -> float:
    return float(d.get("fps") or d["sequencia"]["fps"])


def url_premiere(arq: str) -> str:
    # file:///Z:/ is read by Premiere as \\\Z:\ -> offline media and a modal window
    # that locks the MCP. This is the format Premiere itself exports:
    #   Windows  Z:/x/a.mov     -> file://localhost/Z%3A/x/a.mov
    #   macOS    /Users/x/a.mov -> file://localhost/Users/x/a.mov (no double slash)
    p = arq.replace("\\", "/")
    if p.startswith("/") and not p.startswith("//"):
        p = p[1:]
    return "file://localhost/" + urllib.parse.quote(p, safe="/")


def quadros_do_arquivo(arq: str, fps: float) -> int:
    s = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "default=nw=1:nk=1", arq], capture_output=True, text=True).stdout
    return int(float(s) * fps)


def faixa(ini: int, dur: int, fps: float) -> otio.opentime.TimeRange:
    return otio.opentime.TimeRange(otio.opentime.RationalTime(ini, fps),
                                   otio.opentime.RationalTime(dur, fps))


def prefixo(plano: str) -> str:
    return os.path.basename(plano).split(".premiere")[0].split(".json")[0].replace("aula-", "")


def ini_dur(c: dict, fps: float) -> tuple[int, int]:
    if c.get("tipo", "clip") == "clip":
        return c["fonte_in_f"], c["fonte_out_f"] - c["fonte_in_f"]
    return 0, round(c["duracao_s"] * fps)


def nome_corte(pre: str, c: dict) -> str:
    return f"{pre}-{c['n']:02d} {c.get('tipo', 'clip')}"


def montar(plano: str, saida: str | None = None) -> str:
    d = ler(plano)
    fps = fps_de(d)
    seq = d["sequencia"]
    pre = prefixo(plano)
    tl = otio.schema.Timeline(name=seq["nome"], global_start_time=otio.opentime.RationalTime(0, fps))
    # without <format> Premiere opens 720x480 NTSC and the screen ends up at 90.9% width
    tl.metadata["fcp_xml"] = {"media": {"video": {"format": {"samplecharacteristics": {
        "rate": {"timebase": round(fps), "ntsc": "FALSE"},
        "width": seq["w"], "height": seq["h"],
        "anamorphic": "FALSE", "pixelaspectratio": "square", "fielddominance": "none"}}}}}
    v1 = otio.schema.Track(name="V1", kind=otio.schema.TrackKind.Video)
    tl.tracks.append(v1)

    refs, inicio, t = {}, [], 0
    for c in d["cortes"]:
        arq = c["arquivo"]
        ini, dur = ini_dur(c, fps)
        if arq not in refs:
            total = quadros_do_arquivo(arq, fps) if c.get("tipo", "clip") == "clip" else dur
            refs[arq] = otio.schema.ExternalReference(target_url=url_premiere(arq),
                                                      available_range=faixa(0, total, fps))
        v1.append(otio.schema.Clip(name=nome_corte(pre, c), media_reference=refs[arq],
                                   source_range=faixa(ini, dur, fps)))
        inicio.append((c.get("timeline_in_s", t / fps), t, dur))
        t += dur

    # the json marks in fractional seconds; the timeline is in whole frames. Each
    # marker goes back to the cut it fell in. Premiere sometimes drops one of two
    # markers on the same frame: the shot marker stays, the speech one moves +1 frame.
    ocupado = set()
    for m in sorted(d.get("marcadores", []), key=lambda m: (m["s"], m["tipo"] != "plano")):
        j = max(i for i, (s, _, _) in enumerate(inicio) if s <= m["s"] + 1e-6)
        s_json, q, dur = inicio[j]
        q = min(q + round((m["s"] - s_json) * fps), q + dur - 1, t - 1)
        while q in ocupado:
            q += 1
        ocupado.add(q)
        plano_ = m["tipo"] == "plano"
        tl.tracks.markers.append(otio.schema.Marker(
            name=m["texto"] if plano_ else "fala", marked_range=faixa(q, 0, fps),
            metadata={"fcp_xml": {"comment": "" if plano_ else m["texto"]}}))

    base = os.path.basename(plano).replace(".premiere.json", "").replace(".json", "")
    dst = os.path.join(saida or os.path.dirname(os.path.abspath(plano)), base + ".xml")
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    otio.adapters.write_to_file(tl, dst, adapter_name="fcp_xml")
    print(f"{base}: {len(d['cortes'])} cuts, {t} frames ({t / fps:.3f}s"
          + (f", json {d['duracao_s']}s" if "duracao_s" in d else "")
          + f"), {len(d.get('marcadores', []))} markers -> {dst}")
    return dst


def tabela_motion(plano: str):
    """One row per cut with a punch-in: name, Scale, normalized Position.
    In PT-BR Premiere: effect "Movimento", properties "Escala" and "Posicao";
    Position is [x/w, y/h], not pixels. Output keys stay corte/escala/posicao."""
    d = ler(plano)
    w, h = d["sequencia"]["w"], d["sequencia"]["h"]
    pre = prefixo(plano)
    linhas = []
    for c in d["cortes"]:
        m = c.get("motion")
        if not m or (m["scale"] == 100 and m["position"] == [w / 2, h / 2]):
            continue
        x, y = m["position"]
        linhas.append({"corte": nome_corte(pre, c), "escala": m["scale"],
                       "posicao": [round(x / w, 6), round(y / h, 6)]})
    print(json.dumps(linhas, ensure_ascii=False))
    return linhas


def conferir(plano: str, leitura: str) -> bool:
    d = ler(plano)
    fps = fps_de(d)
    r = json.load(io.open(leitura, encoding="utf-8"))
    s = r.get("data", r)
    q = lambda x: round(x * fps, 3)
    erros = []
    clips = s["videoTracks"][0]["clips"]
    if len(clips) != len(d["cortes"]):
        erros.append(f"{len(clips)} clips on V1, plan has {len(d['cortes'])}")
    t = 0
    for c, cl in zip(d["cortes"], clips):
        ini, dur = ini_dur(c, fps)
        if c.get("tipo", "clip") == "still":  # Premiere stores a still with in at 3600 s
            ini = q(cl["inPointSeconds"])
        got = (q(cl["startSeconds"]), q(cl["inPointSeconds"]), q(cl["durationSeconds"]))
        if got != (t, ini, dur):
            erros.append(f"cut {c['n']}: timeline/in/dur {got}, expected {(t, ini, dur)}")
        t += dur
    if q(s["durationSeconds"]) != t:
        erros.append(f"duration {q(s['durationSeconds'])} frames, expected {t}")
    if (s["width"], s["height"]) != (d["sequencia"]["w"], d["sequencia"]["h"]):
        erros.append(f"frame size {s['width']}x{s['height']}")
    if any(v["clips"] for v in s["videoTracks"][1:]):
        erros.append("there is a clip outside V1")
    n_m = len(d.get("marcadores", []))
    if s.get("markerCount", 0) != n_m:
        erros.append(f"{s.get('markerCount', 0)} markers, plan has {n_m}")
    print(f"{len(clips)} cuts, {t} frames ({t / fps:.3f}s), {s.get('markerCount', 0)} markers -> "
          + ("OK" if not erros else "FAILED"))
    for e in erros:
        print("   ", e)
    return not erros


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a:
        sys.exit(__doc__)
    if a[0] == "--conferir":
        sys.exit(0 if conferir(a[1], a[2]) else 1)
    if a[0] == "--motion":
        tabela_motion(a[1])
        sys.exit(0)
    saida = None
    if "--saida" in a:
        i = a.index("--saida")
        saida = a[i + 1]
        del a[i:i + 2]
    for p in a:
        montar(p, saida)
