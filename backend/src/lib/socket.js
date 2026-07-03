import { Server } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import jwt from 'jsonwebtoken'
import { redis } from './redis.js'
import { env } from '../config/env.js'
import { corsOriginHandler } from './corsOrigin.js'

let io = null

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: corsOriginHandler, credentials: true },
  })

  // Scale Socket.io across multiple Node processes when Redis is available
  if (redis) {
    // Override the main client's cache-tuned options: pub/sub needs to queue
    // commands while connecting (enableOfflineQueue: true) and connect eagerly
    // (lazyConnect: false) — the adapter subscribes synchronously on
    // construction, before a lazy connection would be ready, which otherwise
    // throws "Stream isn't writeable" and crashes the whole process on boot.
    const pubClient = redis.duplicate({ enableOfflineQueue: true, lazyConnect: false })
    const subClient = redis.duplicate({ enableOfflineQueue: true, lazyConnect: false })
    pubClient.on('error', (err) => console.error('[redis:pub]', err.message))
    subClient.on('error', (err) => console.error('[redis:sub]', err.message))
    io.adapter(createAdapter(pubClient, subClient))
  }

  // Verify the user JWT before allowing a connection — same check as authMiddleware.
  // Never trust a client-supplied userId; a spoofed id would let anyone join another
  // user's room and read their chat messages / notifications.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
    if (!token) return next(new Error('Unauthorized'))

    try {
      const payload = jwt.verify(token, env.jwtSecret)
      socket.userId = payload.sub
      next()
    } catch {
      next(new Error('Unauthorized'))
    }
  })

  // Track which users are online
  const onlineUsers = new Map() // userId → Set<socketId>

  io.on('connection', (socket) => {
    const userId = socket.userId

    // Register online
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set())
    onlineUsers.get(userId).add(socket.id)

    socket.join(`user:${userId}`)

    // Broadcast online status
    io.emit('user:online', { userId })

    socket.on('typing', ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit('typing', { userId, conversationId })
    })

    socket.on('join:conversation', (conversationId) => {
      socket.join(`conversation:${conversationId}`)
    })

    socket.on('leave:conversation', (conversationId) => {
      socket.leave(`conversation:${conversationId}`)
    })

    socket.on('disconnect', () => {
      const sockets = onlineUsers.get(userId)
      if (sockets) {
        sockets.delete(socket.id)
        if (sockets.size === 0) {
          onlineUsers.delete(userId)
          io.emit('user:offline', { userId })
        }
      }
    })
  })

  return io
}

export function getIO() {
  return io
}

export function emitToUser(userId, event, data) {
  if (io) io.to(`user:${userId}`).emit(event, data)
}

export function emitToConversation(conversationId, event, data) {
  if (io) io.to(`conversation:${conversationId}`).emit(event, data)
}
