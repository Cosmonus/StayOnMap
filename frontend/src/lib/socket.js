import { io } from 'socket.io-client'

let socket = null

export function connectSocket(userId) {
  if (socket?.connected) return socket

  const url = import.meta.env.VITE_API_URL?.replace('/api/v1', '') ?? 'http://localhost:4000'

  socket = io(url, {
    auth: { userId },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
  })

  return socket
}

export function getSocket() {
  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
