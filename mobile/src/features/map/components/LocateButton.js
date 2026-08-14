import { useState } from 'react'
import { Alert, Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Location from 'expo-location'
import MapPill from './MapPill'
import { useMapStore } from '@store/mapStore'

const LOCATE_ZOOM = 15

// Only ever set to 'granted' — a "Not now" is not persisted, so a declined
// user sees our explainer dialog again on the next tap. (The OS remembers
// its own prompt separately.)
const LOCATION_CONSENT_KEY = 'sn_location_consent'

export default function LocateButton() {
  const [locating, setLocating] = useState(false)
  const enableUserLocation = useMapStore((s) => s.enableUserLocation)

  // Read at call time, not at render: MapView registers flyTo once the
  // native map mounts, which can be after this button has rendered.
  function flyToCoords(coords) {
    useMapStore.getState().flyTo?.({ latitude: coords.latitude, longitude: coords.longitude, zoom: LOCATE_ZOOM })
  }

  async function locate() {
    setLocating(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert(
          'Location unavailable',
          'Allow location access in your device settings to see your position on the map.'
        )
        return
      }

      // App permission granted is NOT the same as the device's location
      // toggle being on — with services off, a position request fails or
      // hangs with no error surfaced. On Android,
      // enableNetworkProviderAsync shows the system "turn on location?"
      // dialog, so the fix is one tap instead of a trip to Settings.
      if (!(await Location.hasServicesEnabledAsync().catch(() => true))) {
        if (Platform.OS === 'android') {
          try {
            await Location.enableNetworkProviderAsync()
          } catch {
            Alert.alert('Location is off', 'Turn on your device location to see homes near you.')
            return
          }
        } else {
          Alert.alert('Location is off', 'Turn on your device location to see homes near you.')
          return
        }
      }

      enableUserLocation()

      // Fly to the last known fix FIRST — it answers instantly from the OS
      // cache. A fresh fix on a cold GPS indoors can take tens of seconds,
      // and waiting on it alone made this button look like it did nothing
      // (user-reported 2026-08-14): the pill spun and the map never moved.
      const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 }).catch(() => null)
      if (last) flyToCoords(last.coords)

      // Then refine with a real fix, bounded — getCurrentPositionAsync has no
      // timeout option and can hang far past anyone's patience. If it wins
      // the race, the map settles onto the exact spot; if the cached fix
      // already moved the map, a timeout costs nothing visible.
      const current = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise((resolve) => setTimeout(() => resolve(null), 8000)),
      ]).catch(() => null)

      if (current) {
        flyToCoords(current.coords)
      } else if (!last) {
        Alert.alert('Location unavailable', "We couldn't get your current position. Please try again.")
      }
    } catch {
      Alert.alert('Location unavailable', "We couldn't get your current position. Please try again.")
    } finally {
      setLocating(false)
    }
  }

  // The OS permission prompt only ever fires AFTER the user accepts our
  // explainer — never on the first cold tap.
  async function handlePress() {
    if (locating) return
    const consent = await AsyncStorage.getItem(LOCATION_CONSENT_KEY).catch(() => null)
    if (consent === 'granted') {
      locate()
      return
    }
    Alert.alert(
      'Turn on location?',
      'We use your location to show homes near you. Your location is never stored.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Allow',
          onPress: async () => {
            await AsyncStorage.setItem(LOCATION_CONSENT_KEY, 'granted').catch(() => {})
            locate()
          },
        },
      ]
    )
  }

  return (
    // The same MapPill as Metro/IT Zones/Traffic — it sits in that row, and a
    // pill that renders itself is a pill that drifts. `busy` swaps the icon for
    // a spinner without changing the height.
    <MapPill
      icon="locate"
      label={locating ? 'Locating…' : 'Near me'}
      busy={locating}
      onPress={handlePress}
      accessibilityLabel="Go to my location"
      accessibilityState={{ busy: locating }}
    />
  )
}
