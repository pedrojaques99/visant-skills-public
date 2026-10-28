#!/usr/bin/env node
// verify-screens — abre as telas do app LOGADO, mede e fotografa. É o Passo 5 do killer em script.
//
// Irmão do corta-url.mjs: aquele mede URL publicada sem login; este mede o app local atrás do login,
// em várias larguras e nos dois temas, e trava rota que gasta crédito ao carregar.
//
//   node verify-screens.mjs                                   # rotas do navConfig, 1366+390, dark, dev-login
//   node verify-screens.mjs --routes /,/apps,/references --theme both
//   node verify-screens.mjs --routes-from navConfig --widths 390 --out ./shots
//   node verify-screens.mjs --scan-paid                       # lista useEffect que chama IA paga (heurística)
//   node verify-screens.mjs --self-check                      # testa o parsing sem abrir navegador
//
// Flags
//   --base URL          app (vite). Default http://localhost:5199
//   --api URL           backend pro dev-login. Default = --base (o vite proxia /api)
//   --routes a,b        rotas explícitas. Sem barra também vale ('apps' = '/apps')
//   --routes-from X     'navConfig' (src/config/navConfig.ts) ou caminho de arquivo: pega todo `to: '/...'`
//   --widths 1366,390   larguras do viewport
//   --theme dark|light|both   grava localStorage[--theme-key] antes do app subir e confere a classe .dark
//   --theme-key theme   chave do useTheme (src/hooks/useTheme.ts)
//   --login dev|none    dev = POST /api/auth/dev-login, token em localStorage.auth_token
//   --email x           usuário do dev-login (default: DEV_EMAIL, senão o 1º admin)
//   --wait 7000         ms depois do networkidle (hidratação + fetch atrasado)
//   --out DIR           prints + report.json. Default: <tmp>/verify-screens
//   --skip-paid a,b     rotas que disparam IA ao montar. Default: /naming (confirmado no código)
//   --allow-paid        abre as rotas pagas E deixa passar POST pra endpoint pago
//
// TRAVA DE ROTA PAGA. Abrir /naming na base real cobrou e estornou crédito (NamingMachinePage: sessão
// salva em phase 'deck' + deck vazio => useEffect chama fetchBatch => POST /api/ai/generate-naming).
// Duas camadas: (1) a rota da lista --skip-paid nem abre; (2) em TODA rota, POST que casa PAID_API é
// abortado no navegador e aparece em `paidBlocked` no relatório. A camada 2 pega a rota paga que
// ninguém pôs na lista. Achou rota nova que gasta ao carregar? Some na lista DEFAULT_SKIP_PAID.
//
// Playwright é resolvido a partir do repo-alvo (createRequire no cwd), com fallback pro cache do npx:
// o script roda de dentro da skill sem node_modules ao lado.
//
// Rode de Git Bash com MSYS_NO_PATHCONV=1 ou passe rota sem barra: '/apps' vira 'C:/Program Files/Git/apps'.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const DEFAULT_SKIP_PAID = ['/naming'];
// POST que custa provedor. GET nunca é bloqueado (lista, cache-only, leitura).
export const PAID_API =
  /\/api\/(ai\/|mockups\/generate|video\/generate|chat\/|playground\/(generate|iterate)|creative\/(generate|render|full)|branding\/generate|campaigns?\/generate|moodboard\/(suggest|upscale)|brand-guidelines\/[^/]+\/(suggest-mockups|assets\/analyze|ingest))/;

