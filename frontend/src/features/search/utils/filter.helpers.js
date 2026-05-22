// Converts filterStore state to API query params

export function buildFilterParams(filters) {
  const params = {}
  if (filters.bhk?.length) params.bhk = filters.bhk.join(',')
  if (filters.furnished)   params.furnished = filters.furnished
  if (filters.city)        params.city = filters.city
  return params
}

export function countActiveFilters(filters) {
  let count = 0
  if (filters.city)          count++
  if (filters.area)          count++
  if (filters.bhk?.length)   count += filters.bhk.length
  if (filters.furnished)     count++
  return count
}
