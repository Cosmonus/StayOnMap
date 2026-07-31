import { prisma } from '../../lib/prisma.js'

// Both clients expire a local draft at 14 days, on the grounds that resuming
// something that old is stranger than starting over. The server has to agree,
// or a stale row would keep resurrecting itself onto a device that had already
// let it go.
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000

// null for "nothing worth resuming" — no row, or one old enough that both
// clients would have dropped it anyway. Expired rows are deleted as they are
// read, the same way the clients treat their own storage.
export async function getDraft(userId) {
  const row = await prisma.listingDraft.findUnique({ where: { userId } })
  if (!row) return null

  if (Date.now() - row.savedAt.getTime() > MAX_AGE_MS) {
    await deleteDraft(userId)
    return null
  }

  // Handed back in the exact envelope shape the clients write, `at` included,
  // so a pull can be adopted into local storage verbatim. The client compares
  // this `at` against its own to decide whether to take it.
  return { ...row.payload, at: row.savedAt.getTime() }
}

export async function putDraft(userId, envelope) {
  const { at, ...payload } = envelope
  // A missing client stamp becomes now rather than epoch: a push that arrives
  // without a clock should be treated as the newest thing we have heard, not
  // as something from 1970 that instantly loses every comparison.
  const savedAt = new Date(at ?? Date.now())

  const row = await prisma.listingDraft.upsert({
    where: { userId },
    create: { userId, payload, savedAt },
    update: { payload, savedAt },
  })

  return { ...row.payload, at: row.savedAt.getTime() }
}

// deleteMany, not delete: discarding a draft that is already gone is a no-op,
// not a 500. Publishing on a second device, or a retry over a flaky
// connection, both hit exactly that.
export async function deleteDraft(userId) {
  await prisma.listingDraft.deleteMany({ where: { userId } })
}
