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
// Must cover every PropertyStatus the backend's PROPERTY_STATUSES accepts, or
// the state is unfilterable from the panel. OCCUPIED was missing from BOTH
// until 2026-08-10 — the one state a marketplace most wants to count, since it
// is the listings that actually found a tenant.
export const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'OCCUPIED', label: 'Occupied' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'REJECTED', label: 'Rejected' },
]

export const RISK_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'SUSPICIOUS', label: 'Suspicious' },
]

export const PRICING_MODEL_OPTIONS = [
  { value: 'RENT', label: 'Rent' },
  { value: 'LEASE', label: 'Lease' },
]

export const ADMIN_PARAM_DEFS = {
  ...PARAM_DEFS,
  // Override: the public map defaults to RENT (it shows one mode at a time via
  // the Rent/Lease toggle), but moderation must see every listing by default —
  // a RENT default here would silently hide lease listings from the queue, the
  // same reason admin has no ACTIVE status default.
  pricingModel: { kind: 'str', def: '' },
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
    // Admin's counterpart to the public Rent/Lease toggle. `single` with an
    // empty default means "both", which the public map never wants but
    // moderation always does. Picking Lease swaps the Budget section's row to
    // the lakh-scale one, exactly as it does for users.
    { kind: 'chips', label: 'Pricing', id: 'pricingModel', single: true, options: PRICING_MODEL_OPTIONS },
  ],
}

export const ADMIN_FILTER_SECTIONS = [MODERATION_SECTION, ...FILTER_SECTIONS]
