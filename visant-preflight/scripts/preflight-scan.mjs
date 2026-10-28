#!/usr/bin/env node
/* preflight-scan — o pré-voo de projeto de cliente num comando.
 *
 *   node preflight-scan.mjs --assets "H:/Meu Drive/@Clientes VSN/Marca"
 *   node preflight-scan.mjs --fonts "Syncopate,Funnel Sans"
 *   node preflight-scan.mjs --assets <dir> --fonts "A,B" --report PREVOO.md
 *   node preflight-scan.mjs --self-test
 *
 * Responde as duas perguntas que ninguém faz antes de desenhar e que sempre
 * cobram depois:
 *
 *   1. A FOTOGRAFIA aguenta o layout que eu vou desenhar?
 *   2. As FONTES da marca são carregáveis, ou o navegador vai cair no fallback
 *      do sistema em silêncio?
 *
 * Ambas nasceram de prejuízo real (ver SKILL.md). Sem dependência: node puro,
 * leitura de cabeçalho de imagem na mão.
 *
 * REGRA DE OURO DESTE SCRIPT: nunca filtrar em silêncio. A varredura que deu
 * origem a ele filtrou por dimensão mínima, escondeu uma pasta inteira de fotos
 * em alta e produziu o laudo "não existe foto em alta" — que estava errado.
 * Aqui tudo que é lido aparece, e tudo que é pulado aparece dizendo por quê.
 *
 * Exit 1 com --strict se algum item reprovar.
 */
import { readdirSync, statSync, openSync, readSync, closeSync, writeFileSync } from 'node:fs';
import { join, extname, basename, relative } from 'node:path';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const val = (n) => {
  const i = args.indexOf(n);
  return i !== -1 ? args[i + 1] : null;
};

/* ── Pisos de uso ───────────────────────────────────────────────────
   Largura mínima do ARQUIVO para cada papel, assumindo tela de 1440 e
   nenhuma ampliação. Não são opinião: são a conta de quantos pixels a
   área ocupa. */
export const PISOS = [
  { papel: 'faixa full-bleed', minW: 2000 },
  { papel: 'retrato de herói', minW: 1000 },
  { papel: 'célula de grade', minW: 700 },
  { papel: 'thumb pequeno', minW: 400 },
];

export function papelDe(w) {
  const p = PISOS.find((x) => w >= x.minW);
  return p ? p.papel : 'nada — pequena demais para web';
}

/* ── Dimensão de imagem sem dependência ─────────────────────────────
   PNG, JPEG e WebP cobrem tudo que aparece em pasta de marca. */
export function dimensoes(buf) {
  // PNG: assinatura + IHDR
  if (buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  // WebP: RIFF ... WEBP
  if (buf.length > 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const tipo = buf.toString('ascii', 12, 16);
    if (tipo === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    if (tipo === 'VP8L') {
      const b = buf.readUInt32LE(21);
      return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 };
    }
    if (tipo === 'VP8X') {
      const rd = (o) => buf[o] | (buf[o + 1] << 8) | (buf[o + 2] << 16);
      return { w: rd(24) + 1, h: rd(27) + 1 };
    }
  }
  // JPEG: percorre marcadores até um SOFn
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let o = 2;
    while (o + 9 < buf.length) {
      if (buf[o] !== 0xff) { o++; continue; }
      const m = buf[o + 1];
      const sof = (m >= 0xc0 && m <= 0xcf) && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;
      if (sof) return { w: buf.readUInt16BE(o + 7), h: buf.readUInt16BE(o + 5) };
      o += 2 + buf.readUInt16BE(o + 2);
    }
  }
  return null;
}

function lerCabecalho(p, n = 65536) {
  const fd = openSync(p, 'r');
  try {
    const buf = Buffer.alloc(n);
    const lidos = readSync(fd, buf, 0, n, 0);
    return buf.subarray(0, lidos);
  } finally {
    closeSync(fd);
  }
}

const EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.svg']);

/** Varre recursivamente. Devolve TUDO — inclusive o que não deu para ler. */
export function inventario(raiz) {
  const achados = [];
  const pulados = [];
  const andar = (dir) => {
    let itens;
    try {
      itens = readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      pulados.push({ caminho: dir, motivo: `não deu para listar (${e.code})` });
      return;
    }
    for (const it of itens) {
      const p = join(dir, it.name);
      if (it.isDirectory()) { andar(p); continue; }
      const ext = extname(it.name).toLowerCase();
      if (!EXT.has(ext)) continue;
      if (it.name === 'desktop.ini') continue;
      if (ext === '.svg') {
        achados.push({ caminho: p, w: null, h: null, vetor: true, kb: Math.round(statSync(p).size / 1024) });
        continue;
      }
      try {
        const d = dimensoes(lerCabecalho(p));
        if (!d) { pulados.push({ caminho: p, motivo: 'cabeçalho não reconhecido' }); continue; }
        achados.push({ caminho: p, ...d, kb: Math.round(statSync(p).size / 1024) });
      } catch (e) {
        pulados.push({ caminho: p, motivo: `erro de leitura (${e.code ?? e.message})` });
      }
    }
  };
  andar(raiz);
  return { achados, pulados };
}

/* ── Fontes ─────────────────────────────────────────────────────────
   A API css2 do Google responde 200 para família existente e 400 para
   inexistente. Endpoint público, sem chave. Falha de rede vira
   'indefinido', nunca 'ausente'. */
