import { api } from '@lib/api'

export const chatService = {
  conversations:   ()                   => api.get('/chat'),
  unreadCount:     ()                   => api.get('/chat/unread'),
  startConversation: (propertyId)       => api.post(`/chat/property/${propertyId}`),
  startWithTenant:  (propertyId, tenantId) => api.post(`/chat/property/${propertyId}/with/${tenantId}`),
  messages:        (conversationId)     => api.get(`/chat/${conversationId}/messages`),
  sendMessage:     (conversationId, body) => api.post(`/chat/${conversationId}/messages`, { body }),
}
