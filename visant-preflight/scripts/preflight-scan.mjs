#!/usr/bin/env node
/* preflight-scan: the client-project preflight in one command.
 *
 *   node preflight-scan.mjs --assets "H:/My Drive/Clients/Brand"
 *   node preflight-scan.mjs --fonts "Syncopate,Funnel Sans"
 *   node preflight-scan.mjs --assets <dir> --fonts "A,B" --report PREFLIGHT.md
 *   node preflight-scan.mjs --self-test
 *
 * Answers the two questions nobody asks before designing and that always
 * come due later:
 *
 *   1. Can the PHOTOGRAPHY hold the layout I am about to design?
 *   2. Are the brand FONTS loadable, or will the browser silently fall back to
 *      the system font?
 *
 * Both were born from real losses (see SKILL.md). No dependencies: plain node,
 * image headers read by hand.
 *
 * GOLDEN RULE OF THIS SCRIPT: never filter silently. The scan that gave birth
 * to it filtered by minimum dimension, hid a whole folder of high-res photos
 * and produced the verdict "there is no high-res photo", which was wrong.
 * Here everything that is read shows up, and everything skipped shows up
 * saying why.
 *
 * Exit 1 with --strict if any item fails.
 */
import { readdirSync, statSync, openSync, readSync, closeSync, writeFileSync } from 'node:fs';
import { join, extname, basename, relative } from 'node:path';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const val = (n) => {
  const i = args.indexOf(n);
  return i !== -1 ? args[i + 1] : null;
};

/* ── Usage floors ───────────────────────────────────────────────────
   Minimum FILE width for each role, assuming a 1440 screen and no
   upscaling. Not opinion: it is the count of how many pixels the area
   takes. */
export const PISOS = [
  { papel: 'full-bleed band', minW: 2000 },
  { papel: 'hero portrait', minW: 1000 },
  { papel: 'grid cell', minW: 700 },
  { papel: 'small thumb', minW: 400 },
];

export function papelDe(w) {
  const p = PISOS.find((x) => w >= x.minW);
  return p ? p.papel : 'nothing: too small for web';
}

/* ── Image dimensions without dependencies ──────────────────────────
   PNG, JPEG and WebP cover everything that shows up in a brand folder. */
export function dimensoes(buf) {
  // PNG: signature + IHDR
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
  // JPEG: walks the markers until an SOFn
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

/** Walks recursively. Returns EVERYTHING, including what could not be read. */
export function inventario(raiz) {
  const achados = [];
  const pulados = [];
  const andar = (dir) => {
    let itens;
    try {
      itens = readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      pulados.push({ caminho: dir, motivo: `could not list (${e.code})` });
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
        if (!d) { pulados.push({ caminho: p, motivo: 'unrecognized header' }); continue; }
        achados.push({ caminho: p, ...d, kb: Math.round(statSync(p).size / 1024) });
      } catch (e) {
        pulados.push({ caminho: p, motivo: `read error (${e.code ?? e.message})` });
      }
    }
  };
  andar(raiz);
  return { achados, pulados };
}

/* ── Fonts ──────────────────────────────────────────────────────────
   Google's css2 API answers 200 for an existing family and 400 for a
   missing one. Public endpoint, no key. A network failure becomes
   'indefinido' (undetermined), never 'ausente' (missing). */
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

  casos.push(['band floor', papelDe(2400) === 'full-bleed band']);
  casos.push(['portrait floor', papelDe(1200) === 'hero portrait']);
  casos.push(['grid floor', papelDe(800) === 'grid cell']);
  casos.push(['failing floor', papelDe(300).startsWith('nothing')]);
  casos.push(['garbage is not a dimension', dimensoes(Buffer.from('none of this')) === null]);

  const fake = async (u) => ({ status: String(u).includes('Exists') ? 200 : 400 });
  casos.push(['font present', (await checarFonte('Exists', fake)) === 'google']);
  casos.push(['font missing', (await checarFonte('Missing', fake)) === 'ausente']);
  casos.push(['network down = undetermined', (await checarFonte('X', async () => { throw new Error('offline'); })) === 'indefinido']);

  let ok = true;
  for (const [nome, passou] of casos) {
    if (!passou) ok = false;
    console.log(`  ${passou ? 'ok  ' : 'FAIL'}  ${nome}`);
  }
  console.log(ok ? '\n✓ preflight-scan self-test' : '\n✗ preflight-scan self-test');
  process.exit(ok ? 0 : 1);
}

/* ── Run ────────────────────────────────────────────────────────────── */
const linhas = [];
const diz = (s = '') => { linhas.push(s); console.log(s); };
let reprovou = false;

const dirAssets = val('--assets');
if (dirAssets) {
  const { achados, pulados } = inventario(dirAssets);
  const fotos = achados.filter((a) => !a.vetor).sort((a, b) => b.w - a.w);
  const vetores = achados.filter((a) => a.vetor);

  diz(`\n## Photography: ${fotos.length} bitmap file(s)`);
  diz('');
  diz('| Resolution | Weight | Good for | File |');
  diz('|---|---|---|---|');
  for (const f of fotos) {
    diz(`| ${f.w}×${f.h} | ${f.kb}KB | ${papelDe(f.w)} | ${relative(dirAssets, f.caminho)} |`);
  }

  const teto = fotos.length ? fotos[0].w : 0;
  diz('');
  diz(`**Largest file: ${teto}px wide.** Usage ceiling: ${papelDe(teto)}.`);
  if (teto < 2000) {
    reprovou = true;
    diz('');
    diz('> ⚠ No image reaches 2000px. **Do not design a full-bleed band**: it');
    diz('> will stretch and arrive soft. Ask for a new shoot or design for the floors above.');
  }
  if (vetores.length) diz(`\n${vetores.length} SVG vector(s): resolution does not apply.`);

  if (pulados.length) {
    diz('\n### Skipped: read before concluding anything');
    for (const p of pulados) diz(`- ${p.caminho}: ${p.motivo}`);
  } else {
    diz('\nNothing was skipped in the scan.');
  }
}

const fontes = val('--fonts');
if (fontes) {
  diz('\n## Fonts');
  diz('');
  diz('| Family | Status |');
  diz('|---|---|');
  for (const fam of fontes.split(',').map((s) => s.trim()).filter(Boolean)) {
    const s = await checarFonte(fam);
    if (s !== 'google') reprovou = true;
    const rotulo = {
      google: 'Google Fonts: loads directly',
      ausente: '**MISSING from Google Fonts**: own license, or wrong name in the vault',
      indefinido: 'could not check (network)',
    }[s];
    diz(`| ${fam} | ${rotulo} |`);
  }
  diz('');
  diz('> A font that does not load throws no error: the browser silently falls');
  diz('> back to system-ui and the whole product changes voice. If any is MISSING,');
  diz('> confirm it in the font folder delivered to the client before accepting the vault.');
}

if (!dirAssets && !fontes) {
  console.log('usage: preflight-scan.mjs --assets <dir> --fonts "A,B" [--report file.md] [--strict]');
  process.exit(2);
}

const rel = val('--report');
if (rel) {
  writeFileSync(rel, `# Preflight\n${linhas.join('\n')}\n`, 'utf8');
  console.log(`\n✓ report written to ${rel}`);
}

if (reprovou && flag('--strict')) {
  console.error('\n✗ preflight failed');
  process.exit(1);
}
