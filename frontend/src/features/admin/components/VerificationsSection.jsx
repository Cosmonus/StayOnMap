import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText } from 'lucide-react'
import { adminService } from '@services/admin.service'

const STATUS_TABS = ['PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED']

const MATCH_STYLE = {
  match: 'bg-green-50 text-green-700',
  partial: 'bg-slate-100 text-slate-600',
  mismatch: 'bg-amber-50 text-amber-800',
  not_comparable: 'bg-slate-50 text-slate-400',
}

// The address comparison is the reviewer's context, not their verdict —
// verification stays admin judgement (docs/verification.md). Only a pincode
// contradiction reads as a warning; low text overlap is styled neutrally
// because spellings of the same address legitimately differ.
function AddressMatch({ v }) {
  if (!v.documentAddress) return null
  const m = v.addressMatch
  return (
    <div className="mt-2 text-xs space-y-1 bg-slate-50 rounded-lg p-2.5">
      <p><span className="text-slate-400">Listing:</span> <span className="text-slate-700">{v.property?.address}{v.property?.pincode ? `, ${v.property.pincode}` : ''}</span></p>
      <p><span className="text-slate-400">Document:</span> <span className="text-slate-700">{v.documentAddress}</span></p>
      {m && (
        <p className="flex items-center gap-2 flex-wrap">
          <span className={`px-2 py-0.5 rounded-full font-semibold ${MATCH_STYLE[m.verdict] ?? MATCH_STYLE.not_comparable}`}>
            {m.verdict.replace('_', ' ')}
          </span>
          {m.notes?.[0] && <span className="text-slate-500">{m.notes[0]}</span>}
          {m.documentPincodeArea && (
            <span className="text-slate-500">
              Document pincode is in {m.documentPincodeArea.districts.join('/')}, {m.documentPincodeArea.state}.
            </span>
          )}
        </p>
      )}
    </div>
  )
}

export default function VerificationsSection() {
  const qc = useQueryClient()
  const [status, setStatus] = useState('PENDING')
  const [notes, setNotes] = useState({})

  const { data, isLoading } = useQuery({
    queryKey: ['admin-verifications', status],
    queryFn: () => adminService.verifications({ status, limit: 30 }).then(r => r.data),
  })

  const mutation = useMutation({
    mutationFn: ({ id, next, adminNote }) => adminService.reviewVerification(id, { status: next, adminNote }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-verifications'] }),
  })

  const rows = data?.verifications ?? data ?? []

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Ownership Verifications</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Read the documents against the listing — the address comparison is context, the decision is yours.
        </p>
      </div>

      <div className="flex gap-2">
        {STATUS_TABS.map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${status === s ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="h-40 bg-slate-100 animate-pulse rounded-2xl" />
      ) : rows.length === 0 ? (
        <div className="text-center py-12 bg-white border border-slate-100 rounded-2xl text-sm text-slate-400">
          No {status.toLowerCase().replace('_', ' ')} verifications.
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map(v => (
            <div key={v.id} className="bg-white border border-slate-100 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{v.property?.title ?? v.propertyId}</p>
                  <p className="text-xs text-slate-400">
                    Owner: {v.owner?.name ?? v.ownerId}{v.owner?.email ? ` · ${v.owner.email}` : ''}
                  </p>
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 shrink-0">{v.status}</span>
              </div>

              <AddressMatch v={v} />

              {v.documents?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {v.documents.map(d => (
                    <a
                      key={d.id}
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-brand-700 hover:bg-slate-50"
                    >
                      <FileText size={12} strokeWidth={1.8} /> {d.type}
                    </a>
                  ))}
                </div>
              )}

              {(v.status === 'PENDING' || v.status === 'UNDER_REVIEW') && (
                <div className="mt-3 pt-3 border-t border-slate-50 flex items-center gap-2 flex-wrap">
                  <input
                    value={notes[v.id] ?? ''}
                    onChange={e => setNotes(n => ({ ...n, [v.id]: e.target.value }))}
                    placeholder="Note to the owner (required for rejection)"
                    className="flex-1 min-w-[220px] border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  />
                  <button
                    onClick={() => mutation.mutate({ id: v.id, next: 'VERIFIED', adminNote: notes[v.id] || undefined })}
                    disabled={mutation.isPending}
                    className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => mutation.mutate({ id: v.id, next: 'REJECTED', adminNote: notes[v.id] || undefined })}
                    disabled={mutation.isPending || !(notes[v.id] ?? '').trim()}
                    className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
