import { Platform } from 'react-native'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { api } from '@lib/api'
import { colors } from '@theme/colors'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

let cachedToken = null

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: colors.brand600,
  })
}

async function registerToken() {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId
  const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)

  cachedToken = token
  await api.post('/push/register-device', { token }).catch(() => {})
  return token
}

export async function registerForPushNotifications() {
  if (!Device.isDevice) return null

  await ensureAndroidChannel()

  const { status: existing } = await Notifications.getPermissionsAsync()
  let status = existing
  if (existing !== 'granted') {
    const req = await Notifications.requestPermissionsAsync()
    status = req.status
  }
  if (status !== 'granted') return null

  return registerToken()
}

export async function registerForPushNotificationsIfGranted() {
  if (!Device.isDevice) return null

  const { status } = await Notifications.getPermissionsAsync()
  if (status !== 'granted') return null

  await ensureAndroidChannel()
  return registerToken()
}

export async function unregisterPushNotifications() {
  if (!cachedToken) return
  await api.delete('/push/unregister-device', { data: { token: cachedToken } }).catch(() => {})
  cachedToken = null
}
