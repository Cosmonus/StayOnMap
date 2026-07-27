import { useUiStore } from '@store/uiStore'
import TenantMessagesScreen from './TenantMessagesScreen'
import OwnerInboxScreen from './OwnerInboxScreen'

// The one place the renter/host toggle picks a messaging surface. Registered in
// AppTabs as the Chat/Inbox tab under both modes, so the route name stays put
// and every existing navigate('Chat') / navigate('Inbox') keeps working.
//
// Mounting one or the other (rather than one screen with a flag) is deliberate:
// each owns its own list state and socket subscriptions, and the two are
// different jobs — one person chasing a home, the other answering enquiries.
export default function ConversationListScreen({ navigation }) {
  const hostMode = useUiStore((s) => s.hostMode)
  return hostMode
    ? <OwnerInboxScreen navigation={navigation} />
    : <TenantMessagesScreen navigation={navigation} />
}
