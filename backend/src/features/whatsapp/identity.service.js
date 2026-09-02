// Who is on the other end of this WhatsApp number.
//
// The number IS the identity. Meta has already proven the sender holds it —
// a message cannot arrive from a number the person does not control — which
// is the same fact the SMS code flow proves, so the account this resolves to
// carries `phoneVerifiedAt`. No password, no email, no second verification.
//
// Resolution order, and the security reasoning behind it:
//
//   1. An account where this number is VERIFIED → that account. There can be
//      at most one (phone.service.js enforces it), and it is the only match
//      that is evidence of anything.
//   2. Otherwise, a NEW account. Deliberately NOT "an account that merely
//      typed this number": User.phone is free text, anyone can put your number
//      in their profile, and attaching your listing — and the sign-in links
//      that follow it — to their account would be an account takeover with
//      extra steps. If such an account exists we OFFER the link (masked email,
//      "is this you?"), and only the person holding the phone can accept.
//
// Never creates a duplicate for a verified number; never silently merges an
// unverified one.
import { prisma } from '../../lib/prisma.js'
import { generateUserDisplayId } from '../../utils/idGenerator.js'
import { toLocal } from './phone.js'

const USER_SELECT = {
  id: true, name: true, email: true, phone: true, phoneVerifiedAt: true, role: true,
  isBusiness: true, isBlocked: true, city: true, showExactLocation: true,
  // The profile gate at publish reads it (requireCompleteProfile's rule).
  isVerified: true,
}

/** The account this number is verified on, if any. */
export async function findVerifiedOwner(phoneE164) {
  const local = toLocal(phoneE164)
  if (!local) return null
  return prisma.user.findFirst({ where: { phone: local, phoneVerifiedAt: { not: null } }, select: USER_SELECT })
}

/**
 * An account that TYPED this number without verifying it — a candidate for
 * linking, offered to the person, never assumed. Returns at most one; two
 * such accounts is ambiguity we do not resolve on their behalf.
 */
export async function findUnverifiedCandidate(phoneE164) {
  const local = toLocal(phoneE164)
  if (!local) return null
  const rows = await prisma.user.findMany({
    where: { phone: local, phoneVerifiedAt: null, isBlocked: false },
    select: { id: true, email: true, name: true },
    take: 2,
  })
  return rows.length === 1 ? rows[0] : null
}

/** "as***@gmail.com" — enough to recognise, not enough to learn. */
export function maskEmail(email) {
  if (!email) return null
  const [user, domain] = email.split('@')
  if (!domain) return null
  return `${user.slice(0, 2)}${'*'.repeat(Math.max(2, user.length - 2))}@${domain}`
}

/** Create the account for a first-time WhatsApp owner. */
export async function createWhatsAppOwner(phoneE164, { name, city } = {}) {
  const local = toLocal(phoneE164)
  if (!local) throw Object.assign(new Error('Not an Indian mobile number'), { statusCode: 400 })
  const displayName = (name ?? '').trim().slice(0, 80) || 'Property owner'
  return prisma.user.create({
    data: {
      displayId: generateUserDisplayId(displayName, null),
      name: displayName,
      email: null,
      passwordHash: null,
      phone: local,
      phoneVerifiedAt: new Date(),
      role: 'OWNER',
      city: city ?? null,
      // Receiving the WhatsApp message is possession of the phone — the same
      // proof the SMS flow accepts, so the account starts verified for it. The
      // email flag stays false: no inbox has been proven.
    },
    select: USER_SELECT,
  })
}

/**
 * The person holding the phone said "yes, that account is mine". Link it:
 * the number becomes verified on that account, and it becomes an owner.
 */
export async function linkExistingAccount(userId, phoneE164) {
  const local = toLocal(phoneE164)
  // Re-checked at link time, minutes after the offer — someone else may have
  // verified this number since. Same rule as verifyPhoneOtp().
  const taken = await prisma.user.findFirst({ where: { phone: local, phoneVerifiedAt: { not: null }, id: { not: userId } }, select: { id: true } })
  if (taken) throw Object.assign(new Error('This number is already verified on another account'), { statusCode: 409 })
  return prisma.user.update({
    where: { id: userId },
    data: { phone: local, phoneVerifiedAt: new Date(), role: 'OWNER' },
    select: USER_SELECT,
  })
}

/** Listing implies OWNER — one-way, like PATCH /auth/role. */
export async function ensureOwnerRole(user) {
  if (user.role === 'OWNER') return user
  return prisma.user.update({ where: { id: user.id }, data: { role: 'OWNER' }, select: USER_SELECT })
}

/**
 * The business tier is a free, one-way self-declaration today (see
 * upgradeToBusiness in auth.service.js — payments are on hold). The web wizard
 * shows a gate the owner clicks through; the bot asks the same question.
 */
export async function ensureBusiness(user) {
  if (user.isBusiness) return user
  return prisma.user.update({ where: { id: user.id }, data: { isBusiness: true, businessSince: new Date() }, select: USER_SELECT })
}

/** Fill in the city the moment we learn it from a confirmed pin; never overwrite. */
export async function fillCityIfEmpty(user, city) {
  if (!city || user.city) return user
  return prisma.user.update({ where: { id: user.id }, data: { city }, select: USER_SELECT })
}

/**
 * Save an email volunteered over WhatsApp — only onto an account that has
 * NONE. An existing address was proven (or at least set) some other way;
 * a chat message never overwrites it. Returns 'saved' | 'taken' | 'exists'.
 * `taken`: User.email is unique, and telling the sender *whose* it is would
 * be an enumeration oracle — the copy says only that it's in use.
 */
export async function setEmailIfEmpty(userId, email) {
  const clean = String(email ?? '').trim().toLowerCase()
  try {
    const res = await prisma.user.updateMany({ where: { id: userId, email: null }, data: { email: clean } })
    return res.count === 1 ? 'saved' : 'exists'
  } catch (err) {
    if (err?.code === 'P2002') return 'taken'
    throw err
  }
}

/** The owner's map-privacy choice, made in the review step. */
export async function setShowExactLocation(userId, showExact) {
  return prisma.user.update({ where: { id: userId }, data: { showExactLocation: !!showExact }, select: USER_SELECT })
}

export async function getUser(userId) {
  return prisma.user.findUnique({ where: { id: userId }, select: USER_SELECT })
}
