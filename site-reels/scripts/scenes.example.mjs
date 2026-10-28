// Cenas gravadas. trim = segundos cortados do início (carregamento da página).
export const SCENES = [
  {
    name: '01-logo-nevoa-light',
    path: '/',
    trim: 0.6,
    async act(page, { wait }) {
      await page.reload({ waitUntil: 'domcontentloaded' })
      await wait(12000)
    },
  },
  {
    name: '02-logo-nevoa-dark',
    path: '/',
    theme: 'dark',
    trim: 0.6,
    async act(page, { wait }) {
      await page.reload({ waitUntil: 'domcontentloaded' })
      await wait(12000)
    },
  },
  {
    name: '03-hero-playlist',
    path: '/',
    async prepare(page, { wait }) {
      await wait(5000)
    },
    async act(page, { wait }) {
      await wait(20000)
    },
  },
  {
    name: '04-jardim-arvore',
    path: '/',
    async prepare(page, { scrollTo, wait }) {
      await scrollTo(page, '#jardim', 800)
      await wait(7000) // cena 3D (ez-tree) carrega perto da viewport e demora
    },
    async act(page, { scrollThrough, wait }) {
      await wait(1500)
      await scrollThrough(page, '#jardim', 14000, 0, 1)
      await wait(2500)
    },
  },
  {
    name: '05-jardim-caminhada',
    path: '/jardim',
    crf: 24, // grão + rastro pesam: mantém < 100MB
    async prepare(page, { wait }) {
      await wait(4000)
    },
    async act(page, { scrollThrough, wait }) {
      await wait(1500)
      await scrollThrough(page, 'main > section', 36000, 0, 1)
      await wait(2000)
    },
  },
  {
    name: '06-wordmark-tinta',
    path: '/',
    async prepare(page, { wait }) {
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight - innerHeight * 2.2))
      await wait(2500)
    },
    async act(page, { scrollTo, wait }) {
      await wait(800)
      await scrollTo(page, 1e7, 7000)
      await wait(4000)
    },
  },
  {
    name: '07-site-percurso',
    path: '/',
    async prepare(page, { wait }) {
      await wait(6000)
    },
    async act(page, { scrollThrough, wait }) {
      await wait(3000)
      await scrollThrough(page, null, 50000, 0, 1)
      await wait(2000)
    },
  },
]
