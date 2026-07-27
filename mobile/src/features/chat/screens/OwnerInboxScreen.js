import ThreadListScreen from '../components/shared/ThreadListScreen'

// The OWNER's inbox: renters who have contacted you about your listings.
// Mirrors web's OwnerInbox.
//
// An owner cannot start a thread from here — a conversation is keyed
// (property, tenant) and begins when a renter asks — so the empty state points
// at the listings that attract them instead of offering a compose action that
// cannot work.
export default function OwnerInboxScreen({ navigation }) {
  return (
    <ThreadListScreen
      navigation={navigation}
      side="owner"
      title="Inbox"
      counterpartRole="Renter"
      empty={{
        title: 'No messages from renters yet',
        body: 'When a renter messages you about one of your listings, it will appear here.',
        actionLabel: 'View my listings',
        onAction: () => navigation.getParent()?.navigate('MyListing'),
      }}
    />
  )
}
