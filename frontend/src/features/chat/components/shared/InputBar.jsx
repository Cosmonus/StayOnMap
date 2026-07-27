import { useState, useRef } from 'react'
import { Paperclip, Send, FileText, ImageIcon } from 'lucide-react'
import { uploadService } from '@services/upload.service'
import { toast } from '@components/common/Toaster'

export default function InputBar({ onSend, onTyping, isPending }) {
  const [input, setInput] = useState('')
  const [uploading, setUploading] = useState(false)
  const [attachOpen, setAttachOpen] = useState(false)
  const imageInputRef = useRef(null)
  const docInputRef = useRef(null)
  const busy = isPending || uploading

  function handleSubmit(e) {
    e.preventDefault()
    const body = input.trim()
    if (!body || busy) return
    onSend({ body })
    setInput('')
  }

  function handleChange(e) {
    setInput(e.target.value)
    onTyping?.()
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  // One handler, two kinds. `kind` decides which endpoint and therefore which
  // allowlist applies — an image is re-encoded to WebP, a PDF is stored as-is
  // with its name (see backend/features/uploads/documents.service.js).
  async function handleFileChange(e, kind) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    setAttachOpen(false)
    try {
      const res = kind === 'document'
        ? await uploadService.uploadChatFile(file)
        : await uploadService.uploadChatImage(file)
      onSend({
        body: input.trim(),
        attachmentUrl: res.data.url,
        attachmentName: res.data.name,
        attachmentMime: res.data.mime,
      })
      setInput('')
    } catch (err) {
      toast.error('Couldn’t attach', err.message ?? `Failed to upload the ${kind === 'document' ? 'document' : 'image'}`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="shrink-0 border-t border-slate-100 bg-white px-3 sm:px-5 py-3 sm:py-3.5 flex items-end gap-2 sm:gap-3">
      {/* Two pickers behind one paperclip. A single input can't do both: the
          accept lists differ and so do the endpoints. */}
      <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => handleFileChange(e, 'image')} className="hidden" />
      <input ref={docInputRef} type="file" accept="application/pdf" onChange={(e) => handleFileChange(e, 'document')} className="hidden" />

      <div className="relative shrink-0 mb-1">
        <button
          type="button"
          onClick={() => setAttachOpen((o) => !o)}
          disabled={busy}
          aria-label="Attach a photo or document"
          aria-expanded={attachOpen}
          className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <Paperclip className="w-5 h-5" strokeWidth={2} />
        </button>

        {attachOpen && (
          <>
            {/* Click-away catcher — a menu that only closes by re-tapping the
                trigger is a menu people leave open. */}
            <button
              type="button"
              aria-hidden="true"
              tabIndex={-1}
              onClick={() => setAttachOpen(false)}
              className="fixed inset-0 z-10 cursor-default"
            />
            <div className="absolute bottom-12 left-0 z-20 w-48 bg-white rounded-2xl border border-slate-200 shadow-float overflow-hidden">
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <ImageIcon size={17} strokeWidth={2} className="text-slate-500" aria-hidden="true" />
                Photo
              </button>
              <button
                type="button"
                onClick={() => docInputRef.current?.click()}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 border-t border-slate-100 transition-colors"
              >
                <FileText size={17} strokeWidth={2} className="text-slate-500" aria-hidden="true" />
                Document
                <span className="ml-auto text-xs text-slate-500">PDF</span>
              </button>
            </div>
          </>
        )}
      </div>

      <div className="flex-1 relative">
        <textarea
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={uploading ? 'Uploading…' : 'Write a message…'}
          rows={1}
          disabled={uploading}
          aria-label="Write a message"
          className="w-full px-4 py-3 text-sm bg-white border border-slate-200 rounded-2xl focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500 resize-none placeholder:text-slate-500 disabled:opacity-60"
          style={{ minHeight: '48px', maxHeight: '120px' }}
        />
      </div>

      <button
        type="submit"
        disabled={!input.trim() || busy}
        aria-label="Send message"
        className="w-12 h-12 mb-0.5 rounded-2xl bg-brand-600 text-white flex items-center justify-center hover:bg-brand-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <Send className="w-[18px] h-[18px]" strokeWidth={2.2} />
      </button>
    </form>
  )
}
