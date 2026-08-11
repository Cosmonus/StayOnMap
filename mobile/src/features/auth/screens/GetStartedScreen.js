import { View, Text, StyleSheet, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Icon from '@components/common/Icon'
import { CITY_NAMES } from '@config/cities'
import { colors } from '@theme/colors'
import { useLayout, centered } from '@theme/breakpoints'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

const SCATTER_PINS = [
  { top: '18%', left: '14%', size: 22, opacity: 0.35 },
  { top: '30%', left: '72%', size: 18, opacity: 0.3 },
  { top: '54%', left: '22%', size: 16, opacity: 0.4 },
  { top: '62%', left: '68%', size: 24, opacity: 0.3 },
  { top: '10%', left: '58%', size: 14, opacity: 0.35 },
]

export default function GetStartedScreen({ navigation }) {
  // The brand field behind it stays full-bleed; the words and the button cap.
  // This is the first screen anybody sees, and a 1280dp-wide "Get started" pill
  // is the version of it that says nobody looked at a tablet.
  const { contentMaxWidth } = useLayout()
  return (
    <View style={styles.container}>
      <View style={styles.image}>
        {SCATTER_PINS.map((pin, i) => (
          <View key={i} style={[styles.scatterPin, { top: pin.top, left: pin.left, opacity: pin.opacity }]}>
            <Icon name="mapPin" size={pin.size} color={colors.white} />
          </View>
        ))}
        <View style={styles.heroBadge}>
          <Icon name="mapPin" size={40} color={colors.white} />
        </View>
      </View>
      <SafeAreaView edges={['bottom']} style={[styles.sheet, centered(contentMaxWidth)]}>
        <Text style={styles.title}>Find your home{'\n'}on the map.</Text>
        <Text style={styles.subtitle}>
          Discover verified rentals visually and connect with owners directly
          across {CITY_NAMES.length} major Indian cities.
        </Text>
        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          onPress={() => navigation.navigate('Login')}
          accessibilityRole="button"
        >
          <Text style={styles.ctaText}>Get started</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.brand600 },
  image: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scatterPin: { position: 'absolute' },
  heroBadge: {
    width: 96, height: 96, borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  sheet: {
    backgroundColor: colors.brand600,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.display,
    color: colors.white,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  cta: {
    backgroundColor: colors.white,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  ctaPressed: { opacity: 0.85 },
  ctaText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.base,
    color: colors.brand700,
  },
})