/* ── args ─────────────────────────────────────────────────────────────── */
export function parseArgs(argv) {
  const o = {
    base: 'http://localhost:5199',
    api: null,
    routes: null,
    routesFrom: null,
    widths: [1366, 390],
    theme: 'dark',
    themeKey: 'theme',
    login: 'dev',
    email: process.env.DEV_EMAIL || '',
    wait: 7000,
    out: path.join(os.tmpdir(), 'verify-screens'),
    skipPaid: DEFAULT_SKIP_PAID,
    allowPaid: false,
    selfCheck: false,
    scanPaid: false,
  };
  const val = (i) => {
    if (argv[i + 1] === undefined) throw new Error(`falta valor pra ${argv[i]}`);
    return argv[i + 1];
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base') o.base = val(i++).replace(/\/$/, '');
    else if (a === '--api') o.api = val(i++).replace(/\/$/, '');
    else if (a === '--routes') o.routes = splitRoutes(val(i++));
    else if (a === '--routes-from') o.routesFrom = val(i++);
    else if (a === '--widths') o.widths = val(i++).split(',').map(Number).filter(Boolean);
    else if (a === '--theme') o.theme = val(i++);
    else if (a === '--theme-key') o.themeKey = val(i++);
    else if (a === '--login') o.login = val(i++);
    else if (a === '--email') o.email = val(i++);
    else if (a === '--wait') o.wait = Number(val(i++));
    else if (a === '--out') o.out = path.resolve(val(i++));
    else if (a === '--skip-paid') o.skipPaid = splitRoutes(val(i++));
    else if (a === '--allow-paid') o.allowPaid = true;
    else if (a === '--self-check') o.selfCheck = true;
    else if (a === '--scan-paid') o.scanPaid = true;
    else throw new Error(`flag desconhecida: ${a}`);
  }
  if (!['dark', 'light', 'both'].includes(o.theme)) throw new Error('--theme é dark|light|both');
  if (!['dev', 'none'].includes(o.login)) throw new Error('--login é dev|none');
  o.api = o.api || o.base;
  return o;
}

export function normRoute(r) {
  // desfaz a conversão de caminho do MSYS (Git Bash): '/apps' chega como 'C:/Program Files/Git/apps'
  const s = r.trim().replace(/^[A-Za-z]:[\\/].*?Git[\\/]/, '/').replace(/\\/g, '/');
  if (!s || s === 'home') return '/';
  return s.startsWith('/') ? s : '/' + s;
}
const splitRoutes = (s) => [...new Set(s.split(',').filter(Boolean).map(normRoute))];

