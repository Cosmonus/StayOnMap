import { useState, useEffect } from 'react'
import { create } from 'zustand'
import { Trash2, TriangleAlert, Info } from 'lucide-react'

// ── Confirm store ───────────────────────────────────────────────────────────
export const useConfirmStore = create((set) => ({
  open: false,
  title: '',
  message: '',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  variant: 'danger',   // 'danger' | 'warning' | 'info'
  // Optional: turns the dialog into a prompt. Some destructive actions have to
  // carry a reason with them — pausing someone's listing is told to them in the
  // admin's own words — and asking for it in the same dialog that confirms the
  // action is what keeps the two from drifting apart.
  reason: null,        // { label, placeholder, minLength }
  onConfirm: null,
  onCancel: null,

  show: ({ title, message, confirmLabel, cancelLabel, variant, reason, onConfirm, onCancel }) =>
    set({
      open: true,
      title: title ?? 'Are you sure?',
      message: message ?? '',
      confirmLabel: confirmLabel ?? 'Confirm',
      cancelLabel: cancelLabel ?? 'Cancel',
      variant: variant ?? 'danger',
      reason: reason ?? null,
      onConfirm: onConfirm ?? null,
      onCancel: onCancel ?? null,
    }),

  close: () => set({ open: false, onConfirm: null, onCancel: null, reason: null }),
}))

// ── Convenience helper ──────────────────────────────────────────────────────
// Resolves false when dismissed. With `reason`, resolves the typed string;
// without it, resolves true — so every existing truthiness check still holds.
export function confirm(opts) {
  return new Promise((resolve) => {
    useConfirmStore.getState().show({
      ...opts,
      onConfirm: (value) => { useConfirmStore.getState().close(); resolve(opts?.reason ? value : true) },
      onCancel:  () => { useConfirmStore.getState().close(); resolve(false) },
    })
  })
}

// ── Icons ───────────────────────────────────────────────────────────────────
const ICON = {
  danger: (
    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
      <Trash2 className="w-6 h-6 text-red-600" />
    </div>
  ),
  warning: (
    <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
      <TriangleAlert className="w-6 h-6 text-amber-600" />
    </div>
  ),
  info: (
    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
      <Info className="w-6 h-6 text-blue-600" />
    </div>
  ),
}

const BTN_VARIANT = {
  danger:  'bg-red-600 hover:bg-red-700 text-white',
  warning: 'bg-amber-600 hover:bg-amber-700 text-white',
  info:    'bg-brand-600 hover:bg-brand-700 text-white',
}

// ── Component — mount once in App.jsx ───────────────────────────────────────
export default function ConfirmDialog() {
  const { open, title, message, confirmLabel, cancelLabel, variant, reason, onConfirm, onCancel } = useConfirmStore()
  const [text, setText] = useState('')

  // Clear between openings — a reason typed for one listing must never arrive
  // pre-filled on the next one.
  useEffect(() => { if (open) setText('') }, [open])

  if (!open) return null

  const minLength = reason?.minLength ?? 5
  const tooShort  = !!reason && text.trim().length < minLength

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onCancel} />
      <div className={`relative z-10 w-full max-w-sm bg-white rounded-2xl p-6 shadow-xl animate-scale-in ${reason ? '' : 'text-center'}`}>
        {!reason && (ICON[variant] ?? ICON.danger)}
        <h3 className={`text-lg font-bold text-slate-900 mb-1 ${reason ? '' : 'text-center'}`}>{title}</h3>
        {message && <p className="text-sm text-slate-500 mb-5">{message}</p>}

        {reason && (
          <label className="block mb-5">
            <span className="block text-sm font-medium text-slate-700 mb-1.5">{reason.label ?? 'Reason'}</span>
            <textarea
              autoFocus
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={reason.placeholder ?? ''}
              maxLength={500}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-slate-500"
            />
            <span className="block text-xs text-slate-500 mt-1">
              {tooShort ? `At least ${minLength} characters — this text is sent to them.` : 'This is sent to them, word for word.'}
            </span>
          </label>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="min-h-[44px] flex-1 px-4 py-3 text-sm font-semibold text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => onConfirm?.(text.trim())}
            disabled={tooShort}
            className={`min-h-[44px] flex-1 px-4 py-3 text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${BTN_VARIANT[variant] ?? BTN_VARIANT.danger}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
