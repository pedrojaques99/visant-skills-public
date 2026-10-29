/**
 * ritmo-scan: the spacing that LIES about grouping, measured on the open screen.
 *
 * Why it exists. "Does it fix those crazy spacings the AI makes?" (2026-10-29,
 * a reply to the repo on X). It didn't: spacing was catalog #6 and question F2,
 * both judgment, and no detector. And the defect is rarely one wrong number.
 * It is the spacing failing to say what belongs to what:
 *
 *   1. **proximidade-invertida** (inverted proximity): the space INSIDE a group
 *      is larger than the space BETWEEN groups. The label sits closer to the
 *      next block than to its own value. The eye groups by distance (Gestalt
 *      proximity), so the screen reads wrong with every token right.
 *   2. **ritmo-chato** (flat rhythm): three nested levels with the same gap
 *      (`space-y-4` on everything). Nothing is grouped, so nothing is read
 *      first. Catalog #6, measured.
 *   3. **irmaos-desalinhados** (drifting siblings): identical cards with 24, 24,
 *      20px of padding; a list with 16, 16, 12, 16 between items. A small
 *      deviation is an accident (a large one is a decision, and stays silent).
 *
 * What it does NOT measure, on purpose: a value off the scale (15px, 22px).
 * A first version did, at runtime, and against linear.app and stripe.com it
 * returned 29 and 27 "off-grid" values on pages that are on the grid: 7px of
 * padding + 1px of border IS 8, a 15.5px button padding is optical
 * compensation, and a computed `auto` margin comes back as 1319px. The intent
 * of a value only exists in the SOURCE, and the source already has linters
 * for it (rhythmguard, stylelint-scales, eslint-plugin-tailwindcss: see
 * references/gates.md "Spacing"). This file measures only what no linter can:
 * two numbers from different files compared after layout.
 *
 * The measure that makes this work: **ink, not boxes.** The gap the eye sees
 * between two unboxed blocks runs from the last line of one to the first line
 * of the next. Padding counts, an empty wrapper does not. So distances are
 * between INK boxes: a text-only element is its content box (its line boxes,
 * the same box a designer draws in Figma), media is its box, and any
 * descendant that draws its own region (background, border, shadow) is that
 * region. A boxed child (a card) is a region of its own: common region beats
 * proximity, and the grouping rules skip it.
 *
 * Scope, also from calibration: grouping rules run on VERTICAL stacks of TEXT
 * at COMPONENT scale. Horizontal rows are clusters (icon + label, nav) whose
 * spacing is read differently; groups with media carry the image's own
 * whitespace; `aria-hidden` subtrees are product illustrations drawn in DOM
 * (stripe.com has a dozen), not the interface.
 *
 * How to run, same two ways as corta-scan:
 *   const r = await page.evaluate(src + ';ritmo()')     // harness
 *   ritmo()   /   ritmo('.painel')                      // console
 *
 * A finding is a candidate, never an automatic fix: rule zero of the skill.
 */

