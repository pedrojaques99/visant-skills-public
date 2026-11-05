#!/usr/bin/env node
// Runs corta-scan.js (clipped text, stacked overlay, piece outside its parent) on several routes and widths
// of a published URL, installing nothing: it uses Playwright from the npx cache.
// It also measures horizontal overflow of the DOCUMENT, the number that counts (killer Step 5).
//
//   node corta-url.mjs https://site.vercel.app home about contact   [--widths 390,1440]
//
// Routes go WITHOUT a slash ('home' = root): in Git Bash, '/about' becomes 'C:/Program Files/Git/about'
// through MSYS path conversion (or run with MSYS_NO_PATHCONV=1).
//
// Why headless and not the driven tab: a tab driven by automation stays `hidden` and rAF does not run,
// so a GSAP reveal measures as "clipped" what simply has not finished entering. Here the page scrolls
// to the end before measuring, to fire every ScrollTrigger.
import { readdirSync, existsSync, readFileSync, mkdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { homedir } from 'node:os'
import { OUVINTES_INIT, axeSource, medirTela } from './tela-harness.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const wI = args.indexOf('--widths')
const widths = wI >= 0 ? args[wI + 1].split(',').map(Number) : [390, 1440]
const sI = args.indexOf('--shots')
const shots = sI >= 0 ? args[sI + 1] : null
const pos = args.filter((a, i) => !a.startsWith('--') && (wI < 0 || i !== wI + 1) && (sI < 0 || i !== sI + 1))
const [base, ...routes] = pos
if (!base) { console.error('usage: corta-url.mjs <base-url> [route...] [--widths 390,1440]'); process.exit(2) }

function findPlaywright() {
  const caches = [join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'npm-cache', '_npx'), join(homedir(), '.npm', '_npx')]
  for (const cache of caches) for (const d of existsSync(cache) ? readdirSync(cache) : []) {
    const p = join(cache, d, 'node_modules', 'playwright', 'index.js')
    if (existsSync(p)) return p
  }
  console.error('Playwright is not available. Run once, then try again:\n  npx --yes playwright install chromium\n  npx --yes playwright --version')
  process.exit(3)
}
const pw = await import(pathToFileURL(findPlaywright()).href)
const { chromium } = pw.default ?? pw
const scanSrc = readFileSync(join(here, 'corta-scan.js'), 'utf8').replace(/if \(typeof module[\s\S]*$/, '')
const ritmoSrc = readFileSync(join(here, 'ritmo-scan.js'), 'utf8').replace(/if \(typeof module[\s\S]*$/, '')

const browser = await chromium.launch()
const axe = axeSource()
let total = 0
for (const w of widths) {
  const page = await browser.newPage({ viewport: { width: w, height: w < 768 ? 844 : 900 }, reducedMotion: 'no-preference' })
  await page.addInitScript(OUVINTES_INIT)
  for (const r0 of routes.length ? routes : ['home']) {
    const r = r0 === 'home' ? '/' : '/' + r0.replace(/^.*?Git\//, '').replace(/^\//, '')
    /* A page that crashed has nothing to clip: it used to come back "OK, no overflow". */
    const crashes = []
    const onCrash = (e) => crashes.push(e.message.split('\n')[0].slice(0, 160))
    page.on('pageerror', onCrash)
    await page.goto(new URL(r, base).href, { waitUntil: 'networkidle' })
    // scroll to the end in steps: every ScrollTrigger fires and every lazy image loads
    await page.evaluate(async () => {
      const step = innerHeight * 0.8
      for (let y = 0; y < document.documentElement.scrollHeight; y += step) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)) }
      await new Promise((r) => setTimeout(r, 1500))
    })
    await page.addScriptTag({ content: scanSrc })
    await page.addScriptTag({ content: ritmoSrc })
    const res = await page.evaluate(() => {
      const achados = corta('body', { verbose: false }).map((a) => `[${a.regra}] ${a.el}: ${a.detalhe}`)
      const over = document.documentElement.scrollWidth - document.documentElement.clientWidth
      // spacing is printed for the eye, never counted in the exit code
      const ritmoAchados = ritmo('body', { verbose: false }).map((a) => `[${a.regra}] ${a.el}: ${a.detalhe}`)
      return { achados, over, ritmoAchados, text: document.body.innerText.trim().length, media: document.querySelectorAll('img,svg,canvas,video').length }
    })
    /* what the screen lost (tela-scan) and target size / name (axe): printed for the eye, never in the exit code */
    const leitura = await medirTela(page, { axe }).catch((e) => ({ achados: [], axe: { medido: false, motivo: e.message.split('\n')[0], achados: [] }, vitrine: false }))
    page.off('pageerror', onCrash)
    if (crashes.length) res.achados.unshift(...crashes.slice(0, 3).map((m) => `[js-crash] ${m}`))
    if (!res.text && !res.media) res.achados.unshift('[blank-page] nothing rendered: no text and no media')
    if (shots) {
      mkdirSync(shots, { recursive: true })
      const name = `${r === '/' ? 'home' : r.slice(1).replace(/[^\w-]+/g, '_')}-${w}.png`
      await page.evaluate(() => scrollTo(0, 0))
      await page.screenshot({ path: join(shots, name), fullPage: true })
      console.log(`IMAGE ${resolve(shots, name)}`)
    }
    const tag = res.achados.length || res.over > 0 ? 'FOUND' : 'OK   '
    console.log(`${tag} ${String(w).padStart(4)}px ${r}  overflow=${res.over}px  findings=${res.achados.length}`)
    for (const a of res.achados.slice(0, 8)) console.log(`        ${a}`)
    if (res.ritmoAchados.length) console.log(`        spacing: ${res.ritmoAchados.length} candidate(s)`)
    for (const a of res.ritmoAchados.slice(0, 8)) console.log(`        ${a}`)
    if (leitura.achados.length) console.log(`        screen: ${leitura.achados.length} candidate(s)`)
    if (leitura.idiomaSemLista) console.log(`        screen: no word list for "${leitura.idiomaSemLista}": acao-virou-texto and estado-so-texto NOT MEASURED`);
    if (leitura.vitrine) console.log('        screen: showcase page, row-level rules off')
    for (const a of leitura.achados.slice(0, 8)) console.log(`        [${a.regra}] ${a.el}: ${a.detalhe}`)
    if (!leitura.axe.medido) console.log(`        target size, name: NOT MEASURED (${leitura.axe.motivo})`)
    else if (leitura.axe.achados.length) console.log(`        axe: ${leitura.axe.achados.length} candidate(s)`)
    for (const a of leitura.axe.achados.slice(0, 5)) console.log(`        [axe/${a.regra}] ${a.el}`)
    total += res.achados.length + (res.over > 0 ? 1 : 0)
  }
  await page.close()
}
await browser.close()
console.log(total ? `\n${total} candidate(s): confirm each one on screen before fixing.` : '\nnothing clipped, nothing stacked, no overflow.')
process.exit(total ? 1 : 0)
