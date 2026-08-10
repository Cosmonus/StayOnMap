import * as chatService from './chat.service.js'
import { ok, created } from '../../utils/response.js'

export async function startConversation(req, res, next) {
  try {
    const convo = await chatService.getOrCreateConversation(req.user.id, req.params.propertyId)
    ok(res, convo)
  } catch (err) { next(err) }
}

export async function startConversationWithTenant(req, res, next) {
  try {
    const convo = await chatService.getOrCreateConversation(req.params.tenantId, req.params.propertyId, req.user.id)
    ok(res, convo)
  } catch (err) { next(err) }
}

export async function listConversations(req, res, next) {
  try {
    const convos = await chatService.getUserConversations(req.user.id)
    ok(res, convos)
  } catch (err) { next(err) }
}

export async function listMessages(req, res, next) {
  try {
    // Pagination was accepted by the service and never read here, which is how
    // a thread could only ever return its oldest page. `before` pages backwards
    // from the top of what the client already holds.
    const messages = await chatService.getMessages(req.params.conversationId, req.user.id, {
      before: req.query.before,
      ...(req.query.limit ? { limit: req.query.limit } : {}),
    })
    ok(res, messages)
  } catch (err) { next(err) }
}

// "I am looking at this thread right now." Idempotent, so a client can call it
// whenever the reader's attention returns without tracking what it already sent.
export async function markRead(req, res, next) {
  try {
    ok(res, await chatService.markConversationRead(req.params.conversationId, req.user.id))
  } catch (err) { next(err) }
}

export async function sendMessage(req, res, next) {
  try {
    const message = await chatService.sendMessage(req.params.conversationId, req.user.id, req.body.body, {
      url: req.body.attachmentUrl,
      name: req.body.attachmentName,
      mime: req.body.attachmentMime,
    })
    created(res, message)
  } catch (err) { next(err) }
}

export async function editMessage(req, res, next) {
  try {
    const message = await chatService.editMessage(req.params.conversationId, req.params.messageId, req.user.id, req.body.body)
    ok(res, message)
  } catch (err) { next(err) }
}

export async function deleteMessage(req, res, next) {
  try {
    const result = await chatService.deleteMessage(req.params.conversationId, req.params.messageId, req.user.id)
    ok(res, result)
  } catch (err) { next(err) }
}

export async function searchMessages(req, res, next) {
  try {
    const messages = await chatService.searchMessages(req.params.conversationId, req.user.id, req.query.q)
    ok(res, messages)
  } catch (err) { next(err) }
}

export async function unreadCount(req, res, next) {
  try {
    // { count, asTenant, asOwner } — `count` is the whole-account total the
    // released clients already read; the split is what lets a mode-filtered
    // inbox badge itself honestly.
    ok(res, await chatService.getUnreadCount(req.user.id))
  } catch (err) { next(err) }
}
