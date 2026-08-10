import { useQuery } from '@tanstack/react-query'
import { supportService } from '@services/support.service'
import { useAuth } from '@features/auth/hooks/useAuth'
import { useUiStore } from '@store/uiStore'

/**
 * How many support requests in THIS hat have an answer you have not read.
 *
 * Support lives behind an account-menu row with no other signal, so a reply
 * could otherwise sit unread indefinitely: the bell announces it once, and the
 * row that leads to it never mentions it again.
 *
 * Per hat, like messages and notifications, and for the same reason — an
 * owner-side answer badging the renter's menu would point at a list that
 * deliberately excludes it, which is the exact bug the chat unread count had.
 *
 * Counts CASES, not replies: the row answers "is there something here", and
 * three messages on one request is one thing to go and read.
 *
 * Returns 0 while loading rather than undefined, so `count={supportWaiting}`
 * renders nothing rather than flashing a number in and out.
 */
export function useSupportWaiting() {
  const { user } = useAuth()
  const hostMode = useUiStore((s) => s.hostMode)

  const { data } = useQuery({
    queryKey: ['support-unread'],
    queryFn: () => supportService.unread().then((r) => r.data),
    enabled: !!user,
  })

  return (hostMode ? data?.asOwner : data?.asTenant) ?? 0
}
