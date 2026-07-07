import { env } from '../config/env.js'
import { sendMail } from '../lib/mailer.js'

// Templates below; delivery lives in lib/mailer.js (plain SMTP, quota-aware).
// `critical: true` marks emails that must go out even near the daily cap —
// password resets and security alerts, never routine notifications.
export async function sendEmail({ to, subject, html, critical = false }) {
  return sendMail({ to, subject, html, critical })
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
