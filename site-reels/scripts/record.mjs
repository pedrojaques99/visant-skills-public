// Records scenes of a site as MP4 (1920x1080) for a deck/presentation.
// Usage: node record.mjs <scenes.mjs> [scene-name ...]   (no name = all)
// Env: BASE (default http://localhost:3100), OUT (output folder), CHROME, FFMPEG.
// Requires the site running at BASE (preferably a production build: next build && next start -p 3100).
import puppeteer from 'puppeteer-core'
import { findChrome, angleArgs } from './find-chrome.mjs'
import { PuppeteerScreenRecorder } from 'puppeteer-screen-recorder'
import { mkdirSync, renameSync, rmSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const BASE = process.env.BASE ?? 'http://localhost:3100'
const OUT = process.env.OUT ?? './videos'
const CHROME = findChrome() // CHROME env, else installed Chrome/Edge, else Playwright Chromium (find-chrome.mjs)
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg' // on PATH, or full path in FFMPEG
// W/H = viewport in CSS px; DPR = density (video comes out at W*DPR x H*DPR); MOBILE=1 emulates a phone (touch);
// KEEP_UI=1 keeps nav/header (portfolio cards show the site as it is).
const W = +(process.env.W ?? 1920), H = +(process.env.H ?? 1080)
const DPR = +(process.env.DPR ?? 1)
const MOBILE = process.env.MOBILE === '1'
const KEEP_UI = process.env.KEEP_UI === '1'
const MIN_FPS = +(process.env.MIN_FPS ?? 24) // below this it re-records (up to 2x)

// Hide navigation UI: the video shows the brand, not the site
const HIDE_UI = `
  /* site nav and the cursor dot (components/motion/Cursor.tsx). Do not use [data-cursor]: it tags the 3D canvas */
  header, nav { display: none !important; }
  .fixed.mix-blend-difference.pointer-events-none[class*='z-'] { display: none !important; }
  html, body, * { cursor: none !important; }
  ::-webkit-scrollbar { display: none; }
`

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

// Smooth scroll driven by rAF inside the page (easing in-out)
async function scrollTo(page, y, ms) {
  await page.evaluate(
    ({ y, ms }) =>
      new Promise((res) => {
        const from = scrollY
        const max = document.documentElement.scrollHeight - innerHeight
        const to = Math.min(max, typeof y === 'string' ? document.querySelector(y).getBoundingClientRect().top + scrollY : y)
        const t0 = performance.now()
        const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
        const step = (now) => {
          const k = Math.min(1, (now - t0) / ms)
          window.scrollTo(0, from + (to - from) * ease(k))
          k < 1 ? requestAnimationFrame(step) : res()
        }
        requestAnimationFrame(step)
      }),
    { y, ms },
  )
}

// Scrolls to the end of the element/page (fraction 0..1 of the selector's scrollable range)
async function scrollThrough(page, sel, ms, from = 0, to = 1) {
  const [a, b] = await page.evaluate(
    ({ sel, from, to }) => {
      const el = sel ? document.querySelector(sel) : document.documentElement
      const top = sel ? el.getBoundingClientRect().top + scrollY : 0
      const range = el.scrollHeight - innerHeight
      return [top + range * from, top + range * to]
    },
    { sel, from, to },
  )
  await page.evaluate((y) => window.scrollTo(0, y), a)
  await wait(300)
  await scrollTo(page, b, ms)
}

const ctx = { wait, scrollTo, scrollThrough }

async function run(scene, browser) {
  const page = await browser.newPage()
  await page.setViewport({ width: W, height: H, deviceScaleFactor: DPR, isMobile: MOBILE, hasTouch: MOBILE })
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scene.theme ?? 'light' }])
  await page.evaluateOnNewDocument((t) => localStorage.setItem('theme', t), scene.theme ?? 'light')
  // CSS injected into every document and re-attached if React hydration clears the <head>
  await page.evaluateOnNewDocument((css) => {
    const fix = () => {
      if (document.getElementById('reels-hide') || !document.body) return
      const st = document.createElement('style')
      st.id = 'reels-hide'
      st.textContent = css
      document.body.appendChild(st)
    }
    setInterval(fix, 100)
  }, (KEEP_UI ? 'html, body, * { cursor: none !important; } ::-webkit-scrollbar { display: none; }' : HIDE_UI) + (scene.css ?? ''))
  await page.goto(/^https?:/.test(scene.path) ? scene.path : BASE + scene.path, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.mouse.move(-10, -10)
  if (scene.prepare) await scene.prepare(page, ctx)

  const rec = new PuppeteerScreenRecorder(page, {
    fps: 30,
    ffmpeg_Path: FFMPEG,
    videoFrame: { width: W * DPR, height: H * DPR },
    aspectRatio: `${W}:${H}`,
    videoCodec: 'libx264',
    videoPreset: 'slow',
    videoCrf: 14,
    videoPixelFormat: 'yuv420p',
    autopad: { color: 'black' },
  })
  const file = `${OUT}/${scene.name}.mp4`
  await rec.start(file)
  await scene.act(page, ctx)
  await rec.stop()
  await page.close()
  // Re-encode: cuts the loading (trim; 0.3s drops the screencast's cached 1st frame) and aims < 100MB, Figma's video limit
  const tmp = file.replace('.mp4', '.raw.mp4')
  renameSync(file, tmp)
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-ss', String(scene.trim ?? 0.3), '-i', tmp, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(scene.crf ?? 20), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file])
  rmSync(tmp)
  const ufps = uniqueFps(file)
  console.log(ufps >= (scene.minFps ?? MIN_FPS) ? 'ok' : 'LOW-FPS', file, `${ufps.toFixed(1)} unique frames/s`)
  return ufps
}

// Unique frames per second (fine threshold: dark smoke changes little per frame).
// A choking screencast (machine out of memory, contended GPU) records 30fps with repeated frames.
function uniqueFps(file) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-i', file, '-vf', 'mpdecimate=hi=64:lo=24:frac=0.05', '-an', '-f', 'null', '-'], { encoding: 'utf8' })
  const frames = [...r.stderr.matchAll(/frame=\s*(\d+)/g)].pop()?.[1] ?? 0
  const dur = r.stderr.match(/Duration: (\d+):(\d+):([\d.]+)/)
  const secs = dur ? +dur[1] * 3600 + +dur[2] * 60 + +dur[3] : 1
  return frames / secs
}

mkdirSync(OUT, { recursive: true })
const { SCENES } = await import(pathToFileURL(resolve(process.argv[2])).href)
const pick = process.argv.slice(3)
const list = pick.length ? SCENES.filter((s) => pick.includes(s.name)) : SCENES
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false, // real GPU: smooth WebGL (headless falls back to SwiftShader)
  defaultViewport: null,
  args: [`--window-size=${Math.max(W, 500)},${H + 140}`, '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars', ...angleArgs, '--ignore-gpu-blocklist', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-features=CalculateNativeWinOcclusion'],
})
for (const s of list) {
  for (let k = 0; k < 3; k++) if ((await run(s, browser)) >= (s.minFps ?? MIN_FPS)) break
}
await browser.close()
