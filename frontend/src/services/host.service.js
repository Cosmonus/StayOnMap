import { api } from '@lib/api'

// The owner's dashboard: what needs them today, and what the last 30 days did.
// One call — the page is a single question ("is anyone waiting on me?") and
// answering it from five endpoints would render in five stages.
export const hostService = {
  dashboard: () => api.get('/host/dashboard'),
}
