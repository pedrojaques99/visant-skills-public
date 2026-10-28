// Finds the Chrome/Chromium executable for puppeteer-core on any machine.
// Order: CHROME env var > installed Chrome/Edge (per OS) > newest Playwright Chromium.
// Nothing found = error explaining how to set CHROME.
import { existsSync, readdirSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import { homedir } from 'node:os'

const env = process.env
const OS = process.platform

function installed() {
  if (OS === 'win32') {
    const bases = [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA].filter(Boolean)
    return [
      ...bases.map((b) => join(b, 'Google/Chrome/Application/chrome.exe')),
      ...bases.map((b) => join(b, 'Microsoft/Edge/Application/msedge.exe')),
    ]
  }
  if (OS === 'darwin') {
    const apps = ['/Applications', join(homedir(), 'Applications')]
    return apps.flatMap((a) => [
      join(a, 'Google Chrome.app/Contents/MacOS/Google Chrome'),
      join(a, 'Chromium.app/Contents/MacOS/Chromium'),
      join(a, 'Microsoft Edge.app/Contents/MacOS/Microsoft Edge'),
    ])
  }
  // Linux and friends: look in PATH
  const names = ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser', 'microsoft-edge']
  const dirs = (env.PATH ?? '').split(delimiter).filter(Boolean)
  return names.flatMap((n) => dirs.map((d) => join(d, n)))
}

// Chromium downloaded by Playwright (npx playwright install chromium): newest chromium-<N> first
function playwright() {
  const root =
    env.PLAYWRIGHT_BROWSERS_PATH ||
    (OS === 'win32'
      ? join(env.LOCALAPPDATA ?? join(homedir(), 'AppData/Local'), 'ms-playwright')
      : OS === 'darwin'
        ? join(homedir(), 'Library/Caches/ms-playwright')
        : join(homedir(), '.cache/ms-playwright'))
  if (!existsSync(root)) return []
  const dirs = readdirSync(root)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => +b.split('-')[1] - +a.split('-')[1])
  const inside =
    OS === 'win32'
      ? ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe']
      : OS === 'darwin'
        ? ['chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']
        : ['chrome-linux64/chrome', 'chrome-linux/chrome']
  return dirs.flatMap((d) => inside.map((p) => join(root, d, p)))
}

export function findChrome() {
  if (env.CHROME) {
    if (existsSync(env.CHROME)) return env.CHROME
    throw new Error(`CHROME points to a file that does not exist: ${env.CHROME}`)
  }
  const hit = [...installed(), ...playwright()].find((p) => existsSync(p))
  if (hit) {
    console.log('chrome:', hit)
    return hit
  }
  throw new Error(
    'Chrome/Chromium not found. Set CHROME to the executable path, e.g.:\n' +
      '  Windows: CHROME="C:/Program Files/Google/Chrome/Application/chrome.exe"\n' +
      '  macOS:   CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"\n' +
      '  Linux:   CHROME="$(command -v google-chrome || command -v chromium)"\n' +
      'or install a Chromium with: npx playwright install chromium',
  )
}

// ANGLE on D3D11 is what made WebGL smooth on Windows; other OSes keep Chrome's default.
export const angleArgs = OS === 'win32' ? ['--use-angle=d3d11'] : []
