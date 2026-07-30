import { useCallback, useState } from 'react'
import { View, Text, FlatList, Pressable, ActivityIndicator, Alert, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { propertyService } from '@services/property.service'
import { authService } from '@services/auth.service'
import { useAuth } from '@features/auth/hooks/useAuth'
import { syncAndReadDraft, discardDraftEverywhere } from '@features/listings/components/onboarding/draftSync'
import { CATEGORIES, suggestTitle } from '@features/listings/config/onboarding.js'
import { WIZARD_STEPS as STEPS, savedStep } from '@features/listings/config/wizardSteps.js'
import { formatPrice } from '@utils/format'
import Icon from '@components/common/Icon'
import ScreenHeader from '@components/common/ScreenHeader'
import ListingCard from '@components/common/ListingCard'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

const STATUS_COLORS = {
  DRAFT: { bg: colors.slate100, text: colors.slate600 },
  ACTIVE: { bg: colors.success50, text: '#15803D' },
  INACTIVE: { bg: colors.slate100, text: colors.slate500 },
  PENDING: { bg: colors.warning50, text: '#B45309' },
  OCCUPIED: { bg: '#EEF2FF', text: '#4338CA' },
  SUSPENDED: { bg: colors.danger50, text: '#DC2626' },
  REJECTED: { bg: colors.danger50, text: '#DC2626' },
}

function StatusPill({ status }) {
  const c = STATUS_COLORS[status] ?? STATUS_COLORS.DRAFT
  return (
    <View style={[styles.statusPill, { backgroundColor: c.bg }]}>
      <Text style={[styles.statusPillText, { color: c.text }]}>{status}</Text>
    </View>
  )
}

function BecomeOwnerPrompt() {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => authService.upgradeRole().then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  })

  return (
    <View style={styles.promptContainer}>
      <View style={styles.promptIcon}>
        <Icon name="home" size={24} color={colors.brand600} />
      </View>
      <Text style={styles.promptTitle}>List your property</Text>
      <Text style={styles.promptBody}>Become an owner to list rentals and manage appointments.</Text>
      <Pressable style={[styles.promptButton, mutation.isPending && styles.disabled]} onPress={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.promptButtonText}>Start listing</Text>}
      </Pressable>
    </View>
  )
}

// Mirrors web's VisibilityNotice (OnboardingWizard.jsx). One account-level
// privacy switch takes EVERY listing off the public map at once, while the row
// still reads ACTIVE and the admin panel still counts it — so the only place
// that disagrees is the map, and nothing said why.
const VISIBILITY_NOTICE = {
  HIDDEN: {
    title: 'Your listings are hidden from everyone',
    body: 'Listing visibility is set to Hidden, so even a live listing never appears on the map or in search results.',
  },
  LOGGED_IN: {
    title: 'Only signed-in people can see your listings',
    body: 'Listing visibility is set to Logged-in only, so your listings don’t appear for visitors who haven’t signed in.',
  },
}

function VisibilityNotice({ visibility, onOpenSettings }) {
  const notice = VISIBILITY_NOTICE[visibility]
  if (!notice) return null

  return (
    <Pressable
      style={styles.notice}
      onPress={onOpenSettings}
      accessibilityRole="button"
      accessibilityLabel={`${notice.title}. Open settings to change it.`}
    >
      <View style={styles.noticeText}>
        <Text style={styles.noticeTitle}>{notice.title}</Text>
        <Text style={styles.noticeBody}>{notice.body}</Text>
        <Text style={styles.noticeLink}>Change this in Settings</Text>
      </View>
      <Icon name="chevronRight" size={16} color="#B45309" />
    </Pressable>
  )
}