export function routesFromFile(src) {
  const out = new Set();
  for (const m of src.matchAll(/\bto:\s*['"`](\/[^'"`$]*)['"`]/g)) out.add(m[1]);
  return [...out];
}

export function isPaidRoute(route, skip) {
  const p = route.split('?')[0];
  return skip.some((s) => p === s || p.startsWith(s.replace(/\/$/, '') + '/'));
}

/* ── chave i18n crua ──────────────────────────────────────────────────── */
export function loadNamespaces(cwd) {
  for (const f of ['src/locales/pt-BR.json', 'src/locales/en-US.json', 'locales/pt-BR.json']) {
    const p = path.join(cwd, f);
    if (fs.existsSync(p)) return Object.keys(JSON.parse(fs.readFileSync(p, 'utf8')));
  }
  return [];
}
// Texto de folha com cara de chave. Com namespaces do locale, só conta se o 1º segmento for um
// namespace real: sem isso 'api.visantlabs.com' vira "chave crua".
const RAW_KEY = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9_-]+){2,}$/;
export function isRawKey(text, namespaces) {
  if (!RAW_KEY.test(text)) return false;
  if (!namespaces.length) return !/\.(com|br|io|app|dev|net|org|ai)$/.test(text);
  return namespaces.includes(text.split('.')[0]);
}

/* ── heurística de rota paga ──────────────────────────────────────────── */
const PAID_CALL =
  /\b(generateNaming|namingPatternInsight|namingBriefing|analyzeSetup|generateSmartPrompt|suggestPromptVariations|describeImage|improvePrompt|suggestCategories|changeObject|applyTheme|refineSuggestions|suggestMockups|analyzeAssets|fetchBatch)\s*\(|\/(mockups|video|playground)\/generate|force:\s*true/;
export function scanPaid(cwd) {
  const walk = (d) =>
    fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory()
        ? e.name === 'node_modules' ? [] : walk(path.join(d, e.name))
        : /\.(t|j)sx?$/.test(e.name) ? [path.join(d, e.name)] : []
    );
  const hits = [];
  const root = path.join(cwd, 'src');
  if (!fs.existsSync(root)) return hits;
  for (const f of walk(root)) {
    const L = fs.readFileSync(f, 'utf8').split('\n');
    L.forEach((l, i) => {
      if (!/useEffect\(/.test(l)) return;
      // corpo do efeito até o fechamento `}, [` mais próximo, no máximo 30 linhas
      let end = i + 1;
      while (end < L.length && end < i + 30 && !/^\s*\}\s*,\s*\[/.test(L[end])) end++;
      const m = L.slice(i, end + 1).join('\n').match(PAID_CALL);
      if (m) hits.push(`${path.relative(cwd, f)}:${i + 1}  ${m[0].trim()}`);
    });
  }
  return hits;
}

/* ── playwright do repo-alvo ──────────────────────────────────────────── */
async function loadPlaywright() {
  try {
    const req = createRequire(path.join(process.cwd(), 'package.json'));
    return req('playwright');
  } catch {}
  const cache = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'npm-cache', '_npx');
  for (const d of fs.existsSync(cache) ? fs.readdirSync(cache) : []) {
    const p = path.join(cache, d, 'node_modules', 'playwright', 'index.js');
    if (fs.existsSync(p)) {
      const m = await import(pathToFileURL(p).href);
      return m.default ?? m;
    }
  }
  throw new Error('playwright não achado no repo-alvo nem no cache do npx. Rode do repo, ou: npx playwright --version');
}

/* ── self-check (sem navegador) ───────────────────────────────────────── */
function selfCheck() {
  const t = [];
  const eq = (name, got, want) => t.push([name, JSON.stringify(got) === JSON.stringify(want), got]);
  eq('msys route', normRoute('C:/Program Files/Git/apps'), '/apps');
  eq('route sem barra', normRoute('apps'), '/apps');
  eq('home', normRoute('home'), '/');
  eq('navConfig', routesFromFile(`{ to: '/apps' }, { to: "/profile?tab=x" }, { to: \`/x/\${id}\` }`), ['/apps', '/profile?tab=x']);
  eq('paga exata', isPaidRoute('/naming', DEFAULT_SKIP_PAID), true);
  eq('paga filha', isPaidRoute('/naming/abc?x=1', DEFAULT_SKIP_PAID), true);
  eq('não paga', isPaidRoute('/naming-x', DEFAULT_SKIP_PAID), false);
  eq('api paga', PAID_API.test('http://localhost:5199/api/ai/generate-naming'), true);
  eq('api grátis', PAID_API.test('http://localhost:5199/api/brand-guidelines/1/suggestions?cacheOnly=true'), false);
  const ns = ['nav', 'apps'];
  eq('chave crua', isRawKey('nav.apps.label', ns), true);
  eq('domínio não é chave', isRawKey('api.visantlabs.com', ns), false);
  eq('frase não é chave', isRawKey('Meus mockups', ns), false);
  eq('sem locale, domínio', isRawKey('api.visantlabs.com', []), false);
  const o = parseArgs(['--routes', 'apps,/naming', '--theme', 'both', '--widths', '390']);
  eq('args', [o.routes, o.theme, o.widths], [['/apps', '/naming'], 'both', [390]]);
  let fail = 0;
  for (const [n, ok, got] of t) {
    if (!ok) fail++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${ok ? '' : '  -> ' + JSON.stringify(got)}`);
  }
  console.log(fail ? `\n${fail} falha(s)` : `\n${t.length}/${t.length} ok`);
  return fail ? 1 : 0;
}

/* ── main ─────────────────────────────────────────────────────────────── */
async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.selfCheck) process.exit(selfCheck());
  if (o.scanPaid) {
    const hits = scanPaid(process.cwd());
    console.log(hits.length ? hits.join('\n') : 'nenhum useEffect chamando IA paga (heurística)');
    console.log('\nCandidato, não veredito: leia o efeito. Confirmado => some em DEFAULT_SKIP_PAID.');
    return;
  }

  const cwd = process.cwd();
  let routes = o.routes;
  if (!routes) {
    const f = !o.routesFrom || o.routesFrom === 'navConfig' ? path.join(cwd, 'src/config/navConfig.ts') : path.resolve(o.routesFrom);
    if (!fs.existsSync(f)) throw new Error(`sem --routes e sem ${f}`);
    routes = routesFromFile(fs.readFileSync(f, 'utf8'));
  }
  const skipped = o.allowPaid ? [] : routes.filter((r) => isPaidRoute(r, o.skipPaid));
  routes = routes.filter((r) => !skipped.includes(r));
  const themes = o.theme === 'both' ? ['dark', 'light'] : [o.theme];
  const namespaces = loadNamespaces(cwd);
  const corta = fs.readFileSync(path.join(here, 'corta-scan.js'), 'utf8').replace(/if \(typeof module[\s\S]*$/, '');
  fs.mkdirSync(o.out, { recursive: true });

  let token = null;
  if (o.login === 'dev') {
    const res = await fetch(`${o.api}/api/auth/dev-login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: o.email }),
    }).catch((e) => {
      throw new Error(`dev-login inalcançável em ${o.api} (${e.message}). App no ar? (ver references/ambiente.md)`);
    });
    token = (await res.json().catch(() => ({}))).token;
    if (!token) throw new Error(`dev-login sem token (HTTP ${res.status})`);
  }

  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch();
  const report = [];
  for (const theme of themes) {
    for (const width of o.widths) {
      const ctx = await browser.newContext({ viewport: { width, height: width > 500 ? 900 : 844 } });
      await ctx.addInitScript(
        ({ token, theme, key }) => {
          try {
            if (token) localStorage.setItem('auth_token', token);
            localStorage.setItem(key, theme);
          } catch {}
        },
        { token, theme, key: o.themeKey }
      );
      if (!o.allowPaid) {
        await ctx.route(PAID_API, (route) =>
          route.request().method() === 'GET' ? route.continue() : route.abort('blockedbyclient')
        );
      }
      const page = await ctx.newPage();
      for (const route of routes) {
        const errors = [];
        const apiFail = [];
        const paidBlocked = [];
        const onConsole = (m) => m.type() === 'error' && errors.push(m.text().slice(0, 160));
        const onPageError = (e) => errors.push('PAGEERROR ' + String(e).slice(0, 160));
        const onResponse = (r) => {
          if (r.status() >= 400 && /\/api\//.test(r.url())) apiFail.push(`${r.status()} ${new URL(r.url()).pathname}`);
        };
        const onFailed = (r) => {
          if (PAID_API.test(r.url()) && r.method() !== 'GET') paidBlocked.push(`${r.method()} ${new URL(r.url()).pathname}`);
        };
        page.on('console', onConsole);
        page.on('pageerror', onPageError);
        page.on('response', onResponse);
        page.on('requestfailed', onFailed);
        try {
          await page.goto(o.base + route, { waitUntil: 'networkidle', timeout: 90000 });
        } catch (e) {
          errors.push('GOTO ' + String(e).slice(0, 120));
        }
        await page.waitForTimeout(o.wait);
        const measure = async () => {
        await page.addScriptTag({ content: corta }).catch(() => {});
        return page.evaluate(
          ({ namespaces, rawRe }) => {
            const d = document.documentElement;
            let c = [];
            try {
              // serializa sem o nó DOM (`.no`): ele não atravessa o evaluate
              c = (typeof corta === 'function' ? corta('body', { verbose: false }) || [] : ['corta-scan não carregou']).map(
                (a) => (typeof a === 'string' ? a : `[${a.regra}] ${a.el} — ${a.detalhe}`)
              );
            } catch (e) {
              c = ['corta erro ' + e];
            }
            const re = new RegExp(rawRe);
            const raw = [...document.body.querySelectorAll('*')]
              .filter((n) => n.children.length === 0)
              .map((n) => (n.textContent || '').trim())
              // mesma regra do isRawKey (não dá pra passar função pro evaluate)
              .filter(
                (t) =>
                  re.test(t) &&
                  (namespaces.length ? namespaces.includes(t.split('.')[0]) : !/\.(com|br|io|app|dev|net|org|ai)$/.test(t))
              )
              .slice(0, 8);
            return {
              overflow: d.scrollWidth - d.clientWidth,
              corta: c.slice(0, 8),
              rawKeys: raw,
              darkClass: d.classList.contains('dark'),
              // tela em branco (chunk lazy não chegou, crash engolido) passa em estouro/corte/chave: conta texto
              textLen: (document.body.innerText || '').trim().length,
              title: document.title,
            };
          },
          { namespaces, rawRe: RAW_KEY.source }
        );
        };
        let m = await measure();
        // Tela vazia quase sempre é o dev server recompilando (HMR de outro agente, chunk lazy frio):
        // espera mais uma vez antes de reportar. Se continuar vazia, aí é achado.
        let retried = false;
        if (m.textLen < 20) {
          retried = true;
          await page.waitForTimeout(o.wait);
          m = await measure();
        }
        const blank = m.textLen < 20;
        // a classe .dark é aplicada num efeito do app: em tela vazia ela não diz nada sobre o tema
        const themeOk = blank || m.darkClass === (theme === 'dark');
        const file = `${theme}-${width}${route.replace(/[/?=&]/g, '_') || '_root'}.png`;
        await page.screenshot({ path: path.join(o.out, file) });
        page.off('console', onConsole);
        page.off('pageerror', onPageError);
        page.off('response', onResponse);
        page.off('requestfailed', onFailed);
        const row = { route, theme, width, blank, retried, themeOk, ...m, errors: errors.slice(0, 6), apiFail: [...new Set(apiFail)].slice(0, 6), paidBlocked, file };
        report.push(row);
        const bad = blank || m.overflow > 0 || m.corta.length || m.rawKeys.length || errors.length || !themeOk || paidBlocked.length;
        console.log(
          `${bad ? 'ACHOU' : 'OK   '} ${theme.padEnd(5)} ${String(width).padStart(4)} ${route.padEnd(30)} ` +
            `estouro=${m.overflow} corta=${m.corta.length} chave=${m.rawKeys.length} erro=${errors.length} ` +
            `api4xx5xx=${row.apiFail.length}${blank ? ' TELA-VAZIA' : ''}${themeOk ? '' : ' TEMA-NAO-APLICOU'}${paidBlocked.length ? ' PAGO-BLOQUEADO=' + paidBlocked.length : ''}`
        );
      }
      await ctx.close();
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(o.out, 'report.json'), JSON.stringify({ base: o.base, skippedPaid: skipped, report }, null, 2));
  if (skipped.length) console.log(`\nNÃO abertas (rota paga, use --allow-paid): ${skipped.join(', ')}`);
  console.log(`\nprints + report.json em ${o.out}`);
  console.log('Achado é candidato: abra o print e confirme antes de consertar. api4xx5xx não reprova sozinho (backend local).');
  const fails = report.filter((r) => r.blank || r.overflow > 0 || r.corta.length || r.rawKeys.length || r.errors.length || !r.themeOk).length;
  process.exit(fails ? 1 : 0);
}

main().catch((e) => {
  console.error('verify-screens:', e.message);
  process.exit(2);
});
