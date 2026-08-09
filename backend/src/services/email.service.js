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

export function appointmentAcceptedEmail({ tenantName, propertyTitle, ownerNote }) {
  return {
    subject: `Your visit to "${propertyTitle}" is confirmed`,
    html: `
      <p>Hi ${tenantName},</p>
      <p>Great news! The owner has <strong>accepted</strong> your visit request for <strong>${propertyTitle}</strong>.</p>
      ${ownerNote ? `<p>Owner's note: <em>${ownerNote}</em></p>` : ''}
      <p>Log in to StayOnMap to view the full details.</p>
    `,
  }
}

export function appointmentRejectedEmail({ tenantName, propertyTitle, ownerNote }) {
  return {
    subject: `Visit request update for "${propertyTitle}"`,
    html: `
      <p>Hi ${tenantName},</p>
      <p>Unfortunately, the owner was unable to accept your visit request for <strong>${propertyTitle}</strong>.</p>
      ${ownerNote ? `<p>Reason: <em>${ownerNote}</em></p>` : ''}
      <p>You can explore other properties on <a href="${env.frontendUrl}">StayOnMap</a>.</p>
    `,
  }
}

export function adminPasswordChangedEmail({ adminName, adminEmail }) {
  const time = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })
  return {
    subject: 'StayOnMap Admin — password changed',
    html: `
      <p>Hi ${adminName},</p>
      <p>Your <strong>StayOnMap admin account password</strong> was changed on <strong>${time} IST</strong>.</p>
      <p>If you made this change, no action is needed.</p>
      <p>If you did <strong>not</strong> make this change, please contact your team immediately and reset your password.</p>
      <p style="color:#6b7280;font-size:12px;">This email was sent to ${adminEmail}.</p>
    `,
  }
}

export function emailVerificationEmail({ name, link }) {
  return {
    subject: 'Verify your StayOnMap email',
    html: `
      <p>Hi ${name},</p>
      <p>Welcome to StayOnMap! Please confirm this email address by clicking the link below:</p>
      <p><a href="${link}">${link}</a></p>
      <p>This link expires in 24 hours. You can keep using StayOnMap while unverified — verifying just marks your account as trusted.</p>
      <p>If you didn't create a StayOnMap account, you can safely ignore this email.</p>
    `,
  }
}

/**
 * The sign-in code.
 *
 * THERE IS NO COPY BUTTON, AND THERE CANNOT BE ONE. Email clients do not
 * execute JavaScript — there is no clipboard API in Gmail, Outlook or Apple
 * Mail, and no markup that reaches one. Anything that looked like a copy button
 * here would be a picture of a button that did nothing when tapped, which is
 * worse than not having one.
 *
 * What actually gets a code into someone's hands, in order of how much it
 * helps:
 *
 *   1. THE CODE IN THE SUBJECT LINE. Already here, and it is the whole game:
 *      iOS and Gmail surface the subject in the notification, so most people
 *      read the code off the lock screen and never open the email at all.
 *      Keep `${code}` first in the subject — a leading word pushes it out of
 *      the truncated preview on a narrow screen.
 *   2. A RECOGNISABLE SHAPE. Gmail on Android and iOS detect one-time-code
 *      emails heuristically and offer their own native "Copy code" chip. A
 *      short subject saying "sign-in code" and a single isolated run of digits
 *      is what they match on — so the platform provides the button we cannot.
 *   3. EASY TO SELECT BY HAND. The code sits alone in a padded block with
 *      nothing adjacent, so a long-press selects the digits and only the
 *      digits. Previously it was bare text on a line: a long-press picked up
 *      the surrounding paragraph as often as not.
 *
 * `letter-spacing` does not affect what gets copied — the clipboard receives
 * the characters, not the tracking.
 */
export function loginOtpEmail({ name, code, ttlMinutes }) {
  return {
    // `${code}` stays FIRST. See note 1 above.
    subject: `${code} is your StayOnMap sign-in code`,
    html: `
      <p>Hi ${name},</p>
      <p>Use this code to sign in to StayOnMap:</p>
      <p style="margin:24px 0;">
        <span style="display:inline-block;font-family:Consolas,'SF Mono',Menlo,monospace;font-size:30px;font-weight:700;letter-spacing:8px;color:#0a6e4b;background:#edfaf7;border:1px solid #d0f3e8;border-radius:8px;padding:14px 16px 14px 24px;">${code}</span>
      </p>
      <p style="font-size:13px;color:#57534a;margin-top:-8px;">Press and hold to copy. The code is in this email's subject line too.</p>
      <p>It expires in ${ttlMinutes} minutes and can only be used once.</p>
      <p>If you didn't try to sign in, you can safely ignore this email — nobody can access your account with this email alone, and your password is unchanged.</p>
    `,
  }
}

export function passwordResetEmail({ name, link }) {
  return {
    subject: 'Reset your StayOnMap password',
    html: `
      <p>Hi ${name},</p>
      <p>We received a request to reset your StayOnMap password. Click the link below to choose a new one:</p>
      <p><a href="${link}">${link}</a></p>
      <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email — your password will not be changed.</p>
    `,
  }
}

export function passwordChangedEmail({ name }) {
  const time = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })
  return {
    subject: 'Your StayOnMap password was changed',
    html: `
      <p>Hi ${name},</p>
      <p>Your StayOnMap password was changed on <strong>${time} IST</strong>, and you've been signed out of all other devices.</p>
      <p>If this was you, no action is needed.</p>
      <p>If it wasn't, reset your password immediately from the login screen — the reset link goes only to this inbox.</p>
    `,
  }
}

export function accountLinkedEmail({ name, providerLabel }) {
  return {
    subject: `${providerLabel} was linked to your StayOnMap account`,
    html: `
      <p>Hi ${name},</p>
      <p><strong>${providerLabel}</strong> can now be used to sign in to your StayOnMap account.</p>
      <p>If you didn't link it, remove it under Settings → Linked accounts and reset your password.</p>
    `,
  }
}

export function verificationUpdateEmail({ ownerName, propertyTitle, status, adminNote }) {
  const statusLabel = status === 'VERIFIED' ? 'approved' : status === 'REJECTED' ? 'rejected' : 'updated'
  return {
    subject: `Verification ${statusLabel} for "${propertyTitle}"`,
    html: `
      <p>Hi ${ownerName},</p>
      <p>Your ownership verification for <strong>${propertyTitle}</strong> has been <strong>${statusLabel}</strong>.</p>
      ${adminNote ? `<p>Note: <em>${adminNote}</em></p>` : ''}
      <p>Log in to StayOnMap to view the details.</p>
    `,
  }
}
