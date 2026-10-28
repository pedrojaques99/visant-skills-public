"""Cut plan (json) -> FCP7 XML that Premiere imports frame-exact, plus the checker.

    python premiere_xml.py <plan.json> [...]             writes <plan>.xml next to it (or --out DIR)
    python premiere_xml.py --motion <plan.json>          Scale/Position table to apply through the MCP
    python premiere_xml.py --check <plan.json> <readback.json>
                                                         checks a saved get_full_sequence_info against the plan
    python premiere_xml.py --names <readback.json>       maps the effect/property names in a saved MCP
                                                         readback (get_effect_properties) to the ones to use
    python premiere_xml.py --self-test                   old-key plan and new-key plan give the same XML;
                                                         EN and PT-BR readbacks resolve to the same names

Plan format:
  sequence: {name, w, h[, fps]}   fps: here or at the root
  cuts[]:   type "clip" (default) -> file, src_in_f, src_out_f
            type "still"          -> file (png), duration_s
            optional motion       -> {scale %, position [x, y] px}
  optional markers[]: {s, type "shot"|"speech", text}  (s on the json clock)

Old Portuguese keys and flags still work (plans from older generators):
  sequencia/nome, cortes/tipo/arquivo/fonte_in_f/fonte_out_f/duracao_s,
  marcadores/tipo "plano"|"fala"/texto, --saida (= --out), --conferir (= --check).

Why XML and not cut by cut through the MCP: Premiere rounds in/out in seconds
down (9.2083 x 24 = 220.999 -> frame 220) and a PNG subclip ignores the
duration. In XML everything is a whole frame. Motion does NOT go in the XML
(untested): it is applied afterwards through the MCP with the --motion table.

Locale: the XML carries no effect or property names (only clips, files, format
and markers), so it imports the same into any Premiere UI language. The MCP
calls (set_effect_property, add_keyframe) take the UI display names, which
change with the language: PREMIERE_NAMES below maps them. Another UI language
= one more column there.
"""

from __future__ import annotations

import io
import json
import os
import subprocess
import sys
import tempfile
import unicodedata
import urllib.parse

import opentimelineio as otio

# Old (Portuguese) plan keys and values -> current ones. Applied on read, so an
# old plan and a new plan go through exactly the same code.
OLD_KEYS = {"sequencia": "sequence", "nome": "name", "cortes": "cuts", "tipo": "type",
            "arquivo": "file", "fonte_in_f": "src_in_f", "fonte_out_f": "src_out_f",
            "duracao_s": "duration_s", "marcadores": "markers", "texto": "text"}
OLD_MARKER_TYPES = {"plano": "shot", "fala": "speech"}
OLD_FLAGS = {"--saida": "--out", "--conferir": "--check"}

# Premiere display names per UI language, keyed by a canonical name. "fcp7" is the
# FCP7 XML effectid/parameterid (locale-independent; None when not used here).
# The Opacity effect and its property share the name in both languages.
# To support another UI language: add its column and run --self-test.
# Measured on a live PT-BR Premiere: Movimento, Posição, Escala, Ponto de
# ancoragem. Not yet checked on a live install: the PT names for rotation,
# opacity, level and both transitions. Before trusting a row, save a
# get_effect_properties readback and run `--names <readback.json>`: it prints
# the names that Premiere actually uses.
PREMIERE_NAMES = {
    "motion":         {"fcp7": "basic",          "en": "Motion",         "pt": "Movimento"},
    "position":       {"fcp7": "center",         "en": "Position",       "pt": "Posição"},
    "scale":          {"fcp7": "scale",          "en": "Scale",          "pt": "Escala"},
    "rotation":       {"fcp7": "rotation",       "en": "Rotation",       "pt": "Rotação"},
    "anchor_point":   {"fcp7": "centerOffset",   "en": "Anchor Point",   "pt": "Ponto de ancoragem"},
    "opacity":        {"fcp7": "opacity",        "en": "Opacity",        "pt": "Opacidade"},
    "volume":         {"fcp7": "audiolevels",    "en": "Volume",         "pt": "Volume"},
    "level":          {"fcp7": "level",          "en": "Level",          "pt": "Nível"},
    "cross_dissolve": {"fcp7": "Cross Dissolve", "en": "Cross Dissolve", "pt": "Dissolução cruzada"},
    "dip_to_black":   {"fcp7": None,             "en": "Dip to Black",   "pt": "Mergulhar no preto"},
}
UI_LANGS = ("en", "pt")


