import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminService } from '@services/admin.service'

export default function AdminUsersPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', search],
    queryFn: () => adminService.users({ search, limit: 50 }).then(r => r.data),
    keepPreviousData: true,
  })
  const blockMutation = useMutation({
    mutationFn: ({ id, blocked }) => adminService.blockUser(id, { blocked, reason: blocked ? 'Admin action' : 'Unblocked' }),
    onSuccess: () => qc.invalidateQueries(['admin-users']),
  })

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Users</h1>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..." className="w-full max-w-sm border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
      {isLoading ? <div className="h-48 bg-slate-50 rounded-xl animate-pulse" /> : (
        <div className="border border-slate-100 rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>{['Name','Email','Role','Properties','Status','Action'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(data?.users ?? []).map(u => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">{u.name}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-48 truncate">{u.email}</td>
                  <td className="px-4 py-3 text-slate-500">{u.role}</td>
                  <td className="px-4 py-3 text-slate-500">{u._count?.properties ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.isBlocked ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                      {u.isBlocked ? 'Blocked' : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => blockMutation.mutate({ id: u.id, blocked: !u.isBlocked })}
                      className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${u.isBlocked ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
                    >
                      {u.isBlocked ? 'Unblock' : 'Block'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
