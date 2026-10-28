#!/usr/bin/env node
/* copy-lint — caça os vícios de linguagem na copy Visant.
 *
 *   node copy-lint.mjs copy.json copy.ebook.json
 *   node copy-lint.mjs docs/COPY.md src/app/page.tsx
 *   node copy-lint.mjs --quiet copy.json          (só o exit code, pra CI)
 *   node copy-lint.mjs --include-comments a.tsx   (linta comentário também)
 *
 * Em .json, lê cada valor string e reporta a CHAVE (que é o data-copy do HTML).
 * Em qualquer outro arquivo, lê linha a linha e reporta o nº da linha.
 * Exit 1 se achar qualquer coisa, então serve de gate junto do copy:check.
 *
 * Em arquivo de código (.ts/.tsx/.js/.mjs/.vue/.svelte/.astro), COMENTÁRIO É
 * MASCARADO antes de lintar. O motivo é concreto: numa LP com a copy dentro do
 * componente, o único achado do linter eram os JSDoc que explicam a decisão de
 * design pro próximo dev. Comentário não é lido por cliente nenhum, e vício
 * apontado ali treina a pessoa a ignorar o linter. `--include-comments` volta ao
 * comportamento antigo quando você quer auditar a prosa interna de propósito.
 *
 * Sem dependência: roda com node puro em qualquer repo.
 *
 * ATENÇÃO ao mexer nas regex: \b do JS é ASCII, então NÃO funciona ao lado de
 * "é"/"são"/"não". Use os boundaries L/R abaixo (lookaround unicode) sempre que
 * a borda encostar em letra acentuada, senão a regra passa batido em silêncio.
 */
import { readFileSync } from 'node:fs';

const L = '(?<![\\p{L}\\p{N}])'; // início de palavra, unicode
const R = '(?![\\p{L}\\p{N}])'; // fim de palavra, unicode
const rx = (src) => new RegExp(src, 'giu');

/* Cada regra: id, o que casa, e o conserto que quase sempre funciona.
   `hint` é lido pelo humano E pelo agente que vai reescrever a linha.
   `family`: só a primeira regra da família reporta por trecho, pra não
   empilhar três avisos na mesma frase. */
