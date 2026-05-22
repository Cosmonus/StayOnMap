import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminService } from '@services/admin.service'

const SEV_COLOR = { LOW: 'bg-slate-100 text-slate-600', MEDIUM: 'bg-yellow-100 text-yellow-800', HIGH: 'bg-orange-100 text-orange-800', CRITICAL: 'bg-red-100 text-red-800' }
const ACTIONS = ['APPROVE','REJECT','SUSPEND','INVESTIGATE','DISMISS','WARN_OWNER']

export default function AdminReportsPage() {
  const qc = useQueryClient()
  const [filters, setFilters] = useState({ status: 'PENDING', severity: '', page: 1, limit: 20 })
  const { data, isLoading } = useQuery({ queryKey: ['admin-reports', filters], queryFn: () => adminService.reports(filters).then(r => r.data) })
  const mutation = useMutation({
    mutationFn: ({ id, action }) => adminService.moderateReport(id, { action }),
    onSuccess: () => qc.invalidateQueries(['admin-reports']),
  })

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Reports</h1>
      <div className="flex gap-3 flex-wrap">
        {['PENDING','UNDER_REVIEW','RESOLVED','DISMISSED'].map(s => (
          <button key={s} onClick={() => setFilters(f => ({ ...f, status: s, page: 1 }))} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filters.status === s ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{s.replace('_', ' ')}</button>
        ))}
      </div>
      {isLoading ? <div className="h-48 bg-slate-50 rounded-xl animate-pulse" /> : (
        <div className="space-y-3">
          {(data?.reports ?? []).map(r => (
            <div key={r.id} className="border border-slate-100 rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEV_COLOR[r.severity]}`}>{r.severity}</span>
                    <span className="text-xs text-slate-500">{r.category.replace(/_/g,' ')}</span>
                    <span className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleDateString('en-IN')}</span>
                  </div>
                  <p className="text-sm text-slate-700 mt-2 line-clamp-2">{r.description}</p>
                  {r.property && <p className="text-xs text-slate-400 mt-1">{r.property.title} · {r.property.city}</p>}
                  {r.ownerResponse && (
                    <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg">
                      <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide mb-0.5">Owner response</p>
                      <p className="text-xs text-slate-700 line-clamp-2">{r.ownerResponse}</p>
                    </div>
                  )}
                </div>
                <select defaultValue="" onChange={e => { if (e.target.value) mutation.mutate({ id: r.id, action: e.target.value }); e.target.value = '' }} className="border border-slate-200 rounded-lg px-2 py-1 text-xs flex-shrink-0 focus:outline-none focus:ring-1 focus:ring-brand-500">
                  <option value="">Action</option>
                  {ACTIONS.map(a => <option key={a} value={a}>{a.replace('_',' ')}</option>)}
                </select>
              </div>
            </div>
          ))}
          {(data?.reports ?? []).length === 0 && <div className="text-center py-12 text-sm text-slate-400">No reports found.</div>}
        </div>
      )}
    </div>
  )
}
