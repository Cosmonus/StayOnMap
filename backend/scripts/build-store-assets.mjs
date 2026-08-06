#!/usr/bin/env node
// Generates the two fixed-size images the Play Console and App Store Connect
// require, from the brand assets already in the repo.
//
//   node backend/scripts/build-store-assets.mjs
//
// Output → mobile/store-assets/ (committed, so a submission never waits on
// someone finding the right file, and so a regenerated asset shows as a diff
// rather than a mystery).
//
// Derived, never hand-drawn. Both outputs come from mobile/assets/icon.png —
// the same 1024x1024 launcher icon the app actually ships — so they cannot
// drift from what a user sees on their home screen. The background is sampled
// as #0d8a5f, which is brand-600 exactly (see .claude/ui-ux.md's palette);
// it is asserted at runtime below rather than trusted.
//
// The wordmark IS renderable, and this is worth being precise about because
// the first draft of this script skipped it for the wrong reason. What has no
// vector source and no recoverable font is the single **S glyph** (todo.md).
// The wordmark is not a logo file at all — per .claude/ui-ux.md it is plain
// text set in the display font, which on mobile is Sora. So it is set here in
// the very font the app ships, from the TTF in mobile/node_modules, not
// approximated.
//
// On a brand-green surface the two tones invert rather than collapse to one:
// `Stay` white, `OnMap` brand-100. Same rule as BrandSplash's `onDark` logo —
// solid white would flatten the wordmark into a single word and lose the
// identity.
import sharp from 'sharp'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SRC = join(REPO, 'mobile/assets/icon.png')
const OUT = join(REPO, 'mobile/store-assets')

const BRAND_600 = { r: 0x0d, g: 0x8a, b: 0x5f }
const BRAND_100 = '#d0f3e8'
const SORA_BOLD = join(REPO, 'mobile/node_modules/@expo-google-fonts/sora/700Bold/Sora_700Bold.ttf')
const INTER_MED = join(REPO, 'mobile/node_modules/@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf')

// Verbatim from docs/play-store-listing.md's recommended short description —
// not reworded here, so the graphic and the listing cannot say different
// things.
const TAGLINE = 'Broker-free rentals on a map. Talk to owners directly.'

async function text(markup, { fontfile, font, dpi }) {
  return sharp({ text: { text: markup, font, fontfile, rgba: true, dpi } }).png().toBuffer()
}

mkdirSync(OUT, { recursive: true })

// Fail loudly if the source ever stops being what this script assumes, rather
// than silently shipping a stretched or off-brand image.
const meta = await sharp(SRC).metadata()
if (meta.width !== 1024 || meta.height !== 1024) {
  throw new Error(`Expected a 1024x1024 source icon, got ${meta.width}x${meta.height}`)
}
const { data: raw } = await sharp(SRC).raw().toBuffer({ resolveWithObject: true })
const corner = { r: raw[0], g: raw[1], b: raw[2] }
if (corner.r !== BRAND_600.r || corner.g !== BRAND_600.g || corner.b !== BRAND_600.b) {
  throw new Error(
    `Source icon background is not brand-600. Got rgb(${corner.r},${corner.g},${corner.b}), ` +
    'expected rgb(13,138,95). Either the brand changed or the wrong file is being read.',
  )
}

// ── 1. Store icon: 512x512, 32-bit PNG ──────────────────────────────────────
// Play requires exactly 512x512 PNG. Lanczos down from 1024 is a clean 2:1
// reduction of a shape that is all flat fills and one curve, so there is
// nothing here that needs hinting.
// `ensureAlpha` because Play asks for a 32-bit PNG here. The source is opaque,
// so this adds a fully-opaque channel rather than changing a pixel.
await sharp(SRC)
  .resize(512, 512, { fit: 'cover' })
  .ensureAlpha()
  .png({ compressionLevel: 9 })
  .toFile(join(OUT, 'play-icon-512.png'))

// ── 2. Feature graphic: 1024x500, no alpha ──────────────────────────────────
// Play rejects transparency here, so the canvas is an opaque brand-600 field.
//
// The mark sits left of centre rather than dead-centre: Play overlays the app
// title and install button over the lower portion of this image on some
// surfaces, and a centred mark collides with them. Left-weighted keeps the
// glyph clear whatever the layout does.
const MARK = 190           // rendered height of the S
const LEFT = 80            // breathing room from the edge
const GAP = 44             // between the mark and the wordmark

