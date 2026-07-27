import { Link } from 'react-router-dom'
import ChatSurface from './shared/ChatSurface'

// The OWNER's inbox: renters who have contacted you about your listings.
//
// This and TenantMessages.jsx are two components, not one with a `hostMode`
// prop, because the two are different jobs done by different people who happen
// to share a login: one is chasing a home, the other is answering enquiries.
// A single component branching on the mode is how the two drifted into sharing
// a badge that counted the wrong hat.
//
// What is specific to this side, and only lives here:
//  - "Inbox", and every thread is one someone else opened
//  - the counterpart is a Renter, and no reply-time line: it is measured from
//    the OWNER's history, so showing it here would report your own speed back
//    to you
//  - an owner cannot start a thread from here — a conversation is keyed
//    (property, tenant) and begins when a renter asks — so the empty state
//    points at the listings that attract them instead of offering a compose
//    button that cannot work. The old shared header had exactly that: a
//    SquarePen with no handler at all.
export default function OwnerInbox() {
  return (
    <ChatSurface
      side="owner"
      title="Inbox"
      counterpartRole="Renter"
      emptyPrompt="Choose a renter's message on the left"
      empty={{
        title: 'No messages from renters yet',
        body: 'When a renter messages you about one of your listings, the conversation will appear here.',
        action: (
          <Link
            to="/list"
            className="mt-5 inline-flex items-center justify-center min-h-[44px] px-5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 no-underline hover:border-slate-400 transition-colors"
          >
            View my listings
          </Link>
        ),
      }}
    />
  )
}
