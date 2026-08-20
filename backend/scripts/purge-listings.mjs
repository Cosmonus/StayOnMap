#!/usr/bin/env node
// Remove EVERY listing and everything that hangs off one. Users stay.
//
// Built 2026-08-21 for the move from test data to real inventory: every
// property in production had been created to exercise the product, and the
// operator asked for all of them gone while every account survives.
//
// DRY RUN BY DEFAULT. Pass --confirm to write.
//
//   node --env-file=.env scripts/purge-listings.mjs
//   node --env-file=.env scripts/purge-listings.mjs --confirm
//
// On the VM (see .claude/ops.md — run as deploy, absolute node):
//   sudo -u deploy /usr/bin/node --env-file=/etc/stayonmap/api.env scripts/purge-listings.mjs --confirm
//
// WHAT GOES. Every table with a propertyId foreign key declares
// onDelete: Cascade (images, amenities, rules, availability, appointments,
// leases, tenancies + their reviews, conversations + messages, reviews, votes,
// insights, reports + moderation actions, verifications + documents, trust /
// risk scores, fraud signals, similarity edges, viewers, daily views, saved
// listings, price history, status events). Deleting Property is therefore
// enough for those. What does NOT cascade, and is handled explicitly:
//   - Notification         no FK; rows whose referenceType names a listing
//                          record would otherwise deep-link to nothing
//   - SupportCase          PROPERTY_REPORT cases are the workflow half of a
//                          report; relatedPropertyId only SetNulls
//   - ListingDraft         per-user unfinished listings — test data too
//   - ImageFingerprint     keyed by URL, not by property
//   - OwnerTrustScore      computed from test reviews/appointments; deleted so
//                          the next recalculation starts from UNRATED
//
// WHAT STAYS. User, sessions, social accounts, points, waitlist, admins, all
// spatial/metro/locality data, blog, knowledge base, SearchDemand, and
// AnalyticsEvent (its propertyId is a plain string — the funnel history is an
// aggregate and survives on purpose).
//
// NOT DONE HERE: the image files in Supabase Storage become orphans. Storage is
// free-tier; clean them from the dashboard if it matters.
//
// One transaction: either every table empties or none does.
import 'dotenv/config'
import { prisma } from '../src/lib/prisma.js'

const confirm = process.argv.includes('--confirm')

const LISTING_REFERENCE_TYPES = [
  'Property',
  'PropertyReport',
  'Appointment',
  'Conversation',
  'Lease',
  'Tenancy',
  'OwnershipVerification',
]

async function counts(db) {
  const [
    properties, images, appointments, leases, tenancies, conversations, messages,
    reviews, reports, verifications, savedListings, drafts, fingerprints,
    ownerTrust, reportCases, notifications,
  ] = await Promise.all([
    db.property.count(),
    db.propertyImage.count(),
    db.appointment.count(),
    db.lease.count(),
    db.tenancy.count(),
    db.conversation.count(),
    db.message.count(),
    db.communityReview.count(),
    db.propertyReport.count(),
    db.ownershipVerification.count(),
    db.savedListing.count(),
    db.listingDraft.count(),
    db.imageFingerprint.count(),
    db.ownerTrustScore.count(),
    db.supportCase.count({ where: { type: 'PROPERTY_REPORT' } }),
    db.notification.count({ where: { referenceType: { in: LISTING_REFERENCE_TYPES } } }),
  ])
  return {
    properties, images, appointments, leases, tenancies, conversations, messages,
    reviews, reports, verifications, savedListings, drafts, fingerprints,
    ownerTrust, reportCases, notifications,
  }
}

async function main() {
  const users = await prisma.user.count()
  const before = await counts(prisma)
  console.log(`Users (untouched): ${users}`)
  console.log('Before:', before)

  if (!confirm) {
    console.log('\nDry run — nothing deleted. Pass --confirm to purge.')
    return
  }

  await prisma.$transaction(async (tx) => {
    await tx.notification.deleteMany({ where: { referenceType: { in: LISTING_REFERENCE_TYPES } } })
    await tx.supportCase.deleteMany({ where: { type: 'PROPERTY_REPORT' } })
    await tx.listingDraft.deleteMany()
    // Cascades to every property-keyed table.
    await tx.property.deleteMany()
    await tx.imageFingerprint.deleteMany()
    await tx.ownerTrustScore.deleteMany()

    const after = await counts(tx)
    const leftovers = Object.entries(after).filter(([, n]) => n !== 0)
    if (leftovers.length) {
      throw new Error(`Purge incomplete, rolling back: ${JSON.stringify(Object.fromEntries(leftovers))}`)
    }
    const usersAfter = await tx.user.count()
    if (usersAfter !== users) {
      throw new Error(`User count changed ${users} → ${usersAfter}, rolling back`)
    }
  })

  console.log('After:', await counts(prisma))
  console.log(`Users (untouched): ${await prisma.user.count()}`)
  console.log('\nDone. Every listing and its dependants are gone; accounts are intact.')
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
