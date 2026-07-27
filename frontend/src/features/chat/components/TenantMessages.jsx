import { Link } from 'react-router-dom'
import { SquarePen } from 'lucide-react'
import ChatSurface from './shared/ChatSurface'

// The RENTER's messages: threads you started, with the owners of listings you
// asked about. Paired with OwnerInbox.jsx — see that file's header for why the
// two are separate components rather than one with a flag.
//
// What is specific to this side, and only lives here:
//  - "Messages", and every thread is one you opened
//  - the counterpart is an Owner, and their MEASURED median reply time is worth
//    showing (chat.service.js; absent below three samples). An owner does not
//    need to be told how fast they themselves answer, so the owner surface
//    passes none.
//  - a renter CAN start a thread, so the empty state and the header action both
//    lead to the map. Owners cannot, so their copy of this is a listings link.
export default function TenantMessages() {
  return (
    <ChatSurface
      side="tenant"
      title="Messages"
      counterpartRole="Owner"
      showReplyTime
      emptyPrompt="Choose one of your conversations on the left"
      headerAction={(
        <Link
          to="/"
          aria-label="Find a place to message an owner about"
          className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors text-slate-500 no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <SquarePen className="w-[18px] h-[18px]" strokeWidth={2} />
        </Link>
      )}
      empty={{
        title: 'No conversations yet',
        body: 'Find a place on the map and use “Chat with owner” — your conversations will collect here.',
        action: (
          <Link
            to="/"
            className="mt-5 inline-flex items-center justify-center min-h-[44px] px-5 rounded-xl bg-[#111111] text-sm font-semibold text-white no-underline hover:bg-[#2a2a2a] transition-colors"
          >
            Browse the map
          </Link>
        ),
      }}
    />
  )
}