// Trim the flat background off the icon so we composite the glyph alone,
// otherwise a square of the same green lands on the same green and the mark is
// boxed in by its own edges at a different scale.
const glyph = await sharp(SRC)
  .trim({ threshold: 10 })
  .resize({ height: MARK, fit: 'inside' })
  .png()
  .toBuffer()
const glyphMeta = await sharp(glyph).metadata()

const wordmark = await text(
  `<span foreground="#ffffff">Stay</span><span foreground="${BRAND_100}">OnMap</span>`,
  { font: 'Sora Bold', fontfile: SORA_BOLD, dpi: 460 },
)
const wordMeta = await sharp(wordmark).metadata()

const tagline = await text(
  `<span foreground="${BRAND_100}">${TAGLINE}</span>`,
  { font: 'Inter Medium', fontfile: INTER_MED, dpi: 150 },
)
const tagMeta = await sharp(tagline).metadata()

// The mark and the text block are centred against each OTHER, then the pair is
// centred on the canvas — so the composition stays balanced if any of the three
// pieces changes size.
const textBlockH = wordMeta.height + 18 + tagMeta.height
const blockH = Math.max(glyphMeta.height, textBlockH)
const blockTop = Math.round((500 - blockH) / 2)
const textLeft = LEFT + glyphMeta.width + GAP

await sharp({
  create: { width: 1024, height: 500, channels: 3, background: BRAND_600 },
})
  .composite([
    { input: glyph, left: LEFT, top: blockTop + Math.round((blockH - glyphMeta.height) / 2) },
    { input: wordmark, left: textLeft, top: blockTop + Math.round((blockH - textBlockH) / 2) },
    { input: tagline, left: textLeft, top: blockTop + Math.round((blockH - textBlockH) / 2) + wordMeta.height + 18 },
  ])
  // Play REJECTS transparency on the feature graphic, and compositing
  // alpha-bearing layers adds a channel even onto an opaque canvas. Flatten it
  // back onto brand-600 — the requirement is the opposite way round from the
  // icon above, which is exactly the sort of thing that gets a listing bounced.
  .flatten({ background: BRAND_600 })
  .removeAlpha()
  .png({ compressionLevel: 9 })
  .toFile(join(OUT, 'play-feature-graphic-1024x500.png'))

// ── A README next to them, because a bare pair of PNGs invites guessing ─────
writeFileSync(join(OUT, 'README.md'), `# Store assets (generated)

Regenerate with:

    node backend/scripts/build-store-assets.mjs

Do not edit these by hand — the script derives both from
\`mobile/assets/icon.png\`, the launcher icon the app actually ships, so they
cannot drift from what a user sees on their home screen. It asserts the source
is 1024x1024 and that its background is exactly brand-600 (#0d8a5f), and throws
rather than producing an off-brand image.

| File | Size | Where it goes |
|---|---|---|
| \`play-icon-512.png\` | 512x512 PNG | Play Console → Store listing → App icon |
| \`play-feature-graphic-1024x500.png\` | 1024x500 PNG, no alpha | Play Console → Store listing → Feature graphic |

**The wordmark is set, not approximated.** What has no vector source or
recoverable font is the single **S glyph** — the wordmark is plain text in the
display font (\`.claude/ui-ux.md\`), so it is rendered from the same Sora Bold
TTF the app ships, with \`Stay\` white and \`OnMap\` brand-100 per the
on-brand-green rule. The tagline is verbatim from
\`docs/play-store-listing.md\`'s recommended short description, so the graphic
and the listing cannot drift apart.

The right third is left empty on purpose: Play overlays the app title and
install button over part of this image on some surfaces.

**Screenshots are not generated here.** Play needs 2-8 real device screenshots,
which come from a build on a device — no script can invent them.
`)

const sizes = await Promise.all(
  ['play-icon-512.png', 'play-feature-graphic-1024x500.png'].map(async (f) => {
    const m = await sharp(join(OUT, f)).metadata()
    return `  ${f}  ${m.width}x${m.height}  ${m.channels}ch`
  }),
)
console.log('Wrote to mobile/store-assets/:')
console.log(sizes.join('\n'))
