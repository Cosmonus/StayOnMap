import { useEffect } from 'react'
import { create } from 'zustand'
import { CircleCheck, CircleX, TriangleAlert, Info, X } from 'lucide-react'

// ── Toast store ─────────────────────────────────────────────────────────────
let toastId = 0
export const useToastStore = create((set) => ({
  toasts: [],
  add: ({ type = 'info', title, message, duration = 4000 }) => {
    const id = ++toastId
    set((s) => ({ toasts: [...s.toasts, { id, type, title, message, duration }] }))
    return id
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

// ── Convenience helpers ─────────────────────────────────────────────────────
export const toast = {
  success: (title, message) => useToastStore.getState().add({ type: 'success', title, message }),
  error:   (title, message) => useToastStore.getState().add({ type: 'error',   title, message }),
  info:    (title, message) => useToastStore.getState().add({ type: 'info',    title, message }),
  warn:    (title, message) => useToastStore.getState().add({ type: 'warn',    title, message }),
}

// ── Icons ───────────────────────────────────────────────────────────────────
const ICON = {
  success: <CircleCheck className="w-5 h-5 text-emerald-500" />,
  error:   <CircleX className="w-5 h-5 text-red-500" />,
  warn:    <TriangleAlert className="w-5 h-5 text-amber-500" />,
  info:    <Info className="w-5 h-5 text-brand-600" />,
}

const BG = {
  success: 'bg-emerald-50 border-emerald-200',
  error:   'bg-red-50 border-red-200',
  warn:    'bg-amber-50 border-amber-200',
  info:    'bg-brand-50 border-brand-200',
}

// ── Single toast item ───────────────────────────────────────────────────────
function ToastItem({ t, onDismiss }) {
  useEffect(() => {
    if (t.duration <= 0) return
    const timer = setTimeout(() => onDismiss(t.id), t.duration)
    return () => clearTimeout(timer)
  }, [t.id, t.duration, onDismiss])

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg max-w-sm w-full animate-slide-in ${BG[t.type] ?? BG.info}`}
      role="alert"
    >
      <div className="shrink-0 mt-0.5">{ICON[t.type] ?? ICON.info}</div>
      <div className="flex-1 min-w-0">
        {t.title && <p className="text-sm font-semibold text-slate-800">{t.title}</p>}
        {t.message && <p className="text-xs text-slate-600 mt-0.5">{t.message}</p>}
      </div>
      <button onClick={() => onDismiss(t.id)} className="shrink-0 text-slate-500 hover:text-slate-600 mt-0.5">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

// ── Container — mount once in App.jsx ───────────────────────────────────────
export default function Toaster() {
  const toasts  = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  if (!toasts.length) return null

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem t={t} onDismiss={dismiss} />
        </div>
      ))}
    </div>
  )
}
