import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Calendar, CircleCheck, Clipboard, CircleX, RefreshCw, Flag, SquarePen,
  ShieldCheck, TriangleAlert, MessageCircle, Bell, Check,
} from 'lucide-react'
import { notificationService } from '@services/notification.service'

// ── Icon configs (same as NotificationBell) ─────────────────────────────────
const TYPE_CONFIG = {
  APPOINTMENT_REQUEST:     { bg: 'bg-brand-50',   iconBg: 'bg-brand-100',   iconColor: 'text-brand-600',   icon: Calendar },
  APPOINTMENT_ACCEPTED:    { bg: 'bg-emerald-50',  iconBg: 'bg-emerald-100',  iconColor: 'text-emerald-600',  icon: CircleCheck },
  APPOINTMENT_STATUS:      { bg: 'bg-slate-50',    iconBg: 'bg-slate-100',    iconColor: 'text-slate-600',    icon: Clipboard },
  APPOINTMENT_REJECTED:    { bg: 'bg-red-50',      iconBg: 'bg-red-100',      iconColor: 'text-red-600',      icon: CircleX },
  APPOINTMENT_RESCHEDULED: { bg: 'bg-amber-50',    iconBg: 'bg-amber-100',    iconColor: 'text-amber-600',    icon: RefreshCw },
  REPORT_SUBMITTED:        { bg: 'bg-orange-50',   iconBg: 'bg-orange-100',   iconColor: 'text-orange-600',   icon: Flag },
  REPORT_UPDATE:           { bg: 'bg-slate-50',    iconBg: 'bg-slate-100',    iconColor: 'text-slate-600',    icon: SquarePen },
  VERIFICATION_UPDATE:     { bg: 'bg-brand-50',    iconBg: 'bg-brand-100',    iconColor: 'text-brand-600',    icon: ShieldCheck },
  TRUST_ALERT:             { bg: 'bg-amber-50',    iconBg: 'bg-amber-100',    iconColor: 'text-amber-600',    icon: TriangleAlert },
  MESSAGE:                 { bg: 'bg-brand-50',    iconBg: 'bg-brand-100',    iconColor: 'text-brand-600',    icon: MessageCircle },
  SYSTEM:                  { bg: 'bg-slate-50',    iconBg: 'bg-slate-100',    iconColor: 'text-slate-600',    icon: Bell },
}

const FALLBACK = TYPE_CONFIG.SYSTEM

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function dateGroup(date) {
  const d = new Date(date)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function NotificationCenter() {
  const qc = useQueryClient()

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationService.list().then(r => r.data),
  })

  const { mutate: markOne } = useMutation({
    mutationFn: (id) => notificationService.markOne(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const { mutate: markAll } = useMutation({
    mutationFn: () => notificationService.markAll(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const unreadCount = notifications.filter(n => !n.isRead).length

  // Group by date
  const grouped = []
  let lastGroup = null
  for (const n of notifications) {
    const group = dateGroup(n.createdAt)
    if (group !== lastGroup) {
      grouped.push({ type: 'header', label: group })
      lastGroup = group
    }
    grouped.push({ type: 'item', data: n })
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-slate-100 rounded-lg animate-pulse" />
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-20 bg-slate-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAll()}
            className="min-h-[44px] flex items-center gap-1.5 px-4 py-3 text-xs font-semibold text-emerald-600 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-colors"
          >
            <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
            Mark all as read
          </button>
        )}
      </div>

      {/* Empty state */}
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <Bell className="w-7 h-7 text-slate-500" strokeWidth={1.5} />
          </div>
          <h2 className="text-lg font-bold text-slate-700 mb-1">No notifications</h2>
          <p className="text-sm text-slate-500 max-w-xs">When someone shows interest in your property, books or cancels an appointment, you&apos;ll see it here.</p>
        </div>
      ) : (
        <div className="space-y-0">
          {grouped.map((entry, i) =>
            entry.type === 'header' ? (
              <div key={`h-${i}`} className="px-1 pt-5 pb-2 first:pt-0">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{entry.label}</p>
              </div>
            ) : (
              <NotificationRow key={entry.data.id} n={entry.data} onMark={markOne} />
            )
          )}
        </div>
      )}
    </div>
  )
}

function NotificationRow({ n, onMark }) {
  const cfg = TYPE_CONFIG[n.type] ?? FALLBACK
  const CfgIcon = cfg.icon

  return (
    <button
      onClick={() => { if (!n.isRead) onMark(n.id) }}
      className={`w-full text-left px-5 py-4 rounded-2xl mb-2 flex items-start gap-4 transition-colors ${
        !n.isRead ? `${cfg.bg} hover:brightness-95` : 'bg-white border border-slate-100 hover:bg-slate-50'
      }`}
    >
      {/* Icon */}
      <div className={`w-11 h-11 rounded-full ${cfg.iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
        <CfgIcon className={`w-5 h-5 ${cfg.iconColor}`} strokeWidth={1.8} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <p className={`text-sm leading-snug ${!n.isRead ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
            {!n.isRead && <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-500 mr-1.5 -translate-y-px" />}
            {n.title}
          </p>
          <span className="text-[11px] text-slate-500 shrink-0 mt-0.5 whitespace-nowrap">{timeAgo(n.createdAt)}</span>
        </div>
        <p className="text-sm text-slate-500 mt-1 leading-relaxed">{n.body}</p>
      </div>
    </button>
  )
}