def _norm(name) -> str:
    return unicodedata.normalize("NFC", str(name)).strip().casefold()


def resolve(name: str) -> str | None:
    """Display name in any mapped UI language (or FCP7 id) -> canonical name."""
    for key, row in PREMIERE_NAMES.items():
        if _norm(name) in {_norm(v) for v in row.values() if v}:
            return key
    return None


def names_in(readback) -> dict:
    """Walks the string VALUES of a saved MCP readback (any shape; JSON keys like
    "scale" are ignored) and returns {canonical: name as this Premiere wrote it}
    plus "locale" (a UI_LANGS entry, or "?" when nothing language-specific showed up)."""
    found, langs = {}, set()

    def walk(o):
        if isinstance(o, dict):
            o = list(o.values())
        if isinstance(o, list):
            for v in o:
                walk(v)
        elif isinstance(o, str) and (key := resolve(o)):
            found.setdefault(key, o.strip())
            row = PREMIERE_NAMES[key]
            # a name counts for a language only when the other languages spell it differently
            hits = [lang for lang in UI_LANGS if _norm(row[lang]) == _norm(o)]
            if len(hits) == 1:
                langs.add(hits[0])

    walk(readback)
    found["locale"] = langs.pop() if len(langs) == 1 else "?"
    return found


def _rename(o: dict) -> dict:
    # an old key is dropped when its new name is also present: the new one wins
    return {OLD_KEYS.get(k, k): v for k, v in o.items() if k not in OLD_KEYS or OLD_KEYS[k] not in o}


def normalize(d: dict) -> dict:
    d = _rename(d)
    if isinstance(d.get("sequence"), dict):
        d["sequence"] = _rename(d["sequence"])
    d["cuts"] = [_rename(c) for c in d.get("cuts", [])]
    d["markers"] = [dict(m, type=OLD_MARKER_TYPES.get(m.get("type"), m.get("type")))
                    for m in (_rename(m) for m in d.get("markers", []))]
    return d


def load(plan: str) -> dict:
    return normalize(json.load(io.open(plan, encoding="utf-8")))


def fps_of(d: dict) -> float:
    return float(d.get("fps") or d["sequence"]["fps"])


def premiere_url(path: str) -> str:
    # file:///Z:/ is read by Premiere as \\\Z:\ -> offline media and a modal window
    # that locks the MCP. This is the format Premiere itself exports:
    #   Windows  Z:/x/a.mov     -> file://localhost/Z%3A/x/a.mov
    #   macOS    /Users/x/a.mov -> file://localhost/Users/x/a.mov (no double slash)
    p = path.replace("\\", "/")
    if p.startswith("/") and not p.startswith("//"):
        p = p[1:]
    return "file://localhost/" + urllib.parse.quote(p, safe="/")


def file_frames(path: str, fps: float) -> int:
    s = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "default=nw=1:nk=1", path], capture_output=True, text=True).stdout
    return int(float(s) * fps)


def time_range(start: int, dur: int, fps: float) -> otio.opentime.TimeRange:
    return otio.opentime.TimeRange(otio.opentime.RationalTime(start, fps),
                                   otio.opentime.RationalTime(dur, fps))


def prefix(plan: str) -> str:
    name = os.path.basename(plan).split(".premiere")[0].split(".json")[0]
    return name.replace("lesson-", "").replace("aula-", "")


