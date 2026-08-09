// The sign-in code email.
//
// Pinned because the things that make an OTP usable are invisible and easy to
// undo. The single biggest one is the code being FIRST in the subject: iOS and
// Gmail show the subject in the notification, so most people read the code off
// the lock screen and never open the email. Putting a word in front of it —
// "Your code is 123456" — pushes the digits out of the truncated preview on a
// narrow screen and quietly costs that, with nothing failing.
import { describe, it, expect, vi } from 'vitest'

// importActual, not a plain import: tests/setup.js mocks this whole module
// globally (every other suite wants sendEmail to be a no-op), so a normal
// import here would assert against `{ subject: 'test', html: 'test' }` and pass
// no matter what the real template said.
const { loginOtpEmail } = await vi.importActual('../src/services/email.service.js')

const mail = () => loginOtpEmail({ name: 'Asha', code: '482913', ttlMinutes: 10 })

describe('loginOtpEmail', () => {
  it('starts the subject with the code, so it survives notification truncation', () => {
    expect(mail().subject.startsWith('482913')).toBe(true)
  })

  it('keeps the subject short enough to not truncate before the code is read', () => {
    // iOS notifications show roughly 40-50 characters of subject.
    expect(mail().subject.length).toBeLessThanOrEqual(50)
  })

  it('says "sign-in code" — the phrase Gmail matches to offer its own copy chip', () => {
    // We cannot render a copy button; the platform can, and this is what it
    // looks for.
    expect(mail().subject.toLowerCase()).toContain('sign-in code')
  })

  it('puts the code in the body exactly once, isolated', () => {
    // Repeating it gives a long-press two things to grab and makes the
    // platform's own detection less certain.
    const occurrences = mail().html.split('482913').length - 1
    expect(occurrences).toBe(1)
  })

  it('carries no button that cannot work', () => {
    // Email clients execute no JavaScript. A styled "Copy" affordance here
    // would be a picture of a button that does nothing when tapped.
    const { html } = mail()
    expect(html).not.toMatch(/<button|onclick|navigator\.clipboard|<script/i)
  })

  it('states the expiry it was given rather than a hardcoded number', () => {
    expect(loginOtpEmail({ name: 'A', code: '1', ttlMinutes: 7 }).html).toContain('7 minutes')
  })

  it('still reassures someone who did not ask for it', () => {
    // The wording is allowed to change; the reassurance is not. An OTP arriving
    // unrequested is alarming, and "ignore it, your account is not reachable
    // with this alone" is the whole job of that paragraph.
    const { html } = mail()
    expect(html).toMatch(/wasn't you/i)
    expect(html).toMatch(/ignore/i)
  })

  it('renders through the shared layout — wordmark, panel, company footer', () => {
    const { html } = mail()
    expect(html).toContain('OnMap')                       // the text wordmark
    expect(html).toContain('Cosmonus Pvt Ltd')            // postal address
    expect(html).toContain('Gandhi Nagar, Avadi, Chennai 600054')
    expect(html).toMatch(/Please verify your identity, Asha/)
  })

  it('states the REAL expiry, never a hardcoded one', () => {
    // auth.service.js sends 10. A literal "15" in the template would promise
    // time the code does not have and produce "it said it was valid" tickets.
    expect(mail().html).toContain('10 minutes')
    expect(mail().html).not.toContain('15 minutes')
  })
})
