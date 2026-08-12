import {
  Calendar, CircleCheck, Clipboard, CircleX, RefreshCw, Flag, SquarePen,
  ShieldCheck, TriangleAlert, MessageCircle, Bell, BellRing, KeyRound,
  FileText, FileSignature, FileX, LifeBuoy,
} from 'lucide-react'

// One table for every NotificationType, read by NotificationBell and
// NotificationCenter. It lived in BOTH files, byte-identical, which is how a
// value added to one and not the other becomes a bell with no icon on exactly
// one of the two surfaces.
//
// Covered by backend/tests/enum-config-parity.test.js — a value the database
// can produce that has no row here falls back to SYSTEM, which is silent.
export const TYPE_CONFIG = {
  APPOINTMENT_REQUEST:     { bg: 'bg-brand-50',    iconBg: 'bg-brand-100',    iconColor: 'text-brand-600',    icon: Calendar },
  APPOINTMENT_ACCEPTED:    { bg: 'bg-emerald-50',  iconBg: 'bg-emerald-100',  iconColor: 'text-emerald-600',  icon: CircleCheck },
  APPOINTMENT_STATUS:      { bg: 'bg-slate-50',    iconBg: 'bg-slate-100',    iconColor: 'text-slate-600',    icon: Clipboard },
  APPOINTMENT_REJECTED:    { bg: 'bg-red-50',      iconBg: 'bg-red-100',      iconColor: 'text-red-600',      icon: CircleX },
  // Not a NotificationType value — a reschedule is sent as APPOINTMENT_STATUS
  // until a migration adds one. Kept because appointments.service.js names it.
  APPOINTMENT_RESCHEDULED: { bg: 'bg-amber-50',    iconBg: 'bg-amber-100',    iconColor: 'text-amber-600',    icon: RefreshCw },
  REPORT_SUBMITTED:        { bg: 'bg-orange-50',   iconBg: 'bg-orange-100',   iconColor: 'text-orange-600',   icon: Flag },
  REPORT_UPDATE:           { bg: 'bg-slate-50',    iconBg: 'bg-slate-100',    iconColor: 'text-slate-600',    icon: SquarePen },
  VERIFICATION_UPDATE:     { bg: 'bg-brand-50',    iconBg: 'bg-brand-100',    iconColor: 'text-brand-600',    icon: ShieldCheck },
  TRUST_ALERT:             { bg: 'bg-amber-50',    iconBg: 'bg-amber-100',    iconColor: 'text-amber-600',    icon: TriangleAlert },
  LEASE_OFFERED:           { bg: 'bg-brand-50',    iconBg: 'bg-brand-100',    iconColor: 'text-brand-600',    icon: FileText },
  LEASE_SIGNED:            { bg: 'bg-emerald-50',  iconBg: 'bg-emerald-100',  iconColor: 'text-emerald-600',  icon: FileSignature },
  LEASE_REJECTED:          { bg: 'bg-red-50',      iconBg: 'bg-red-100',      iconColor: 'text-red-600',      icon: FileX },
  MESSAGE:                 { bg: 'bg-brand-50',    iconBg: 'bg-brand-100',    iconColor: 'text-brand-600',    icon: MessageCircle },
  SUPPORT_CASE_MESSAGE:    { bg: 'bg-brand-50',    iconBg: 'bg-brand-100',    iconColor: 'text-brand-600',    icon: LifeBuoy },
  SUPPORT_CASE_UPDATE:     { bg: 'bg-slate-50',    iconBg: 'bg-slate-100',    iconColor: 'text-slate-600',    icon: LifeBuoy },
  SUPPORT_CASE_RESOLVED:   { bg: 'bg-emerald-50',  iconBg: 'bg-emerald-100',  iconColor: 'text-emerald-600',  icon: CircleCheck },
  SAVED_SEARCH_MATCH:      { bg: 'bg-brand-50',    iconBg: 'bg-brand-100',    iconColor: 'text-brand-600',    icon: BellRing },
  TENANCY_UPDATE:          { bg: 'bg-brand-50',    iconBg: 'bg-brand-100',    iconColor: 'text-brand-600',    icon: KeyRound },
  SYSTEM:                  { bg: 'bg-slate-50',    iconBg: 'bg-slate-100',    iconColor: 'text-slate-600',    icon: Bell },
}

export const FALLBACK = TYPE_CONFIG.SYSTEM
