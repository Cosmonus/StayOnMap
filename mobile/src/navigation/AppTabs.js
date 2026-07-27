import { useEffect } from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useQuery } from '@tanstack/react-query'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { useUiStore } from '@store/uiStore'
import { flushPendingReference } from '@navigation/navigationRef'
import { useAuth } from '@features/auth/hooks/useAuth'
import { hostService } from '@services/host.service'
import { chatService } from '@services/chat.service'
import ExploreScreen from '@features/discover/screens/ExploreScreen'
import SavedScreen from '@features/saved/screens/SavedScreen'
import ConversationListScreen from '@features/chat/screens/ConversationListScreen'
import ConversationScreen from '@features/chat/screens/ConversationScreen'
import ProfileScreen from '@features/profile/screens/ProfileScreen'
import PropertyDetailScreen from '@features/properties/screens/PropertyDetailScreen'
import PropertyListScreen from '@features/properties/screens/PropertyListScreen'
import BookViewingScreen from '@features/appointments/screens/BookViewingScreen'
import AppointmentsScreen from '@features/appointments/screens/AppointmentsScreen'
import NotificationsScreen from '@features/notifications/screens/NotificationsScreen'
import MyListingsScreen from '@features/listings/screens/MyListingsScreen'
import AddListingScreen from '@features/listings/screens/AddListingScreen'
import ManageListingScreen from '@features/listings/screens/ManageListingScreen'
import EditListingScreen from '@features/listings/screens/EditListingScreen'
import VerificationScreen from '@features/listings/screens/VerificationScreen'
import LeasesScreen from '@features/leases/screens/LeasesScreen'
import CreateLeaseScreen from '@features/leases/screens/CreateLeaseScreen'
import SettingsScreen from '@features/profile/screens/SettingsScreen'
import HostDashboardScreen from '@features/host/screens/HostDashboardScreen'
import HostProfileScreen from '@features/host/screens/HostProfileScreen'
import CalendarScreen from '@features/host/screens/CalendarScreen'
import SupportScreen from '@features/host/screens/SupportScreen'
import LegalScreen from '@features/legal/screens/LegalScreen'
import RulesScreen from '@features/legal/screens/RulesScreen'

const Tab = createBottomTabNavigator()

// Each tab is its own native-stack so PropertyDetail/BookViewing can be
// pushed on top of Explore/Saved/etc. without leaving the tab.
//
// EVERY screen sets headerShown: false and draws its own ScreenHeader inside
// its SafeAreaView. Five screens used to keep React Navigation's native header
// instead — a different font and bar height from the other twenty, a second top
// inset on Calendar (which also had a SafeAreaView), and a host "Inbox" tab
// whose header read "Chat". Don't reintroduce a native header for one screen.
function makeStack(screens) {
  const Stack = createNativeStackNavigator()
  return function StackScreen() {
    return (
      <Stack.Navigator>
        {screens.map(({ name, component, options, initialParams }) => (
          <Stack.Screen key={name} name={name} component={component} options={options} initialParams={initialParams} />
        ))}
      </Stack.Navigator>
    )
  }
}

const BOOKING_SCREENS = [
  { name: 'PropertyDetail', component: PropertyDetailScreen, options: { headerShown: false } },
  { name: 'BookViewing', component: BookViewingScreen, options: { headerShown: false, presentation: 'modal' } },
]

const ExploreStack = makeStack([
  { name: 'ExploreHome', component: ExploreScreen, options: { headerShown: false } },
  // The map's list handoff — web's /properties. Explore-only: it reads the
  // live map viewport, so it has no meaning pushed from anywhere else.
  { name: 'PropertyList', component: PropertyListScreen, options: { headerShown: false } },
  ...BOOKING_SCREENS,
])

const SavedStack = makeStack([
  { name: 'SavedHome', component: SavedScreen, options: { headerShown: false } },
  ...BOOKING_SCREENS,
])

// A thread opens INSIDE whichever tab opened it — the same reason
// BOOKING_SCREENS is spread into every stack that can open a listing.
//
// The alternative, a cross-tab `navigate('Inbox', { screen: 'Conversation' })`,
// pushes the thread onto the Inbox tab's own stack. That tab then stays parked
// on a conversation the user never opened from there, so tapping "Inbox" shows
// one thread instead of the inbox — and hitting back from it lands on the chat
// list rather than the screen they actually came from.
const CONVERSATION_SCREEN = {
  name: 'Conversation',
  component: ConversationScreen,
  options: { headerShown: false },
}