const RULES = [
  {
    id: 'travessao',
    re: /[—–]/gu,
    hint: 'Travessão é proibido. Troque por ponto, vírgula, dois-pontos ou parênteses.',
  },
  {
    id: 'bolinha',
    /*
     * Só conta como SEPARADOR quando tem espaço de pelo menos um lado.
     *
     * Falso positivo confirmado em 2026-08-12 (visant-board): `DALL·E` é o nome
     * do produto, com a bolinha COLADA entre letras — nome próprio não é
     * pontuação, e acusar isso ensina o time a ignorar a regra justamente onde
     * ela está certa. Separador de metadado sempre respira: `a · b`.
     */
    /*
     * E uma SEQUENCIA de bolinhas nao e separador: e mascara de senha
     * (`••••••• (ja configurada)`), medida em 2026-08-12 no byok-panel. Duas ou
     * mais coladas nunca separam nada — separador e sempre uma so.
     */
    re: /(?:\s[·•∙‧](?![·•∙‧])|(?<![·•∙‧])[·•∙‧]\s)/gu,
    hint: 'Bolinha separadora (alt+7) é proibida. Em lista de metadado, vira ponto e vírgula ("34 páginas. 9 etapas, 1 case"). Em rótulo, dois-pontos ("Fase 1: A Estratégia"). Em CTA com preço, preposição ("Quero o e-book por R$ 47").',
  },
  {
    id: 'hifen-como-travessao',
    re: / -{1,2} /gu,
    hint: 'Hífen solto virou travessão. Vira ponto ou vírgula.',
  },
  {
    id: 'nao-e-x-e-y',
    family: 'negacao',
    re: rx(`${L}n[ãa]o\\s+(?:é|s[ãa]o|era|eram|foi|foram)${R}[^.!?;]{0,80}[.,;:]\\s*(?:é|s[ãa]o|era|foi|isso\\s+é)${R}`),
    hint: 'Construção "não é X, é Y". Corte a metade negativa e afirme só o Y. Se o X importa, mostre a consequência dele em vez de negá-lo.',
  },
  {
    id: 'nao-e-apenas',
    family: 'negacao',
    re: rx(`${L}n[ãa]o\\s+(?:é|s[ãa]o|foi)\\s+(?:apenas|s[óo]|somente)${R}`),
    hint: '"não é apenas X, é Y" promete profundidade sem entregar. Diga o Y direto.',
  },
  {
    id: 'nao-e-definicao',
    family: 'negacao',
    re: rx(`${L}n[ãa]o\\s+(?:é|s[ãa]o)\\s+(?:um|uma|o|a|os|as)?\\s*[^.!?]{2,40}[.!]`),
    hint: 'Frase que define pela negativa ("Não é um teaser."). Apague a frase inteira e deixe a afirmação seguinte carregar o peso.',
  },
  {
    id: 'nao-se-trata',
    family: 'negacao',
    re: rx(`${L}n[ãa]o\\s+se\\s+trata\\s+de${R}`),
    hint: 'Mesma família do "não é X, é Y". Afirme direto.',
  },
  {
    id: 'x-virgula-nao-y',
    family: 'negacao',
    re: rx(`,\\s*n[ãa]o\\s+(?:é|foi|s[óo]|apenas|somente|o|a|um|uma|de|pra|para|que)${R}`),
    hint: 'Negação pendurada no fim ("feito pra ler, não pra arquivar"). Apague o rabo negativo. A frase quase sempre fica mais forte.',
  },
  {
    id: 'e-sobre',
    re: rx(`${L}(?:é|era|s[ãa]o|eram)\\s+sobre${R}`),
    hint: '"é sobre X" não afirma nada. Troque por um verbo concreto: o que a coisa FAZ.',
  },
  {
    id: 'menos-x-mais-y',
    re: rx(`${L}menos\\s+[^.!?]{1,40}${L}e\\s+mais${R}`),
    hint: 'Fórmula "menos X e mais Y". Diga só o Y.',
  },
  {
    id: 'mais-que-apenas',
    re: rx(`${L}mais\\s+(?:do\\s+)?que\\s+(?:apenas|s[óo]|um\\s+simples|uma\\s+simples)${R}`),
    hint: 'Variante disfarçada do "não é apenas". Corte.',
  },
  {
    id: 'hype',
    re: rx(
      `${L}(?:revolucion[áa]ri\\w*|transformador\\w*|desbloqu\\w+|potencial\\s+m[áa]ximo|` +
        `eleve\\s+(?:seu|sua)|nunca\\s+foi\\s+t[ãa]o|no\\s+mundo\\s+de\\s+hoje|` +
        `cada\\s+vez\\s+mais\\s+competitivo|game\\s*changer|` +
        `jornada\\s+de\\s+(?:sucesso|transforma\\w+)|descubra\\s+o\\s+(?:poder|segredo))${R}`
    ),
    hint: 'Palavra de folder. Substitua por um fato verificável ou um número.',
  },
  {
    id: 'abertura-de-guru',
    re: rx(
      `${L}(?:imagine\\s+(?:que|se|s[óo]|comigo)|e\\s+se\\s+eu\\s+te\\s+dissesse|` +
        `prepare-se|chegou\\s+a\\s+hora|j[áa]\\s+parou\\s+pra\\s+pensar|` +
        `deixa\\s+eu\\s+te\\s+contar)${R}`
    ),
    hint: 'Abertura de guru. Comece pelo fato ou pela cena, sem aquecimento.',
  },
  {
    id: 'urgencia-cliche',
    re: rx(
      `${L}(?:[úu]ltimas\\s+vagas|vagas\\s+limitadas|[úu]ltima\\s+chance|` +
        `corre\\s+que\\s+(?:acaba|t[áa]\\s+acabando)|n[ãa]o\\s+perca\\s+(?:essa|a)\\s+chance|` +
        `por\\s+tempo\\s+limitado|s[óo]\\s+hoje)${R}`
    ),
    hint: 'Urgência genérica. A escassez do Club é real e contável: diga o número ("este lote tem 30 vagas", "a cota sobe a cada compra").',
  },
  {
    id: 'pipe-separador',
    jsonOnly: true, // em .md o pipe é tabela, não separador de copy
    re: /\|/gu,
    hint: 'Pipe separador é a bolinha de outro jeito. Escolha a pontuação: ponto, vírgula ou dois-pontos.',
  },
  {
    id: 'emoji',
    jsonOnly: true,
    /* Emoji_Presentation em vez de Extended_Pictographic: o segundo inclui
       © ® ™, que são marca registrada e ficam (Visionário®, Visant Club®). */
    re: /[\p{Emoji_Presentation}\u{1F300}-\u{1FAFF}]/gu,
    hint: 'Zero emoji em copy de página.',
  },
  {
    id: 'ponto-e-virgula',
    jsonOnly: true,
    re: /;/gu,
    hint: 'Ponto-e-vírgula trava a leitura em copy de venda. Vira ponto.',
  },
  {
    id: 'conector-de-llm',
    re: rx(
      `(?:^|\\n)\\s*(?:Al[ée]m\\s+disso|Por\\s+fim|Em\\s+resumo|` +
        `Vale\\s+(?:a\\s+pena\\s+)?(?:lembrar|ressaltar|destacar)|Em\\s+outras\\s+palavras)${R}`
    ),
    hint: 'Conector de redação de IA. Comece a frase pelo assunto.',
  },
];

