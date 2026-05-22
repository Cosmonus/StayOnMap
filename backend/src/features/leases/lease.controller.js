import * as leaseService from './lease.service.js'
import { ok, created } from '../../utils/response.js'

export async function create(req, res, next) {
  try {
    const lease = await leaseService.createLease(req.user.id, req.params.propertyId, req.body)
    created(res, lease)
  } catch (err) { next(err) }
}

export async function getMine(req, res, next) {
  try {
    const leases = await leaseService.getMyLeases(req.user.id)
    ok(res, leases)
  } catch (err) { next(err) }
}

export async function getById(req, res, next) {
  try {
    const lease = await leaseService.getLeaseById(req.params.id, req.user.id)
    ok(res, lease)
  } catch (err) { next(err) }
}

export async function sign(req, res, next) {
  try {
    const lease = await leaseService.signLease(req.params.id, req.user.id, req.body)
    ok(res, lease)
  } catch (err) { next(err) }
}

export async function reject(req, res, next) {
  try {
    const lease = await leaseService.rejectLease(req.params.id, req.user.id, req.body)
    ok(res, lease)
  } catch (err) { next(err) }
}

export async function terminate(req, res, next) {
  try {
    const lease = await leaseService.terminateLease(req.params.id, req.user.id, req.body)
    ok(res, lease)
  } catch (err) { next(err) }
}
