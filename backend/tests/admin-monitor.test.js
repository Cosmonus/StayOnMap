/**
 * Admin System Monitor — 2026-08-24
 *
 * getMonitorStatus() feeds the one screen an operator opens to ask "is the
 * platform healthy", including during a seeder run. It aggregates twelve
 * queries and three lib statuses; nothing tested its shape, so a renamed field
 * or a query that started throwing would surface as a blank admin card, not a
 * red build. The counts are groupBys, so this pins SHAPE and degradation, not
 * numbers.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'

vi.mock('../src/lib/mailer.js', () => ({
  mailStatus: vi.fn().mockResolvedValue({ provider: 'zeptomail', configured: true, usedToday: 3, dailyCap: 500 }),
}))
vi.mock('../src/lib/smsSender.js', () => ({
  smsStatus: vi.fn().mockResolvedValue({ provider: 'none', configured: false, usedToday: 0, dailyCap: 0 }),
}))

import { getMonitorStatus } from '../src/features/admin/admin.service.js'
import { mailStatus } from '../src/lib/mailer.js'

beforeEach(() => { vi.clearAllMocks() })

function seedHappyPath() {
  prismaMock.property.groupBy.mockResolvedValue([{ status: 'ACTIVE', _count: { _all: 12 } }])
  prismaMock.user.groupBy.mockResolvedValue([{ role: 'TENANT', _count: { _all: 40 } }])
  prismaMock.user.count.mockResolvedValue(1)
  prismaMock.appointment.groupBy.mockResolvedValue([{ status: 'PENDING', _count: { _all: 2 } }])
  prismaMock.activityLog.findMany.mockResolvedValue([])
  prismaMock.property.count.mockResolvedValue(3)
  prismaMock.propertyReport.count.mockResolvedValue(1)
  prismaMock.communityReview.count.mockResolvedValue(0)
  prismaMock.ownershipVerification.count.mockResolvedValue(2)
  prismaMock.$queryRaw.mockResolvedValue([{ '?column?': 1 }])
  prismaMock.pushSubscription.count.mockResolvedValue(5)
  prismaMock.expoPushToken.count.mockResolvedValue(7)
}

describe('getMonitorStatus', () => {
  it('returns every section the panel renders, in the shape it renders', async () => {
    seedHappyPath()

    const out = await getMonitorStatus()

    expect(out.propertyByStatus).toEqual([{ status: 'ACTIVE', count: 12 }])
    expect(out.userByRole).toEqual([{ role: 'TENANT', count: 40 }])
    expect(out.blockedUsers).toBe(1)
    expect(out.pendingModeration).toEqual({ properties: 3, reports: 1, reviews: 0, verifications: 2 })
    expect(out.dbStatus).toBe('ok')
    // The error ring is real (lib/errorLog.js) — shape only, it is process state.
    expect(out.errors).toHaveProperty('lastHour')
    expect(out.system.mail).toMatchObject({ provider: 'zeptomail', configured: true })
    expect(out.system.sms).toMatchObject({ configured: false })
    expect(out.system.webPush.subscriptions).toBe(5)
    expect(out.system.mobilePush.devices).toBe(7)
    expect(out.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('a dead database reads as dbStatus "error", never a throw', async () => {
    seedHappyPath()
    prismaMock.$queryRaw.mockRejectedValue(new Error('connection refused'))

    const out = await getMonitorStatus()

    expect(out.dbStatus).toBe('error')
  })

  it('a broken mail lib degrades to "unknown", and the panel still gets a payload', async () => {
    seedHappyPath()
    mailStatus.mockRejectedValueOnce(new Error('boom'))

    const out = await getMonitorStatus()

    expect(out.system.mail).toMatchObject({ provider: 'unknown', configured: false })
  })
})
