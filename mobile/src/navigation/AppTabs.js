import { useEffect } from 'react'
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
import VerificationScreen from '@features/listings/screens/VerificationScreen'
import LeasesScreen from '@features/leases/screens/LeasesScreen'
import CreateLeaseScreen from '@features/leases/screens/CreateLeaseScreen'
import SettingsScreen from '@features/profile/screens/SettingsScreen'
import HostDashboardScreen from '@features/host/screens/HostDashboardScreen'
import CalendarScreen from '@features/host/screens/CalendarScreen'
import SupportScreen from '@features/host/screens/SupportScreen'

const Tab = createBottomTabNavigator()

// Each tab is its own native-stack so PropertyDetail/BookViewing can be
// pushed on top of Explore/Saved/etc. without leaving the tab.
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
  ...BOOKING_SCREENS,
])

const SavedStack = makeStack([
  { name: 'SavedHome', component: SavedScreen, options: { title: 'Saved' } },
  ...BOOKING_SCREENS,
])

const ChatStack = makeStack([
  { name: 'ChatHome', component: ConversationListScreen, options: { title: 'Chat' } },
  { name: 'Conversation', component: ConversationScreen, options: { title: 'Chat' } },
])

// Traveler-only — listing management moved out to host mode's My Listing tab.
const ProfileStack = makeStack([
  { name: 'ProfileHome', component: ProfileScreen, options: { title: 'Profile' } },
  { name: 'Appointments', component: AppointmentsScreen, options: { headerShown: false } },
  { name: 'Notifications', component: NotificationsScreen, options: { headerShown: false } },
  { name: 'Leases', component: LeasesScreen, options: { headerShown: false } },
  { name: 'Settings', component: SettingsScreen, options: { headerShown: false } },
  { name: 'Support', component: SupportScreen, options: { headerShown: false } },
])

// ── Host mode — new stacks ──────────────────────────────────────────────
const DashboardStack = makeStack([
  { name: 'DashboardHome', component: HostDashboardScreen, options: { headerShown: false } },
  { name: 'Notifications', component: NotificationsScreen, options: { headerShown: false } },
  { name: 'Settings', component: SettingsScreen, options: { headerShown: false } },
  { name: 'Support', component: SupportScreen, options: { headerShown: false } },
])

const HostAppointmentsStack = makeStack([
  { name: 'AppointmentsHome', component: AppointmentsScreen, options: { headerShown: false }, initialParams: { initialTab: 'incoming' } },
])

const CalendarStack = makeStack([
  { name: 'CalendarHome', component: CalendarScreen, options: { headerShown: false } },
])

const MyListingStack = makeStack([
  { name: 'MyListingsHome', component: MyListingsScreen, options: { headerShown: false } },
  { name: 'AddListing', component: AddListingScreen, options: { headerShown: false, presentation: 'modal' } },
  { name: 'Verification', component: VerificationScreen, options: { headerShown: false } },
  { name: 'CreateLease', component: CreateLeaseScreen, options: { headerShown: false, presentation: 'modal' } },
  ...BOOKING_SCREENS,
])

const TRAVELER_TABS = [
  ['Explore', ExploreStack, 'explore'],
  ['Saved', SavedStack, 'saved'],
  ['Chat', ChatStack, 'chat'],
  ['Profile', ProfileStack, 'profile'],
]

// No Explore/Saved — mobile's map is traveler-only, matching web's host nav
// having no Map/Properties tabs either.
const HOST_TABS = [
  ['Dashboard', DashboardStack, 'grid'],
  ['Inbox', ChatStack, 'chat'],
  ['Appointments', HostAppointmentsStack, 'clock'],
  ['Calendar', CalendarStack, 'calendar'],
  ['MyListing', MyListingStack, 'building'],
]

export default function AppTabs() {
  const hostMode = useUiStore((s) => s.hostMode)
  const hostEntryTab = useUiStore((s) => s.hostEntryTab)
  const setHostEntryTab = useUiStore((s) => s.setHostEntryTab)

  const TABS = hostMode ? HOST_TABS : TRAVELER_TABS

  // hostEntryTab is read once as initialRouteName below (only relevant while
  // hostMode is true); reset it back to the default right after so a plain
  // "Become a host" tap next time doesn't re-use a stale entry tab.
  useEffect(() => {
    if (hostMode && hostEntryTab !== 'Dashboard') setHostEntryTab('Dashboard')
  }, [hostMode, hostEntryTab, setHostEntryTab])

  return (
    <Tab.Navigator
      key={hostMode ? 'host' : 'traveler'}
      initialRouteName={hostMode ? hostEntryTab : undefined}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand600,
        tabBarInactiveTintColor: colors.slate400,
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs },
        tabBarStyle: { borderTopColor: colors.slate200 },
      }}
    >
      {TABS.map(([name, Component, iconName]) => (
        <Tab.Screen
          key={name}
          name={name}
          component={Component}
          options={{
            tabBarIcon: ({ color, size }) => <Icon name={iconName} color={color} size={size} />,
          }}
        />
      ))}
    </Tab.Navigator>
  )
}
