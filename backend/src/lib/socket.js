import { Server } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import { redis } from './redis.js'
import { supabase } from './supabase.js'

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

  // Verify the Supabase JWT before allowing a connection — same check as authMiddleware.
  // Never trust a client-supplied userId; a spoofed id would let anyone join another
  // user's room and read their chat messages / notifications.
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token
    if (!token) return next(new Error('Unauthorized'))

    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return next(new Error('Unauthorized'))

    socket.userId = user.id
    next()
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
