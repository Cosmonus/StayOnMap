#!/usr/bin/env node
// Regenerate resized WebP variants for property images uploaded BEFORE the
// upload pipeline started producing them (see uploads.service.js).
//
//   node scripts/backfill-image-variants.mjs                 # dry run
//   node scripts/backfill-image-variants.mjs --confirm       # write
//   node scripts/backfill-image-variants.mjs --confirm --limit 50
//
// New uploads store a 480px "_thumb.webp" + a 1600px "_full.webp" and save the
// "_full" URL on PropertyImage.url; imgUrl() on the clients swaps to the thumb
// for cards. Rows created before that shipped still point at a single full-res
// original (~2-4MB), so a card list of them downloads megabytes each. This
// script downloads each such original, re-encodes the two variants beside it in
// Supabase Storage, and repoints PropertyImage.url at the "_full" one.
//
// Safe to re-run: rows already migrated (url contains "_full.webp") are skipped,
// variant uploads use upsert, and rows are written one at a time with updateMany
// (a no-op if the row was deleted between the read and the write). Non-Supabase
// URLs (seed/demo/external images) are left untouched.
//
// Prod: prefix DATABASE_URL=<public url> (railway internal host won't resolve
// locally — see .claude/ops.md); SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY must
// be present for the storage writes.
import 'dotenv/config'
import sharp from 'sharp'
import { prisma } from '../src/lib/prisma.js'
import { supabase } from '../src/lib/supabase.js'
import { parseSeedArgs, flagValue } from '../src/features/spatial/seedArgs.js'

const BUCKET = 'StayOnMap'
const { confirm: CONFIRM } = parseSeedArgs(process.argv.slice(2))
const LIMIT = Number(flagValue(process.argv.slice(2), '--limit')) || null

// The public marker that separates the CDN host from the in-bucket object path.
const PUBLIC_MARKER = `/object/public/${BUCKET}/`

// Object path within the bucket, or null if this isn't one of our public URLs
// (external/seed images, blob:/data: URIs — all skipped, not re-hosted).
function storagePath(url) {
  if (!url || typeof url !== 'string') return null
  const i = url.indexOf(PUBLIC_MARKER)
  if (i === -1) return null
  return url.slice(i + PUBLIC_MARKER.length).split('?')[0]
}

async function toWebp(buffer, width, quality) {
  return sharp(buffer)
    .rotate() // bake EXIF orientation before the tag is dropped
    .resize({ width, withoutEnlargement: true })
    .webp({ quality })
    .toBuffer()
}

async function putObject(path, buffer) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: 'image/webp', upsert: true })
  if (error) throw new Error(`upload ${path}: ${error.message}`)
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

async function main() {
  // Anything already carrying the "_full.webp" marker is done.
  const images = await prisma.propertyImage.findMany({
    where: { NOT: { url: { contains: '_full.webp' } } },
    select: { id: true, url: true },
    ...(LIMIT ? { take: LIMIT } : {}),
  })

  const migratable = images.filter((img) => storagePath(img.url))
  const external = images.length - migratable.length

  console.log(`${images.length} un-migrated property images (${migratable.length} on our storage, ${external} external/skipped)`)

  if (!migratable.length) {
    console.log('Nothing to do.')
    return
  }

  if (!CONFIRM) {
    for (const img of migratable.slice(0, 10)) {
      const base = storagePath(img.url).replace(/\.[^./]+$/, '')
      console.log(`  ${img.id}: ${storagePath(img.url)} → ${base}_full.webp (+ _thumb.webp)`)
    }
    if (migratable.length > 10) console.log(`  … and ${migratable.length - 10} more`)
    console.log('\nDry run. Re-run with --confirm to write.')
    return
  }

  let done = 0
  let failed = 0
  for (const img of migratable) {
    const path = storagePath(img.url)
    const base = path.replace(/\.[^./]+$/, '')
    try {
      const res = await fetch(img.url)
      if (!res.ok) throw new Error(`download HTTP ${res.status}`)
      const buffer = Buffer.from(await res.arrayBuffer())

      const [thumb, full] = await Promise.all([
        toWebp(buffer, 480, 65),
        toWebp(buffer, 1600, 80),
      ])
      await putObject(`${base}_thumb.webp`, thumb)
      const fullUrl = await putObject(`${base}_full.webp`, full)

      // updateMany, not update: a no-op if the row was deleted since the read,
      // instead of a P2025 that aborts the run mid-way.
      await prisma.propertyImage.updateMany({ where: { id: img.id }, data: { url: fullUrl } })
      done++
      if (done % 25 === 0) console.log(`  ${done}/${migratable.length}`)
    } catch (err) {
      failed++
      console.warn(`  ✗ ${img.id} (${path}): ${err.message}`)
    }
  }

  console.log(`\n✓ ${done} migrated, ${failed} failed`)
  if (failed) console.log('Failed rows are unchanged and safe to re-run.')
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