export async function checarFonte(familia, fetchImpl = fetch) {
  const nome = String(familia).trim().replace(/\s+/g, '+');
  const url = `https://fonts.googleapis.com/css2?family=${nome}:wght@400&display=swap`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetchImpl(url, { signal: ctrl.signal, headers: { 'user-agent': 'visant-preflight' } });
    clearTimeout(t);
    if (res.status === 200) return 'google';
    if (res.status === 400 || res.status === 404) return 'ausente';
    return 'indefinido';
  } catch {
    return 'indefinido';
  }
}

/* ── Self-test ──────────────────────────────────────────────────────── */
if (flag('--self-test')) {
  const casos = [];
  const png = Buffer.alloc(24);
  png.writeUInt32BE(0x89504e47, 0); png.writeUInt32BE(1200, 16); png.writeUInt32BE(1500, 20);
  const d = dimensoes(png);
  casos.push(['PNG 1200x1500', d?.w === 1200 && d?.h === 1500]);

  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x07, 0x64, 0x0d, 0x48, 0, 0, 0, 0, 0]);
  const dj = dimensoes(jpg);
  casos.push(['JPEG 3400x1892', dj?.w === 0x0d48 && dj?.h === 0x0764]);

  casos.push(['piso faixa', papelDe(2400) === 'faixa full-bleed']);
  casos.push(['piso retrato', papelDe(1200) === 'retrato de herói']);
  casos.push(['piso grade', papelDe(800) === 'célula de grade']);
  casos.push(['piso reprovado', papelDe(300).startsWith('nada')]);
  casos.push(['lixo não vira dimensão', dimensoes(Buffer.from('nada disso')) === null]);

  const fake = async (u) => ({ status: String(u).includes('Existe') ? 200 : 400 });
  casos.push(['fonte presente', (await checarFonte('Existe', fake)) === 'google']);
  casos.push(['fonte ausente', (await checarFonte('Termina', fake)) === 'ausente']);
  casos.push(['rede caída = indefinido', (await checarFonte('X', async () => { throw new Error('offline'); })) === 'indefinido']);

  let ok = true;
  for (const [nome, passou] of casos) {
    if (!passou) ok = false;
    console.log(`  ${passou ? 'ok  ' : 'FALHA'}  ${nome}`);
  }
  console.log(ok ? '\n✓ preflight-scan self-test' : '\n✗ preflight-scan self-test');
  process.exit(ok ? 0 : 1);
}

/* ── Execução ───────────────────────────────────────────────────────── */
const linhas = [];
const diz = (s = '') => { linhas.push(s); console.log(s); };
let reprovou = false;

const dirAssets = val('--assets');
if (dirAssets) {
  const { achados, pulados } = inventario(dirAssets);
  const fotos = achados.filter((a) => !a.vetor).sort((a, b) => b.w - a.w);
  const vetores = achados.filter((a) => a.vetor);

  diz(`\n## Fotografia — ${fotos.length} arquivo(s) de bitmap`);
  diz('');
  diz('| Resolução | Peso | Serve para | Arquivo |');
  diz('|---|---|---|---|');
  for (const f of fotos) {
    diz(`| ${f.w}×${f.h} | ${f.kb}KB | ${papelDe(f.w)} | ${relative(dirAssets, f.caminho)} |`);
  }

  const teto = fotos.length ? fotos[0].w : 0;
  diz('');
  diz(`**Maior arquivo: ${teto}px de largura.** Teto de uso: ${papelDe(teto)}.`);
  if (teto < 2000) {
    reprovou = true;
    diz('');
    diz('> ⚠ Nenhuma imagem chega a 2000px. **Não desenhe faixa full-bleed** — ela');
    diz('> vai esticar e chegar mole. Peça ensaio novo ou projete para os pisos acima.');
  }
  if (vetores.length) diz(`\n${vetores.length} vetor(es) SVG — resolução não se aplica.`);

  if (pulados.length) {
    diz('\n### Pulados — leia antes de concluir qualquer coisa');
    for (const p of pulados) diz(`- ${p.caminho} — ${p.motivo}`);
  } else {
    diz('\nNada foi pulado na varredura.');
  }
}

const fontes = val('--fonts');
if (fontes) {
  diz('\n## Fontes');
  diz('');
  diz('| Família | Situação |');
  diz('|---|---|');
  for (const fam of fontes.split(',').map((s) => s.trim()).filter(Boolean)) {
    const s = await checarFonte(fam);
    if (s !== 'google') reprovou = true;
    const rotulo = {
      google: 'Google Fonts — carrega direto',
      ausente: '**AUSENTE no Google Fonts** — licença própria, ou nome errado no vault',
      indefinido: 'não deu para checar (rede)',
    }[s];
    diz(`| ${fam} | ${rotulo} |`);
  }
  diz('');
  diz('> Fonte que não carrega não dá erro: o navegador cai em system-ui em');
  diz('> silêncio e o produto inteiro muda de voz. Se alguma está AUSENTE,');
  diz('> confirme na pasta de fontes entregue ao cliente antes de aceitar o vault.');
}

if (!dirAssets && !fontes) {
  console.log('uso: preflight-scan.mjs --assets <dir> --fonts "A,B" [--report arq.md] [--strict]');
  process.exit(2);
}

const rel = val('--report');
if (rel) {
  writeFileSync(rel, `# Pré-voo\n${linhas.join('\n')}\n`, 'utf8');
  console.log(`\n✓ relatório em ${rel}`);
}

if (reprovou && flag('--strict')) {
  console.error('\n✗ pré-voo reprovado');
  process.exit(1);
}
