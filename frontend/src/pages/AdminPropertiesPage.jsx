import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminService } from '@services/admin.service'
import TrustBadge from '@components/common/TrustBadge'

const STATUS_OPTIONS = ['DRAFT','PENDING','ACTIVE','INACTIVE','SUSPENDED','REJECTED']
const STATUS_COLORS  = { ACTIVE: 'text-green-700 bg-green-50', PENDING: 'text-yellow-700 bg-yellow-50', SUSPENDED: 'text-red-700 bg-red-50', REJECTED: 'text-red-700 bg-red-50', DRAFT: 'text-slate-600 bg-slate-50', INACTIVE: 'text-slate-600 bg-slate-50' }

export default function AdminPropertiesPage() {
  const qc = useQueryClient()
  const [filters, setFilters] = useState({ status: '', city: '', page: 1, limit: 20 })
  const { data, isLoading } = useQuery({ queryKey: ['admin-properties', filters], queryFn: () => adminService.properties(filters).then(r => r.data) })

  const mutation = useMutation({
    mutationFn: ({ id, status, note }) => adminService.setPropertyStatus(id, { status, note }),
    onSuccess: () => qc.invalidateQueries(['admin-properties']),
  })

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Properties</h1>
      <div className="flex gap-3 flex-wrap">
        <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value, page: 1 }))} className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input value={filters.city} onChange={e => setFilters(f => ({ ...f, city: e.target.value, page: 1 }))} placeholder="Filter by city" className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
      </div>
      {isLoading ? (
        <div className="h-48 bg-slate-50 rounded-xl animate-pulse" />
      ) : (
        <div className="border border-slate-100 rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Title', 'City', 'Rent', 'Status', 'Trust', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(data?.properties ?? []).map(p => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800 max-w-48 truncate">{p.title}</td>
                  <td className="px-4 py-3 text-slate-600">{p.city}</td>
                  <td className="px-4 py-3 text-slate-700">₹{Number(p.rent).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] ?? ''}`}>{p.status}</span></td>
                  <td className="px-4 py-3">{p.trustScore?.badge ? <TrustBadge badge={p.trustScore.badge} /> : <span className="text-slate-300 text-xs">—</span>}</td>
                  <td className="px-4 py-3">
                    <select
                      defaultValue=""
                      onChange={e => { if (e.target.value) mutation.mutate({ id: p.id, status: e.target.value }); e.target.value = '' }}
                      className="border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                    >
                      <option value="">Change status</option>
                      {STATUS_OPTIONS.filter(s => s !== p.status).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
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
