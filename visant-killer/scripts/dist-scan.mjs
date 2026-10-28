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
import { join, resolve, relative, isAbsolute, sep } from 'node:path';

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

const RULES = [
  {
    id: 'sem-metadata',
    level: 'HIGH',
    /* PROJECT level, not file level. In the App Router metadata flows from the
       layout down to the page, so demanding `export const metadata` in every
       `page.tsx` flags legitimate inheritance. The right question is whether
       metadata exists ANYWHERE. */
    check: ({ text }) =>
      /export\s+(const\s+metadata|async\s+function\s+generateMetadata)/.test(text)
        ? []
        : [{ where: ['(projeto)'], msg: 'no `metadata` or `generateMetadata` anywhere in the project', fix: 'export const metadata: Metadata = { title, description } in the root layout. Without it, search and sharing read the file name.' }],
  },
  {
    id: 'rota-sem-titulo-proprio',
    level: 'MEDIUM',
    /* Only applies with more than one route: then they all inherit the SAME
       title from the layout, and the search result becomes a list of identical
       lines. A one-page site does not have this problem, and flagging it would
       be noise. */
    check: ({ pages, layouts }) => {
      /* A private route competes in no search at all: nobody indexes what is
         behind a login. Demanding an SEO title on `/admin/produtos/[id]` is the
         same badly scoped rule defect that once returned 104 color findings
         with ~1 real one, volume that drowns the real finding. */
      /* `app` does NOT go in this list, however tempting: in the App Router
         `app/` is the root of everything, so including it silenced the whole
         rule. Evidence: the self-test stayed green with the rule dead. */
      const PRIVADA = /(^|\/)\(?(admin|auth|dashboard|painel|conta|settings|ajustes)\)?(\/|$)/i;
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
          .filter((l) => /export\s+(const\s+metadata|async\s+function\s+generateMetadata)/.test(l.src))
          .map((l) => pastaDe(norm(l.rel))),
      );
      const nus = publicas.filter(
        (p) => !/export\s+(const\s+metadata|async\s+function\s+generateMetadata)/.test(p.src)
          && !comTituloNoLayout.has(pastaDe(norm(p.rel))),
      );
      return nus.length
        ? [{ where: nus.map((p) => p.rel), msg: `${nus.length} of ${publicas.length} public routes without their own title (they inherit the layout's)`, fix: 'per-route metadata. Several public routes with the same title compete with each other in search.' }]
        : [];
    },
  },
  {
    id: 'sem-description',
    level: 'HIGH',
    check: ({ pages }) => {
      /* A page marked `robots: { index: false }` (or `noindex`) will not
         appear in any search result; demanding search-result text from it is
         demanding a caption for a photo nobody will see. Real finding: an
         internal tool route already declared noindex and still came in as
         HIGH, the kind of noise that teaches people to ignore the detector. */
      const naoIndexavel = (src) =>
        /\bindex\s*:\s*false/.test(src) || /["'`]noindex/.test(src);
      const nus = pages.filter(
        (p) => /export\s+const\s+metadata/.test(p.src)
          && !/\bdescription\s*:/.test(p.src)
          && !naoIndexavel(p.src),
      );
      return nus.length
        ? [{ where: nus.map((p) => p.rel), msg: 'metadata without `description`', fix: 'a 120-160 char description. It is the text shown in the search result and on the card.' }]
        : [];
    },
  },
  {
    id: 'sem-og-image',
    level: 'HIGH',
    check: ({ all, text }) => {
      /* Next accepts `opengraph-image.(tsx|png|jpg)` by file convention OR
         `openGraph.images` in the metadata. Either one works. */
      const byFile = all.some((f) => /(^|\/)(opengraph-image|twitter-image)\.(tsx|jsx|ts|png|jpe?g|gif)$/.test(norm(f)));
      const byMeta = /openGraph\s*:/.test(text) && /images\s*:/.test(text);
      return byFile || byMeta
        ? []
        : [{ where: ['(projeto)'], msg: 'no share card (og:image)', fix: 'app/opengraph-image.tsx (generated) or openGraph.images in the metadata. A link without a card gets half the clicks.' }];
    },
  },
  {
    id: 'og-relativo-sem-metadataBase',
    level: 'HIGH',
    check: ({ text }) => {
      /* Silent Next trap: an OG image with a relative path and no
         metadataBase resolves to localhost in production. The build only warns. */
      const relImg = /images\s*:\s*\[?\s*["']\//.test(text);
      return relImg && !/metadataBase\s*:/.test(text)
        ? [{ where: ['(projeto)'], msg: 'og:image with a relative path and no `metadataBase`', fix: 'metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL). Without it the card URL points to localhost in production.' }]
        : [];
    },
  },
  {
    id: 'sem-sitemap',
    level: 'MEDIUM',
    check: ({ all }) =>
      all.some((f) => /(^|\/)(sitemap\.(ts|js|xml)|sitemap\.xml)$/.test(norm(f)))
        ? []
        : [{ where: ['(projeto)'], msg: 'no sitemap', fix: 'app/sitemap.ts exporting the public routes.' }],
  },
  {
    id: 'sem-robots',
    level: 'MEDIUM',
    check: ({ all }) =>
      all.some((f) => /(^|\/)robots\.(ts|js|txt)$/.test(norm(f)))
        ? []
        : [{ where: ['(projeto)'], msg: 'no robots', fix: 'app/robots.ts. Without it the default is permissive, but the sitemap is not announced.' }],
  },
  {
    id: 'sem-lang',
    level: 'MEDIUM',
    check: ({ layouts }) => {
      const nus = layouts.filter((p) => /<html/.test(p.src) && !/<html[^>]*\blang=/.test(p.src));
      return nus.length
        ? [{ where: nus.map((p) => p.rel), msg: '<html> without `lang`', fix: '<html lang="en"> (or the site locale, e.g. pt-BR). Screen readers and translators depend on it.' }]
        : [];
    },
  },
  {
    id: 'conversao-nao-medida',
    level: 'HIGH',
    check: ({ text, all }) => {
      /* The question is not "is there analytics", it is "does the act that pays
         the bills fire an event". A page with a form or checkout and no event
         call converts without anyone knowing how much. */
      const temAtoDeConversao = /<form\b|onSubmit|checkout|["'`]\/api\/(lead|contato|subscribe|checkout)/i.test(text);
      if (!temAtoDeConversao) return [];
      const temEvento =
        /gtag\(\s*["']event["']/.test(text) ||
        /\bposthog\.capture\(/.test(text) ||
        /\bplausible\(/.test(text) ||
        /\btrack\(\s*["']/.test(text) ||
        /@vercel\/analytics/.test(text) && /\btrack\(/.test(text);
      return temEvento
        ? []
        : [{ where: ['(projeto)'], msg: 'has a conversion act (form/checkout) and no event fired', fix: 'fire a named event on submit. Without it there is no way to know which screen change moved conversion, and that is what justifies the next round.' }];
    },
  },
  {
    id: 'sem-favicon',
    level: 'LOW',
    check: ({ all }) =>
      all.some((f) => /(^|\/)(favicon\.ico|icon\.(png|svg|tsx)|apple-icon\.(png|tsx))$/.test(norm(f)))
        ? []
        : [{ where: ['(projeto)'], msg: 'no favicon/icon', fix: 'app/icon.png (or favicon.ico). It is the brand on the tab and in the bookmark.' }],
  },
  {
    id: 'title-placeholder',
    level: 'HIGH',
    check: ({ text }) =>
      /title\s*:\s*["'`](Create Next App|Next\.js|My App|Untitled|Home|App)["'`]/.test(text)
        ? [{ where: ['(projeto)'], msg: 'title is still the template placeholder', fix: 'the real name of the property. "Create Next App" has shipped to production more than once.' }]
        : [],
  },
];

/* -------------------------------------------------------------------------- */
/* Context                                                                    */
/* -------------------------------------------------------------------------- */

function buildContext(root) {
  const all = walk(root);
  const code = all.filter((f) => /\.(tsx|jsx|ts|js|mjs)$/.test(f) && !/\.d\.ts$/.test(f));
  const disp = (f) => {
    const r = relative(root, f);
    return norm(r && !r.startsWith('..') && !isAbsolute(r) ? r : f);
  };
  const read = (f) => ({ rel: disp(f), src: readFileSync(f, 'utf8') });

  const pages = code.filter((f) => /(^|\/)(page|index)\.(tsx|jsx)$/.test(norm(f))).map(read);
  const layouts = code.filter((f) => /(^|\/)(layout|_app|_document)\.(tsx|jsx)$/.test(norm(f))).map(read);
  const text = code.map((f) => readFileSync(f, 'utf8')).join('\n');

  return { all, code, pages, layouts, text, disp };
}

function audit(root) {
  const ctx = buildContext(root);
  const findings = [];
  for (const rule of RULES) {
    for (const f of rule.check(ctx)) findings.push({ rule: rule.id, level: rule.level, ...f });
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
  writeFileSync(join(bad, 'page.tsx'), `export default function P() { return <form onSubmit={() => {}}><input /></form>; }
`);
  // second route without its own title -> fires rota-sem-titulo-proprio
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
  return <form onSubmit={() => { window.gtag("event", "lead_enviado"); }}><input /></form>;
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
  /* `sem-description` does not fire on bad because the placeholder title is
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
  const niF = audit(noindex).findings.filter((f) => f.rule === 'sem-description');
  if (niF.length) problems.push('false positive: sem-description fired on a noindex route');

  /* False positive lock: a client component `page.tsx` cannot export
     metadata, so the route's own title lives in the sibling `layout.tsx`.
     Before this lock the rule flagged 30 routes that already had a title. */
  const porLayout = mkdtempSync(join(tmpdir(), 'dist-scan-tl-'));
  for (const rota of ['sobre', 'servicos']) {
    mkdirSync(join(porLayout, 'app', rota), { recursive: true });
    writeFileSync(join(porLayout, 'app', rota, 'layout.tsx'), `export const metadata = { title: "${rota} | Casa", description: "Texto de resultado de busca com tamanho de gente grande, escrito pra quem procura." };\nexport default function L({ children }) { return children; }\n`);
    writeFileSync(join(porLayout, 'app', rota, 'page.tsx'), `"use client";\nexport default function P(){return null}\n`);
  }
  const tlF = audit(porLayout).findings.filter((f) => f.rule === 'rota-sem-titulo-proprio');
  if (tlF.length) problems.push('false positive: rota-sem-titulo-proprio fired with a title in the sibling layout');

  const silent = RULES.filter((r) => !fired.has(r.id)).map((r) => r.id);
  if (silent.length) problems.push(`rule(s) that never fired: ${silent.join(', ')}`);
  if (goodF.length) problems.push(`false positive on the clean project: ${goodF.map((f) => `${f.rule} (${f.msg})`).join(' | ')}`);

  if (problems.length) {
    console.error('dist-scan --self-test FAILED');
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`dist-scan --self-test ok: ${RULES.length}/${RULES.length} rules fire, clean project returns zero.`);
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
