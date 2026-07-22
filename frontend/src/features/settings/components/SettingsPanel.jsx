import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { User, Camera, Globe, Eye, EyeOff, Lock, Bell, Save, Shield, Trash2 } from 'lucide-react'
import { useAuth } from '@features/auth/hooks/useAuth'
import { userService } from '@services/user.service'
import { subscribeToPush, unsubscribeFromPush, registerServiceWorker } from '@services/push.service'
import { toast } from '@components/common/Toaster'
import { authService } from '@services/auth.service'
import { CITY_NAMES } from '@/config/cities'
import LinkedAccountsCard from './LinkedAccountsCard'
import DevicesCard from './DevicesCard'

const ICONS = { user: User, camera: Camera, globe: Globe, eye: Eye, eyeOff: EyeOff, lock: Lock, bell: Bell, save: Save, shield: Shield, trash: Trash2 }

export function Card({ icon: IconComp, title, children, danger, className = '' }) {
  return (
    <div className={`rounded-2xl border p-5 ${danger ? 'bg-red-50 border-red-200' : 'bg-white border-slate-100'} ${className}`}>
      <div className="flex items-center gap-2.5 mb-4">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${danger ? 'bg-red-100 text-red-500' : 'bg-slate-100 text-slate-500'}`}>
          <IconComp className="w-4 h-4" strokeWidth={1.8} />
        </div>
        <h2 className={`text-sm font-bold ${danger ? 'text-red-700' : 'text-slate-900'}`}>{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      {children}
    </div>
  )
}

const INPUT = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#111111] focus:border-transparent bg-slate-50'

function Toggle({ checked, onChange, label, description, disabled }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`w-full flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <div className="text-left pr-3">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        {description && <p className="text-[11px] text-slate-400 mt-0.5">{description}</p>}
      </div>
      <div className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${checked && !disabled ? 'bg-[#111111]' : 'bg-slate-200'}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${checked && !disabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
      </div>
    </button>
  )
}

function VisOpt({ value, current, onChange, icon: IconComp, label }) {
  const sel = current === value
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl border transition-all text-left ${sel ? 'border-[#111111] bg-slate-50' : 'border-slate-100 hover:border-slate-200'}`}
    >
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${sel ? 'bg-[#111111] text-white' : 'bg-slate-100 text-slate-400'}`}>
        <IconComp className="w-3.5 h-3.5" strokeWidth={1.8} />
      </div>
      <span className={`text-sm font-medium ${sel ? 'text-slate-900' : 'text-slate-600'}`}>{label}</span>
      {sel && <span className="ml-auto text-[10px] font-bold text-slate-400 uppercase tracking-wide">Active</span>}
    </button>
  )
}