/* Muletas que passam despercebidas uma vez e denunciam IA na segunda. São
   contadas no ARQUIVO INTEIRO, não na frase: o problema é a repetição.
   Origem: leitor pegou "trajetória real / projeto real / técnica real /
   processo real" numa peça só e postou print. Adjetivo de credibilidade não
   prova nada; quem prova é o número ou a cena. */
const REPEATS = [
  {
    id: 'selo-de-credibilidade',
    max: 1,
    /* Duas exceções, e as duas vieram de falso positivo medido em produção:

       "tempo real" é locução, não selo. Ela diz QUANDO a coisa acontece, e o
       lookbehind mata só ela sem enfraquecer "projeto real".

       "autenticado", "autenticar" e "autenticação" são login, e nada têm a ver
       com "autêntico". O `aut[êe]ntic\\w+` casava com as três porque o `[êe]`
       aceita a forma sem acento. Agora a regra lista as terminações do
       ADJETIVO e da qualidade, e deixa o verbo de fora. */
    /* Terceira exceção, e a mais óbvia depois de medida: em produto brasileiro
       "real"/"reais" é DINHEIRO antes de ser selo. `R$ 47`, "Real brasileiro",
       "1200 reais" — nenhum deles é defesa de argumento. O lookbehind cobre o
       número colado ("47 reais") e o nome da moeda; `R$` na mesma unidade é
       tratado fora do regex, no filtro de moeda abaixo. */
    re: rx(
      `${L}(?:(?<!tempo\\s)(?<!\\d\\s)(?<!brasileiro\\s)(?:real|reais)|de\\s+verdade|` +
        `na\\s+pr[áa]tica|de\\s+fato|genu[íi]n\\w+|aut[êe]ntic(?:o|a|os|as|idade)|` +
        `honest\\w+)${R}`
    ),
    /* Unidade que fala de dinheiro não entra na conta do selo. */
    ignoraUnidade: (text) => /R\$|\bBRL\b|\breal brasileiro\b/i.test(text),
    hint: 'Apague o selo. "Projeto real" é só "projeto"; "de verdade" no fim da frase é defesa de quem não confia no próprio argumento. Se precisa provar, use número ou cena.',
  },
];

const args = process.argv.slice(2);
const quiet = args.includes('--quiet');
const comentarios = args.includes('--include-comments');
const files = args.filter((a) => !a.startsWith('--'));

