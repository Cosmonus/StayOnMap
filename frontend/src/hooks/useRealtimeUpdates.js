// App-wide realtime wiring. Until 2026-07-21 the socket connected only when
// ChatPanel mounted — anywhere else in the app a logged-in user had NO live
// connection, so a new message or notification surfaced only when the
// Header's 30-second unread poll came around. This hook connects the socket
// for every logged-in session and turns the push events the backend already
// emits into instant badge/list updates. The polls stay as reconnect safety
// nets, not the primary path.
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@features/auth/hooks/useAuth'
import { connectSocket, disconnectSocket } from '@lib/socket'

export function useRealtimeUpdates() {
  const { user } = useAuth()
  const qc = useQueryClient()

  useEffect(() => {
    if (!user) {
      // Logged out: tear the socket down so a stale-token connection doesn't
      // linger past sign-out.
      disconnectSocket()
      return
    }

    const socket = connectSocket()

    function onMessageNotification() {
      // Refetch rather than bump optimistically: the badge is now per-hat
      // (renter vs host, see chat.service.js's getUnreadCount) and this event
      // carries no way to tell which side of the thread the reader is on, so
      // an optimistic +1 could only land on the wrong one half the time.
      qc.invalidateQueries({ queryKey: ['chat-unread'] })
      qc.invalidateQueries({ queryKey: ['conversations'] })
    }

    function onNotification() {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      // The per-hat unread counts behind the mode-switch badge.
      qc.invalidateQueries({ queryKey: ['notification-unread'] })
    }

    socket.on('message:notification', onMessageNotification)
    socket.on('notification:new', onNotification)
    return () => {
      socket.off('message:notification', onMessageNotification)
      socket.off('notification:new', onNotification)
    }
  }, [user, qc])
}