def start_dur(c: dict, fps: float) -> tuple[int, int]:
    if c.get("type", "clip") == "clip":
        return c["src_in_f"], c["src_out_f"] - c["src_in_f"]
    return 0, round(c["duration_s"] * fps)


def cut_name(pre: str, c: dict) -> str:
    return f"{pre}-{c['n']:02d} {c.get('type', 'clip')}"


def build(plan: str, out: str | None = None) -> str:
    d = load(plan)
    fps = fps_of(d)
    seq = d["sequence"]
    pre = prefix(plan)
    tl = otio.schema.Timeline(name=seq["name"], global_start_time=otio.opentime.RationalTime(0, fps))
    # without <format> Premiere opens 720x480 NTSC and the screen ends up at 90.9% width
    tl.metadata["fcp_xml"] = {"media": {"video": {"format": {"samplecharacteristics": {
        "rate": {"timebase": round(fps), "ntsc": "FALSE"},
        "width": seq["w"], "height": seq["h"],
        "anamorphic": "FALSE", "pixelaspectratio": "square", "fielddominance": "none"}}}}}
    v1 = otio.schema.Track(name="V1", kind=otio.schema.TrackKind.Video)
    tl.tracks.append(v1)

    refs, starts, t = {}, [], 0
    for c in d["cuts"]:
        path = c["file"]
        start, dur = start_dur(c, fps)
        if path not in refs:
            total = file_frames(path, fps) if c.get("type", "clip") == "clip" else dur
            refs[path] = otio.schema.ExternalReference(target_url=premiere_url(path),
                                                       available_range=time_range(0, total, fps))
        v1.append(otio.schema.Clip(name=cut_name(pre, c), media_reference=refs[path],
                                   source_range=time_range(start, dur, fps)))
        starts.append((c.get("timeline_in_s", t / fps), t, dur))
        t += dur

    # the json marks in fractional seconds; the timeline is in whole frames. Each
    # marker goes back to the cut it fell in. Premiere sometimes drops one of two
    # markers on the same frame: the shot marker stays, the speech one moves +1 frame.
    taken = set()
    for m in sorted(d["markers"], key=lambda m: (m["s"], m["type"] != "shot")):
        j = max(i for i, (s, _, _) in enumerate(starts) if s <= m["s"] + 1e-6)
        s_json, q, dur = starts[j]
        q = min(q + round((m["s"] - s_json) * fps), q + dur - 1, t - 1)
        while q in taken:
            q += 1
        taken.add(q)
        shot = m["type"] == "shot"
        tl.tracks.markers.append(otio.schema.Marker(
            name=m["text"] if shot else "speech", marked_range=time_range(q, 0, fps),
            metadata={"fcp_xml": {"comment": "" if shot else m["text"]}}))

    base = os.path.basename(plan).replace(".premiere.json", "").replace(".json", "")
    dst = os.path.join(out or os.path.dirname(os.path.abspath(plan)), base + ".xml")
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    otio.adapters.write_to_file(tl, dst, adapter_name="fcp_xml")
    print(f"{base}: {len(d['cuts'])} cuts, {t} frames ({t / fps:.3f}s"
          + (f", json {d['duration_s']}s" if "duration_s" in d else "")
          + f"), {len(d['markers'])} markers -> {dst}")
    return dst


def motion_table(plan: str, quiet: bool = False) -> list:
    """One row per cut with a punch-in: cut name, Scale, normalized Position.
    Apply with set_effect_property on Motion > Scale / Position (names per UI
    language: PREMIERE_NAMES, or --names on a readback); Position is [x/w, y/h],
    not pixels."""
    d = load(plan)
    w, h = d["sequence"]["w"], d["sequence"]["h"]
    pre = prefix(plan)
    rows = []
    for c in d["cuts"]:
        m = c.get("motion")
        if not m or (m["scale"] == 100 and m["position"] == [w / 2, h / 2]):
            continue
        x, y = m["position"]
        rows.append({"cut": cut_name(pre, c), "scale": m["scale"],
                     "position": [round(x / w, 6), round(y / h, 6)]})
    if not quiet:
        print(json.dumps(rows, ensure_ascii=False))
    return rows


