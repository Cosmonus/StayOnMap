// App-wide realtime wiring — the mobile mirror of
// frontend/src/hooks/useRealtimeUpdates.js.
//
// Mobile had none. The socket connected only inside ConversationScreen, so
// everywhere else the badges were driven purely by timers: the notification
// bell every 60s, the thread list every 15s, the mode-switch dot every 60s.
// Four intervals to learn about events the backend was already pushing, and
// still up to a minute late — an owner sitting on the map got no sign a renter
// had messaged until a timer came round.
//
// Both events are emitted to the personal `user:${id}` room, which every socket
// joins on connect, so they arrive whatever screen is mounted. `message:new` is
// deliberately NOT used: it goes to the conversation room, which you have only
// joined if that thread is already open — precisely the case a badge does not
// exist for.
//
// The catch-up for a socket that dozed is `connect` plus App.js's existing
// AppState foreground handler, not a timer.
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@features/auth/hooks/useAuth'
import { connectSocket, disconnectSocket } from '@lib/socket'

export function useRealtimeUpdates() {
  const { user } = useAuth()
  const qc = useQueryClient()

  useEffect(() => {
    if (!user) {
      // Logged out: tear the socket down so a stale-token connection does not
      // linger past sign-out on a shared device.
      disconnectSocket()
      return
    }

    const socket = connectSocket()

    // Refetch rather than bump optimistically: the counts are per hat (renter
    // vs host) and neither event says which side of the thread the reader is
    // on, so an optimistic +1 could only land on the wrong one half the time.
    function onMessageNotification() {
      qc.invalidateQueries({ queryKey: ['conversations'] })
      qc.invalidateQueries({ queryKey: ['chat-unread'] })
    }

    function onNotification() {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['notification-unread'] })
    }

    function onConnect() {
      onMessageNotification()
      onNotification()
    }

    socket.on('message:notification', onMessageNotification)
    socket.on('notification:new', onNotification)
    socket.on('connect', onConnect)
    return () => {
      socket.off('message:notification', onMessageNotification)
      socket.off('notification:new', onNotification)
      socket.off('connect', onConnect)
    }
  }, [user, qc])
}
