import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Database } from 'lucide-react'
import { adminService } from '@services/admin.service'

// The latest ETL run per dataset.
//
// This exists because a partially-failed OSM fetch was previously invisible:
// the seeder warned to a terminal nobody kept, and the only symptom was a POI
// list that looked thin — indistinguishable from an area that genuinely is
// thin. `complete: false` is the column that separates those two, so it is the
// most prominent thing on each row rather than a detail inside the notes.
//
// Read-only by design. A quality report records what a seeder observed; an
// operator editing it would defeat the point of keeping it.

const DATASET_LABELS = {
  poi_index: 'Points of interest',
  boundaries: 'Administrative boundaries',
  weather_normals: 'Climate normals',
}

function ageOf(runAt) {
  const days = Math.floor((Date.now() - new Date(runAt).getTime()) / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

// A seed this old is worth re-running. Not an error — OSM moves slowly — but
// the number of ghosts and misses grows with it.
const STALE_DAYS = 120

function Row({ report }) {
  const stale = (Date.now() - new Date(report.runAt).getTime()) / 86_400_000 > STALE_DAYS

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-slate-800">
          {DATASET_LABELS[report.dataset] ?? report.dataset}
        </p>
        {report.scope && <p className="text-xs text-slate-400 mt-0.5">{report.scope}</p>}
      </td>
      <td className="px-4 py-3 text-sm text-slate-600 tabular-nums">
        {report.recordCount.toLocaleString('en-IN')}
      </td>
      <td className="px-4 py-3 text-sm text-slate-600 tabular-nums">
        {report.completenessPct != null ? `${report.completenessPct}%` : '—'}
      </td>
      <td className="px-4 py-3">
        {report.complete ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700">
            <CheckCircle2 size={13} strokeWidth={2.5} />
            Full coverage
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
            <AlertTriangle size={13} strokeWidth={2.5} />
            Incomplete — re-run
          </span>
        )}
      </td>
      <td className={`px-4 py-3 text-sm ${stale ? 'text-amber-700' : 'text-slate-500'}`}>
        {ageOf(report.runAt)}
      </td>
    </tr>
  )
}

export default function DataQualityPanel() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-data-quality'],
    queryFn: () => adminService.getDataQuality().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  return (
    <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
        <Database size={15} strokeWidth={2} className="text-slate-400" />
        <p className="text-sm font-semibold text-slate-700">Spatial data coverage</p>
      </div>

      {isLoading && (
        <div className="px-5 py-8">
          <div className="h-4 bg-slate-100 animate-pulse rounded-xl w-1/3" />
        </div>
      )}

      {isError && !isLoading && (
        <div className="px-5 py-6 text-sm text-red-700">Failed to load coverage reports.</div>
      )}

      {data && data.length === 0 && (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-slate-500">No ETL runs recorded yet.</p>
          <p className="text-xs text-slate-400 mt-1">
            Run the seeders in <code className="text-slate-500">backend/scripts/</code> — see
            operator-actions.md §1.4.
          </p>
        </div>
      )}

      {data && data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Dataset</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Records</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Named</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Coverage</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Last run</th>
              </tr>
            </thead>
            <tbody>
              {data.map(report => <Row key={`${report.dataset}:${report.scope ?? ''}`} report={report} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