// The unfinished wizard draft, as a card on the listings page itself — the
// screen "Save & exit" lands on. It has no server record (the wizard only
// creates the property at publish), so without this the half-done listing was
// invisible exactly where the owner came looking for it; the dashboard's
// UnfinishedCard was the only surface that admitted it existed. Mirrors web's
// LocalDraftRow in ListingManager, wording shared with the dashboard card.
function DraftCard({ saved, onResume, onDiscard }) {
  const step = savedStep(saved)
  const label = saved.draft?.title?.trim()
    || suggestTitle(saved.categoryKey, { fields: saved.draft?.fields ?? {}, location: saved.draft?.location ?? {} })
    || CATEGORIES[saved.categoryKey]?.label
    || 'a listing'

  return (
    <View style={styles.draftCard}>
      <Text style={styles.draftTitle}>Unfinished listing</Text>
      <Text style={styles.draftBody}>
        {label} — you stopped at {step.label.toLowerCase()}. Nothing was lost.
      </Text>
      <Pressable style={styles.draftResume} onPress={onResume} accessibilityRole="button">
        <Text style={styles.draftResumeText}>Resume · step {step.n} of {STEPS.length}</Text>
      </Pressable>
      <Pressable style={styles.draftDiscard} onPress={onDiscard} accessibilityRole="button" accessibilityLabel="Delete draft">
        <Text style={styles.draftDiscardText}>Delete draft</Text>
      </Pressable>
    </View>
  )
}

