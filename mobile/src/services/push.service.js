import { Platform } from 'react-native'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { api } from '@lib/api'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

let cachedToken = null

export async function registerForPushNotifications() {
  if (!Device.isDevice) return null

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#0E9D66',
    })
  }

  const { status: existing } = await Notifications.getPermissionsAsync()
  let status = existing
  if (existing !== 'granted') {
    const req = await Notifications.requestPermissionsAsync()
    status = req.status
  }
  if (status !== 'granted') return null

  const projectId = Constants.expoConfig?.extra?.eas?.projectId
  const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)

  cachedToken = token
  await api.post('/push/register-device', { token }).catch(() => {})
  return token
}

export async function unregisterPushNotifications() {
  if (!cachedToken) return
  await api.delete('/push/unregister-device', { data: { token: cachedToken } }).catch(() => {})
  cachedToken = null
}
