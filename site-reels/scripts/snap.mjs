// Gravação determinística quadro a quadro: timeweb (o relógio virtual do timesnap) congela
// rAF, performance.now, setTimeout e vídeo; cada quadro é renderizado e fotografado sem pressa.
// 60fps cravados mesmo com WebGL pesado ou máquina ocupada.
// Uso: node snap.mjs <scenes.mjs> [cena ...]   Env: OUT, FPS (60), CHROME, FFMPEG, BASE.
// Cena: { name, path, theme?, css?, dur (s), wait? (ms reais pra carregar), pre? (ms virtuais de
//         assentamento antes da rolagem, 2000), start? (s virtuais pulados antes de gravar),
//         scroll?: { sel|null, from, to, at, len } (rolagem em função do tempo virtual de gravação),
//         scroll.bottom?: [de, até] em alturas de tela acima do fim da página,
//         frame?(page, t) (a cada quadro), preserve? (preserveDrawingBuffer, true), crf? }
// Requer scripts/patch-timeweb.mjs aplicado (postinstall).
import puppeteer from 'puppeteer-core'
import { findChrome, angleArgs } from './find-chrome.mjs'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const BASE = process.env.BASE ?? 'http://localhost:3100'
const OUT = process.env.OUT ?? './videos'
const FPS = +(process.env.FPS ?? 60)
const CHROME = findChrome() // CHROME env, else installed Chrome/Edge, else Playwright Chromium (find-chrome.mjs)
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg' // on PATH, or full path in FFMPEG
const W = 1920, H = 1080
const TIMEWEB = readFileSync(createRequire(import.meta.url).resolve('timeweb/dist/timeweb.js'), 'utf8')
if (!TIMEWEB.includes('patch-timeweb')) throw new Error('rode: node scripts/patch-timeweb.mjs')

const HIDE_UI = `
  header, nav { display: none !important; }
  .fixed.mix-blend-difference.pointer-events-none[class*='z-'] { display: none !important; }
  html, body, * { cursor: none !important; }
  ::-webkit-scrollbar { display: none; }
`
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)

