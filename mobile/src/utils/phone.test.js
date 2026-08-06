/**
 * Phone normalisation accepts every way a person actually writes a number.
 *
 * The server takes ten bare digits after a plain `.trim()`, which strips the
 * ENDS of a string and nothing else — so "98450 12345", "+91 98450 12345" and
 * "098450 12345" are all rejected, and those are the three ways people write a
 * phone number. That is what made a user report "they have a section to add
 * phone number but its not working while listing" (2026-08-01).
 *
 * `normalizePhone` already existed when that bug shipped — privately, inside
 * one component — which is exactly why Settings worked and the wizard did not.
 * The lesson recorded then was that **a helper living privately inside one
 * component is a bug waiting for the second caller**, because the divergence is
 * invisible from the file that has it. It is shared now, and this is what keeps
 * it honest.
 *
 * Mirrored by frontend/src/utils/validation.js. The two must stay in step —
 * frontend/src/.../PublishGate.test.jsx asserts the same behaviour through the
 * web field.
 */
import { normalizePhone, isValidPhone, PHONE_RE } from './phone'

describe('normalizePhone', () => {
  // Each of these is a real shape someone types, not a synthetic edge case.
  const SAME_NUMBER = [
    ['9845012345', 'already bare'],
    ['98450 12345', 'a space in the middle'],
    ['+91 98450 12345', 'country code, spaces — the old placeholder'],
    ['+919845012345', 'country code, no spaces'],
    ['91 98450 12345', 'country code without the plus'],
    ['098450 12345', 'the leading zero from landline habit'],
    ['98450-12345', 'a dash'],
    ['(98450) 12345', 'brackets'],
    ['  9845012345  ', 'padding'],
  ]

  for (const [input, shape] of SAME_NUMBER) {
    it(`reduces ${shape} to the bare number`, () => {
      expect(normalizePhone(input)).toBe('9845012345')
    })
  }

  it('survives being handed nothing', () => {
    expect(normalizePhone()).toBe('')
    expect(normalizePhone(null)).toBe('')
    expect(normalizePhone('')).toBe('')
  })
})

describe('isValidPhone', () => {
  it('accepts every shape of a real mobile number', () => {
    for (const [input] of [
      ['9845012345'], ['+91 98450 12345'], ['098450 12345'], ['98450-12345'],
    ]) {
      expect(isValidPhone(input)).toBe(true)
    }
  })

  // Indian mobile numbers start 6-9. A ten-digit number outside that range is
  // not a mobile, and accepting it here would only move the failure to the
  // server where the user cannot see it.
  it('rejects a ten-digit number that cannot be a mobile', () => {
    expect(isValidPhone('1234567890')).toBe(false)
    expect(isValidPhone('5845012345')).toBe(false)
  })

  it('rejects a number of the wrong length', () => {
    expect(isValidPhone('98450')).toBe(false)
    expect(isValidPhone('98450123456789')).toBe(false)
  })

  it('rejects letters', () => {
    expect(isValidPhone('nine eight four')).toBe(false)
  })
})

describe('the rule itself', () => {
  // The regex is duplicated across backend, web and mobile by necessity — there
  // is no shared module all three can import. Stating it here means a change on
  // one side shows up as a failure rather than as three files quietly
  // disagreeing.
  it('is the server rule, verbatim', () => {
    expect(PHONE_RE.source).toBe('^[6-9]\\d{9}$')
  })
})
