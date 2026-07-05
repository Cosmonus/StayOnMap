import { createNavigationContainerRef } from '@react-navigation/native'
import { useUiStore } from '@store/uiStore'

export const navigationRef = createNavigationContainerRef()

// Maps a Notification's { referenceId, referenceType } (see
// notifyUser() in backend/src/features/notifications/notifications.service.js)
// to a concrete in-app destination for push-notification taps. Branches on
// hostMode since the renter and host tab bars use different route names
// for the same destinations (AppTabs.js) — without this, a tap would
// silently no-op in whichever mode isn't the hardcoded one.
export function navigateToReference({ referenceId, referenceType }) {
  if (!navigationRef.isReady()) return
  const hostMode = useUiStore.getState().hostMode

  if (referenceType === 'Conversation') {
    navigationRef.navigate(hostMode ? 'Inbox' : 'Chat', { screen: 'Conversation', params: { conversationId: referenceId } })
  } else if (referenceType === 'Appointment') {
    navigationRef.navigate(hostMode ? 'Appointments' : 'Profile', {
      screen: hostMode ? 'AppointmentsHome' : 'Appointments',
    })
  }
}