def check(plan: str, readback: str) -> bool:
    d = load(plan)
    fps = fps_of(d)
    r = json.load(io.open(readback, encoding="utf-8"))
    s = r.get("data", r)
    q = lambda x: round(x * fps, 3)
    errors = []
    clips = s["videoTracks"][0]["clips"]
    if len(clips) != len(d["cuts"]):
        errors.append(f"{len(clips)} clips on V1, plan has {len(d['cuts'])}")
    t = 0
    for c, cl in zip(d["cuts"], clips):
        start, dur = start_dur(c, fps)
        if c.get("type", "clip") == "still":  # Premiere stores a still with in at 3600 s
            start = q(cl["inPointSeconds"])
        got = (q(cl["startSeconds"]), q(cl["inPointSeconds"]), q(cl["durationSeconds"]))
        if got != (t, start, dur):
            errors.append(f"cut {c['n']}: timeline/in/dur {got}, expected {(t, start, dur)}")
        t += dur
    if q(s["durationSeconds"]) != t:
        errors.append(f"duration {q(s['durationSeconds'])} frames, expected {t}")
    if (s["width"], s["height"]) != (d["sequence"]["w"], d["sequence"]["h"]):
        errors.append(f"frame size {s['width']}x{s['height']}")
    if any(v["clips"] for v in s["videoTracks"][1:]):
        errors.append("there is a clip outside V1")
    n_m = len(d["markers"])
    if s.get("markerCount", 0) != n_m:
        errors.append(f"{s.get('markerCount', 0)} markers, plan has {n_m}")
    print(f"{len(clips)} cuts, {t} frames ({t / fps:.3f}s), {s.get('markerCount', 0)} markers -> "
          + ("OK" if not errors else "FAILED"))
    for e in errors:
        print("   ", e)
    return not errors


