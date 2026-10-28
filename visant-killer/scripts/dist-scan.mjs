#!/usr/bin/env node
/**
 * dist-scan — o portão que faltava: a página existe FORA dela mesma?
 *
 * Existe porque a casa tinha régua rigorosa pra pixel, motion e acabamento, e
 * nada pra metadata, card de compartilhamento, evento de conversão, sitemap e
 * robots. Numa sessão real esse foi o P0 que separou "bonita na landing" de
 * "encontrável", e quem chegou nele chegou por fora das skills.
 *
 * A assimetria é o ponto: um erro de token custa um pixel; um `og:image`
 * faltando custa toda a taxa de clique de todo link compartilhado, e não
 * aparece em nenhuma tela que você abra.
 *
 *   node dist-scan.mjs                 # cwd
 *   node dist-scan.mjs <pasta-do-app>
 *   node dist-scan.mjs --json
 *   node dist-scan.mjs --self-test
 *
 * Exit 1 em qualquer HIGH. Cobre Next App Router e Pages Router.
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
/* Regras                                                                     */
/* -------------------------------------------------------------------------- */

/* Cada regra recebe o contexto do projeto e devolve achados. Contexto é um
   objeto simples pra que o --self-test consiga montar projeto de mentira. */

const RULES = [
  {
    id: 'sem-metadata',
    level: 'HIGH',
    /* Nível PROJETO, não arquivo. No App Router a metadata desce do layout pra
       página, então cobrar `export const metadata` em cada `page.tsx` acusa
       herança legítima. A pergunta certa é se existe metadata em ALGUM lugar. */
    check: ({ text }) =>
      /export\s+(const\s+metadata|async\s+function\s+generateMetadata)/.test(text)
        ? []
        : [{ where: ['(projeto)'], msg: 'nenhuma `metadata` nem `generateMetadata` no projeto inteiro', fix: 'export const metadata: Metadata = { title, description } no layout raiz. Sem isso, busca e compartilhamento leem o nome do arquivo.' }],
  },
  {
    id: 'rota-sem-titulo-proprio',
    level: 'MEDIUM',
    /* Só vale com mais de uma rota: aí todas herdam o MESMO título do layout, e
       o resultado de busca vira uma lista de linhas idênticas. Site de uma
       página só não tem esse problema, e cobrar dele seria ruído. */
    check: ({ pages, layouts }) => {
      /* Rota privada não compete em busca nenhuma: ninguém indexa o que está
         atrás de login. Cobrar título de SEO em `/admin/produtos/[id]` é o
         mesmo defeito de regra mal escopada que já devolveu 104 achados de cor
         com ~1 verdadeiro — volume que afoga o achado real. */
      /* `app` NÃO entra nesta lista, por mais tentador que pareça: no App
         Router `app/` é a raiz de tudo, então incluí-lo silenciava a regra
         inteira. Achado disso: o self-test ficou verde com a regra morta. */
      const PRIVADA = /(^|\/)\(?(admin|auth|dashboard|painel|conta|settings|ajustes)\)?(\/|$)/i;
      const publicas = pages.filter((p) => !PRIVADA.test(p.rel));
      if (publicas.length < 2) return [];
      /* No App Router a metadata de uma rota mora no `layout.tsx` IRMAO
         sempre que a `page.tsx` e client component — que nao pode exportar
         `metadata`. Ler so a page acusava de "sem titulo" rota que tem
         titulo proprio ha meses: medido num app real, 30 achados, e as
         publicas de verdade estavam todas certas. Regra que erra assim
         ensina a ignorar o detector. */
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
        ? [{ where: nus.map((p) => p.rel), msg: `${nus.length} de ${publicas.length} rotas públicas sem título próprio (herdam o do layout)`, fix: 'metadata por rota. Várias rotas públicas com o mesmo title competem entre si na busca.' }]
        : [];
    },
  },
  {
    id: 'sem-description',
    level: 'HIGH',
    check: ({ pages }) => {
      /* Pagina marcada `robots: { index: false }` (ou `noindex`) nao vai
         aparecer em resultado de busca nenhum — cobrar dela um texto de
         resultado de busca e cobrar legenda de foto que ninguem vai ver.
         Achado real: uma rota de ferramenta interna ja declarava noindex e
         mesmo assim entrava como HIGH, o tipo de barulho que ensina a
         ignorar o detector. */
      const naoIndexavel = (src) =>
        /\bindex\s*:\s*false/.test(src) || /["'`]noindex/.test(src);
      const nus = pages.filter(
        (p) => /export\s+const\s+metadata/.test(p.src)
          && !/\bdescription\s*:/.test(p.src)
          && !naoIndexavel(p.src),
      );
      return nus.length
        ? [{ where: nus.map((p) => p.rel), msg: 'metadata sem `description`', fix: 'description de 120-160 chars. É o texto que aparece no resultado de busca e no card.' }]
        : [];
    },
  },
  {
    id: 'sem-og-image',
    level: 'HIGH',
    check: ({ all, text }) => {
      /* Next aceita `opengraph-image.(tsx|png|jpg)` por convenção de arquivo OU
         `openGraph.images` na metadata. Qualquer um dos dois serve. */
      const byFile = all.some((f) => /(^|\/)(opengraph-image|twitter-image)\.(tsx|jsx|ts|png|jpe?g|gif)$/.test(norm(f)));
      const byMeta = /openGraph\s*:/.test(text) && /images\s*:/.test(text);
      return byFile || byMeta
        ? []
        : [{ where: ['(projeto)'], msg: 'nenhum card de compartilhamento (og:image)', fix: 'app/opengraph-image.tsx (gerado) ou openGraph.images na metadata. Link sem card é link com metade do clique.' }];
    },
  },
  {
    id: 'og-relativo-sem-metadataBase',
    level: 'HIGH',
    check: ({ text }) => {
      /* Armadilha silenciosa do Next: imagem de OG com caminho relativo e sem
         metadataBase resolve pra localhost em produção. O build só avisa. */
      const relImg = /images\s*:\s*\[?\s*["']\//.test(text);
      return relImg && !/metadataBase\s*:/.test(text)
        ? [{ where: ['(projeto)'], msg: 'og:image com caminho relativo e sem `metadataBase`', fix: 'metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL). Sem isso a URL do card aponta pra localhost em produção.' }]
        : [];
    },
  },
  {
    id: 'sem-sitemap',
    level: 'MEDIUM',
    check: ({ all }) =>
      all.some((f) => /(^|\/)(sitemap\.(ts|js|xml)|sitemap\.xml)$/.test(norm(f)))
        ? []
        : [{ where: ['(projeto)'], msg: 'sem sitemap', fix: 'app/sitemap.ts exportando as rotas públicas.' }],
  },
  {
    id: 'sem-robots',
    level: 'MEDIUM',
    check: ({ all }) =>
      all.some((f) => /(^|\/)robots\.(ts|js|txt)$/.test(norm(f)))
        ? []
        : [{ where: ['(projeto)'], msg: 'sem robots', fix: 'app/robots.ts. Sem ele o padrão é permissivo, mas o sitemap não é anunciado.' }],
  },
  {
    id: 'sem-lang',
    level: 'MEDIUM',
    check: ({ layouts }) => {
      const nus = layouts.filter((p) => /<html/.test(p.src) && !/<html[^>]*\blang=/.test(p.src));
      return nus.length
        ? [{ where: nus.map((p) => p.rel), msg: '<html> sem `lang`', fix: '<html lang="pt-BR">. Leitor de tela e tradutor dependem disso.' }]
        : [];
    },
  },
  {
    id: 'conversao-nao-medida',
    level: 'HIGH',
    check: ({ text, all }) => {
      /* A pergunta não é "tem analytics", é "o ato que paga a conta dispara
         evento". Página com formulário ou checkout e nenhuma chamada de evento
         é página que converte sem ninguém saber quanto. */
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
        : [{ where: ['(projeto)'], msg: 'tem ato de conversão (form/checkout) e nenhum evento disparado', fix: 'dispare um evento nomeado no submit. Sem isso não dá pra saber qual mudança de tela mexeu na conversão — e é isso que justifica a próxima rodada.' }];
    },
  },
  {
    id: 'sem-favicon',
    level: 'LOW',
    check: ({ all }) =>
      all.some((f) => /(^|\/)(favicon\.ico|icon\.(png|svg|tsx)|apple-icon\.(png|tsx))$/.test(norm(f)))
        ? []
        : [{ where: ['(projeto)'], msg: 'sem favicon/icon', fix: 'app/icon.png (ou favicon.ico). É a marca na aba e no bookmark.' }],
  },
  {
    id: 'title-placeholder',
    level: 'HIGH',
    check: ({ text }) =>
      /title\s*:\s*["'`](Create Next App|Next\.js|My App|Untitled|Home|App)["'`]/.test(text)
        ? [{ where: ['(projeto)'], msg: 'title ainda é o placeholder do template', fix: 'nome real da propriedade. "Create Next App" já foi pro ar mais de uma vez.' }]
        : [],
  },
];

/* -------------------------------------------------------------------------- */
/* Contexto                                                                   */
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

  /* Projeto RUIM: um de cada defeito. */
  const bad = join(tmp, 'bad', 'app');
  mkdirSync(bad, { recursive: true });
  writeFileSync(join(bad, 'layout.tsx'), `export const metadata = { title: "Create Next App", openGraph: { images: ["/og.png"] } };
export default function L({ children }) { return <html><body>{children}</body></html>; }
`);
  writeFileSync(join(bad, 'page.tsx'), `export default function P() { return <form onSubmit={() => {}}><input /></form>; }
`);
  // segunda rota sem título próprio -> dispara rota-sem-titulo-proprio
  mkdirSync(join(bad, 'sobre'), { recursive: true });
  writeFileSync(join(bad, 'sobre', 'page.tsx'), `export default function S() { return <main>sobre</main>; }\n`);

  /* Projeto BOM: precisa devolver ZERO. Sem este lado, um regex que virou
     inerte passa despercebido pra sempre — foi assim que um extrator de copy
     jurou zero em cima de texto que nunca leu. */
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
  /* `sem-description` não dispara no bad porque o title placeholder já é o
     achado daquele arquivo; ela tem fixture própria. */
  const descOnly = mkdtempSync(join(tmpdir(), 'dist-scan-d-'));
  mkdirSync(join(descOnly, 'app'), { recursive: true });
  writeFileSync(join(descOnly, 'app', 'page.tsx'), `export const metadata = { title: "Página real da casa" };\nexport default function P(){return null}\n`);
  for (const f of audit(descOnly).findings) fired.add(f.rule);

  /* Projeto sem metadata NENHUMA: o bad tem no layout, então não serve. */
  const pelado = mkdtempSync(join(tmpdir(), 'dist-scan-p-'));
  mkdirSync(join(pelado, 'app'), { recursive: true });
  writeFileSync(join(pelado, 'app', 'page.tsx'), `export default function P(){return <main>oi</main>}\n`);
  for (const f of audit(pelado).findings) fired.add(f.rule);

  /* Trava do falso positivo: rota fora do indice (`robots: { index: false }`)
     nao precisa de `description` — ela nunca vai aparecer em busca. Antes
     desta trava, uma ferramenta interna ja marcada noindex entrava como HIGH. */
  const noindex = mkdtempSync(join(tmpdir(), 'dist-scan-ni-'));
  mkdirSync(join(noindex, 'app'), { recursive: true });
  writeFileSync(join(noindex, 'app', 'page.tsx'), `export const metadata = { title: "Dev - ferramenta interna", robots: { index: false } };\nexport default function D(){return null}\n`);
  const niF = audit(noindex).findings.filter((f) => f.rule === 'sem-description');
  if (niF.length) problems.push('falso positivo: sem-description disparou em rota noindex');

  /* Trava do falso positivo: `page.tsx` client component nao pode exportar
     metadata, entao o titulo proprio da rota mora no `layout.tsx` irmao.
     Antes desta trava a regra acusava 30 rotas que ja tinham titulo. */
  const porLayout = mkdtempSync(join(tmpdir(), 'dist-scan-tl-'));
  for (const rota of ['sobre', 'servicos']) {
    mkdirSync(join(porLayout, 'app', rota), { recursive: true });
    writeFileSync(join(porLayout, 'app', rota, 'layout.tsx'), `export const metadata = { title: "${rota} | Casa", description: "Texto de resultado de busca com tamanho de gente grande, escrito pra quem procura." };\nexport default function L({ children }) { return children; }\n`);
    writeFileSync(join(porLayout, 'app', rota, 'page.tsx'), `"use client";\nexport default function P(){return null}\n`);
  }
  const tlF = audit(porLayout).findings.filter((f) => f.rule === 'rota-sem-titulo-proprio');
  if (tlF.length) problems.push('falso positivo: rota-sem-titulo-proprio disparou com titulo no layout irmao');

  const silent = RULES.filter((r) => !fired.has(r.id)).map((r) => r.id);
  if (silent.length) problems.push(`regra(s) que nunca dispararam: ${silent.join(', ')}`);
  if (goodF.length) problems.push(`falso positivo no projeto limpo: ${goodF.map((f) => `${f.rule} (${f.msg})`).join(' | ')}`);

  if (problems.length) {
    console.error('dist-scan --self-test FALHOU');
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`dist-scan --self-test ok — ${RULES.length}/${RULES.length} regras disparam, projeto limpo devolve zero.`);
  process.exit(0);
}

/* -------------------------------------------------------------------------- */
/* Execução                                                                   */
/* -------------------------------------------------------------------------- */

const target = resolve(ROOT, argv.filter((a) => !a.startsWith('--'))[0] ?? '.');
if (!existsSync(target)) {
  console.error(`alvo não existe: ${target}`);
  process.exit(2);
}

const { ctx, findings } = audit(target);

if (JSON_OUT) {
  console.log(JSON.stringify({ target: norm(target), scanned: ctx.code.length, findings }, null, 2));
  process.exit(findings.some((f) => f.level === 'HIGH') ? 1 : 0);
}

console.log(`\ndist-scan  alvo: ${norm(target)}  (${ctx.code.length} arquivo(s), ${ctx.pages.length} página(s))\n`);

if (!ctx.pages.length && !ctx.layouts.length) {
  console.log('nenhuma página ou layout do Next no alvo — aponte pra raiz do app.');
  process.exit(2);
}

const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
for (const f of findings.sort((a, b) => order[a.level] - order[b.level])) {
  console.log(`${f.level.padEnd(6)} ${f.rule}`);
  console.log(`  ${f.msg}`);
  for (const w of f.where.slice(0, 8)) console.log(`    ${w}`);
  if (f.where.length > 8) console.log(`    ... e ${f.where.length - 8} a mais`);
  console.log(`  fix: ${f.fix}\n`);
}

const high = findings.filter((f) => f.level === 'HIGH').length;
console.log('-'.repeat(64));
console.log(
  findings.length
    ? `DISTRIBUIÇÃO: ${findings.length} achado(s), ${high} HIGH.`
    : 'DISTRIBUIÇÃO OK — a página existe fora dela mesma.',
);
if (high) {
  console.log('HIGH aqui não é detalhe: og:image faltando custa a taxa de clique de');
  console.log('todo link compartilhado, e não aparece em nenhuma tela que você abra.');
}
console.log('-'.repeat(64));
process.exit(high ? 1 : 0);
