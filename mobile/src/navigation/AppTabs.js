import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { chatService } from '@services/chat.service'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { useUiStore } from '@store/uiStore'
import ExploreScreen from '@features/discover/screens/ExploreScreen'
import SavedScreen from '@features/saved/screens/SavedScreen'
import ConversationListScreen from '@features/chat/screens/ConversationListScreen'
import ConversationScreen from '@features/chat/screens/ConversationScreen'
import ProfileScreen from '@features/profile/screens/ProfileScreen'
import PropertyDetailScreen from '@features/properties/screens/PropertyDetailScreen'
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

const Tab = createBottomTabNavigator()

// Each tab is its own native-stack so PropertyDetail/BookViewing can be
// pushed on top of Explore/Saved/etc. without leaving the tab.
function makeStack(screens) {
  const Stack = createNativeStackNavigator()
  return function StackScreen() {
    // Every screen draws its own ScreenHeader, so the native header is off by
    // default here rather than repeated per screen — a new screen that forgot
    // the flag used to silently get a platform header in system typography,
    // which is exactly how five of them drifted.
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {screens.map(({ name, component, options, initialParams }) => (
          <Stack.Screen key={name} name={name} component={component} options={options} initialParams={initialParams} />
        ))}
      </Stack.Navigator>
    )
  }
}

const BOOKING_SCREENS = [
  { name: 'PropertyDetail', component: PropertyDetailScreen },
  { name: 'BookViewing', component: BookViewingScreen, options: { presentation: 'modal' } },
]

const ExploreStack = makeStack([
  { name: 'ExploreHome', component: ExploreScreen },
  ...BOOKING_SCREENS,
])

const SavedStack = makeStack([
  { name: 'SavedHome', component: SavedScreen },
  ...BOOKING_SCREENS,
])

const ChatStack = makeStack([
  { name: 'ChatHome', component: ConversationListScreen },
  { name: 'Conversation', component: ConversationScreen },
])

// Renter-only — listing management moved out to host mode's My Listing tab.
const ProfileStack = makeStack([
  { name: 'ProfileHome', component: ProfileScreen },
  { name: 'Appointments', component: AppointmentsScreen },
  { name: 'Notifications', component: NotificationsScreen },
  { name: 'Leases', component: LeasesScreen },
  { name: 'Settings', component: SettingsScreen },
  { name: 'Support', component: SupportScreen },
  // Appointments and leases are ABOUT a property, so the property has to be
  // reachable from them — without this a push to PropertyDetail bubbles to the
  // tab navigator, finds no such tab, and silently does nothing.
  ...BOOKING_SCREENS,
])

// ── Host mode — new stacks ──────────────────────────────────────────────
const DashboardStack = makeStack([
  { name: 'DashboardHome', component: HostDashboardScreen },
  { name: 'Calendar', component: CalendarScreen },
])

const HostAppointmentsStack = makeStack([
  { name: 'AppointmentsHome', component: AppointmentsScreen, initialParams: { initialTab: 'incoming' } },
  ...BOOKING_SCREENS,
])

const HostProfileStack = makeStack([
  { name: 'HostProfileHome', component: HostProfileScreen },
  { name: 'Notifications', component: NotificationsScreen },
  { name: 'Settings', component: SettingsScreen },
  { name: 'Support', component: SupportScreen },
])

const MyListingStack = makeStack([
  { name: 'MyListingsHome', component: MyListingsScreen },
  { name: 'AddListing', component: AddListingScreen, options: { presentation: 'modal' } },
  { name: 'ManageListing', component: ManageListingScreen },
  { name: 'EditListing', component: EditListingScreen },
  { name: 'Verification', component: VerificationScreen },
  { name: 'CreateLease', component: CreateLeaseScreen, options: { presentation: 'modal' } },
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
// The Profile tab uses a mode-unique route name ('HostProfile') even though it
// shows the label "Profile" — see the switch-landing note in AppTabs below.
const HOST_TABS = [
  ['Dashboard', DashboardStack, 'grid'],
  ['Inbox', ChatStack, 'chat'],
  ['Appointments', HostAppointmentsStack, 'clock'],
  ['MyListing', MyListingStack, 'building'],
  ['HostProfile', HostProfileStack, 'profile', 'Profile'],
]

// React Navigation's default bar is ~49dp. 56 buys the top padding below
// without squeezing the icon and label, keeping each tab's touch target well
// over the 48dp Android minimum (mobile/AGENTS.md §6).
const TAB_BAR_HEIGHT = 56
const TAB_BAR_TOP_PAD = 6

// The Chat/Inbox tab in both sets. `chatService.unreadCount()` (GET /chat/unread)
// already existed on the client and the server and had NO caller — the count was
// only ever visible per-conversation, once you were already inside the list.
const CHAT_TABS = new Set(['Chat', 'Inbox'])

export default function AppTabs() {
  const insets = useSafeAreaInsets()
  const hostMode = useUiStore((s) => s.hostMode)
  // Same key ConversationListScreen invalidates on a new socket message, so the
  // badge clears as soon as a thread is read rather than on the next poll.
  const { data: chatUnread = 0 } = useQuery({
    queryKey: ['chat', 'unread'],
    queryFn: () => chatService.unreadCount().then((r) => r.data?.count ?? 0),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
  const hostEntryTab = useUiStore((s) => s.hostEntryTab)
  const setHostEntryTab = useUiStore((s) => s.setHostEntryTab)

  const TABS = hostMode ? HOST_TABS : RENTER_TABS

  // hostEntryTab is read once as initialRouteName below (only relevant while
  // hostMode is true); reset it back to the default right after so a plain
  // "Become a host" tap next time doesn't re-use a stale entry tab.
  useEffect(() => {
    if (hostMode && hostEntryTab !== 'Dashboard') setHostEntryTab('Dashboard')
  }, [hostMode, hostEntryTab, setHostEntryTab])

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
        // Icons sat flush against the top border. The height is set explicitly
        // because React Navigation otherwise computes it and `paddingTop` would
        // just compress the icon/label into the same space rather than adding
        // room. The bottom inset is applied by hand for the same reason — with
        // an explicit height the navigator stops adding it for us, and on a
        // gesture-nav device the bar would sit under the home indicator
        // (mobile/AGENTS.md §3).
        tabBarStyle: {
          borderTopColor: colors.slate200,
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingTop: TAB_BAR_TOP_PAD,
          paddingBottom: insets.bottom,
        },
      }}
    >
      {TABS.map(([name, Component, iconName, label]) => (
        <Tab.Screen
          key={name}
          name={name}
          component={Component}
          options={{
            tabBarLabel: label ?? name,
            tabBarIcon: ({ color, size }) => <Icon name={iconName} color={color} size={size} />,
            tabBarBadge: CHAT_TABS.has(name) && chatUnread > 0 ? (chatUnread > 99 ? '99+' : chatUnread) : undefined,
            tabBarBadgeStyle: { backgroundColor: colors.danger, fontFamily: fonts.bodySemiBold, fontSize: 11 },
          }}
        />
      ))}
    </Tab.Navigator>
  )
}
