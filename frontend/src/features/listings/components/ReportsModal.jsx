import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldAlert } from 'lucide-react'
import Modal from '@components/common/Modal'
import { toast } from '@components/common/Toaster'
import { reportService } from '@services/report.service'

// Reports filed against one of your listings, and the one reply you get.
//
// `GET /reports/mine` and `PATCH /:reportId/respond` shipped with the reports
// feature and had NO caller on either platform until 2026-08-10 — both clients
// even carried the service wrappers. So a listing could be reported, suspended
// on a risk score built partly from those reports, and its owner had no way to
// see what had been said or answer it. The Feature Map called the endpoint
// "live on both platforms", which was true of the route and false of the
// feature.
//
// WHAT AN OWNER SEES IS DECIDED SERVER-SIDE, and this component must not widen
// it. `getOwnerReports` selects category, severity, status, description,
// ownerResponse and createdAt — and deliberately NOT `reporterId` or
// `isAnonymous`. Reporting a listing is public and can be anonymous by design
// (anonymous fraud reports are the point), so an owner learning who filed one
// would turn a safety feature into a retaliation surface. Don't add a name here
// even if a future payload starts carrying one.

const SEVERITY_STYLE = {
  CRITICAL: 'bg-red-50 text-red-700 border-red-200',
  HIGH:     'bg-orange-50 text-orange-800 border-orange-200',
  MEDIUM:   'bg-amber-50 text-amber-800 border-amber-200',
  LOW:      'bg-slate-100 text-slate-600 border-slate-200',
}

const STATUS_LABEL = {
  PENDING:      'Awaiting review',
  UNDER_REVIEW: 'Being reviewed',
  RESOLVED:     'Resolved',
  DISMISSED:    'Dismissed',
}

const MAX_RESPONSE = 1000

function ReportCard({ propertyId, report }) {
  const qc = useQueryClient()
  const [draft, setDraft] = useState(report.ownerResponse ?? '')

  const mutation = useMutation({
    mutationFn: (body) => reportService.ownerRespond(propertyId, report.id, { ownerResponse: body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['owner-reports', propertyId] })
      toast.success('Response saved', 'Our moderators will see it with the report.')
    },
    onError: (err) => toast.error('Couldn’t save your response', err.message ?? 'Please try again'),
  })

  const changed = draft.trim() !== (report.ownerResponse ?? '').trim()
  const canSave = draft.trim().length > 0 && changed && !mutation.isPending

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${SEVERITY_STYLE[report.severity] ?? SEVERITY_STYLE.LOW}`}>
          {report.severity}
        </span>
        <span className="text-xs font-semibold text-slate-700">{report.category?.replace(/_/g, ' ')}</span>
        <span className="text-xs text-slate-500">· {STATUS_LABEL[report.status] ?? report.status}</span>
      </div>

      {report.description && (
        <p className="text-sm text-slate-600 leading-relaxed mb-3 whitespace-pre-wrap">{report.description}</p>
      )}

      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">
        {report.ownerResponse ? 'Your response' : 'Add your side'}
      </label>
      <textarea
        value={draft}
        onChange={(e) => e.target.value.length <= MAX_RESPONSE && setDraft(e.target.value)}
        rows={3}
        placeholder="What actually happened, in your words. Moderators read this alongside the report."
        className="w-full px-3.5 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder-slate-500 outline-none focus:border-[#111111] focus:bg-white focus:ring-2 focus:ring-black/8 transition resize-none leading-relaxed"
      />
      <div className="flex items-center justify-between gap-3 mt-2">
        <span className="text-xs text-slate-500">{MAX_RESPONSE - draft.length} left</span>
        <button
          type="button"
          disabled={!canSave}
          onClick={() => mutation.mutate(draft.trim())}
          className={`min-h-[44px] px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
            canSave ? 'bg-[#111111] hover:bg-[#2a2a2a] text-white' : 'bg-slate-100 text-slate-500 cursor-not-allowed'
          }`}
        >
          {mutation.isPending ? 'Saving…' : report.ownerResponse ? 'Update response' : 'Send response'}
        </button>
      </div>
    </div>
  )
}

export default function ReportsModal({ property, onClose }) {
  const open = !!property
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['owner-reports', property?.id],
    queryFn: () => reportService.ownerList(property.id).then(r => r.data),
    enabled: open,
  })

  const reports = data ?? []

  return (
    <Modal isOpen={open} onClose={onClose} title="Reports on this listing">
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          What people have flagged about <span className="font-semibold text-slate-800">{property?.title}</span>.
          {' '}Reports are anonymous — you can answer them, and a moderator reads both sides.
        </p>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map(i => <div key={i} className="h-32 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
        ) : isError ? (
          <div className="text-center py-6">
            <p className="text-sm text-slate-600">Couldn&apos;t load the reports on this listing.</p>
            <button
              onClick={() => refetch()}
              className="mt-3 min-h-[44px] px-5 py-3 rounded-xl bg-[#111111] text-white text-sm font-semibold hover:bg-[#2a2a2a] transition-colors"
            >
              Try again
            </button>
          </div>
        ) : reports.length === 0 ? (
          // The good state, and it must not read as a failure to load — this
          // is the outcome an owner wants, so it says so.
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center mx-auto mb-3">
              <ShieldAlert size={22} strokeWidth={1.8} />
            </div>
            <p className="text-sm font-semibold text-slate-700">Nobody has reported this listing</p>
            <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">
              If someone does, it will appear here and you can respond before a moderator decides.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map(r => <ReportCard key={r.id} propertyId={property.id} report={r} />)}
          </div>
        )}
      </div>
    </Modal>
  )
}
