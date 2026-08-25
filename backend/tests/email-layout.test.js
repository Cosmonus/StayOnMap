// Every email renders through the shared layout.
//
// Before it, each template was a bare run of <p> tags — no mark, no sender, no
// address — so they read as machine output and nothing tied them to the
// product. The risk now is the opposite one: a NEW template written the old way
// and shipped looking nothing like the other nine, which nobody notices because
// emails are the one surface you never see while developing.
//
// The email-HTML rules asserted here are not stylistic. Outlook renders through
// Word's engine (no flex, no grid), Gmail strips <style> blocks, and most
// clients block remote images by default — so a <img> logo is a broken-image
// box on first open for a large share of recipients.
import { describe, it, expect, vi } from 'vitest'

// importActual: tests/setup.js mocks this module globally so every other suite
// gets a no-op sendEmail. A plain import would assert against the stub.
const mod = await vi.importActual('../src/services/email.service.js')

/** Every exported template, called with plausible arguments. */
const RENDERED = [
  ['appointmentAccepted', mod.appointmentAcceptedEmail({ tenantName: 'Asha', propertyTitle: 'A flat', ownerNote: 'See you' })],
  ['appointmentRejected', mod.appointmentRejectedEmail({ tenantName: 'Asha', propertyTitle: 'A flat', ownerNote: null })],
  ['adminPasswordChanged', mod.adminPasswordChangedEmail({ adminName: 'Root', adminEmail: 'a@b.c' })],
  ['emailVerification', mod.emailVerificationEmail({ name: 'Asha', link: 'https://www.stayonmap.com/verify-email?token=x' })],
  ['loginOtp', mod.loginOtpEmail({ name: 'Asha', code: '482913', ttlMinutes: 10 })],
  ['passwordReset', mod.passwordResetEmail({ name: 'Asha', link: 'https://www.stayonmap.com/reset-password?token=x' })],
  ['passwordChanged', mod.passwordChangedEmail({ name: 'Asha' })],
  ['accountLinked', mod.accountLinkedEmail({ name: 'Asha', providerLabel: 'Google' })],
  ['verificationUpdate', mod.verificationUpdateEmail({ ownerName: 'Asha', propertyTitle: 'A flat', status: 'VERIFIED', adminNote: null })],
  ['listingSubmitted', mod.listingSubmittedEmail({ propertyTitle: 'A flat', propertyType: 'APARTMENT', city: 'Chennai', ownerName: 'Asha', reviewLink: 'https://www.stayonmap.com/admin?tab=review-listings&propertyId=p1', resubmitted: false })],
]

describe('every email uses the shared layout', () => {
  it.each(RENDERED)('%s carries the wordmark and the company address', (_name, mail) => {
    expect(mail.html).toContain('OnMap')
    expect(mail.html).toContain('Cosmonus Pvt Ltd')
    expect(mail.html).toContain('Chennai 600054')
  })

  it.each(RENDERED)('%s has a subject', (_name, mail) => {
    expect(mail.subject.trim().length).toBeGreaterThan(0)
  })
})

describe('email HTML stays inside what clients actually render', () => {
  it.each(RENDERED)('%s uses tables, not flex or grid — Outlook supports neither', (_name, mail) => {
    expect(mail.html).toContain('<table')
    expect(mail.html).not.toMatch(/display\s*:\s*(flex|grid)/)
  })

  it.each(RENDERED)('%s ships no <style> block or class — Gmail strips both', (_name, mail) => {
    expect(mail.html).not.toMatch(/<style|class=/i)
  })

  it.each(RENDERED)('%s embeds no remote image', (_name, mail) => {
    // Blocked by default in most clients, so the logo is TEXT. An <img> here
    // would be a broken-image box on first open — and would need hosting that
    // survives a redeploy.
    expect(mail.html).not.toMatch(/<img/i)
  })

  it.each(RENDERED)('%s contains nothing that needs JavaScript', (_name, mail) => {
    // No client executes it. A copy button, a collapsible, an onclick — all
    // would be dead pixels.
    expect(mail.html).not.toMatch(/<script|onclick=|navigator\.clipboard/i)
  })

  it.each(RENDERED)('%s marks layout tables as presentational for screen readers', (_name, mail) => {
    expect(mail.html).toContain('role="presentation"')
  })
})

describe('the layout is not optional', () => {
  it('leaves no template rendering bare paragraphs', () => {
    // A new template written the old way would still "work" and would look
    // nothing like the other nine. This is the assertion that catches it.
    const bare = RENDERED.filter(([, mail]) => !mail.html.includes('Cosmonus Pvt Ltd'))
    expect(bare.map(([name]) => name)).toEqual([])
  })
})