function DeleteModal({ onConfirm, onCancel, deleting }) {
  const [typed, setTyped] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <h3 className="text-base font-bold text-slate-900 mb-1">Delete account?</h3>
        <p className="text-sm text-slate-500 mb-4">Permanently removes your profile, listings, and all data. This cannot be undone.</p>
        <p className="text-xs font-medium text-slate-700 mb-1.5">Type <span className="font-mono font-bold">DELETE</span> to confirm</p>
        <input
          type="text"
          value={typed}
          onChange={e => setTyped(e.target.value)}
          placeholder="DELETE"
          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400 mb-4"
        />
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={typed !== 'DELETE' || deleting}
            className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SettingsPanel() {
  const qc = useQueryClient()
  const { signOut } = useAuth()
  const fileRef = useRef(null)

  const { data: settings, isLoading } = useQuery({
    queryKey: ['user-settings'],
    queryFn: () => userService.getSettings().then(r => r.data),
  })

  const [form, setForm] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [pushPending, setPushPending] = useState(false)
  const [pushDenied, setPushDenied] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  useEffect(() => {
    registerServiceWorker()
    if (Notification.permission === 'denied') setPushDenied(true)
  }, [])

  if (settings && !form) {
    setForm({
      name:              settings.name ?? '',
      phone:             settings.phone ?? '',
      city:              settings.city ?? '',
      bio:               settings.bio ?? '',
      socialLinks:       settings.socialLinks ?? {},
      listingVisibility: settings.listingVisibility ?? 'PUBLIC',
      contactVisibility: settings.contactVisibility ?? 'LOGGED_IN',
      showExactLocation: settings.showExactLocation ?? true,
      emailNotifs:       settings.emailNotifs ?? true,
      pushNotifs:        settings.pushNotifs ?? true,
    })
  }

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: (data) => userService.updateProfile(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-settings'] })
      toast.success('Saved', 'Settings updated')
    },
    onError: () => toast.error('Error', 'Failed to save'),
  })

  const { mutate: upgradeRole, isPending: upgrading } = useMutation({
    mutationFn: () => authService.upgradeRole(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] })
      qc.invalidateQueries({ queryKey: ['user-settings'] })
      toast.success('Upgraded', 'You are now an owner')
    },
    onError: () => toast.error('Error', 'Could not upgrade role'),
  })

  const { mutate: sendPasswordReset, isPending: sendingReset } = useMutation({
    mutationFn: () => userService.changePassword(),
    onSuccess: () => toast.success('Email sent', 'Check your inbox'),
    onError: () => toast.error('Error', 'Failed to send reset email'),
  })

  const { mutate: resendVerification, isPending: sendingVerification } = useMutation({
    mutationFn: () => authService.sendEmailVerification(),
    onSuccess: () => toast.success('Email sent', 'Check your inbox for the verification link'),
    onError: () => toast.error('Error', 'Failed to send verification email'),
  })

  const { mutate: deleteAccount, isPending: deleting } = useMutation({
    mutationFn: () => userService.deleteAccount(),
    onSuccess: () => { toast.success('Deleted', 'Account removed'); signOut() },
    onError: () => toast.error('Error', 'Failed to delete account'),
  })

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }))
  const setSocial = (key, val) => setForm(p => ({ ...p, socialLinks: { ...p.socialLinks, [key]: val } }))

  async function handleAvatar(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarPreview(URL.createObjectURL(file))
    setUploading(true)
    try {
      await userService.uploadAvatar(file)
      qc.invalidateQueries({ queryKey: ['user-settings'] })
      qc.invalidateQueries({ queryKey: ['me'] })
      toast.success('Updated', 'Profile photo changed')
    } catch {
      toast.error('Failed', 'Could not upload photo')
      setAvatarPreview(null)
    } finally { setUploading(false) }
  }

  if (isLoading || !form) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-64 bg-slate-100 rounded-2xl" />)}
      </div>
    )
  }

  const avatarSrc = avatarPreview || settings?.avatarUrl
  const initial = settings?.name?.[0]?.toUpperCase() ?? 'U'
  const isOwner = settings?.role === 'OWNER'

  return (
    <div className="space-y-4">
      {showDeleteModal && (
        <DeleteModal
          onConfirm={() => deleteAccount()}
          onCancel={() => setShowDeleteModal(false)}
          deleting={deleting}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Settings</h1>
          <p className="text-xs text-slate-400">Manage your profile, privacy, and account</p>
        </div>
        <button
          onClick={() => save(form)}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#111111] text-white text-sm font-semibold rounded-xl hover:bg-[#2a2a2a] transition-colors disabled:opacity-60"
        >
          <Save className="w-3.5 h-3.5" strokeWidth={1.8} />
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* ── Row 1: Profile + Social ──────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Profile */}
        <Card icon={ICONS.user} title="Profile">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative group shrink-0">
              {avatarSrc ? (
                <img src={avatarSrc} alt="Avatar" className="w-14 h-14 rounded-full object-cover border-2 border-slate-100" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-[#111111] text-white flex items-center justify-center text-xl font-bold">
                  {initial}
                </div>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-colors"
              >
                <Camera className="w-4 h-4 text-white opacity-0 group-hover:opacity-100" strokeWidth={1.8} />
              </button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatar} className="hidden" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-sm font-semibold text-slate-800 truncate">{settings.name}</p>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isOwner ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-500'}`}>
                  {isOwner ? 'Owner' : 'Tenant'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">{settings.email}</p>
              <button onClick={() => fileRef.current?.click()} disabled={uploading} className="text-[11px] font-medium text-brand-600 mt-0.5">
                {uploading ? 'Uploading...' : 'Change photo'}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Name">
                <input type="text" value={form.name} onChange={e => set('name', e.target.value)} className={INPUT} />
              </Field>
              <Field label="Phone">
                <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 98765 43210" className={INPUT} />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="City">
                <select value={form.city} onChange={e => set('city', e.target.value)} className={INPUT}>
                  <option value="">Select your city</option>
                  {CITY_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Email">
                <input type="email" value={settings.email} disabled className="w-full px-3 py-2 border border-slate-100 rounded-lg text-sm bg-slate-100 text-slate-400 cursor-not-allowed" />
              </Field>
            </div>
            <Field label="Bio">
              <textarea
                value={form.bio}
                onChange={e => set('bio', e.target.value)}
                rows={2}
                maxLength={300}
                placeholder="Short intro about yourself..."
                className={`${INPUT} resize-none`}
              />
            </Field>
          </div>

          {!isOwner && (
            <div className="mt-4 p-3 bg-brand-50 rounded-xl border border-brand-100">
              <p className="text-xs font-semibold text-slate-800 mb-0.5">Want to list a property?</p>
              <p className="text-[11px] text-slate-500 mb-2">Upgrade to start listing and managing rentals.</p>
              <button
                onClick={() => upgradeRole()}
                disabled={upgrading}
                className="px-3 py-1.5 bg-[#111111] text-white text-xs font-bold rounded-lg hover:bg-[#2a2a2a] disabled:opacity-60"
              >
                {upgrading ? 'Upgrading...' : 'Become an owner'}
              </button>
            </div>
          )}
        </Card>

        {/* Social Links */}
        <Card icon={ICONS.globe} title="Social Links">
          <div className="space-y-3">
            {[
              { key: 'website',   label: 'Website',    placeholder: 'https://yoursite.com' },
              { key: 'linkedin',  label: 'LinkedIn',   placeholder: 'linkedin.com/in/you' },
              { key: 'instagram', label: 'Instagram',  placeholder: 'instagram.com/you' },
              { key: 'twitter',   label: 'Twitter / X', placeholder: 'x.com/you' },
            ].map(({ key, label, placeholder }) => (
              <Field key={key} label={label}>
                <input
                  type="url"
                  value={form.socialLinks[key] ?? ''}
                  onChange={e => setSocial(key, e.target.value)}
                  placeholder={placeholder}
                  className={INPUT}
                />
              </Field>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Row 2: Privacy + Notifications & Security ──────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Privacy & Visibility */}
        <Card icon={ICONS.eye} title="Privacy &amp; Visibility">
          {isOwner && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Listing visibility</p>
              <div className="space-y-1.5">
                <VisOpt value="PUBLIC"    current={form.listingVisibility} onChange={v => set('listingVisibility', v)} icon={ICONS.globe}   label="Public" />
                <VisOpt value="LOGGED_IN" current={form.listingVisibility} onChange={v => set('listingVisibility', v)} icon={ICONS.lock}    label="Logged-in only" />
                <VisOpt value="HIDDEN"    current={form.listingVisibility} onChange={v => set('listingVisibility', v)} icon={ICONS.eyeOff}  label="Hidden" />
              </div>
            </div>
          )}

          <div className={isOwner ? 'border-t border-slate-100 pt-4' : ''}>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Contact visibility</p>
            <div className="space-y-1.5 mb-4">
              <VisOpt value="EVERYONE"  current={form.contactVisibility} onChange={v => set('contactVisibility', v)} icon={ICONS.globe}   label="All users" />
              <VisOpt value="LOGGED_IN" current={form.contactVisibility} onChange={v => set('contactVisibility', v)} icon={ICONS.lock}    label="Logged-in only" />
              <VisOpt value="NOBODY"    current={form.contactVisibility} onChange={v => set('contactVisibility', v)} icon={ICONS.eyeOff}  label="Nobody" />
            </div>

            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Location</p>
            <Toggle
              checked={form.showExactLocation}
              onChange={v => set('showExactLocation', v)}
              label="Show exact address"
              description={form.showExactLocation ? 'Full address visible' : 'Area & city only'}
            />
          </div>
        </Card>

        {/* Notifications + Security stacked */}
        <div className="space-y-4">
          <Card icon={ICONS.bell} title="Notifications">
            <Toggle
              checked={form.emailNotifs}
              onChange={v => set('emailNotifs', v)}
              label="Email"
              description="Appointments, leases, alerts"
            />
            <Toggle
              checked={form.pushNotifs && !pushDenied}
              onChange={async (v) => {
                if (pushDenied) { toast.error('Blocked', 'Enable in browser settings'); return }
                setPushPending(true)
                try {
                  if (v) {
                    const sub = await subscribeToPush()
                    if (!sub) { if (Notification.permission === 'denied') setPushDenied(true); return }
                  } else { await unsubscribeFromPush() }
                  set('pushNotifs', v)
                } finally { setPushPending(false) }
              }}
              disabled={pushPending}
              label={pushPending ? 'Updating…' : 'Push'}
              description={pushDenied ? 'Blocked by browser' : 'Real-time browser alerts'}
            />
          </Card>

          <Card icon={ICONS.shield} title="Security">
            <div className="flex items-center justify-between pb-3 border-b border-slate-50">
              <div>
                <p className="text-sm font-medium text-slate-800">Email verification</p>
                <p className="text-[11px] text-slate-400">
                  {settings.isVerified ? 'Your email address is confirmed' : 'Confirm your email to mark your account as trusted'}
                </p>
              </div>
              {settings.isVerified ? (
                <span className="px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-[11px] font-bold shrink-0">
                  Verified
                </span>
              ) : (
                <button
                  onClick={() => resendVerification()}
                  disabled={sendingVerification}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 shrink-0"
                >
                  {sendingVerification ? 'Sending...' : 'Verify'}
                </button>
              )}
            </div>
            <div className="flex items-center justify-between pt-3">
              <div>
                <p className="text-sm font-medium text-slate-800">Password</p>
                <p className="text-[11px] text-slate-400">Reset via email link</p>
              </div>
              <button
                onClick={() => sendPasswordReset()}
                disabled={sendingReset}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {sendingReset ? 'Sending...' : 'Reset'}
              </button>
            </div>
          </Card>

          <LinkedAccountsCard />

          <DevicesCard />

          <Card icon={ICONS.trash} title="Danger Zone" danger>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-red-700">Delete account</p>
                <p className="text-[11px] text-red-400">Removes all data permanently</p>
              </div>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </Card>
        </div>
      </div>

      <div className="pb-4" />
    </div>
  )
}
