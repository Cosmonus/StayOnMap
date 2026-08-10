/**
 * The public contact form — 2026-08-10.
 *
 * Built to replace a form that had never sent anything. `handleSubmit` was
 * `e.preventDefault(); setSent(true)`, no backend route for contact existed
 * anywhere, and the success screen promised a reply within 24 hours. Two other
 * surfaces routed people to it as a real support channel.
 *
 * So the load-bearing property is not "the email is nicely formatted" — it is
 * that **success is never reported over a message that did not go anywhere.**
 * A silent failure here is indistinguishable, from the outside, from the bug
 * this endpoint was built to remove. Hence: awaited, quota pre-flighted, and a
 * false return from the mailer becomes a 503 rather than a 200.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const sendEmail = vi.fn()
const canSend = vi.fn()

vi.mock('../src/services/email.service.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, sendEmail: (...a) => sendEmail(...a), canSend: (...a) => canSend(...a) }
})

const { submitContactMessage } = await import('../src/features/contact/contact.service.js')
const { contactMessageEmail } = await import('../src/services/email.service.js')
const { CONTACT_TOPICS } = await import('../src/features/contact/contact.routes.js')

const MSG = { name: 'Asha', email: 'asha@example.com', topic: 'question', message: 'Is the Adyar flat still free?' }

beforeEach(() => {
  vi.clearAllMocks()
  canSend.mockResolvedValue(true)
  sendEmail.mockResolvedValue(true)
})

describe('submitContactMessage', () => {
  it('delivers to the support inbox and reports success only then', async () => {
    await expect(submitContactMessage(MSG)).resolves.toEqual({ delivered: true })

    expect(sendEmail).toHaveBeenCalledTimes(1)
    const [call] = sendEmail.mock.calls[0]
    expect(call.to).toBe('hello@cosmonus.com')
    expect(call.subject).toContain('Asha')
    expect(call.html).toContain('Adyar')
  })

  it('throws 503 when the mailer reports a failed send — never a silent success', async () => {
    // The original bug in one assertion: a message that went nowhere must not
    // produce the "Message sent!" screen.
    sendEmail.mockResolvedValue(false)
    await expect(submitContactMessage(MSG)).rejects.toMatchObject({ statusCode: 503, expose: true })
  })

  it('pre-flights the daily quota and never calls the mailer when it is out', async () => {
    canSend.mockResolvedValue(false)
    await expect(submitContactMessage(MSG)).rejects.toMatchObject({ statusCode: 503 })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('points the person at the direct address on every failure path', async () => {
    // A dead end is worse than the old fake success. Both failure messages must
    // carry somewhere else to go.
    canSend.mockResolvedValue(false)
    await expect(submitContactMessage(MSG)).rejects.toThrow(/hello@cosmonus\.com/)

    canSend.mockResolvedValue(true)
    sendEmail.mockResolvedValue(false)
    await expect(submitContactMessage(MSG)).rejects.toThrow(/hello@cosmonus\.com/)
  })
})

describe('contactMessageEmail', () => {
  it('escapes the body — the one template fed by an unauthenticated stranger', () => {
    const { html } = contactMessageEmail({
      ...MSG,
      name: '<script>alert(1)</script>',
      message: 'a > b & c < d "quoted"',
    })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('a &gt; b &amp; c &lt; d')
  })

  it('states the sender so a human can reply — there is no Reply-To header', () => {
    const { html } = contactMessageEmail(MSG)
    expect(html).toContain('asha@example.com')
  })
})

describe('the topic vocabulary', () => {
  it('matches the four the form offers', () => {
    // The topic reaches the SUBJECT LINE, so an open string field is a way to
    // make our own mail claim to be something it isn't.
    expect(CONTACT_TOPICS).toEqual(['question', 'report', 'partnership', 'other'])
  })

  it('is the same set the frontend renders', () => {
    const { readFileSync } = require('node:fs')
    const src = readFileSync(new URL('../../frontend/src/pages/ContactPage.jsx', import.meta.url), 'utf8')
    const block = src.split('const TOPICS = [')[1].split(']')[0]
    const values = [...block.matchAll(/value:\s*'(\w+)'/g)].map((m) => m[1])
    expect(values).toEqual(CONTACT_TOPICS)
  })
})
