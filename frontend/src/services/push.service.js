import { api } from '@lib/api'

async function getVapidKey() {
  const res = await api.get('/push/vapid-public-key')
  return res.data?.key
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch { return null }
}

export async function subscribeToPush() {
  if (!('PushManager' in window)) return null

  const reg = await registerServiceWorker()
  if (!reg) return null

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  const vapidKey = await getVapidKey()
  if (!vapidKey) return null

  try {
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })
    await api.post('/push/subscribe', sub.toJSON())
    return sub
  } catch { return null }
}

export async function unsubscribeFromPush() {
  if (!('serviceWorker' in navigator)) return

  const reg = await navigator.serviceWorker.getRegistration('/sw.js')
  if (!reg) return

  const sub = await reg.pushManager.getSubscription()
  if (!sub) return

  await api.delete('/push/subscribe', { data: { endpoint: sub.endpoint } })
  await sub.unsubscribe()
}

export async function getCurrentSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null
  const reg = await navigator.serviceWorker.getRegistration('/sw.js')
  if (!reg) return null
  return reg.pushManager.getSubscription()
}