async function snap(scene, browser) {
  const page = await browser.newPage()
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 })
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scene.theme ?? 'light' }])
  await page.evaluateOnNewDocument(TIMEWEB)
  await page.evaluateOnNewDocument(
    (t, css, pdb) => {
      localStorage.setItem('theme', t)
      setInterval(() => {
        if (document.getElementById('reels-hide') || !document.body) return
        const st = document.createElement('style')
        st.id = 'reels-hide'
        st.textContent = css
        document.body.appendChild(st)
      }, 100)
      // WebGL sem preserveDrawingBuffer: a foto às vezes pega o canvas já limpo
      const getContext = HTMLCanvasElement.prototype.getContext
      if (pdb)
        HTMLCanvasElement.prototype.getContext = function (type, attrs) {
          if (/webgl/.test(type)) attrs = { ...(attrs || {}), preserveDrawingBuffer: true }
          return getContext.call(this, type, attrs)
        }
    },
    scene.theme ?? 'light',
    HIDE_UI + (scene.css ?? ''),
    scene.preserve ?? true,
  )
  await page.goto(/^https?:/.test(scene.path) ? scene.path : BASE + scene.path, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.mouse.move(-10, -10)

  let now = 0 // relógio virtual (ms)
  const goTo = (x) => page.evaluate((x) => window.timeweb.goTo(x), x)
  // rolagem como função do tempo de gravação (s), com easing
  const scrollAt = async (t) => {
    if (!scene.scroll) return
    const { sel, from, to, at = 0, len = 1, bottom } = scene.scroll
    const k = ease(Math.min(1, Math.max(0, (t - at) / len)))
    await page.evaluate(
      ({ sel, f, bottom }) => {
        // bottom: [de, até] em alturas de tela acima do fim da página
        if (bottom) return window.scrollTo(0, document.documentElement.scrollHeight - innerHeight * (1 + f))
        const el = sel ? document.querySelector(sel) : document.documentElement
        const top = sel ? el.getBoundingClientRect().top + scrollY : 0
        window.scrollTo(0, top + (el.scrollHeight - innerHeight) * f)
      },
      { sel, bottom: !!bottom, f: bottom ? bottom[0] + (bottom[1] - bottom[0]) * k : from + (to - from) * k },
    )
  }

  await wait(1500)
  for (const end = scene.pre ?? 2000; now < end; ) await goTo((now += 1000 / FPS)) // hidratação, intro, timers
  if (scene.prepare) await scene.prepare(page)
  await scrollAt(0)
  await wait(scene.wait ?? 3000) // 3D sob demanda carrega em tempo real
  const skip = (scene.start ?? 0) * 1000
  for (const t0 = now; now < t0 + skip; ) {
    now += 1000 / FPS
    await scrollAt((now - t0 - skip) / 1000)
    await goTo(now)
  }

  const frames = join(tmpdir(), `snap-frames-${scene.name}`) // fora do Drive: milhares de jpg não sincronizam
  rmSync(frames, { recursive: true, force: true })
  mkdirSync(frames, { recursive: true })
  const n = Math.round(scene.dur * FPS)
  const rec0 = now
  for (let i = 0; i < n; i++) {
    now = rec0 + (i * 1000) / FPS
    await scrollAt((now - rec0) / 1000)
    if (scene.frame) await scene.frame(page, (now - rec0) / 1000) // ex.: mouse em função do tempo
    await goTo(now)
    await page.screenshot({ path: join(frames, `f${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 95 })
  }
  await page.close()

  const file = `${OUT}/${scene.name}.mp4`
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(frames, 'f%05d.jpg'), '-c:v', 'libx264', '-preset', 'slow', '-crf', String(scene.crf ?? 20), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file])
  rmSync(frames, { recursive: true, force: true })
  const r = spawnSync(FFMPEG, ['-hide_banner', '-i', file, '-vf', 'mpdecimate=hi=64:lo=24:frac=0.05', '-an', '-f', 'null', '-'], { encoding: 'utf8' })
  const uniq = +([...r.stderr.matchAll(/frame=\s*(\d+)/g)].pop()?.[1] ?? 0)
  const flash = flashes(file)
  console.log(flash.length ? 'FLASH' : 'ok', file, `${(uniq / scene.dur).toFixed(1)} quadros únicos/s de ${FPS}`, flash.length ? `quadros piscando: ${flash.slice(0, 10).join(' ')}` : '')
}

// Quadro piscando = luminância média que foge dos dois vizinhos na mesma direção
function flashes(file, tol = 6) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-i', file, '-vf', 'scale=64:-1,signalstats,metadata=print:key=lavfi.signalstats.YAVG', '-an', '-f', 'null', '-'], { encoding: 'utf8' })
  const y = [...r.stderr.matchAll(/YAVG=([\d.]+)/g)].map((m) => +m[1])
  const out = []
  for (let i = 1; i < y.length - 1; i++) {
    const a = y[i] - y[i - 1], b = y[i] - y[i + 1]
    if (Math.sign(a) === Math.sign(b) && Math.min(Math.abs(a), Math.abs(b)) > tol) out.push(i)
  }
  return out
}

mkdirSync(OUT, { recursive: true })
const { SCENES } = await import(pathToFileURL(resolve(process.argv[2])).href)
const pick = process.argv.slice(3)
const list = pick.length ? SCENES.filter((s) => pick.includes(s.name)) : SCENES
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false, // GPU real (headless cai no SwiftShader)
  defaultViewport: null,
  args: [`--window-size=${W},${H + 140}`, '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars', ...angleArgs, '--ignore-gpu-blocklist', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-features=CalculateNativeWinOcclusion'],
})
for (const s of list) await snap(s, browser)
await browser.close()