if (!files.length) {
  console.log('uso: copy-lint.mjs [--quiet] <arquivo...>');
  process.exit(1);
}

const CODIGO = /\.(?:[cm]?[jt]sx?|vue|svelte|astro)$/i;

/* Chave cujo valor é fala de outra pessoa. Ver a nota no laço principal. */
const CHAVE_DE_CITACAO = /(^|\.)(?:quote|quote_by|depoimento)$/;

/* Apaga comentário de código trocando por espaço, preservando \n pro nº da
   linha continuar batendo com o arquivo.
   Varre caractere a caractere porque regex não sabe a diferença entre o `//` de
   um comentário e o de `https://`. Se a varredura terminar dentro de string ou
   bloco aberto, o arquivo tem sintaxe que a gente não entendeu (ou uma
   apóstrofe solta em texto JSX): devolve o original e linta tudo, que errar
   pra mais é melhor que apagar copy em silêncio. */
function mascaraComentarios(raw) {
  let out = '';
  let i = 0;
  let estado = 'codigo'; // codigo | linha | bloco | "'" | '"' | '`'
  const vazio = (c) => (c === '\n' ? '\n' : ' ');

  while (i < raw.length) {
    const c = raw[i];
    const prox = raw[i + 1];

    if (estado === 'codigo') {
      if (c === '/' && prox === '/') { estado = 'linha'; out += '  '; i += 2; continue; }
      if (c === '/' && prox === '*') { estado = 'bloco'; out += '  '; i += 2; continue; }
      if (c === "'" || c === '"' || c === '`') estado = c;
      out += c; i++; continue;
    }

    if (estado === 'linha') {
      if (c === '\n') estado = 'codigo';
      out += vazio(c); i++; continue;
    }

    if (estado === 'bloco') {
      if (c === '*' && prox === '/') { estado = 'codigo'; out += '  '; i += 2; continue; }
      out += vazio(c); i++; continue;
    }

    /* Dentro de string: só a barra invertida e a mesma quote importam.
       Quebra de linha fecha ' e " porque em JS elas não atravessam linha. Sem
       isso, uma apóstrofe em texto JSX ("d'água") abriria uma string falsa e
       levaria o resto do arquivo com ela. */
    if ((estado === "'" || estado === '"') && c === '\n') { estado = 'codigo'; out += c; i++; continue; }
    if (c === '\\') { out += raw.slice(i, i + 2); i += 2; continue; }
    if (c === estado) estado = 'codigo';
    out += c; i++;
  }

  return estado === 'codigo' ? out : raw;
}

/* Devolve [{ loc, text }] — a unidade que a gente linta. Em json a unidade é
   a chave (porque é ela que o autor edita), em texto é a linha. */
function units(file) {
  const raw = readFileSync(file, 'utf8');
  if (!file.endsWith('.json')) {
    const fonte = CODIGO.test(file) && !comentarios ? mascaraComentarios(raw) : raw;
    return fonte.split('\n').map((text, i) => ({ loc: `L${i + 1}`, text }));
  }
  const out = [];
  const walk = (node, path) => {
    if (typeof node === 'string') return out.push({ loc: path, text: node });
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
    }
  };
  walk(JSON.parse(raw), '');
  return out;
}

/* Guia de tamanho por tipo de linha, inferido pelo sufixo da chave. É AVISO,
   nunca erro: copy boa não pode reprovar por 3 caracteres. Serve pra flagrar a
   headline que vai quebrar em três linhas no mobile. */
const LIMITS = [
  // SEO tem limite do Google, não do layout.
  { test: /^meta\.(title|og_title|og_image_alt)$/, max: 60, tipo: 'title de SEO' },
  { test: /^meta\.(description|og_description)$/, max: 160, tipo: 'meta description' },
  // As perguntas dentro da amostra do livro são corpo de texto, não headline.
  { test: /^sample\.(q\d+|p\d+)$/, max: 340, tipo: 'corpo' },
  { test: /(^|\.)(cta|cta_\w+|badge|free_badge)$/i, max: 28, tipo: 'CTA' },
  { test: /(^|\.)(title|q\d*|tier|eyebrow|label|kicker)$/i, max: 60, tipo: 'headline' },
  { test: /(^|\.)(lead|subtitle)$/i, max: 180, tipo: 'lead' },
  { test: /(^|\.)(body|body2|note|trigger|a\d+|_b)$/i, max: 280, tipo: 'corpo' },
];

