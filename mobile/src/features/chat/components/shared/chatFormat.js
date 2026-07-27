// Shared by the tenant and owner thread lists. Mirrors web's
// features/chat/components/shared/chatFormat.js.

export function displayName(user) {
  return user?.name || user?.email?.split('@')[0] || 'Unknown'
}

export function timeLabel(date) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  const days = Math.floor(diff / 86400)
  return days === 1 ? 'Yesterday' : `${days}d`
}
