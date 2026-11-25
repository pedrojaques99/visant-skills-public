"""Render one take through the Visant Labs MCP over raw JSON-RPC (no client idle timeout).

Why: through Claude Code's MCP client, Kling pro often passes the 300 s idle limit and the
result is lost; the server then rejects the same prompt as "Duplicate request" for minutes.

Usage:
  python -I render.py <args.json> <out.mp4|out.png> [--tool video-generate] [--tries 6] [--log takes.jsonl]

args.json = the tool's arguments (same schema as the MCP tool). On "Duplicate request" or
"fetch failed" it waits 90 s and retries, bumping the seed from the 3rd try on so the request
no longer matches the stuck one. On success it downloads the media to <out>, appends a line to
the takes log and, for video, writes <out>_sheet.png (6 frames side by side).
Auth: Authorization header of mcpServers.visant in ~/.claude.json (VISANT_TOKEN env overrides).
"""
import argparse, json, os, random, subprocess, sys, time, urllib.request

URL = "https://api.visantlabs.com/api/mcp"
RETRYABLE = ("Duplicate request", "fetch failed", "timeout", "ECONNRESET", "503", "502")


def auth_header():
    if os.environ.get("VISANT_TOKEN"):
        return "Bearer " + os.environ["VISANT_TOKEN"]
    cfg = json.load(open(os.path.expanduser("~/.claude.json"), encoding="utf-8"))
    for srv in [cfg.get("mcpServers", {})] + [p.get("mcpServers", {}) for p in cfg.get("projects", {}).values()]:
        h = srv.get("visant", {}).get("headers", {}).get("Authorization")
        if h:
            return h
    sys.exit("no Visant auth: set VISANT_TOKEN or add headers.Authorization to mcpServers.visant")


def post(body, headers, sid=None, timeout=60):
    h = dict(headers)
    if sid:
        h["Mcp-Session-Id"] = sid
    req = urllib.request.Request(URL, json.dumps(body).encode(), h)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.headers.get("mcp-session-id"), r.read().decode("utf-8")


def call(tool, args, headers):
    sid, _ = post({"jsonrpc": "2.0", "method": "initialize", "id": 1,
                   "params": {"protocolVersion": "2025-11-25", "capabilities": {},
                              "clientInfo": {"name": "visant-ai-video", "version": "1.0"}}}, headers)
    post({"jsonrpc": "2.0", "method": "notifications/initialized"}, headers, sid)
    _, raw = post({"jsonrpc": "2.0", "method": "tools/call", "id": 2,
                   "params": {"name": tool, "arguments": args}}, headers, sid, timeout=1800)
    text = json.loads(raw)["result"]["content"][0]["text"]
    try:
        return json.loads(text)
    except ValueError:
        return {"error": {"message": text}}


def sheet(video, out_png):
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video],
                               capture_output=True, text=True).stdout or 5)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", video, "-vf",
                    f"fps=6/{dur:.3f},scale=270:-1,tile=6x1", "-frames:v", "1", out_png], check=False)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("args_json"); ap.add_argument("out")
    ap.add_argument("--tool", default="video-generate")
    ap.add_argument("--tries", type=int, default=6)
    ap.add_argument("--log", default=None, help="takes log (default: takes.jsonl next to out)")
    a = ap.parse_args()

    args = json.load(open(a.args_json, encoding="utf-8"))
    headers = {"Authorization": auth_header(), "Content-Type": "application/json", "Accept": "application/json"}
    res = {}
    for i in range(1, a.tries + 1):
        try:
            res = call(a.tool, args, headers)
        except Exception as e:  # network-level failure
            res = {"error": {"message": f"{type(e).__name__}: {e}"}}
        if "error" not in res:
            break
        msg = res["error"].get("message", "")
        print(f"try {i}: {msg[:160]}", flush=True)
        if not any(k in msg for k in RETRYABLE) or i == a.tries:
            sys.exit(f"FAILED: {msg}")
        if i >= 2:
            args["seed"] = random.randint(1, 2**31 - 1)
        time.sleep(90)

    url = res.get("videoUrl") or res.get("imageUrl") or res.get("url")
    if not url:
        sys.exit("FAILED: no media url in " + json.dumps(res)[:400])
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    urllib.request.urlretrieve(url, a.out)
    if a.tool == "video-generate":
        sheet(a.out, os.path.splitext(a.out)[0] + "_sheet.png")

    log = a.log or os.path.join(os.path.dirname(os.path.abspath(a.out)), "takes.jsonl")
    entry = {"t": time.strftime("%Y-%m-%dT%H:%M:%S"), "tool": a.tool, "out": os.path.basename(a.out), "url": url,
             "seed": res.get("seed", args.get("seed")), "model": res.get("modelUsed") or res.get("model"),
             "mode": args.get("klingMode"), "args": args}
    with open(log, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    print(json.dumps({"ok": True, "out": a.out, "url": url, "seed": entry["seed"]}))


if __name__ == "__main__":
    main()
