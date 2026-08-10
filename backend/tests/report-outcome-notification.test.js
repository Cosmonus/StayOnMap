/**
 * The person who reported something is told what happened.
 *
 * Until 2026-08-10 a report went into silence. `createReport` notified the
 * OWNER, `adminModerateReport` notified the OWNER on a warning, and the
 * reporter was told nothing at any point — not even when their report was
 * upheld and they were quietly awarded points for it.
 *
 * The failure mode of a reporting feature is not a wrong verdict, it is NO
 * verdict: someone reports a fraudulent listing, hears nothing for a week, and
 * concludes reporting does not work. That costs the next report, not this one.
 *
 * The load-bearing half is what the message must NOT say, and that is what most
 * of this file pins.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'
import { notifyUser } from '../src/features/notifications/notifications.service.js'

const { adminModerateReport } = await vi.importActual('../src/features/reports/reports.service.js')

const REPORT = { id: 'rep-1', propertyId: 'prop-1', reporterId: 'user-7', status: 'PENDING' }

/** Notifications sent to the reporter, as opposed to the owner. */
const toReporter = () => notifyUser.mock.calls.filter(([id]) => id === 'user-7')

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.propertyReport.findUnique.mockResolvedValue(REPORT)
  prismaMock.$transaction.mockImplementation(async (ops) => ops.map(() => ({ id: 'rep-1' })))
  prismaMock.propertyReport.update.mockResolvedValue({ id: 'rep-1' })
  prismaMock.moderationAction = { create: vi.fn().mockResolvedValue({}) }
  prismaMock.property.findUnique.mockResolvedValue({ id: 'prop-1', ownerId: 'owner-2', status: 'ACTIVE' })
  prismaMock.property.update.mockResolvedValue({})
  prismaMock.pointsLedger = { create: vi.fn().mockResolvedValue({}) }
})

describe('a reporter hears back', () => {
  it('is told when the report is upheld', async () => {
    await adminModerateReport('rep-1', 'admin-1', { action: 'APPROVE' })
    expect(toReporter()).toHaveLength(1)
    expect(toReporter()[0][1]).toMatchObject({ type: 'REPORT_UPDATE', audience: 'TENANT' })
  })

  it('is told when nothing was found — "we looked and did nothing" is a real answer', async () => {
    await adminModerateReport('rep-1', 'admin-1', { action: 'DISMISS' })
    expect(toReporter()).toHaveLength(1)
    expect(toReporter()[0][1].body).toMatch(/did not find/i)
  })

  it('is not pestered while a report is still being investigated', async () => {
    // INVESTIGATE leaves it UNDER_REVIEW — an outcome has not happened yet, and
    // "we are still looking" every time a moderator opens it is noise.
    await adminModerateReport('rep-1', 'admin-1', { action: 'INVESTIGATE' })
    expect(toReporter()).toHaveLength(0)
  })
})

describe('what the reporter is NOT told', () => {
  it('says the same thing whether the listing was suspended or merely resolved', async () => {
    // Confirming that a report took a listing down turns the report button into
    // a scoreboard, and hands anyone testing how to remove a competitor a
    // reliable signal to test against.
    await adminModerateReport('rep-1', 'admin-1', { action: 'SUSPEND' })
    const suspend = toReporter()[0]?.[1]?.body ?? null

    vi.clearAllMocks()
    prismaMock.propertyReport.findUnique.mockResolvedValue(REPORT)
    await adminModerateReport('rep-1', 'admin-1', { action: 'APPROVE' })
    const approve = toReporter()[0]?.[1]?.body ?? null

    // SUSPEND maps to UNDER_REVIEW, so it sends nothing at all — which is also
    // "no signal". What must never happen is a DIFFERENT, more informative
    // message for the outcome that hurt the owner most.
    if (suspend !== null) expect(suspend).toBe(approve)
  })

  it('never forwards the moderator’s internal note', async () => {
    await adminModerateReport('rep-1', 'admin-1', { action: 'APPROVE', note: 'owner is a known broker, watchlist' })
    expect(JSON.stringify(toReporter())).not.toMatch(/watchlist/)
  })

  it('never names the owner', async () => {
    await adminModerateReport('rep-1', 'admin-1', { action: 'APPROVE' })
    expect(JSON.stringify(toReporter())).not.toMatch(/owner-2/)
  })

  it('sends nothing for an anonymous report — the honest trade for anonymity', async () => {
    prismaMock.propertyReport.findUnique.mockResolvedValue({ ...REPORT, reporterId: null })
    await adminModerateReport('rep-1', 'admin-1', { action: 'APPROVE' })
    expect(notifyUser.mock.calls.filter(([id]) => !id)).toHaveLength(0)
  })
})

describe('the owner’s notifications are unchanged', () => {
  it('still warns the owner on WARN_OWNER, and that message is separate', async () => {
    await adminModerateReport('rep-1', 'admin-1', { action: 'WARN_OWNER', note: 'please fix the photos' })
    const owner = notifyUser.mock.calls.filter(([id]) => id === 'owner-2')
    expect(owner).toHaveLength(1)
    expect(owner[0][1]).toMatchObject({ type: 'TRUST_ALERT', audience: 'OWNER' })
    // The owner DOES see the note — it is written for them.
    expect(owner[0][1].body).toMatch(/photos/)
  })
})
