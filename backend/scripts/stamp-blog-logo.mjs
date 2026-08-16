// Stamps the StayOnMap wordmark onto blog hero images and emits them
// ready for frontend/public/blog/.
//
// The logo is ALWAYS the text-only wordmark (.claude/ui-ux.md): "Stay" in ink,
// "OnMap" in brand-600 jade, bold, tracking-tight — never an icon. It is
// stamped here rather than asked of an image generator because generators
// misspell wordmarks and drift the palette; this renders it identically on
// every cover.
//
// Usage:
//   node scripts/stamp-blog-logo.mjs <inputDir> [outputDir]
//
//   inputDir   folder of raw AI-generated covers (jpg/jpeg/png/webp),
//              each named after its post slug, e.g. rental-scams-in-india.png
//   outputDir  default: ../frontend/public/blog (relative to backend/)
//
// Output — THREE files per slug, following the _thumb/_full WebP pattern
// property uploads already use (features/uploads/uploads.service.js):
//   <slug>_thumb.webp   800x450, q70 — the card cover in the /blog grid
//   <slug>_full.webp   1600x900, q80 — the article hero
//   <slug>.jpg         1600x900, q82 — <img> fallback AND the og:image
//                       (features/seo/blogMeta.js) — JPG because WhatsApp's
//                       preview bot is unreliable with webp
// hero.url in the post JSON stays the plain .jpg; BlogCover.jsx derives the
// WebP variant names from it, so the JSON never knows about variants.
//
// Exact type rendering wants Plus Jakarta Sans installed on the machine
// running this (free, fonts.google.com/specimen/Plus+Jakarta+Sans); without
// it the SVG falls back to the system sans — close, not brand-exact.

import sharp from 'sharp'
import { mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'

const WIDTH = 1600
const HEIGHT = 900
const EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp'])

// Bottom-left, on a frosted pill so it survives any backdrop the
// generator produced. Ink #0d0c0a / jade #0d8a5f are the wordmark's two
// tones from the design system — do not restyle here.
const WORDMARK_SVG = Buffer.from(`
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect x="48" y="800" width="226" height="56" rx="28" fill="#ffffff" fill-opacity="0.92"/>
  <text x="74" y="838" font-family="'Plus Jakarta Sans','Segoe UI',sans-serif"
        font-size="30" font-weight="700" letter-spacing="-0.6">
    <tspan fill="#0d0c0a">Stay</tspan><tspan fill="#0d8a5f">OnMap</tspan>
  </text>
</svg>
`)

const [, , inputDir, outputDirArg] = process.argv
if (!inputDir) {
  console.error('Usage: node scripts/stamp-blog-logo.mjs <inputDir> [outputDir]')
  process.exit(1)
}
const outputDir = outputDirArg ?? path.resolve(import.meta.dirname, '../../frontend/public/blog')

const entries = (await readdir(inputDir)).filter((f) => EXTENSIONS.has(path.extname(f).toLowerCase()))
if (entries.length === 0) {
  console.error(`No images (${[...EXTENSIONS].join(' ')}) found in ${inputDir}`)
  process.exit(1)
}

await mkdir(outputDir, { recursive: true })

for (const file of entries) {
  const slug = path.basename(file, path.extname(file))
  // Stamp once at full size, then derive every variant from the stamped
  // buffer so the wordmark scales with the image instead of being re-laid
  // per size.
  const stamped = await sharp(path.join(inputDir, file))
    .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'attention' })
    .composite([{ input: WORDMARK_SVG, top: 0, left: 0 }])
    .toBuffer()

  await Promise.all([
    sharp(stamped).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(outputDir, `${slug}.jpg`)),
    sharp(stamped).webp({ quality: 80 }).toFile(path.join(outputDir, `${slug}_full.webp`)),
    sharp(stamped).resize(800, 450).webp({ quality: 70 }).toFile(path.join(outputDir, `${slug}_thumb.webp`)),
  ])
  console.log(`stamped ${file} -> ${slug}.jpg + _full.webp + _thumb.webp`)
}
console.log(`\n${entries.length} cover(s) done in ${outputDir}. Now set "url": "/blog/<slug>.jpg" in each post's hero.`)
