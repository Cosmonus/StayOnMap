import { View, Text, StyleSheet } from 'react-native'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

export default function ZeroBrokerageBanner({ brokerage }) {
  if (brokerage && Number(brokerage) > 0) return null
  return (
    <View style={styles.banner}>
      <Icon name="checkCircle" size={18} color={colors.brand600} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Zero Brokerage</Text>
        <Text style={styles.subtitle}>Connect directly with the owner — no middlemen fees</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md,
    backgroundColor: colors.brand50, borderWidth: 1, borderColor: colors.brand200,
    borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
  },
  title: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.brand700 },
  subtitle: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.brand600, marginTop: 1 },
})
