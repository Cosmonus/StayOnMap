import crypto from 'crypto'

/**
 * Property type → prefix mapping
 */
const PROPERTY_PREFIX = {
  APARTMENT:        'APT',
  HOUSE:            'HSE',
  VILLA:            'VLA',
  PG:               'PGG',
  INDEPENDENT_HOUSE:'IND',
  COMMERCIAL:       'COM',
}

/**
 * Generate 16 random digits as a string
 */
function randomDigits(len = 16) {
  let digits = ''
  while (digits.length < len) {
    digits += crypto.randomInt(0, 10).toString()
  }
  return digits
}

/**
 * Extract a 3-char prefix from a name or email
 * "Sri Gokul" → "SRI", "ravi@mail.com" → "RAV", fallback → "USR"
 */
function namePrefix(name, email) {
  const raw = (name || email?.split('@')[0] || 'USR').replace(/[^a-zA-Z]/g, '')
  return (raw.slice(0, 3) || 'USR').toUpperCase()
}

/**
 * Generate a property display ID
 * @param {string} type - PropertyType enum value (e.g. 'APARTMENT')
 * @returns {string} e.g. "APT-8294017356482910"
 */
export function generatePropertyDisplayId(type) {
  const prefix = PROPERTY_PREFIX[type] ?? 'PRP'
  return `${prefix}-${randomDigits(16)}`
}

/**
 * Generate a user display ID
 * @param {string} name - User's name
 * @param {string} email - User's email (fallback)
 * @returns {string} e.g. "SRI-7382910564738291"
 */
export function generateUserDisplayId(name, email) {
  const prefix = namePrefix(name, email)
  return `${prefix}-${randomDigits(16)}`
}