function overLimit(loc, text) {
  const rule = LIMITS.find((l) => l.test.test(loc));
  if (!rule || text.length <= rule.max) return null;
  return `${loc} (${rule.tipo}) tem ${text.length} caracteres, guia é ${rule.max}`;
}

let hits = 0;
const byRule = new Map();
const warnings = [];
const porArquivo = new Map();

for (const file of files) {
  const found = [];
  const isJson = file.endsWith('.json');
  const unidades = units(file);
  porArquivo.set(file, unidades);
  for (const { loc, text } of unidades) {
    if (isJson) {
      const w = overLimit(loc, text);
      if (w) warnings.push(`${file}: ${w}`);
      /* CITAÇÃO NÃO SE EDITA. Chave que termina em `quote` carrega a fala de
         uma pessoa, atribuída e verificável, e reescrever ela pra caber numa
         regra de estilo é falsificar depoimento.

         O caso que forçou isto está no /lote: `pedagio.quote` é "Ele não é um
         bom designer, mas é um bom engenheiro", dita pelo Jaques na gravação
         do lote. Ela casa com `nao-e-definicao` e continua tendo que ficar
         exatamente como foi dita.

         O aviso de TAMANHO sai antes e continua valendo: citação comprida
         demais ainda quebra layout, e cortar citação com reticências é
         decisão editorial legítima. */
      if (CHAVE_DE_CITACAO.test(loc)) continue;
    }
    const seen = new Set();
    for (const rule of RULES) {
      if (rule.jsonOnly && !isJson) continue;
      if (rule.family && seen.has(rule.family)) continue;
      rule.re.lastIndex = 0;
      const m = rule.re.exec(text);
      if (!m) continue;
      if (rule.family) seen.add(rule.family);
      found.push({ loc, rule, match: m[0].trim(), text });
      byRule.set(rule.id, rule.hint);
      hits++;
    }
  }
  /* Pass de repetição: roda depois de varrer o arquivo inteiro.
   *
   * O orçamento é POR PEÇA, e num dicionário de locale a peça NÃO é o arquivo.
   * Medido no visantlabs-os: `pt-BR.json` tem 5173 chaves de dezenas de telas
   * independentes, e o limite de 1 acusava 11 ocorrências como se fossem a
   * mesma página. Regra que grita 11 vezes ensina a pessoa a ignorar o linter,
   * que é pior que não ter a regra.
   *
   * Em JSON o grupo passa a ser o primeiro segmento da chave (`onboarding.*`,
   * `mockup.*`) — o mais perto de "uma peça" que a estrutura oferece. Em
   * componente segue por arquivo, que já É a peça.
   */
  const grupoDe = (loc) => (isJson ? String(loc).split('.')[0] : file);

  for (const rule of REPEATS) {
    const porGrupo = new Map();
    for (const { loc, text } of unidades) {
      if (rule.ignoraUnidade?.(text)) continue;
      rule.re.lastIndex = 0;
      let m;
      while ((m = rule.re.exec(text))) {
        const g = grupoDe(loc);
        if (!porGrupo.has(g)) porGrupo.set(g, []);
        porGrupo.get(g).push({ loc, match: m[0] });
      }
    }
    for (const [grupo, onde] of porGrupo) {
      if (onde.length <= rule.max) continue;
      found.push({
        loc: onde.map((o) => o.loc).join(', '),
        rule,
        match: onde.map((o) => o.match).join('", "'),
        text: `${onde.length} ocorrências em ${isJson ? `${grupo}.*` : 'um arquivo'} (limite ${rule.max})`,
      });
      byRule.set(rule.id, rule.hint);
      hits++;
    }
  }

  if (quiet || !found.length) continue;
  console.log(`\n${file}`);
  for (const f of found) {
    console.log(`  ${f.rule.id.padEnd(22)} ${f.loc}`);
    console.log(`    ${f.text.length > 160 ? f.text.slice(0, 157) + '...' : f.text}`);
    console.log(`    ↑ casou: "${f.match}"`);
  }
}

