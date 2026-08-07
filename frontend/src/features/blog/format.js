// Dates on articles, in one place so a card and an article byline can never
// disagree about how a date looks.
//
// en-IN, and the day before the month — an Indian reader reads "7 August 2026"
// without pausing, and "August 7, 2026" reads as a foreign document on a site
// about Indian rentals.
const FORMAT = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

export function formatPostDate(value) {
  if (!value) return ''
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : FORMAT.format(d)
}

/**
 * "Updated" is only worth showing when it says something the published date
 * does not. An article published and updated on the same day showing both
 * dates is noise that also quietly implies it needed correcting.
 */
export function showsUpdated(post) {
  return Boolean(post?.updatedAt) && post.updatedAt !== post.publishedAt
}
