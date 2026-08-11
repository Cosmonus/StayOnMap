import { useState } from 'react'
import {
  View, Text, Pressable, ScrollView, ActivityIndicator,
  Alert, StyleSheet,
} from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as ImagePicker from 'expo-image-picker'
import { userService } from '@services/user.service'
import { authService } from '@services/auth.service'
import MenuItem from '@features/profile/components/MenuItem'
import SettingsToggle from '@features/profile/components/SettingsToggle'
import EditProfileSheet from '@features/profile/components/EditProfileSheet'
import SocialLinksSheet from '@features/profile/components/SocialLinksSheet'
import PrivacySheet from '@features/profile/components/PrivacySheet'
import DeleteAccountSheet from '@features/profile/components/DeleteAccountSheet'
import LinkedAccountsSheet from '@features/profile/components/LinkedAccountsSheet'
import DevicesSheet from '@features/profile/components/DevicesSheet'
import BlockedUsersSheet from '@features/profile/components/BlockedUsersSheet'
import VerifyPhoneSheet from '@features/profile/components/VerifyPhoneSheet'
import PointsCard from '@features/points/components/PointsCard'
import Icon from '@components/common/Icon'
import ScreenHeader from '@components/common/ScreenHeader'
import { colors } from '@theme/colors'
import { useLayout, centered } from '@theme/breakpoints'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

