import { useRef, useState } from 'react'
import { Paperclip } from 'lucide-react'
import { adminService } from '@services/admin.service'
import { toast } from '@components/common/Toaster'
import { VISIBILITY_LABEL } from './supportVocab'

/**
 * Staff attaching a file to a case.
 *
 * Two things differ from the user's `AttachEvidence`, and both follow from who
 * is doing it:
 *
 *   1. ONE call, not two. The user side uploads through /uploads (a user JWT)
 *      and then records the URL, and the record step re-checks that the URL is
 *      ours. Staff hold an admin JWT, which /uploads does not accept at all, so
 *      their route uploads and attaches in the same request — there is nothing
 *      to re-check about a file this request just wrote.
 *   2. It carries a VISIBILITY, and it is the composer's, not its own. "Who can
 *      read this" is one question about the whole reply; a file with a separate
 *      picker beside it is how a document ends up shared with an audience the
 *      words above it were never meant for.
 *
 * The server clamps that visibility regardless (`allowedVisibilities`), so this
 * prop is the affordance and not the enforcement.
 *
 * No `accept` attribute: every type is allowed. Greying types out in the OS
 * picker would read as "you cannot send this" for a rule the server no longer
 * has.
 */
const MAX_BYTES = 25 * 1024 * 1024

export default function AdminAttach({ caseId, visibility, onAttached }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)

  async function handle(e) {
    const file = e.target.files?.[0]
    // Cleared immediately, or picking the same file again after a failure is a
    // no-op and reads as the button being broken.
    e.target.value = ''
    if (!file) return

    if (file.size > MAX_BYTES) {
      toast.error('That file is too large', 'Attach something under 25MB.')
      return
    }

    setBusy(true)
    try {
      await adminService.supportUpload(caseId, file, visibility)
      onAttached?.()
    } catch (err) {
      toast.error('Couldn’t attach that', err.message ?? 'Please try again')
    } finally {
      setBusy(false)
    }
  }

  const internal = visibility === 'INTERNAL'

  return (
    <>
      <input ref={inputRef} type="file" onChange={handle} className="hidden" />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        // Amber when the audience selector says internal, matching the compose
        // box beside it. The dangerous mistake here is the same one: attaching
        // an internal document to what you thought was a private note, or
        // sharing one you thought was internal.
        className={`min-h-[44px] inline-flex items-center gap-1.5 px-4 py-3 rounded-xl border text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
          internal
            ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
        }`}
        title={internal ? 'Internal — never leaves the admin panel' : `Visible to: ${VISIBILITY_LABEL[visibility]}`}
      >
        <Paperclip size={16} aria-hidden="true" />
        {busy ? 'Attaching…' : internal ? 'Attach (internal)' : 'Attach a file'}
      </button>
    </>
  )
}
