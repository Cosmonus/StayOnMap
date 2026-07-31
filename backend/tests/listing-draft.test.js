/**
 * Listing draft — the wizard's unfinished listing, shared across an owner's
 * devices (2026-07-30).
 *
 * The point of the feature is that a draft started on a phone opens on a
 * laptop, so what these tests guard is the part that makes that safe rather
 * than merely possible:
 *
 *   scoping      the draft is keyed by req.user.id and nothing else — there is
 *                no id in any path, so another owner's draft is unreachable by
 *                construction. A test pins that the service never looks one up
 *                by anything but the caller.
 *   the clock    `at` is the tiebreak between two devices. A push without one
 *                must land as "now", not epoch — an envelope stamped 1970 loses
 *                every comparison forever and the owner's draft silently stops
 *                syncing.
 *   expiry       both clients drop a local draft at 14 days. The server has to
 *                agree, or a stale row resurrects itself onto a device that had
 *                already let it go.
 *   size         the payload is deliberately unvalidated inside, so the cap is
 *                the only thing stopping this becoming free per-user storage.
 *   vocabulary   CATEGORY_KEYS is declared in the backend rather than imported
 *                from the shared frontend config. That is the right call for
 *                runtime code and the wrong one to leave unchecked — a seventh
 *                category on the clients would otherwise show up as a 400
 *                nobody can explain.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'

import { getDraft, putDraft, deleteDraft } from '../src/features/listingDraft/listingDraft.service.js'
import { putDraftSchema, CATEGORY_KEYS, STEP_KEYS, MAX_PAYLOAD_BYTES } from '../src/features/listingDraft/listingDraft.validation.js'
import { CATEGORIES } from '../../frontend/src/features/listings/config/onboarding.js'
import { WIZARD_STEPS } from '../../mobile/src/features/listings/config/wizardSteps.js'

const DAY_MS = 24 * 60 * 60 * 1000

function envelope(overrides = {}) {
  return {
    categoryKey: 'apartment',
    stepIdx: 2,
    stepKey: 'photos',
    draft: { title: 'Half-written flat', images: [] },
    ...overrides,
  }
}

function row(overrides = {}) {
  const { at = Date.now(), ...rest } = overrides
  return {
    id: 'draft-1',
    userId: 'user-1',
    payload: envelope(),
    savedAt: new Date(at),
    ...rest,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getDraft', () => {
  it('looks the draft up by the caller and nothing else', async () => {
    prismaMock.listingDraft.findUnique.mockResolvedValue(row())

    await getDraft('user-1')

    expect(prismaMock.listingDraft.findUnique).toHaveBeenCalledWith({ where: { userId: 'user-1' } })
  })

  it('returns null when there is nothing saved — the common case, not an error', async () => {
    prismaMock.listingDraft.findUnique.mockResolvedValue(null)

    expect(await getDraft('user-1')).toBeNull()
  })

  it('hands back the envelope with `at` on it, so a pull can be adopted verbatim', async () => {
    const at = Date.now() - 5000
    prismaMock.listingDraft.findUnique.mockResolvedValue(row({ at }))

    const draft = await getDraft('user-1')

    expect(draft).toMatchObject({ categoryKey: 'apartment', stepKey: 'photos', at })
  })

  it('drops a draft older than the 14 days both clients expire at', async () => {
    prismaMock.listingDraft.findUnique.mockResolvedValue(row({ at: Date.now() - 15 * DAY_MS }))

    expect(await getDraft('user-1')).toBeNull()
    expect(prismaMock.listingDraft.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } })
  })

  it('keeps one that is inside the window', async () => {
    prismaMock.listingDraft.findUnique.mockResolvedValue(row({ at: Date.now() - 13 * DAY_MS }))

    expect(await getDraft('user-1')).not.toBeNull()
    expect(prismaMock.listingDraft.deleteMany).not.toHaveBeenCalled()
  })
})

describe('putDraft', () => {
  it('upserts against the caller, keeping the one slot per owner', async () => {
    prismaMock.listingDraft.upsert.mockImplementation(({ create }) => row({ ...create, at: create.savedAt.getTime() }))

    await putDraft('user-1', envelope({ at: 1_700_000_000_000 }))

    const call = prismaMock.listingDraft.upsert.mock.calls[0][0]
    expect(call.where).toEqual({ userId: 'user-1' })
    expect(call.create.userId).toBe('user-1')
    expect(call.create.savedAt).toEqual(new Date(1_700_000_000_000))
  })

  it('stores the client clock, not the server one — it is what the pull compares', async () => {
    const at = Date.now() - 60_000
    prismaMock.listingDraft.upsert.mockImplementation(({ update }) => row({ payload: update.payload, at: update.savedAt.getTime() }))

    const saved = await putDraft('user-1', envelope({ at }))

    expect(saved.at).toBe(at)
  })

  it('stamps a clockless push as now, never as epoch', async () => {
    const before = Date.now()
    prismaMock.listingDraft.upsert.mockImplementation(({ create }) => row({ at: create.savedAt.getTime() }))

    const saved = await putDraft('user-1', envelope())

    // An envelope stamped 1970 would lose every last-write-wins comparison for
    // good, so the draft would appear to sync once and then never again.
    expect(saved.at).toBeGreaterThanOrEqual(before)
  })

  it('does not store `at` inside the payload — savedAt is the single home for it', async () => {
    prismaMock.listingDraft.upsert.mockImplementation(({ create }) => row({ payload: create.payload, at: create.savedAt.getTime() }))

    await putDraft('user-1', envelope({ at: 123456789 }))

    expect(prismaMock.listingDraft.upsert.mock.calls[0][0].create.payload).not.toHaveProperty('at')
  })
})

describe('deleteDraft', () => {
  it('is a no-op when there is nothing to delete, not a throw', async () => {
    prismaMock.listingDraft.deleteMany.mockResolvedValue({ count: 0 })

    // Publishing on a second device, or a retry over a flaky connection, both
    // hit exactly this. `delete` would have thrown P2025 → an uncaught 500.
    await expect(deleteDraft('user-1')).resolves.toBeUndefined()
    expect(prismaMock.listingDraft.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } })
  })
})

describe('validation', () => {
  it('accepts a partly-filled draft — that is the entire point of one', () => {
    const parsed = putDraftSchema.safeParse({ categoryKey: 'land', draft: {} })
    expect(parsed.success).toBe(true)
  })

  it('rejects an unknown category', () => {
    expect(putDraftSchema.safeParse(envelope({ categoryKey: 'houseboat' })).success).toBe(false)
  })

  it('rejects a payload past the size cap', () => {
    const huge = putDraftSchema.safeParse(envelope({ draft: { blob: 'x'.repeat(MAX_PAYLOAD_BYTES) } }))
    expect(huge.success).toBe(false)
  })

  it('accepts every step key either wizard can write', () => {
    // Mobile has seven steps to web's six; `stepKey` is what makes an envelope
    // portable between them, so rejecting one platform's key would strand its
    // drafts on the device that wrote them.
    for (const step of WIZARD_STEPS) {
      expect(putDraftSchema.safeParse(envelope({ stepKey: step.k })).success, step.k).toBe(true)
    }
  })
})

describe('vocabulary parity with the shared wizard config', () => {
  it('knows exactly the categories the wizards offer', () => {
    // Declared in the backend on purpose — runtime code must not import
    // frontend source. This test is what keeps that from silently drifting.
    expect([...CATEGORY_KEYS].sort()).toEqual(Object.keys(CATEGORIES).sort())
  })

  it('knows exactly the steps the wizards use', () => {
    expect([...STEP_KEYS].sort()).toEqual(WIZARD_STEPS.map((s) => s.k).sort())
  })
})
