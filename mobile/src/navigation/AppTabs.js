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
// The static SupportScreen (a list of links and a mailto) is replaced by the
// case system: it could point somebody at the right page but could not TAKE a
// request, so anything it did not cover left the product entirely.
import SupportCenterScreen from '@features/support/screens/SupportCenterScreen'
import SupportCaseScreen from '@features/support/screens/SupportCaseScreen'
import SupportArticleScreen from '@features/support/screens/SupportArticleScreen'

import LegalScreen from '@features/legal/screens/LegalScreen'
import RulesScreen from '@features/legal/screens/RulesScreen'

// Support travels as a GROUP: the centre, one case, and one article. Both the
// renter and the host stack mount all three, so 'back' from a case returns to
// the list inside the tab the reader came from rather than falling through.
const SUPPORT_SCREENS = [
  { name: 'Support', component: SupportCenterScreen, options: { headerShown: false } },
  { name: 'SupportCase', component: SupportCaseScreen, options: { headerShown: false } },
  { name: 'SupportArticle', component: SupportArticleScreen, options: { headerShown: false } },
]

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

// Notifications is a DESTINATION, not a tab, and the bell that opens it sits on
// the home screen of Explore (renter) and Dashboard (host) as well as in both
// account menus. It therefore rides along in every stack that can open it, for
// the same reason CONVERSATION_SCREEN does: opening it cross-tab in the account
// stack meant back from the bell popped to the ACCOUNT screen — somewhere the
// reader had never been — and only then to the map they came from.
const NOTIFICATIONS_SCREEN = {
  name: 'Notifications',
  component: NotificationsScreen,
  options: { headerShown: false },
}

// Every stack that can show a listing can also open its "Message owner" thread
// (CONVERSATION_SCREEN rides along), and every stack that can show a thread
// can also open the listing it is about — a conversation's property card
// pushes PropertyDetail. The two travel together so both hops stay INSIDE the
// current tab and back always returns to the screen that opened them.
const BOOKING_SCREENS = [
  { name: 'PropertyDetail', component: PropertyDetailScreen, options: { headerShown: false } },
  { name: 'BookViewing', component: BookViewingScreen, options: { headerShown: false, presentation: 'modal' } },
  CONVERSATION_SCREEN,
]

const ExploreStack = makeStack([
  { name: 'ExploreHome', component: ExploreScreen, options: { headerShown: false } },
  // The map's list handoff — web's /properties. Explore-only: it reads the
  // live map viewport, so it has no meaning pushed from anywhere else.
  { name: 'PropertyList', component: PropertyListScreen, options: { headerShown: false } },
  NOTIFICATIONS_SCREEN,
  ...BOOKING_SCREENS,
])

// Renter's Properties tab — the list-first way in, added 2026-08-07.
//
// SAME SCREEN as Explore's PropertyList, with `scoped: false`. That flag is
// load-bearing: pushed from the map the list carries the viewport, but a TAB is
// a starting point, not a continuation — constraining a cold tap to wherever
// the map was last left is a filter nobody can see. Browse mode drops bounds
// and offers the filter sheet instead.
//
// The route is named PropertyBrowse, not PropertyList. Two routes with one name
// in different stacks is legal but makes every navigate('PropertyList') call
// ambiguous to read, and MapViewportBar already owns that name.
const PropertiesStack = makeStack([
  {
    name: 'PropertyBrowse',
    component: PropertyListScreen,
    options: { headerShown: false },
    initialParams: { scoped: false },
  },
  NOTIFICATIONS_SCREEN,
  ...BOOKING_SCREENS,
])

const SavedStack = makeStack([
  { name: 'SavedHome', component: SavedScreen, options: { headerShown: false } },
  ...BOOKING_SCREENS,
])

const ChatStack = makeStack([
  { name: 'ChatHome', component: ConversationListScreen, options: { headerShown: false } },
  ...BOOKING_SCREENS,
])

// Renter-only — listing management moved out to host mode's My Listing tab.
const ProfileStack = makeStack([
  { name: 'ProfileHome', component: ProfileScreen, options: { headerShown: false } },
  { name: 'Appointments', component: AppointmentsScreen, options: { headerShown: false } },
  NOTIFICATIONS_SCREEN,
  { name: 'Leases', component: LeasesScreen, options: { headerShown: false } },
  { name: 'Settings', component: SettingsScreen, options: { headerShown: false } },
  ...SUPPORT_SCREENS,
  { name: 'Legal', component: LegalScreen, options: { headerShown: false } },
  { name: 'Rules', component: RulesScreen, options: { headerShown: false } },
])

