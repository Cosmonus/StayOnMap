// App-wide realtime wiring. Until 2026-07-21 the socket connected only when
// ChatPanel mounted — anywhere else in the app a logged-in user had NO live
// connection, so a new message or notification surfaced only when the
// Header's 30-second unread poll came around. This hook connects the socket
// for every logged-in session and turns the push events the backend already
// emits into instant badge/list updates.
//
// The polls it replaced are GONE as of 2026-08-07 (Header 30s + 60s,
// NotificationBell 60s, ChatSurface 15s — four timers firing forever to be told
// nothing happened, and still up to half a minute late when something did).
// What they were really buying was a catch-up for a socket that dozed through
// an event, and that is what `connect` below does instead: a reconnect is the
// only moment a gap can have opened, so it is the only moment worth re-reading
// everything. Window focus is covered by React Query's own default.
//
// Both events used here are emitted to the personal `user:${id}` room, which
// every socket joins on connect — so they arrive whatever page you are on.
// `message:new` deliberately is NOT used: it goes to the conversation room,
// which you have only joined if that thread is already open, which is precisely
// the case a badge does not exist for.
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

    // Fires on every (re)connect, including the first. On the first it is a
    // no-op against fresh queries; on a reconnect it is the whole safety net.
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
