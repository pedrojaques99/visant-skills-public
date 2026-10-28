// Deterministic frame-by-frame recording: timeweb (timesnap's virtual clock) freezes
// rAF, performance.now, setTimeout and video; each frame is rendered and captured without hurry.
// A locked 60fps even with heavy WebGL or a busy machine.
// Usage: node snap.mjs <scenes.mjs> [scene ...]   Env: OUT, FPS (60), CHROME, FFMPEG, BASE.
// Scene: { name, path, theme?, css?, dur (s), wait? (real ms to load), pre? (virtual ms of
//          settling before the scroll, 2000), start? (virtual s skipped before recording),
//          scroll?: { sel|null, from, to, at, len } (scroll as a function of virtual recording time),
//          scroll.bottom?: [from, to] in screen heights above the end of the page,
//          frame?(page, t) (every frame), preserve? (preserveDrawingBuffer, true), crf? }
// Requires scripts/patch-timeweb.mjs applied (postinstall).
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
if (!TIMEWEB.includes('patch-timeweb')) throw new Error('run: node scripts/patch-timeweb.mjs')

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
      // WebGL without preserveDrawingBuffer: the capture sometimes gets an already cleared canvas
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

  let now = 0 // virtual clock (ms)
  const goTo = (x) => page.evaluate((x) => window.timeweb.goTo(x), x)
  // scroll as a function of recording time (s), with easing
  const scrollAt = async (t) => {
    if (!scene.scroll) return
    const { sel, from, to, at = 0, len = 1, bottom } = scene.scroll
    const k = ease(Math.min(1, Math.max(0, (t - at) / len)))
    await page.evaluate(
      ({ sel, f, bottom }) => {
        // bottom: [from, to] in screen heights above the end of the page
        if (bottom) return window.scrollTo(0, document.documentElement.scrollHeight - innerHeight * (1 + f))
        const el = sel ? document.querySelector(sel) : document.documentElement
        const top = sel ? el.getBoundingClientRect().top + scrollY : 0
        window.scrollTo(0, top + (el.scrollHeight - innerHeight) * f)
      },
      { sel, bottom: !!bottom, f: bottom ? bottom[0] + (bottom[1] - bottom[0]) * k : from + (to - from) * k },
    )
  }

  await wait(1500)
  for (const end = scene.pre ?? 2000; now < end; ) await goTo((now += 1000 / FPS)) // hydration, intro, timers
  if (scene.prepare) await scene.prepare(page)
  await scrollAt(0)
  await wait(scene.wait ?? 3000) // on-demand 3D loads in real time
  const skip = (scene.start ?? 0) * 1000
  for (const t0 = now; now < t0 + skip; ) {
    now += 1000 / FPS
    await scrollAt((now - t0 - skip) / 1000)
    await goTo(now)
  }

  const frames = join(tmpdir(), `snap-frames-${scene.name}`) // outside Drive: thousands of jpgs do not sync
  rmSync(frames, { recursive: true, force: true })
  mkdirSync(frames, { recursive: true })
  const n = Math.round(scene.dur * FPS)
  const rec0 = now
  for (let i = 0; i < n; i++) {
    now = rec0 + (i * 1000) / FPS
    await scrollAt((now - rec0) / 1000)
    if (scene.frame) await scene.frame(page, (now - rec0) / 1000) // e.g. mouse as a function of time
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
  console.log(flash.length ? 'FLASH' : 'ok', file, `${(uniq / scene.dur).toFixed(1)} unique frames/s of ${FPS}`, flash.length ? `flashing frames: ${flash.slice(0, 10).join(' ')}` : '')
}

// Flashing frame = mean luminance that departs from both neighbors in the same direction
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
  headless: false, // real GPU (headless falls back to SwiftShader)
  defaultViewport: null,
  args: [`--window-size=${W},${H + 140}`, '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars', ...angleArgs, '--ignore-gpu-blocklist', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-features=CalculateNativeWinOcclusion'],
})
for (const s of list) await snap(s, browser)
await browser.close()
