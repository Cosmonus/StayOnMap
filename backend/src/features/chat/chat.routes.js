import { Router } from 'express'
import { authMiddleware } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { chatLimiter } from '../../middlewares/rateLimit.middleware.js'
import { sendMessageSchema, editMessageSchema, searchQuerySchema, messagesQuerySchema } from './chat.validation.js'
import * as ctrl from './chat.controller.js'

const router = Router()

router.use(authMiddleware)

router.get('/',                          ctrl.listConversations)
router.get('/unread',                    ctrl.unreadCount)
router.post('/property/:propertyId',                          ctrl.startConversation)
router.post('/property/:propertyId/with/:tenantId',           ctrl.startConversationWithTenant)
router.get('/:conversationId/messages',                       validate(messagesQuerySchema, 'query'), ctrl.listMessages)
router.post('/:conversationId/read',                          ctrl.markRead)
router.get('/:conversationId/messages/search',                validate(searchQuerySchema, 'query'), ctrl.searchMessages)
router.post('/:conversationId/messages',                      chatLimiter, validate(sendMessageSchema), ctrl.sendMessage)
router.patch('/:conversationId/messages/:messageId',          validate(editMessageSchema), ctrl.editMessage)
router.delete('/:conversationId/messages/:messageId',         ctrl.deleteMessage)

export default router
