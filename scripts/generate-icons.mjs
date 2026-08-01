// Renders the PWA icon set from one inline SVG source using headless Chromium.
// Run with: node scripts/generate-icons.mjs
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

const defs = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7c6ff0"/>
      <stop offset="1" stop-color="#5a48c8"/>
    </linearGradient>
    <linearGradient id="star" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffd76a"/>
      <stop offset="1" stop-color="#f7a93b"/>
    </linearGradient>
  </defs>`

const glyph = `
  <path fill="url(#star)" d="M256 96l46 93 103 15-74 72 17 102-92-48-92 48 17-102-74-72 103-15z"/>
  <path fill="none" stroke="#ffffff" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"
        d="M203 251l38 38 74-78"/>`

// `scale` shrinks the glyph toward the centre so maskable icons survive aggressive
// launcher masks (content must stay inside the middle 80% safe zone).
function svg({ radius, scale }) {
  const transform =
    scale === 1 ? '' : ` transform="translate(256 256) scale(${scale}) translate(-256 -256)"`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}
  <rect width="512" height="512" rx="${radius}" fill="url(#bg)"/>
  <g${transform}>${glyph}</g>
</svg>`
}

const variants = [
  { name: 'icon-192', size: 192, radius: 112, scale: 1 },
  { name: 'icon-512', size: 512, radius: 112, scale: 1 },
  { name: 'maskable-192', size: 192, radius: 0, scale: 0.72 },
  { name: 'maskable-512', size: 512, radius: 0, scale: 0.72 },
  { name: 'apple-touch-icon', size: 180, radius: 0, scale: 0.88 },
]

const work = await mkdtemp(join(tmpdir(), 'kidtasks-icons-'))
await mkdir(outDir, { recursive: true })
// CHROMIUM_PATH lets CI/containers point at a pre-installed browser instead of a download.
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
)

for (const variant of variants) {
  const page = await browser.newPage({
    viewport: { width: variant.size, height: variant.size },
  })
  const html = join(work, `${variant.name}.html`)
  await writeFile(
    html,
    `<!doctype html><meta charset="utf-8">
     <style>html,body{margin:0;padding:0;background:transparent}
     svg{display:block;width:${variant.size}px;height:${variant.size}px}</style>
     ${svg(variant)}`,
  )
  await page.goto(`file://${html}`)
  await page.screenshot({ path: join(outDir, `${variant.name}.png`), omitBackground: true })
  await page.close()
  console.log(`rendered ${variant.name}.png (${variant.size}px)`)
}

await browser.close()
