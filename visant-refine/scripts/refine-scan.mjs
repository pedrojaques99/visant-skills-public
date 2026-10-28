#!/usr/bin/env node
/* refine-scan — o portão grepável da camada de acabamento.
 *
 *   node refine-scan.mjs components/admin/finance
 *   node refine-scan.mjs --self-test        (prova o detector nos dois sentidos)
 *
 * Seis regras, todas de coisa que compila, passa no lint e mesmo assim quebra:
 *
 *   CHART_RAW_COLOR      cor crua em prop de gráfico (hex, rgb, palette Tailwind)
 *   CHART_WITHOUT_STATE  gráfico sem ChartState: eixo vazio no lugar de "sem dado"
 *   DEFS_ID_NOT_SCOPED   id literal em defs/clipPath: dois gráficos colidem
 *   HARDCODED_MOTION     cubic-bezier ou duração fora do SSoT
 *   BAD_EASE             ease-in em UI, transition-all, animate-bounce, scale(0)
 *   LAYOUT_ANIMATION     animação de width/height/margin/padding
 *
 * Complementa, não substitui: `impeccable detect` e `npm run audit:design` pegam
 * o tell visual, e o killer-scan roda os três juntos. Exit 1 em qualquer achado.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

const args = process.argv.slice(2);
const selfTest = args.includes('--self-test');
const targets = args.filter((a) => !a.startsWith('--'));

if (!targets.length && !selfTest) {
  console.error('uso: node refine-scan.mjs <arquivos-ou-pastas>');
  console.error('     node refine-scan.mjs --self-test');
  process.exit(2);
}

const ROOT = process.cwd();
const norm = (p) => p.split(sep).join('/');

/* O caminho guardado é SEMPRE absoluto; encurtar é coisa da impressão.
   `relative(cwd, alvo)` entre drives diferentes (cwd em C:, alvo em Z:) devolve
   algo que não resolve de volta, e o scan morria com
   `ENOENT: C:\Users\...\D:\dev\...`. Agente que chama o detector de fora
   sempre passa caminho absoluto, então esse era o caminho quente, não a borda. */
const abs = (p) => resolve(ROOT, p);
const disp = (p, base) => {
  const r = relative(base, p);
  return norm(r && !r.startsWith('..') && !isAbsolute(r) ? r : p);
};
/* `__fixtures__` e `.next-*` entram por auditoria (2026-08-12).
 *
 * `__fixtures__` é o corpus de teste de um linter: um arquivo cheio de defeitos
 * DE PROPÓSITO, que existe pra provar que as regras ainda disparam. Varrê-lo faz
 * um detector acusar o material de prova de outro — e o conserto "óbvio" seria
 * apagar os defeitos do fixture, que é exatamente como uma bateria de regressão
 * morre. O `motion-lint` já ignorava; este não, e a diferença só apareceu quando
 * os dois rodaram no mesmo repo.
 *
 * `.next-*` é build com nome próprio (NEXT_DIST_DIR), usado por quem roda dois
 * dev servers lado a lado. Lá dentro todo token já está inline, então o detector
 * reporta o trabalho do compilador como se fosse do autor. */
const SKIP_DIR = /^(node_modules|\.next|\.next-.*|\.git|dist|build|coverage|__fixtures__)$/;

function walk(p, out = []) {
  const st = statSync(p);
  if (st.isDirectory()) {
    for (const name of readdirSync(p)) {
      if (SKIP_DIR.test(name)) continue;
      walk(join(p, name), out);
    }
  } else if (/\.(tsx|jsx)$/.test(p)) {
    out.push(p);
  }
  return out;
}

