import { z } from 'zod'
import { SUPPORTED_CITIES } from '../../config/cities.js'

// `PUT /users/profile` had no validate() at all until 2026-07-30.
//
// The ALLOWED_FIELDS whitelist in users.service.js does correctly block
// privilege escalation — `role`, `isBusiness` and `isVerified` can never be
// set through here — so this is not an authz hole. What was missing is any
// constraint on the SHAPE of the fields that ARE allowed:
//
//   name / bio     unbounded. A ~2MB string persists and then renders on every
//                  surface that shows an author: reviews, chat, owner cards.
//   avatarUrl      ANY string. An attacker-controlled URL is fetched by the
//                  browser of every user who views their listings or messages,
//                  which leaks those viewers' IPs to a third party and makes
//                  the profile a tracking pixel. `javascript:`/`data:` are the
//                  other half of the reason to constrain the scheme.
//   phone          skipped the /^[6-9]\d{9}$/ rule .claude/security.md
//                  mandates and the frontend already enforces client-side.
//
// Everything here is `.optional()` because the endpoint is a PATCH in spirit:
// the client sends only what changed, and the service ignores `undefined`.

// Empty string is NOT invalid here — it is how both clients clear a field.
//
// Web's SettingsPanel posts the WHOLE form on every save, with unset fields
// defaulting to `''` (`settings.phone ?? ''`), and mobile's EditProfileSheet
// sends `phone: cleanPhone` which is `''` once cleared. A schema that only
// accepted a well-formed value would therefore 400 every save made by a user
// with no phone number — which is most of them, since phone is not collected
// at signup. The service already treats `''` as "store empty", so allowing it
// preserves today's behaviour exactly while still bounding the non-empty case.
const orBlank = (schema) => schema.or(z.literal(''))

const httpUrl = z
  .string()
  .trim()
  .max(2048)
  .url('Must be a valid URL')
  .refine((u) => /^https?:\/\//i.test(u), 'Must be an http(s) URL')

// Social handles are typed by hand and the UI's own placeholders show bare
// domains ("linkedin.com/in/you"), so requiring a scheme here would reject
// what the form asks for. Bound the length, refuse the schemes that execute,
// and otherwise leave it as the free text it has always been.
const socialHandle = z
  .string()
  .trim()
  .max(200)
  .refine((v) => !/^\s*(javascript|data|vbscript):/i.test(v), 'Invalid link')

export const updateProfileSchema = z.object({
  // `name` is the one field with no blank escape hatch, deliberately: it is
  // rendered as the author on reviews, chat and owner cards, so an empty one
  // is corrupt data on every surface at once. A loud 400 beats a silent blank.
  name:   z.string().trim().min(1, 'Name cannot be empty').max(100).optional(),
  phone:  orBlank(z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number')).optional(),
  bio:    z.string().trim().max(1000).optional(),
  avatarUrl: orBlank(httpUrl).optional(),
  // The service already drops a city outside SUPPORTED_CITIES; accepting ''
  // here keeps web's "no city selected" save working as it does today.
  city:   orBlank(z.enum(SUPPORTED_CITIES)).optional(),

  socialLinks: z
    .object({
      linkedin:  socialHandle.optional(),
      instagram: socialHandle.optional(),
      twitter:   socialHandle.optional(),
    })
    .strict()
    .optional(),

  listingVisibility: z.enum(['PUBLIC', 'LOGGED_IN', 'HIDDEN']).optional(),
  contactVisibility: z.enum(['EVERYONE', 'LOGGED_IN', 'NOBODY']).optional(),
  showExactLocation: z.boolean().optional(),
  emailNotifs:       z.boolean().optional(),
  pushNotifs:        z.boolean().optional(),
})

// ─── User safety: reporting a person ─────────────────────────────────────────

// Deliberately NOT ReportCategory (that enum is for listings — a person cannot
// have FAKE_PHOTOS and a listing cannot HARASS). Kept in step with
// `UserReportCategory` in schema.prisma; the clients render this same list.
export const USER_REPORT_CATEGORIES = [
  'HARASSMENT',
  'SPAM',
  'SCAM_OR_FRAUD',
  'IMPERSONATION',
  'HATE_OR_ABUSE',
  'OTHER',
]

export const reportUserSchema = z.object({
  category: z.enum(USER_REPORT_CATEGORIES),
  // Bounded for the same reason `name`/`bio` are: an admin reads this in a
  // moderation queue, and an unbounded field is a way to make that queue
  // unusable. The floor is there so "asdf" isn't a report a moderator has to
  // act on.
  description: z.string().trim().min(10, 'Please describe what happened').max(2000),
  // Optional: a report can come from a profile as well as a thread. The service
  // checks the reporter is actually in the conversation they cite — without
  // that, any thread on the platform could be attached to a stranger's name.
  conversationId: z.string().cuid().optional(),
})
