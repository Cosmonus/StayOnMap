// Thin HTTP handlers — delegate all logic to service
import * as service from './properties.service.js'
import { ok, created, notFound } from '../../utils/response.js'
import { getPaginationParams, buildPaginationMeta } from '../../utils/pagination.js'
import { parseBounds } from '../../utils/geo.js'

export async function listProperties(req, res, next) {
  try {
    const pagination = getPaginationParams(req.query)
    const userId = req.user?.id ?? null
    const { properties, total } = await service.listProperties(req.query, pagination, userId)
    ok(res, properties, 'OK', buildPaginationMeta(total, pagination.page, pagination.limit))
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

export async function getProperty(req, res, next) {
  try {
    const property = await service.getPropertyById(req.params.id, req.user?.id ?? null)
    if (!property) return notFound(res)
    ok(res, property)
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

export async function vacateProperty(req, res, next) {
  try {
    const property = await service.vacateProperty(req.params.id, req.user.id)
    ok(res, property)
  } catch (err) { next(err) }
}
