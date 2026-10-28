/**
 * corta-scan: what only the OPEN SCREEN knows: clipped text and stacked overlays.
 *
 * Why it exists. On 2026-09-11 a panel passed the four detectors, `tsc`,
 * `ui:audit` and 2347 tests, and in the screenshot the user read **"tirar
 * da"** inside a card, half of "tirar da fila" ("remove from queue"). The pill
 * had `white-space: nowrap` and lived in a 96px square with `overflow: hidden`.
 * There was no wrong line in any file: a word's width only exists after the
 * font loads and layout happens.
 *
 * No static detector catches this class. This is the other side of Step 5 of
 * SKILL.md ("the first line is opening the screen"), which said to look and
 * gave no tool to measure what to look at.
 *
 * The three things it measures, which the naked eye gets wrong:
 *
 *   1. **texto-cortado** (clipped text): an element whose content is larger than
 *      its box and has no declared escape (no `text-overflow: ellipsis`, no
 *      `-webkit-line-clamp`, no scroll of its own). This is the half word.
 *   2. **overlay-empilhado** (stacked overlay): two absolute overlays that
 *      overlap inside the same positioned parent. The higher z-index hides the
 *      other, and the hidden one is almost always the ACTION (that is what
 *      happened on the card with the collections folder in the same corner as
 *      the action disc).
 *   3. **fora-do-pai** (outside the parent): an overlay that leaves the parent's
 *      clipped box: it exists in the DOM, does not exist on screen, and no test
 *      complains.
 *
 * How to run, two ways, and the second is the one that works in a repo behind login:
 *
 *   // a) in a Playwright harness that already opened the screen:
 *   const achados = await page.evaluate(fs.readFileSync('corta-scan.js','utf8') + ';corta()')
 *
 *   // b) paste the file into the browser console, with the screen at the width
 *   //    that matters (390px is where everything breaks), and call:
 *   corta()                  // the whole page
 *   corta('.dir-panel')      // only inside one panel
 *
 * What it does NOT do: judge. A finding is a candidate: a clipped `nowrap`
 * inside a sideways-scrolling rail is a legitimate choice, and the script says
 * "has its own scroll" instead of flagging. Confirm it on the pixel, like every
 * finding of this skill.
 */