const ChatStack = makeStack([
  { name: 'ChatHome', component: ConversationListScreen, options: { headerShown: false } },
  CONVERSATION_SCREEN,
])

// Renter-only — listing management moved out to host mode's My Listing tab.
const ProfileStack = makeStack([
  { name: 'ProfileHome', component: ProfileScreen, options: { headerShown: false } },
  { name: 'Appointments', component: AppointmentsScreen, options: { headerShown: false } },
  { name: 'Notifications', component: NotificationsScreen, options: { headerShown: false } },
  { name: 'Leases', component: LeasesScreen, options: { headerShown: false } },
  { name: 'Settings', component: SettingsScreen, options: { headerShown: false } },
  { name: 'Support', component: SupportScreen, options: { headerShown: false } },
  { name: 'Legal', component: LegalScreen, options: { headerShown: false } },
  { name: 'Rules', component: RulesScreen, options: { headerShown: false } },
])

// ── Host mode — new stacks ──────────────────────────────────────────────
const DashboardStack = makeStack([
  { name: 'DashboardHome', component: HostDashboardScreen, options: { headerShown: false } },
  { name: 'Calendar', component: CalendarScreen, options: { headerShown: false } },
])

const HostAppointmentsStack = makeStack([
  { name: 'AppointmentsHome', component: AppointmentsScreen, options: { headerShown: false }, initialParams: { initialTab: 'incoming' } },
  // "Chat" on a visit request. Only the incoming (owner) card has that button,
  // and only this stack passes initialTab: 'incoming' — so the renter's copy of
  // AppointmentsScreen, over in ProfileStack, has no way to reach it.
  CONVERSATION_SCREEN,
])

const HostProfileStack = makeStack([
  { name: 'HostProfileHome', component: HostProfileScreen, options: { headerShown: false } },
  { name: 'Notifications', component: NotificationsScreen, options: { headerShown: false } },
  { name: 'Settings', component: SettingsScreen, options: { headerShown: false } },
  { name: 'Support', component: SupportScreen, options: { headerShown: false } },
  { name: 'Legal', component: LegalScreen, options: { headerShown: false } },
  { name: 'Rules', component: RulesScreen, options: { headerShown: false } },
])

const MyListingStack = makeStack([
  { name: 'MyListingsHome', component: MyListingsScreen, options: { headerShown: false } },
  { name: 'AddListing', component: AddListingScreen, options: { headerShown: false, presentation: 'modal' } },
  { name: 'ManageListing', component: ManageListingScreen, options: { headerShown: false } },
  { name: 'EditListing', component: EditListingScreen, options: { headerShown: false } },
  { name: 'Verification', component: VerificationScreen, options: { headerShown: false } },
  { name: 'CreateLease', component: CreateLeaseScreen, options: { headerShown: false, presentation: 'modal' } },
  ...BOOKING_SCREENS,
])

const RENTER_TABS = [
  ['Explore', ExploreStack, 'explore'],
  ['Saved', SavedStack, 'saved'],
  ['Chat', ChatStack, 'chat'],
  ['Profile', ProfileStack, 'profile'],
]

// No Explore/Saved — mobile's map is renter-only, matching web's host nav
// having no Map/Properties tabs either.
//
// Route names are NOT the labels here: 'HostProfile' is mode-unique for the
// switch-landing reason below, and 'Appointments'/'MyListing' read as "Visits"
// and "Listings" because that is what a host calls them. Renaming the routes
// themselves would break every navigate() call and the push deep links.
const HOST_TABS = [
  ['Dashboard', DashboardStack, 'grid'],
  ['MyListing', MyListingStack, 'building', 'Listings'],
  ['Appointments', HostAppointmentsStack, 'clock', 'Visits'],
  ['Inbox', ChatStack, 'chat'],
  ['HostProfile', HostProfileStack, 'profile', 'Account'],
]

