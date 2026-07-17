import { io } from 'socket.io-client'

let socket = null

export function connectSocket() {
  if (socket?.connected) return socket

  const url = import.meta.env.VITE_API_BASE_URL?.replace('/api/v1', '') ?? 'http://localhost:4000'

  socket = io(url, {
    // Re-read the token on every (re)connect attempt so a freshly-issued
    // token is always used — the server verifies this token, it never
    // trusts a client-supplied userId.
    auth: (cb) => {
      cb({ token: localStorage.getItem('user_token') })
    },
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
