#!/usr/bin/env node
// verify-screens: opens the screens of the LOGGED-IN app, measures and screenshots them. It is killer Step 5 as a script.
//
// Sibling of corta-url.mjs: that one measures a published URL without login; this one measures the local app
// behind login, at several widths and in both themes, and blocks routes that spend credits on load.
//
//   node verify-screens.mjs                                   # navConfig routes, 1366+390, dark, dev-login
//   node verify-screens.mjs --routes /,/apps,/references --theme both
//   node verify-screens.mjs --routes-from navConfig --widths 390 --out ./shots
//   node verify-screens.mjs --scan-paid                       # lists useEffects that call paid AI (heuristic)
//   node verify-screens.mjs --self-check                      # tests the parsing without opening a browser
//
// Flags
//   --base URL          app (vite). Default http://localhost:5199
//   --api URL           backend for dev-login. Default = --base (vite proxies /api)
//   --routes a,b        explicit routes. Without a slash also works ('apps' = '/apps')
//   --routes-from X     'navConfig' (src/config/navConfig.ts) or a file path: takes every `to: '/...'`
//   --widths 1366,390   viewport widths
//   --theme dark|light|both   writes localStorage[--theme-key] before the app boots and checks the .dark class
//   --theme-key theme   useTheme key (src/hooks/useTheme.ts)
//   --login dev|none    dev = POST /api/auth/dev-login, token in localStorage.auth_token
//   --email x           dev-login user (default: DEV_EMAIL, otherwise the first admin)
//   --wait 7000         ms after networkidle (hydration + late fetch)
//   --out DIR           screenshots + report.json. Default: <tmp>/verify-screens
//   --skip-paid a,b     routes that fire AI on mount. Default: /naming (confirmed in code)
//   --allow-paid        opens the paid routes AND lets POSTs to paid endpoints through
//
// PAID ROUTE LOCK. Opening /naming on the real database charged and refunded credits (NamingMachinePage:
// session saved in phase 'deck' + empty deck => useEffect calls fetchBatch => POST /api/ai/generate-naming).
// Two layers: (1) a route in the --skip-paid list is never opened; (2) on EVERY route, a POST matching PAID_API
// is aborted in the browser and shows up in `paidBlocked` in the report. Layer 2 catches the paid route
// nobody put on the list. Found a new route that spends on load? Add it to DEFAULT_SKIP_PAID.
//
// Playwright is resolved from the target repo (createRequire in the cwd), with a fallback to the npx cache:
// the script runs from inside the skill with no node_modules next to it.
//
// Run from Git Bash with MSYS_NO_PATHCONV=1 or pass routes without a slash: '/apps' becomes 'C:/Program Files/Git/apps'.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const DEFAULT_SKIP_PAID = ['/naming'];
// POSTs that cost provider money. GET is never blocked (list, cache-only, read).
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
    if (argv[i + 1] === undefined) throw new Error(`missing value for ${argv[i]}`);
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
    else throw new Error(`unknown flag: ${a}`);
  }
  if (!['dark', 'light', 'both'].includes(o.theme)) throw new Error('--theme is dark|light|both');
  if (!['dev', 'none'].includes(o.login)) throw new Error('--login is dev|none');
  o.api = o.api || o.base;
  return o;
}

export function normRoute(r) {
  // undoes MSYS (Git Bash) path conversion: '/apps' arrives as 'C:/Program Files/Git/apps'
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

/* ── raw i18n key ─────────────────────────────────────────────────────── */
export function loadNamespaces(cwd) {
  for (const f of ['src/locales/pt-BR.json', 'src/locales/en-US.json', 'locales/pt-BR.json']) {
    const p = path.join(cwd, f);
    if (fs.existsSync(p)) return Object.keys(JSON.parse(fs.readFileSync(p, 'utf8')));
  }
  return [];
}
// Leaf text that looks like a key. With locale namespaces, it only counts if the first segment is a
// real namespace: without that, 'api.visantlabs.com' becomes a "raw key".
const RAW_KEY = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9_-]+){2,}$/;
export function isRawKey(text, namespaces) {
  if (!RAW_KEY.test(text)) return false;
  if (!namespaces.length) return !/\.(com|br|io|app|dev|net|org|ai)$/.test(text);
  return namespaces.includes(text.split('.')[0]);
}

