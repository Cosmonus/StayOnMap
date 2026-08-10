// What a FraudSignal means, in words a moderator can act on.
//
// Resolved server-side rather than in a client table, for the same reason the
// review integrity labels are: the vocabulary belongs beside the checks that
// produce it, and a hand-written client map silently renders our internal enum
// name at whoever is moderating when it misses a key (see .claude/ui-ux.md,
// "Any enum-keyed config must cover its whole enum").
//
// Every value of FraudSignalType must appear here —
// backend/tests/enum-config-parity.test.js reads schema.prisma and fails
// naming the value if one does not.
export const FRAUD_SIGNAL_LABELS = {
  DUPLICATE_ADDRESS:   'Same address as another listing',
  SIMILAR_GEOLOCATION: 'Another listing within 50m',
  REUSED_IMAGES:       'Photos already uploaded by someone else',
  SAME_CONTACT:        'Owner phone shared with another account',
  SIMILAR_DESCRIPTION: 'Description closely matches another listing',
  AI_FLAGGED:          'Flagged by the AI fraud scan',
}

export function labelFraudSignal(type) {
  return FRAUD_SIGNAL_LABELS[type] ?? type
}
