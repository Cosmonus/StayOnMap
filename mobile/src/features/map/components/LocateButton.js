import { useState } from 'react'
import { Pressable, ActivityIndicator, Alert, StyleSheet } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Location from 'expo-location'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { shadows } from '@theme/shadows'
import { radius } from '@theme/spacing'

const LOCATE_ZOOM = 15

// Only ever set to 'granted' — a "Not now" is not persisted, so a declined
// user sees our explainer dialog again on the next tap. (The OS remembers
// its own prompt separately.)
const LOCATION_CONSENT_KEY = 'sn_location_consent'

export default function LocateButton({ onLocate, onPermissionGranted }) {
  const [locating, setLocating] = useState(false)

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
      onPermissionGranted?.()
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      onLocate(coords.latitude, coords.longitude, LOCATE_ZOOM)
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
    <Pressable
      style={styles.button}
      onPress={handlePress}
      accessibilityLabel="Go to my location"
      accessibilityRole="button"
      accessibilityState={{ busy: locating }}
    >
      {locating ? (
        <ActivityIndicator size="small" color={colors.brand600} />
      ) : (
        <Icon name="locate" size={18} color={colors.slate700} />
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    width: 44, height: 44, borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.slate200,
    alignItems: 'center', justifyContent: 'center',
    ...shadows.float,
  },
})
