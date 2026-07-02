import { Expo } from 'expo-server-sdk'
import { prisma } from '../lib/prisma.js'

const expo = new Expo()

export async function saveExpoPushToken(userId, token) {
  await prisma.expoPushToken.upsert({
    where: { token },
    create: { userId, token },
    update: { userId },
  })
}

export async function removeExpoPushToken(userId, token) {
  await prisma.expoPushToken.deleteMany({ where: { userId, token } })
}

export async function sendExpoPushToUser(userId, { title, body, data }) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { pushNotifs: true } })
  if (!user?.pushNotifs) return

  const tokens = await prisma.expoPushToken.findMany({ where: { userId } })
  if (!tokens.length) return

  const messages = tokens
    .filter((t) => Expo.isExpoPushToken(t.token))
    .map((t) => ({ to: t.token, sound: 'default', title, body, data }))
  if (!messages.length) return

  const chunks = expo.chunkPushNotifications(messages)
  const tickets = []
  for (const chunk of chunks) {
    try {
      tickets.push(...await expo.sendPushNotificationsAsync(chunk))
    } catch {
      // whole chunk failed to send (e.g. network) — nothing to clean up
    }
  }

  await Promise.allSettled(
    tickets.map((ticket, i) => {
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        return prisma.expoPushToken.deleteMany({ where: { token: messages[i].to } })
      }
      return Promise.resolve()
    })
  )
}
