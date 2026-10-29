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
if (!base) { console.error('usage: corta-url.mjs <base-url> [route...] [--widths 390,1440]'); process.exit(2) }

function findPlaywright() {
  const cache = join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'npm-cache', '_npx')
  for (const d of existsSync(cache) ? readdirSync(cache) : []) {
    const p = join(cache, d, 'node_modules', 'playwright', 'index.js')
    if (existsSync(p)) return p
  }
  throw new Error('Playwright is not in the npx cache. Run once: npx playwright --version')
}
const pw = await import(pathToFileURL(findPlaywright()).href)
const { chromium } = pw.default ?? pw
const scanSrc = readFileSync(join(here, 'corta-scan.js'), 'utf8').replace(/if \(typeof module[\s\S]*$/, '')
const ritmoSrc = readFileSync(join(here, 'ritmo-scan.js'), 'utf8').replace(/if \(typeof module[\s\S]*$/, '')

const browser = await chromium.launch()
let total = 0
for (const w of widths) {
  const page = await browser.newPage({ viewport: { width: w, height: w < 768 ? 844 : 900 }, reducedMotion: 'no-preference' })
  for (const r0 of routes.length ? routes : ['home']) {
    const r = r0 === 'home' ? '/' : '/' + r0.replace(/^.*?Git\//, '').replace(/^\//, '')
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
      return { achados, over, ritmoAchados }
    })
    const tag = res.achados.length || res.over > 0 ? 'FOUND' : 'OK   '
    console.log(`${tag} ${String(w).padStart(4)}px ${r}  overflow=${res.over}px  findings=${res.achados.length}`)
    for (const a of res.achados.slice(0, 8)) console.log(`        ${a}`)
    if (res.ritmoAchados.length) console.log(`        spacing: ${res.ritmoAchados.length} candidate(s)`)
    for (const a of res.ritmoAchados.slice(0, 8)) console.log(`        ${a}`)
    total += res.achados.length + (res.over > 0 ? 1 : 0)
  }
  await page.close()
}
await browser.close()
console.log(total ? `\n${total} candidate(s): confirm each one on screen before fixing.` : '\nnothing clipped, nothing stacked, no overflow.')
process.exit(total ? 1 : 0)
