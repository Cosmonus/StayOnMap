/**
 * Mailer tests
 *
 * What each suite guards against:
 *   hasQuota    — the critical reserve actually holds back the last sends of
 *                 the day, so routine notifications can't starve password
 *                 resets / login codes
 *   parseFrom   — MAIL_FROM splits correctly for Brevo's API, which (unlike
 *                 SMTP) needs name and email as separate fields
 *   provider    — MAIL_PROVIDER routes to the right transport, an
 *                 unconfigured provider is a no-op rather than a throw, and a
 *                 provider failure returns false rather than propagating
 *                 (every caller treats sendMail as best-effort; OTP login is
 *                 the one that inspects the boolean)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { hasQuota, parseFrom, sendMail, canSend } from '../src/lib/mailer.js'
import { env } from '../src/config/env.js'

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

describe('parseFrom', () => {
  it('splits a display-name address into the parts Brevo needs', () => {
    expect(parseFrom('StayOnMap <no-reply@stayonmap.com>')).toEqual({
      name: 'StayOnMap',
      email: 'no-reply@stayonmap.com',
    })
  })

  it('handles a bare address with no display name', () => {
    expect(parseFrom('no-reply@stayonmap.com')).toEqual({ email: 'no-reply@stayonmap.com' })
    // name must be absent, not empty — Brevo rejects an empty sender.name
    expect(parseFrom('<no-reply@stayonmap.com>').name).toBeUndefined()
  })
})

describe('sendMail with no provider configured', () => {
  it('is a no-op that reports the email did not go out', async () => {
    // setup.js's env mock has no SMTP/Brevo fields — mirrors an unconfigured deploy
    await expect(sendMail({ to: 'a@b.c', subject: 's', html: '<p>x</p>' })).resolves.toBe(false)
  })

  it('canSend is false, so OTP login degrades instead of hanging', async () => {
    await expect(canSend(true)).resolves.toBe(false)
  })
})

describe('MAIL_PROVIDER=brevo', () => {
  beforeEach(() => {
    env.mailProvider = 'brevo'
    env.brevoApiKey = 'test-key'
    env.mailFrom = 'StayOnMap <no-reply@stayonmap.com>'
    env.mailDailyCap = 300
  })

  afterEach(() => {
    // Restore every field this block mutates — mailDailyCap in particular,
    // since one case drops it to 0 and a leak would silently disable later tests.
    env.mailProvider = 'smtp'
    env.brevoApiKey = null
    env.mailDailyCap = 450
    vi.unstubAllGlobals()
  })

  it('posts to Brevo over HTTPS and reports success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201 })
    vi.stubGlobal('fetch', fetchMock)

    await expect(sendMail({ to: 'a@b.c', subject: 'Hi', html: '<p>x</p>', critical: true })).resolves.toBe(true)

    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.brevo.com/v3/smtp/email')
    expect(opts.headers['api-key']).toBe('test-key')
    const body = JSON.parse(opts.body)
    expect(body.sender).toEqual({ name: 'StayOnMap', email: 'no-reply@stayonmap.com' })
    expect(body.to).toEqual([{ email: 'a@b.c' }])
    expect(body.htmlContent).toBe('<p>x</p>')
  })

  it('returns false (never throws) when Brevo rejects the send', async () => {
    // The whole app treats sendMail as best-effort; a throw here would surface
    // as a 500 on unrelated flows like appointment acceptance.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 401, text: () => Promise.resolve('unauthorized'),
    }))

    await expect(sendMail({ to: 'a@b.c', subject: 's', html: '<p>x</p>' })).resolves.toBe(false)
  })

  it('returns false when the request times out or the network fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timed out')))

    await expect(sendMail({ to: 'a@b.c', subject: 's', html: '<p>x</p>' })).resolves.toBe(false)
  })

  it('never touches the network once the daily cap is exhausted', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    env.mailDailyCap = 0

    await expect(sendMail({ to: 'a@b.c', subject: 's', html: '<p>x</p>', critical: true })).resolves.toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('canSend is true when configured with quota left', async () => {
    await expect(canSend(true)).resolves.toBe(true)
  })

  it('canSend is false when the API key is missing, so OTP 503s cleanly', async () => {
    env.brevoApiKey = null
    await expect(canSend(true)).resolves.toBe(false)
  })
})
