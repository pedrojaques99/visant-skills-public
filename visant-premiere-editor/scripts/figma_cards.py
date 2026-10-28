"""Gera o JS (use_figma, Figma Slides) que cria um lote de cards de aviso e de logos no deck da aula, no estilo já aprovado.

  python figma_cards.py <lote.json> <saida.js>

lote.json:
  {"deck": {"fundo": "55:12", "card": "55:15", "aviso": "71:2", "cinza": "55:25",
            "slides": {"1.4": "67:3"}},          # linha já existente -> id do slide; linha nova é criada
   "avisos": [["2.8", "aviso 2.8 0:45 · privado", "Repositório sempre privado"]],
   "logos":  [["2.7", "logo 2.7 · só Claude", [["svg", "claude", "D97757"], ["txt", "→", true], ["txt", "CLAUDE.md", false]]]]}

Item de logo: ["svg", <arquivo em icones/ sem .svg>, <hex>] | ["clone", <nodeId>] | ["txt", <texto>, <cinza?>].
Ícones: Simple Icons (CC0), cor oficial da marca. Marca que não está lá entra como texto, nunca logo inventado.
Depois de rodar o JS: exportar cada card com get_screenshot(contentsOnly) -> PNG -> Premiere (ver SKILL.md, "Cards").
Linha nova sai como 'Edição N (não apresentar)', slide pulado. O card precisa ficar DENTRO do slide, senão o
screenshot sai 1x1.
"""
import json, re, sys
from pathlib import Path

ICONES = Path(__file__).with_name("icones")


def caminho(chave):
    return " ".join(re.findall(r'\sd="([^"]+)"', (ICONES / f"{chave}.svg").read_text(encoding="utf-8")))


def main(lote, saida):
    L = json.load(open(lote, encoding="utf-8"))
    d = L["deck"]
    chaves = {it[1] for _, _, itens in L.get("logos", []) for it in itens if it[0] == "svg"}
    P = {k: caminho(k) for k in chaves}
    js = """await figma.loadFontAsync({family:'Manrope',style:'SemiBold'}); await figma.loadFontAsync({family:'Manrope',style:'Regular'});
const P = %s; const D = %s; const AVISOS = %s; const LOGOS = %s;
const grid = figma.currentPage.children.find(c => c.type === 'SLIDE_GRID');
const ref = await figma.getNodeByIdAsync(D.fundo); const card = await figma.getNodeByIdAsync(D.card);
const aviso = await figma.getNodeByIdAsync(D.aviso); const cinza = (await figma.getNodeByIdAsync(D.cinza)).fills;
const slides = {}; for (const [l, id] of Object.entries(D.slides || {})) slides[l] = await figma.getNodeByIdAsync(id);
const slideDe = l => { if (slides[l]) return slides[l];
  const row = figma.createSlideRow(); row.name = 'Edição ' + l + ' (não apresentar)';
  const s = figma.createSlide(grid.children.indexOf(row), 0); s.name = '-'; s.isSkippedSlide = true; s.fills = ref.fills;
  return slides[l] = s; };
const y = {}; const proxY = (l, h) => { const s = slideDe(l); if (!(l in y)) y[l] = Math.max(100, ...s.children.map(c => c.y + c.height + 40)); const v = y[l]; y[l] += h + 40; return v; };
const hex = h => ({r: parseInt(h.slice(0,2),16)/255, g: parseInt(h.slice(2,4),16)/255, b: parseInt(h.slice(4,6),16)/255});
const out = [];
for (const [l, nome, texto] of AVISOS) {
  const fr = aviso.clone(); slideDe(l).appendChild(fr); fr.name = nome;
  fr.findOne(n => n.type === 'TEXT').characters = texto;
  fr.x = 120; fr.y = proxY(l, fr.height); out.push([l, nome, fr.id, fr.width, fr.height]);
}
for (const [l, nome, itens] of LOGOS) {
  const fr = figma.createAutoLayout('HORIZONTAL'); slideDe(l).appendChild(fr); fr.name = nome;
  fr.fills = card.fills; fr.cornerRadius = 40; fr.paddingLeft = fr.paddingRight = 52; fr.paddingTop = fr.paddingBottom = 40;
  fr.itemSpacing = 36; fr.counterAxisAlignItems = 'CENTER';
  for (const it of itens) {
    if (it[0] === 'clone') { const n = (await figma.getNodeByIdAsync(it[1])).clone(); fr.appendChild(n); n.rescale(110 / Math.max(n.width, n.height)); }
    else if (it[0] === 'svg') { const n = figma.createNodeFromSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="' + P[it[1]] + '"/></svg>');
      fr.appendChild(n); n.rescale(110 / n.width); n.fills = [];
      n.findAll(c => 'fills' in c && c.type !== 'FRAME').forEach(c => c.fills = [{type:'SOLID', color: hex(it[2])}]); }
    else { const t = figma.createText(); fr.appendChild(t); t.fontName = {family:'Manrope', style: it[2] ? 'Regular' : 'SemiBold'};
      t.fontSize = it[2] ? 72 : 64; t.characters = it[1]; t.fills = it[2] ? cinza : [{type:'SOLID', color:{r:1,g:1,b:1}}]; }
  }
  fr.x = 120; fr.y = proxY(l, fr.height); out.push([l, nome, fr.id, fr.width, fr.height]);
}
return out;""" % tuple(json.dumps(x, ensure_ascii=False) for x in (P, d, L.get("avisos", []), L.get("logos", [])))
    Path(saida).write_text(js, encoding="utf-8")
    print(f"{saida}: {len(L.get('avisos', []))} avisos, {len(L.get('logos', []))} logos, {len(js)} chars")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main(*sys.argv[1:3])
