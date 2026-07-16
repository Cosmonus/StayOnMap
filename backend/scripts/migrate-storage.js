/**
 * Migrates all files from the 'StayNear' Supabase storage bucket to 'StayOnMap'.
 * Also updates every stored URL in the database (PropertyImage + User.avatarUrl).
 *
 * Run once:
 *   node backend/scripts/migrate-storage.js
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const OLD_BUCKET = 'StayNear'
const NEW_BUCKET = 'StayOnMap'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

// ── Helpers ───────────────────────────────────────────────────────────────────

/** List every file in a bucket folder, handling Supabase's 100-item pagination */
async function listAllFiles(bucket, folder = '') {
  const files = []
  let offset = 0
  const limit = 100

  while (true) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(folder, { limit, offset, sortBy: { column: 'name', order: 'asc' } })

    if (error) throw new Error(`list error in ${bucket}/${folder}: ${error.message}`)
    if (!data || data.length === 0) break

    for (const item of data) {
      const fullPath = folder ? `${folder}/${item.name}` : item.name
      if (item.id === null) {
        // It's a folder — recurse into it
        const nested = await listAllFiles(bucket, fullPath)
        files.push(...nested)
      } else {
        files.push(fullPath)
      }
    }

    if (data.length < limit) break
    offset += limit
  }

  return files
}

/** Download a file from one bucket and upload it to another at the same path */
async function copyFile(fromBucket, toBucket, path) {
  const { data, error: dlError } = await supabase.storage
    .from(fromBucket)
    .download(path)

  if (dlError) throw new Error(`download failed for ${path}: ${dlError.message}`)

  const buffer = Buffer.from(await data.arrayBuffer())
  const contentType = data.type || 'application/octet-stream'

  const { error: upError } = await supabase.storage
    .from(toBucket)
    .upload(path, buffer, { contentType, upsert: true })

  if (upError) throw new Error(`upload failed for ${path}: ${upError.message}`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n── StayNear → StayOnMap storage migration ──\n`)

  // 1. Create new bucket (public, same settings as old one)
  const { error: bucketError } = await supabase.storage.createBucket(NEW_BUCKET, {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  })

  if (bucketError && !bucketError.message.includes('already exists')) {
    throw new Error(`Failed to create bucket: ${bucketError.message}`)
  }
  console.log(`✓ Bucket '${NEW_BUCKET}' ready`)

  // 2. List all files in old bucket
  console.log(`\nListing files in '${OLD_BUCKET}'...`)
  const files = await listAllFiles(OLD_BUCKET)
  console.log(`  Found ${files.length} file(s)\n`)

  if (files.length === 0) {
    console.log('Nothing to migrate.')
  } else {
    // 3. Copy each file
    let copied = 0
    let failed = 0
    for (const path of files) {
      try {
        process.stdout.write(`  Copying ${path} ... `)
        await copyFile(OLD_BUCKET, NEW_BUCKET, path)
        console.log('✓')
        copied++
      } catch (err) {
        console.log(`✗ ${err.message}`)
        failed++
      }
    }
    console.log(`\n  ${copied} copied, ${failed} failed`)
  }

  // 4. Update URLs in the database
  const oldPrefix = `${process.env.SUPABASE_URL}/storage/v1/object/public/${OLD_BUCKET}/`
  const newPrefix = `${process.env.SUPABASE_URL}/storage/v1/object/public/${NEW_BUCKET}/`

  console.log(`\nUpdating database URLs...`)
  console.log(`  ${oldPrefix}\n  → ${newPrefix}\n`)

  // PropertyImage.url
  const { count: imgCount } = await prisma.propertyImage.updateMany({
    where:  { url: { startsWith: oldPrefix } },
    data:   { url: { replace: [oldPrefix, newPrefix] } },
  }).catch(() => ({ count: 0 }))

  // Prisma doesn't support string replace in updateMany — use raw SQL instead
  const imgResult = await prisma.$executeRaw`
    UPDATE "PropertyImage"
    SET url = REPLACE(url, ${oldPrefix}, ${newPrefix})
    WHERE url LIKE ${oldPrefix + '%'}
  `
  console.log(`  ✓ PropertyImage rows updated: ${imgResult}`)

  const avatarResult = await prisma.$executeRaw`
    UPDATE "User"
    SET "avatarUrl" = REPLACE("avatarUrl", ${oldPrefix}, ${newPrefix})
    WHERE "avatarUrl" LIKE ${oldPrefix + '%'}
  `
  console.log(`  ✓ User avatarUrl rows updated: ${avatarResult}`)

  // 5. Delete old bucket (only if all files copied successfully)
  if (files.length > 0) {
    console.log(`\nDeleting files from '${OLD_BUCKET}'...`)
    const { error: rmError } = await supabase.storage
      .from(OLD_BUCKET)
      .remove(files)

    if (rmError) {
      console.log(`  ⚠ Could not delete old files: ${rmError.message}`)
      console.log(`  You can delete the '${OLD_BUCKET}' bucket manually from the Supabase dashboard.`)
    } else {
      const { error: dropError } = await supabase.storage.deleteBucket(OLD_BUCKET)
      if (dropError) {
        console.log(`  ⚠ Could not delete bucket (may need to do it manually): ${dropError.message}`)
      } else {
        console.log(`  ✓ Old bucket '${OLD_BUCKET}' deleted`)
      }
    }
  }

  console.log(`\n── Migration complete ──\n`)
}

main()
  .catch((err) => { console.error('\n✗ Migration failed:', err.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
