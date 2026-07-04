import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { reportService } from '@services/report.service'
import Select from '@components/common/Select'

const SEVERITIES = [
  { value: 'LOW',      label: 'Low' },
  { value: 'MEDIUM',   label: 'Medium' },
  { value: 'HIGH',     label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
]

const CATEGORIES = [
  { value: 'FRAUD',                label: 'Fraud / Scam' },
  { value: 'FAKE_PHOTOS',          label: 'Fake Photos' },
  { value: 'UNAUTHORIZED_LISTING', label: 'Unauthorized Listing' },
  { value: 'WRONG_PRICING',        label: 'Wrong Pricing' },
  { value: 'UNSAFE',               label: 'Unsafe Conditions' },
  { value: 'HARASSMENT',           label: 'Harassment' },
  { value: 'OWNER_MISCONDUCT',     label: 'Owner Misconduct' },
  { value: 'DUPLICATE',            label: 'Duplicate Listing' },
  { value: 'FALSE_INFO',           label: 'False Information' },
  { value: 'BROKER_SPAM',          label: 'Broker Spam' },
  { value: 'OTHER',                label: 'Other' },
]

export default function ReportButton({ propertyId }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ category: '', description: '', severity: 'LOW', isAnonymous: false })
  const [submitted, setSubmitted] = useState(false)

  const mutation = useMutation({
    mutationFn: (data) => reportService.submit(propertyId, data),
    onSuccess: () => setSubmitted(true),
  })

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-600 transition-colors"
      >
        <span className="text-base leading-none">&#9872;</span> Report listing
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        {submitted ? (
          <div className="text-center py-6">
            <p className="text-lg font-semibold text-slate-800">Report submitted</p>
            <p className="text-sm text-slate-500 mt-1">Our team will review it within 24–48 hours.</p>
            <button onClick={() => { setOpen(false); setSubmitted(false) }} className="mt-4 px-6 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors">Close</button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-800">Report this listing</h2>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>
            <div className="space-y-4">
              <Select
                label="Category"
                value={form.category}
                onChange={(category) => setForm(f => ({ ...f, category }))}
                placeholder="Select category"
                options={CATEGORIES}
              />
              <Select
                label="Severity"
                value={form.severity}
                onChange={(severity) => setForm(f => ({ ...f, severity }))}
                options={SEVERITIES}
              />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} rows={4} placeholder="Describe the issue in detail (min 20 characters)" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isAnonymous} onChange={(e) => setForm(f => ({ ...f, isAnonymous: e.target.checked }))} className="rounded" />
                <span className="text-sm text-slate-600">Submit anonymously</span>
              </label>
            </div>
            {mutation.isError && <p className="mt-3 text-sm text-red-600">Failed to submit. Please try again.</p>}
            <div className="flex gap-3 mt-6">
              <button onClick={() => setOpen(false)} className="flex-1 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
              <button
                disabled={!form.category || form.description.length < 20 || mutation.isPending}
                onClick={() => mutation.mutate(form)}
                className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {mutation.isPending ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
