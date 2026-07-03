import { View, Text, StyleSheet } from 'react-native'
import Icon from '@components/common/Icon'
import { fonts, fontSizes } from '@theme/typography'
import { radius, spacing } from '@theme/spacing'

const LEVEL_CONFIG = {
  MEDIUM:     { label: 'Under Review',        bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', icon: 'info', body: 'This property is currently being reviewed by our trust and safety team.' },
  HIGH:       { label: 'Under Investigation', bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', icon: 'alertTriangle', body: 'This listing has been flagged for suspicious activity. Proceed with caution.' },
  SUSPICIOUS: { label: 'Suspicious Listing',  bg: '#FEF2F2', border: '#FCA5A5', text: '#7F1D1D', icon: 'alertTriangle', body: 'This listing has been flagged for suspicious activity. Proceed with caution.' },
}

export default function RiskAlert({ riskScore }) {
  const cfg = riskScore?.level ? LEVEL_CONFIG[riskScore.level] : null
  if (!cfg) return null

  return (
    <View style={[styles.container, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <View style={[styles.iconWrap, { borderColor: cfg.border }]}>
        <Icon name={cfg.icon} size={13} color={cfg.text} />
      </View>
      <View style={styles.textWrap}>
        <Text style={[styles.title, { color: cfg.text }]}>{cfg.label}</Text>
        <Text style={[styles.body, { color: cfg.text }]}>{cfg.body}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radius.lg, borderWidth: 1, padding: spacing.md },
  iconWrap: { width: 24, height: 24, borderRadius: radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  textWrap: { flex: 1 },
  title: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm },
  body: { fontFamily: fonts.body, fontSize: fontSizes.xs, marginTop: 2, opacity: 0.85, lineHeight: 17 },
})
