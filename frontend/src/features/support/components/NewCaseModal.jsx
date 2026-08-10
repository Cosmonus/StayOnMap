import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Modal from '@components/common/Modal'
import Select from '@components/common/Select'
import { toast } from '@components/common/Toaster'
import { supportService } from '@services/support.service'
import { CATEGORY_LABEL, TENANT_CATEGORIES, OWNER_CATEGORIES } from './supportCopy'

/**
 * Open a support request.
 *
 * Three fields and nothing else. Every ticketing system's instinct is to ask
 * for priority, severity, environment and a dozen tags — and every one of them
 * is a question the person cannot answer about a problem they do not yet
 * understand. Priority is ours to set; the category routes it; the description
 * is the actual content.
 *
 * `context` carries what the app already knows — the listing they were looking
 * at, the visit they were chasing — so nobody retypes an id we have. The
 * server verifies each one belongs to them and silently drops what does not.
 */
const MAX_DESCRIPTION = 4000

export default function NewCaseModal({ hat, onClose, onCreated, context = {} }) {
  const qc = useQueryClient()
  const categories = hat === 'OWNER' ? OWNER_CATEGORIES : TENANT_CATEGORIES

  const [type, setType] = useState('')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')

  const create = useMutation({
    mutationFn: () => supportService.createCase({
      type, subject: subject.trim(), description: description.trim(), hat, ...context,
    }).then((r) => r.data),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['support-cases'] })
      onCreated?.(created.id)
    },
    onError: (err) => toast.error('Couldn’t send that', err.message ?? 'Please try again'),
  })

  // 20 characters, matching the server. Enforced here too so somebody learns it
  // before they press send rather than after — but the server is the rule, and
  // this is only the courtesy.
  const ready = type && subject.trim().length >= 3 && description.trim().length >= 20 && !create.isPending

  return (
    <Modal isOpen onClose={onClose} title="New support request">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">
            What is it about?
          </label>
          <Select
            value={type}
            onChange={setType}
            placeholder="Choose one"
            options={categories.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">
            One line
          </label>
          <input
            value={subject}
            onChange={(e) => e.target.value.length <= 140 && setSubject(e.target.value)}
            placeholder="The owner is asking for money before a viewing"
            className="min-h-[44px] w-full px-3.5 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder-slate-500 outline-none focus:border-[#111111] focus:bg-white focus:ring-2 focus:ring-black/8 transition"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest">What happened?</label>
            <span className="text-xs text-slate-500 tabular-nums">{MAX_DESCRIPTION - description.length}</span>
          </div>
          <textarea
            value={description}
            onChange={(e) => e.target.value.length <= MAX_DESCRIPTION && setDescription(e.target.value)}
            rows={5}
            placeholder="As much as you can tell us — which listing, what was said, when."
            className="w-full px-3.5 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder-slate-500 outline-none focus:border-[#111111] focus:bg-white focus:ring-2 focus:ring-black/8 transition resize-none leading-relaxed"
          />
          {description.trim().length > 0 && description.trim().length < 20 && (
            // Shown only once they have started, not as a warning on an empty
            // box — a validation error before anybody has done anything is a
            // telling-off.
            <p className="text-xs text-slate-500 mt-1">A little more detail helps us answer without asking first.</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-xs text-slate-500">Only our team sees this.</p>
          <button
            type="button"
            disabled={!ready}
            onClick={() => create.mutate()}
            className={`min-h-[44px] px-5 py-3 rounded-xl text-sm font-semibold transition-colors ${
              ready ? 'bg-[#111111] hover:bg-[#2a2a2a] text-white' : 'bg-slate-100 text-slate-500 cursor-not-allowed'
            }`}
          >
            {create.isPending ? 'Sending…' : 'Send request'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
