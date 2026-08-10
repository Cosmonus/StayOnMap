// Shared by the tenant and owner thread lists.
//
// The header said this "mirrors web's chatFormat.js", which overstated it — the
// two had drifted in two ways, and only one of them was deliberate
// (corrected 2026-08-10):
//
//   KEPT DIFFERENT. Web says "5m ago" and "3d ago"; this says "5m" and "3d".
//     A phone thread row is a fixed narrow column with the name and preview
//     competing for it, and "ago" is the word carrying the least information.
//   FIXED. Web falls back to a DATE past a week; this had no cutoff at all, so
//     a thread left alone for a year read "312d" — a number nobody converts
//     into a date in their head, where "3 Aug" is read at a glance.
//
// So: same rules, mobile's own wording. `displayName` has no web counterpart
// here; web resolves it inside its own components.

/** Past this, elapsed days stop being legible and a date is better. */
const WEEK_SECONDS = 604800

export function displayName(user) {
  return user?.name || user?.email?.split('@')[0] || 'Unknown'
}

export function timeLabel(date) {
  const d = new Date(date)
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  if (diff < WEEK_SECONDS) {
    const days = Math.floor(diff / 86400)
    return days === 1 ? 'Yesterday' : `${days}d`
  }
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