export default function SettingsScreen({ navigation }) {
  // A form stretched across a tablet puts each label at one edge and its
  // control at the other.
  const { contentMaxWidth } = useLayout()
  const qc = useQueryClient()
  const [activeSheet, setActiveSheet] = useState(null) // 'profile' | 'social' | 'privacy' | 'delete' | 'linked' | 'devices' | 'blocked' | 'phone'
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const { data: settings, isLoading, isError, refetch } = useQuery({
    queryKey: ['user-settings'],
    queryFn: () => userService.getSettings().then((r) => r.data),
  })

  const { mutate: saveToggle, isPending: togglePending } = useMutation({
    mutationFn: (data) => userService.updateProfile(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-settings'] }),
    onError: () => Alert.alert('Error', 'Could not update the setting. Please try again.'),
  })

  const { mutate: sendPasswordReset, isPending: sendingReset } = useMutation({
    mutationFn: () => userService.changePassword(),
    onSuccess: () => Alert.alert('Email sent', 'Check your inbox for the password reset link.'),
    onError: () => Alert.alert('Error', 'Could not send the reset email. Please try again.'),
  })

  const { mutate: resendVerification, isPending: sendingVerification } = useMutation({
    mutationFn: () => authService.sendEmailVerification(),
    onSuccess: () => Alert.alert('Email sent', 'Check your inbox for the verification link.'),
    onError: () => Alert.alert('Error', 'Could not send the verification email. Please try again.'),
  })

  const { mutate: upgradeRole, isPending: upgrading } = useMutation({
    mutationFn: () => authService.upgradeRole(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] })
      qc.invalidateQueries({ queryKey: ['user-settings'] })
      Alert.alert('Upgraded', 'You are now an owner and can list properties.')
    },
    onError: () => Alert.alert('Error', 'Could not upgrade your account. Please try again.'),
  })

  async function handleAvatar() {
    // Android photo picker / iOS limited picker — no permission request needed.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    })
    if (result.canceled || !result.assets?.length) return
    setUploadingAvatar(true)
    try {
      await userService.uploadAvatar(result.assets[0])
      qc.invalidateQueries({ queryKey: ['user-settings'] })
      qc.invalidateQueries({ queryKey: ['me'] })
    } catch {
      Alert.alert('Upload failed', 'Could not update your photo. Please try again.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  function confirmUpgrade() {
    Alert.alert(
      'Become an owner?',
      'Owner accounts can list and manage rental properties. This cannot be reversed.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Upgrade', onPress: () => upgradeRole() },
      ],
    )
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center} edges={[]}>
        <ActivityIndicator color={colors.brand600} />
      </SafeAreaView>
    )
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.center} edges={[]}>
        <Icon name="alertTriangle" size={28} color={colors.slate500} />
        <Text style={styles.errorText}>Could not load your settings.</Text>
        <Pressable
          style={styles.retryButton}
          onPress={() => refetch()}
          accessibilityRole="button"
          accessibilityLabel="Retry loading settings"
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  const isOwner = settings?.role === 'OWNER'

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScreenHeader title="Settings" onBack={() => navigation.goBack()} />

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, centered(contentMaxWidth)]}>
        {/* Profile card */}
        <View style={styles.profileCard}>
          <Pressable
            onPress={handleAvatar}
            disabled={uploadingAvatar}
            style={styles.avatarWrap}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            accessibilityState={{ disabled: uploadingAvatar }}
          >
            {settings?.avatarUrl ? (
              <Image source={{ uri: settings.avatarUrl }} style={styles.avatar} contentFit="cover" cachePolicy="memory-disk" transition={200} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>{(settings?.name || '?')[0].toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.avatarBadge}>
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Icon name="camera" size={13} color={colors.white} />
              )}
            </View>
          </Pressable>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName} numberOfLines={1}>{settings?.name || 'StayOnMap user'}</Text>
            <Text style={styles.profileEmail} numberOfLines={1}>{settings?.email}</Text>
            <View style={styles.roleBadge}>
              <Icon name={isOwner ? 'home' : 'key'} size={11} color={colors.brand700} />
              <Text style={styles.roleBadgeText}>{isOwner ? 'Owner' : 'Tenant'}</Text>
            </View>
          </View>
        </View>

        <PointsCard />

        <Text style={styles.sectionLabel}>Profile</Text>
        <MenuItem icon="edit" label="Edit profile" hint="Name, phone, and bio" onPress={() => setActiveSheet('profile')} />
        <MenuItem icon="link" label="Social links" hint="Website, LinkedIn, Instagram, X" onPress={() => setActiveSheet('social')} />
        <MenuItem
          icon="eye"
          label="Privacy & visibility"
          hint={isOwner ? 'Listing, contact, and location visibility' : 'Contact and location visibility'}
          onPress={() => setActiveSheet('privacy')}
        />

        <Text style={styles.sectionLabel}>Notifications</Text>
        <SettingsToggle
          icon="mail"
          label="Email notifications"
          hint="Appointments, leases, alerts"
          value={settings?.emailNotifs ?? true}
          onChange={(v) => saveToggle({ emailNotifs: v })}
          disabled={togglePending}
        />
        <SettingsToggle
          icon="bell"
          label="Push notifications"
          hint="Appointment updates and new messages"
          value={settings?.pushNotifs ?? true}
          onChange={(v) => saveToggle({ pushNotifs: v })}
          disabled={togglePending}
        />

        <Text style={styles.sectionLabel}>Account</Text>
        {settings?.isVerified ? (
          <View style={styles.verifiedRow}>
            <View style={styles.verifiedIcon}>
              <Icon name="shieldCheck" size={16} color={colors.brand600} />
            </View>
            <View style={styles.verifiedLabels}>
              <Text style={styles.verifiedLabel}>Email verification</Text>
              <Text style={styles.verifiedHint}>Your email address is confirmed</Text>
            </View>
            <View style={styles.verifiedPill}>
              <Text style={styles.verifiedPillText}>Verified</Text>
            </View>
          </View>
        ) : (
          <MenuItem
            icon="shield"
            label={sendingVerification ? 'Sending...' : 'Verify email'}
            hint="Confirm your email to mark your account as trusted"
            onPress={() => !sendingVerification && resendVerification()}
          />
        )}
        {/* Phone verification. The whole row is hidden where the deployment
            has no SMS provider — a row that can only fail is worse than none,
            the same rule the social sign-in buttons follow. */}
        {settings?.phoneVerificationAvailable && (
          settings?.phoneVerifiedAt ? (
            <View style={styles.verifiedRow}>
              <View style={styles.verifiedIcon}>
                <Icon name="shieldCheck" size={16} color={colors.brand600} />
              </View>
              <View style={styles.verifiedLabels}>
                <Text style={styles.verifiedLabel}>Phone verification</Text>
                <Text style={styles.verifiedHint}>{settings.phone} is confirmed</Text>
              </View>
              <View style={styles.verifiedPill}>
                <Text style={styles.verifiedPillText}>Verified</Text>
              </View>
            </View>
          ) : (
            <MenuItem
              icon="phone"
              label="Verify phone"
              hint="Confirm your number with a code — one number, one account"
              onPress={() => setActiveSheet('phone')}
            />
          )
        )}
        <MenuItem
          icon="lock"
          label={sendingReset ? 'Sending...' : 'Reset password'}
          hint="We will email you a reset link"
          onPress={() => !sendingReset && sendPasswordReset()}
        />
        <MenuItem
          icon="link"
          label="Linked accounts"
          hint="Google, Facebook, LinkedIn, X sign-in"
          onPress={() => setActiveSheet('linked')}
        />
        <MenuItem
          icon="phone"
          label="Devices"
          hint="See where you're signed in"
          onPress={() => setActiveSheet('devices')}
        />
        <MenuItem
          icon="ban"
          label="Blocked people"
          hint="Manage who can't message you"
          onPress={() => setActiveSheet('blocked')}
        />
        {!isOwner && (
          <MenuItem
            icon="home"
            label={upgrading ? 'Upgrading...' : 'Become an owner'}
            hint="Start listing and managing rentals"
            onPress={() => !upgrading && confirmUpgrade()}
          />
        )}

        <Text style={styles.sectionLabel}>Legal</Text>
        {/* Real screens, not stayonmap.com in a browser. Leaving the app to
            read the policy meant most people never did, and with no signal it
            was unavailable outright. */}
        <MenuItem icon="document" label="Privacy Policy" onPress={() => navigation.navigate('Legal', { doc: 'privacy' })} />
        <MenuItem icon="document" label="Terms of Service" onPress={() => navigation.navigate('Legal', { doc: 'terms' })} />
        {/* The Terms incorporate these by reference (§8) and cite them for the
            permanent broker ban (§14) — naming them with nowhere to go was a
            legal document pointing at a page that did not exist on mobile. */}
        <MenuItem icon="shieldCheck" label="Community Rules" onPress={() => navigation.navigate('Rules')} />

        <Text style={styles.sectionLabel}>Danger zone</Text>
        <MenuItem
          icon="trash"
          label="Delete account"
          hint="Removes all data permanently"
          danger
          onPress={() => setActiveSheet('delete')}
        />
      </ScrollView>

      <EditProfileSheet visible={activeSheet === 'profile'} onClose={() => setActiveSheet(null)} settings={settings} />
      <SocialLinksSheet visible={activeSheet === 'social'} onClose={() => setActiveSheet(null)} settings={settings} />
      <PrivacySheet visible={activeSheet === 'privacy'} onClose={() => setActiveSheet(null)} settings={settings} />
      <DeleteAccountSheet visible={activeSheet === 'delete'} onClose={() => setActiveSheet(null)} />
      <LinkedAccountsSheet visible={activeSheet === 'linked'} onClose={() => setActiveSheet(null)} />
      <DevicesSheet visible={activeSheet === 'devices'} onClose={() => setActiveSheet(null)} />
      <BlockedUsersSheet visible={activeSheet === 'blocked'} onClose={() => setActiveSheet(null)} />
      <VerifyPhoneSheet
        visible={activeSheet === 'phone'}
        onClose={() => setActiveSheet(null)}
        currentPhone={settings?.phone}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.white, gap: spacing.sm, padding: spacing.lg,
  },
  errorText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.base, color: colors.slate600 },
  retryButton: {
    minHeight: 48, minWidth: 120, borderRadius: radius.md, backgroundColor: colors.brand600,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg, marginTop: spacing.sm,
  },
  retryText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.white },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md,
  },
  avatarWrap: { width: 64, height: 64 },
  avatar: { width: 64, height: 64, borderRadius: radius.full, backgroundColor: colors.slate100 },
  avatarFallback: {
    width: 64, height: 64, borderRadius: radius.full, backgroundColor: colors.brand100,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontFamily: fonts.displayBold, fontSize: fontSizes.xl, color: colors.brand700 },
  avatarBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 26, height: 26, borderRadius: 13, backgroundColor: colors.slate800,
    borderWidth: 2, borderColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  profileInfo: { flex: 1 },
  profileName: { fontFamily: fonts.displayBold, fontSize: fontSizes.lg, color: colors.slate800 },
  profileEmail: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500, marginTop: 2 },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    marginTop: spacing.xs, backgroundColor: colors.brand50, borderRadius: radius.full,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  roleBadgeText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.brand700 },
  sectionLabel: {
    fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.slate500,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: spacing.lg, marginBottom: spacing.xs,
  },
  verifiedRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48,
    paddingVertical: spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: colors.slate100,
  },
  verifiedIcon: { width: 34, height: 34, borderRadius: radius.full, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center' },
  verifiedLabels: { flex: 1 },
  verifiedLabel: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.base, color: colors.slate800 },
  verifiedHint: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, marginTop: 2 },
  verifiedPill: { backgroundColor: colors.brand50, borderRadius: radius.full, paddingHorizontal: spacing.sm + 2, paddingVertical: 4 },
  verifiedPillText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.brand700 },
})
