import * as service from './analytics.service.js'
import { ok } from '../../utils/response.js'

export async function ingest(req, res, next) {
  try {
    // userId comes from the TOKEN, never the body. A client that could name
    // its own user id could attribute anyone's funnel to anyone.
    const userId = req.user?.id ?? null

    const rows = req.body.events.map((e) => ({
      name: e.name,
      sessionId: e.sessionId,
      userId,
      propertyId: e.propertyId ?? null,
      city: e.city ?? null,
      props: e.props ?? null,
    }))

    // 202: we have taken the batch, and the caller must not wait on — or care
    // about — whether every row landed. A browser flushing on pagehide is
    // often gone before any response arrives.
    const stored = await service.recordEvents(rows)
    res.status(202).json({ success: true, data: { stored } })
  } catch (err) { next(err) }
}

export async function funnel(req, res, next) {
  try {
    const days = req.query.days ? Number(req.query.days) : undefined
    const [funnelData, timeToPublish] = await Promise.all([
      service.getFunnel({ days }),
      service.getTimeToPublish(),
    ])
    ok(res, { funnel: funnelData, timeToPublish })
  } catch (err) { next(err) }
}
