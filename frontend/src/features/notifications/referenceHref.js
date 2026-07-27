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
// PropertyReport and OwnershipVerification carry the report's and the
// verification's own id. No route takes either, and sending someone to a
// property would mean inventing an id we were never given, so those rows stay
// unlinked rather than pretending.
export function referenceHref({ referenceType, referenceId }) {
  switch (referenceType) {
    case 'Conversation': return '/user?tab=messages'
    case 'Appointment': return '/user?tab=appointments'
    case 'Lease': return '/user?tab=leases'
    case 'Property': return `/property/${referenceId}`
    default: return null
  }
}
