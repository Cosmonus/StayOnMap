// Where a notification's { referenceType, referenceId } leads, or null when
// there is nowhere honest to send someone.
//
// This is the ONE place that decision lives on web, mirroring mobile's
// referenceDestination() in navigation/navigationRef.js — same six reference
// types the backend emits, same two deliberate omissions. It lived privately
// inside NotificationCenter, so the header BELL — the surface you actually see
// the moment a notification arrives — only marked its rows read and led
// nowhere. Mobile hit exactly this split once already (push opened the thread,
// the list only marked it read) and fixed it by centralising; web now does too.
//
// OwnershipVerification carries the verification's own id, no route takes it,
// and sending someone to a property would mean inventing an id we were never
// given — so that row stays unlinked rather than pretending.
//
// PropertyReport was in that same category until 2026-08-10 and no longer is:
// a report now has a thread, so "a moderator replied to your report" leads to
// the reply instead of to a list. It opens on the notifications tab rather than
// a page of its own, because that is where the reader already is — web push
// lands every notification on `/user?tab=notifications` — and a report has no
// other home in the product.
export function referenceHref({ referenceType, referenceId }) {
  switch (referenceType) {
    case 'Conversation': return '/user?tab=messages'
    case 'Appointment': return '/user?tab=appointments'
    case 'Lease': return '/user?tab=leases'
    case 'Property': return `/property/${referenceId}`
    case 'PropertyReport': return `/user?tab=notifications&report=${referenceId}`
    default: return null
  }
}
