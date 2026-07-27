#!/usr/bin/env node
// Empties the database of CONTENT — accounts and everything people made —
// while leaving the app able to run.
//
// "Fresh" cannot mean "every table empty". Some tables are the ground the
// product stands on, and clearing them does not give you a clean slate, it
// gives you a broken deployment:
//
//   Amenity            the wizard offers these by name; with none, listing
//                      creation silently drops every feature chip
//   PoiIndex           self-hosted OSM points of interest. Re-seeding means
//                      Overpass fetches that 429 on repeat same-day attempts,
//                      and restoring it has already cost one real incident
//   Boundary           ward/zone polygons, same story
//   SpatialContext     materialised neighbourhood facts; rebuilding them from
//                      empty is ~11 billed map-provider calls per cell
//   CellPoiSummary     derived from the above; cheap alone, useless without it
//   PincodeDirectory   ~155k India Post rows, the location ground truth
//   Place / PlaceSource cached place lookups
//   Admin              the operator login. Delete it and nobody can reach the
//                      admin panel to fix whatever happens next
//   DataQualityReport  ETL run history, read-only in the System Monitor. It is
//                      the record of whether a seed SUCCEEDED, which is what
//                      separates "this area is sparse" from "we failed to
//                      fetch it" — worth more after a reset, not less
//
// Everything else goes. Deleting a User cascades to 18 tables, and Property
// cascades to 19 more, so most of the work is one statement; the rest is the
// handful of rows that hang off nothing.
//
//   Dry run (default) — counts every table, deletes nothing:
//     node --env-file=.env scripts/reset-content.mjs
//   Actually wipe:
//     node --env-file=.env scripts/reset-content.mjs --confirm
//   On the production VM:
//     sudo -u deploy bash -c 'cd /srv/stayonmap/backend &&
//       set -a && . /etc/stayonmap/api.env && set +a &&
//       node scripts/reset-content.mjs'
import { prisma } from '../src/lib/prisma.js'

const confirm = process.argv.includes('--confirm')

// Named explicitly so a model added later is NOT quietly preserved: a reset
// that misses a new content table leaves stale rows behind, and the failure is
// invisible. If something new belongs here, adding it should be a decision.
const KEEP = [
  'Amenity', 'PoiIndex', 'Boundary', 'SpatialContext', 'CellPoiSummary',
  'PincodeDirectory', 'Place', 'PlaceSource', 'Admin', 'DataQualityReport',
]

// Order matters only where a row does not cascade from User or Property.
// ActivityLog is SetNull on both its FKs, so it survives the user delete and
// has to be cleared on its own.
const before = {
  users: await prisma.user.count(),
  properties: await prisma.property.count(),
  conversations: await prisma.conversation.count(),
  messages: await prisma.message.count(),
  appointments: await prisma.appointment.count(),
  notifications: await prisma.notification.count(),
  waitlist: await prisma.waitlistEntry.count(),
  activityLog: await prisma.activityLog.count(),
}

const keptBefore = {
  amenities: await prisma.amenity.count(),
  poi: await prisma.poiIndex.count(),
  boundaries: await prisma.boundary.count(),
  spatialCells: await prisma.spatialContext.count(),
  pincodes: await prisma.pincodeDirectory.count(),
  admins: await prisma.admin.count(),
}

console.log('WOULD DELETE')
for (const [k, v] of Object.entries(before)) console.log(`  ${String(v).padStart(8)}  ${k}`)
console.log('\nWOULD KEEP')
for (const [k, v] of Object.entries(keptBefore)) console.log(`  ${String(v).padStart(8)}  ${k}`)
console.log(`\n  (kept tables: ${KEEP.join(', ')})`)

if (keptBefore.admins === 0) {
  console.log('\n⚠ No admin account exists — after this you would have no way into the admin panel.')
}

if (!confirm) {
  console.log('\nDry run only — rerun with --confirm to actually wipe.')
  await prisma.$disconnect()
  process.exit(0)
}

// One transaction: a half-reset (users gone, their notifications left) is
// worse than either end state, and the notification table is exactly where
// that goes wrong — Notification.referenceId has no foreign key.
await prisma.$transaction([
  prisma.activityLog.deleteMany({}),
  prisma.waitlistEntry.deleteMany({}),
  // Cascades to Property (and its 19 dependents), Appointment, Conversation,
  // Message, Lease, Notification, sessions, tokens, points, saves, reviews.
  prisma.user.deleteMany({}),
])

const after = {
  users: await prisma.user.count(),
  properties: await prisma.property.count(),
  conversations: await prisma.conversation.count(),
  notifications: await prisma.notification.count(),
  amenities: await prisma.amenity.count(),
  poi: await prisma.poiIndex.count(),
  pincodes: await prisma.pincodeDirectory.count(),
  admins: await prisma.admin.count(),
}
console.log('\nAFTER')
for (const [k, v] of Object.entries(after)) console.log(`  ${String(v).padStart(8)}  ${k}`)

// Say it out loud rather than trusting the cascade: an orphaned notification
// is silent, and the way you find out is a user tapping one and landing on a
// screen that cannot load.
console.log(after.notifications === 0
  ? '\nNotifications are empty — nothing left pointing at deleted rows.'
  : `\n⚠ ${after.notifications} notification(s) survived. They belonged to no user, which should be impossible — investigate before assuming this reset was clean.`)

await prisma.$disconnect()
