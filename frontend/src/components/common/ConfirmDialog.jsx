import { create } from 'zustand'

// ── Confirm store ───────────────────────────────────────────────────────────
export const useConfirmStore = create((set) => ({
  open: false,
  title: '',
  message: '',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  variant: 'danger',   // 'danger' | 'warning' | 'info'
  onConfirm: null,
  onCancel: null,

  show: ({ title, message, confirmLabel, cancelLabel, variant, onConfirm, onCancel }) =>
    set({
      open: true,
      title: title ?? 'Are you sure?',
      message: message ?? '',
      confirmLabel: confirmLabel ?? 'Confirm',
      cancelLabel: cancelLabel ?? 'Cancel',
      variant: variant ?? 'danger',
      onConfirm: onConfirm ?? null,
      onCancel: onCancel ?? null,
    }),

  close: () => set({ open: false, onConfirm: null, onCancel: null }),
}))

// ── Convenience helper ──────────────────────────────────────────────────────
export function confirm(opts) {
  return new Promise((resolve) => {
    useConfirmStore.getState().show({
      ...opts,
      onConfirm: () => { useConfirmStore.getState().close(); resolve(true) },
      onCancel:  () => { useConfirmStore.getState().close(); resolve(false) },
    })
  })
}

// ── Icons ───────────────────────────────────────────────────────────────────
const ICON = {
  danger: (
    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
      <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </div>
  ),
  warning: (
    <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
      <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    </div>
  ),
  info: (
    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
      <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
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
  const { open, title, message, confirmLabel, cancelLabel, variant, onConfirm, onCancel } = useConfirmStore()

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm bg-white rounded-2xl p-6 shadow-xl animate-scale-in text-center">
        {ICON[variant] ?? ICON.danger}
        <h3 className="text-lg font-bold text-slate-900 mb-1">{title}</h3>
        {message && <p className="text-sm text-slate-500 mb-5">{message}</p>}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl transition-colors ${BTN_VARIANT[variant] ?? BTN_VARIANT.danger}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
