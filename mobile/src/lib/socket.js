import { io } from 'socket.io-client'
import { supabase } from './supabase'

let socket = null

export function connectSocket() {
  if (socket?.connected) return socket

  const url = process.env.EXPO_PUBLIC_API_BASE_URL?.replace('/api/v1', '')

  socket = io(url, {
    // Re-read the session on every (re)connect attempt so a refreshed token
    // is always used — the server verifies this token in an io.use()
    // middleware, it never trusts a client-supplied userId.
    auth: async (cb) => {
      const { data: { session } } = await supabase.auth.getSession()
      cb({ token: session?.access_token })
    },
    transports: ['websocket'],
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
