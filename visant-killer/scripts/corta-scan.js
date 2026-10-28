/**
 * corta-scan — o que só a TELA ABERTA sabe: texto cortado e overlay empilhado.
 *
 * Por que existe. Em 2026-09-11 um painel passou pelos quatro detectores, pelo
 * `tsc`, pelo `ui:audit` e por 2347 testes, e no print o usuário leu **"tirar
 * da"** dentro de um card — metade de "tirar da fila". A pílula tinha
 * `white-space: nowrap` e vivia num quadrado de 96px com `overflow: hidden`. Não
 * havia linha errada em nenhum arquivo: a largura da palavra só existe depois de
 * a fonte carregar e o layout acontecer.
 *
 * Nenhum detector estático pega esta classe. Este é o outro lado da moeda do
 * Passo 5 do SKILL.md ("a primeira linha é abrir a tela") — que mandava olhar e
 * não dava ferramenta pra medir o que olhar.
 *
 * As três coisas que ele mede, e que a vista desarmada erra:
 *
 *   1. **texto-cortado** — elemento cujo conteúdo é maior que a caixa e não tem
 *      saída anunciada (nem `text-overflow: ellipsis`, nem `-webkit-line-clamp`,
 *      nem scroll próprio). Isto é a palavra pela metade.
 *   2. **overlay-empilhado** — dois overlays absolutos que se sobrepõem dentro do
 *      mesmo pai posicionado. O de z-index maior esconde o outro, e quase sempre
 *      o escondido é a AÇÃO (foi o que aconteceu no card com a pasta de coleções
 *      no mesmo canto do disco de ação).
 *   3. **fora-do-pai** — overlay que sai da caixa recortada do pai: ele existe no
 *      DOM, não existe na tela, e nenhum teste reclama.
 *
 * Como rodar — duas formas, e a segunda é a que vale em repo com login:
 *
 *   // a) num harness Playwright que já abriu a tela:
 *   const achados = await page.evaluate(fs.readFileSync('corta-scan.js','utf8') + ';corta()')
 *
 *   // b) cole o arquivo no console do navegador, com a tela na largura que
 *   //    importa (390px é onde tudo quebra), e chame:
 *   corta()                  // toda a página
 *   corta('.dir-panel')      // só dentro de um painel
 *
 * O que ele NÃO faz: julgar. Achado é candidato — um `nowrap` cortado dentro de
 * um trilho que rola de lado é escolha legítima, e o script diz "há scroll
 * próprio" em vez de acusar. Confirme no pixel, como todo achado desta skill.
 */

