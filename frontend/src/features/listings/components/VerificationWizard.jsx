import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, FileText } from 'lucide-react'
import { verificationService } from '@services/verification.service'
import { toast } from '@components/common/Toaster'
import Select from '@components/common/Select'

// Property/business documents only — identity docs (Aadhaar/PAN/govt ID/
// selfie) paused 2026-07-21 pending legal review; the backend refuses them.
const DOC_TYPES = [
  { value: 'PROPERTY_TAX',      label: 'Property Tax Receipt' },
  { value: 'UTILITY_BILL',      label: 'Utility Bill' },
  { value: 'RENTAL_AGREEMENT',  label: 'Rental / Sale Agreement' },
  { value: 'PATTA_TITLE',       label: 'Patta / Title Deed' },
  { value: 'GST',               label: 'GST Certificate' },
  { value: 'TRADE_LICENSE',     label: 'Trade / Shop License' },
  { value: 'HOMESTAY_PERMIT',   label: 'Homestay / Tourism Permit' },
  { value: 'OTHER',             label: 'Other' },
]

const STATUS_CONFIG = {
  PENDING:      { label: 'Pending review',  bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-400' },
  UNDER_REVIEW: { label: 'Under review',    bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-400' },
  VERIFIED:     { label: 'Verified',        bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-500' },
  REJECTED:     { label: 'Rejected',        bg: 'bg-red-50',    text: 'text-red-600',    dot: 'bg-red-400' },
}

function StatusPill({ status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

// How the document's address compares to the listing's — rendered from the
// server's deterministic comparison, never computed client-side. Only a pincode
// contradiction gets the amber accusation; low text overlap is a nudge to
// double-check, because spellings of the same address legitimately differ.
function AddressMatchNote({ match }) {
  if (!match) return null
  if (match.verdict === 'mismatch') {
    return (
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
        <p className="text-xs font-semibold text-amber-800">The document and listing addresses disagree</p>
        <p className="text-xs text-amber-700 mt-0.5">{match.notes[0]}</p>
        {match.documentPincodeArea && (
          <p className="text-xs text-amber-700 mt-0.5">
            The document&apos;s pincode is in {match.documentPincodeArea.districts.join('/')}, {match.documentPincodeArea.state}.
          </p>
        )}
        <p className="text-xs text-amber-700 mt-1.5">
          Fix the listing address, or upload the document that matches it — a reviewer will compare them.
        </p>
      </div>
    )
  }
  if (match.verdict === 'partial') {
    return <p className="text-xs text-slate-500">{match.notes[0]}</p>
  }
  if (match.verdict === 'match') {
    return <p className="text-xs text-slate-500">Document address matches the listing{match.pincode.match ? ' (pincode confirmed)' : ''}.</p>
  }
  return null
}

export default function VerificationWizard({ propertyId, propertyTitle }) {
  const qc = useQueryClient()
  const [docType, setDocType] = useState(DOC_TYPES[0].value)
  const [docUrl, setDocUrl] = useState('')
  const [urlError, setUrlError] = useState('')
  const [docAddress, setDocAddress] = useState('')

  const { data: verification, isLoading } = useQuery({
    queryKey: ['verification', propertyId],
    queryFn: () => verificationService.getStatus(propertyId).then(r => r.data),
    retry: (_, err) => err?.response?.status !== 404,
  })

  const submitMutation = useMutation({
    mutationFn: () => verificationService.submit(
      propertyId,
      docAddress.trim() ? { documentAddress: docAddress.trim() } : undefined
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['verification', propertyId] })
      toast.success('Submitted', 'Verification request sent. Add your documents below.')
    },
    onError: (err) => toast.error('Error', err?.message ?? 'Failed to submit'),
  })

  const docMutation = useMutation({
    mutationFn: (data) => verificationService.addDocument(propertyId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['verification', propertyId] })
      setDocUrl('')
      toast.success('Added', 'Document added successfully')
    },
    onError: (err) => toast.error('Error', err?.message ?? 'Failed to add document'),
  })

  function handleAddDoc(e) {
    e.preventDefault()
    setUrlError('')
    try { new URL(docUrl) } catch {
      setUrlError('Please enter a valid URL (e.g. https://drive.google.com/...)')
      return
    }
    docMutation.mutate({ type: docType, url: docUrl })
  }

  const canAddDocs = verification && verification.status !== 'VERIFIED'

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Property title */}
      <div className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
        <p className="text-xs text-slate-500 mb-0.5">Verifying ownership for</p>
        <p className="text-sm font-semibold text-slate-800">{propertyTitle}</p>
      </div>

      {/* Current status */}
      {verification ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Verification status</p>
            <StatusPill status={verification.status} />
          </div>

          {verification.status === 'VERIFIED' && (
            <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
              <ShieldCheck className="w-5 h-5 text-green-500 shrink-0 mt-0.5" strokeWidth={2} />
              <div>
                <p className="text-sm font-semibold text-green-800">You&apos;re verified!</p>
                <p className="text-xs text-green-600 mt-0.5">Your listing now shows the Verified Owner badge to renters.</p>
              </div>
            </div>
          )}

          {verification.status === 'REJECTED' && verification.adminNote && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-xs font-semibold text-red-700 mb-1">Reason for rejection</p>
              <p className="text-sm text-red-600">{verification.adminNote}</p>
            </div>
          )}

          {/* Documents submitted */}
          {verification.documents?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Documents submitted</p>
              <div className="space-y-2">
                {verification.documents.map(doc => (
                  <div key={doc.id} className="flex items-center gap-3 px-3.5 py-2.5 bg-white border border-slate-100 rounded-lg">
                    <FileText className="w-4 h-4 text-slate-500 shrink-0" strokeWidth={1.8} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700">{DOC_TYPES.find(d => d.value === doc.type)?.label ?? doc.type}</p>
                      <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-brand-600 hover:underline truncate block max-w-xs">
                        {doc.url}
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 bg-brand-50 border border-brand-100 rounded-xl space-y-2">
            <p className="text-sm font-semibold text-brand-800">Why get verified?</p>
            <ul className="text-xs text-brand-700 space-y-1 list-disc list-inside">
              <li>Earn the Verified Owner badge on your listing</li>
              <li>Builds trust with potential tenants</li>
              <li>Increases appointment requests</li>
            </ul>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1.5">Property address as printed on your document</p>
            <input
              value={docAddress}
              onChange={(e) => setDocAddress(e.target.value)}
              placeholder="Exactly as it appears on the tax bill / deed"
              maxLength={300}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
            <p className="text-xs text-slate-500 mt-1">
              The reviewer compares this against your listing address — a match speeds verification up.
            </p>
          </div>
          <button
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending}
            className="w-full py-2.5 bg-[#111111] text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {submitMutation.isPending ? 'Starting…' : 'Start verification'}
          </button>
        </div>
      )}

      {/* How the declared document address compares to the listing — computed
          server-side, fresh against the CURRENT listing address on every load. */}
      {verification?.addressMatch && <AddressMatchNote match={verification.addressMatch} />}

      {/* Add document form */}
      {canAddDocs && (
        <form onSubmit={handleAddDoc} className="space-y-3 border-t border-slate-100 pt-4">
          <p className="text-sm font-semibold text-slate-700">Add a document</p>
          <p className="text-xs text-slate-500">Upload your document to Google Drive / Dropbox and paste the public link here.</p>

          <div className="space-y-2">
            <Select value={docType} onChange={setDocType} options={DOC_TYPES} />

            <input
              type="url"
              placeholder="https://drive.google.com/..."
              value={docUrl}
              onChange={e => { setDocUrl(e.target.value); setUrlError('') }}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 ${urlError ? 'border-red-300 focus:ring-red-300/30' : 'border-slate-200'}`}
            />
            {urlError && <p className="text-xs text-red-500">{urlError}</p>}
          </div>

          <button
            type="submit"
            disabled={!docUrl || docMutation.isPending}
            className="w-full py-2 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {docMutation.isPending ? 'Adding…' : 'Add document'}
          </button>
        </form>
      )}

      {/* Re-submit after rejection */}
      {verification?.status === 'REJECTED' && (
        <button
          onClick={() => submitMutation.mutate()}
          disabled={submitMutation.isPending}
          className="w-full py-2.5 bg-[#111111] text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {submitMutation.isPending ? 'Resubmitting…' : 'Resubmit for review'}
        </button>
      )}
    </div>
  )
}
