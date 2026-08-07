// Reused-photo detection.
//
// `FraudSignalType.REUSED_IMAGES` has existed in the schema since the trust
// system was built and nothing has ever produced one — the signal was declared
// and inert. This is what produces it.
//
// WHY dHash AND NOT A CHECKSUM. A re-poster does not upload the same bytes;
// they screenshot, re-save, crop the watermark off, or run it through WhatsApp.
// A sha256 sees a different file. A difference hash sees the same picture: it
// reduces the image to 8x8 brightness comparisons, so re-encoding, resizing and
// mild cropping leave it nearly unchanged while a genuinely different room
// scores far away.
//
// WHY KEYED BY URL. The hash belongs to the image bytes, not to whichever
// listing currently references them. That makes it computable at UPLOAD time
// from a buffer already in memory — nothing is ever re-downloaded — and it means
// an image uploaded, rejected, and re-uploaded under a second account is still
// recognised, which is the exact pattern this is for.
import sharp from 'sharp'
import { prisma } from '../../lib/prisma.js'
import { intelError } from '../../lib/intelLog.js'

// Two images are "the same picture" at or below this Hamming distance over 64
// bits. 10 is the widely used threshold for dHash and it is the conservative end
// of the useful range: tighter misses a re-crop, looser starts matching any two
// photographs of a white wall. This is a REVIEW trigger, not a verdict, so the
// cost of a false positive is a moderator's glance.
export const MATCH_DISTANCE = 10

// A runaway guard on the candidate scan, not an expected limit — see
// findReusedImages for what changes when this stops being comfortable.
const MAX_CANDIDATES = 20_000

/**
 * 64-bit difference hash, as 16 hex characters.
 *
 * Resize to 9x8 greyscale, then compare each pixel to its right-hand neighbour:
 * 8 comparisons per row, 8 rows, one bit each. `fit: 'fill'` on purpose —
 * preserving aspect ratio would make the same photo hash differently depending
 * on how it was cropped, which is the opposite of what this is for.
 */
export async function dHash(buffer) {
  const raw = await sharp(buffer)
    .greyscale()
    .resize(9, 8, { fit: 'fill' })
    .raw()
    .toBuffer()

  let bits = 0n
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const i = y * 9 + x
      bits = (bits << 1n) | (raw[i] > raw[i + 1] ? 1n : 0n)
    }
  }
  return bits.toString(16).padStart(16, '0')
}

/** Bits that differ between two 16-hex-char hashes. */
export function hammingDistance(a, b) {
  if (!a || !b || a.length !== b.length) return Number.MAX_SAFE_INTEGER
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`)
  let count = 0
  while (x) {
    x &= x - 1n
    count++
  }
  return count
}

/**
 * Fingerprint an uploaded image. Called from the upload path with the buffer
 * already in hand.
 *
 * Never throws: a listing must not fail to upload a photo because a fraud
 * heuristic could not hash it. A missing fingerprint costs one detection, not
 * one upload.
 */
export async function fingerprintUpload(url, buffer, uploaderId = null) {
  try {
    const hash = await dHash(buffer)
    await prisma.imageFingerprint.upsert({
      where: { url },
      create: { url, hash, uploaderId },
      update: { hash },
    })
    return hash
  } catch (err) {
    intelError('image.fingerprint_failed', err, { url })
    return null
  }
}

/**
 * Which OTHER properties use a picture this property is also using?
 *
 * Returns one entry per matching property, with the closest distance found and
 * how many images matched — evidence a moderator can act on, in the explainable
 * shape the intelligence layer uses everywhere.
 *
 * THE SCAN. Candidates are every fingerprint attached to a live listing other
 * than this one, compared in JS. Hamming distance is not an indexable predicate
 * in stock Postgres, and at this scale — a few thousand images — the scan costs
 * single-digit milliseconds. It stops being comfortable somewhere north of
 * ~100k images; the fix then is a BK-tree or splitting the hash into four 16-bit
 * columns and requiring an exact match on one (the standard pigeonhole trick),
 * not a new datastore.
 */
export async function findReusedImages(propertyId) {
  const mine = await prisma.propertyImage.findMany({
    where: { propertyId },
    select: { url: true },
  })
  if (!mine.length) return []

  const myHashes = await prisma.imageFingerprint.findMany({
    where: { url: { in: mine.map((i) => i.url) } },
    select: { url: true, hash: true },
  })
  if (!myHashes.length) return []

  // Every image belonging to some OTHER listing, with the owner so a match can
  // say whether this is one person relisting or two accounts sharing a photo —
  // which are different findings.
  const others = await prisma.propertyImage.findMany({
    where: { propertyId: { not: propertyId } },
    select: { url: true, propertyId: true, property: { select: { ownerId: true } } },
    take: MAX_CANDIDATES,
  })
  if (!others.length) return []

  const theirHashes = await prisma.imageFingerprint.findMany({
    where: { url: { in: others.map((i) => i.url) } },
    select: { url: true, hash: true },
  })
  const hashByUrl = new Map(theirHashes.map((h) => [h.url, h.hash]))

  const byProperty = new Map()
  for (const other of others) {
    const otherHash = hashByUrl.get(other.url)
    if (!otherHash) continue

    for (const { hash } of myHashes) {
      const distance = hammingDistance(hash, otherHash)
      if (distance > MATCH_DISTANCE) continue

      const found = byProperty.get(other.propertyId)
      if (found) {
        found.matches++
        found.closest = Math.min(found.closest, distance)
      } else {
        byProperty.set(other.propertyId, {
          propertyId: other.propertyId,
          ownerId: other.property.ownerId,
          matches: 1,
          closest: distance,
        })
      }
      break
    }
  }

  return [...byProperty.values()].sort((a, b) => a.closest - b.closest)
}
