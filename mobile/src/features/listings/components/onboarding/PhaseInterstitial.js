import { View, Text, StyleSheet } from 'react-native'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

export default function PhaseInterstitial({ n, title, blurb }) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Icon name="building" size={28} color={colors.brand600} />
      </View>
      <Text style={styles.step}>Step {n} of 3</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.blurb}>{blurb}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  iconWrap: { width: 64, height: 64, borderRadius: radius.full, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  step: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.brand600, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.sm },
  title: { fontFamily: fonts.displayBold, fontSize: fontSizes.xl, color: colors.slate800, textAlign: 'center', marginBottom: spacing.sm },
  blurb: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500, textAlign: 'center', lineHeight: 20 },
})
