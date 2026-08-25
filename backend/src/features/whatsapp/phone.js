// One phone-number vocabulary for the WhatsApp feature.
//
// Meta identifies a user by `wa_id`: E.164 digits with no plus sign
// ("919876543210"). User.phone on this platform is the 10-digit Indian mobile
// ("9876543210", validated by /^[6-9]\d{9}$/ everywhere else). The two are the
// same number written twice, and every bug in a phone-keyed system is a lookup
// that used one form against a column holding the other — so both forms are
// derived HERE, from one normaliser, and nowhere else.

const INDIA_CC = '91'

/**
 * Anything a person or Meta might send → E.164 digits, or null if it cannot
 * be an Indian mobile. Accepts "+91 98765 43210", "09876543210", "9876543210",
 * "919876543210", with any spaces, dashes or brackets.
 */
export function toE164(input) {
  if (input == null) return null
  let digits = String(input).replace(/\D/g, '')
  if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1)
  if (digits.length === 10) digits = INDIA_CC + digits
  if (digits.length !== 12 || !digits.startsWith(INDIA_CC)) return null
  if (!/^[6-9]/.test(digits.slice(2))) return null
  return digits
}

/** The 10-digit form User.phone stores. */
export function toLocal(e164) {
  const full = toE164(e164)
  return full ? full.slice(INDIA_CC.length) : null
}

/** "+91 98765 43210" — for anything a human reads. */
export function toDisplay(e164) {
  const local = toLocal(e164)
  return local ? `+${INDIA_CC} ${local.slice(0, 5)} ${local.slice(5)}` : null
}

/** "+91 •••••43210" — the admin list and every log line. */
export function toMasked(e164) {
  const local = toLocal(e164)
  return local ? `+${INDIA_CC} •••••${local.slice(5)}` : null
}
