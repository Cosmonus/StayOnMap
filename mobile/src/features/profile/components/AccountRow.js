import { Children, cloneElement, isValidElement } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'
import { shadows } from '@theme/shadows'

// The account screen's building blocks, shared by the renter's Account tab and
// the host's Profile tab. Mobile keeps those as two screens (the whole tab bar
// swaps with the mode), so without a shared set here the same screen drifts
// into two looks — which is exactly what had happened.
//
// These were each a standalone 64px card with its own border and an 18px label,
// stacked with gaps: six of them filled a phone screen to say six words. A
// grouped list says the same thing in half the height — the rows are related,
// so one card with hairlines between them is also more honest about that than
// six separate cards were.
//
// Distinct from MenuItem: that is a settings-page row with an icon puck. These
// carry no icons, because a label plus a count is the whole content.

// One card, hairlines between its rows. Pass AccountRows as children.
export function AccountGroup({ children }) {
  const rows = Children.toArray(children).filter(Boolean)
  return (
    <View style={styles.group}>
      {rows.map((child, i) =>
        isValidElement(child) ? cloneElement(child, { key: child.key ?? i, last: i === rows.length - 1 }) : child
      )}
    </View>
  )
}

export function AccountRow({ label, count, onPress, danger, last }) {
  return (
    <Pressable
      style={[styles.row, !last && styles.rowDivided]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={count ? `${label}, ${count}` : label}
    >
      <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]} numberOfLines={1}>
        {label}
        {/* Part of the sentence — "Visits · 1 confirmed" — not a badge, so it
            reads at a glance without decoding a colour. */}
        {count ? <Text style={styles.rowCount}> · {count}</Text> : null}
      </Text>
      {!danger && <Icon name="chevronRight" size={18} color={colors.slate500} />}
    </Pressable>
  )
}

// Which hat they are wearing, and the way to change it — one control, not two
// readings of the same fact.
//
// This was a card in the list that said "Renting" on the left and "Switch to
// hosting" on the right, so the screen named BOTH modes at once and you had to
// work out which one you were in. A segmented control shows the state as the
// selection, which is the one thing everybody already knows how to read.
//
// It belongs in ScreenHeader's `below` slot, not in the list: it switches what
// the whole app shows, so it is chrome. As the first row of a scrolling list it
// would scroll away exactly when someone wants it.
// `waiting` is the count of unread things in the OTHER hat — messages and
// notifications, both of which each mode now shows only its own of. Without a
// mark here, a visit request for your flat is invisible from renting and
// nothing on screen suggests switching. A dot, not a number: this says "there
// is something over there", and the count itself belongs on the tab you land on.
// `isOwner` gates the SWITCH itself. A two-segment control offers Hosting as a
// place you already have, and a TENANT tapping it lands on the become-a-host
// intro instead — a mode that does not exist for them yet. Web settled this on
// 2026-08-07: owners get the switch, everyone else gets a "Become a host" CTA,
// because that is onboarding rather than a mode change (.claude/architecture.md's
// "Navigation Modes"). Rendering nothing for a tenant would be worse — the way
// into hosting has to stay visible.
export function ModeSwitch({ hostMode, onChange, waiting = 0, isOwner = true, onBecomeHost }) {
  if (!isOwner && !hostMode) {
    return (
      <Pressable
        style={styles.becomeHost}
        onPress={() => (onBecomeHost ? onBecomeHost() : onChange(true))}
        accessibilityRole="button"
        accessibilityLabel="Become a host"
        accessibilityHint="Starts listing your first property"
      >
        <Icon name="key" size={16} color={colors.brand700} />
        <Text style={styles.becomeHostText}>Become a host</Text>
      </Pressable>
    )
  }
  return _ModeSwitch({ hostMode, onChange, waiting })
}

function _ModeSwitch({ hostMode, onChange, waiting = 0 }) {
  return (
    <View style={styles.segment}>
      {[false, true].map((isHost) => {
        const selected = hostMode === isHost
        const label = isHost ? 'Hosting' : 'Renting'
        const marked = !selected && waiting > 0
        return (
          <Pressable
            key={label}
            style={[styles.segmentItem, selected && styles.segmentItemActive]}
            onPress={() => { if (!selected) onChange(isHost) }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={marked ? `${label}, has unread` : label}
            accessibilityHint={selected ? undefined : `Switches the app to ${label.toLowerCase()}`}
          >
            {/* The hat, not just its name: a compass for the side browsing the
                map, a key for the side that holds them. */}
            <Icon name={isHost ? 'key' : 'explore'} size={16} color={selected ? colors.white : colors.brand600} />
            <Text style={[styles.segmentText, selected && styles.segmentTextActive]} numberOfLines={1}>
              {label}
            </Text>
            {marked && <View style={styles.segmentDot} />}
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  group: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md,
    // 52 keeps every row past the 48dp Android minimum while fitting the whole
    // menu on one screen — 64 did not.
    minHeight: 52, paddingHorizontal: spacing.md,
  },
  rowDivided: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.slate200 },
  rowLabel: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: fontSizes.base, color: colors.slate800 },
  rowLabelDanger: { color: colors.danger },
  rowCount: { fontFamily: fonts.body, color: colors.slate500 },
  // Brand jade, not neutral grey: which hat you are wearing changes the whole
  // app, so it should look like the app, and the mint track reads as the
  // control's own surface rather than another white card.
  //
  // The fill is brand-700, NOT brand-600. It is the only brand value that
  // carries white text at AA (6.28:1; brand-600 is 4.36:1) — see the Color
  // System note in .claude/ui-ux.md.
  //
  // 48 sits on the segment, not the track, so the TAPPABLE area clears
  // Android's 48dp minimum (mobile/AGENTS.md §6) rather than the track clearing
  // it while each half sits under.
  // A full pill, like every segmented control people already know how to
  // read. The mint track with a brand-100 hairline reads as the control's own
  // recessed surface; the selected half is a raised brand pill sitting IN it.
  becomeHost: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.brand600,
    backgroundColor: colors.white,
  },
  becomeHostText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.brand700,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.brand50,
    borderWidth: 1,
    borderColor: colors.brand100,
    borderRadius: radius.full,
    padding: spacing.xs,
  },
  segmentItem: {
    flex: 1, minHeight: 48, flexDirection: 'row', gap: spacing.sm,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.full,
  },
  segmentDot: { width: 7, height: 7, borderRadius: radius.full, backgroundColor: colors.danger },
  segmentItemActive: { backgroundColor: colors.brand700, ...shadows.xs },
  segmentText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.brand700 },
  segmentTextActive: { fontFamily: fonts.bodySemiBold, color: colors.white },
})