/* ── paid route heuristic ─────────────────────────────────────────────── */
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
      // effect body up to the nearest closing `}, [`, at most 30 lines
      let end = i + 1;
      while (end < L.length && end < i + 30 && !/^\s*\}\s*,\s*\[/.test(L[end])) end++;
      const m = L.slice(i, end + 1).join('\n').match(PAID_CALL);
      if (m) hits.push(`${path.relative(cwd, f)}:${i + 1}  ${m[0].trim()}`);
    });
  }
  return hits;
}

/* ── playwright from the target repo ──────────────────────────────────── */
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
  throw new Error('playwright not found in the target repo or the npx cache. Run from the repo, or: npx playwright --version');
}

/* ── self-check (no browser) ──────────────────────────────────────────── */
function selfCheck() {
  const t = [];
  const eq = (name, got, want) => t.push([name, JSON.stringify(got) === JSON.stringify(want), got]);
  eq('msys route', normRoute('C:/Program Files/Git/apps'), '/apps');
  eq('route without slash', normRoute('apps'), '/apps');
  eq('home', normRoute('home'), '/');
  eq('navConfig', routesFromFile(`{ to: '/apps' }, { to: "/profile?tab=x" }, { to: \`/x/\${id}\` }`), ['/apps', '/profile?tab=x']);
  eq('paid exact', isPaidRoute('/naming', DEFAULT_SKIP_PAID), true);
  eq('paid child', isPaidRoute('/naming/abc?x=1', DEFAULT_SKIP_PAID), true);
  eq('not paid', isPaidRoute('/naming-x', DEFAULT_SKIP_PAID), false);
  eq('paid api', PAID_API.test('http://localhost:5199/api/ai/generate-naming'), true);
  eq('free api', PAID_API.test('http://localhost:5199/api/brand-guidelines/1/suggestions?cacheOnly=true'), false);
  const ns = ['nav', 'apps'];
  eq('raw key', isRawKey('nav.apps.label', ns), true);
  eq('domain is not a key', isRawKey('api.visantlabs.com', ns), false);
  eq('phrase is not a key', isRawKey('Meus mockups', ns), false);
  eq('no locale, domain', isRawKey('api.visantlabs.com', []), false);
  const o = parseArgs(['--routes', 'apps,/naming', '--theme', 'both', '--widths', '390']);
  eq('args', [o.routes, o.theme, o.widths], [['/apps', '/naming'], 'both', [390]]);
  let fail = 0;
  for (const [n, ok, got] of t) {
    if (!ok) fail++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${ok ? '' : '  -> ' + JSON.stringify(got)}`);
  }
  console.log(fail ? `\n${fail} failure(s)` : `\n${t.length}/${t.length} ok`);
  return fail ? 1 : 0;
}

/* ── main ─────────────────────────────────────────────────────────────── */
async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.selfCheck) process.exit(selfCheck());
  if (o.scanPaid) {
    const hits = scanPaid(process.cwd());
    console.log(hits.length ? hits.join('\n') : 'no useEffect calling paid AI (heuristic)');
    console.log('\nCandidate, not verdict: read the effect. Confirmed => add it to DEFAULT_SKIP_PAID.');
    return;
  }

  const cwd = process.cwd();
  let routes = o.routes;
  if (!routes) {
    const f = !o.routesFrom || o.routesFrom === 'navConfig' ? path.join(cwd, 'src/config/navConfig.ts') : path.resolve(o.routesFrom);
    if (!fs.existsSync(f)) throw new Error(`no --routes and no ${f}`);
    routes = routesFromFile(fs.readFileSync(f, 'utf8'));
  }
  const skipped = o.allowPaid ? [] : routes.filter((r) => isPaidRoute(r, o.skipPaid));
  routes = routes.filter((r) => !skipped.includes(r));
  const themes = o.theme === 'both' ? ['dark', 'light'] : [o.theme];
  const namespaces = loadNamespaces(cwd);
  const corta = fs.readFileSync(path.join(here, 'corta-scan.js'), 'utf8').replace(/if \(typeof module[\s\S]*$/, '');
  const ritmoSrc = fs.readFileSync(path.join(here, 'ritmo-scan.js'), 'utf8').replace(/if \(typeof module[\s\S]*$/, '');
  fs.mkdirSync(o.out, { recursive: true });

  let token = null;
  if (o.login === 'dev') {
    const res = await fetch(`${o.api}/api/auth/dev-login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: o.email }),
    }).catch((e) => {
      throw new Error(`dev-login unreachable at ${o.api} (${e.message}). Is the app running? (see references/environment.md)`);
    });
    token = (await res.json().catch(() => ({}))).token;
    if (!token) throw new Error(`dev-login returned no token (HTTP ${res.status})`);
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
        await page.addScriptTag({ content: ritmoSrc }).catch(() => {});
        return page.evaluate(
          ({ namespaces, rawRe }) => {
            const d = document.documentElement;
            let c = [];
            try {
              // serialize without the DOM node (`.no`): it does not cross evaluate
              c = (typeof corta === 'function' ? corta('body', { verbose: false }) || [] : ['corta-scan did not load']).map(
                (a) => (typeof a === 'string' ? a : `[${a.regra}] ${a.el}: ${a.detalhe}`)
              );
            } catch (e) {
              c = ['corta error ' + e];
            }
            // spacing that lies about grouping: reported, judged on the screenshot, never fails the run
            let ri = [];
            try {
              ri = (typeof ritmo === 'function' ? ritmo('body', { verbose: false }) || [] : []).map((a) => `[${a.regra}] ${a.el}: ${a.detalhe}`);
            } catch (e) {
              ri = ['ritmo error ' + e];
            }
            const re = new RegExp(rawRe);
            const raw = [...document.body.querySelectorAll('*')]
              .filter((n) => n.children.length === 0)
              .map((n) => (n.textContent || '').trim())
              // same rule as isRawKey (a function cannot be passed into evaluate)
              .filter(
                (t) =>
                  re.test(t) &&
                  (namespaces.length ? namespaces.includes(t.split('.')[0]) : !/\.(com|br|io|app|dev|net|org|ai)$/.test(t))
              )
              .slice(0, 8);
            return {
              overflow: d.scrollWidth - d.clientWidth,
              corta: c.slice(0, 8),
              ritmo: ri.slice(0, 8),
              rawKeys: raw,
              darkClass: d.classList.contains('dark'),
              // a blank screen (lazy chunk never arrived, swallowed crash) passes overflow/clip/key checks: count text
              textLen: (document.body.innerText || '').trim().length,
              title: document.title,
            };
          },
          { namespaces, rawRe: RAW_KEY.source }
        );
        };
        let m = await measure();
        // An empty screen is almost always the dev server recompiling (another agent's HMR, cold lazy chunk):
        // wait once more before reporting. If it stays empty, then it is a finding.
        let retried = false;
        if (m.textLen < 20) {
          retried = true;
          await page.waitForTimeout(o.wait);
          m = await measure();
        }
        const blank = m.textLen < 20;
        // the .dark class is applied in an app effect: on an empty screen it says nothing about the theme
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
          `${bad ? 'FOUND' : 'OK   '} ${theme.padEnd(5)} ${String(width).padStart(4)} ${route.padEnd(30)} ` +
            `overflow=${m.overflow} clipped=${m.corta.length} spacing=${m.ritmo.length} rawkey=${m.rawKeys.length} error=${errors.length} ` +
            `api4xx5xx=${row.apiFail.length}${blank ? ' BLANK-SCREEN' : ''}${themeOk ? '' : ' THEME-NOT-APPLIED'}${paidBlocked.length ? ' PAID-BLOCKED=' + paidBlocked.length : ''}`
        );
      }
      await ctx.close();
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(o.out, 'report.json'), JSON.stringify({ base: o.base, skippedPaid: skipped, report }, null, 2));
  if (skipped.length) console.log(`\nNOT opened (paid route, use --allow-paid): ${skipped.join(', ')}`);
  console.log(`\nscreenshots + report.json in ${o.out}`);
  console.log('A finding is a candidate: open the screenshot and confirm before fixing. api4xx5xx alone does not fail (local backend).');
  const fails = report.filter((r) => r.blank || r.overflow > 0 || r.corta.length || r.rawKeys.length || r.errors.length || !r.themeOk).length;
  process.exit(fails ? 1 : 0);
}

main().catch((e) => {
  console.error('verify-screens:', e.message);
  process.exit(2);
});
