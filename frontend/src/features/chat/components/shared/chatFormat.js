// Formatting shared by the tenant and owner message surfaces. Pure functions,
// no component state — they were inline in the old single ChatPanel and are the
// one part of it that is genuinely identical for both hats.

export function timeLabel(date) {
  const d = new Date(date)
  const now = new Date()
  const diff = Math.floor((now - d) / 1000)
  if (diff < 60)   return 'now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  if (diff < 604800) {
    const days = Math.floor(diff / 86400)
    return days === 1 ? 'Yesterday' : `${days}d ago`
  }
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export function chatTime(date) {
  return new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

export function dateSeparator(date) {
  const d = new Date(date)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function displayName(user) {
  return user?.name || user?.email?.split('@')[0] || 'Unknown'
}

// What the listing is, in the two facts that identify it in a list: size and
// where. "2 BHK · Koramangala 5th Block" — the landmark, not the full address,
// because the landmark is how people actually name a place here.
export function propertyLine(property) {
  if (!property) return ''
  const size = property.bhk ? `${property.bhk} BHK`
    : property.sharing ? `${property.sharing}-sharing`
    : null
  const where = property.landmark || property.city
  return [size, where].filter(Boolean).join(' · ')
}

// MEASURED from the owner's own reply history (chat.service.js returns a median
// and returns nothing below three samples). Never a promise, never a badge —
// if we don't know, this renders nothing at all. Only the TENANT surface shows
// it: an owner does not need to be told how fast they answer.
export function replyTimeLabel(minutes) {
  if (minutes == null) return null
  if (minutes < 15) return 'replies within minutes'
  if (minutes < 90) return 'replies in about an hour'
  if (minutes < 60 * 20) return `replies in about ${Math.round(minutes / 60)} hours`
  const days = Math.round(minutes / 60 / 24)
  return days <= 1 ? 'replies within a day' : `replies in about ${days} days`
}

export function isImageAttachment(msg) {
  // Older messages predate attachmentMime and were images by construction —
  // chat accepted nothing else until 2026-07-26.
  if (!msg.attachmentUrl) return false
  return !msg.attachmentMime || msg.attachmentMime.startsWith('image/')
}
