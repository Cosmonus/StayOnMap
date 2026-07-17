import { prisma } from '../lib/prisma.js'

// Fields an owner must have before they can put a home in front of renters.
// Deliberately NOT "every column on User": bio, avatar and socialLinks are
// self-expression, and refusing someone's listing because they didn't upload a
// photo of their face would block honest owners without making anyone safer.
// These four are the ones a renter's safety actually rests on:
//
//   name    — a real person to hold accountable
//   phone   — reachable when a tenant needs the owner (and the number we show
//             once an appointment is ACCEPTED)
//   city    — must match where they're listing; a Chennai account listing in
//             Delhi is a signal worth having
//   email   — VERIFIED, not merely typed. An unverified address is not a way
//             to reach anyone, and it's free to fake.
//
// If you add a field here, you are adding a barrier to someone listing their
// home. Be sure it protects a renter.
const REQUIRED = [
  { key: 'name',  label: 'Your name',        ok: (u) => !!u.name?.trim() },
  { key: 'phone', label: 'Phone number',     ok: (u) => !!u.phone?.trim() },
  { key: 'city',  label: 'City',             ok: (u) => !!u.city?.trim() },
  { key: 'email', label: 'Verified email',   ok: (u) => u.isVerified === true },
]

export function missingProfileFields(user) {
  if (!user) return REQUIRED.map((f) => ({ field: f.key, label: f.label }))
  return REQUIRED.filter((f) => !f.ok(user)).map((f) => ({ field: f.key, label: f.label }))
}

// Gates listing CREATION only — never editing, never an existing listing.
// Someone who listed before this rule existed keeps their listings; they're
// only asked to complete their profile the next time they add one.
//
// Runs after authMiddleware. The 403 names exactly what's missing so the
// client can send them straight to the right settings fields instead of a
// dead-end "profile incomplete".
export async function requireCompleteProfile(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { name: true, phone: true, city: true, isVerified: true },
    })

    const missing = missingProfileFields(user)
    if (missing.length > 0) {
      return res.status(403).json({
        success: false,
        error: 'PROFILE_INCOMPLETE',
        message: `Complete your profile before listing: ${missing.map((m) => m.label).join(', ')}`,
        missing,
      })
    }
    next()
  } catch (err) { next(err) }
}
