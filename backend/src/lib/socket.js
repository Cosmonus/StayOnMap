import { Server } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import { redis } from './redis.js'

let io = null

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
      credentials: true,
    },
  })

  // Scale Socket.io across multiple Node processes when Redis is available
  if (redis) {
    const pubClient = redis.duplicate()
    const subClient = redis.duplicate()
    io.adapter(createAdapter(pubClient, subClient))
  }

  // Track which users are online
  const onlineUsers = new Map() // userId → Set<socketId>

  io.on('connection', (socket) => {
    const userId = socket.handshake.auth?.userId
    if (!userId) { socket.disconnect(); return }

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
