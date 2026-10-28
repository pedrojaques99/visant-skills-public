#!/usr/bin/env node
// Roda o corta-scan.js (texto cortado, overlay empilhado, peça fora do pai) em várias rotas e larguras
// de uma URL publicada, sem instalar nada: usa o Playwright do cache do npx.
// Também mede estouro horizontal do DOCUMENTO — o número que vale (Passo 5 do killer).
//
//   node corta-url.mjs https://site.vercel.app home sobre contato   [--widths 390,1440]
//
// Rota vai SEM barra ('home' = raiz): no Git Bash, '/sobre' vira 'C:/Program Files/Git/sobre'
// pela conversão de caminho do MSYS (ou rode com MSYS_NO_PATHCONV=1).
//
// Por que headless e não a aba dirigida: a aba conduzida por automação fica `hidden` e o rAF não roda
// (memória aba-dirigida-fica-hidden-raf-nao-roda) — reveal por GSAP mede como "cortado" o que só não
// terminou de entrar. Aqui a página rola até o fim antes de medir, para disparar todo ScrollTrigger.
import { readdirSync, existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const wI = args.indexOf('--widths')
const widths = wI >= 0 ? args[wI + 1].split(',').map(Number) : [390, 1440]
const pos = args.filter((a, i) => !a.startsWith('--') && (wI < 0 || i !== wI + 1))
const [base, ...routes] = pos
if (!base) { console.error('uso: corta-url.mjs <base-url> [rota...] [--widths 390,1440]'); process.exit(2) }

function findPlaywright() {
  const cache = join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'npm-cache', '_npx')
  for (const d of existsSync(cache) ? readdirSync(cache) : []) {
    const p = join(cache, d, 'node_modules', 'playwright', 'index.js')
    if (existsSync(p)) return p
  }
  throw new Error('Playwright não está no cache do npx. Rode uma vez: npx playwright --version')
}
const pw = await import(pathToFileURL(findPlaywright()).href)
const { chromium } = pw.default ?? pw
const scanSrc = readFileSync(join(here, 'corta-scan.js'), 'utf8').replace(/if \(typeof module[\s\S]*$/, '')

const browser = await chromium.launch()
let total = 0
for (const w of widths) {
  const page = await browser.newPage({ viewport: { width: w, height: w < 768 ? 844 : 900 }, reducedMotion: 'no-preference' })
  for (const r0 of routes.length ? routes : ['home']) {
    const r = r0 === 'home' ? '/' : '/' + r0.replace(/^.*?Git\//, '').replace(/^\//, '')
    await page.goto(new URL(r, base).href, { waitUntil: 'networkidle' })
    // rola até o fim e volta, em passos: todo ScrollTrigger dispara e toda imagem lazy carrega
    await page.evaluate(async () => {
      const step = innerHeight * 0.8
      for (let y = 0; y < document.documentElement.scrollHeight; y += step) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)) }
      await new Promise((r) => setTimeout(r, 1500))
    })
    await page.addScriptTag({ content: scanSrc })
    const res = await page.evaluate(() => {
      const achados = corta('body', { verbose: false }).map((a) => `[${a.regra}] ${a.el} — ${a.detalhe}`)
      const over = document.documentElement.scrollWidth - document.documentElement.clientWidth
      return { achados, over }
    })
    const tag = res.achados.length || res.over > 0 ? 'ACHOU' : 'OK   '
    console.log(`${tag} ${String(w).padStart(4)}px ${r}  estouro=${res.over}px  achados=${res.achados.length}`)
    for (const a of res.achados.slice(0, 8)) console.log(`        ${a}`)
    total += res.achados.length + (res.over > 0 ? 1 : 0)
  }
  await page.close()
}
await browser.close()
console.log(total ? `\n${total} candidato(s) — confirme cada um na tela antes de consertar.` : '\nnada cortado, nada empilhado, nenhum estouro.')
process.exit(total ? 1 : 0)