// ── Host mode — new stacks ──────────────────────────────────────────────
const DashboardStack = makeStack([
  { name: 'DashboardHome', component: HostDashboardScreen, options: { headerShown: false } },
  { name: 'Calendar', component: CalendarScreen, options: { headerShown: false } },
  NOTIFICATIONS_SCREEN,
])

const HostAppointmentsStack = makeStack([
  { name: 'AppointmentsHome', component: AppointmentsScreen, options: { headerShown: false }, initialParams: { initialTab: 'incoming' } },
  // "Chat" on a visit request. Only the incoming (owner) card has that button,
  // and only this stack passes initialTab: 'incoming' — so the renter's copy of
  // AppointmentsScreen, over in ProfileStack, has no way to reach it.
  ...BOOKING_SCREENS,
])

const HostProfileStack = makeStack([
  { name: 'HostProfileHome', component: HostProfileScreen, options: { headerShown: false } },
  NOTIFICATIONS_SCREEN,
  { name: 'Settings', component: SettingsScreen, options: { headerShown: false } },
  ...SUPPORT_SCREENS,
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

// Properties sits next to Explore because they are the same inventory seen two
// ways — map and list — and web offers exactly that pair (Map / Properties).
// Five tabs matches host mode and is the bar's ceiling; adding a sixth means
// removing one.
const RENTER_TABS = [
  ['Explore', ExploreStack, 'explore'],
  ['Properties', PropertiesStack, 'list'],
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

  // Gated on the ROLE, not just the mode. `hostMode` is a UI preference a
  // TENANT can set — ProfileScreen's ModeSwitch checks no role — so this fired
  // an owner-only request that could only ever 403. Nothing broke visibly (the
  // badge just never appeared), which is why it outlived the same bug being
  // fixed on HostDashboardScreen. Pinned by
  // backend/tests/role-gated-queries.test.js.
  const isOwner = user?.role === 'OWNER'

  const { data: dashboard } = useQuery({
    queryKey: ['host-dashboard'],
    queryFn: () => hostService.dashboard().then((r) => r.data),
    enabled: hostMode && !!user && isOwner,
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

// The root screen of each tab's stack, by ROUTE name (both modes).
const TAB_HOME = {
  Explore: 'ExploreHome',
  Properties: 'PropertyBrowse',
  Saved: 'SavedHome',
  Chat: 'ChatHome',
  Profile: 'ProfileHome',
  Dashboard: 'DashboardHome',
  MyListing: 'MyListingsHome',
  Appointments: 'AppointmentsHome',
  Inbox: 'ChatHome',
  HostProfile: 'HostProfileHome',
}

// Two tab-press behaviours, applied to every tab:
//
// 1. Re-tapping the tab you are already ON pops its stack to the tab's home —
//    the platform convention (Instagram, YouTube, Maps all do this). Without
//    it, a Profile stack parked on Notifications made the Profile tab button a
//    no-op: tapping "Profile" while reading notifications did nothing at all,
//    and the only way back to the profile was the header chevron. Switching
//    AWAY and back still restores your spot — screens are PLACES and a tab
//    should remember them; only the second tap on the same tab resets.
//
// 2. Tapping "Listings" always dismisses a mid-flight add-listing wizard
//    (even from another tab). A wizard is a task, not a place — walking away
//    via the tab bar left "Listings" reopening a half-filled form instead of
//    your listings. Dismissing costs nothing: listings/.../draftStore.js
//    persists every change ("Safe to close — we keep your draft"), and
//    tapping Add resumes on the same step.
//
// `navigate(tab, { screen: home })` POPS to the home screen because it is
// already in the stack — it does not push a duplicate.
function tabListeners({ navigation, route }) {
  return {
    tabPress: () => {
      const stack = route.state
      if (!stack?.routes?.length) return
      const top = stack.routes[stack.index ?? stack.routes.length - 1]
      const home = TAB_HOME[route.name]
      if (route.name === 'MyListing' && top?.name === 'AddListing') {
        navigation.navigate('MyListing', { screen: home })
        return
      }
      if (navigation.isFocused() && top?.name !== home) {
        navigation.navigate(route.name, { screen: home })
      }
    },
  }
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
      // Hardware/gesture back walks back through the tabs you actually
      // visited. The default ('firstRoute') jumped straight to Explore — so
      // after a notification or "Message owner" carried you across tabs, back
      // landed somewhere you had never been instead of where you came from.
      backBehavior="history"
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
          listeners={tabListeners}
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