/* eslint-disable no-undef */
function corta(raiz = 'body', { verbose = true } = {}) {
  const root = typeof raiz === 'string' ? document.querySelector(raiz) : raiz;
  if (!root) return console.warn(`corta-scan: não achei "${raiz}"`);

  const achados = [];
  const cs = (el) => getComputedStyle(el);
  const vis = (el) => {
    const s = cs(el);
    if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
    // Conteúdo só-leitor-de-tela (skip link, sr-only) é recortado DE PROPÓSITO: não é texto comido.
    // Falso positivo no audit da MN Group (2026-09-28): 'Pular para o conteúdo' acusado em toda rota.
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
  /* 1 · texto cortado sem saída anunciada                            */
  /* ---------------------------------------------------------------- */
  for (const el of todos) {
    /* só quem TEM texto próprio: um container que corta o filho é problema do
       filho, e acusar os dois faz o mesmo defeito aparecer em cascata */
    const texto = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!texto) continue;
    const s = cs(el);
    /*
     * DUAS geometrias, e o caso real desta skill era a SEGUNDA.
     *
     * (a) a caixa corta o próprio conteúdo — `scrollWidth > clientWidth`. É o
     *     texto longo dentro de uma caixa de largura fixa.
     * (b) a caixa INTEIRA sai de um ancestral que recorta. Foi o que aconteceu
     *     com a pílula do jukebox: ela tem `position: absolute`, então cresce
     *     até caber no próprio conteúdo — `scrollWidth` e `clientWidth` são
     *     iguais, ela se acha inteira — e é o card de 96px com `overflow:
     *     hidden` que come as pontas. Uma primeira versão desta regra só media
     *     (a) e devolveu ZERO contra o defeito que a gerou.
     */
    const sobraX = el.scrollWidth - el.clientWidth;
    const sobraY = el.scrollHeight - el.clientHeight;
    /* saídas LEGÍTIMAS, e por isso caladas: reticências, clamp de linha, ou uma
       barra de rolagem própria (trilho que rola de lado é escolha, não bug) */
    if (s.textOverflow === 'ellipsis') continue;
    /* `-webkit-line-clamp` corta de propósito, com reticências, e nesse caso
       `scrollHeight` é SEMPRE maior que `clientHeight` — acusar isso seria
       acusar a saída anunciada de ser o defeito que ela resolve. */
    if (s.webkitLineClamp && s.webkitLineClamp !== 'none') continue;
    if (/(auto|scroll)/.test(s.overflowX + s.overflowY)) continue;

    /*
     * O ancestral que recorta — e a separação que custou 12 falsos positivos
     * numa única rodada contra a tela de verdade.
     *
     * ROLAGEM NÃO É CORTE. A primeira versão subia até o primeiro ancestral com
     * `overflow: hidden` e media a distância. Num painel com lista, isso acusou
     * onze linhas de `~5h28`, `~5h32`, `~5h35`… "comidas" por 8px, 51px, 94px,
     * 137px — a progressão aritmética é a assinatura do defeito: eram os itens
     * MAIS ABAIXO no scroll, cada um mais longe que o anterior. Estar fora da
     * janela de um contêiner que rola não é estar cortado; é estar depois.
     *
     * Dois guards, e os dois são sobre a mesma distinção:
     *   - a subida PARA no primeiro ancestral que rola: se algo entre o texto e
     *     o recorte tem `overflow: auto|scroll`, a posição é assunto do scroll;
     *   - o achado exige recorte PARCIAL: caixa que não encosta na janela do
     *     ancestral está fora de vista, não pela metade.
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
      /* nada em comum com a janela do pai = fora de vista, não cortado */
      if (cruzaX > 1 && cruzaY > 1) {
        comido = Math.max(
          Math.max(0, P.left - F.left) + Math.max(0, F.right - P.right),
          Math.max(0, P.top - F.top) + Math.max(0, F.bottom - P.bottom),
        );
        /* ... e o que sobra tem que ser MAIOR que o que foi comido: um resto de
           2px de palavra é outra coisa (peça fora de lugar), não texto cortado */
        if (comido > Math.max(cruzaX, cruzaY)) comido = 0;
      }
    }
    const proprio = sobraX >= 2 || sobraY >= 2;
    /* 1px é arredondamento de subpixel, não palavra pela metade */
    if (!proprio && comido < 2) continue;
    achados.push({
      regra: 'texto-cortado',
      el: nome(el),
      detalhe: proprio
        ? `a própria caixa corta ${sobraX >= 2 ? sobraX + 'px de largura' : sobraY + 'px de altura'}${
            s.whiteSpace === 'nowrap' ? ' · white-space: nowrap' : ''
          }${recorta ? '' : ' · e nenhum pai recorta: está vazando pra fora'}`
        : `${Math.round(comido)}px comidos por ${nome(recorta)}, que recorta${
            s.whiteSpace === 'nowrap' ? ' · white-space: nowrap e sem max-width' : ''
          }`,
      no: el,
    });
  }

  /* ---------------------------------------------------------------- */
  /* 2 e 3 · overlay empilhado no mesmo canto, e overlay fora do pai   */
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
    /* fração da MENOR das duas: é ela que desaparece */
    return area / Math.min(A.width * A.height, B.width * B.height);
  };
  for (const [pai, filhos] of porPai) {
    for (let i = 0; i < filhos.length; i++) {
      for (let j = i + 1; j < filhos.length; j++) {
        const f = cobre(filhos[i], filhos[j]);
        /* 40%: abaixo disso é encosto de canto, que é comum e legível */
        if (f < 0.4) continue;
        const zi = +cs(filhos[i]).zIndex || 0;
        const zj = +cs(filhos[j]).zIndex || 0;
        /* empate de z-index: quem vem DEPOIS no DOM pinta por cima (j > i) */
        const [em_cima, embaixo] = zi > zj ? [filhos[i], filhos[j]] : [filhos[j], filhos[i]];
        /*
         * SELO SOBRE FUNDO não é empilhamento. Falso positivo de 2026-10-05: o
         * texto "Pública" (selo de canto) acusado sobre o fallback `inset-0` da
         * capa do card de marca. O fallback é o fundo do card, não uma peça que
         * some: o selo cobre 100% de SI MESMO dentro dele, e a fração "da menor"
         * dava 100%. Regra: se o de cima ocupa < 25% da área do de baixo e o de
         * baixo não tem nada interativo, é selo sobre fundo, e cala. O caso real
         * (botão de pasta no mesmo canto do disco de ação) segue acusado: as
         * duas peças têm tamanho parecido.
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
          detalhe: `${Math.round(f * 100)}% coberto por ${nome(em_cima)} (z-index ${Math.max(zi, zj)} sobre ${Math.min(zi, zj)}) dentro de ${nome(pai)}`,
          no: embaixo,
        });
      }
    }
    const ps = cs(pai);
    const ov = ps.overflowX + ps.overflowY;
    /* mesma lição da regra 1: num contêiner que ROLA, estar fora da janela é
       estar mais abaixo — e acusar isso é acusar toda lista longa */
    if (/auto|scroll/.test(ov)) continue;
    if (!/hidden|clip/.test(ov)) continue;
    const P = pai.getBoundingClientRect();
    for (const f of filhos) {
      /* quem TEM texto próprio já foi julgado pela regra 1, com a mensagem que
         fala de palavra cortada — dois achados pro mesmo pixel mandam a pessoa
         consertar duas vezes */
      if ([...f.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1)) continue;
      const F = f.getBoundingClientRect();
      const foraX = Math.max(0, P.left - F.left) + Math.max(0, F.right - P.right);
      const foraY = Math.max(0, P.top - F.top) + Math.max(0, F.bottom - P.bottom);
      if (foraX < 2 && foraY < 2) continue;
      achados.push({
        regra: 'fora-do-pai',
        el: nome(f),
        detalhe: `${Math.round(foraX || foraY)}px fora de ${nome(pai)}, que recorta — existe no DOM, não existe na tela`,
        no: f,
      });
    }
  }

  if (verbose) {
    const bar = '-'.repeat(64);
    console.log(`\ncorta-scan · ${todos.length} elementos visíveis em ${window.innerWidth}px`);
    if (!achados.length) {
      console.log('[OK] nada cortado, nada empilhado, nada fora do pai.');
      console.log(bar);
      console.log('Zero aqui é sobre GEOMETRIA, não sobre gosto: o que sobrou pode');
      console.log('estar inteiro e ainda não merecer o lugar que ocupa.');
      console.log(bar);
    } else {
      for (const a of achados) console.log(`[${a.regra}] ${a.el}\n     ${a.detalhe}`);
      console.log(bar);
      console.log(`${achados.length} candidato(s). Cada um tem o nó em \`.no\` — passe o mouse`);
      console.log('no objeto do console pra ele acender na página antes de consertar.');
      console.log(bar);
    }
  }
  return achados;
}

if (typeof module !== 'undefined') module.exports = { corta };
