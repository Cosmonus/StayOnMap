import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
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

const Tab = createBottomTabNavigator()

// Each tab is its own native-stack so PropertyDetail/BookViewing can be
// pushed on top of Explore/Saved/etc. without leaving the tab.
function makeStack(screens) {
  const Stack = createNativeStackNavigator()
  return function StackScreen() {
    return (
      <Stack.Navigator>
        {screens.map(({ name, component, options }) => (
          <Stack.Screen key={name} name={name} component={component} options={options} />
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

const ProfileStack = makeStack([
  { name: 'ProfileHome', component: ProfileScreen, options: { title: 'Profile' } },
  { name: 'Appointments', component: AppointmentsScreen, options: { headerShown: false } },
  { name: 'Notifications', component: NotificationsScreen, options: { headerShown: false } },
  { name: 'MyListings', component: MyListingsScreen, options: { headerShown: false } },
  { name: 'AddListing', component: AddListingScreen, options: { headerShown: false, presentation: 'modal' } },
  { name: 'Verification', component: VerificationScreen, options: { headerShown: false } },
  { name: 'Leases', component: LeasesScreen, options: { headerShown: false } },
  { name: 'CreateLease', component: CreateLeaseScreen, options: { headerShown: false, presentation: 'modal' } },
  { name: 'Settings', component: SettingsScreen, options: { headerShown: false } },
  ...BOOKING_SCREENS,
])

const TABS = [
  ['Explore', ExploreStack, 'explore'],
  ['Saved', SavedStack, 'saved'],
  ['Chat', ChatStack, 'chat'],
  ['Profile', ProfileStack, 'profile'],
]

export default function AppTabs() {
  return (
    <Tab.Navigator
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
