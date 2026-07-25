import { useState } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { useMutation } from '@tanstack/react-query'
import { placeIntelligenceService } from '@services/placeIntelligence.service'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// Live Distance Matrix lookup from this property's coordinates to a
// tenant-typed destination — reuses the same Google key and probe pattern
// as areaIntelligence.service.js's computeTraffic, just with a real
// destination instead of a fixed short hop.
export default function CommuteCalculator({ lat, lng }) {
  const [destination, setDestination] = useState('')

  const mutation = useMutation({
    mutationFn: () => placeIntelligenceService.getCommute(lat, lng, destination).then((r) => r.data),
  })

  if (lat == null || lng == null) return null

  function handleSubmit() {
    if (!destination.trim() || mutation.isPending) return
    mutation.mutate()
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Commute calculator</Text>
      <Text style={styles.sectionHint}>See live travel time from here to work, college, or anywhere else</Text>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="e.g. Whitefield, Bengaluru"
          placeholderTextColor={colors.slate500}
          value={destination}
          onChangeText={setDestination}
          onSubmitEditing={handleSubmit}
          returnKeyType="search"
        />
        <Pressable
          style={[styles.button, (!destination.trim() || mutation.isPending) && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!destination.trim() || mutation.isPending}
          accessibilityRole="button"
          accessibilityLabel="Check commute time"
          accessibilityState={{ disabled: !destination.trim() || mutation.isPending, busy: mutation.isPending }}
        >
          {mutation.isPending ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.buttonText}>Check</Text>}
        </Pressable>
      </View>

      {mutation.isSuccess && (
        mutation.data ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultTo} numberOfLines={1}>To {mutation.data.destinationAddress}</Text>
            <View style={styles.resultRow}>
              <Text style={styles.resultDuration}>{mutation.data.durationInTrafficText ?? mutation.data.durationText}</Text>
              {!!mutation.data.distanceText && <Text style={styles.resultDistance}>{mutation.data.distanceText}</Text>}
            </View>
            {!!mutation.data.durationInTrafficText && mutation.data.durationInTrafficText !== mutation.data.durationText && (
              <Text style={styles.resultFreeFlow}>Free-flow: {mutation.data.durationText}</Text>
            )}
          </View>
        ) : (
          <View style={styles.resultCard}>
            <Text style={styles.resultEmpty}>Couldn&apos;t find that place — try a more specific address.</Text>
          </View>
        )
      )}

      {mutation.isError && (
        <View style={styles.resultCard}>
          <Text style={styles.resultError}>Something went wrong — try again.</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.lg },
  sectionTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate800 },
  sectionHint: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, marginTop: 2, marginBottom: spacing.sm },
  inputRow: { flexDirection: 'row', gap: spacing.sm },
  input: {
    flex: 1, borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
    fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate800,
  },
  button: {
    backgroundColor: colors.brand600, borderRadius: radius.md, paddingHorizontal: spacing.md,
    alignItems: 'center', justifyContent: 'center', minWidth: 72,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  resultCard: {
    marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.slate100, gap: 2,
  },
  resultTo: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate600 },
  resultRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  resultDuration: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.brand600 },
  resultDistance: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500 },
  resultFreeFlow: { fontFamily: fonts.body, fontSize: 11, color: colors.slate500 },
  resultEmpty: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500 },
  resultError: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.danger },
})
