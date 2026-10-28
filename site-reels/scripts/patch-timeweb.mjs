// timeweb (relógio virtual do timesnap) troca video.play() por uma versão que não devolve
// Promise nem dispara 'playing': `video.play().catch()` estoura e quem espera 'playing' nunca liga.
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const file = createRequire(import.meta.url).resolve('timeweb/dist/timeweb.js')
const src = readFileSync(file, 'utf8')
const from = `node.dispatchEvent(new CustomEvent('play', { detail: timewebEventDetail }));\n    };\n    node.pause`
const to = `node.dispatchEvent(new CustomEvent('play', { detail: timewebEventDetail }));\n      node.dispatchEvent(new CustomEvent('playing', { detail: timewebEventDetail }));\n      return Promise.resolve(); /* patch-timeweb */\n    };\n    node.pause`
if (src.includes('patch-timeweb')) console.log('timeweb já corrigido')
else if (!src.includes(from)) throw new Error('timeweb mudou: revise scripts/patch-timeweb.mjs')
else { writeFileSync(file, src.replace(from, to)); console.log('timeweb corrigido') }
