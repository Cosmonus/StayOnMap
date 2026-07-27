import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Calendar, CircleCheck, Clipboard, CircleX, RefreshCw, Flag, SquarePen,
  ShieldCheck, TriangleAlert, MessageCircle, Bell, Check, ChevronRight,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { notificationService } from '@services/notification.service'
import { useAuth } from '@features/auth/hooks/useAuth'
import { useUiStore } from '@store/uiStore'
import { connectSocket, getSocket } from '@lib/socket'
import { referenceHref } from '../referenceHref'

// ── Icon configs per notification type ──────────────────────────────────────
const TYPE_CONFIG = {
  APPOINTMENT_REQUEST: {
    bg: 'bg-brand-50',
    iconBg: 'bg-brand-100',
    iconColor: 'text-brand-600',
    icon: Calendar,
  },
  APPOINTMENT_ACCEPTED: {
    bg: 'bg-emerald-50',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    icon: CircleCheck,
  },
  APPOINTMENT_STATUS: {
    bg: 'bg-slate-50',
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-600',
    icon: Clipboard,
  },
  APPOINTMENT_REJECTED: {
    bg: 'bg-red-50',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    icon: CircleX,
  },
  APPOINTMENT_RESCHEDULED: {
    bg: 'bg-amber-50',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    icon: RefreshCw,
  },
  REPORT_SUBMITTED: {
    bg: 'bg-orange-50',
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
    icon: Flag,
  },
  REPORT_UPDATE: {
    bg: 'bg-slate-50',
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-600',
    icon: SquarePen,
  },
  VERIFICATION_UPDATE: {
    bg: 'bg-brand-50',
    iconBg: 'bg-brand-100',
    iconColor: 'text-brand-600',
    icon: ShieldCheck,
  },
  TRUST_ALERT: {
    bg: 'bg-amber-50',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    icon: TriangleAlert,
  },
  MESSAGE: {
    bg: 'bg-brand-50',
    iconBg: 'bg-brand-100',
    iconColor: 'text-brand-600',
    icon: MessageCircle,
  },
  SYSTEM: {
    bg: 'bg-slate-50',
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-600',
    icon: Bell,
  },
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
  return `${days}d ago`
}

function dateGroup(date) {
  const d = new Date(date)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

// ── Single notification card ────────────────────────────────────────────────
function NotificationCard({ n, onMark, onNavigate }) {
  const cfg = TYPE_CONFIG[n.type] ?? FALLBACK
  const CfgIcon = cfg.icon
  // A notification that names a thing should OPEN that thing. This card only
  // marked itself read, so the bell — the one surface you see the moment
  // something happens — was a dead end: an owner rescheduled your visit, the
  // badge lit up, and tapping it did nothing at all. The full-page list has
  // navigated since it was written; the bell never did.
  const href = referenceHref(n)

  return (
    <button
      onClick={() => {
        if (!n.isRead) onMark(n.id)
        if (href) onNavigate(href)
      }}
      className={`w-full text-left px-4 py-3.5 flex items-start gap-3.5 hover:bg-slate-50/80 transition-colors ${!n.isRead ? cfg.bg : ''}`}
    >
      {/* Icon circle */}
      <div className={`w-10 h-10 rounded-full ${cfg.iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
        <CfgIcon className={`w-5 h-5 ${cfg.iconColor}`} strokeWidth={1.8} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm leading-snug ${!n.isRead ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
            {!n.isRead && <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-500 mr-1.5 -translate-y-px" />}
            {n.title}
          </p>
          <span className="text-[11px] text-slate-500 shrink-0 mt-0.5">{timeAgo(n.createdAt)}</span>
        </div>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">{n.body}</p>
      </div>
    </button>
  )
}

// ── Bell + Dropdown ─────────────────────────────────────────────────────────
export default function NotificationBell({ onViewAll }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const qc = useQueryClient()
  const { user } = useAuth()
  const navigate = useNavigate()

  // Header renders <NotificationBell /> with no onViewAll, so "View all
  // notifications" was a button that closed the panel and did nothing else.
  function viewAll() {
    setOpen(false)
    if (onViewAll) onViewAll()
    else navigate('/user?tab=notifications')
  }

  function go(href) {
    setOpen(false)
    navigate(href)
  }

  // Per hat, like the list behind it — so the bell's count is the count of
  // what the mode you're in can actually show you.
  const audience = useUiStore((s) => (s.hostMode ? 'OWNER' : 'TENANT'))

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', audience],
    queryFn: () => notificationService.list(audience).then(r => r.data),
    refetchInterval: 60000,
  })

  useEffect(() => {
    if (!user?.id) return
    connectSocket()
    const socket = getSocket()
    if (!socket) return
    function onNew(notif) {
      // A notification for the OTHER hat must not be spliced into this list —
      // it would show under a heading that can't be right for it, and vanish on
      // the next refetch. An unclassified one (audience null, written before
      // the column existed) belongs to both.
      if (notif.audience && notif.audience !== audience) return
      qc.setQueryData(['notifications', audience], (old = []) => [notif, ...(old ?? [])])
    }
    socket.on('notification:new', onNew)
    return () => socket.off('notification:new', onNew)
  }, [user?.id, qc, audience])

  const { mutate: markOne } = useMutation({
    mutationFn: (id) => notificationService.markOne(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['notification-unread'] })
    },
  })

  const { mutate: markAll } = useMutation({
    mutationFn: () => notificationService.markAll(audience),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['notification-unread'] })
    },
  })

  const unreadCount = notifications.filter(n => !n.isRead).length
  const recent = notifications.slice(0, 6)

  // Group recent by date
  const grouped = []
  let lastGroup = null
  for (const n of recent) {
    const group = dateGroup(n.createdAt)
    if (group !== lastGroup) {
      grouped.push({ type: 'header', label: group })
      lastGroup = group
    }
    grouped.push({ type: 'item', data: n })
  }

  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="relative w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-[18px] h-[18px] text-slate-600" strokeWidth={1.8} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[11px] font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-[380px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-float border border-slate-200 overflow-hidden animate-scale-in">
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAll()}
                className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                Mark all as read
              </button>
            )}
          </div>

          {/* Body */}
          <div className="max-h-[420px] overflow-y-auto">
            {recent.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <Bell className="w-5 h-5 text-slate-500" strokeWidth={1.8} />
                </div>
                <p className="text-sm font-medium text-slate-500">No notifications yet</p>
                <p className="text-xs text-slate-500 mt-1">When someone shows interest or updates an appointment, you&apos;ll see it here.</p>
              </div>
            ) : (
              grouped.map((entry, i) =>
                entry.type === 'header' ? (
                  <div key={`h-${i}`} className="px-5 py-2 bg-slate-50/80 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{entry.label}</p>
                  </div>
                ) : (
                  <div key={entry.data.id} className="border-b border-slate-50 last:border-b-0">
                    <NotificationCard n={entry.data} onMark={markOne} onNavigate={go} />
                  </div>
                )
              )
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <button
              onClick={viewAll}
              className="w-full px-5 py-3 border-t border-slate-100 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
            >
              View all notifications
              <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
