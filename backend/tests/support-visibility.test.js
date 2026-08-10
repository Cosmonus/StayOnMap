/**
 * Who may see what on a support case — the most dangerous rules in the layer.
 *
 * Every mistake here is a PRIVACY LEAK rather than an error: the wrong answer
 * shows an owner the identity of the person who reported them, or shows a
 * reporter an internal note saying their listing is under investigation. Both
 * are unrecoverable, because a delivered message cannot be recalled.
 *
 * The module is pure so it can be tested exhaustively rather than
 * representatively, and that is what this file does: every (role, visibility)
 * pair, not a sample.
 */
import { describe, it, expect } from 'vitest'
import {
  VISIBILITY, ROLE, canSee, visibleTo, isStaff,
  defaultVisibilityFor, allowedVisibilities, partyRole,
} from '../src/features/support/visibility.js'

const ALL_VIS = Object.values(VISIBILITY)

describe('the full access table', () => {
  // Written out longhand rather than generated. A generated expectation is
  // the same logic twice and would agree with a wrong implementation.
  const EXPECTED = {
    TENANT: { PUBLIC: true, TENANT_ONLY: true,  OWNER_ONLY: false, INTERNAL: false },
    OWNER:  { PUBLIC: true, TENANT_ONLY: false, OWNER_ONLY: true,  INTERNAL: false },
    ADMIN:  { PUBLIC: true, TENANT_ONLY: true,  OWNER_ONLY: true,  INTERNAL: true },
    SUPPORT_AGENT: { PUBLIC: true, TENANT_ONLY: true, OWNER_ONLY: true, INTERNAL: true },
  }

  for (const [role, row] of Object.entries(EXPECTED)) {
    for (const [vis, expected] of Object.entries(row)) {
      it(`${role} ${expected ? 'sees' : 'cannot see'} ${vis}`, () => {
        expect(canSee({ role }, vis)).toBe(expected)
      })
    }
  }
})

describe('the two leaks that matter most', () => {
  it('never shows a tenant-only message to an owner', () => {
    // The reporter's own words. An owner reading these learns who filed the
    // report, which turns a safety feature into a retaliation surface.
    expect(canSee({ role: ROLE.OWNER }, VISIBILITY.TENANT_ONLY)).toBe(false)
  })

  it('never shows an internal note to any user', () => {
    for (const role of [ROLE.TENANT, ROLE.OWNER]) {
      expect(canSee({ role }, VISIBILITY.INTERNAL)).toBe(false)
    }
  })
})

describe('failing closed', () => {
  it('treats an unknown visibility as internal, not as public', () => {
    // A value nobody has reasoned about is one nobody has approved. The safe
    // reading of "I don't know" is "don't show it".
    for (const role of [ROLE.TENANT, ROLE.OWNER]) {
      expect(canSee({ role }, 'SOMETHING_NEW')).toBe(false)
      expect(canSee({ role }, undefined)).toBe(false)
    }
  })

  it('refuses a viewer with no role at all', () => {
    for (const vis of ALL_VIS) {
      expect(canSee(null, vis)).toBe(false)
      expect(canSee({}, vis)).toBe(false)
    }
  })

  it('does not treat SYSTEM as staff', () => {
    // SYSTEM authors messages; it never reads them, and a bug that mapped an
    // unknown role onto SYSTEM must not thereby grant internal access.
    expect(isStaff(ROLE.SYSTEM)).toBe(false)
    expect(canSee({ role: ROLE.SYSTEM }, VISIBILITY.INTERNAL)).toBe(false)
  })
})

describe('visibleTo', () => {
  const rows = ALL_VIS.map((v) => ({ id: v, visibility: v }))

  it('gives a tenant only public and tenant-only', () => {
    expect(visibleTo({ role: ROLE.TENANT }, rows).map((r) => r.id))
      .toEqual([VISIBILITY.PUBLIC, VISIBILITY.TENANT_ONLY])
  })

  it('gives an owner only public and owner-only', () => {
    expect(visibleTo({ role: ROLE.OWNER }, rows).map((r) => r.id))
      .toEqual([VISIBILITY.PUBLIC, VISIBILITY.OWNER_ONLY])
  })

  it('gives staff everything', () => {
    expect(visibleTo({ role: ROLE.ADMIN }, rows)).toHaveLength(ALL_VIS.length)
  })

  it('survives null and undefined without throwing', () => {
    expect(visibleTo({ role: ROLE.TENANT }, null)).toEqual([])
    expect(visibleTo({ role: ROLE.TENANT }, undefined)).toEqual([])
  })
})

describe('what an author may choose', () => {
  it('gives a tenant no choice at all', () => {
    // Letting a reporter publish to an owner is a way to leak their own
    // identity into a case the owner can read.
    expect(allowedVisibilities(ROLE.TENANT)).toEqual([VISIBILITY.TENANT_ONLY])
  })

  it('gives an owner no choice either', () => {
    expect(allowedVisibilities(ROLE.OWNER)).toEqual([VISIBILITY.OWNER_ONLY])
  })

  it('lets staff choose deliberately — that is what an internal note is', () => {
    expect(allowedVisibilities(ROLE.ADMIN)).toEqual(ALL_VIS)
  })

  it('defaults every party to the narrow value, never PUBLIC', () => {
    // A tenant writing on a property report is telling us about somebody
    // else's listing. PUBLIC on that case includes the owner.
    expect(defaultVisibilityFor(ROLE.TENANT)).toBe(VISIBILITY.TENANT_ONLY)
    expect(defaultVisibilityFor(ROLE.OWNER)).toBe(VISIBILITY.OWNER_ONLY)
    expect(defaultVisibilityFor(ROLE.ADMIN)).toBe(VISIBILITY.INTERNAL)
  })
})

describe('partyRole — which hat a user holds on one case', () => {
  const CASE = { createdById: 'reporter-1', openedAs: ROLE.TENANT, relatedUserId: null }

  it('gives the opener the hat they opened it with', () => {
    expect(partyRole(CASE, 'reporter-1')).toBe(ROLE.TENANT)
  })

  it('treats an OWNER account that filed a report as a TENANT on that case', () => {
    // THE test in this file. An owner reporting a rival's listing is acting as
    // a renter; reading them as an owner would hand them the owner's side of a
    // case filed against a stranger.
    expect(partyRole({ ...CASE, createdById: 'owner-9' }, 'owner-9', 'owner-9')).toBe(ROLE.TENANT)
  })

  it('gives the listing owner the OWNER hat', () => {
    expect(partyRole(CASE, 'owner-2', 'owner-2')).toBe(ROLE.OWNER)
  })

  it('gives a stranger nothing', () => {
    expect(partyRole(CASE, 'someone-else', 'owner-2')).toBeNull()
    expect(partyRole(CASE, null)).toBeNull()
  })

  it('does not make the SUBJECT of a complaint a party to it', () => {
    // Being complained about does not entitle you to read the complaint —
    // moderation decides what you are told.
    const complaint = { createdById: 'tenant-1', openedAs: ROLE.TENANT, relatedUserId: 'accused-1' }
    expect(partyRole(complaint, 'accused-1')).toBeNull()
  })
})