def self_test() -> bool:
    """An old-key plan and the same plan with new keys must give byte-identical XML
    and the same motion table. No media needed: the clip length probe is stubbed."""
    global file_frames
    new = {"fps": 24, "duration_s": 6.5,
           "sequence": {"name": "Lesson 1", "w": 1920, "h": 1080},
           "cuts": [{"n": 1, "type": "clip", "file": "Z:/media/a.mov", "src_in_f": 24, "src_out_f": 96,
                     "motion": {"scale": 120, "position": [1000, 500]}},
                    {"n": 2, "type": "still", "file": "Z:/media/card.png", "duration_s": 2},
                    {"n": 3, "file": "Z:/media/a.mov", "src_in_f": 200, "src_out_f": 236}],
           "markers": [{"s": 0.5, "type": "shot", "text": "opening"},
                       {"s": 0.5, "type": "speech", "text": "hello there"},
                       {"s": 4.0, "type": "speech", "text": "card"}]}
    old = {"fps": 24, "duracao_s": 6.5,
           "sequencia": {"nome": "Lesson 1", "w": 1920, "h": 1080},
           "cortes": [{"n": 1, "tipo": "clip", "arquivo": "Z:/media/a.mov", "fonte_in_f": 24, "fonte_out_f": 96,
                       "motion": {"scale": 120, "position": [1000, 500]}},
                      {"n": 2, "tipo": "still", "arquivo": "Z:/media/card.png", "duracao_s": 2},
                      {"n": 3, "arquivo": "Z:/media/a.mov", "fonte_in_f": 200, "fonte_out_f": 236}],
           "marcadores": [{"s": 0.5, "tipo": "plano", "texto": "opening"},
                          {"s": 0.5, "tipo": "fala", "texto": "hello there"},
                          {"s": 4.0, "tipo": "fala", "texto": "card"}]}
    real, file_frames = file_frames, (lambda path, fps: 2400)
    try:
        with tempfile.TemporaryDirectory() as tmp:
            xml, mot = [], []
            for tag, plan in (("new", new), ("old", old)):
                os.makedirs(os.path.join(tmp, tag))
                p = os.path.join(tmp, tag, "lesson-1.premiere.json")
                with io.open(p, "w", encoding="utf-8") as fh:
                    fh.write(json.dumps(plan))
                with io.open(build(p), encoding="utf-8") as fh:
                    xml.append(fh.read())
                mot.append(motion_table(p, quiet=True))
    finally:
        file_frames = real
    # the same get_effect_properties readback from an English and a PT-BR Premiere
    def readback(lang):
        n = {k: row[lang] for k, row in PREMIERE_NAMES.items()}
        return {"data": {"effects": [
            {"displayName": n["opacity"], "properties": [{"displayName": n["opacity"], "value": 100}]},
            {"displayName": n["motion"], "properties": [
                {"displayName": n["position"], "value": [0.5, 0.5]}, {"displayName": n["scale"], "value": 100},
                {"displayName": n["anchor_point"], "value": [0.5, 0.5]}, {"displayName": n["rotation"], "value": 0}]},
            {"displayName": n["volume"], "properties": [{"displayName": n["level"], "value": 0}]}],
            "transitions": [n["cross_dissolve"], n["dip_to_black"]]}}
    en, pt = names_in(readback("en")), names_in(readback("pt"))
    cases = [("old-key plan and new-key plan give the same XML", xml[0] == xml[1]),
             ("old-key plan and new-key plan give the same motion table", mot[0] == mot[1]),
             ("speech marker is named 'speech' in the XML", ">speech<" in xml[0] and ">fala<" not in xml[0]),
             ("motion table uses cut/scale/position",
              bool(mot[0]) and set(mot[0][0]) == {"cut", "scale", "position"}),
             ("EN and PT-BR readbacks resolve to the same effect/property names",
              set(en) == set(pt) == set(PREMIERE_NAMES) | {"locale"}
              and (en["locale"], pt["locale"]) == ("en", "pt")
              and (en["scale"], pt["scale"], en["position"], pt["position"])
              == ("Scale", "Escala", "Position", "Posição")),
             ("EN name, PT-BR name and FCP7 id map to one canonical name",
              resolve("Motion") == resolve("movimento") == resolve("basic") == "motion"
              and resolve("Nível") == resolve("Level") == "level"
              and resolve("Dissolução cruzada") == resolve("Cross Dissolve") == "cross_dissolve"
              and resolve("Mergulhar no preto") == resolve("Dip to Black") == "dip_to_black"
              and resolve("Lumetri Color") is None),
             ("the XML carries no effect or property name (locale-independent)",
              "<effect>" not in xml[0] and "<filter>" not in xml[0])]
    for name, ok in cases:
        print(("  OK    " if ok else "  FAIL  ") + name)
    return all(ok for _, ok in cases)


if __name__ == "__main__":
    a = [OLD_FLAGS.get(x, x) for x in sys.argv[1:]]
    if not a:
        sys.exit(__doc__)
    if a[0] == "--self-test":
        sys.exit(0 if self_test() else 1)
    if a[0] == "--check":
        sys.exit(0 if check(a[1], a[2]) else 1)
    if a[0] == "--names":
        sys.stdout.reconfigure(encoding="utf-8")
        print(json.dumps(names_in(json.load(io.open(a[1], encoding="utf-8"))), ensure_ascii=False))
        sys.exit(0)
    if a[0] == "--motion":
        motion_table(a[1])
        sys.exit(0)
    out = None
    if "--out" in a:
        i = a.index("--out")
        out = a[i + 1]
        del a[i:i + 2]
    for p in a:
        build(p, out)
