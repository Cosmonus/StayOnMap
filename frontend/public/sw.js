self.addEventListener('push', (event) => {
  if (!event.data) return
  let data = {}
  try { data = event.data.json() } catch { data = { title: 'StayOnMap', body: event.data.text() } }

  event.waitUntil(
    self.registration.showNotification(data.title ?? 'StayOnMap', {
      body:  data.body  ?? '',
      icon:  '/icon-192.png',
      badge: '/icon-96.png',
      data:  { url: data.url ?? '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const existing = list.find((c) => c.url.includes(self.location.origin))
      if (existing) { existing.focus(); existing.navigate(url); return }
      return clients.openWindow(url)
    })
  )
})
