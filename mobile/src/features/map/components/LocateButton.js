import { useState } from 'react'
import { Alert } from 'react-native'
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
      enableUserLocation()
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      // Read at call time, not at render: MapView registers this once the
      // native map mounts, which can be after this button has rendered.
      useMapStore.getState().flyTo?.({ latitude: coords.latitude, longitude: coords.longitude, zoom: LOCATE_ZOOM })
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
