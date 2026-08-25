import { env } from '../config/env.js'
import { sendMail, canSend } from '../lib/mailer.js'

// Templates below; delivery lives in lib/mailer.js (plain SMTP, quota-aware).
// `critical: true` marks emails that must go out even near the daily cap —
// password resets and security alerts, never routine notifications.
export async function sendEmail({ to, subject, html, critical = false }) {
  return sendMail({ to, subject, html, critical })
}

// Re-exported so features import delivery concerns from this service rather
// than reaching into lib/mailer.js directly.
export { canSend }

// ── The shared layout ─────────────────────────────────────────────
//
// Every template below renders through this. Before it, each email was a bare
// run of <p> tags with no chrome at all — no mark, no sender, no address — so
// they read as machine output and nothing tied them to the product.
//
// EMAIL HTML IS NOT WEB HTML, and the constraints here are not stylistic:
//
//   · Tables, not flex or grid. Outlook renders through Word's engine and
//     supports neither. `role="presentation"` keeps screen readers from
//     announcing the layout as a data table.
//   · Inline styles only. <style> blocks are stripped by Gmail's clipper and
//     several mobile clients; there is no stylesheet to link.
//   · A TEXT wordmark, not an image. Most clients block remote images by
//     default, so an <img> logo is a broken-image box on first open for a large
//     share of recipients — and it would need hosting that survives a redeploy.
//     Text always renders, and it is what .claude/ui-ux.md mandates anyway:
//     "Stay" in ink, "OnMap" in jade, never an icon beside it.
//   · 600px. The width every client has handled since Outlook 2007.
//
// Colours are the real Terrain Jade tokens (mobile/src/theme/colors.js), not
// approximations, so an email and the app do not disagree about the brand.
const INK = '#1c1a16'
const MID = '#524e47'
const MUTED = '#78736a'
const LINE = '#eceae4'
const CANVAS = '#fafaf8'
const JADE = '#0d8a5f'

/** Cosmonus Pvt Ltd, in the footer of every email. A physical postal address
 *  is also what bulk-mail filters look for as a legitimacy signal. */
const COMPANY = 'Cosmonus Pvt Ltd · Gandhi Nagar, Avadi, Chennai 600054'

/**
 * @param {{ heading?: string, body: string, footNote?: string }} parts
 *   `body` is the content between the heading and the footnote — usually a
 *   bordered panel built with `panel()`.
 */
function layout({ heading, body, footNote }) {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CANVAS};margin:0;padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">

      <tr><td align="center" style="padding:8px 0 28px;">
        <span style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;letter-spacing:-0.4px;color:${INK};">Stay<span style="color:${JADE};">OnMap</span></span>
      </td></tr>

      ${heading ? `<tr><td align="center" style="padding:0 8px 24px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:19px;font-weight:600;color:${INK};">${heading}</td></tr>` : ''}

      <tr><td style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:${MID};">${body}</td></tr>

      ${footNote ? `<tr><td align="center" style="padding:24px 8px 0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:${MUTED};">${footNote}</td></tr>` : ''}

      <tr><td align="center" style="padding:32px 8px 8px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:${MUTED};border-top:1px solid ${LINE};">
        ${COMPANY}
      </td></tr>

    </table>
  </td></tr>
</table>`
}

/** The bordered card the important part of an email sits in. */
function panel(inner) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid ${LINE};border-radius:10px;">
    <tr><td style="padding:28px 24px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:${MID};">${inner}</td></tr>
  </table>`
}

/** A plain paragraph inside the layout, so callers never hand-write margins. */
const p = (html, extra = '') => `<p style="margin:0 0 14px;${extra}">${html}</p>`

/** HTML-escape anything a user typed before it lands in a template. */
const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