const CHART_MARK = /<(ResponsiveContainer|AreaChart|LineChart|BarChart|PieChart|RadialBarChart|ComposedChart)\b/;
const CHART_COLOR_PROP = /\b(stroke|fill|stopColor|color|activeStroke)\s*=\s*(["'{])/;
/* Cor CRUA é a que traz o número. `hsl(var(--muted-foreground))` é token e passa:
   neste repo os tokens guardam canal HSL solto (`--primary: 0 0% 9%`), então o
   envelope `hsl(...)` é obrigatório e `var(--primary)` sozinho não é cor nenhuma.
   A regra anterior acusava o certo e absolvia o errado. */
const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(\s*(?!var\()[\d.]/;
/** `var(--x)` sem envelope numa prop de cor: silenciosamente sem cor. */
const NAKED_VAR = /=\s*["']\s*var\(--[^)]+\)\s*["']/;
const TW_PALETTE = /\b(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|[1-9]00|950)\b/;

/** Uma regra: id, se casa na linha, e o conserto que quase sempre serve. */
const RULES = [
  {
    id: 'CHART_RAW_COLOR',
    /* Só em arquivo que importa recharts. Sem isso a regra acusava material de
       three.js e ícone de SVG, onde `color="#fff"` não é token nenhum: é a API
       da lib. Detector que grita fora do escopo é detector que a pessoa desliga. */
    requires: /from ['"]recharts['"]/,
    test: (line) =>
      CHART_COLOR_PROP.test(line) &&
      (RAW_COLOR.test(line) || TW_PALETTE.test(line) || NAKED_VAR.test(line)),
    hint: 'Cor de série sai de token COM envelope: stroke="hsl(var(--primary))". Os tokens guardam canal HSL solto, então var(--x) pelado não é cor e o traço some sem erro nenhum.',
  },
  {
    id: 'DEFS_ID_NOT_SCOPED',
    test: (line, _i, src) =>
      /<(linearGradient|radialGradient|clipPath|filter|pattern)\b/.test(line) &&
      /\sid\s*=\s*["'][^"'{]+["']/.test(line) &&
      !/useId/.test(src),
    hint: 'id de defs precisa de escopo por instância (useId). Dois gráficos com o mesmo id se sobrescrevem, e o bug aparece em só um dos dois.',
  },
  {
    id: 'HARDCODED_MOTION',
    test: (line) => /cubic-bezier\(/.test(line) || /duration-\[\d+ms\]/.test(line),
    hint: 'Easing e duração vêm do SSoT: [transition-timing-function:var(--ease-out)] e [transition-duration:var(--dur-base)].',
  },
  {
    id: 'BAD_EASE',
    // O primitivo compartilhado é upstream (shadcn) e tem caso legítimo: a
    // sidebar anima largura porque é isso que uma sidebar faz. Mesma exceção do
    // codemod de transition-all no visant-motion. Suprimido é CONTADO no fim,
    // nunca calado: corte silencioso se lê como "está tudo limpo".
    skipUi: true,
    test: (line) =>
      /\btransition-all\b/.test(line) ||
      /\bease-in\b(?!-out)/.test(line) ||
      /\banimate-bounce\b/.test(line) ||
      /scale\(0\)|scale-0\b/.test(line),
    hint: 'transition-all anima o que você não pediu; ease-in em UI parece travado; bounce e scale(0) são tell de template.',
  },
  {
    id: 'LAYOUT_ANIMATION',
    skipUi: true,
    test: (line) => /transition-\[(?:[^\]]*\b(?:width|height|margin|padding|top|left)\b)/.test(line),
    hint: 'Anime só transform e opacity. Width e height passam pelo layout a cada quadro e jankam.',
  },
];

/**
 * Regra de arquivo, não de linha: gráfico sem estado.
 *
 * A prova de "tem estado" era `ChartState|isEmpty`: anglófona, num código em
 * português. `HoursPanorama.tsx` separa erro, vazio e carregando em três ramos
 * de um ternário (`error && !data`, `vazio`, `isLoading`) e era acusado mesmo
 * assim, só porque a variável se chama `vazio` e não `isEmpty`.
 *
 * E a regra pedia de menos: `isEmpty` sozinho absolvia o gráfico que trata erro
 * de rede COMO vazio, que é o defeito exato que ela existe pra pegar ("eixo
 * vazio com moldura é o 0 itens que na verdade era erro").
 *
 * Mas o ramo de erro só é cobrável de quem BUSCA o dado. Exigi-lo de todo mundo
 * acusou `HoursTeamChart` e `LeaderboardRace`, que recebem `isLoading` por prop
 * e já entram em `ChartState`: num componente de desenho não existe erro pra
 * tratar, ele mora no pai que faz o fetch. Regra que acusa dois e acerta zero é
 * regra, não código.
 */
const CHART_EMPTY_MARK = /ChartState|isEmpty|\bvazio\b|\bsemDado\b|\bnoData\b/;
const CHART_ERROR_MARK = /\berror\b/;
/** Quem busca o próprio dado responde também pelo erro. */
const CHART_FETCHES = /\buseSWR\b|\buseQuery\b|\bfetch\(/;

function fileRules(file, src) {
  const out = [];
  const temVazio = CHART_EMPTY_MARK.test(src);
  const deveTratarErro = CHART_FETCHES.test(src);
  const temEstado = temVazio && (!deveTratarErro || CHART_ERROR_MARK.test(src));
  if (CHART_MARK.test(src) && !temEstado) {
    const i = src.split(/\r?\n/).findIndex((l) => CHART_MARK.test(l));
    out.push({
      id: 'CHART_WITHOUT_STATE',
      line: i + 1,
      hint: 'Todo gráfico entra em ChartState: eixo vazio com moldura é o "0 itens" que na verdade era erro de rede.',
      excerpt: 'gráfico sem estado de vazio nem de carregando',
    });
  }
  return out;
}

let suppressedUi = 0;

function scan(file, srcOverride) {
  /* `file` já chega absoluto (ver `abs()` acima). O `join(ROOT, file)` que
     estava aqui era exatamente o crash cross-drive: virava
     `C:\Users\...\D:\dev\...`. */
  const src = srcOverride ?? readFileSync(file, 'utf8');
  const lines = src.split(/\r?\n/);
  const isUi = /\/(components\/)?ui\//.test(`/${norm(file)}`);
  const findings = [];

  lines.forEach((raw, i) => {
    // Comentário não é código: não vale acusar o exemplo escrito na explicação.
    if (/^\s*(\{\s*)?(\/\/|\*|\/\*)/.test(raw)) return;
    for (const rule of RULES) {
      if (rule.requires && !rule.requires.test(src)) continue;
      if (!rule.test(raw, i, src)) continue;
      if (rule.skipUi && isUi) {
        suppressedUi++;
        continue;
      }
      findings.push({ id: rule.id, line: i + 1, hint: rule.hint, excerpt: raw.trim().slice(0, 96) });
    }
  });

  findings.push(...fileRules(file, src));
  return findings;
}

/* ---------- self-test ---------- */

const BAD_FIXTURE = `
import { AreaChart, ResponsiveContainer, Area } from 'recharts';
export function Ruim() {
  return (
    <ResponsiveContainer>
      <AreaChart data={[]}>
        <defs><linearGradient id="fill" /></defs>
        <Area dataKey="v" stroke="#7c3aed" fill="url(#fill)" />
        <Area dataKey="w" stroke="text-purple-400" />
        <Area dataKey="x" stroke="hsl(210 40% 50%)" />
        <Area dataKey="y" stroke="var(--primary)" />
      </AreaChart>
      <div className="transition-all ease-in duration-[420ms]" />
      <div className="transition-[width,height]" style={{ transitionTimingFunction: 'cubic-bezier(.1,.2,.3,.4)' }} />
    </ResponsiveContainer>
  );
}
`;

const GOOD_FIXTURE = `
import { useId } from 'react';
import { AreaChart, ResponsiveContainer, Area } from 'recharts';
import { ChartState } from './ChartState';
export function Bom({ isLoading, isEmpty, error }) {
  const gid = useId();
  if (error) return <p>Não foi possível carregar.</p>;
  return (
    <ChartState isLoading={isLoading} isEmpty={isEmpty}>
      <ResponsiveContainer>
        <AreaChart data={[]}>
          <defs><linearGradient id={\`fill-\${gid}\`} /></defs>
          <Area dataKey="v" stroke="hsl(var(--primary))" fill={\`url(#fill-\${gid})\`} />
          <Area dataKey="w" stroke="hsl(var(--muted-foreground))" />
        </AreaChart>
      </ResponsiveContainer>
      <div className="transition-colors [transition-duration:var(--dur-base)] [transition-timing-function:var(--ease-out)]" />
    </ChartState>
  );
}
`;

/**
 * O caso que a regra anglófona acusava por engano: estados existem, separados em
 * três ramos, mas nomeados em PORTUGUÊS. Veio de `HoursPanorama.tsx` no
 * visant-board. Fica no fixture pra que o conserto da regra não se perca.
 */
const GOOD_FIXTURE_PT = `
import { LineChart, ResponsiveContainer, Line } from 'recharts';
export function Panorama({ data, error, isLoading, mutate }) {
  const vazio = !data?.pontos?.length;
  if (error && !data) return <button onClick={mutate}>Tentar de novo</button>;
  if (vazio) return <p>Nenhuma hora apontada neste período.</p>;
  return (
    <ResponsiveContainer>
      <LineChart data={data.pontos}>
        <Line dataKey="v" stroke="hsl(var(--primary))" isAnimationActive={!isLoading} />
      </LineChart>
    </ResponsiveContainer>
  );
}
`;

/**
 * Gráfico APRESENTACIONAL: recebe `isLoading` por prop e entra em `ChartState`.
 * Não busca nada, então não tem erro pra tratar. Veio de `HoursTeamChart.tsx` e
 * `LeaderboardRace.tsx`, que uma versão intermediária desta regra acusou por
 * exigir `error` de todo gráfico.
 */
const GOOD_FIXTURE_BURRO = `
import { BarChart, ResponsiveContainer, Bar } from 'recharts';
import { ChartState } from './ChartState';
export function Desenho({ points, isLoading }) {
  return (
    <ChartState isLoading={isLoading} isEmpty={points.length === 0}>
      <ResponsiveContainer>
        <BarChart data={points}><Bar dataKey="v" stroke="hsl(var(--primary))" /></BarChart>
      </ResponsiveContainer>
    </ChartState>
  );
}
`;

/**
 * O caso que a regra ANTIGA absolvia: BUSCA o dado, tem `isEmpty`, e não separa
 * o erro. É o "0 itens que na verdade era erro de rede" da hint, passando batido.
 */
const BAD_FIXTURE_SEM_ERRO = `
import useSWR from 'swr';
import { BarChart, ResponsiveContainer, Bar } from 'recharts';
export function SoVazio() {
  const { data } = useSWR('/api/horas');
  const isEmpty = !data?.length;
  if (isEmpty) return <p>Sem dados.</p>;
  return (
    <ResponsiveContainer>
      <BarChart data={data}><Bar dataKey="v" stroke="hsl(var(--primary))" /></BarChart>
    </ResponsiveContainer>
  );
}
`;

if (selfTest) {
  const bad = scan('fixture-ruim.tsx', BAD_FIXTURE);
  const good = [
    ...scan('fixture-bom.tsx', GOOD_FIXTURE),
    ...scan('fixture-bom-pt.tsx', GOOD_FIXTURE_PT),
    ...scan('fixture-bom-burro.tsx', GOOD_FIXTURE_BURRO),
  ];
  const semErro = scan('fixture-so-vazio.tsx', BAD_FIXTURE_SEM_ERRO);
  const esperadas = ['CHART_RAW_COLOR', 'DEFS_ID_NOT_SCOPED', 'HARDCODED_MOTION', 'BAD_EASE', 'LAYOUT_ANIMATION', 'CHART_WITHOUT_STATE'];
  const achadas = new Set(bad.map((f) => f.id));
  const faltando = esperadas.filter((id) => !achadas.has(id));

  console.log(`\nself-test do refine-scan\n`);
  console.log(faltando.length
    ? `[FALHA] regra que não disparou no fixture ruim: ${faltando.join(', ')}`
    : `[OK]    as ${esperadas.length} regras disparam no fixture ruim`);
  console.log(good.length
    ? `[FALHA] falso positivo no fixture bom: ${good.map((f) => `${f.id}:${f.line}`).join(', ')}`
    : '[OK]    nenhum falso positivo nos 3 fixtures bons (estado em pt, gráfico apresentacional)');
  // Teste de POSITIVO da regra consertada: quem BUSCA e só trata vazio TEM que cair.
  const pegouSemErro = semErro.some((f) => f.id === 'CHART_WITHOUT_STATE');
  console.log(pegouSemErro
    ? '[OK]    gráfico que busca e trata erro de rede como vazio é acusado'
    : '[FALHA] gráfico que trata erro de rede como vazio passou batido');
  console.log('-'.repeat(64));
  const failed = faltando.length + good.length + (pegouSemErro ? 0 : 1);
  console.log(failed ? 'DETECTOR QUEBRADO.' : 'DETECTOR OK. Caso novo: acrescente no fixture, nunca substitua.');
  process.exit(failed ? 1 : 0);
}

/* ---------- execução ---------- */

const files = [];
let base = ROOT;
for (const t of targets) {
  const a = abs(t);
  if (!existsSync(a)) {
    console.error(`alvo não existe: ${t}`);
    console.error(`  (resolvido para ${a})`);
    process.exit(2);
  }
  if (targets.length === 1) base = statSync(a).isDirectory() ? a : ROOT;
  walk(a, files);
}

let total = 0;
for (const file of files) {
  const findings = scan(file);
  if (!findings.length) continue;
  total += findings.length;
  console.log(`\n${disp(file, base)}`);
  for (const f of findings.sort((a, b) => a.line - b.line)) {
    console.log(`  ${f.id}  linha ${f.line}`);
    console.log(`      ${f.excerpt}`);
    console.log(`      ${f.hint}`);
  }
}

console.log('\n' + '-'.repeat(64));
if (suppressedUi) {
  console.log(`${suppressedUi} achado(s) suprimido(s) em components/ui (primitivo upstream, caso legítimo de animar largura). Reveja à mão se mexer num primitivo.`);
}
console.log(total
  ? `REFINO FECHADO: ${total} achado(s) em ${files.length} arquivo(s).`
  : `REFINO ABERTO: zero achado em ${files.length} arquivo(s).`);
/* Este rodapé existe porque um zero daqui já foi lido como auditoria completa.
   Script termina em exit code, e exit code parece acabamento — foi assim que
   uma rodada pulou o visant-frontend inteiro e não percebeu. O detector é uma
   fatia; quem fecha o portão é o killer-scan, que exige a tabela de superfícies
   e o registro de ter aberto a tela. */
console.log('');
console.log('Isto é UM detector, não a auditoria. Ele não vê forma escolhida,');
console.log('estouro a 390px, nem tela que ninguém abriu. Para fechar o portão:');
console.log('  node ~/.claude/skills/visant-killer/scripts/killer-scan.mjs --report AUDIT.md <alvo>');
console.log('-'.repeat(64));
process.exit(total ? 1 : 0);
