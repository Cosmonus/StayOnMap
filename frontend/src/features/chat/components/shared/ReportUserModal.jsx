import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { userService } from '@services/user.service'
import { toast } from '@components/common/Toaster'
import Modal from '@components/common/Modal'
import Select from '@components/common/Select'

// Mirrors UserReportCategory in schema.prisma and USER_REPORT_CATEGORIES in
// users.validation.js. Deliberately NOT the property ReportCategory list — a
// person cannot have fake photos and a listing cannot harass anyone.
const CATEGORIES = [
  { value: 'HARASSMENT', label: 'Harassment or threats' },
  { value: 'SPAM', label: 'Spam or unwanted promotion' },
  { value: 'SCAM_OR_FRAUD', label: 'Scam or fraud' },
  { value: 'IMPERSONATION', label: 'Pretending to be someone else' },
  { value: 'HATE_OR_ABUSE', label: 'Hate speech or abuse' },
  { value: 'OTHER', label: 'Something else' },
]

const MIN_DESCRIPTION = 10

export default function ReportUserModal({ isOpen, onClose, user, conversationId }) {
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')

  const reset = () => { setCategory(''); setDescription('') }
  const close = () => { reset(); onClose() }

  const { mutate, isPending } = useMutation({
    mutationFn: () => userService.reportUser(user.id, {
      category,
      description: description.trim(),
      conversationId,
    }),
    onSuccess: () => {
      // What happens next, not just "thanks". A report that vanishes into a
      // confirmation toast teaches people not to file the next one.
      toast.success('Report sent. Our team will review it.')
      close()
    },
    onError: (err) => toast.error(err?.message ?? 'Could not send the report'),
  })

  const tooShort = description.trim().length < MIN_DESCRIPTION
  const canSubmit = !!category && !tooShort && !isPending

  return (
    <Modal isOpen={isOpen} onClose={close} title={`Report ${user?.name ?? 'this person'}`}>
      <div className="space-y-5">
        <p className="text-sm text-slate-600 leading-relaxed">
          Tell us what happened. Reports go to our moderation team and are not
          shown to the person you are reporting.
        </p>

        <Select
          label="What is the problem?"
          value={category}
          onChange={setCategory}
          placeholder="Choose a reason"
          options={CATEGORIES}
        />

        <div>
          <label htmlFor="report-detail" className="block text-sm font-medium text-slate-700 mb-2">
            What happened?
          </label>
          <textarea
            id="report-detail"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Include anything that would help us understand — what was said, and when."
            className="w-full min-h-[44px] px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
          {/* Stated up front rather than as an error after they press send —
              the floor exists so a moderator isn't handed "asdf" to act on. */}
          <p className="mt-2 text-xs text-slate-500">
            At least {MIN_DESCRIPTION} characters. {description.trim().length}/2000
          </p>
        </div>

        {conversationId && (
          <p className="text-xs text-slate-500 leading-relaxed">
            This conversation will be attached so our team can see the messages
            in question.
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={close}
            className="min-h-[44px] px-5 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => mutate()}
            disabled={!canSubmit}
            className="min-h-[44px] px-5 py-3 rounded-xl bg-[#111111] text-white text-sm font-semibold hover:bg-[#2a2a2a] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 transition-colors"
          >
            {isPending ? 'Sending…' : 'Send report'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
