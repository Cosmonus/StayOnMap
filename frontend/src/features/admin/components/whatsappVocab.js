// One home for the WhatsApp admin words — the section, the funnel tab and the
// detail panel all read these, and two copies is how labels drift.

export const STATUS_WORD = {
  START: 'Starting', PROPERTY_TYPE: 'Choosing type', QUESTIONNAIRE: 'Answering', LOCATION: 'Sharing location',
  PHOTOS: 'Sending photos', REVIEW: 'Reviewing', CONFIRMATION: 'Publishing', AWAITING_PROFILE: 'Waiting on profile', VERIFICATION: 'Awaiting review',
  COMPLETED: 'Live', CANCELLED: 'Cancelled',
}

export const STEP_LABEL = {
  wa_conversation_started: 'Started', wa_type_selected: 'Chose type', wa_questionnaire_started: 'Began questions',
  wa_location_submitted: 'Location confirmed', wa_photos_submitted: 'Photos sent', wa_draft_completed: 'Draft complete',
  wa_review_shown: 'Saw review', wa_publish_confirmed: 'Pressed publish', wa_verification_passed: 'Approved',
  wa_listing_published: 'Told it is live',
}

export const FAILURE_LABEL = {
  wa_extraction_failed: 'Not understood', wa_location_failed: 'Location failed', wa_photo_failed: 'Photo failed',
  wa_verification_failed: 'Rejected', wa_publish_failed: 'Publish failed', wa_conversation_cancelled: 'Cancelled',
}

// The question ids a conversation can be stuck on, as a person would say them.
// Anything unmapped falls back to the raw id — honest, if terse.
export const QUESTION_WORD = {
  location: 'Sharing the location', photos: 'Sending photos', rent: 'Monthly rent', deposit: 'Deposit',
  bhk: 'Bedrooms', furnished: 'Furnishing', amenities: 'Amenities', rules: 'House rules', details: 'Extra details',
  bathrooms: 'Bathrooms', availableFrom: 'Available from', houseStyle: 'House type', sharing: 'Room sharing',
  nightlyRate: 'Nightly rate', maxGuests: 'Guest limit', extent: 'Plot size', landType: 'Land type',
  commercialType: 'Commercial type', carpetArea: 'Carpet area',
  visitContact: 'How renters contact them', visitFrom: 'Visits from', visitUntil: 'Visits until',
}

export const ago = (iso) => {
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.round(ms / 60_000)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 48) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}
