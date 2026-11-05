/**
 * tela-scan: what a screen LOST, measured on the open screen.
 *
 * Why it exists. An agent applied these skills to an agent console (three
 * screens: health, costs, memory) and took out too much. Costs lost every card.
 * Six number tiles in memory became one sentence. The per-row "Ok" in health
 * became a grey icon. A fixed max-width frame left the screen squeezed, with a void
 * on the right. Every detector said zero, because every detector punishes what
 * is LEFT OVER, so the score improves the more you delete. The owner looked and
 * said "too clean", "no room to breathe", "full of text". This
 * file measures that opposite failure, on four axes, and also the failure in
 * the other direction (a stack of badges), so it cannot push toward ornament.
 *
 * RESPIRO
 *   vazio-lateral        column uses part of the usable width with data in it:
 *                        one side void >= max(120px, 10% of usable) more than
 *                        the other, or a centered column under 60% AND under
 *                        800px. Silent under 1024px, on prose and on forms (a
 *                        measure is a reason). Case: the fixed max-width frame.
 *   blocos-colados       two boxes 2-6px apart, or a heading 0-6px above a box.
 *                        Touching (<= 1px) is a deliberate seam and stays out.
 *   texto-denso          a 600px band >= 34% covered by line boxes, with no
 *                        surface and no media. Prose stays out. Highest measured
 *                        on the references: 24.6% (stripe.com).
 * HIERARQUIA
 *   sem-ponto-de-entrada first viewport with no text >= 1.3x the body size (or
 *                        1.15x and bold) and no media >= 20% of the viewport.
 *   metrica-sem-destaque 3+ main numbers, none larger than the body and none in
 *                        a surface. Case: costs without cards.
 *   numeros-em-frase     3+ quantities enumerated inside one sentence. Case: the
 *                        six tiles that became a line.
 *   tudo-igual           15+ text runs, >= 90% of the characters in one size and
 *                        weight (title aside), and zero surfaces.
 * INTERATIVIDADE
 *   acao-virou-texto     a lone action verb (Editar, Retry) with no control and
 *                        no pointer. Floor 1: a verb that does nothing is a lie.
 *   estado-so-texto      3+ rows with a status word in neutral ink, no chip, dot
 *                        or colored icon.
 *   estado-so-icone      3+ rows whose only state is a grey icon or dot. Case:
 *                        the health rows.
 *   parece-clicavel      pointer cursor, `<a>` without a destination, an enabled
 *                        `<button>` or underlined text, with no handler anywhere
 *                        up the tree. Only where handlers can be READ (React
 *                        props, or the listener hook the harness installs);
 *                        elsewhere it is silent and counted in `naoMedido`.
 *   Target size and accessible name are NOT here: axe-core owns them
 *   (`target-size`, `button-name`, `link-name`). tela-harness.mjs runs it.
 * COMUNICACAO
 *   texto-demais         150+ words off links, not prose, under 1.5 visual
 *                        elements per 100 words. Surfaces, chips, charts, media and state
 *                        signals count fully; an icon counts half.
 *   rotulo-repetido      the same short label in >= 80% of 4+ sibling rows.
 *   legenda-em-toda-linha 5+ stacked rows, >= 80% carrying a quieter caption of
 *                        4+ words.
 *   nomes-tecnicos       6+ distinct identifiers side by side (`a-b`, `x_y`,
 *                        `camelCase`), outside `pre`.
 *   pilha-de-selos       THE OPPOSITE: 5+ inert chips in one parent, or 3+ rows
 *                        with 3+ inert chips each. A clickable chip is a filter.
 *   icones-decorativos   THE OPPOSITE: the same neutral leading icon on 5+
 *                        sibling items in non-interactive rows. Repeated, it
 *                        carries no information.
 *
 * `retrato()` returns the same measures as numbers and NEVER as text: a snapshot
 * must be safe to keep, since it may come from a screen with real data.
 * regressao.mjs compares two of them.
 *
 * SHOWCASE. A page with a display-size heading (40px+) sells; it does not
 * operate, and it draws fake product UI in plain DOM. There only texto-denso,
 * sem-ponto-de-entrada, metrica-sem-destaque and tudo-igual run, and the output
 * says so. `tela(raiz, { tudo: true })` runs everything.
 *
 * Calibration (2026-11-05, Chrome, read-only, after scrolling to the end).
 *   Default, 1440 and 1920: zero on linear.app, linear.app/pricing, stripe.com,
 *     stripe.com/pricing, vercel.com, vercel.com/docs, npmjs.com/package/axe-core,
 *     ui.shadcn.com/examples/{dashboard,tasks,mail}, GitHub's issue list and
 *     githubstatus.com. But linear, stripe, vercel, npm, docs and shadcn's
 *     dashboard and tasks are showcases here, so that zero is partly scope.
 *   All rules forced, 1440: still zero on the shadcn examples, the GitHub list,
 *     npm, vercel docs, stripe.com and githubstatus.com, the real test. linear.app
 *     gives 25 (parece-clicavel 23, legenda 1, selos 1): its drawn product UI,
 *     which is why showcases exist.
 *   Known false positive, kept: texto-demais on news.ycombinator.com (252 words,
 *     1 visual). The measure is true; the site is text by design. A finding is a
 *     candidate and fails no run.
 *   Three screens of a real agent console, already rebuilt with boxes, logged in,
 *     1920 only: zero. The same screen with its surfaces stripped by CSS fires
 *     sem-ponto-de-entrada and tudo-igual.
 *   Each false positive found on the way left its reason beside the threshold.
 *   Rules seen firing only in fixtures, never on a real bad screen: most of them.
 *
 * How to run, same two ways as corta-scan:
 *   const r = await page.evaluate(src + ';tela()')     // harness
 *   tela()   /   tela('.painel')                       // console
 *
 * A finding is a candidate, never a verdict, and a zero is not a good screen.
 */

