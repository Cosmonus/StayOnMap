import ThreadListScreen from '../components/shared/ThreadListScreen'

// The RENTER's messages: threads you started with the owners of listings you
// asked about. Paired with OwnerInboxScreen.js. Mirrors web's TenantMessages.
//
// A renter CAN start a thread — from a property's detail page — so the empty
// state sends them to the map rather than just describing the situation.
export default function TenantMessagesScreen({ navigation }) {
  return (
    <ThreadListScreen
      navigation={navigation}
      side="tenant"
      title="Messages"
      counterpartRole="Owner"
      empty={{
        title: 'No conversations yet',
        body: 'Find a place on the map and tap “Chat with owner” — your conversations will collect here.',
        actionLabel: 'Browse the map',
        // Chat is its own tab, so the map is a tab away, not a push.
        onAction: () => navigation.getParent()?.navigate('Explore'),
      }}
    />
  )
}