// What each mode needs to see without opening anything: a host's unanswered
// visit requests and messages from renters, a renter's replies from owners.
//
// The unread count is PER HAT, matching the partition the inbox itself applies
// (ConversationListScreen): host mode counts threads you own, renter mode
// threads you started. A whole-account total badges one mode for a message the
// other mode holds — the badge says 1, the list is empty, and the only way to
// find the message is to guess you have to switch modes.
//
// Both ride on queries the screens fetch anyway (same keys, so no extra
// request), and both are 0 → undefined, because React Navigation renders a
// literal "0" badge otherwise — a bright dot announcing nothing.
function useTabBadges(hostMode) {
  const { user } = useAuth()

  const { data: dashboard } = useQuery({
    queryKey: ['host-dashboard'],
    queryFn: () => hostService.dashboard().then((r) => r.data),
    enabled: hostMode && !!user,
  })

  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => chatService.conversations().then((r) => r.data),
    enabled: !!user,
  })

  const visits = (dashboard?.needsYouToday ?? []).filter((i) => i.kind === 'VISIT_REQUEST').length
  const unread = conversations
    .filter((c) => (hostMode ? c.ownerId === user?.id : c.tenantId === user?.id))
    .reduce((n, c) => n + (c._count?.messages ?? 0), 0)

  // Keyed by ROUTE name, and the two modes name the chat tab differently
  // (HOST_TABS' 'Inbox' vs RENTER_TABS' 'Chat').
  return hostMode
    ? { Appointments: visits || undefined, Inbox: unread || undefined }
    : { Chat: unread || undefined }
}

// Tapping "Listings" must always land on the LIST.
//
// The add-a-listing wizard is pushed onto this tab's stack — by the Add button
// on the list, and by the dashboard's "Add listing", which jumps tabs to get
// here — and a stack remembers what was pushed. So walking away mid-wizard via
// the tab bar left "Listings" reopening a half-filled form instead of your
// listings, with nothing on screen to say the list was one back-press away.
//
// Only the wizard is dismissed. ManageListing, EditListing and the rest are
// PLACES, and keeping your spot in them is exactly what a tab should do; a
// wizard is a task. Dismissing it costs nothing either, because
// listings/.../draftStore.js persists every change — which is what "Safe to
// close — we keep your draft" already promises the owner. Tapping Add resumes
// on the same step.
const TAB_LISTENERS = {
  MyListing: ({ navigation, route }) => ({
    tabPress: () => {
      const stack = route.state
      if (!stack?.routes?.length) return
      const top = stack.routes[stack.index ?? stack.routes.length - 1]
      if (top?.name === 'AddListing') navigation.navigate('MyListing', { screen: 'MyListingsHome' })
    },
  }),
}

export default function AppTabs() {
  const hostMode = useUiStore((s) => s.hostMode)
  const hostEntryTab = useUiStore((s) => s.hostEntryTab)
  const setHostEntryTab = useUiStore((s) => s.setHostEntryTab)

  const TABS = hostMode ? HOST_TABS : RENTER_TABS
  const badges = useTabBadges(hostMode)

  // hostEntryTab is read once as initialRouteName below (only relevant while
  // hostMode is true); reset it back to the default right after so a plain
  // "Become a host" tap next time doesn't re-use a stale entry tab.
  useEffect(() => {
    if (hostMode && hostEntryTab !== 'Dashboard') setHostEntryTab('Dashboard')
  }, [hostMode, hostEntryTab, setHostEntryTab])

  // A notification addressed to the OTHER hat parks itself and flips the mode
  // (navigationRef.js), which remounts this navigator — this is where it lands.
  // Runs after every remount, and does nothing when nothing is parked.
  useEffect(() => { flushPendingReference() }, [hostMode])

  // Landing tab on a host/renter switch is driven entirely by initialRouteName
  // (Dashboard for host, Explore — the first renter tab — for renter). This only
  // works because the two tab sets share NO route name: remounting via `key`
  // makes React Navigation drop the previously focused route (it no longer
  // exists in the new set) and fall back to initialRouteName on the first paint.
  // If a shared name existed (e.g. both called their last tab 'Profile'), it
  // would stay focused and flash before correcting — hence the host tab's unique
  // 'HostProfile' route name above.

  return (
    <Tab.Navigator
      key={hostMode ? 'host' : 'renter'}
      initialRouteName={hostMode ? hostEntryTab : undefined}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand600,
        tabBarInactiveTintColor: colors.slate500,
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs },
        // Explicit white, not the platform default: the app's chrome is white
        // top (ScreenHeader, including the status-bar inset) and bottom, with
        // the slate50 canvas between — the shell every other phone app uses.
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.slate200 },
        tabBarBadgeStyle: {
          backgroundColor: colors.danger,
          color: colors.white,
          fontFamily: fonts.bodySemiBold,
          fontSize: 11,
        },
      }}
    >
      {TABS.map(([name, Component, iconName, label]) => (
        <Tab.Screen
          key={name}
          name={name}
          component={Component}
          listeners={TAB_LISTENERS[name]}
          options={{
            tabBarLabel: label ?? name,
            tabBarBadge: badges[name],
            tabBarIcon: ({ color, size }) => <Icon name={iconName} color={color} size={size} />,
          }}
        />
      ))}
    </Tab.Navigator>
  )
}
