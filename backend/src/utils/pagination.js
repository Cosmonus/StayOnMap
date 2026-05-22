// Pagination helpers for Prisma queries

export function getPaginationParams(query) {
  const page = Math.max(1, parseInt(query.page) || 1)
  const limit = Math.min(50, Math.max(1, parseInt(query.limit) || 20))
  const skip = (page - 1) * limit
  return { page, limit, skip }
}

export function buildPaginationMeta(total, page, limit) {
  return { total, page, limit, totalPages: Math.ceil(total / limit) }
}
