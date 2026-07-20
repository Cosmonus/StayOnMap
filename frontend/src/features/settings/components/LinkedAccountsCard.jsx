import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link2 } from 'lucide-react'
import { authService } from '@services/auth.service'
import { toast } from '@components/common/Toaster'
import { Card } from './SettingsPanel'

const PROVIDER_LABELS = { GOOGLE: 'Google' }
const PROVIDER_KEYS = { GOOGLE: 'google' }

/**
 * Settings → Linked accounts. Connect walks the same OAuth redirect as login
 * (the backend knows it's a link from the signed state); Disconnect is guarded
 * server-side so the last way into the account can never be removed.
 */
export default function LinkedAccountsCard() {
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: ['linked-accounts'],
    queryFn: () => authService.getLinkedAccounts().then((r) => r.data),
  })
  const { data: available } = useQuery({
    queryKey: ['oauth-providers'],
    queryFn: () => authService.getOAuthProviders().then((r) => r.data),
    staleTime: 60 * 60 * 1000,
  })

  const linkMutation = useMutation({
    mutationFn: (provider) => authService.startLinkProvider(provider),
    onSuccess: (res) => { window.location.href = res.data.redirectUrl },
    onError: (err) => toast.error('Error', err?.message ?? 'Could not start linking'),
  })

  const unlinkMutation = useMutation({
    mutationFn: (provider) => authService.unlinkProvider(provider),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['linked-accounts'] })
      toast.success('Disconnected', 'Sign-in method removed')
    },
    onError: (err) => toast.error('Cannot disconnect', err?.message ?? 'Something went wrong'),
  })

  // No providers configured on this deployment → the whole card is moot.
  if (!available?.length) return null

  const linked = new Map((data?.accounts ?? []).map((a) => [a.provider, a]))

  return (
    <Card icon={Link2} title="Linked accounts">
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-slate-50">
          <div>
            <p className="text-sm font-medium text-slate-800">Email &amp; password</p>
            <p className="text-[11px] text-slate-400">
              {data?.hasPassword ? 'A password is set on this account' : 'No password — use "Reset" above to set one'}
            </p>
          </div>
          {data?.hasPassword && (
            <span className="px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-[11px] font-bold shrink-0">Active</span>
          )}
        </div>

        {available.map(({ key, label }) => {
          const enumName = Object.keys(PROVIDER_KEYS).find((k) => PROVIDER_KEYS[k] === key)
          const account = linked.get(enumName)
          return (
            <div key={key} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800">{PROVIDER_LABELS[enumName] ?? label}</p>
                <p className="text-[11px] text-slate-400">
                  {account ? (account.providerEmail ?? 'Connected') : 'Not connected'}
                </p>
              </div>
              {account ? (
                <button
                  onClick={() => unlinkMutation.mutate(key)}
                  disabled={unlinkMutation.isPending}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 shrink-0"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={() => linkMutation.mutate(key)}
                  disabled={linkMutation.isPending}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-700 disabled:opacity-60 shrink-0"
                >
                  Connect
                </button>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
