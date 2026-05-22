import { useQuery } from '@tanstack/react-query'
import { adminService } from '@services/admin.service'

function StatCard({ label, value, sub, color = 'text-slate-800' }) {
  return (
    <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm">
      <p className="text-xs text-slate-500 font-medium">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value ?? '—'}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function AdminDashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: () => adminService.analytics().then(r => r.data),
  })

  if (isLoading) return <div className="p-8 text-slate-400 text-sm">Loading analytics...</div>
  if (error)     return <div className="p-8 text-red-500 text-sm">Failed to load analytics.</div>

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-slate-800">Admin Dashboard</h1>

      <section>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Users</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard label="Total Users"       value={data?.users.total}          sub={`${data?.users.newToday} new today`} />
          <StatCard label="New This Week"     value={data?.users.newThisWeek}    />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Properties</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total"     value={data?.properties.total}     />
          <StatCard label="Active"    value={data?.properties.active}    color="text-green-700" />
          <StatCard label="Pending"   value={data?.properties.pending}   color="text-yellow-700" />
          <StatCard label="Suspended" value={data?.properties.suspended} color="text-red-700" />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Reports & Safety</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Reports"    value={data?.reports.total}           />
          <StatCard label="Open Reports"     value={data?.reports.open}            color="text-orange-700" />
          <StatCard label="Critical Reports" value={data?.reports.critical}        color="text-red-700" />
          <StatCard label="Verifications"    value={data?.verificationsPending}    color="text-yellow-700" sub="pending review" />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Risk</h2>
        <div className="grid grid-cols-2 gap-4">
          <StatCard label="High Risk Properties"   value={data?.risk.highRisk}   color="text-orange-700" />
          <StatCard label="Suspicious Properties"  value={data?.risk.suspicious} color="text-red-700" />
        </div>
      </section>
    </div>
  )
}
