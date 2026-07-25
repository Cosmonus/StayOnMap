import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MonitorSmartphone } from 'lucide-react'
import { authService } from '@services/auth.service'
import { useAuth } from '@features/auth/hooks/useAuth'
import { toast } from '@components/common/Toaster'
import { Card } from './SettingsPanel'

function since(date) {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60_000)
  if (mins < 2) return 'Active now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/** Settings → Devices: every active session, revocable one at a time or all at once. */
export default function DevicesCard() {
  const qc = useQueryClient()
  const { signOut } = useAuth()

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['auth-sessions'],
    queryFn: () => authService.getSessions().then((r) => r.data),
  })

  const revokeMutation = useMutation({
    mutationFn: (id) => authService.revokeSession(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth-sessions'] })
      toast.success('Signed out', 'That device has been logged out')
    },
    onError: (err) => toast.error('Error', err?.message ?? 'Could not revoke the session'),
  })

  const logoutAllMutation = useMutation({
    mutationFn: () => authService.logoutAll(),
    onSuccess: () => signOut(), // every session is dead, including this one
    onError: (err) => toast.error('Error', err?.message ?? 'Could not log out everywhere'),
  })

  return (
    <Card icon={MonitorSmartphone} title="Devices">
      {isLoading ? (
        <div className="h-16 bg-slate-100 animate-pulse rounded-xl" />
      ) : !sessions?.length ? (
        <p className="text-[11px] text-slate-500">
          No active sessions listed yet — they appear from your next sign-in.
        </p>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{s.deviceLabel ?? 'Unknown device'}</p>
                <p className="text-[11px] text-slate-500">
                  {since(s.lastUsedAt)}{s.ip ? ` · ${s.ip}` : ''}
                </p>
              </div>
              <button
                onClick={() => revokeMutation.mutate(s.id)}
                disabled={revokeMutation.isPending}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 shrink-0"
              >
                Log out
              </button>
            </div>
          ))}
          <button
            onClick={() => logoutAllMutation.mutate()}
            disabled={logoutAllMutation.isPending}
            className="w-full mt-1 py-2 rounded-lg border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            {logoutAllMutation.isPending ? 'Signing out…' : 'Log out of all devices'}
          </button>
        </div>
      )}
    </Card>
  )
}
