#!/usr/bin/env node
/**
 * dist-scan: the missing gate. Does the page exist OUTSIDE itself?
 *
 * It exists because the house had a strict ruler for pixels, motion and finish,
 * and nothing for metadata, share cards, conversion events, sitemap and
 * robots. In a real session this was the P0 that separated "pretty on the
 * landing" from "findable", and whoever got there got there outside the skills.
 *
 * The asymmetry is the point: a token error costs one pixel; a missing
 * `og:image` costs the click-through rate of every shared link, and it does not
 * show up on any screen you open.
 *
 *   node dist-scan.mjs                 # cwd
 *   node dist-scan.mjs <app-folder>
 *   node dist-scan.mjs --json
 *   node dist-scan.mjs --self-test
 *
 * Exit 1 on any HIGH. Covers Next App Router and Pages Router.
 */

import { existsSync, readFileSync, readdirSync, statSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const JSON_OUT = argv.includes('--json');
const SELF_TEST = argv.includes('--self-test');
const ROOT = process.cwd();

const SKIP_DIR = /^(node_modules|\.next|\.git|dist|build|coverage|__tests__)$/;
const norm = (p) => p.split(sep).join('/');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIR.test(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Rules                                                                      */
/* -------------------------------------------------------------------------- */

/* Each rule receives the project context and returns findings. The context is a
   plain object so --self-test can build a fake project. */

/* Rule ids were Portuguese until 2026-10. dist-scan has no in-code exception
   syntax, so the old ids only live in notes, AUDIT.md files and scripts that
   grep the output. `ruleId()` maps them to the current id, and --json carries
   the old id as `legacyId` so a grep for the old name still finds the finding. */
export const LEGACY_IDS = {
  'sem-metadata': 'no-metadata',
  'rota-sem-titulo-proprio': 'route-without-title',
  'sem-description': 'no-description',
  'sem-og-image': 'no-og-image',
  'og-relativo-sem-metadataBase': 'relative-og-without-metadatabase',
  'sem-sitemap': 'no-sitemap',
  'sem-robots': 'no-robots',
  'sem-lang': 'no-lang',
  'conversao-nao-medida': 'conversion-not-measured',
  'sem-favicon': 'no-favicon',
};
export const ruleId = (id) => LEGACY_IDS[id] || id;
const legacyOf = (id) => Object.keys(LEGACY_IDS).find((k) => LEGACY_IDS[k] === id) || null;

/* A private route competes in no search at all: nobody indexes what is behind
   a login. Shared by every per-route rule.
   `app` does NOT go in this list, however tempting: in the App Router `app/` is
   the root of everything, so including it silenced the whole rule. Evidence:
   the self-test stayed green with the rule dead. */
const PRIVADA = /(^|\/)\(?(admin|auth|dashboard|painel|conta|settings|ajustes)\)?(\/|$)/i;

const META_EXPORT = /export\s+(const\s+metadata|async\s+function\s+generateMetadata)/;
/* Pages Router has no `metadata` export: the title lives in `next/head`
   (`<Head><title>`) or in a SEO component. */
const TITULO_PROPRIO = /export\s+(const\s+metadata|async\s+function\s+generateMetadata)|<title\b|<NextSeo\b|<Seo\b/;

const RULES = [
  {
    id: 'no-metadata',
    level: 'HIGH',
    /* PROJECT level, not file level. In the App Router metadata flows from the
       layout down to the page, so demanding `export const metadata` in every
       `page.tsx` flags legitimate inheritance. The right question is whether
       metadata exists ANYWHERE. */
    check: ({ text }) =>
      /export\s+(const\s+metadata|async\s+function\s+generateMetadata)/.test(text)
        ? []
        : [{ where: ['(project)'], msg: 'no `metadata` or `generateMetadata` anywhere in the project', fix: 'export const metadata: Metadata = { title, description } in the root layout. Without it, search and sharing read the file name.' }],
  },
  {
    id: 'route-without-title',
    level: 'MEDIUM',
    /* Only applies with more than one route: then they all inherit the SAME
       title from the layout, and the search result becomes a list of identical
       lines. A one-page site does not have this problem, and flagging it would
       be noise. */
    check: ({ pages, layouts }) => {
      /* Demanding an SEO title on `/admin/produtos/[id]` is the same badly
         scoped rule defect that once returned 104 color findings with ~1 real
         one, volume that drowns the real finding. */
      const publicas = pages.filter((p) => !PRIVADA.test(p.rel));
      if (publicas.length < 2) return [];
      /* In the App Router a route's metadata lives in the SIBLING `layout.tsx`
         whenever the `page.tsx` is a client component, which cannot export
         `metadata`. Reading only the page flagged as "no title" routes that had
         had their own title for months: measured on a real app, 30 findings,
         and the truly public ones were all correct. A rule that errs like that
         teaches people to ignore the detector. */
      const pastaDe = (rel) => rel.replace(/[^/]+$/, '');
      const comTituloNoLayout = new Set(
        layouts
          .filter((l) => META_EXPORT.test(l.src))
          .map((l) => pastaDe(norm(l.rel))),
      );
      const nus = publicas.filter(
        (p) => !isHome(p.rel)
          && !TITULO_PROPRIO.test(p.src)
          && !comTituloNoLayout.has(pastaDe(norm(p.rel))),
      );
      return nus.length
        ? [{ where: nus.map((p) => p.rel), msg: `${nus.length} of ${publicas.length} public routes without their own title (they inherit the layout's)`, fix: 'per-route metadata. Several public routes with the same title compete with each other in search.' }]
        : [];
    },
  },
  {
    id: 'no-description',
    level: 'HIGH',
    check: ({ pages }) => {
      /* A page marked `robots: { index: false }` (or `noindex`) will not
         appear in any search result; demanding search-result text from it is
         demanding a caption for a photo nobody will see. Real finding: an
         internal tool route already declared noindex and still came in as
         HIGH, the kind of noise that teaches people to ignore the detector. */
      const naoIndexavel = (src) =>
        /\bindex\s*:\s*false/.test(src) || /["'`]noindex/.test(src);
      /* Same scope as the title rule: a dashboard behind login shows up in
         no search result, so its missing description is not a HIGH. */
      const nus = pages.filter(
        (p) => !PRIVADA.test(p.rel)
          && /export\s+const\s+metadata/.test(p.src)
          && !/\bdescription\s*:/.test(p.src)
          && !naoIndexavel(p.src),
      );
      return nus.length
        ? [{ where: nus.map((p) => p.rel), msg: 'metadata without `description`', fix: 'a 120-160 char description. It is the text shown in the search result and on the card.' }]
        : [];
    },
  },
  {
    id: 'no-og-image',
    level: 'HIGH',
    check: ({ all, text }) => {
      /* Next accepts `opengraph-image.(tsx|png|jpg)` by file convention OR
         `openGraph.images` in the metadata. Either one works. */
      const byFile = all.some((f) => /(^|\/)(opengraph-image|twitter-image)\.(tsx|jsx|ts|png|jpe?g|gif)$/.test(norm(f)));
      const byMeta = /openGraph\s*:/.test(text) && /images\s*:/.test(text);
      return byFile || byMeta
        ? []
        : [{ where: ['(project)'], msg: 'no share card (og:image)', fix: 'app/opengraph-image.tsx (generated) or openGraph.images in the metadata. A link without a card gets half the clicks.' }];
    },
  },
  {
    id: 'relative-og-without-metadatabase',
    level: 'HIGH',
    check: ({ text }) => {
      /* Silent Next trap: an OG image with a relative path and no
         metadataBase resolves to localhost in production. The build only warns. */
      const relImg = /images\s*:\s*\[?\s*["']\//.test(text);
      return relImg && !/metadataBase\s*:/.test(text)
        ? [{ where: ['(project)'], msg: 'og:image with a relative path and no `metadataBase`', fix: 'metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL). Without it the card URL points to localhost in production.' }]
        : [];
    },
  },
  {
    id: 'no-sitemap',
    level: 'MEDIUM',
    check: ({ all }) =>
      all.some((f) => /(^|\/)(sitemap\.(ts|js|xml)|sitemap\.xml)$/.test(norm(f)))
        ? []
        : [{ where: ['(project)'], msg: 'no sitemap', fix: 'app/sitemap.ts exporting the public routes.' }],
  },
  {
    id: 'no-robots',
    level: 'MEDIUM',
    check: ({ all }) =>
      all.some((f) => /(^|\/)robots\.(ts|js|txt)$/.test(norm(f)))
        ? []
        : [{ where: ['(project)'], msg: 'no robots', fix: 'app/robots.ts. Without it the default is permissive, but the sitemap is not announced.' }],
  },
  {
    id: 'no-lang',
    level: 'MEDIUM',
    check: ({ layouts }) => {
      const nus = layouts.filter((p) => /<html/.test(p.src) && !/<html[^>]*\blang=/.test(p.src));
      return nus.length
        ? [{ where: nus.map((p) => p.rel), msg: '<html> without `lang`', fix: '<html lang="en"> (or the site locale, e.g. pt-BR). Screen readers and translators depend on it.' }]
        : [];
    },
  },
  {
    id: 'conversion-not-measured',
    level: 'HIGH',
    check: ({ text, sources }) => {
      /* The question is not "is there analytics", it is "does the act that pays
         the bills fire an event". A page with a lead form or checkout submit
         and no event call converts without anyone knowing how much.
         A conversion act is a SUBMIT (form, onSubmit, server action) in a file
         that also names a lead or checkout. The old rule took any `<form` or
         the bare word "checkout" anywhere: on vercel/commerce a search box, a
         quantity stepper and the string "Calculated at checkout" became a HIGH. */
      const SUBMIT = /<form\b|\bonSubmit\s*=|handleSubmit\(|type=["']submit["']|\bformAction\s*=/;
      /* `\bleads?\b`, not `\blead`: the bare prefix matched every Tailwind
         `leading-*` class. */
      const LEAD = /\bleads?\b|contact|contato|newsletter|waitlist|sign[\s_-]?up\b|create (an )?account|criar conta|cadastr|or[cç]amento|request (a )?(demo|quote)|["'`]\/api\/(lead|contato|subscribe)/i;
      const CHECKOUT = /checkout|\bbilling\b|\bupgrade\b|\bpurchase\b|\bpayment\b|["'`]\/api\/checkout/i;
      const atos = sources.filter((s) => SUBMIT.test(s.src));
      const leads = atos.filter((s) => LEAD.test(s.src));
      const checkouts = atos.filter((s) => !LEAD.test(s.src) && CHECKOUT.test(s.src));
      if (!leads.length && !checkouts.length) return [];
      const temEvento =
        /gtag\(\s*["']event["']/.test(text) ||
        /\bposthog\.capture\(/.test(text) ||
        /\bplausible\(/.test(text) ||
        /\b(?:umami|mixpanel|analytics|amplitude)\.track\(/.test(text) ||
        /\bfbq\(\s*["']track/.test(text) ||
        /\bdataLayer\.push\(/.test(text) ||
        /\bsend(?:GA|GTM)Event\(/.test(text) ||
        /\btrack\(\s*["']/.test(text) ||
        /@vercel\/analytics/.test(text) && /\btrack\(/.test(text);
      if (temEvento) return [];
      /* Hosted checkout (Shopify `checkoutUrl`, a Stripe Checkout session):
         the purchase itself happens and is measured on the provider's domain.
         The repo only owns the handoff click. Calling that "a form that
         converts with no event" overstates it, so it drops to LOW and names
         the real gap: the cart-to-checkout step. A lead form is never a
         handoff: the lead lands in this repo or nowhere. */
      const HANDOFF = /checkoutUrl|checkout_url|stripe\.checkout\.sessions\.create|redirectToCheckout|lemonsqueezy|Paddle\.Checkout/;
      if (!leads.length && HANDOFF.test(text)) {
        return [{
          level: 'LOW',
          where: checkouts.map((s) => s.rel),
          msg: 'checkout hands off to a hosted provider (the provider measures the purchase); the handoff submit fires no event',
          fix: 'optional: fire `begin_checkout` on the handoff submit to see the drop between cart and checkout. The purchase number lives in the provider dashboard.',
        }];
      }
      const onde = [...leads, ...checkouts].map((s) => s.rel);
      return [{ where: onde, msg: 'has a conversion act (lead form or checkout submit) and no event fired', fix: 'fire a named event on submit. Without it there is no way to know which screen change moved conversion, and that is what justifies the next round.' }];
    },
  },
  {
    id: 'no-favicon',
    level: 'LOW',
    check: ({ all }) =>
      all.some((f) => /(^|\/)(favicon\.ico|icon\.(png|svg|tsx)|apple-icon\.(png|tsx))$/.test(norm(f)))
        ? []
        : [{ where: ['(project)'], msg: 'no favicon/icon', fix: 'app/icon.png (or favicon.ico). It is the brand on the tab and in the bookmark.' }],
  },
  {
    id: 'title-placeholder',
    level: 'HIGH',
    check: ({ text }) =>
      /title\s*:\s*["'`](Create Next App|Next\.js|My App|Untitled|Home|App)["'`]/.test(text)
        ? [{ where: ['(project)'], msg: 'title is still the template placeholder', fix: 'the real name of the property. "Create Next App" has shipped to production more than once.' }]
        : [],
  },
];

/* -------------------------------------------------------------------------- */
/* Context                                                                    */
/* -------------------------------------------------------------------------- */

/* What is a ROUTE. The old test was "any `page.*` or `index.*`", so on
   vercel/commerce `components/grid/index.tsx` and two other barrel files were
   reported as public routes without a title. Next only has two conventions:
     App Router    app/**\/page.(tsx|jsx|ts|js|mdx); route groups `(x)` and
                   dynamic segments are routes, `_private` folders are not.
     Pages Router  pages/**\/*.(tsx|jsx|ts|js|mdx|md) minus `_app`,
                   `_document`, `_error` (any `_` file) and `api/`.
   Both may sit under `src/` or a monorepo app folder; anything under a
   `components/` (or `lib/`, `hooks/`) folder is never a route. */
const ROUTE_EXT = /\.(tsx|jsx|ts|js|mdx|md)$/;
/* The router folder must sit at the project root, under `src/`, or under a
   monorepo `apps/<name>/`: taxonomy keeps contentlayer MDX in
   `content/pages/*.mdx`, which is data, not the Pages Router. */
const ROUTER_DIR = /^((?:apps|packages)\/[^/]+\/)?(src\/)?(app|pages)\/(.*)$/;
function isRoute(rel) {
  const p = norm(rel);
  if (/\.d\.ts$/.test(p)) return false;
  const m = p.match(ROUTER_DIR);
  if (!m) return false;
  const [, , , kind, rest] = m;
  if (kind === 'app') {
    return /(^|\/)page\.(tsx|jsx|ts|js|mdx)$/.test(rest) && !/(^|\/)_[^/]*\//.test(rest);
  }
  return ROUTE_EXT.test(rest) && !/^api\//.test(rest) && !/(^|\/)_/.test(rest);
}

/* The home route (`app/page`, `app/(group)/page`, `pages/index`) is the one
   route whose title legitimately IS the layout default. */
const isHome = (rel) => /^((?:apps|packages)\/[^/]+\/)?(src\/)?(app\/(\([^/]+\)\/)*page|pages\/index)\.[a-z]+$/.test(norm(rel));

function buildContext(root) {
  const all = walk(root);
  const code = all.filter((f) => /\.(tsx|jsx|ts|js|mjs)$/.test(f) && !/\.d\.ts$/.test(f));
  const disp = (f) => {
    const r = relative(root, f);
    return norm(r && !r.startsWith('..') && !isAbsolute(r) ? r : f);
  };
  const read = (f) => ({ rel: disp(f), src: readFileSync(f, 'utf8') });

  const pages = all.filter((f) => isRoute(disp(f))).map(read);
  const layouts = code.filter((f) => /(^|\/)(layout|_app|_document)\.(tsx|jsx)$/.test(norm(f))).map(read);
  const sources = code.map(read);
  const text = sources.map((s) => s.src).join('\n');

  return { all, code, pages, layouts, sources, text, disp };
}

function audit(root) {
  const ctx = buildContext(root);
  const findings = [];
  for (const rule of RULES) {
    for (const f of rule.check(ctx)) findings.push({ rule: rule.id, legacyId: legacyOf(rule.id), level: rule.level, ...f });
  }
  return { ctx, findings };
}

/* -------------------------------------------------------------------------- */
/* --self-test                                                                */
/* -------------------------------------------------------------------------- */

if (SELF_TEST) {
  const tmp = mkdtempSync(join(tmpdir(), 'dist-scan-'));

  /* BAD project: one of each defect. */
  const bad = join(tmp, 'bad', 'app');
  mkdirSync(bad, { recursive: true });
  writeFileSync(join(bad, 'layout.tsx'), `export const metadata = { title: "Create Next App", openGraph: { images: ["/og.png"] } };
export default function L({ children }) { return <html><body>{children}</body></html>; }
`);
  writeFileSync(join(bad, 'page.tsx'), `export default function P() { return <form onSubmit={() => {}}><input name="email" /><button>Join the waitlist</button></form>; }
`);
  // second route without its own title -> fires route-without-title
  mkdirSync(join(bad, 'sobre'), { recursive: true });
  writeFileSync(join(bad, 'sobre', 'page.tsx'), `export default function S() { return <main>sobre</main>; }\n`);

  /* GOOD project: must return ZERO. Without this side, a regex that went inert
     goes unnoticed forever; that is how a copy extractor swore zero over text
     it never read. */
  const good = join(tmp, 'good', 'app');
  mkdirSync(good, { recursive: true });
  writeFileSync(join(good, 'layout.tsx'), `import type { Metadata } from "next";
export const metadata: Metadata = {
  metadataBase: new URL("https://exemplo.com.br"),
  title: "Visant — estúdio de marca",
  description: "Marca, site e material de venda para negócio que precisa parecer maior do que é.",
  openGraph: { images: ["/og.png"] },
};
export default function L({ children }) { return <html lang="pt-BR"><body>{children}</body></html>; }
`);
  writeFileSync(join(good, 'page.tsx'), `"use client";
export default function P() {
  return <form onSubmit={() => { fetch("/api/lead"); window.gtag("event", "lead_enviado"); }}><input /></form>;
}
`);
  writeFileSync(join(good, 'sitemap.ts'), `export default function sitemap() { return [{ url: "https://exemplo.com.br" }]; }\n`);
  writeFileSync(join(good, 'robots.ts'), `export default function robots() { return { rules: [{ userAgent: "*" }] }; }\n`);
  writeFileSync(join(good, 'icon.png'), 'x');
  writeFileSync(join(good, 'opengraph-image.tsx'), `export default function OG() { return null; }\n`);

  const badF = audit(join(tmp, 'bad')).findings;
  const goodF = audit(join(tmp, 'good')).findings;

  const fired = new Set(badF.map((f) => f.rule));
  const problems = [];
  /* `no-description` does not fire on bad because the placeholder title is
     already that file's finding; it has its own fixture. */
  const descOnly = mkdtempSync(join(tmpdir(), 'dist-scan-d-'));
  mkdirSync(join(descOnly, 'app'), { recursive: true });
  writeFileSync(join(descOnly, 'app', 'page.tsx'), `export const metadata = { title: "Página real da casa" };\nexport default function P(){return null}\n`);
  for (const f of audit(descOnly).findings) fired.add(f.rule);

  /* Project with NO metadata at all: bad has it in the layout, so it will not do. */
  const pelado = mkdtempSync(join(tmpdir(), 'dist-scan-p-'));
  mkdirSync(join(pelado, 'app'), { recursive: true });
  writeFileSync(join(pelado, 'app', 'page.tsx'), `export default function P(){return <main>oi</main>}\n`);
  for (const f of audit(pelado).findings) fired.add(f.rule);

  /* False positive lock: a route out of the index (`robots: { index: false }`)
     does not need a `description`, it will never appear in search. Before this
     lock, an internal tool already marked noindex came in as HIGH. */
  const noindex = mkdtempSync(join(tmpdir(), 'dist-scan-ni-'));
  mkdirSync(join(noindex, 'app'), { recursive: true });
  writeFileSync(join(noindex, 'app', 'page.tsx'), `export const metadata = { title: "Dev - ferramenta interna", robots: { index: false } };\nexport default function D(){return null}\n`);
  const niF = audit(noindex).findings.filter((f) => f.rule === 'no-description');
  if (niF.length) problems.push('false positive: no-description fired on a noindex route');

  /* False positive lock: a client component `page.tsx` cannot export
     metadata, so the route's own title lives in the sibling `layout.tsx`.
     Before this lock the rule flagged 30 routes that already had a title. */
  const porLayout = mkdtempSync(join(tmpdir(), 'dist-scan-tl-'));
  for (const rota of ['sobre', 'servicos']) {
    mkdirSync(join(porLayout, 'app', rota), { recursive: true });
    writeFileSync(join(porLayout, 'app', rota, 'layout.tsx'), `export const metadata = { title: "${rota} | Casa", description: "Texto de resultado de busca com tamanho de gente grande, escrito pra quem procura." };\nexport default function L({ children }) { return children; }\n`);
    writeFileSync(join(porLayout, 'app', rota, 'page.tsx'), `"use client";\nexport default function P(){return null}\n`);
  }
  const tlF = audit(porLayout).findings.filter((f) => f.rule === 'route-without-title');
  if (tlF.length) problems.push('false positive: route-without-title fired with a title in the sibling layout');

  /* Route discovery and the hosted-checkout handoff, against the
     fixtures/dist-routes project: `components/.../index.tsx` barrels, a
     `_private` folder, `pages/_app` and `pages/api` are decoys; only the
     product page lacks its own title; the only conversion act is a submit that
     redirects to a hosted checkout, which is LOW, never the HIGH. */
  {
    const fx = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'dist-routes');
    const { ctx: rc, findings: rf } = audit(fx);
    const got = rc.pages.map((p) => p.rel).sort().join(' ');
    const want = 'app/(shop)/product/[handle]/page.tsx app/page.tsx app/search/page.tsx pages/about.tsx';
    if (got !== want) problems.push(`route discovery: expected "${want}", got "${got}"`);
    const t = rf.filter((f) => f.rule === 'route-without-title');
    const tw = t.flatMap((f) => f.where).join(' ');
    if (tw !== 'app/(shop)/product/[handle]/page.tsx') problems.push(`route-without-title on dist-routes: expected only the product page, got "${tw}"`);
    const c = rf.filter((f) => f.rule === 'conversion-not-measured');
    if (c.length !== 1 || c[0].level !== 'LOW') problems.push(`hosted checkout handoff: expected one LOW conversion-not-measured, got ${JSON.stringify(c.map((f) => f.level))}`);
    else if (c[0].where.join(' ') !== 'components/cart/modal.tsx') problems.push(`handoff where: ${c[0].where.join(' ')}`);
    for (const f of rf) if (f.where.some((w) => /^components\/(grid|layout)|search-box|_private|_app|api\/|^content\/|^app\/page\./.test(w))) problems.push(`decoy reported by ${f.rule}: ${f.where.join(' ')}`);
  }

  /* Same handoff, plus a lead form: the lead is not a handoff, so HIGH. */
  {
    const p = mkdtempSync(join(tmpdir(), 'dist-scan-lead-'));
    mkdirSync(join(p, 'app'), { recursive: true });
    writeFileSync(join(p, 'app', 'page.tsx'), `export default function P(){return <form onSubmit={go}><button>Sign up</button></form>}\nconst checkoutUrl = "x";\n`);
    const c = audit(p).findings.filter((f) => f.rule === 'conversion-not-measured');
    if (c.length !== 1 || c[0].level !== 'HIGH') problems.push('lead form next to a hosted checkout must stay HIGH');
  }

  /* Legacy ids: every old Portuguese id resolves to a live rule. */
  for (const [velho, novo] of Object.entries(LEGACY_IDS)) {
    if (ruleId(velho) !== novo || !RULES.some((r) => r.id === novo)) problems.push(`legacy id ${velho} does not resolve to a live rule`);
    if (legacyOf(novo) !== velho) problems.push(`legacyId of ${novo} is not ${velho}`);
  }
  if (ruleId('conversao-nao-medida') !== 'conversion-not-measured') problems.push('ruleId does not normalize conversao-nao-medida');

  const silent = RULES.filter((r) => !fired.has(r.id)).map((r) => r.id);
  if (silent.length) problems.push(`rule(s) that never fired: ${silent.join(', ')}`);
  if (goodF.length) problems.push(`false positive on the clean project: ${goodF.map((f) => `${f.rule} (${f.msg})`).join(' | ')}`);

  if (problems.length) {
    console.error('dist-scan --self-test FAILED');
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`dist-scan --self-test ok: ${RULES.length}/${RULES.length} rules fire, clean project returns zero, routes skip component barrels, hosted checkout is LOW, legacy ids resolve.`);
  process.exit(0);
}

/* -------------------------------------------------------------------------- */
/* Run                                                                        */
/* -------------------------------------------------------------------------- */

const target = resolve(ROOT, argv.filter((a) => !a.startsWith('--'))[0] ?? '.');
if (!existsSync(target)) {
  console.error(`target does not exist: ${target}`);
  process.exit(2);
}

const { ctx, findings } = audit(target);

if (JSON_OUT) {
  console.log(JSON.stringify({ target: norm(target), scanned: ctx.code.length, findings }, null, 2));
  process.exit(findings.some((f) => f.level === 'HIGH') ? 1 : 0);
}

console.log(`\ndist-scan  target: ${norm(target)}  (${ctx.code.length} file(s), ${ctx.pages.length} page(s))\n`);

if (!ctx.pages.length && !ctx.layouts.length) {
  console.log('no Next page or layout in the target; point it at the app root.');
  process.exit(2);
}

const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
for (const f of findings.sort((a, b) => order[a.level] - order[b.level])) {
  console.log(`${f.level.padEnd(6)} ${f.rule}`);
  console.log(`  ${f.msg}`);
  for (const w of f.where.slice(0, 8)) console.log(`    ${w}`);
  if (f.where.length > 8) console.log(`    ... and ${f.where.length - 8} more`);
  console.log(`  fix: ${f.fix}\n`);
}

const high = findings.filter((f) => f.level === 'HIGH').length;
console.log('-'.repeat(64));
console.log(
  findings.length
    ? `DISTRIBUTION: ${findings.length} finding(s), ${high} HIGH.`
    : 'DISTRIBUTION OK: the page exists outside itself.',
);
if (high) {
  console.log('HIGH here is not a detail: a missing og:image costs the click-through rate of');
  console.log('every shared link, and it does not show up on any screen you open.');
}
console.log('-'.repeat(64));
process.exit(high ? 1 : 0);
