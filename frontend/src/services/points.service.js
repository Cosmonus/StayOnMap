import { api } from '@lib/api'

// The private points ledger. `PointsCard` called `api.get('/points')` inline
// until 2026-08-10 — the only user-facing component in the app reaching for the
// axios instance directly rather than going through a service.
//
// It is one line either way, which is exactly why it is worth being strict
// about: the rule ("all API calls go through services/") is only useful while
// it holds everywhere, and a single exception is what a second one gets
// justified against.
export const pointsService = {
  getSummary: () => api.get('/points'),
}
