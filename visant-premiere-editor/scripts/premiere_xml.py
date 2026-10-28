"""Plano de corte (json) -> FCP7 XML que o Premiere importa exato, e o conferidor.

    python premiere_xml.py <plano.json> [...]            escreve <plano>.xml ao lado (ou --saida DIR)
    python premiere_xml.py --motion <plano.json>         tabela Escala/Posicao pra aplicar pelo MCP
    python premiere_xml.py --conferir <plano.json> <leitura.json>
                                                         bate get_full_sequence_info salvo contra o plano

Formato do plano (o mesmo do aula_tela.py e do premiere_plano.py):
  sequencia: {nome, w, h[, fps]}   fps: aqui ou na raiz
  cortes[]:  tipo "clip" (default) -> arquivo, fonte_in_f, fonte_out_f
             tipo "still"          -> arquivo (png), duracao_s
             motion opcional       -> {scale %, position [x, y] px}
  marcadores[] opcional: {s, tipo "plano"|"fala", texto}  (s no relogio do json)

Por que XML e nao corte a corte pelo MCP: o Premiere arredonda in/out em segundos
pra baixo (9.2083 x 24 = 220.999 -> quadro 220) e subclip de PNG ignora a
duracao. No XML tudo e quadro inteiro. Motion NAO vai no XML (nao testado): e
aplicado depois pelo MCP com a tabela do --motion.
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
    # file:///Z:/ o Premiere le como \\\Z:\ -> midia offline e janela modal que
    # trava o MCP. Este e o formato que ele mesmo exporta:
    return "file://localhost/" + urllib.parse.quote(arq.replace("\\", "/"), safe="/")


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
    # sem <format> o Premiere abre 720x480 NTSC e a tela fica com 90,9% de largura
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

    # o json marca em segundos quebrados; a timeline e em quadro inteiro. Cada
    # marcador volta pro corte onde caia. O Premiere as vezes descarta um de dois
    # marcadores no mesmo quadro: o plano fica, a fala vai +1 quadro.
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
    print(f"{base}: {len(d['cortes'])} cortes, {t} quadros ({t / fps:.3f}s"
          + (f", json {d['duracao_s']}s" if "duracao_s" in d else "")
          + f"), {len(d.get('marcadores', []))} marcadores -> {dst}")
    return dst


def tabela_motion(plano: str):
    """Uma linha por corte com punch-in: nome, Escala, Posicao normalizada.
    Em Premiere PT-BR: efeito "Movimento", propriedades "Escala" e "Posicao";
    Posicao e [x/w, y/h], nao pixel."""
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
        erros.append(f"{len(clips)} clipes na V1, plano tem {len(d['cortes'])}")
    t = 0
    for c, cl in zip(d["cortes"], clips):
        ini, dur = ini_dur(c, fps)
        if c.get("tipo", "clip") == "still":  # o Premiere guarda still com in em 3600 s
            ini = q(cl["inPointSeconds"])
        got = (q(cl["startSeconds"]), q(cl["inPointSeconds"]), q(cl["durationSeconds"]))
        if got != (t, ini, dur):
            erros.append(f"corte {c['n']}: timeline/in/dur {got}, esperado {(t, ini, dur)}")
        t += dur
    if q(s["durationSeconds"]) != t:
        erros.append(f"duracao {q(s['durationSeconds'])} quadros, esperado {t}")
    if (s["width"], s["height"]) != (d["sequencia"]["w"], d["sequencia"]["h"]):
        erros.append(f"quadro {s['width']}x{s['height']}")
    if any(v["clips"] for v in s["videoTracks"][1:]):
        erros.append("tem clipe fora da V1")
    n_m = len(d.get("marcadores", []))
    if s.get("markerCount", 0) != n_m:
        erros.append(f"{s.get('markerCount', 0)} marcadores, plano tem {n_m}")
    print(f"{len(clips)} cortes, {t} quadros ({t / fps:.3f}s), {s.get('markerCount', 0)} marcadores -> "
          + ("OK" if not erros else "FALHOU"))
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
