// Grava cenas de um site em MP4 (1920x1080) pra deck/apresentação.
// Uso: node record.mjs <scenes.mjs> [nome-da-cena ...]   (sem nome = todas)
// Env: BASE (default http://localhost:3100), OUT (pasta de saída), CHROME, FFMPEG.
// Requer o site rodando em BASE (de preferência build de produção: next build && next start -p 3100).
import puppeteer from 'puppeteer-core'
import { PuppeteerScreenRecorder } from 'puppeteer-screen-recorder'
import { mkdirSync, renameSync, rmSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const BASE = process.env.BASE ?? 'http://localhost:3100'
const OUT = process.env.OUT ?? './videos'
const CHROME = process.env.CHROME ?? 'C:/Users/<voce>/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'
const FFMPEG = process.env.FFMPEG ?? 'C:/Program Files/ffmpeg-2025-10-05-git-6231fa7fb7-essentials_build/bin/ffmpeg.exe'
// W/H = viewport em px CSS; DPR = densidade (vídeo sai em W*DPR x H*DPR); MOBILE=1 emula celular (toque);
// KEEP_UI=1 mantém nav/header (cards de portfolio mostram o site como ele é).
const W = +(process.env.W ?? 1920), H = +(process.env.H ?? 1080)
const DPR = +(process.env.DPR ?? 1)
const MOBILE = process.env.MOBILE === '1'
const KEEP_UI = process.env.KEEP_UI === '1'
const MIN_FPS = +(process.env.MIN_FPS ?? 24) // abaixo disso regrava (até 2x)

// Some o que é UI de navegação: o vídeo mostra a marca, não o site
const HIDE_UI = `
  /* nav do site e o ponto do cursor (components/motion/Cursor.tsx). Não usar [data-cursor]: marca o canvas 3D */
  header, nav { display: none !important; }
  .fixed.mix-blend-difference.pointer-events-none[class*='z-'] { display: none !important; }
  html, body, * { cursor: none !important; }
  ::-webkit-scrollbar { display: none; }
`

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

// Rolagem suave controlada por rAF dentro da página (easing in-out)
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

// Rola até o fim do elemento/página (fração 0..1 da faixa rolável do seletor)
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
  // CSS injetado a cada documento e reanexado se a hidratação do React limpar o <head>
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
  // Reencoda: corta o carregamento (trim; 0.3s tira o 1º quadro em cache do screencast) e mira < 100MB, limite de vídeo do Figma
  const tmp = file.replace('.mp4', '.raw.mp4')
  renameSync(file, tmp)
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-ss', String(scene.trim ?? 0.3), '-i', tmp, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(scene.crf ?? 20), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file])
  rmSync(tmp)
  const ufps = uniqueFps(file)
  console.log(ufps >= (scene.minFps ?? MIN_FPS) ? 'ok' : 'LOW-FPS', file, `${ufps.toFixed(1)} quadros únicos/s`)
  return ufps
}

// Quadros únicos por segundo (limiar fino: fumaça escura muda pouco por quadro).
// Screencast engasgado (máquina sem memória, GPU disputada) grava 30fps com quadro repetido.
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
  headless: false, // GPU real: WebGL fluido (headless cai no SwiftShader)
  defaultViewport: null,
  args: [`--window-size=${Math.max(W, 500)},${H + 140}`, '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-features=CalculateNativeWinOcclusion'],
})
for (const s of list) {
  for (let k = 0; k < 3; k++) if ((await run(s, browser)) >= (s.minFps ?? MIN_FPS)) break
}
await browser.close()