/* Eco: a mesma frase morando em dois arquivos.
   Headline de LP costuma existir três vezes (componente, card do og:image,
   `<title>` do metadata) e nada avisa quando você troca uma e esquece as
   outras. O card social fica vendendo a promessa do mês passado. Sai como
   AVISO, porque duplicar às vezes é a escolha certa: o que não pode é ser
   surpresa. Só compara quando o linter recebeu 2+ arquivos.

   ARQUIVO DE CÓDIGO FICA DE FORA, e isso é medido, não preferência. Rodando o
   linter em 40 .tsx de um app React, o eco produziu 148 avisos contra 23
   vícios reais: seis para um. E os 148 eram lixo, porque em código o "texto"
   que sobra depois de tirar tag e chave ainda é sopa de atributo, então dois
   componentes com a mesma lista de classe do Tailwind viram "eco de 69
   palavras". Numa razão dessas a equipe aprende a ignorar a saída inteira, e
   aí o eco custa as 23 descobertas boas em vez de somar uma.

   Ele continua valendo onde nasceu para servir: JSON de copy, MD e HTML, que
   é onde a headline de verdade se repete entre a página e o card social. */
const paraEco = files.filter((f) => !CODIGO.test(f));
if (paraEco.length > 1) {
  /* Compara PALAVRA, não linha: no componente a headline vem quebrada em dois
     `<span>` e no card do og:image ela é uma string só, então bater linha com
     linha não acharia nada. Tag e chave de JSX saem fora, sobra a prosa. */
  const palavras = (file) =>
    porArquivo
      .get(file)
      .map((u) => u.text)
      .join(' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/[{}]/g, ' ')
      .toLowerCase()
      .match(/[\p{L}\p{N}\p{M}]+/gu) ?? [];

  const MIN_PALAVRAS = 6;
  for (let a = 0; a < paraEco.length; a++) {
    for (let b = a + 1; b < paraEco.length; b++) {
      const A = palavras(paraEco[a]);
      const B = palavras(paraEco[b]);
      /* Maior trecho comum, DP clássico em uma linha de estado. */
      let melhor = 0;
      let fim = 0;
      let anterior = new Array(B.length + 1).fill(0);
      for (let i = 1; i <= A.length; i++) {
        const atual = new Array(B.length + 1).fill(0);
        for (let j = 1; j <= B.length; j++) {
          if (A[i - 1] !== B[j - 1]) continue;
          atual[j] = anterior[j - 1] + 1;
          if (atual[j] > melhor) {
            melhor = atual[j];
            fim = i;
          }
        }
        anterior = atual;
      }
      if (melhor < MIN_PALAVRAS) continue;
      const trecho = A.slice(fim - melhor, fim).join(' ');
      warnings.push(
        `eco de ${melhor} palavras entre ${paraEco[a]} e ${paraEco[b]}, atualize as duas: "${trecho.slice(0, 70)}${trecho.length > 70 ? '…' : ''}"`
      );
    }
  }
}

/* Aviso de tamanho sai sempre, e NUNCA muda o exit code. */
if (warnings.length && !quiet) {
  console.log('\nAvisos (guia, não travam o exit code):');
  for (const w of warnings) console.log(`  ${w}`);
}

if (!hits) {
  if (!quiet) console.log('\n✔ copy limpa: nenhum vício encontrado.');
  process.exit(0);
}

if (!quiet) {
  console.log('\nComo consertar:');
  for (const [id, hint] of byRule) console.log(`  ${id}: ${hint}`);
}
console.error(`\n✗ ${hits} ocorrência(s) em ${files.length} arquivo(s).`);
process.exit(1);
