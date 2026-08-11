// Thin HTTP handlers — delegate all logic to service
import * as service from './properties.service.js'
import { ok, created, notFound } from '../../utils/response.js'
import { getPaginationParams, buildPaginationMeta } from '../../utils/pagination.js'
import { parseBounds } from '../../utils/geo.js'
import { getSimilar } from '../graph/similarity.js'
import { ownerReviewsForProperty } from '../tenancies/tenancy.service.js'

export async function listProperties(req, res, next) {
  try {
    const pagination = getPaginationParams(req.query)
    const userId = req.user?.id ?? null
    const { properties, total, proximity } = await service.listProperties(req.query, pagination, userId)
    // `proximity` rides in meta, not in the array. It describes the RESULT SET
    // — how many listings a proximity filter had to set aside for lack of map
    // data — and dropping it here would rebuild the silent-exclusion problem
    // the service went to the trouble of measuring.
    ok(res, properties, 'OK', {
      ...buildPaginationMeta(total, pagination.page, pagination.limit),
      ...(proximity && { proximity }),
    })
  } catch (err) { next(err) }
}

export async function getPins(req, res, next) {
  try {
    const bounds = parseBounds(req.query)
    const userId = req.user?.id ?? null
    const pins = await service.getPinsInBounds(bounds, req.query, userId)
    ok(res, pins)
  } catch (err) { next(err) }
}

export async function countProperties(req, res, next) {
  try {
    const bounds = parseBounds(req.query)
    const userId = req.user?.id ?? null
    const count = await service.countPropertiesInBounds(bounds, req.query, userId)
    ok(res, { count })
  } catch (err) { next(err) }
}

export async function getProperty(req, res, next) {
  try {
    const property = await service.getPropertyById(req.params.id, req.user?.id ?? null)
    if (!property) return notFound(res)
    ok(res, property)
  } catch (err) { next(err) }
}

export async function getSimilarProperties(req, res, next) {
  try {
    // Capped in the service too; clamped here so a query string cannot ask for
    // a hundred cards on a page that renders six.
    const limit = Math.min(Math.max(Number(req.query.limit) || 6, 1), 24)
    ok(res, await getSimilar(req.params.id, limit))
  } catch (err) { next(err) }
}

export async function getMyProperties(req, res, next) {
  try {
    const properties = await service.getPropertiesByOwner(req.user.id)
    ok(res, properties)
  } catch (err) { next(err) }
}

export async function createProperty(req, res, next) {
  try {
    const property = await service.createProperty(req.user.id, req.body)
    created(res, property)
  } catch (err) { next(err) }
}

export async function updateProperty(req, res, next) {
  try {
    const property = await service.updateProperty(req.params.id, req.user.id, req.body)
    ok(res, property)
  } catch (err) { next(err) }
}

export async function deleteProperty(req, res, next) {
  try {
    await service.deleteProperty(req.params.id, req.user.id)
    ok(res, null, 'Deleted')
  } catch (err) { next(err) }
}

export async function togglePropertyStatus(req, res, next) {
  try {
    const property = await service.toggleStatus(req.params.id, req.user.id)
    ok(res, property)
  } catch (err) { next(err) }
}

export async function getStats(req, res, next) {
  try {
    const stats = await service.getPublicStats()
    ok(res, stats)
  } catch (err) { next(err) }
}

export async function getBenchmark(req, res, next) {
  try {
    const benchmark = await service.getPriceBenchmark(req.query)
    ok(res, benchmark)
  } catch (err) { next(err) }
}

export async function getAmenities(req, res, next) {
  try {
    const amenities = await service.getAllAmenities()
    ok(res, amenities)
  } catch (err) { next(err) }
}

export async function publishProperty(req, res, next) {
  try {
    const property = await service.publishProperty(req.params.id, req.user.id)
    ok(res, property)
  } catch (err) { next(err) }
}

export async function markTenant(req, res, next) {
  try {
    const property = await service.markTenant(req.params.id, req.user.id, req.body.tenantId)
    ok(res, property)
  } catch (err) { next(err) }
}

export async function getPropertyContacts(req, res, next) {
  try {
    const data = await service.getPropertyContacts(req.params.id, req.user.id)
    ok(res, data)
  } catch (err) { next(err) }
}

export async function getOwnerTenancyReviews(req, res, next) {
  try {
    ok(res, await ownerReviewsForProperty(req.params.id))
  } catch (err) { next(err) }
}

export async function vacateProperty(req, res, next) {
  try {
    const property = await service.vacateProperty(req.params.id, req.user.id)
    ok(res, property)
  } catch (err) { next(err) }
}