/* eslint-disable no-undef */
function corta(raiz = 'body', { verbose = true } = {}) {
  const root = typeof raiz === 'string' ? document.querySelector(raiz) : raiz;
  if (!root) return console.warn(`corta-scan: could not find "${raiz}"`);

  const achados = [];
  const cs = (el) => getComputedStyle(el);
  const vis = (el) => {
    const s = cs(el);
    if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
    // Screen-reader-only content (skip link, sr-only) is clipped ON PURPOSE: it is not eaten text.
    // False positive in the MN Group audit (2026-09-28): 'Pular para o conteúdo' (skip to content) flagged on every route.
    if (s.clip === 'rect(0px, 0px, 0px, 0px)' || s.clipPath === 'inset(50%)' || el.closest('.sr-only')) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const nome = (el) => {
    const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.');
    const txt = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}${txt ? ` "${txt}"` : ''}`;
  };

  const todos = [root, ...root.querySelectorAll('*')].filter(vis);

  /* ---------------------------------------------------------------- */
  /* 1 · clipped text with no declared escape                        */
  /* ---------------------------------------------------------------- */
  for (const el of todos) {
    /* only elements that HAVE their own text: a container clipping its child is
       the child's problem, and flagging both makes the same defect cascade */
    const texto = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!texto) continue;
    const s = cs(el);
    /*
     * TWO geometries, and this skill's real case was the SECOND.
     *
     * (a) the box clips its own content: `scrollWidth > clientWidth`. That is
     *     long text inside a fixed-width box.
     * (b) the WHOLE box leaves a clipping ancestor. That is what happened to
     *     the jukebox pill: it has `position: absolute`, so it grows to fit its
     *     own content (`scrollWidth` and `clientWidth` are equal, it thinks it
     *     is whole), and it is the 96px card with `overflow: hidden` that eats
     *     the ends. A first version of this rule measured only (a) and returned
     *     ZERO against the very defect that created it.
     */
    const sobraX = el.scrollWidth - el.clientWidth;
    const sobraY = el.scrollHeight - el.clientHeight;
    /* LEGITIMATE escapes, and therefore silent: ellipsis, line clamp, or a
       scrollbar of its own (a sideways-scrolling rail is a choice, not a bug) */
    if (s.textOverflow === 'ellipsis') continue;
    /* `-webkit-line-clamp` clips on purpose, with ellipsis, and in that case
       `scrollHeight` is ALWAYS larger than `clientHeight`; flagging it would
       accuse the declared escape of being the defect it solves. */
    if (s.webkitLineClamp && s.webkitLineClamp !== 'none') continue;
    if (/(auto|scroll)/.test(s.overflowX + s.overflowY)) continue;

    /*
     * The clipping ancestor, and the distinction that cost 12 false positives
     * in a single round against the real screen.
     *
     * SCROLLING IS NOT CLIPPING. The first version climbed to the first ancestor
     * with `overflow: hidden` and measured the distance. In a panel with a list,
     * that flagged eleven rows of `~5h28`, `~5h32`, `~5h35`... "eaten" by 8px,
     * 51px, 94px, 137px. The arithmetic progression is the defect's signature:
     * they were the items FURTHER DOWN the scroll, each farther than the last.
     * Being outside the window of a scrolling container is not being clipped;
     * it is being later.
     *
     * Two guards, both about the same distinction:
     *   - the climb STOPS at the first scrolling ancestor: if anything between
     *     the text and the clip has `overflow: auto|scroll`, position is the
     *     scroll's business;
     *   - the finding requires a PARTIAL clip: a box that does not touch the
     *     ancestor's window is out of view, not cut in half.
     */
    let pai = el.parentElement;
    let recorta = null;
    while (pai && pai !== document.body) {
      const ps = cs(pai);
      const ov = ps.overflowX + ps.overflowY;
      if (/auto|scroll/.test(ov)) break;
      if (/hidden|clip/.test(ov)) { recorta = pai; break; }
      pai = pai.parentElement;
    }
    let comido = 0;
    if (recorta) {
      const F = el.getBoundingClientRect();
      const P = recorta.getBoundingClientRect();
      const cruzaX = Math.min(F.right, P.right) - Math.max(F.left, P.left);
      const cruzaY = Math.min(F.bottom, P.bottom) - Math.max(F.top, P.top);
      /* nothing in common with the parent's window = out of view, not clipped */
      if (cruzaX > 1 && cruzaY > 1) {
        comido = Math.max(
          Math.max(0, P.left - F.left) + Math.max(0, F.right - P.right),
          Math.max(0, P.top - F.top) + Math.max(0, F.bottom - P.bottom),
        );
        /* ... and what remains must be LARGER than what was eaten: a 2px remnant
           of a word is something else (a misplaced piece), not clipped text */
        if (comido > Math.max(cruzaX, cruzaY)) comido = 0;
      }
    }
    const proprio = sobraX >= 2 || sobraY >= 2;
    /* 1px is subpixel rounding, not a half word */
    if (!proprio && comido < 2) continue;
    achados.push({
      regra: 'texto-cortado',
      el: nome(el),
      detalhe: proprio
        ? `the box itself clips ${sobraX >= 2 ? sobraX + 'px of width' : sobraY + 'px of height'}${
            s.whiteSpace === 'nowrap' ? ' · white-space: nowrap' : ''
          }${recorta ? '' : ' · and no parent clips: it is leaking out'}`
        : `${Math.round(comido)}px eaten by ${nome(recorta)}, which clips${
            s.whiteSpace === 'nowrap' ? ' · white-space: nowrap and no max-width' : ''
          }`,
      no: el,
    });
  }

  /* ---------------------------------------------------------------- */
  /* 2 and 3 · overlay stacked in the same corner, overlay outside parent */
  /* ---------------------------------------------------------------- */
  const absolutos = todos.filter((el) => /absolute|fixed/.test(cs(el).position));
  const porPai = new Map();
  for (const el of absolutos) {
    let pai = el.offsetParent || el.parentElement;
    if (!pai) continue;
    if (!porPai.has(pai)) porPai.set(pai, []);
    porPai.get(pai).push(el);
  }
  const cobre = (a, b) => {
    const A = a.getBoundingClientRect();
    const B = b.getBoundingClientRect();
    const x = Math.max(0, Math.min(A.right, B.right) - Math.max(A.left, B.left));
    const y = Math.max(0, Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top));
    const area = x * y;
    if (!area) return 0;
    /* fraction of the SMALLER of the two: that is the one that disappears */
    return area / Math.min(A.width * A.height, B.width * B.height);
  };
  for (const [pai, filhos] of porPai) {
    for (let i = 0; i < filhos.length; i++) {
      for (let j = i + 1; j < filhos.length; j++) {
        const f = cobre(filhos[i], filhos[j]);
        /* 40%: below that it is corners touching, which is common and readable */
        if (f < 0.4) continue;
        const zi = +cs(filhos[i]).zIndex || 0;
        const zj = +cs(filhos[j]).zIndex || 0;
        /* z-index tie: whoever comes LATER in the DOM paints on top (j > i) */
        const [em_cima, embaixo] = zi > zj ? [filhos[i], filhos[j]] : [filhos[j], filhos[i]];
        /*
         * A BADGE OVER A BACKGROUND is not stacking. False positive from
         * 2026-10-05: the text "Pública" (a corner badge) flagged over the
         * `inset-0` fallback of the brand card cover. The fallback is the card's
         * background, not a piece that disappears: the badge covers 100% of
         * ITSELF inside it, and the "smaller one" fraction gave 100%. Rule: if
         * the top one takes < 25% of the bottom one's area and the bottom one
         * has nothing interactive, it is a badge over a background, and stays
         * silent. The real case (folder button in the same corner as the action
         * disc) is still flagged: both pieces are of similar size.
         */
        const area = (el) => {
          const r = el.getBoundingClientRect();
          return r.width * r.height;
        };
        const INTERATIVO = 'a[href],button,input,select,textarea,[role="button"],[tabindex]:not([tabindex="-1"])';
        const temInterativo = embaixo.matches(INTERATIVO) || !!embaixo.querySelector(INTERATIVO);
        if (area(em_cima) < 0.25 * area(embaixo) && !temInterativo) continue;
        achados.push({
          regra: 'overlay-empilhado',
          el: nome(embaixo),
          detalhe: `${Math.round(f * 100)}% covered by ${nome(em_cima)} (z-index ${Math.max(zi, zj)} over ${Math.min(zi, zj)}) inside ${nome(pai)}`,
          no: embaixo,
        });
      }
    }
    const ps = cs(pai);
    const ov = ps.overflowX + ps.overflowY;
    /* same lesson as rule 1: in a container that SCROLLS, being outside the
       window is being further down, and flagging that flags every long list */
    if (/auto|scroll/.test(ov)) continue;
    if (!/hidden|clip/.test(ov)) continue;
    const P = pai.getBoundingClientRect();
    for (const f of filhos) {
      /* elements that HAVE their own text were already judged by rule 1, with
         the message about a clipped word; two findings for the same pixel make
         the person fix it twice */
      if ([...f.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1)) continue;
      const F = f.getBoundingClientRect();
      const foraX = Math.max(0, P.left - F.left) + Math.max(0, F.right - P.right);
      const foraY = Math.max(0, P.top - F.top) + Math.max(0, F.bottom - P.bottom);
      if (foraX < 2 && foraY < 2) continue;
      achados.push({
        regra: 'fora-do-pai',
        el: nome(f),
        detalhe: `${Math.round(foraX || foraY)}px outside ${nome(pai)}, which clips: exists in the DOM, does not exist on screen`,
        no: f,
      });
    }
  }

  if (verbose) {
    const bar = '-'.repeat(64);
    console.log(`\ncorta-scan · ${todos.length} visible elements at ${window.innerWidth}px`);
    if (!achados.length) {
      console.log('[OK] nothing clipped, nothing stacked, nothing outside its parent.');
      console.log(bar);
      console.log('Zero here is about GEOMETRY, not taste: what is left may be');
      console.log('whole and still not deserve the place it takes.');
      console.log(bar);
    } else {
      for (const a of achados) console.log(`[${a.regra}] ${a.el}\n     ${a.detalhe}`);
      console.log(bar);
      console.log(`${achados.length} candidate(s). Each one has its node in \`.no\`: hover the`);
      console.log('console object to highlight it on the page before fixing.');
      console.log(bar);
    }
  }
  return achados;
}

if (typeof module !== 'undefined') module.exports = { corta };
