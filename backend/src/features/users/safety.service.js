import { prisma } from '../../lib/prisma.js'

// User-to-user blocking and reporting.
//
// Distinct from `User.isBlocked`, which is an admin suspending an account
// platform-wide (auth.middleware.js, 403 ACCOUNT_BLOCKED). This module is one
// user protecting themselves from another, and it never touches anything
// outside the pair it names.

const PUBLIC_USER = { id: true, name: true, avatarUrl: true }

// ─── The gate ────────────────────────────────────────────────────────────────

// True if EITHER has blocked the other.
//
// Reading it in both directions is the whole point: a block that only stopped
// the blocker from sending would protect nobody. It also means neither side can
// tell from behaviour alone who did the blocking, which is deliberate — see
// blockedError below.
export async function blockExistsBetween(a, b) {
  const row = await prisma.userBlock.findFirst({
    where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] },
    select: { id: true },
  })
  return !!row
}

// One message for both directions, naming neither party's action.
//
// "You blocked them" and "they blocked you" are different facts, and telling
// someone which one applies hands an abuser a signal to react to. The person who
// did the blocking already knows; the person who didn't has no business being
// told. 403 rather than a silent success — a message that appears to send and
// never arrives is a lie to the sender.
export function blockedError() {
  return Object.assign(new Error('You can no longer message this person'), {
    statusCode: 403,
    code: 'BLOCKED',
  })
}

// The set of user ids this user has blocked or been blocked by. One query,
// used to filter a whole conversation list without a lookup per row.
export async function blockedUserIds(userId) {
  const rows = await prisma.userBlock.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  })
  const out = new Set()
  for (const r of rows) out.add(r.blockerId === userId ? r.blockedId : r.blockerId)
  return out
}

// ─── Blocking ────────────────────────────────────────────────────────────────

export async function blockUser(blockerId, blockedId) {
  if (blockerId === blockedId) {
    throw Object.assign(new Error('You cannot block yourself'), { statusCode: 400 })
  }
  const target = await prisma.user.findUnique({ where: { id: blockedId }, select: { id: true } })
  if (!target) throw Object.assign(new Error('User not found'), { statusCode: 404 })

  // Upsert, not create: blocking someone already blocked is the same fact, and
  // a 409 there would be a confusing answer to "make sure this person can't
  // reach me" — which is already true.
  await prisma.userBlock.upsert({
    where: { blockerId_blockedId: { blockerId, blockedId } },
    create: { blockerId, blockedId },
    update: {},
  })
  return { blocked: true }
}

export async function unblockUser(blockerId, blockedId) {
  // deleteMany, not delete: unblocking someone who isn't blocked should succeed
  // quietly rather than P2025 into a 404. The end state is what was asked for.
  await prisma.userBlock.deleteMany({ where: { blockerId, blockedId } })
  return { blocked: false }
}

// Only the blocks this user MADE — the ones they can undo. Blocks against them
// are deliberately not listed: that would tell someone they've been blocked,
// which is the signal blockedError() exists to withhold.
export async function listBlockedUsers(blockerId) {
  const rows = await prisma.userBlock.findMany({
    where: { blockerId },
    select: { id: true, createdAt: true, blocked: { select: PUBLIC_USER } },
    orderBy: { createdAt: 'desc' },
  })
  return rows.map((r) => ({ id: r.id, createdAt: r.createdAt, user: r.blocked }))
}

// ─── Reporting ───────────────────────────────────────────────────────────────

export async function reportUser(reporterId, reportedId, { category, description, conversationId }) {
  if (reporterId === reportedId) {
    throw Object.assign(new Error('You cannot report yourself'), { statusCode: 400 })
  }
  const target = await prisma.user.findUnique({ where: { id: reportedId }, select: { id: true } })
  if (!target) throw Object.assign(new Error('User not found'), { statusCode: 404 })

  // A cited thread must be one the reporter is actually in, or the report could
  // attach any conversation on the platform to a stranger's name — and an admin
  // reading it would have no way to know it was forged.
  if (conversationId) {
    const convo = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { tenantId: true, ownerId: true },
    })
    if (!convo || (convo.tenantId !== reporterId && convo.ownerId !== reporterId)) {
      throw Object.assign(new Error('Conversation not found'), { statusCode: 404 })
    }
  }

  return prisma.userReport.create({
    data: { reporterId, reportedId, category, description, conversationId: conversationId ?? null },
    select: { id: true, category: true, status: true, createdAt: true },
  })
}
