import { useQuery } from '@tanstack/react-query'
import { notificationService } from '@services/notification.service'

// Deliberately the SAME ['notifications'] key NotificationsScreen uses, so the
// bell and the list share one cache entry: opening the list and marking things
// read drops the badge with no extra request, and the screen's own socket
// listener + 60s refetch keep the badge fresh for free.
export function useUnreadNotifications() {
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationService.list().then((r) => r.data),
    staleTime: 30_000,
  })
  return (data ?? []).filter((n) => !n.isRead).length
}
