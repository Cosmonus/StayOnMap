import webpush from 'web-push'
import { prisma } from '../lib/prisma.js'
import { env } from '../config/env.js'

let configured = false

function ensureConfigured() {
  if (configured || !env.vapidPublicKey || !env.vapidPrivateKey) return
  webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey)
  configured = true
}

export async function saveSubscription(userId, { endpoint, keys }) {
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    update: { userId, p256dh: keys.p256dh, auth: keys.auth },
  })
}

export async function removeSubscription(userId, endpoint) {
  await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } })
}

export async function sendPushToUser(userId, { title, body, url = '/' }) {
  ensureConfigured()
  if (!configured) return

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { pushNotifs: true } })
  if (!user?.pushNotifs) return

  const subs = await prisma.pushSubscription.findMany({ where: { userId } })
  if (!subs.length) return

  const payload = JSON.stringify({ title, body, url })

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
      } catch (err) {
        // 404/410 means subscription is gone — clean it up
        if (err.statusCode === 404 || err.statusCode === 410) {
          await prisma.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } })
        }
      }
    })
  )
}
