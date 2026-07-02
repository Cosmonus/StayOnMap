import { View, Text, StyleSheet, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

export default function GetStartedScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <View style={styles.image} />
      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <Text style={styles.title}>Find your home{'\n'}on the map.</Text>
        <Text style={styles.subtitle}>
          Discover verified rentals visually and connect with owners directly
          across Bengaluru, Chennai & Hyderabad.
        </Text>
        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.ctaText}>Get started</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.brand600 },
  image: { flex: 1 },
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
