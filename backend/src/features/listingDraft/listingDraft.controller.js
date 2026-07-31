import * as service from './listingDraft.service.js'
import { ok } from '../../utils/response.js'

export async function getMyDraft(req, res, next) {
  try {
    // null is a normal answer, not a 404: "no unfinished listing" is the common
    // case and every caller polls this on mount. A 404 would make the ordinary
    // state look like an error in every client's network log.
    const draft = await service.getDraft(req.user.id)
    ok(res, draft)
  } catch (err) { next(err) }
}

export async function putMyDraft(req, res, next) {
  try {
    const draft = await service.putDraft(req.user.id, req.body)
    ok(res, draft)
  } catch (err) { next(err) }
}

export async function deleteMyDraft(req, res, next) {
  try {
    await service.deleteDraft(req.user.id)
    ok(res, null, 'Draft discarded')
  } catch (err) { next(err) }
}
