import { Resend } from 'resend'
import { env } from '../config/env.js'

function getResend() {
  return new Resend(env.resendApiKey)
}

export async function sendEmail({ to, subject, html }) {
  if (!env.resendApiKey) return
  try {
    await getResend().emails.send({ from: env.resendFrom, to, subject, html })
  } catch {
    // email is best-effort — never crash the main flow
  }
}

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
      <p>You can explore other properties on <a href="https://stayonmap.com">StayOnMap</a>.</p>
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
