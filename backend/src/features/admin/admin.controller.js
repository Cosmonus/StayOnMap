import * as service from './admin.service.js'
import { latestReports } from '../spatial/dataQuality.js'
import * as productAnalytics from '../analytics/analytics.service.js'
import { getUnmetDemand } from '../analytics/demand.service.js'
import * as marketplaceMetrics from '../analytics/marketplace.service.js'
import { ok, created } from '../../utils/response.js'

export async function login(req, res, next) {
  try { ok(res, await service.adminLogin(req.body.email, req.body.password)) } catch (err) { next(err) }
}
export async function analytics(req, res, next) {
  try { ok(res, await service.getDashboardAnalytics()) } catch (err) { next(err) }
}
// The product funnel, separate from /analytics above — that one counts rows in
// the database (how many listings, how many users), this one counts behaviour
// (how many of the people who saw the map ever booked). Different questions.
export async function funnel(req, res, next) {
  try {
    const days = req.query.days ? Number(req.query.days) : undefined
    const [funnelData, seoFunnel, timeToPublish] = await Promise.all([
      productAnalytics.getFunnel({ days }),
      // The same funnel, restricted to sessions that arrived on a search
      // landing page. Returned ALONGSIDE rather than replacing it, and never
      // as a toggle the caller has to know to flip: the interesting number is
      // the DIFFERENCE between the two, and a reader who sees only one has no
      // way to know whether organic traffic converts better or worse than
      // everyone else. Its denominator is the arrival, not `map_view` — see
      // getFunnel, where mixing those up would report rates above 100%.
      productAnalytics.getFunnel({ days, segment: 'seo' }),
      productAnalytics.getTimeToPublish(),
    ])
    ok(res, { funnel: funnelData, seoFunnel, timeToPublish })
  } catch (err) { next(err) }
}
// Where demand went unmet. A third question again: /analytics counts what we
// HAVE, /analytics/funnel counts what people DID, and this counts what they
// asked for and we could not show them — the only one of the three that points
// at a specific listing to go and find.
export async function demand(req, res, next) {
  try {
    const days = req.query.days ? Number(req.query.days) : undefined
    ok(res, await getUnmetDemand({ days }))
  } catch (err) { next(err) }
}
// The supply side and the handshake between the two. A fourth question, and the
// one nothing answered before: /analytics counts what we have, /funnel what
// renters did, /demand what they could not find — and this, whether listings
// get finished, whether owners answer, and whether any of it ends in a tenancy.
// Four readouts in one response because they are one screen; splitting them
// would be four requests to render a single section.
export async function marketplace(req, res, next) {
  try {
    const [drafts, responsiveness, chain, supply, dead, readiness] = await Promise.all([
      marketplaceMetrics.getDraftFunnel(),
      marketplaceMetrics.getOwnerResponsiveness(),
      marketplaceMetrics.getMatchChain(),
      marketplaceMetrics.getSupplyTrend(),
      marketplaceMetrics.getDeadInventory(),
      marketplaceMetrics.getListingReadiness(),
    ])
    ok(res, { drafts, responsiveness, chain, supply, dead, readiness })
  } catch (err) { next(err) }
}
export async function waitlist(req, res, next) {
  try { ok(res, await service.listWaitlist(req.query)) } catch (err) { next(err) }
}
export async function users(req, res, next) {
  try { ok(res, await service.listUsers(req.query)) } catch (err) { next(err) }
}
export async function userDetail(req, res, next) {
  try { ok(res, await service.getUserDetail(req.params.userId)) } catch (err) { next(err) }
}
export async function blockUser(req, res, next) {
  try { ok(res, await service.toggleUserBlock(req.params.userId, req.body.blocked, req.body.reason, req.admin.sub)) } catch (err) { next(err) }
}
export async function properties(req, res, next) {
  try { ok(res, await service.listAdminProperties(req.query)) } catch (err) { next(err) }
}
export async function propertyById(req, res, next) {
  try { ok(res, await service.getAdminPropertyById(req.params.id)) } catch (err) { next(err) }
}
export async function adminPins(req, res, next) {
  try { ok(res, await service.getAdminPins(req.query)) } catch (err) { next(err) }
}
export async function setPropertyStatus(req, res, next) {
  try { ok(res, await service.setPropertyStatus(req.params.id, req.body.status, req.body.note, req.admin.sub)) } catch (err) { next(err) }
}
export async function getReviews(req, res, next) {
  try { ok(res, await service.listReviews(req.query)) } catch (err) { next(err) }
}
export async function moderateReview(req, res, next) {
  try { ok(res, await service.moderateReview(req.params.id, req.body.status, req.admin.sub)) } catch (err) { next(err) }
}
export async function activityLogs(req, res, next) {
  try { ok(res, await service.listActivityLogs(req.query)) } catch (err) { next(err) }
}
export async function getAmenities(req, res, next) {
  try { ok(res, await service.listAmenities()) } catch (err) { next(err) }
}
export async function addAmenity(req, res, next) {
  try { created(res, await service.createAmenity(req.body.name)) } catch (err) { next(err) }
}
export async function removeAmenity(req, res, next) {
  try { ok(res, await service.deleteAmenity(req.params.id)) } catch (err) { next(err) }
}
export async function getMonitorStatus(req, res, next) {
  try { ok(res, await service.getMonitorStatus()) } catch (err) { next(err) }
}
export async function getDataQuality(req, res, next) {
  try { ok(res, await latestReports()) } catch (err) { next(err) }
}
export async function getProfile(req, res, next) {
  try { ok(res, await service.getAdminProfile(req.admin.sub)) } catch (err) { next(err) }
}
export async function updateProfile(req, res, next) {
  try { ok(res, await service.updateAdminProfile(req.admin.sub, req.body)) } catch (err) { next(err) }
}
export async function changePassword(req, res, next) {
  try { await service.changeAdminPassword(req.admin.sub, req.body.currentPassword, req.body.newPassword); ok(res, { changed: true }) } catch (err) { next(err) }
}
