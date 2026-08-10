import { useRef, useState } from 'react'
import { Paperclip } from 'lucide-react'
import { supportService } from '@services/support.service'
import { toast } from '@components/common/Toaster'

/**
 * Attach evidence to a support request.
 *
 * Evidence belongs to the CASE, not to a message. That is how the model is
 * shaped ("evidence can belong to the case rather than to any one message") and
 * it is also the simpler truth: a screenshot of a listing is about the problem,
 * not about the sentence it happened to arrive next to. It also removes the
 * only partial-failure path — there is no message to orphan if the upload dies.
 *
 * One control for images AND PDFs, because the person attaching does not think
 * in mime types: the fake listing is a screenshot and the disputed agreement is
 * a PDF, and it is the same sentence either way. The server has one endpoint to
 * match.
 *
 * The size check here is a courtesy, not the limit — multer enforces 5MB and
 * the allowlist server-side. Checking first only means somebody on a phone
 * finds out before spending the upload.
 */
const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'
const MAX_BYTES = 5 * 1024 * 1024

export default function AttachEvidence({ caseId, onAttached, disabled }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)

  async function handle(e) {
    const file = e.target.files?.[0]
    // Clear immediately, or picking the same file twice after a failure is a
    // no-op and reads as the button being broken.
    e.target.value = ''
    if (!file) return

    if (file.size > MAX_BYTES) {
      toast.error('That file is too large', 'Attach something under 5MB.')
      return
    }

    setBusy(true)
    try {
      const { data } = await supportService.uploadFile(file)
      await supportService.attach(caseId, {
        url: data.url,
        fileName: data.fileName ?? file.name,
        mimeType: data.mimeType,
        sizeBytes: file.size,
      })
      onAttached?.()
    } catch (err) {
      toast.error('Couldn’t attach that', err.message ?? 'Please try again')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <input ref={inputRef} type="file" accept={ACCEPT} onChange={handle} className="hidden" />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy || disabled}
        className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <Paperclip size={16} aria-hidden="true" />
        {busy ? 'Attaching…' : 'Attach a file'}
      </button>
    </>
  )
}
