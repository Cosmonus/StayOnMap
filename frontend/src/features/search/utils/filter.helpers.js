// Converts filterStore state to API query params.
// Thin re-exports — the schema-driven implementations live in config/filters.js.
export { toQueryParams as buildFilterParams, countActiveFilters } from '@/config/filters'
