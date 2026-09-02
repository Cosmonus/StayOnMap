// How the owner asked to be reached to arrange a visit — Property.visitContactMethod.
// Mirrored in frontend/src/features/appointments/visitContact.js; keep the two in step.
export const VISIT_CONTACT_COPY = {
  CALL: 'a phone call',
  WHATSAPP: 'WhatsApp',
  CHAT: 'a message in the app',
}

/** "The owner prefers to arrange the visit by WhatsApp." — or null when unset. */
export function visitContactSentence(method) {
  const word = VISIT_CONTACT_COPY[method]
  return word ? `The owner prefers to arrange the visit by ${word}.` : null
}