export default function MyListingsScreen({ navigation }) {
  const { user } = useAuth()

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => authService.getMe().then((r) => r.data),
    enabled: !!user,
  })
  const isOwner = profile?.role === 'OWNER'

  // Re-read on focus, same as the dashboard: the owner leaves for the wizard
  // and comes back, and this screen must reflect what just happened there.
  // syncAndReadDraft rather than a bare read, so a listing started on the
  // owner's laptop turns up here too.
  const [savedDraft, setSavedDraft] = useState(null)
  useFocusEffect(
    useCallback(() => {
      let alive = true
      syncAndReadDraft().then((s) => { if (alive) setSavedDraft(s) })
      return () => { alive = false }
    }, []),
  )

  function discardDraft() {
    Alert.alert('Delete this draft?', 'Your unfinished listing will be gone for good, on this phone and your other devices.', [
      { text: 'Keep it', style: 'cancel' },
      // Everywhere, not just here: the owner asked for it to be gone, and
      // leaving the server's copy would have their laptop push it back.
      { text: 'Delete', style: 'destructive', onPress: () => { discardDraftEverywhere(); setSavedDraft(null) } },
    ])
  }

  const { data: listings = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['my-listings'],
    queryFn: () => propertyService.getMyListings().then((r) => r.data),
    enabled: isOwner,
  })

  // Owners cold-starting into this tab must not flash the become-owner
  // prompt while ['me'] is still in flight — wait for an answer first.
  if (profileLoading) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <View style={styles.center}><ActivityIndicator color={colors.brand600} /></View>
      </SafeAreaView>
    )
  }

  if (!isOwner) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <BecomeOwnerPrompt />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScreenHeader
        title="My listings"
        right={(
          <Pressable
            style={styles.addButton}
            onPress={() => navigation.navigate('AddListing')}
            accessibilityRole="button"
            accessibilityLabel="Add a listing"
          >
            <Icon name="plus" size={16} color={colors.white} />
            <Text style={styles.addButtonText}>Add</Text>
          </Pressable>
        )}
      />

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand600} /></View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Couldn&apos;t load your listings</Text>
          <Pressable style={styles.retryButton} onPress={() => refetch()} accessibilityRole="button" accessibilityLabel="Retry loading listings">
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <>
              <VisibilityNotice
                visibility={profile?.listingVisibility}
                // Settings lives in the host account tab, not this stack — the
                // same cross-tab hop the dashboard uses to reach Calendar.
                onOpenSettings={() => navigation.getParent()?.navigate('HostProfile', { screen: 'Settings', initial: false })}
              />
              {!!savedDraft && (
                <DraftCard
                  saved={savedDraft}
                  onResume={() => navigation.navigate('AddListing')}
                  onDiscard={discardDraft}
                />
              )}
            </>
          }
          // With a draft on screen, "No listings yet" directly above it would
          // be a lie — the draft card already carries the way forward.
          ListEmptyComponent={savedDraft ? null : (
            <Pressable style={styles.emptyState} onPress={() => navigation.navigate('AddListing')}>
              <View style={styles.emptyIcon}>
                <Icon name="plus" size={20} color={colors.brand600} />
              </View>
              <Text style={styles.emptyTitle}>No listings yet</Text>
              <Text style={styles.emptyBody}>Tap to add your first property</Text>
            </Pressable>
          )}
          renderItem={({ item }) => (
            <ListingCard
              photoUrl={item.images?.[0]?.url}
              overlay={<View style={styles.statusPillWrap}><StatusPill status={item.status} /></View>}
              price={formatPrice(item)}
              title={item.title}
              meta={`${item.city}${item.state ? `, ${item.state}` : ''}`}
              onPress={() => navigation.navigate('ManageListing', { propertyId: item.id })}
              accessibilityLabel={`Manage listing ${item.title}`}
            >
              {/* Verify and Offer lease used to sit here as two 25dp-tall
                  buttons squeezed into a half-width card — under half the 48dp
                  Android minimum, with 10px labels. Both are full rows one tap
                  away on ManageListing, which is also where Pause, Edit and
                  Delete live, so the card leads with the one thing it can do
                  well: open the listing. */}
              <Pressable
                style={styles.cardManage}
                onPress={() => navigation.navigate('ManageListing', { propertyId: item.id })}
                accessibilityRole="button"
                accessibilityLabel={`Manage ${item.title}`}
              >
                <Text style={styles.cardManageText}>Manage</Text>
                <Icon name="chevronRight" size={14} color={colors.slate600} />
              </Pressable>
            </ListingCard>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  errorTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate600 },
  retryButton: { backgroundColor: colors.brand600, borderRadius: radius.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, minHeight: 40, justifyContent: 'center' },
  retryText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.brand600, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 48, justifyContent: 'center', },
  addButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  list: { padding: spacing.lg, gap: spacing.md },
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.warning50, borderWidth: 1, borderColor: '#FDE68A', borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  // Same visual language as the dashboard's UnfinishedCard — one feature,
  // one look, wherever it surfaces.
  draftCard: { backgroundColor: colors.warning50, borderWidth: 1, borderColor: colors.warning100, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  draftTitle: { fontFamily: fonts.displayBold, fontSize: fontSizes.lg, color: colors.warning700 },
  draftBody: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.warning700, marginTop: 4, lineHeight: 20 },
  draftResume: { minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.warning700, borderRadius: radius.md, marginTop: spacing.md },
  draftResumeText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.white },
  draftDiscard: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs },
  draftDiscardText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.warning700 },
  noticeText: { flex: 1, minWidth: 0 },
  noticeTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: '#78350F' },
  noticeBody: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: '#92400E', marginTop: 2 },
  noticeLink: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: '#B45309', marginTop: spacing.xs },
  // The card itself is @components/common/ListingCard — the same one Saved
  // homes and the browse list use. Only the two things layered ONTO it live
  // here: the status pill over the photo, and the Manage row under the meta.
  statusPillWrap: { position: 'absolute', top: spacing.xs, left: spacing.xs },
  statusPill: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  statusPillText: { fontFamily: fonts.bodySemiBold, fontSize: 11 },
  cardManage: { flexDirection: 'row', gap: 4, marginTop: spacing.sm, minHeight: 44, borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  cardManageText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate600 },
  emptyState: { padding: spacing.xxl, borderWidth: 1, borderColor: colors.slate200, borderStyle: 'dashed', borderRadius: radius.lg, alignItems: 'center', width: '100%' },
  emptyIcon: { width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  emptyTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate600 },
  emptyBody: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, marginTop: 2 },
  promptContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  promptIcon: { width: 56, height: 56, borderRadius: radius.full, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  promptTitle: { fontFamily: fonts.displayBold, fontSize: fontSizes.lg, color: colors.slate800, marginBottom: spacing.xs },
  promptBody: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500, textAlign: 'center', marginBottom: spacing.lg, maxWidth: 260 },
  promptButton: { backgroundColor: colors.black, borderRadius: radius.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, minHeight: 48, justifyContent: 'center', },
  disabled: { opacity: 0.6 },
  promptButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
})