/* eslint-disable no-undef */
function ritmo(raiz = 'body', { verbose = true } = {}) {
  const root = typeof raiz === 'string' ? document.querySelector(raiz) : raiz;
  if (!root) return console.warn(`ritmo-scan: could not find "${raiz}"`);

  /* tolerances, in px. Below TOL two gaps are "the same" (subpixel and metric
     noise). DESVIO is the ceiling of an ACCIDENTAL drift: beyond it the
     difference was chosen. COMPONENTE is the largest gap that is still
     inside a component; above it the stack is page layout. */
  const TOL = 2;
  const DESVIO = 8;
  const COMPONENTE = 96;

  const achados = [];
  const cs = (el) => getComputedStyle(el);
  const px = (v) => (v && v !== 'normal' && v !== 'auto' ? parseFloat(v) || 0 : 0);
  const r1 = (n) => Math.round(n * 10) / 10;
  const nome = (el) => {
    const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.');
    const txt = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 32);
    return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}${txt ? ` "${txt}"` : ''}`;
  };
  const vis = (el) => {
    const s = cs(el);
    if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
    if (s.clip === 'rect(0px, 0px, 0px, 0px)' || s.clipPath === 'inset(50%)') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  /* out of flow: decoration, badges, tooltips. They take no part in rhythm */
  const foraDoFluxo = (el) => /absolute|fixed/.test(cs(el).position);
  const DENTRO_DE_SVG = (el) => el instanceof SVGElement && el.tagName.toLowerCase() !== 'svg';
  const MIDIA = /^(img|svg|video|canvas|picture|iframe)$/i;
  const REPLACED = /^(img|svg|video|canvas|picture|iframe|input|select|textarea|button|hr|meter|progress)$/i;

  /* draws its own region: background not transparent, a visible border, or a shadow */
  const transparente = (c) => !c || c === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(c);
  const caixado = (el) => {
    const s = cs(el);
    if (!transparente(s.backgroundColor) || s.backgroundImage !== 'none') return true;
    if (s.boxShadow && s.boxShadow !== 'none') return true;
    return ['Top', 'Right', 'Bottom', 'Left'].some(
      (l) => px(s[`border${l}Width`]) > 0 && s[`border${l}Style`] !== 'none' && !transparente(s[`border${l}Color`]),
    );
  };
  const temTextoProprio = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());

  /* ---------------------------------------------------------------- */
  /* ink box: what the eye sees of an element                         */
  /* ---------------------------------------------------------------- */
  const une = (a, b) =>
    !a ? b : !b ? a : { top: Math.min(a.top, b.top), left: Math.min(a.left, b.left), bottom: Math.max(a.bottom, b.bottom), right: Math.max(a.right, b.right) };
  const deRect = (r) => ({ top: r.top, left: r.left, bottom: r.bottom, right: r.right });
  /* content box = border box minus border and padding: the line boxes of a text block */
  const conteudo = (el) => {
    const r = el.getBoundingClientRect();
    const s = cs(el);
    const t = px(s.borderTopWidth) + px(s.paddingTop);
    const b = px(s.borderBottomWidth) + px(s.paddingBottom);
    const l = px(s.borderLeftWidth) + px(s.paddingLeft);
    const d = px(s.borderRightWidth) + px(s.paddingRight);
    return { top: r.top + t, bottom: r.bottom - b, left: r.left + l, right: r.right - d };
  };
  const filhosEmFluxo = (el) => [...el.children].filter((c) => !DENTRO_DE_SVG(c) && vis(c) && !foraDoFluxo(c));
  const memo = new Map();
  function tinta(el) {
    if (memo.has(el)) return memo.get(el);
    let caixa = null;
    const filhos = filhosEmFluxo(el);
    if (REPLACED.test(el.tagName) || caixado(el)) caixa = deRect(el.getBoundingClientRect());
    else if (temTextoProprio(el)) caixa = conteudo(el); /* a text block: its line boxes, inline children included */
    else for (const c of filhos) caixa = une(caixa, tinta(c));
    memo.set(el, caixa);
    return caixa;
  }
  const temMidia = (el) => MIDIA.test(el.tagName) || !!el.querySelector('img,svg,video,canvas,picture,iframe');
  const temTexto = (el) => (el.innerText || el.textContent || '').trim().length > 0;

  /*
   * A stack: 2+ in-flow children with ink, laid out on ONE axis without
   * overlap. Wrapped rows and grids are not stacks (two-axis gaps are judged
   * by the eye). A single-child wrapper is transparent: the stack is whatever
   * is inside it (`<div><div class="flex gap-4">…`).
   */
  const memoPilha = new Map();
  function pilha(el, profundidade = 0) {
    if (memoPilha.has(el)) return memoPilha.get(el);
    let res = null;
    if (profundidade <= 6 && !temTextoProprio(el)) {
      const filhos = filhosEmFluxo(el)
        .map((c) => ({ el: c, ink: tinta(c), box: c.getBoundingClientRect() }))
        .filter((f) => f.ink && f.ink.bottom - f.ink.top > 0);
      if (filhos.length === 1 && !caixado(filhos[0].el)) res = pilha(filhos[0].el, profundidade + 1);
      else if (filhos.length >= 2) {
        for (const eixo of ['y', 'x']) {
          const [a, b] = eixo === 'y' ? ['top', 'bottom'] : ['left', 'right'];
          const gaps = [];
          const caixas = [];
          let ok = true;
          for (let i = 1; i < filhos.length; i++) {
            const g = filhos[i].ink[a] - filhos[i - 1].ink[b];
            if (g < -1) { ok = false; break; }
            gaps.push(g);
            caixas.push(filhos[i].box[a] - filhos[i - 1].box[b]);
          }
          if (ok) { res = { el, eixo, filhos, gaps, caixas }; break; }
        }
      }
    }
    memoPilha.set(el, res);
    return res;
  }
  const mediana = (xs) => {
    const s = [...xs].sort((p, q) => p - q);
    return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  };

  const todos = [root, ...root.querySelectorAll('*')].filter(
    (el) => !DENTRO_DE_SVG(el) && !el.closest('[aria-hidden="true"]') && vis(el),
  );
  const pilhas = new Map();
  for (const el of todos) {
    const p = pilha(el);
    /* the same stack reached through a wrapper: keep it once */
    if (p && !pilhas.has(p.el)) pilhas.set(p.el, p);
  }

  /* ---------------------------------------------------------------- */
  /* 1 and 2 · inverted proximity, flat rhythm                        */
  /* ---------------------------------------------------------------- */
  /* an unboxed vertical group of text, at component scale */
  const grupoDeTexto = (P) =>
    P.eixo === 'y' && P.gaps.every((g) => g <= COMPONENTE) && P.filhos.every((f) => temTexto(f.el) && !temMidia(f.el));
  const interna = (filho) => {
    if (caixado(filho.el)) return null; /* common region: the card itself groups */
    const p = pilha(filho.el);
    return p && grupoDeTexto(p) ? p : null;
  };
  const jaNaCadeia = new Set();
  for (const P of pilhas.values()) {
    if (!grupoDeTexto(P)) continue;

    /* 1 · inside > between */
    const piores = [];
    P.filhos.forEach((f, i) => {
      const dentro = interna(f);
      if (!dentro) return;
      const entre = Math.min(...[P.gaps[i - 1], P.gaps[i]].filter((g) => g !== undefined));
      const maior = Math.max(...dentro.gaps);
      /* below 8px inside, both numbers are list-item noise; the difference must be felt */
      if (maior < 8 || maior - entre < Math.max(TOL, entre * 0.25)) return;
      /* the AUTHORED numbers too: the fix is written in gap/margin, not in ink */
      const escritoEntre = Math.min(...[P.caixas[i - 1], P.caixas[i]].filter((g) => g !== undefined));
      piores.push({ maior, entre, escritoDentro: Math.max(...dentro.caixas), escritoEntre });
    });
    if (piores.length) {
      const w = piores.reduce((m, x) => (x.maior - x.entre > m.maior - m.entre ? x : m));
      achados.push({
        regra: 'proximidade-invertida',
        el: nome(P.el),
        detalhe:
          `${piores.length} group(s) ${r1(w.maior)}px apart INSIDE but only ${r1(w.entre)}px BETWEEN groups ` +
          `(authored: ${r1(w.escritoDentro)}px inside, ${r1(w.escritoEntre)}px between). Each item reads as part of the wrong group. ` +
          `Fix: between ≥ 2× inside (e.g. ${r1(Math.max(4, w.escritoDentro / 2))}px inside, ${r1(Math.max(w.escritoEntre, w.escritoDentro))}px between)`,
        no: P.el,
      });
    }

    /* 2 · flat rhythm: a chain of 3+ nested groups with the same gap */
    if (jaNaCadeia.has(P.el)) continue;
    const cadeia = [P];
    let atual = P;
    for (;;) {
      const g = mediana(atual.gaps);
      if (g < 8) break; /* below 8 the levels are lines of one block, not groups */
      const prox = atual.filhos.map(interna).find((q) => q && Math.abs(mediana(q.gaps) - g) < TOL);
      if (!prox) break;
      cadeia.push(prox);
      atual = prox;
    }
    if (cadeia.length >= 3) {
      cadeia.forEach((c) => jaNaCadeia.add(c.el));
      achados.push({
        regra: 'ritmo-chato',
        el: nome(P.el),
        detalhe: `${cadeia.length} nested levels all ~${r1(mediana(P.gaps))}px apart: nothing is grouped, so nothing is read first. Fix: tight inside the smallest group, open between the largest (e.g. 8 / 16 / 32)`,
        no: P.el,
      });
    }
  }

  /* ---------------------------------------------------------------- */
  /* 3 · drifting siblings (authored values, not ink)                 */
  /* ---------------------------------------------------------------- */
  const moda = (xs) => {
    const c = new Map();
    for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
    return [...c.entries()].sort((p, q) => q[1] - p[1])[0];
  };
  /* the signature ignores spacing utilities: the drift IS in them */
  const ESPACO_UTIL = /^-?(?:[a-z]+:)*-?(p|px|py|pt|pb|pl|pr|ps|pe|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-x|space-y)-/;
  const assinatura = (el) =>
    `${el.tagName}|${el.childElementCount}|${(el.getAttribute('class') || '')
      .split(/\s+/)
      .filter((c) => c && !ESPACO_UTIL.test(c))
      .sort()
      .join(' ')}`;
  const recheio = (el) => {
    const s = cs(el);
    return [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft, s.rowGap, s.columnGap].map((v) => r1(px(v))).join(' ');
  };
  for (const P of pilhas.values()) {
    /* 3a · same-signature siblings with a different padding/gap */
    const grupos = new Map();
    for (const f of P.filhos) {
      const k = assinatura(f.el);
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(f.el);
    }
    for (const irmaos of grupos.values()) {
      if (irmaos.length < 3) continue;
      const vals = irmaos.map(recheio);
      const [comum, n] = moda(vals);
      if (n < 2 || n === irmaos.length) continue;
      irmaos.forEach((el, i) => {
        if (vals[i] === comum) return;
        const a = vals[i].split(' ').map(Number);
        const b = comum.split(' ').map(Number);
        const d = Math.max(...a.map((x, j) => Math.abs(x - b[j])));
        if (d < TOL || d > DESVIO * 2) return;
        achados.push({
          regra: 'irmaos-desalinhados',
          el: nome(el),
          detalhe: `padding/gap ${vals[i].replace(/ /g, '/')} while ${n} identical siblings use ${comum.replace(/ /g, '/')} (px: top/right/bottom/left/row-gap/col-gap)`,
          no: el,
        });
      });
    }
    /*
     * 3b · one gap in a regular TEXT stack that drifts by a few px.
     * Guards from calibration: m >= 8 (against a 0 gap the rhythm comes from
     * padding), siblings with text (an icon toolbar at 4 vs 8 has separators
     * doing the grouping), drift at most half the gap, and MORE room before a
     * heading is a decision (it opens a new group).
     */
    if (P.caixas.length >= 3 && P.filhos.every((f) => temTexto(f.el))) {
      const gs = P.caixas.map(r1);
      const [m, n] = moda(gs);
      if (n >= 2 && m >= 8) {
        gs.forEach((g, i) => {
          const d = Math.abs(g - m);
          if (d < TOL || d > DESVIO || d > m / 2) return;
          const el = P.filhos[i + 1].el;
          if (g > m && /^H[1-6]$/.test(el.tagName)) return;
          achados.push({
            regra: 'irmaos-desalinhados',
            el: nome(el),
            detalhe: `${g}px before it, ${m}px between the other ${n} pairs of ${nome(P.el)}: a ${r1(d)}px drift reads as a mistake, not a decision`,
            no: el,
          });
        });
      }
    }
  }

  if (verbose) {
    const bar = '-'.repeat(64);
    console.log(`\nritmo-scan · ${pilhas.size} stacks, ${todos.length} visible elements at ${window.innerWidth}px`);
    if (!achados.length) {
      console.log('[OK] grouping reads right: inside < between, levels differ, siblings agree.');
      console.log(bar);
      console.log('Zero is about PROXIMITY, not taste: the page can still give the');
      console.log('wrong block the most room. Off-scale values: the repo linter.');
    } else {
      for (const a of achados) console.log(`[${a.regra}] ${a.el}\n     ${a.detalhe}`);
      console.log(bar);
      console.log(`${achados.length} candidate(s). Node in \`.no\`; confirm on the pixel before fixing.`);
    }
    console.log(bar);
  }
  return achados;
}

if (typeof module !== 'undefined') module.exports = { ritmo };
