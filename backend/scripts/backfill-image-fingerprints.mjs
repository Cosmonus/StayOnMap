#!/usr/bin/env node
// Fingerprint listing photos that were uploaded before fingerprinting existed.
//
// New uploads are hashed in-process from the buffer already in memory
// (uploads.service.js). These have to be fetched back off Supabase, which is why
// this is a script and not a startup task: it is network-bound and one-off.
//
// DRY RUN BY DEFAULT. Pass --confirm to write.
//
//   node --env-file=.env scripts/backfill-image-fingerprints.mjs
//   node --env-file=.env scripts/backfill-image-fingerprints.mjs --confirm
//
// Re-runnable: it only looks at URLs with no fingerprint row, so a second run
// picks up exactly what the first one failed to fetch.
import 'dotenv/config'
import { prisma } from '../src/lib/prisma.js'
import { dHash } from '../src/features/intelligence/imageFingerprint.js'

const confirm = process.argv.includes('--confirm')

// Sequential on purpose. This runs against Supabase's public CDN over somebody's
// laptop connection, the row count is small, and hammering it in parallel to
// save thirty seconds on a one-off backfill is a bad trade.
async function main() {
  const images = await prisma.propertyImage.findMany({
    select: { url: true, property: { select: { ownerId: true } } },
  })

  const existing = await prisma.imageFingerprint.findMany({ select: { url: true } })
  const done = new Set(existing.map((f) => f.url))
  const todo = images.filter((i) => !done.has(i.url))

  console.log(`${images.length} listing image(s), ${todo.length} without a fingerprint.`)
  if (!todo.length) return

  let hashed = 0
  let failed = 0

  for (const image of todo) {
    try {
      const response = await fetch(image.url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const buffer = Buffer.from(await response.arrayBuffer())
      const hash = await dHash(buffer)

      console.log(`  ✓ ${hash}  ${image.url}`)
      hashed++

      if (confirm) {
        await prisma.imageFingerprint.upsert({
          where: { url: image.url },
          create: { url: image.url, hash, uploaderId: image.property.ownerId },
          update: { hash },
        })
      }
    } catch (err) {
      // A dead URL is expected — images get deleted from storage while the row
      // survives. Report it and carry on; one unreachable photo must not stop
      // the backfill.
      console.log(`  ✗ ${image.url}  (${err.message})`)
      failed++
    }
  }

  console.log(`\nhashed ${hashed}, failed ${failed}`)
  if (!confirm) console.log('DRY RUN — nothing written. Re-run with --confirm.')
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
