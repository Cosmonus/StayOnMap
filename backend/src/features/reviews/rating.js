// The 12 category ratings a review carries, and the one number they average
// into. This list existed as three separate copies (host, admin, ai) before
// this file; it is shared now because the auto-approval threshold below is
// decided from it — a drifted copy would move the line between "published" and
// "waiting for a moderator" without anything failing.
export const RATING_FIELDS = [
  'ratingsSafety', 'ratingsClean', 'ratingsWater', 'ratingsNoise',
  'ratingsInternet', 'ratingsParking', 'ratingsNeighborhood', 'ratingsTransport',
  'ratingsMaintenance', 'ratingsOwnerBehavior', 'ratingsSecurity', 'ratingsPowerBackup',
]

// Null when a review carries no ratings at all — distinct from a low average,
// and the caller must not treat the two the same.
export function averageRating(review) {
  const values = RATING_FIELDS.map((f) => review?.[f]).filter((v) => typeof v === 'number')
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}
