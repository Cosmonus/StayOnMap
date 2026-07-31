// Indian mobile numbers, normalised before they are validated or sent.
//
// The server's rule (users.validation.js) is /^[6-9]\d{9}$/ applied after a
// plain .trim() — which strips the ENDS of a string and nothing else. So
// "98450 12345", "+91 98450 12345" and "098450 12345" are all rejected, and
// those are the three ways people actually write a phone number. Normalising
// here is what turns "the field doesn't work" into "the field works".
//
// Mirrored in frontend/src/utils/validation.js — keep the two in step.

export const PHONE_RE = /^[6-9]\d{9}$/

/**
 * Reduce anything a person might type to the bare 10-digit number.
 * Handles spaces, dashes, dots, brackets, a +91 / 91 country code, and the
 * leading 0 people carry over from landline habit.
 */
export function normalizePhone(raw = '') {
  const digits = String(raw).replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1)
  return digits
}

/** True only for what the server will actually accept. */
export const isValidPhone = (phone) => PHONE_RE.test(normalizePhone(phone))
