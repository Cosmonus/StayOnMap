/**
 * Three things the admin detail views could not see, all of them already in the
 * database — 2026-08-10.
 *
 * The shared shape of all three is worth naming, because it is not a bug that
 * throws: the data was WRITTEN correctly and constantly, and simply never
 * selected. A page missing a panel looks finished. Nothing logs, nothing 500s,
 * and the only symptom is an admin answering a question by hand that the
 * database could have answered.
 *
 *   OwnerTrustScore      recalculated on every review, report and verification,
 *                        and shown to RENTERS — the admin reviewing the owner
 *                        was the one person who could not see it.
 *   PropertyStatusEvent  eleven services write it, nothing read it except in
 *                        aggregate. `Property.status` overwrites itself, so
 *                        this log is the ONLY record that a listing was ever
 *                        ACTIVE once it goes OCCUPIED.
 *   PointsLedger         no admin surface at all, on the table whose documented
 *                        risk (docs/points-and-sharing.md) is award farming.
 *
 * These assert the SELECT rather than a rendered panel: the queries are what
 * was missing, and a component test would pass against a fixture that invents
 * the fields — which is how the marketplace `appointment` relation survived.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'
import { getUserDetail, getAdminPropertyById } from '../src/features/admin/admin.service.js'

/** The `select`/`include` the service asked Prisma for. */
const askedFor = (mock) => mock.mock.calls[0][0].select ?? mock.mock.calls[0][0].include

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' })
  prismaMock.property.findUnique.mockResolvedValue({ id: 'p1' })
})

describe('admin user detail', () => {
  it('asks for the owner trust score', async () => {
    await getUserDetail('u1')
    expect(askedFor(prismaMock.user.findUnique).ownerTrustScore).toBeTruthy()
  })

  it('asks for score, level, response rate and freshness — not just the number', async () => {
    // A bare score is unactionable: "62" does not say whether it is 62 because
    // they never answer, or 62 because nobody has reviewed them yet.
    await getUserDetail('u1')
    const fields = askedFor(prismaMock.user.findUnique).ownerTrustScore.select
    for (const f of ['score', 'level', 'responseRate', 'reviewAvg', 'verificationLevel', 'updatedAt']) {
      expect(fields[f], `ownerTrustScore.${f}`).toBe(true)
    }
  })

  it('asks for the points ledger, newest first and bounded', async () => {
    await getUserDetail('u1')
    const ledger = askedFor(prismaMock.user.findUnique).pointsLedger
    expect(ledger.orderBy).toEqual({ createdAt: 'desc' })
    expect(ledger.take).toBeGreaterThan(0)
    expect(ledger.select.action).toBe(true)
    expect(ledger.select.points).toBe(true)
    // referenceId is what distinguishes twenty legitimate awards from one
    // award counted twenty times, which is the whole reason to look.
    expect(ledger.select.referenceId).toBe(true)
  })

  it('counts the whole ledger as well as listing part of it', async () => {
    // Without the count, "20 awards" reads as the total when it is a page.
    await getUserDetail('u1')
    expect(askedFor(prismaMock.user.findUnique)._count.select.pointsLedger).toBe(true)
  })

  it('still never selects the password hash', async () => {
    // The bare `include` this replaced shipped every User column to the
    // browser. Adding fields must not walk that back.
    await getUserDetail('u1')
    expect(askedFor(prismaMock.user.findUnique).passwordHash).toBeUndefined()
  })
})

describe('admin property detail', () => {
  it('asks for the status history', async () => {
    await getAdminPropertyById('p1')
    expect(askedFor(prismaMock.property.findUnique).statusEvents).toBeTruthy()
  })

  it('orders it newest first and bounds it', async () => {
    // A listing toggled daily for a year would otherwise put 365 rows into a
    // moderation payload that already carries 50 chat threads.
    await getAdminPropertyById('p1')
    const events = askedFor(prismaMock.property.findUnique).statusEvents
    expect(events.orderBy).toEqual({ createdAt: 'desc' })
    expect(events.take).toBeGreaterThan(0)
    expect(events.take).toBeLessThanOrEqual(50)
  })

  it('carries both ends of each transition and who did it', async () => {
    // "went SUSPENDED" is a different fact from "went ACTIVE → SUSPENDED", and
    // only the second one tells a moderator whether anything was lost.
    await getAdminPropertyById('p1')
    const fields = askedFor(prismaMock.property.findUnique).statusEvents.select
    for (const f of ['fromStatus', 'toStatus', 'actor', 'createdAt']) {
      expect(fields[f], `statusEvents.${f}`).toBe(true)
    }
  })

  it('asks for the unresolved fraud signals', async () => {
    // Four detectors have written FraudSignal since the intelligence layer
    // shipped and nothing rendered them anywhere, so moderation saw a risk
    // NUMBER with no reason attached. The read path tolerates the relation
    // being absent (`?? []`), which means dropping this include would empty the
    // panel silently rather than throw — so the JOIN is what has to be pinned.
    await getAdminPropertyById('p1')
    const signals = askedFor(prismaMock.property.findUnique).fraudSignals
    expect(signals).toBeTruthy()
    // Resolved ones are closed questions; showing them beside open ones is how
    // a cleared listing keeps looking guilty.
    expect(signals.where).toEqual({ resolved: false })
  })
})
