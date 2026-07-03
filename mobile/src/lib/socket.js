import { io } from 'socket.io-client'
import AsyncStorage from '@react-native-async-storage/async-storage'

let socket = null

export function connectSocket() {
  if (socket?.connected) return socket

  const url = process.env.EXPO_PUBLIC_API_BASE_URL?.replace('/api/v1', '')

  socket = io(url, {
    // Re-read the token on every (re)connect attempt so a freshly-issued
    // token is always used — the server verifies this token in an io.use()
    // middleware, it never trusts a client-supplied userId.
    auth: async (cb) => {
      const token = await AsyncStorage.getItem('user_token')
      cb({ token })
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
