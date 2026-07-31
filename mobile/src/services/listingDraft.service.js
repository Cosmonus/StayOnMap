// The add-listing wizard's unfinished draft, server side, so it follows the
// person rather than the phone. There is no id in any of these paths — the
// draft is keyed by whoever the token says you are.
import { api } from '@lib/api'

export const listingDraftService = {
  // Resolves to the envelope ({ categoryKey, stepIdx, stepKey, draft, at }) or
  // null when there is nothing worth resuming. null is a normal answer here.
  get: () => api.get('/listing-draft'),

  put: (envelope) => api.put('/listing-draft', envelope),

  remove: () => api.delete('/listing-draft'),
}
