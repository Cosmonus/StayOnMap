import { useState } from 'react'
import { Pressable, ActivityIndicator, Alert, StyleSheet } from 'react-native'
import * as Location from 'expo-location'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { shadows } from '@theme/shadows'
import { radius } from '@theme/spacing'

const LOCATE_ZOOM = 15

export default function LocateButton({ onLocate, onPermissionGranted }) {
  const [locating, setLocating] = useState(false)

  async function handlePress() {
    if (locating) return
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
