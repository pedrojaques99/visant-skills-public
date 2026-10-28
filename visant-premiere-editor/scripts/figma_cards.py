"""Generates the JS (use_figma, Figma Slides) that creates a batch of notice and logo cards in the lesson deck, in the approved style.

  python figma_cards.py <batch.json> <output.js>

batch.json:
  {"deck": {"background": "55:12", "card": "55:15", "notice": "71:2", "gray": "55:25",
            "slides": {"1.4": "67:3"}},          # existing row -> slide id; otherwise the row is looked up or created
   "notices": [["2.8", "notice 2.8 0:45 · private", "Repository always private"]],
   "logos":   [["2.7", "logo 2.7 · Claude only", [["svg", "claude", "D97757"], ["txt", "→", true], ["txt", "CLAUDE.md", false]]]]}

Old Portuguese keys still work: deck.fundo/aviso/cinza, "avisos", and the icon key "aviso" (= "warning").
Logo item: ["svg", <file in icons/ without .svg>, <hex>] | ["clone", <nodeId>] | ["txt", <text>, <gray?>].
Icons: Simple Icons (CC0), official brand color. A brand not there goes in as text, never an invented logo.
After running the JS: export each card with get_screenshot(contentsOnly) -> PNG -> Premiere (see SKILL.md, "Cards").
A lesson without a slide id goes to the row 'Edit N (do not present)' (an older deck's 'Edição N (não apresentar)'
row is found and reused); a missing row is created as a skipped slide. The card must sit INSIDE the slide,
otherwise the screenshot comes out 1x1.
"""
import json, re, sys
from pathlib import Path

ICONS = Path(__file__).with_name("icons")
OLD_DECK_KEYS = {"fundo": "background", "aviso": "notice", "cinza": "gray"}
OLD_ICONS = {"aviso": "warning"}


def svg_path(key):
    return " ".join(re.findall(r'\sd="([^"]+)"', (ICONS / f"{key}.svg").read_text(encoding="utf-8")))


def normalize(batch):
    deck = {OLD_DECK_KEYS.get(k, k): v for k, v in batch["deck"].items()
            if k not in OLD_DECK_KEYS or OLD_DECK_KEYS[k] not in batch["deck"]}
    notices = batch.get("notices", batch.get("avisos", []))
    logos = [[lesson, name, [[it[0], OLD_ICONS.get(it[1], it[1]), *it[2:]] if it[0] == "svg" else it for it in items]]
             for lesson, name, items in batch.get("logos", [])]
    return deck, notices, logos


def main(batch_file, out):
    deck, notices, logos = normalize(json.load(open(batch_file, encoding="utf-8")))
    keys = {it[1] for _, _, items in logos for it in items if it[0] == "svg"}
    P = {k: svg_path(k) for k in sorted(keys)}
    js = """await figma.loadFontAsync({family:'Manrope',style:'SemiBold'}); await figma.loadFontAsync({family:'Manrope',style:'Regular'});
const P = %s; const D = %s; const NOTICES = %s; const LOGOS = %s;
const grid = figma.currentPage.children.find(c => c.type === 'SLIDE_GRID');
const ref = await figma.getNodeByIdAsync(D.background); const card = await figma.getNodeByIdAsync(D.card);
const notice = await figma.getNodeByIdAsync(D.notice); const gray = (await figma.getNodeByIdAsync(D.gray)).fills;
const slides = {}; for (const [l, id] of Object.entries(D.slides || {})) slides[l] = await figma.getNodeByIdAsync(id);
const rowNames = l => ['Edit ' + l + ' (do not present)', 'Edi\\u00e7\\u00e3o ' + l + ' (n\\u00e3o apresentar)'];
const slideOf = l => { if (slides[l]) return slides[l];
  let row = grid.children.find(r => rowNames(l).includes(r.name));
  if (row && row.children.length) return slides[l] = row.children[0];
  if (!row) { row = figma.createSlideRow(); row.name = rowNames(l)[0]; }
  const s = figma.createSlide(grid.children.indexOf(row), 0); s.name = '-'; s.isSkippedSlide = true; s.fills = ref.fills;
  return slides[l] = s; };
const y = {}; const nextY = (l, h) => { const s = slideOf(l); if (!(l in y)) y[l] = Math.max(100, ...s.children.map(c => c.y + c.height + 40)); const v = y[l]; y[l] += h + 40; return v; };
const hex = h => ({r: parseInt(h.slice(0,2),16)/255, g: parseInt(h.slice(2,4),16)/255, b: parseInt(h.slice(4,6),16)/255});
const out = [];
for (const [l, name, text] of NOTICES) {
  const fr = notice.clone(); slideOf(l).appendChild(fr); fr.name = name;
  fr.findOne(n => n.type === 'TEXT').characters = text;
  fr.x = 120; fr.y = nextY(l, fr.height); out.push([l, name, fr.id, fr.width, fr.height]);
}
for (const [l, name, items] of LOGOS) {
  const fr = figma.createAutoLayout('HORIZONTAL'); slideOf(l).appendChild(fr); fr.name = name;
  fr.fills = card.fills; fr.cornerRadius = 40; fr.paddingLeft = fr.paddingRight = 52; fr.paddingTop = fr.paddingBottom = 40;
  fr.itemSpacing = 36; fr.counterAxisAlignItems = 'CENTER';
  for (const it of items) {
    if (it[0] === 'clone') { const n = (await figma.getNodeByIdAsync(it[1])).clone(); fr.appendChild(n); n.rescale(110 / Math.max(n.width, n.height)); }
    else if (it[0] === 'svg') { const n = figma.createNodeFromSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="' + P[it[1]] + '"/></svg>');
      fr.appendChild(n); n.rescale(110 / n.width); n.fills = [];
      n.findAll(c => 'fills' in c && c.type !== 'FRAME').forEach(c => c.fills = [{type:'SOLID', color: hex(it[2])}]); }
    else { const t = figma.createText(); fr.appendChild(t); t.fontName = {family:'Manrope', style: it[2] ? 'Regular' : 'SemiBold'};
      t.fontSize = it[2] ? 72 : 64; t.characters = it[1]; t.fills = it[2] ? gray : [{type:'SOLID', color:{r:1,g:1,b:1}}]; }
  }
  fr.x = 120; fr.y = nextY(l, fr.height); out.push([l, name, fr.id, fr.width, fr.height]);
}
return out;""" % tuple(json.dumps(x, ensure_ascii=False) for x in (P, deck, notices, logos))
    Path(out).write_text(js, encoding="utf-8")
    print(f"{out}: {len(notices)} notices, {len(logos)} logos, {len(js)} chars")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main(*sys.argv[1:3])
