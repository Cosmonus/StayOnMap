import { api } from '@lib/api'

export const chatService = {
  conversations:   ()                   => api.get('/chat'),
  unreadCount:     ()                   => api.get('/chat/unread'),
  startConversation: (propertyId)       => api.post(`/chat/property/${propertyId}`),
  startWithTenant:  (propertyId, tenantId) => api.post(`/chat/property/${propertyId}/with/${tenantId}`),
  messages:        (conversationId)     => api.get(`/chat/${conversationId}/messages`),
  // Fetching the messages already marks them read; this is for a message that
  // arrives while the thread is ALREADY open, which nothing else would clear.
  markRead:        (conversationId)     => api.post(`/chat/${conversationId}/read`),
  // `attachment` is { url, name, mime } — name and mime exist for documents,
  // which cannot be rendered from a UUID URL alone.
  sendMessage:     (conversationId, body, attachment = {}) => api.post(`/chat/${conversationId}/messages`, {
    body,
    attachmentUrl: attachment.url,
    attachmentName: attachment.name,
    attachmentMime: attachment.mime,
  }),
  editMessage:     (conversationId, messageId, body) => api.patch(`/chat/${conversationId}/messages/${messageId}`, { body }),
  deleteMessage:   (conversationId, messageId) => api.delete(`/chat/${conversationId}/messages/${messageId}`),
  searchMessages:  (conversationId, q)  => api.get(`/chat/${conversationId}/messages/search`, { params: { q } }),
}
