import { createNavigationContainerRef } from '@react-navigation/native'

export const navigationRef = createNavigationContainerRef()

// Maps a Notification's { referenceId, referenceType } (see
// notifyUser() in backend/src/features/notifications/notifications.service.js)
// to a concrete in-app destination for push-notification taps.
export function navigateToReference({ referenceId, referenceType }) {
  if (!navigationRef.isReady()) return

  if (referenceType === 'Conversation') {
    navigationRef.navigate('Chat', { screen: 'Conversation', params: { conversationId: referenceId } })
  } else if (referenceType === 'Appointment') {
    navigationRef.navigate('Profile', { screen: 'Appointments' })
  }
}
