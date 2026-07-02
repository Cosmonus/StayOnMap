import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationService } from '@services/notification.service'
import { useAuth } from '@features/auth/hooks/useAuth'
import { connectSocket, getSocket } from '@lib/socket'

// ── Icon configs per notification type ──────────────────────────────────────
const TYPE_CONFIG = {
  APPOINTMENT_REQUEST: {
    bg: 'bg-brand-50',
    iconBg: 'bg-brand-100',
    iconColor: 'text-brand-600',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
  APPOINTMENT_ACCEPTED: {
    bg: 'bg-emerald-50',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  APPOINTMENT_STATUS: {
    bg: 'bg-slate-50',
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-600',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  },
  APPOINTMENT_REJECTED: {
    bg: 'bg-red-50',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  APPOINTMENT_RESCHEDULED: {
    bg: 'bg-amber-50',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  },
  REPORT_SUBMITTED: {
    bg: 'bg-orange-50',
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
    icon: 'M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9',
  },
  REPORT_UPDATE: {
    bg: 'bg-slate-50',
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-600',
    icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  },
  VERIFICATION_UPDATE: {
    bg: 'bg-brand-50',
    iconBg: 'bg-brand-100',
    iconColor: 'text-brand-600',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  },
  TRUST_ALERT: {
    bg: 'bg-amber-50',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  },
  MESSAGE: {
    bg: 'bg-brand-50',
    iconBg: 'bg-brand-100',
    iconColor: 'text-brand-600',
    icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  },
  SYSTEM: {
    bg: 'bg-slate-50',
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-600',
    icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
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
function NotificationCard({ n, onMark }) {
  const cfg = TYPE_CONFIG[n.type] ?? FALLBACK

  return (
    <button
      onClick={() => { if (!n.isRead) onMark(n.id) }}
      className={`w-full text-left px-4 py-3.5 flex items-start gap-3.5 hover:bg-slate-50/80 transition-colors ${!n.isRead ? cfg.bg : ''}`}
    >
      {/* Icon circle */}
      <div className={`w-10 h-10 rounded-full ${cfg.iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
        <svg className={`w-5 h-5 ${cfg.iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d={cfg.icon} />
        </svg>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm leading-snug ${!n.isRead ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
            {!n.isRead && <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-500 mr-1.5 -translate-y-px" />}
            {n.title}
          </p>
          <span className="text-[11px] text-slate-400 shrink-0 mt-0.5">{timeAgo(n.createdAt)}</span>
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

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationService.list().then(r => r.data),
    refetchInterval: 60000,
  })

  useEffect(() => {
    if (!user?.id) return
    connectSocket()
    const socket = getSocket()
    if (!socket) return
    function onNew(notif) {
      qc.setQueryData(['notifications'], (old = []) => [notif, ...(old ?? [])])
    }
    socket.on('notification:new', onNew)
    return () => socket.off('notification:new', onNew)
  }, [user?.id, qc])

  const { mutate: markOne } = useMutation({
    mutationFn: (id) => notificationService.markOne(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const { mutate: markAll } = useMutation({
    mutationFn: () => notificationService.markAll(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
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
        <svg className="w-[18px] h-[18px] text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-[380px] bg-white rounded-2xl shadow-float border border-slate-200 overflow-hidden animate-scale-in">
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAll()}
                className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Mark all as read
              </button>
            )}
          </div>

          {/* Body */}
          <div className="max-h-[420px] overflow-y-auto">
            {recent.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-slate-500">No notifications yet</p>
                <p className="text-xs text-slate-400 mt-1">When someone shows interest or updates an appointment, you&apos;ll see it here.</p>
              </div>
            ) : (
              grouped.map((entry, i) =>
                entry.type === 'header' ? (
                  <div key={`h-${i}`} className="px-5 py-2 bg-slate-50/80 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{entry.label}</p>
                  </div>
                ) : (
                  <div key={entry.data.id} className="border-b border-slate-50 last:border-b-0">
                    <NotificationCard n={entry.data} onMark={markOne} />
                  </div>
                )
              )
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <button
              onClick={() => { onViewAll?.(); setOpen(false) }}
              className="w-full px-5 py-3 border-t border-slate-100 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
            >
              View all notifications
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
