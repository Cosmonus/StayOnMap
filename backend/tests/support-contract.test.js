/**
 * The support layer's contract with itself.
 *
 * Three vocabularies exist twice — once in schema.prisma, once in Zod — because
 * Prisma enums are not importable as runtime values. The amenities lesson says
 * a list duplicated across files drifts silently unless something compares
 * them, and the failure here is worse than a missing amenity: a case type Zod
 * rejects is a support request nobody can file, and one Prisma rejects is a 500
 * on a form that validated.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  CASE_TYPES, CASE_STATUSES, PRIORITIES, VISIBILITIES,
  createCaseSchema, caseMessageSchema, escalateSchema, adminCaseListQuerySchema,
} from '../src/features/support/support.validation.js'
import { STATUS } from '../src/features/support/lifecycle.js'
import { VISIBILITY } from '../src/features/support/visibility.js'
import { caseRef, parseCaseRef } from '../src/features/support/caseRef.js'

const SCHEMA = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8')

const enumValues = (name) => {
  const block = new RegExp(`enum ${name} \\{([^}]*)\\}`).exec(SCHEMA)[1]
  return block.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('//')).sort()
}

describe('the vocabularies match schema.prisma', () => {
  it.each([
    ['SupportCaseType', () => CASE_TYPES],
    ['SupportCaseStatus', () => CASE_STATUSES],
    ['SupportPriority', () => PRIORITIES],
    ['SupportVisibility', () => VISIBILITIES],
  ])('%s', (enumName, get) => {
    expect([...get()].sort()).toEqual(enumValues(enumName))
  })

  it('the lifecycle and visibility modules use the same values too', () => {
    // Three copies would be worse than two. These are the ones the RULES are
    // written against, so a drift here means a rule that silently never fires.
    expect(Object.values(STATUS).sort()).toEqual(enumValues('SupportCaseStatus'))
    expect(Object.values(VISIBILITY).sort()).toEqual(enumValues('SupportVisibility'))
  })
})

describe('what a user may open', () => {
  const valid = {
    type: 'GENERAL_SUPPORT',
    subject: 'Cannot find my saved homes',
    description: 'I saved four listings last week and the wishlist tab is empty today.',
  }

  it('accepts a real request', () => {
    expect(createCaseSchema.safeParse(valid).success).toBe(true)
  })

  it('refuses PROPERTY_REPORT — reports go through the report endpoint', () => {
    // That path runs the risk score, the auto-suspend corroboration rule and
    // the owner notification. A case created directly would be a second,
    // weaker door into moderation that skips all three.
    expect(createCaseSchema.safeParse({ ...valid, type: 'PROPERTY_REPORT' }).success).toBe(false)
  })

  it('does not let a user set their own priority or status', () => {
    // A field anybody can mark URGENT is URGENT on everything within a week.
    // Zod strips unknown keys, so these are dropped rather than rejected —
    // what matters is that they never reach the service.
    const parsed = createCaseSchema.parse({ ...valid, priority: 'URGENT', status: 'RESOLVED' })
    expect(parsed.priority).toBeUndefined()
    expect(parsed.status).toBeUndefined()
  })

  it('demands enough description to act on', () => {
    expect(createCaseSchema.safeParse({ ...valid, description: 'help' }).success).toBe(false)
  })

  it('bounds every free-text field', () => {
    expect(createCaseSchema.safeParse({ ...valid, subject: 'x'.repeat(500) }).success).toBe(false)
    expect(createCaseSchema.safeParse({ ...valid, description: 'x'.repeat(9000) }).success).toBe(false)
    expect(caseMessageSchema.safeParse({ body: 'x'.repeat(9000) }).success).toBe(false)
  })
})

describe('escalation', () => {
  it('requires a reason, unlike every other reason field', () => {
    // An escalation with no reason is a status change wearing a louder name.
    expect(escalateSchema.safeParse({}).success).toBe(false)
    expect(escalateSchema.safeParse({ reason: 'no' }).success).toBe(false)
    expect(escalateSchema.safeParse({ reason: 'Reporter says money was taken before a viewing.' }).success).toBe(true)
  })
})

describe('the admin queue query', () => {
  it('caps the page size rather than trusting it', () => {
    // This table grows with every support request; an unbounded page size from
    // a query string is how an admin panel gets slow from the address bar.
    expect(adminCaseListQuerySchema.safeParse({ limit: 100000 }).success).toBe(false)
    expect(adminCaseListQuerySchema.safeParse({ limit: '100' }).data.limit).toBe(100)
  })

  it('accepts an empty query — the default view is every case', () => {
    expect(adminCaseListQuerySchema.safeParse({}).success).toBe(true)
  })

  it('rejects a status that is not real, rather than ignoring it', () => {
    // Silently dropping an unknown filter would widen the view from "escalated"
    // to "everything" — the same class of bug as the mark-all-read filter.
    expect(adminCaseListQuerySchema.safeParse({ status: 'BOGUS' }).success).toBe(false)
  })
})

describe('the case reference', () => {
  it('renders as people quote it', () => {
    expect(caseRef(1042)).toBe('SC-1042')
  })

  it('parses back whatever somebody pasted out of an email', () => {
    // A search box that only accepts the canonical form fails for the one
    // person who most needs it.
    for (const input of ['SC-1042', 'sc-1042', 'sc 1042', '  SC-1042  ', '1042']) {
      expect(parseCaseRef(input), input).toBe(1042)
    }
  })

  it('returns null rather than NaN for anything else', () => {
    for (const input of ['', 'SC-', 'abc', null, undefined, '-5', '1.5']) {
      expect(parseCaseRef(input), String(input)).toBeNull()
    }
  })
})

describe('the routes are mounted and separated', () => {
  const routes = readFileSync(new URL('../src/features/support/support.routes.js', import.meta.url), 'utf8')
  const index = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8')

  it('mounts both routers', () => {
    expect(index).toMatch(/app\.use\('\/api\/v1\/support'/)
    expect(index).toMatch(/app\.use\('\/api\/v1\/admin\/support'/)
  })

  it('guards the user router with authMiddleware and the staff one with adminAuth', () => {
    // The two ecosystems use different JWT secrets. A user router that reached
    // for adminAuth — or worse, the reverse — is the one mistake here that
    // hands the admin panel to anybody with an account.
    expect(routes).toMatch(/supportRouter\.use\(authMiddleware\)/)
    expect(routes).toMatch(/adminSupportRouter\.use\(adminAuthMiddleware\)/)
  })

  it('puts /cases/counts before /cases/:id in the ADMIN router', () => {
    // Otherwise "counts" is read as a case id and the dashboard 404s.
    //
    // Scoped to the admin block: the user router declares its own /cases/:id
    // earlier in the file and has no /counts at all, so comparing across both
    // measures file layout rather than route precedence.
    const admin = routes.slice(routes.indexOf('export const adminSupportRouter'))
    expect(admin.indexOf("'/cases/counts'")).toBeGreaterThan(-1)
    expect(admin.indexOf("'/cases/counts'")).toBeLessThan(admin.indexOf("'/cases/:id'"))
  })

  it('validates every write', () => {
    const writes = routes.split('\n').filter((l) => /\.(post|patch)\(/.test(l))
    expect(writes.length).toBeGreaterThan(6)
    for (const line of writes) {
      // /close carries no body — there is nothing to validate, and a schema
      // for {} would be ceremony.
      if (line.includes("'/cases/:id/close'")) continue
      expect(line, line.trim()).toMatch(/validate\(/)
    }
  })
})
