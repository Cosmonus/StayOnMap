import { api } from '@lib/api'

export const chatService = {
  conversations:   ()                   => api.get('/chat'),
  unreadCount:     ()                   => api.get('/chat/unread'),
  startConversation: (propertyId)       => api.post(`/chat/property/${propertyId}`),
  startWithTenant:  (propertyId, tenantId) => api.post(`/chat/property/${propertyId}/with/${tenantId}`),
  messages:        (conversationId)     => api.get(`/chat/${conversationId}/messages`),
  sendMessage:     (conversationId, body, attachmentUrl) => api.post(`/chat/${conversationId}/messages`, { body, attachmentUrl }),
  editMessage:     (conversationId, messageId, body) => api.patch(`/chat/${conversationId}/messages/${messageId}`, { body }),
  deleteMessage:   (conversationId, messageId) => api.delete(`/chat/${conversationId}/messages/${messageId}`),
  searchMessages:  (conversationId, q)  => api.get(`/chat/${conversationId}/messages/search`, { params: { q } }),
}
