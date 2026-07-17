// Admin filter config — the user filter schema (config/filters.js) plus the
// two things only a platform operator may filter on. The admin panel used to
// hand-roll its own filter UI supporting just city/type/bhk/status, which is
// how it drifted ~40 filters behind the public map. Both surfaces now generate
// from the same config, so a filter added for users appears here for free.
//
// Mirrors backend features/properties/filters.registry.js's ADMIN_FILTERS —
// filter ids are the contract between the two, same as on the user side.
import { PARAM_DEFS, FILTER_SECTIONS } from './filters.js'

// Matches the PropertyStatus enum (prisma/schema.prisma). The old admin UI had
// two disagreeing hardcoded status lists — AdminPropertiesMap's STATUS_FILTERS
// and ReviewListingsSection's inline array, which was missing INACTIVE. One
// list now feeds both.
export const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'REJECTED', label: 'Rejected' },
]

export const RISK_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'SUSPICIOUS', label: 'Suspicious' },
]

export const ADMIN_PARAM_DEFS = {
  ...PARAM_DEFS,
  status:    { kind: 'csv', def: [] },
  riskLevel: { kind: 'csv', def: [] },
}

export const ADMIN_DEFAULT_FILTERS = {
  area: '',
  ...Object.fromEntries(Object.entries(ADMIN_PARAM_DEFS).map(([id, d]) => [id, d.def])),
}

// Moderation section first and open by default: status is the filter an admin
// reaches for most (the queue is "what's PENDING"), unlike the user side where
// budget leads. `types: null` — these apply to every property type.
const MODERATION_SECTION = {
  id: 'moderation',
  label: 'Moderation',
  types: null,
  defaultOpen: true,
  rows: [
    { kind: 'chips', label: 'Listing status', id: 'status', options: STATUS_OPTIONS },
    { kind: 'chips', label: 'Risk level', id: 'riskLevel', options: RISK_OPTIONS },
  ],
}

export const ADMIN_FILTER_SECTIONS = [MODERATION_SECTION, ...FILTER_SECTIONS]
