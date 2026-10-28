// timeweb (timesnap's virtual clock) replaces video.play() with a version that returns no
// Promise and never fires 'playing': `video.play().catch()` throws and whoever waits for 'playing' never starts.
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const file = createRequire(import.meta.url).resolve('timeweb/dist/timeweb.js')
const src = readFileSync(file, 'utf8')
const from = `node.dispatchEvent(new CustomEvent('play', { detail: timewebEventDetail }));\n    };\n    node.pause`
const to = `node.dispatchEvent(new CustomEvent('play', { detail: timewebEventDetail }));\n      node.dispatchEvent(new CustomEvent('playing', { detail: timewebEventDetail }));\n      return Promise.resolve(); /* patch-timeweb */\n    };\n    node.pause`
if (src.includes('patch-timeweb')) console.log('timeweb already patched')
else if (!src.includes(from)) throw new Error('timeweb changed: review scripts/patch-timeweb.mjs')
else { writeFileSync(file, src.replace(from, to)); console.log('timeweb patched') }
