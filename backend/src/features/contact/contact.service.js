// The public contact form's one job: put a stranger's message in the support
// inbox, and tell them honestly whether that worked.
//
// It replaced `e.preventDefault(); setSent(true)` — a form that had never sent
// anything anywhere while its success screen promised a reply within 24 hours,
// and which two other surfaces (the dashboard Support card, the page's own FAQ)
// routed people to as a real channel.
import { sendEmail, canSend, contactMessageEmail } from '../../services/email.service.js'
import { env } from '../../config/env.js'

export async function submitContactMessage({ name, email, topic, message }) {
  // Pre-flight the quota, exactly as the OTP path does. Unlike that one there
  // is no enumeration angle here (nothing is looked up), so this is purely so
  // an out-of-quota day fails as a 503 the form can show rather than as a
  // success screen over a message that went nowhere.
  if (!(await canSend())) {
    throw Object.assign(
      new Error('We cannot send messages right now. Please email hello@cosmonus.com directly.'),
      { statusCode: 503, expose: true }
    )
  }

  // AWAITED, and not best-effort. Every other sendEmail call in this codebase
  // is fire-and-forget because it accompanies a state change that already
  // happened — here the email IS the state change. There is no row, no queue
  // and no retry: if this returns false the message is gone, and saying "sent"
  // over that is the exact lie this endpoint was built to remove.
  const sent = await sendEmail({
    to: env.supportEmail,
    ...contactMessageEmail({ name, email, topic, message }),
  })

  if (!sent) {
    throw Object.assign(
      new Error('Your message could not be sent. Please email hello@cosmonus.com directly.'),
      { statusCode: 503, expose: true }
    )
  }

  return { delivered: true }
}
