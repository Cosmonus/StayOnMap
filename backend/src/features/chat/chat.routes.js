import { Router } from 'express'
import { authMiddleware } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { sendMessageSchema } from './chat.validation.js'
import * as ctrl from './chat.controller.js'

const router = Router()

router.use(authMiddleware)

router.get('/',                          ctrl.listConversations)
router.get('/unread',                    ctrl.unreadCount)
router.post('/property/:propertyId',                          ctrl.startConversation)
router.post('/property/:propertyId/with/:tenantId',           ctrl.startConversationWithTenant)
router.get('/:conversationId/messages',  ctrl.listMessages)
router.post('/:conversationId/messages', validate(sendMessageSchema), ctrl.sendMessage)

export default router
