import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ban } from 'lucide-react'
import { userService } from '@services/user.service'
import { toast } from '@components/common/Toaster'
import Avatar from '@features/chat/components/shared/Avatar'
import { Card } from './SettingsPanel'

/**
 * Settings → Blocked people: everyone this user has blocked, with a way back.
 *
 * This card is not optional garnish. The block confirmation in chat says "You
 * can undo this in Settings", and a promise the app doesn't keep is worse than
 * no promise — it is the same shape as `showExactLocation`, a control that
 * describes a behaviour nothing implements.
 *
 * Only blocks this user MADE are listed. Blocks against them are deliberately
 * absent: showing those would tell someone they have been blocked, which is the
 * signal the server's neutral error message exists to withhold.
 */
export default function BlockedUsersCard() {
  const qc = useQueryClient()

  const { data: blocked, isLoading } = useQuery({
    queryKey: ['blocked-users'],
    queryFn: () => userService.listBlocked().then((r) => r.data),
  })

  const unblock = useMutation({
    mutationFn: (userId) => userService.unblockUser(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['blocked-users'] })
      // Their threads come back into the inbox the moment the block lifts, so
      // the list that hid them has to be refetched too.
      qc.invalidateQueries({ queryKey: ['conversations'] })
      toast.success('Unblocked', 'They can message you again')
    },
    onError: (err) => toast.error('Error', err?.response?.data?.message ?? 'Could not unblock'),
  })

  return (
    <Card icon={Ban} title="Blocked people">
      {isLoading ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="h-14 bg-slate-100 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : !blocked?.length ? (
        // Empty is the good state here, so it reads as reassurance rather than
        // as an absence to go and fill.
        <p className="text-sm text-slate-500 leading-relaxed">
          You haven&apos;t blocked anyone. If someone is bothering you, open your
          conversation with them and choose Block.
        </p>
      ) : (
        <ul className="space-y-2 list-none p-0 m-0">
          {blocked.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 rounded-xl border border-slate-200"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Avatar name={row.user?.name} url={row.user?.avatarUrl} size={40} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {row.user?.name ?? 'Someone'}
                  </p>
                  <p className="text-xs text-slate-500">
                    Blocked {new Date(row.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => unblock.mutate(row.user.id)}
                disabled={unblock.isPending}
                className="shrink-0 min-h-[44px] px-5 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 transition-colors"
              >
                Unblock
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
