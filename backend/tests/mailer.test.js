import { describe, it, expect } from 'vitest'
import { hasQuota, sendMail } from '../src/lib/mailer.js'

describe('mailer quota logic', () => {
  const CAP = 450

  it('allows routine sends with plenty of quota left', () => {
    expect(hasQuota(0, CAP, false)).toBe(true)
    expect(hasQuota(100, CAP, false)).toBe(true)
  })

  it('reserves the last sends of the day for critical emails', () => {
    // 10-send reserve: routine emails stop at cap-10, critical continue
    expect(hasQuota(CAP - 10, CAP, false)).toBe(false)
    expect(hasQuota(CAP - 10, CAP, true)).toBe(true)
    expect(hasQuota(CAP - 1, CAP, true)).toBe(true)
  })

  it('blocks everything once the cap is reached', () => {
    expect(hasQuota(CAP, CAP, false)).toBe(false)
    expect(hasQuota(CAP, CAP, true)).toBe(false)
    expect(hasQuota(CAP + 5, CAP, true)).toBe(false)
  })

  it('routine sends resume exactly at the reserve boundary', () => {
    expect(hasQuota(CAP - 11, CAP, false)).toBe(true)
    expect(hasQuota(CAP - 10, CAP, false)).toBe(false)
  })
})

describe('sendMail without SMTP configured', () => {
  it('is a no-op that reports the email did not go out', async () => {
    // setup.js's env mock has no SMTP fields — mirrors an unconfigured deploy
    await expect(sendMail({ to: 'a@b.c', subject: 's', html: '<p>x</p>' })).resolves.toBe(false)
  })
})