/* eslint-disable no-undef */
function _telaMedir(raiz, { tudo = false } = {}) {
  const auto = !raiz;
  const candidato = auto
    ? [...document.querySelectorAll('main,[role="main"]')].sort((a, b) => {
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        return rb.width * rb.height - ra.width * ra.height;
      })[0] || document.body
    : typeof raiz === 'string'
      ? document.querySelector(raiz)
      : raiz;
  if (!candidato) return null;
  const root = candidato;
  const W = window.innerWidth;
  const H = window.innerHeight;

  const cs = (el) => getComputedStyle(el);
  const px = (v) => parseFloat(v) || 0;
  const nome = (el) => {
    const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.');
    const txt = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 32);
    return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}${txt ? ` "${txt}"` : ''}`;
  };

  /* A computed color can be rgb, oklch, lab or color(): the canvas speaks all of them. */
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  ctx.canvas.width = ctx.canvas.height = 1;
  const memoCor = new Map();
  const rgba = (c) => {
    if (memoCor.has(c)) return memoCor.get(c);
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillStyle = c || 'transparent';
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    const out = [d[0], d[1], d[2], d[3] / 255];
    memoCor.set(c, out);
    return out;
  };
  const transparente = (c) => rgba(c)[3] < 0.02;
  /* chromatic: a hue the eye reads as a signal. Grey, white and near-black are not. */
  const cromatica = (c) => {
    const [r, g, b, a] = rgba(c);
    if (a < 0.1) return false;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    return max > 40 && (max - min) / 255 >= 0.16;
  };

  const vis = (el) => {
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    const s = cs(el);
    if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
    if (s.clip === 'rect(0px, 0px, 0px, 0px)' || s.clipPath === 'inset(50%)') return false;
    /* sr-only text is for the screen reader, not the eye (calibration: GitHub's "unread" on every row) */
    const r = el.getBoundingClientRect();
    if (r.width <= 2 || r.height <= 2) {
      if (s.overflow !== 'visible' || s.position === 'absolute') return false;
    }
    return r.width > 0 && r.height > 0;
  };
  const INTERATIVO =
    'a[href],button,input,select,textarea,summary,[role="button"],[role="link"],[role="tab"],[role="switch"],[role="checkbox"],[role="radio"],[role="menuitem"],[role="option"],[role="combobox"],[role="slider"],[tabindex="0"]';
  const CHROME = 'nav,aside,footer,[role="navigation"],[role="complementary"],[role="contentinfo"],[role="banner"],dialog,[aria-hidden="true"]';
  const dentroDeSvg = (el) => el instanceof SVGElement && el.tagName.toLowerCase() !== 'svg';
  const interativo = (el) => !!el.closest(INTERATIVO);
  const foraDoFluxo = (el) => /fixed/.test(cs(el).position);

  /*
   * A side column INSIDE main. Calibration: an app shell can wrap everything in
   * `<main>`, sidebar included, as a plain div. Measured, it read as 248px of
   * "void" and its links as content. A column is tall, narrow, against the edge,
   * with a wider sibling beside it.
   */
  const colunas = [];
  if (auto) {
    for (const el of root.querySelectorAll('*')) {
      if (dentroDeSvg(el) || !el.parentElement || !vis(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.height < H * 0.5 || r.width < 120 || r.width > W * 0.25) continue;
      if (r.left > 8 && r.right < W - 8) continue;
      const lado = [...el.parentElement.children].some((i) => {
        if (i === el || !vis(i)) return false;
        const q = i.getBoundingClientRect();
        return q.width >= r.width * 2 && (q.left >= r.right - 1 || q.right <= r.left + 1) && Math.min(q.bottom, r.bottom) - Math.max(q.top, r.top) > H * 0.3;
      });
      if (lado) colunas.push(el);
    }
  }
  const emColuna = (el) => colunas.some((c) => c.contains(el));

  /* the elements that are the SCREEN: chrome, illustrations and overlays out */
  const todos = [root, ...root.querySelectorAll('*')].filter((el) => {
    if (dentroDeSvg(el)) return false;
    if (el !== root && el.closest(CHROME)) return false;
    if (emColuna(el)) return false;
    if (el.tagName === 'HEADER' && el.querySelector('nav,[role="navigation"]')) return false;
    if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|LINK|META|OPTION)$/.test(el.tagName)) return false;
    return vis(el) && !foraDoFluxo(el);
  });
  const naTela = new Set(todos);

  /* ---------------------------------------------------------------- */
  /* surfaces                                                         */
  /* ---------------------------------------------------------------- */
  const fundoDe = (el) => {
    for (let n = el; n; n = n.parentElement) {
      const c = cs(n).backgroundColor;
      if (!transparente(c)) return c;
    }
    return 'rgb(255,255,255)';
  };
  const bordaVisivel = (s, lado) =>
    px(s[`border${lado}Width`]) > 0 && s[`border${lado}Style`] !== 'none' && !transparente(s[`border${lado}Color`]);
  const desenhaRegiao = (el) => {
    const s = cs(el);
    if (s.backgroundImage !== 'none' && /gradient|url/.test(s.backgroundImage)) return true;
    if (s.boxShadow && s.boxShadow !== 'none') return true;
    if (['Top', 'Right', 'Bottom', 'Left'].every((l) => bordaVisivel(s, l))) return true;
    if (transparente(s.backgroundColor)) return false;
    const pai = el.parentElement ? fundoDe(el.parentElement) : 'rgb(255,255,255)';
    const [a, b] = [rgba(s.backgroundColor), rgba(pai)];
    return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) >= 6;
  };
  const rootR = root.getBoundingClientRect();
  const superficie = (el) => {
    if (el === root || /^(INPUT|TEXTAREA|SELECT|BUTTON|A|IMG|SVG|VIDEO|CANVAS|TD|TH|TR|THEAD|TBODY|HTML|BODY)$/i.test(el.tagName)) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 64 || r.height < 40) return false;
    /* the page's own backdrop is not a surface */
    if (r.width >= rootR.width * 0.98 && r.height >= rootR.height * 0.9 && !px(cs(el).borderTopLeftRadius)) return false;
    return desenhaRegiao(el);
  };
  const superficies = todos.filter(superficie);
  const setSuperficies = new Set(superficies);
  const emSuperficie = (el) => {
    for (let n = el; n && n !== root.parentElement; n = n.parentElement) if (setSuperficies.has(n)) return true;
    return false;
  };

  /* ---------------------------------------------------------------- */
  /* text runs                                                        */
  /* ---------------------------------------------------------------- */
  const corridas = [];
  {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const texto = n.textContent.replace(/\s+/g, ' ').trim();
      if (!texto) continue;
      const el = n.parentElement;
      if (!el || !naTela.has(el)) continue;
      range.selectNodeContents(n);
      const linhas = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
      if (!linhas.length) continue;
      const s = cs(el);
      corridas.push({ texto, el, linhas, tam: px(s.fontSize), peso: +s.fontWeight || 400, cor: s.color });
    }
  }
  const totalChars = corridas.reduce((a, c) => a + c.texto.length, 0);
  /* Word boundaries by locale: Japanese or Thai have no spaces to split on. */
  const segmentador = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(document.documentElement.lang || undefined, { granularity: 'word' }) : null;
  const palavrasDe = (t) => (segmentador ? [...segmentador.segment(t)].filter((p) => p.isWordLike).length : t.split(/\s+/).filter(Boolean).length);
  const palavras = corridas.reduce((a, c) => a + palavrasDe(c.texto), 0);
  /*
   * Reading text: paragraphs of 25+ words. Not `article`, which wraps whole pages,
   * and not a structured `li`: GitHub's issue rows read as prose, and the prose
   * exemption turned the rules off on a list of 25 rows.
   */
  const blocosProsa = new Set();
  let palavrasProsa = 0;
  for (const c of corridas) {
    const bloco = c.el.closest('p,li,blockquote,dd') || c.el;
    if (blocosProsa.has(bloco) || interativo(bloco)) continue;
    if (bloco.tagName === 'LI' && bloco.querySelector('div,ul,ol,svg,button')) continue;
    const n = palavrasDe((bloco.textContent || '').trim());
    if (n >= 25) {
      blocosProsa.add(bloco);
      palavrasProsa += n;
    }
  }
  const prosa = palavras > 0 && palavrasProsa / palavras >= 0.45;

  const modaPeso = (pares) => {
    const m = new Map();
    for (const [k, p] of pares) m.set(k, (m.get(k) || 0) + p);
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  };
  const tamDominante = modaPeso(corridas.map((c) => [Math.round(c.tam), c.texto.length])) || 16;
  const pesoDominante = modaPeso(corridas.map((c) => [c.peso, c.texto.length])) || 400;

  /*
   * Showcase: a page with a display-size HEADING sells; it does not operate. A
   * landing draws fake product UI in plain DOM (linear.app: inert buttons, chips
   * and issue rows, none aria-hidden), and row-level rules read that drawing as
   * the interface: 23 "dead buttons" on a page with none. A big NUMBER does not
   * count, a dashboard may have one. Showcases keep respiro and hierarquia.
   */
  const vitrine = !tudo && corridas.some((c) => c.tam >= 40 && c.el.closest('h1,h2') && /\p{L}{3}/u.test(c.texto));

  /* ---------------------------------------------------------------- */
  /* controls, media, chips, numbers                                  */
  /* ---------------------------------------------------------------- */
  const controles = todos.filter(
    (el) => el.matches(INTERATIVO) && !el.disabled && el.getAttribute('aria-disabled') !== 'true' && !el.closest('[inert]'),
  );
  const svgs = [...root.querySelectorAll('svg')].filter((el) => !el.closest(CHROME) && !emColuna(el) && vis(el));
  const icones = svgs.filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width <= 40 && r.height <= 40;
  });
  const graficos = [
    ...svgs.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width >= 64 && r.height >= 32;
    }),
    ...todos.filter((el) => /^(CANVAS|PROGRESS|METER)$/.test(el.tagName) || /^(progressbar|meter|img)$/.test(el.getAttribute('role') || '')),
  ];
  const midias = todos.filter((el) => /^(IMG|VIDEO|PICTURE|IFRAME)$/.test(el.tagName)).filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width >= 48 && r.height >= 32;
  });

  const seloDe = (el) => {
    if (dentroDeSvg(el) || /^(TD|TH|TR|LI|UL|OL|BODY|HTML)$/.test(el.tagName)) return false;
    const r = el.getBoundingClientRect();
    if (r.height > 34 || r.height < 12 || r.width > 240 || r.width < 16) return false;
    const t = (el.textContent || '').trim();
    if (!t || t.length > 24) return false;
    if (el.querySelector('div,p,ul,table,img')) return false;
    return desenhaRegiao(el);
  };
  const selos = todos.filter(seloDe);
  const selosInertes = selos.filter((el) => !interativo(el));

  /* Any currency, any digit system, any short unit: a brand's locale is not a parameter. */
  const NUMERO = /^[~≈+\-−]?\s*(?:\p{Lu}{3}\s|\p{L}{0,3}\p{Sc})?\s*\p{Nd}[\p{Nd}.,٬٫'’\u00a0\u202f ]*(?:\s?(?:%|٪|\p{Sc}|\p{L}{1,3}\.?|tokens?|\/\p{L}+))?\+?$/u;
  const NAO_NUMERO = /^\d{4}$|^0\d$|^\d{1,2}[/:]\d{1,2}|^\d{4}-\d{2}|^v?\d+\.\d+\.\d+$/;
  const TABELA = 'table,[role="table"],[role="grid"],[role="row"],[role="cell"],[role="rowgroup"],pre,code,time,button,a[href],select,input,label,[role="tab"],[role="option"]';
  const ehNumero = (t) => t.length <= 16 && NUMERO.test(t) && !NAO_NUMERO.test(t);
  const destacada = (c) => c.tam >= tamDominante * 1.25 || (c.tam >= tamDominante * 1.12 && c.peso >= 600 && pesoDominante < 600);
  const metricas = corridas
    .filter((c) => ehNumero(c.texto) && !c.el.closest(TABELA))
    /* a number needs a word next to it to be a metric: a lone digit is a step or a page */
    .filter((c) => {
      const pai = c.el.parentElement;
      const par = pai && (pai.textContent || '').replace(c.texto, '').trim();
      const avo = pai && pai.parentElement && (pai.parentElement.textContent || '').replace(c.texto, '').trim();
      return (par && par.length <= 60) || (avo && avo.length <= 60);
    })
    .map((c) => ({ ...c, caixa: emSuperficie(c.el), destaque: destacada(c) }));

  /* ---------------------------------------------------------------- */
  /* usable width vs what the content takes                           */
  /* ---------------------------------------------------------------- */
  let utilE = rootR.left;
  let utilD = rootR.right;
  if (auto) {
    utilE = 0;
    utilD = W;
    /* side columns: any tall sibling of root or of one of its ancestors, beside it */
    for (let n = root; n && n !== document.documentElement; n = n.parentElement) {
      for (const irmao of n.parentElement ? n.parentElement.children : []) {
        if (irmao === n || !vis(irmao)) continue;
        const r = irmao.getBoundingClientRect();
        if (r.height < H * 0.5 || r.width > W * 0.4) continue;
        const a = n.getBoundingClientRect();
        if (r.right <= a.left + 1) utilE = Math.max(utilE, r.right);
        else if (r.left >= a.right - 1) utilD = Math.min(utilD, r.left);
      }
    }
    for (const el of document.querySelectorAll('aside,nav,[role="navigation"],[role="complementary"]')) {
      if (root.contains(el) || !vis(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.height < H * 0.5 || r.width > W * 0.4) continue;
      if (r.left <= 8) utilE = Math.max(utilE, r.right);
      else if (r.right >= W - 8) utilD = Math.min(utilD, r.left);
    }
    for (const el of colunas) {
      const r = el.getBoundingClientRect();
      if (r.left <= 8) utilE = Math.max(utilE, r.right);
      else utilD = Math.min(utilD, r.left);
    }
  }
  const utilW = Math.max(1, utilD - utilE);

  /* ink: text lines, media, surfaces. Median per band: a toolbar pinned to the
     far edge must not hide that everything below it stops at 1024px. */
  const tinta = [];
  for (const c of corridas) for (const l of c.linhas) tinta.push(l);
  /* a table takes its column even when its cells are short */
  for (const el of [...midias, ...graficos, ...superficies, ...controles, ...todos.filter((n) => n.tagName === 'TABLE')]) tinta.push(el.getBoundingClientRect());
  const BANDA = 160;
  const topo = rootR.top;
  const limite = topo + Math.min(rootR.height, H * 5);
  const bandas = [];
  for (let y = topo; y < limite; y += BANDA) {
    let e = Infinity;
    let d = -Infinity;
    for (const r of tinta) {
      if (r.bottom <= y || r.top >= y + BANDA) continue;
      e = Math.min(e, r.left);
      d = Math.max(d, r.right);
    }
    if (d > e) bandas.push({ e, d });
  }
  const mediana = (xs) => {
    const s = [...xs].sort((a, b) => a - b);
    return s.length ? s[Math.floor(s.length / 2)] : 0;
  };
  const conteudoE = bandas.length ? mediana(bandas.map((b) => b.e)) : utilE;
  const conteudoD = bandas.length ? mediana(bandas.map((b) => b.d)) : utilE;
  const larguraUsada = Math.max(0, conteudoD - conteudoE);

  /* ---------------------------------------------------------------- */
  /* text coverage per band                                           */
  /* ---------------------------------------------------------------- */
  let cobertura = 0;
  let coberturaEl = null;
  const BANDA_TEXTO = 600;
  for (let y = topo; y < limite; y += BANDA_TEXTO / 2) {
    let area = 0;
    let quem = null;
    for (const c of corridas)
      for (const l of c.linhas) {
        const h = Math.min(l.bottom, y + BANDA_TEXTO) - Math.max(l.top, y);
        if (h > 0) {
          area += h * l.width;
          quem = quem || c.el;
        }
      }
    const temRegiao = [...superficies, ...midias, ...graficos].some((el) => {
      const r = el.getBoundingClientRect();
      return r.bottom > y && r.top < y + BANDA_TEXTO && r.width * r.height >= 4000;
    });
    const c = area / (BANDA_TEXTO * utilW);
    if (!temRegiao && c > cobertura) {
      cobertura = c;
      coberturaEl = quem;
    }
  }

  /* ---------------------------------------------------------------- */
  /* sibling groups: rows, tiles                                      */
  /* ---------------------------------------------------------------- */
  const grupos = [];
  for (const pai of todos) {
    const filhos = [...pai.children].filter((c) => naTela.has(c));
    if (filhos.length < 3) continue;
    const porAssin = new Map();
    for (const f of filhos) {
      const k = `${f.tagName}|${[...f.children].map((c) => c.tagName).join(',')}`;
      if (!porAssin.has(k)) porAssin.set(k, []);
      porAssin.get(k).push(f);
    }
    for (const itens of porAssin.values()) {
      if (itens.length < 3) continue;
      const rs = itens.map((el) => el.getBoundingClientRect());
      const empilhado = rs.every((r, i) => i === 0 || (r.top >= rs[i - 1].bottom - 1 && Math.abs(r.left - rs[0].left) <= 4));
      grupos.push({ pai, itens, empilhado });
    }
  }
  /* leaf texts of an item, as {texto, c} */
  const corridasDe = (item) => corridas.filter((c) => item.contains(c.el));

  /* Word lists exist only for pt, en, es, fr, de, it. Other languages: reported as not measured, never as clean. */
  const ESTADO = /^(ok|okay|ativo|ativa|inativo|inativa|online|offline|erro|falhou|falha|pendente|concluído|concluido|sucesso|aviso|atenção|atencao|degradado|pausado|rodando|parado|pronto|operacional|healthy|unhealthy|down|up|degraded|active|inactive|error|failed|pending|success|warning|paused|running|stopped|live|ready|normal|operational|activo|activa|inactivo|fallo|fallido|pendiente|completado|éxito|exito|advertencia|detenido|listo|actif|inactif|erreur|échec|echec|en attente|réussi|reussi|avertissement|arrêté|arrete|prêt|pret|aktiv|inaktiv|fehler|fehlgeschlagen|ausstehend|erfolgreich|warnung|pausiert|gestoppt|bereit|attivo|inattivo|errore|fallito|in attesa|riuscito|avviso|fermato)$/iu;
  const NOME_ESTADO = /check|circle-?x|x-?circle|alert|warn|status|success|error|fail|shield/i;
  const NOME_NAVEGA = /chevron|caret|arrow|external|menu|more|dots|ellipsis/i;
  const corSinal = (el) => {
    const s = cs(el);
    return cromatica(s.color) || cromatica(s.backgroundColor) || cromatica(s.fill) || cromatica(s.stroke);
  };
  const iconeCromatico = (svg) => {
    if (corSinal(svg)) return true;
    return [...svg.querySelectorAll('*')].some((n) => {
      const s = cs(n);
      return (s.fill !== 'none' && cromatica(s.fill)) || (s.stroke !== 'none' && cromatica(s.stroke));
    });
  };
  const pontos = (item) =>
    [...item.querySelectorAll('*')].filter((el) => {
      if (!naTela.has(el) || el.children.length || (el.textContent || '').trim()) return false;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.width > 14 || Math.abs(r.width - r.height) > 2) return false;
      return !transparente(cs(el).backgroundColor);
    });
  /* A monochrome brand signals by contrast, not by hue: a mark as strong as the row's text is a signal; a muted one is not. */
  const luz = (c) => { const [r, g, b] = rgba(c); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const marcaForte = (svg, item) => {
    const texto = corridas.find((c) => item.contains(c.el));
    if (!texto) return false;
    const fundo = luz(fundoDe(item));
    const tinta = [cs(svg).color, ...[...svg.querySelectorAll('*')].flatMap((n) => [cs(n).stroke, cs(n).fill])].filter((c) => c && c !== 'none' && !transparente(c));
    return tinta.some((c) => Math.abs(luz(c) - fundo) >= Math.abs(luz(texto.cor) - fundo) * 0.9);
  };
  const sinalNaLinha = (item) =>
    [...item.querySelectorAll('svg')].some((s) => vis(s) && (iconeCromatico(s) || marcaForte(s, item))) ||
    pontos(item).some((d) => cromatica(cs(d).backgroundColor));

  /* ---------------------------------------------------------------- */
  /* state signals, for the snapshot                                  */
  /* ---------------------------------------------------------------- */
  const estadosComSinal = corridas.filter((c) => {
    if (!ESTADO.test(c.texto)) return false;
    if (seloDe(c.el) || cromatica(c.cor)) return true;
    const linha = c.el.parentElement;
    return !!linha && sinalNaLinha(linha);
  }).length;

  return {
    root, auto, W, H, nome, cs, px, vis, todos, naTela, superficies, emSuperficie, corridas, totalChars, palavras, prosa,
    tamDominante, pesoDominante, controles, svgs, icones, graficos, midias, selos, selosInertes, metricas, seloDe,
    utilE, utilD, utilW, conteudoE, conteudoD, larguraUsada, cobertura, coberturaEl, grupos, corridasDe, ESTADO,
    NOME_ESTADO, NOME_NAVEGA, sinalNaLinha, pontos, cromatica, iconeCromatico, interativo, estadosComSinal, palavrasDe,
    rootR, desenhaRegiao, destacada, ehNumero, vitrine,
  };
}

/* the numbers of a screen, never its words: safe to keep next to a before/after */
function retrato(raiz, opcoes) {
  const m = _telaMedir(raiz, opcoes);
  if (!m) return null;
  const r1 = (n) => Math.round(n * 10) / 10;
  return {
    largura: m.W,
    util: Math.round(m.utilW),
    usada: Math.round(m.larguraUsada),
    vazioEsquerda: Math.round(m.conteudoE - m.utilE),
    vazioDireita: Math.round(m.utilD - m.conteudoD),
    superficies: m.superficies.length,
    metricas: m.metricas.length,
    metricasEmCaixa: m.metricas.filter((c) => c.caixa).length,
    metricasDestacadas: m.metricas.filter((c) => c.destaque).length,
    controles: m.controles.length,
    selos: m.selos.length,
    estadosComSinal: m.estadosComSinal,
    palavras: m.palavras,
    prosa: m.prosa,
    vitrine: m.vitrine,
    icones: m.icones.length,
    graficos: m.graficos.length,
    midias: m.midias.length,
    coberturaTexto: r1(m.cobertura * 100),
    tamDominante: m.tamDominante,
    corridas: m.corridas.length,
  };
}

/* `tudo: true` runs every rule on a showcase too: a real product under a big heading */
function tela(raiz, { verbose = true, tudo = false } = {}) {
  const m = _telaMedir(raiz, { tudo });
  if (!m) return console.warn(`tela-scan: could not find "${raiz}"`);
  const achados = [];
  const add = (eixo, regra, no, detalhe) => achados.push({ eixo, regra, el: no ? m.nome(no) : '(screen)', detalhe, no });
  const { corridas, grupos, cs, px, vis } = m;
  const r0 = (n) => Math.round(n);

  /* a column that holds data, as opposed to an article or a form */
  const inputs = m.todos.filter((el) => /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)).length;
  const temDado =
    m.metricas.length >= 2 ||
    m.superficies.length >= 2 ||
    m.todos.some((el) => el.tagName === 'TABLE' || el.getAttribute('role') === 'table') ||
    grupos.some((g) => g.empilhado && g.itens.length >= 3 && g.itens.every((it) => it.children.length >= 2));
  const formulario = inputs >= 3 && m.metricas.length === 0;

  /* ---- RESPIRO ---- */
  /*
   * Off on a showcase: linear.app/pricing and stripe.com/pricing alternate half-width
   * sections on purpose, and the median read as a 651px void. And a centered column
   * also needs to be small in absolute terms: githubstatus.com at 1920 is 980px wide
   * (51%) and reads fine, the 60% alone called it squeezed.
   */
  if (m.W >= 1024 && !m.vitrine && !m.prosa && !formulario && temDado && m.larguraUsada > 0) {
    const e = m.conteudoE - m.utilE;
    const d = m.utilD - m.conteudoD;
    const piso = Math.max(120, m.utilW * 0.1);
    if (d - e >= piso || e - d >= piso) {
      add('respiro', 'vazio-lateral', m.root,
        `content stops ${r0(Math.max(e, d))}px short of one side and ${r0(Math.min(e, d))}px of the other (${r0(m.larguraUsada)}px of ${r0(m.utilW)}px usable). Fix: let the data take the column, or center it on a reason. A max-w on a dashboard is a void, not breathing room`);
    } else if (m.larguraUsada / m.utilW < 0.6 && m.larguraUsada < 800) {
      add('respiro', 'vazio-lateral', m.root,
        `data in ${r0(m.larguraUsada)}px of ${r0(m.utilW)}px usable (${r0((m.larguraUsada / m.utilW) * 100)}%): squeezed in the middle with room on both sides. Fix: widen the column or use the room for the second group`);
    }
  }
  /* boxes 2-6px apart: too close to read as two, too far to read as a seam */
  const regiaoDe = new Set(m.superficies);
  const COLADO = (g) => g >= 2 && g <= 6;
  let colados = 0;
  /* off on a showcase: stripe.com/pricing's subcards sit 4px apart as a designed set */
  for (const pai of m.vitrine ? [] : m.todos) {
    const filhos = [...pai.children].filter((c) => m.naTela.has(c));
    for (let i = 1; i < filhos.length; i++) {
      const [a, b] = [filhos[i - 1], filhos[i]];
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const emLinha = rb.left >= ra.right - 1 && Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top) > 0;
      const g = emLinha ? rb.left - ra.right : rb.top - ra.bottom;
      if (regiaoDe.has(a) && regiaoDe.has(b) && COLADO(g) && !colados++) {
        add('respiro', 'blocos-colados', b, `two boxes ${r0(g)}px apart: nothing reads as a pair or as separate. Fix: at least 8px between boxes, or join them on a 1px seam`);
      }
      if (/^H[1-6]$/.test(a.tagName) && regiaoDe.has(b) && !emLinha && g >= 0 && g <= 6) {
        add('respiro', 'blocos-colados', b, `heading ${r0(g)}px above its box: the title has no room to belong. Fix: 8-12px under it`);
      }
    }
  }
  if (!m.prosa && m.cobertura >= 0.34) {
    add('respiro', 'texto-denso', m.coberturaEl,
      `${r0(m.cobertura * 100)}% of a 600px band is line boxes, with no surface and no media in it. Fix: turn the repeating part into a visual (bar, chip, tile) and cut the rest`);
  }

  /* ---- HIERARQUIA ---- */
  const primeira = corridas.filter((c) => c.linhas[0].top < m.rootR.top + m.H && c.texto.length <= 120);
  const midiaGrande = [...m.midias, ...m.graficos].some((el) => {
    const r = el.getBoundingClientRect();
    return r.top < m.rootR.top + m.H && r.width * r.height >= m.W * m.H * 0.2;
  });
  const entrada = primeira.some((c) => c.tam >= m.tamDominante * 1.3 || (c.tam >= m.tamDominante * 1.15 && c.peso >= 600));
  if (primeira.length >= 6 && !entrada && !midiaGrande) {
    add('hierarquia', 'sem-ponto-de-entrada', m.root,
      `first viewport has nothing above ${r0(Math.max(...primeira.map((c) => c.tam)))}px on a ${m.tamDominante}px body: the eye has nowhere to start. Fix: one title or the main number clearly larger`);
  }
  const semDestaque = m.metricas.filter((c) => !c.caixa && !c.destaque);
  if (m.metricas.length >= 3 && semDestaque.length >= 3 && semDestaque.length >= m.metricas.length * 0.6) {
    add('hierarquia', 'metrica-sem-destaque', semDestaque[0].el,
      `${semDestaque.length} of ${m.metricas.length} main numbers at body size with no surface around them. Fix: give the main numbers a tile (operation dashboards keep the box on main data) or real size`);
  }
  /* quantities enumerated in one sentence: the tiles that became a line */
  const QTD = /(?:\p{L}{0,3}\p{Sc})?\s?\p{Nd}[\p{Nd}.,٬٫]*\s?(?:%|٪|\p{Sc}|\p{L}{1,14})?/gu;
  const vistos = new Set();
  /* off on a showcase: a price like "3,99% + R$ 0,39" is one fact (stripe.com/pricing) */
  for (const c of m.vitrine ? [] : corridas) {
    const bloco = c.el.closest('p,li,span,div,dd') || c.el;
    if (vistos.has(bloco) || bloco.children.length > 6 || m.interativo(bloco) || bloco.closest('pre,code,table')) continue;
    vistos.add(bloco);
    const t = (bloco.textContent || '').replace(/\s+/g, ' ').trim();
    if (t.length > 240 || t.length < 12) continue;
    /* dates and times read as numbers and are not quantities */
    const limpo = t.replace(/\d{1,4}[-/:.]\d{1,2}(?:[-/:.]\d{1,4})*/g, ' ');
    const partes = limpo.split(/\s*[,;·•|、，،؛]\s*|\s+(?:e|y|i|et|und|and|en|og|och)\s+|\s+و/u).filter(Boolean);
    const comNumero = partes.filter((p) => (p.match(QTD) || []).some((x) => /\p{Nd}/u.test(x)) && m.palavrasDe(p) <= 5);
    /* calibration: a caption under a real tile ("42 messages, 3 models") is detail, the tile already leads */
    const lidera = m.metricas.some((x) => x.destaque);
    if (comNumero.length >= 3 && comNumero.length >= partes.length * 0.6 && !(m.emSuperficie(bloco) && lidera)) {
      add('hierarquia', 'numeros-em-frase', bloco, `${comNumero.length} quantities enumerated in one sentence: nothing can be compared at a glance. Fix: give each quantity its own place in the design system's pattern, or keep only the one that decides`);
    }
  }
  if (corridas.length >= 15 && m.superficies.length === 0) {
    const titulo = Math.max(...corridas.map((c) => c.tam));
    const resto = corridas.filter((c) => c.tam < titulo);
    const base = resto.length ? resto : corridas;
    const chars = base.reduce((a, c) => a + c.texto.length, 0);
    const iguais = base.filter((c) => Math.abs(c.tam - m.tamDominante) <= 1 && Math.abs(c.peso - m.pesoDominante) <= 100).reduce((a, c) => a + c.texto.length, 0);
    if (chars && iguais / chars >= 0.9) {
      add('hierarquia', 'tudo-igual', m.root, `${r0((iguais / chars) * 100)}% of the text in one size and weight, and no surface separates a group: every line says the same thing. Fix: surfaces around the groups, size for what decides`);
    }
  }

  /* ---- INTERATIVIDADE ---- */
  let naoMedido = 0;
  if (!m.vitrine) {
  const ACAO = /^(editar|excluir|apagar|remover|salvar|cancelar|abrir|ver detalhes|ver mais|ver tudo|adicionar|copiar|baixar|exportar|duplicar|tentar de novo|tentar novamente|reiniciar|edit|delete|remove|save|cancel|open|view details|view all|view more|add|copy|download|export|duplicate|retry|restart|refresh|eliminar|borrar|guardar|ver todo|añadir|agregar|descargar|reintentar|modifier|supprimer|enregistrer|annuler|ouvrir|voir plus|voir tout|ajouter|copier|télécharger|exporter|réessayer|bearbeiten|löschen|entfernen|speichern|abbrechen|öffnen|mehr anzeigen|alle anzeigen|hinzufügen|kopieren|herunterladen|exportieren|wiederholen|modifica|elimina|rimuovi|salva|annulla|apri|vedi tutto|aggiungi|copia|scarica|esporta|riprova)$/iu;
  const ponteiro = (el) => cs(el).cursor === 'pointer';
  for (const c of corridas) {
    if (!ACAO.test(c.texto) || m.interativo(c.el) || ponteiro(c.el) || c.el.closest('h1,h2,h3,h4,h5,h6,label,th,pre,code')) continue;
    add('interatividade', 'acao-virou-texto', c.el, `"${c.texto}" reads as an action and there is no control behind it. Fix: a real button, or remove the word`);
  }
  /* rows whose state only exists as a neutral word */
  for (const g of grupos) {
    if (!g.empilhado) continue;
    const comEstado = g.itens.filter((it) => {
      const cor = m.corridasDe(it).find((c) => m.ESTADO.test(c.texto));
      if (!cor) return false;
      return !m.seloDe(cor.el) && !m.seloDe(cor.el.parentElement) && !m.cromatica(cor.cor) && !m.sinalNaLinha(it);
    });
    if (comEstado.length >= 3) {
      add('interatividade', 'estado-so-texto', g.pai, `${comEstado.length} rows carry their state as a neutral word. A scan cannot find the odd one. Fix: the status pattern of the design system (chip, dot, icon with contrast), not a neutral word`);
    }
    /* rows whose only state is a grey mark */
    const soIcone = g.itens.filter((it) => {
      if (m.interativo(it) || it.querySelector('a[href],button')) return false;
      if (m.corridasDe(it).some((c) => m.ESTADO.test(c.texto))) return false;
      if (m.sinalNaLinha(it)) return false;
      const svgsLinha = [...it.querySelectorAll('svg')].filter(vis);
      const cls = (s) => `${s.getAttribute('class') || ''} ${s.getAttribute('data-icon') || ''} ${s.getAttribute('aria-label') || ''}`;
      if (svgsLinha.some((s) => m.NOME_ESTADO.test(cls(s)) && !m.NOME_NAVEGA.test(cls(s)))) return true;
      if (m.pontos(it).length === 1) return true;
      /* an anonymous icon on the far end of the row, on a row with nothing to open */
      const ult = svgsLinha[svgsLinha.length - 1];
      if (!ult || m.NOME_NAVEGA.test(cls(ult))) return false;
      const rr = it.getBoundingClientRect();
      const ri = ult.getBoundingClientRect();
      return svgsLinha.length === 1 && rr.right - ri.right <= 32 && ri.width <= 28;
    });
    if (soIcone.length >= 3 && soIcone.length >= g.itens.length * 0.6) {
      add('interatividade', 'estado-so-icone', g.pai, `${soIcone.length} rows with state only as a grey mark: no word, no chip, no contrast. Fix: the status pattern of the design system; a muted icon alone says nothing`);
    }
  }
  /* looks clickable, does nothing */
  const ouvintes = window.__telaOuvintes;
  const chaveReact = (el) => Object.keys(el).find((k) => k.startsWith('__reactProps$'));
  const ACIONA = /^on(Click|MouseDown|MouseUp|PointerDown|PointerUp|KeyDown|Change|Submit|TouchStart)/;
  const tratador = (el) => {
    /* undefined: cannot know. true / false: read */
    let leu = !!ouvintes;
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      if (n.onclick || n.onmousedown || n.onpointerdown) return true;
      const k = chaveReact(n);
      if (k) {
        leu = true;
        if (Object.keys(n[k] || {}).some((p) => ACIONA.test(p) && n[k][p])) return true;
      }
      if (ouvintes && ouvintes.has(n) && n !== document.body) return true;
    }
    if (!leu) return undefined;
    /* a framework-less page delegating from body or document cannot be told apart */
    if (ouvintes && !chaveReact(el) && (ouvintes.has(document.body) || ouvintes.has(document))) return undefined;
    return false;
  };

  for (const el of m.todos) {
    if (el.closest('[disabled],[aria-disabled="true"],[inert],label,summary,details')) continue;
    const s = cs(el);
    const paiPonteiro = el.parentElement && getComputedStyle(el.parentElement).cursor === 'pointer';
    let motivo = null;
    if (el.tagName === 'A' && (!el.hasAttribute('href') || /^(#|javascript:)/.test(el.getAttribute('href') || '') && (el.getAttribute('href') || '').length <= 1)) motivo = 'a link with no destination';
    else if (el.tagName === 'BUTTON' && !el.closest('form')) motivo = 'an enabled button with nothing bound to it';
    else if (s.cursor === 'pointer' && !paiPonteiro && !el.matches('a[href],input,select,textarea,summary,label,[role]') && !el.closest('a[href],button')) motivo = 'a pointer cursor on something inert';
    else if (/underline/.test(s.textDecorationLine) && !el.closest('a,button,p,li,dd,article') && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) motivo = 'underlined text that goes nowhere';
    if (!motivo) continue;
    const t = tratador(el);
    if (t === undefined) naoMedido++;
    else if (!t) add('interatividade', 'parece-clicavel', el, `${motivo}. Fix: wire it or stop dressing it as a control`);
  }
  }

  /* ---- COMUNICACAO ---- */
  const estadoSinais = m.estadosComSinal;
  const visuais = m.superficies.length + m.selos.length + m.graficos.length + m.midias.length + estadoSinais + m.icones.length * 0.5;
  /* a word on a link is a destination, not reading (calibration: Hacker News, 697 words of links) */
  const palavrasLidas = corridas.filter((c) => !m.interativo(c.el)).reduce((a, c) => a + m.palavrasDe(c.texto), 0);
  const porCem = palavrasLidas ? (visuais / palavrasLidas) * 100 : 0;
  if (!m.vitrine && palavrasLidas >= 150 && !m.prosa && porCem < 1.5) {
    add('comunicacao', 'texto-demais', m.root, `${palavrasLidas} words and ${visuais} visual elements (${porCem.toFixed(1)} per 100 words). Fix: a repeating fact becomes a chip, a bar or an icon with a tooltip; not an ornament, a fact drawn`);
  }
  const normal = (t) => t.toLowerCase().trim();
  if (!m.vitrine) {
  for (const g of grupos) {
    if (g.itens.length < 4) continue;
    const conta = new Map();
    /* a word on a row with a chart labels its axis (githubstatus.com: "90 days ago") */
    for (const it of g.itens.filter((x) => !m.graficos.some((q) => x.contains(q)))) {
      const unicos = new Set(
        m.corridasDe(it)
          .filter((c) => c.texto.length <= 30 && !m.interativo(c.el) && !/\d/.test(c.texto) && !m.ESTADO.test(c.texto) && /[A-Za-zÀ-ÿ]{2}/.test(c.texto))
          /* a label owns a layout box or a colon; a word inside a running line is prose
             (calibration: GitHub's "opened 2 days ago" on every issue) */
          .filter((c) => {
            if (/:$/.test(c.texto)) return true;
            const pai = c.el.textContent.trim() === c.texto ? c.el.parentElement : c.el;
            const dp = pai ? cs(pai).display : '';
            const proprio = cs(c.el).display;
            return !/inline(?!-)/.test(proprio) || /flex|grid/.test(dp);
          })
          .map((c) => normal(c.texto)),
      );
      for (const t of unicos) conta.set(t, (conta.get(t) || 0) + 1);
    }
    /* a header row would be a single label: the same word on every row is one too many */
    for (const [t, n] of conta) {
      if (n >= 4 && n >= g.itens.length * 0.8 && !g.pai.closest('table,thead,pre')) {
        add('comunicacao', 'rotulo-repetido', g.pai, `the label "${t}" repeats on ${n} of ${g.itens.length} rows. Fix: one column header, or let the value's shape say what it is`);
        break;
      }
    }
    if (g.empilhado && g.itens.length >= 5) {
      const comLegenda = g.itens.filter((it) => {
        const rs = m.corridasDe(it);
        if (rs.length < 2 || it.getBoundingClientRect().height > 120) return false;
        const [t0, ...resto] = rs;
        return resto.some((c) => m.palavrasDe(c.texto) >= 4 && !m.interativo(c.el) && (c.tam < t0.tam || (c.cor !== t0.cor && c.tam <= t0.tam)));
      });
      if (comLegenda.length >= g.itens.length * 0.8) {
        add('comunicacao', 'legenda-em-toda-linha', g.pai, `${comLegenda.length} of ${g.itens.length} rows carry a caption. Fix: keep the caption where it changes a decision; the rest becomes help on demand (tooltip, hold to explain)`);
      }
    }
  }
  const TECNICO = /^@?[A-Za-z0-9]+(?:[-_./:][A-Za-z0-9]+)+$|^[a-z]+[A-Z][A-Za-z0-9]+$/;
  const porPai = new Map();
  for (const c of corridas) {
    if (!TECNICO.test(c.texto) || /^[A-Z]{2,}-\d+$/.test(c.texto) || c.texto.length > 48 || /^[\d.,:/-]+$/.test(c.texto) || c.el.closest('pre')) continue;
    /* calibration: a link is a destination, and an identifier beside other facts on a row is data
       (GitHub's issue rows, a model name with its cost). The defect is a list OF names. */
    if (m.interativo(c.el)) continue;
    const g = grupos.find((x) => x.itens.some((it) => it.contains(c.el) && m.corridasDe(it).length <= 2));
    const k = g ? g.pai : c.el.parentElement;
    if (!porPai.has(k)) porPai.set(k, new Set());
    porPai.get(k).add(c.texto);
  }
  for (const [k, nomes] of porPai) {
    if (nomes.size >= 6) add('comunicacao', 'nomes-tecnicos', k, `${nomes.size} identifiers side by side: the owner reads config, not state. Fix: an icon with a tooltip per kind, or a count that opens the list`);
  }
  /* THE OPPOSITE: decoration in excess. Without this, the axis above would reward ornament. */
  const porPaiSelo = new Map();
  for (const el of m.selosInertes) {
    const k = el.parentElement;
    porPaiSelo.set(k, (porPaiSelo.get(k) || 0) + 1);
  }
  let empilhados = 0;
  for (const [k, n] of porPaiSelo) {
    if (n >= 5) {
      empilhados++;
      add('comunicacao', 'pilha-de-selos', k, `${n} inert chips in one place: emphasis on everything is emphasis on nothing. Fix: one chip for the state that decides, the rest as text or gone`);
    }
  }
  if (!empilhados) {
    for (const g of grupos) {
      const cheias = g.itens.filter((it) => m.selosInertes.filter((s) => it.contains(s)).length >= 3);
      if (cheias.length >= 3) add('comunicacao', 'pilha-de-selos', g.pai, `${cheias.length} rows with 3+ inert chips each. Fix: one chip per row, for the state that decides`);
    }
  }
  const assinaturaIcone = (s) => [...s.querySelectorAll('path,circle,rect,line,polyline')].map((n) => n.getAttribute('d') || n.outerHTML).join('|');
  for (const g of grupos) {
    if (g.itens.length < 5) continue;
    if (g.itens.some((it) => m.interativo(it) || it.querySelector('a[href],button'))) continue;
    const marcas = g.itens.map((it) => {
      const s = [...it.querySelectorAll('svg')].find(vis);
      if (!s) return null;
      const ri = s.getBoundingClientRect();
      const rr = it.getBoundingClientRect();
      if (ri.left - rr.left > 64 || ri.width > 40 || m.iconeCromatico(s)) return null;
      return assinaturaIcone(s);
    });
    const c = new Map();
    for (const x of marcas) if (x) c.set(x, (c.get(x) || 0) + 1);
    const top = Math.max(0, ...c.values());
    if (top >= 5 && top >= g.itens.length * 0.8) {
      add('comunicacao', 'icones-decorativos', g.pai, `the same neutral icon leads ${top} of ${g.itens.length} items: repeated, it carries no information. Fix: a different icon per kind, or none`);
    }
  }
  }

  if (verbose) {
    const bar = '-'.repeat(64);
    console.log(`\ntela-scan · ${m.todos.length} elements, ${m.palavras} words, ${m.superficies.length} surfaces at ${m.W}px`);
    if (!achados.length) console.log('[OK] nothing measured as lost.');
    for (const a of achados) console.log(`[${a.eixo}/${a.regra}] ${a.el}\n     ${a.detalhe}`);
    console.log(bar);
    if (m.vitrine) console.log('Showcase page (display-size heading): row-level rules are off, its DOM may be drawn illustration.');
    if (naoMedido) console.log(`${naoMedido} control(s) not measured: no way to read their handlers on this page.`);
    console.log('A zero here says nothing was lost, not that the screen is good: compare before and after with your eyes.');
    console.log(bar);
  }
  achados.naoMedido = naoMedido;
  achados.vitrine = m.vitrine;
  /* acao-virou-texto and estado-so-texto read words: outside these languages they cannot fire, and that is not a pass */
  const idioma = (document.documentElement.lang || '').slice(0, 2).toLowerCase();
  achados.idiomaSemLista = idioma && !['pt', 'en', 'es', 'fr', 'de', 'it'].includes(idioma) ? idioma : null;
  return achados;
}

if (typeof module !== 'undefined') module.exports = { tela, retrato };
