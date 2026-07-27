import { useUiStore } from '@store/uiStore'
import TenantMessages from './TenantMessages'
import OwnerInbox from './OwnerInbox'

// The one place the renter/host toggle picks a messaging surface. Everything
// else about the two lives in its own file — this used to be a ~900-line
// component that branched on `hostMode` in nine places.
//
// Mounting one or the other (rather than rendering both and hiding one) is
// deliberate: each owns its own selected thread, search text and socket
// subscriptions, and switching hats should not carry a renter's open
// conversation into the host inbox.
export default function ChatPanel() {
  const hostMode = useUiStore((s) => s.hostMode)
  return hostMode ? <OwnerInbox /> : <TenantMessages />
}
