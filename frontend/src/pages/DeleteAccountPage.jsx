import { Link } from 'react-router-dom'
import { Trash2, Mail } from 'lucide-react'
import SEOMeta from '@components/common/SEOMeta'
import { canonical } from '@lib/seo'
import { LegalPageLayout, Section } from '@components/common/LegalPageLayout'

// Public on purpose — no UserGuard, no login wall.
//
// This is the URL given to Apple App Store Connect and Google Play as the
// account-deletion link, and both require it to be readable by someone who is
// NOT signed in (that is precisely the person who most needs it). The page
// therefore explains the in-app route AND an email route for anyone who has
// lost access to their account.
//
// Everything stated here is checked against the code: deleteAccount() in
// users.service.js is a hard `prisma.user.delete`, and the cascade behaviour of
// each relation is declared in schema.prisma. If you change either, change the
// two lists below — an inaccurate deletion promise is worse than none.
const SECTIONS = [
  { id: 'in-app',  label: 'Delete it yourself' },
  { id: 'email',   label: 'If you cannot sign in' },
  { id: 'deleted', label: 'What is deleted' },
  { id: 'kept',    label: 'What we keep, and why' },
  { id: 'timing',  label: 'How long it takes' },
]

export default function DeleteAccountPage() {
  return (
    <>
      <SEOMeta
        title="Delete your account"
        description="How to permanently delete your StayOnMap account and the data associated with it, from the app or by email."
        canonical={canonical('/delete-account')}
      />
      <LegalPageLayout title="Delete your account" lastUpdated="July 31, 2026" sections={SECTIONS}>

        <div className="rounded-2xl border border-brand-100 bg-brand-50 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <p className="text-sm text-slate-600 leading-relaxed">
              You can delete your StayOnMap account yourself, at any time, without asking us.
              It is permanent and takes effect immediately.
            </p>
          </div>
          <Link
            to="/user?tab=settings"
            className="min-h-[44px] shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#111111] hover:bg-[#2a2a2a] text-white text-sm font-semibold transition-colors no-underline whitespace-nowrap"
          >
            <Trash2 size={16} aria-hidden="true" />
            Go to Settings
          </Link>
        </div>

        <Section id="in-app" title="1. Delete it yourself">
          <p>
            The fastest route is in the app, and it needs no approval from us.
          </p>
          <p>
            <span className="font-semibold text-slate-800">On the web:</span>{' '}
            sign in, open <Link to="/user?tab=settings" className="text-brand-600">Settings</Link>,
            scroll to <span className="font-semibold text-slate-800">Delete account</span> at the
            bottom, and confirm.
          </p>
          <p>
            <span className="font-semibold text-slate-800">In the iOS or Android app:</span>{' '}
            open the account menu, tap <span className="font-semibold text-slate-800">Settings</span>,
            then <span className="font-semibold text-slate-800">Delete account</span>, and confirm.
          </p>
          <p>
            You will be asked to confirm once. After that the account is gone and cannot be
            restored, so if you only want to stop hearing from us, turning off email and push
            notifications in the same Settings screen is the reversible option.
          </p>
        </Section>

        <Section id="email" title="2. If you cannot sign in">
          <p>
            Lost your password, lost access to your email, or the account is already locked?
            Write to us and we will delete it for you.
          </p>
          <p>
            <a
              href="mailto:hello@cosmonus.com?subject=Account%20deletion%20request"
              className="min-h-[44px] inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white border border-slate-200 hover:border-brand-600 text-brand-600 text-sm font-semibold transition-colors no-underline"
            >
              <Mail size={16} aria-hidden="true" />
              hello@cosmonus.com
            </a>
          </p>
          <p>
            Send it from the email address on the account if you can, and tell us the registered
            email address either way. We will confirm it is really you before deleting anything —
            an account deletion request we act on without checking is a way to get somebody
            else&rsquo;s account deleted.
          </p>
        </Section>

        <Section id="deleted" title="3. What is deleted">
          <p>
            Deletion is permanent removal, not deactivation and not anonymisation. Your user
            record is deleted from the database and the following are deleted along with it:
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li>Your profile — name, email, phone, city, photo, bio and social links</li>
            <li>Your password, sign-in sessions on every device, and any linked social accounts</li>
            <li>Any property listings you posted, including their photos, amenities and house rules</li>
            <li>Your visit requests, and any visit requests other people made on your listings</li>
            <li>Your lease records, both as a renter and as an owner</li>
            <li>Your conversations and every message in them</li>
            <li>Reviews and neighbourhood insights you wrote</li>
            <li>Your saved listings, points ledger, and notifications</li>
            <li>Your push notification registrations, so the app can no longer reach your devices</li>
          </ul>
        </Section>

        <Section id="kept" title="4. What we keep, and why">
          <p>
            Two things outlive the account, and neither stays linked to you — your name and
            identifiers are stripped from both:
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li>
              <span className="font-semibold text-slate-800">Reports you filed about a listing.</span>{' '}
              A safety report is evidence about somebody else&rsquo;s property. If deleting your
              account erased it, anyone could clear the record against a listing by closing their
              account, so the report stays and the reporter field is emptied.
            </li>
            <li>
              <span className="font-semibold text-slate-800">Moderation and admin audit records.</span>{' '}
              A log of what our moderators did has to remain auditable. Your identifier is
              removed from it.
            </li>
          </ul>
          <p>
            We may also retain records where the law requires it — for example a transaction
            record we are obliged to keep. See{' '}
            <Link to="/privacy" className="text-brand-600">Data retention</Link> in the Privacy
            Policy.
          </p>
        </Section>

        <Section id="timing" title="5. How long it takes">
          <p>
            Deleting from the app is immediate — the record is removed as you confirm, and you are
            signed out. An emailed request is actioned once we have verified the account is yours,
            normally within 7 days.
          </p>
          <p>
            Encrypted database backups are kept on a rolling 14-day window for disaster recovery,
            so a residual copy can persist in a backup for up to 14 days after deletion before it
            is overwritten. Backups are never used to repopulate a deleted account.
          </p>
        </Section>

      </LegalPageLayout>
    </>
  )
}
