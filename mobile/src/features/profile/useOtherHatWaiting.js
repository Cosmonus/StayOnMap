import { useQuery } from '@tanstack/react-query'
import { chatService } from '@services/chat.service'
import { notificationService } from '@services/notification.service'
import { supportService } from '@services/support.service'
import { useAuth } from '@features/auth/hooks/useAuth'
import { useUiStore } from '@store/uiStore'

// How many unread things are waiting in the hat you are NOT wearing.
//
// Messages and notifications are both per hat now — each mode lists only its
// own — which is right, and leaves one hole: something addressed to the other
// hat is invisible everywhere, with nothing on screen to suggest switching.
// The mode switch is the one control that can honestly say so, and this is
// what it reads. Mirrors web's Header (`unreadOtherMode`).
//
// Rides on `['conversations']`, which AppTabs already fetches for the tab
// badge, so the only new request is the small unread-counts one.
export function useOtherHatWaiting() {
  const { user } = useAuth()
  const hostMode = useUiStore((s) => s.hostMode)

  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => chatService.conversations().then((r) => r.data),
    enabled: !!user,
  })

  const { data: notifs } = useQuery({
    queryKey: ['notification-unread'],
    queryFn: () => notificationService.unread().then((r) => r.data),
    enabled: !!user,
    // No interval — useRealtimeUpdates owns both keys this hook reads.
  })

  // Support is per hat too, so it has the same hole and belongs in the same
  // answer. Rides on the key the Help row already fetches — no extra request.
  const { data: support } = useQuery({
    queryKey: ['support-unread'],
    queryFn: () => supportService.unread().then((r) => r.data),
    enabled: !!user,
  })

  const messages = conversations
    .filter((c) => (hostMode ? c.tenantId === user?.id : c.ownerId === user?.id))
    .reduce((n, c) => n + (c._count?.messages ?? 0), 0)

  return messages
    + ((hostMode ? notifs?.asTenant : notifs?.asOwner) ?? 0)
    + ((hostMode ? support?.asTenant : support?.asOwner) ?? 0)
}