export function appointmentAcceptedEmail({ tenantName, propertyTitle, ownerNote }) {
  return {
    subject: `Your visit to "${propertyTitle}" is confirmed`,
    html: layout({
      heading: 'Your visit is confirmed',
      body: panel(`
      <p>Hi ${tenantName},</p>
      <p>Great news! The owner has <strong>accepted</strong> your visit request for <strong>${propertyTitle}</strong>.</p>
      ${ownerNote ? `<p>Owner's note: <em>${ownerNote}</em></p>` : ''}
      <p>Log in to StayOnMap to view the full details.</p>
      `),
    }),
  }
}

export function appointmentRejectedEmail({ tenantName, propertyTitle, ownerNote }) {
  return {
    subject: `Visit request update for "${propertyTitle}"`,
    html: layout({
      heading: 'About your visit request',
      body: panel(`
      <p>Hi ${tenantName},</p>
      <p>Unfortunately, the owner was unable to accept your visit request for <strong>${propertyTitle}</strong>.</p>
      ${ownerNote ? `<p>Reason: <em>${ownerNote}</em></p>` : ''}
      <p>You can explore other properties on <a href="${env.frontendUrl}">StayOnMap</a>.</p>
      `),
    }),
  }
}

export function adminPasswordChangedEmail({ adminName, adminEmail }) {
  const time = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })
  return {
    subject: 'StayOnMap Admin — password changed',
    html: layout({
      heading: 'Your admin password was changed',
      body: panel(`
      <p>Hi ${adminName},</p>
      <p>Your <strong>StayOnMap admin account password</strong> was changed on <strong>${time} IST</strong>.</p>
      <p>If you made this change, no action is needed.</p>
      <p>If you did <strong>not</strong> make this change, please contact your team immediately and reset your password.</p>
      <p style="color:#6b7280;font-size:12px;">This email was sent to ${adminEmail}.</p>
      `),
    }),
  }
}

export function emailVerificationEmail({ name, link }) {
  return {
    subject: 'Verify your StayOnMap email',
    html: layout({
      heading: 'Confirm your email address',
      body: panel(`
      <p>Hi ${name},</p>
      <p>Welcome to StayOnMap! Please confirm this email address by clicking the link below:</p>
      <p><a href="${link}">${link}</a></p>
      <p>This link expires in 24 hours. You can keep using StayOnMap while unverified — verifying just marks your account as trusted.</p>
      <p>If you didn't create a StayOnMap account, you can safely ignore this email.</p>
      `),
    }),
  }
}

/**
 * The sign-in code.
 *
 * THERE IS STILL NO COPY BUTTON, AND THERE CANNOT BE ONE. Email clients execute
 * no JavaScript — there is no clipboard API in Gmail, Outlook or Apple Mail and
 * no markup that reaches one. A styled "Copy" here would be a picture of a
 * button that does nothing when tapped, which is worse than none at all.
 *
 * Three things do the job instead, and between them most people never type the
 * code by hand:
 *
 *   1. IT IS FIRST IN THE SUBJECT. iOS and Gmail show the subject in the
 *      notification, so the code is readable from the lock screen without
 *      opening anything. Keep the code leading — a word in front pushes the
 *      digits out of a truncated preview.
 *   2. GMAIL OFFERS ITS OWN COPY CHIP. Android and iOS Gmail detect one-time
 *      codes from a short "sign-in code" subject plus a single isolated run of
 *      digits, and render a native copy affordance. The platform supplies the
 *      button we cannot; this template is shaped to be recognised.
 *   3. THE DIGITS ARE ISOLATED. Alone in their own cell with generous padding,
 *      so press-and-hold selects the code and not the sentence around it.
 *
 * The expiry is INTERPOLATED, never a literal. It is 10 minutes
 * (auth.service.js's OTP_TTL_MS) and a hardcoded "15" here would promise time
 * the code does not have.
 */
export function loginOtpEmail({ name, code, ttlMinutes }) {
  return {
    // The code stays FIRST in the subject. See note 1 above.
    subject: `${code} is your StayOnMap sign-in code`,
    html: layout({
      heading: `Please verify your identity, ${name}`,
      body: panel(`
        ${p('Here is your StayOnMap authentication code:')}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td align="center" style="padding:10px 0 6px;">
            <span style="display:inline-block;font-family:Consolas,'SF Mono',Menlo,monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:${INK};background:${CANVAS};border:1px solid ${LINE};border-radius:8px;padding:16px 16px 16px 26px;">${code}</span>
          </td></tr>
          <tr><td align="center" style="padding:0 0 20px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:${MUTED};">Press and hold to copy</td></tr>
        </table>
        ${p(`This code is valid for <strong>${ttlMinutes} minutes</strong> and can only be used once.`)}
        ${p(`<strong>Please don't share this code with anyone</strong> — we'll never ask for it on the phone or by email.`, 'margin:0;')}
      `),
      footNote: `You're receiving this email because a sign-in code was requested for your StayOnMap account.<br />If this wasn't you, you can safely ignore it — nobody can reach your account with this email alone.`,
    }),
  }
}

export function passwordResetEmail({ name, link }) {
  return {
    subject: 'Reset your StayOnMap password',
    html: layout({
      heading: 'Reset your password',
      body: panel(`
      <p>Hi ${name},</p>
      <p>We received a request to reset your StayOnMap password. Click the link below to choose a new one:</p>
      <p><a href="${link}">${link}</a></p>
      <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email — your password will not be changed.</p>
      `),
    }),
  }
}

export function passwordChangedEmail({ name }) {
  const time = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })
  return {
    subject: 'Your StayOnMap password was changed',
    html: layout({
      heading: 'Your password was changed',
      body: panel(`
      <p>Hi ${name},</p>
      <p>Your StayOnMap password was changed on <strong>${time} IST</strong>, and you've been signed out of all other devices.</p>
      <p>If this was you, no action is needed.</p>
      <p>If it wasn't, reset your password immediately from the login screen — the reset link goes only to this inbox.</p>
      `),
    }),
  }
}

export function accountLinkedEmail({ name, providerLabel }) {
  return {
    subject: `${providerLabel} was linked to your StayOnMap account`,
    html: layout({
      heading: 'A sign-in method was linked',
      body: panel(`
      <p>Hi ${name},</p>
      <p><strong>${providerLabel}</strong> can now be used to sign in to your StayOnMap account.</p>
      <p>If you didn't link it, remove it under Settings → Linked accounts and reset your password.</p>
      `),
    }),
  }
}

/**
 * The public contact form, delivered to the support inbox.
 *
 * The ONLY template here fed by an unauthenticated stranger, which is why it is
 * the only one that escapes. Every other template interpolates values that
 * already passed through registration or a listing form and are rendered back
 * to the person who wrote them; this one renders an anonymous body into an
 * inbox we read. `<img src=x onerror=…>` in a message field is not an XSS in a
 * mail client the way it is in a browser, but "the input is not attacker-shaped"
 * is not a property this endpoint has, so it is escaped rather than trusted.
 *
 * There is no Reply-To: `sendMail` takes { to, subject, html, critical } and
 * adding a header would mean touching all four provider paths for one caller.
 * The sender's address is stated in the body instead, which is what a human
 * replying actually needs.
 */
export function contactMessageEmail({ name, email, topic, message }) {
  const TOPIC_LABELS = {
    question:    'A question',
    report:      'Report a listing',
    partnership: 'Partnership',
    other:       'Something else',
  }
  const label = TOPIC_LABELS[topic] ?? topic

  return {
    subject: `[${label}] Contact form — ${name}`,
    html: layout({
      heading: 'New message from the contact form',
      body: panel(`
      ${p(`<strong>From:</strong> ${esc(name)} &lt;${esc(email)}&gt;`)}
      ${p(`<strong>Topic:</strong> ${esc(label)}`)}
      <hr style="border:none;border-top:1px solid ${LINE};margin:18px 0;" />
      <p style="margin:0;white-space:pre-wrap;">${esc(message)}</p>
      `),
      footNote: `Reply directly to ${esc(email)}.`,
    }),
  }
}

/**
 * To every admin when an owner submits a listing for review. The queue only
 * tells staff what is waiting once they are already looking at it; a listing
 * sitting in PENDING for days because nobody opened the panel is a host who
 * concludes the platform is dead. Title and owner name are owner-typed, so
 * they are escaped like the contact form's fields.
 */
export function listingSubmittedEmail({ propertyTitle, propertyType, city, ownerName, reviewLink, resubmitted }) {
  const verb = resubmitted ? 'resubmitted' : 'submitted'
  return {
    subject: `[Review] ${resubmitted ? 'Resubmitted' : 'New'} listing — ${propertyTitle}`,
    html: layout({
      heading: `A listing was ${verb} for review`,
      body: panel(`
      ${p(`<strong>${esc(propertyTitle)}</strong>`)}
      ${p(`${esc(propertyType)} · ${esc(city)}`)}
      ${p(`<strong>Owner:</strong> ${esc(ownerName)}`)}
      ${p(`<a href="${esc(reviewLink)}" style="color:${JADE};font-weight:600;">Open it in the review queue</a>`, 'margin-top:20px;')}
      `),
      footNote: 'Sent to every StayOnMap admin. It waits in the queue until someone approves or rejects it.',
    }),
  }
}

export function verificationUpdateEmail({ ownerName, propertyTitle, status, adminNote }) {
  const statusLabel = status === 'VERIFIED' ? 'approved' : status === 'REJECTED' ? 'rejected' : 'updated'
  return {
    subject: `Verification ${statusLabel} for "${propertyTitle}"`,
    html: layout({
      heading: 'Your listing verification',
      body: panel(`
      <p>Hi ${ownerName},</p>
      <p>Your ownership verification for <strong>${propertyTitle}</strong> has been <strong>${statusLabel}</strong>.</p>
      ${adminNote ? `<p>Note: <em>${adminNote}</em></p>` : ''}
      <p>Log in to StayOnMap to view the details.</p>
      `),
    }),
  }
}
