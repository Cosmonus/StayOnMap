// Supply, measured net.
//
// `Property.status` is one column that overwrites itself: the moment a listing
// goes OCCUPIED, nothing remembers it was ever ACTIVE. So the log has to be
// written as the transition happens or the number is unrecoverable at any
// price — which makes "did every write site remember to log?" the question
// worth a test, more than any assertion about the helper itself.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { prismaMock } from './mocks/prisma.js'
import { recordStatusChange, recordBulkStatusChange } from '../src/features/properties/statusEvents.js'

const FEATURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'features')

beforeEach(() => vi.clearAllMocks())

describe('recordStatusChange', () => {
  it('writes the transition', () => {
    recordStatusChange({ propertyId: 'p1', from: 'PENDING', to: 'ACTIVE', actor: 'admin' })
    expect(prismaMock.propertyStatusEvent.create).toHaveBeenCalledWith({
      data: { propertyId: 'p1', fromStatus: 'PENDING', toStatus: 'ACTIVE', actor: 'admin' },
    })
  })

  it('accepts a first-ever event with nothing before it', () => {
    recordStatusChange({ propertyId: 'p1', from: undefined, to: 'DRAFT' })
    expect(prismaMock.propertyStatusEvent.create).toHaveBeenCalledWith({
      data: { propertyId: 'p1', fromStatus: null, toStatus: 'DRAFT', actor: 'system' },
    })
  })

  it('does nothing when the status did not actually change', () => {
    // An idempotent re-save must not invent churn that never happened.
    recordStatusChange({ propertyId: 'p1', from: 'ACTIVE', to: 'ACTIVE' })
    expect(prismaMock.propertyStatusEvent.create).not.toHaveBeenCalled()
  })

  it('never throws when the write fails', async () => {
    // A metrics row must not break the action that earned it. An owner marking
    // their flat rented does not care that the chart missed a point.
    prismaMock.propertyStatusEvent.create.mockRejectedValueOnce(new Error('db down'))
    expect(() => recordStatusChange({ propertyId: 'p1', from: 'ACTIVE', to: 'OCCUPIED' })).not.toThrow()
    await new Promise((r) => setTimeout(r, 0))
  })

  it('logs every listing in a bulk transition', () => {
    recordBulkStatusChange({ propertyIds: ['a', 'b'], from: 'ACTIVE', to: 'SUSPENDED', actor: 'admin' })
    expect(prismaMock.propertyStatusEvent.createMany).toHaveBeenCalledWith({
      data: [
        { propertyId: 'a', fromStatus: 'ACTIVE', toStatus: 'SUSPENDED', actor: 'admin' },
        { propertyId: 'b', fromStatus: 'ACTIVE', toStatus: 'SUSPENDED', actor: 'admin' },
      ],
    })
  })

  it('does nothing for an empty bulk set', () => {
    recordBulkStatusChange({ propertyIds: [], from: 'ACTIVE', to: 'SUSPENDED' })
    expect(prismaMock.propertyStatusEvent.createMany).not.toHaveBeenCalled()
  })
})

// ── The one that actually protects the metric ──────────────────────────────
//
// Nine services can move a Property between statuses. A convention that must be
// remembered at nine call sites has, elsewhere in this codebase, been forgotten
// at 45 of 46 (see error.middleware.js on P2025). This walks the source instead
// of trusting anybody to remember.
//
// It is deliberately crude — it asks whether a file that writes `status:` to a
// Property also mentions the recorder, not whether the two are correctly paired
// line by line. A test that tried to prove pairing would need to parse control
// flow, and the failure it exists to catch is the blunt one: somebody adds a
// tenth transition in a new file and no chart ever mentions it.
function jsFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return jsFiles(full)
    return full.endsWith('.js') && !full.endsWith('.test.js') ? [full] : []
  })
}

describe('every service that changes a listing status logs it', () => {
  it('has no write site without the recorder', () => {
    // Matches a Prisma update whose data sets `status` to a Property status
    // literal. Narrow on purpose: `status: newStatus` on a REPORT is not this.
    const WRITES_PROPERTY_STATUS = /property\.update(Many)?\([^)]*status:\s*['"](DRAFT|ACTIVE|INACTIVE|PENDING|SUSPENDED|REJECTED|OCCUPIED)['"]/s

    const offenders = jsFiles(FEATURES)
      .filter((f) => WRITES_PROPERTY_STATUS.test(readFileSync(f, 'utf8')))
      .filter((f) => !readFileSync(f, 'utf8').includes('recordStatusChange')
                  && !readFileSync(f, 'utf8').includes('recordBulkStatusChange'))
      .map((f) => f.slice(f.indexOf('features')))

    expect(
      offenders,
      `these move a listing between statuses without logging it, so net supply will undercount:\n  ${offenders.join('\n  ')}`,
    ).toEqual([])
  })
})
