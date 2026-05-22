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
    const convo = await chatService.getOrCreateConversation(req.params.tenantId, req.params.propertyId)
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
    const messages = await chatService.getMessages(req.params.conversationId, req.user.id)
    ok(res, messages)
  } catch (err) { next(err) }
}

export async function sendMessage(req, res, next) {
  try {
    const message = await chatService.sendMessage(req.params.conversationId, req.user.id, req.body.body)
    created(res, message)
  } catch (err) { next(err) }
}

export async function unreadCount(req, res, next) {
  try {
    const count = await chatService.getUnreadCount(req.user.id)
    ok(res, { count })
  } catch (err) { next(err) }
}
