import { createNavigationContainerRef } from '@react-navigation/native'
import { useUiStore } from '@store/uiStore'

export const navigationRef = createNavigationContainerRef()

// Cold-start notification taps arrive before the NavigationContainer mounts —
// hold the last reference until RootNavigator's onReady flushes it.
let pendingReference = null

export function flushPendingReference() {
  if (!pendingReference) return
  const reference = pendingReference
  pendingReference = null
  navigateToReference(reference)
}

// Maps a Notification's { referenceId, referenceType } (see
// notifyUser() in backend/src/features/notifications/notifications.service.js)
// to a concrete in-app destination. Branches on hostMode since the renter and
// host tab bars use different route names for the same destinations
// (AppTabs.js) — without this, a tap would silently no-op in whichever mode
// isn't the hardcoded one.
//
// Returns null when there is nowhere honest to send someone, and callers must
// respect that rather than fall back to a list: the in-app notification row
// uses it to decide whether it is tappable at all, so a row never offers a
// chevron that leads nowhere.
//
// This is the ONE place that decision lives. The list in
// NotificationsScreen and an OS push tap are the same question — "what is
// this notification about?" — and they used to answer it differently: push
// opened the thread, the list only marked it read.
// `initial: false` on every destination that is NOT its stack's first screen:
// without it, a deep link into a tab whose stack hasn't mounted yet makes the
// target the stack's INITIAL route — nothing beneath it, so back falls
// through to the tab bar instead of popping to the list the screen belongs
// over (a conversation with no inbox under it, a property with no map).
export function referenceDestination({ referenceId, referenceType }, hostMode) {
  switch (referenceType) {
    case 'Conversation':
      return [hostMode ? 'Inbox' : 'Chat', { screen: 'Conversation', initial: false, params: { conversationId: referenceId } }]
    case 'Appointment':
      // referenceId is the appointment, but neither mode has a per-appointment
      // screen — the queue is the destination. Host mode's queue IS its
      // stack's first screen, so only the renter path needs initial: false.
      return hostMode
        ? ['Appointments', { screen: 'AppointmentsHome' }]
        : ['Profile', { screen: 'Appointments', initial: false }]
    case 'Lease':
      // Leases are a renter-side screen (ProfileStack). Host mode has no lease
      // list at all — only CreateLease — so a host's lease notification has
      // nowhere to land and stays unlinked instead of jumping somewhere wrong.
      return hostMode ? null : ['Profile', { screen: 'Leases', initial: false }]
    case 'Tenancy':
      // The tenancy record renders on the Leases screen for both hats — but
      // that screen lives in the renter Profile stack, so in host mode the
      // notification stays unlinked rather than jumping somewhere wrong (the
      // Lease precedent above).
      return hostMode ? null : ['Profile', { screen: 'Leases', initial: false }]
    case 'Property':
      return [hostMode ? 'MyListing' : 'Explore', { screen: 'PropertyDetail', initial: false, params: { propertyId: referenceId } }]
    case 'PropertyReport':
      // A report has a THREAD as of 2026-08-10, so this is no longer a dead
      // reference. It opens on the notifications screen rather than one of its
      // own, because that is where the reader already is and a report has no
      // other home in the product.
      //
      // Renter tab, always: a PropertyReport notification is addressed to the
      // TENANT hat (the reporter is acting as a renter, even if they also own
      // listings), so navigateToReference has already switched modes by the
      // time this resolves. Host mode's Notifications lives under Dashboard and
      // is the wrong list for it.
      return ['Explore', { screen: 'Notifications', initial: false, params: { reportId: referenceId } }]
    default:
      // OwnershipVerification carries the VERIFICATION's own id and no screen
      // takes it. Sending someone to a property would mean inventing an id we
      // were never given.
      return null
  }
}

// Notifications belong to a HAT (Notification.audience), and each mode shows
// only its own — so a notification must be opened in the mode it was addressed
// to, not in whichever mode the app happens to be sitting in. An owner tapping
// "New appointment request" from renter mode would otherwise land on the
// renter's appointment list, which does not contain it.
//
// Switching the mode is the honest move rather than a no-op: it is the same
// thing the user would have had to do by hand, and every surface behind it
// (tab bar, inbox, notification list) then agrees about what they're looking
// at. `audience` is absent on old rows and on pushes from before it existed —
// then we stay where we are, which is the previous behaviour.
export function navigateToReference(reference) {
  if (!navigationRef.isReady()) {
    pendingReference = reference
    return
  }
  const { hostMode, setHostMode } = useUiStore.getState()
  const wants = reference?.audience === 'OWNER' ? true : reference?.audience === 'TENANT' ? false : hostMode

  // Switching modes REMOUNTS the tab navigator (AppTabs keys on hostMode), and
  // the two modes share no route name — so navigating in the same tick would
  // address the tab set that is about to be thrown away. Park the reference and
  // let the newly mounted AppTabs flush it, which is the same mechanism a
  // cold-start tap already uses.
  if (wants !== hostMode) {
    pendingReference = reference
    setHostMode(wants)
    return
  }

  const destination = referenceDestination(reference, wants)
  if (destination) navigationRef.navigate(...destination)
}
