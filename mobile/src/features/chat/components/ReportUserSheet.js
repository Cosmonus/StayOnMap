import { useState } from 'react'
import { View, Text, TextInput, Pressable, Alert, StyleSheet } from 'react-native'
import { userService } from '@services/user.service'
import FormSheet from '@components/common/FormSheet'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// Mirrors UserReportCategory in schema.prisma and USER_REPORT_CATEGORIES in
// users.validation.js — and web's ReportUserModal, which shows the same list in
// the same order. Deliberately NOT the property report categories: a person
// cannot have fake photos and a listing cannot harass anyone.
const CATEGORIES = [
  { value: 'HARASSMENT', label: 'Harassment or threats' },
  { value: 'SPAM', label: 'Spam or unwanted promotion' },
  { value: 'SCAM_OR_FRAUD', label: 'Scam or fraud' },
  { value: 'IMPERSONATION', label: 'Pretending to be someone else' },
  { value: 'HATE_OR_ABUSE', label: 'Hate speech or abuse' },
  { value: 'OTHER', label: 'Something else' },
]

const MIN_DESCRIPTION = 10

export default function ReportUserSheet({ visible, onClose, user, conversationId }) {
  const [category, setCategory] = useState(null)
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const close = () => { setCategory(null); setDescription(''); onClose() }

  const canSubmit = !!category && description.trim().length >= MIN_DESCRIPTION && !saving

  const submit = async () => {
    if (!canSubmit) return
    setSaving(true)
    try {
      await userService.reportUser(user.id, {
        category,
        description: description.trim(),
        conversationId,
      })
      // What happens next, not just "thanks" — a report that vanishes into a
      // confirmation teaches people not to file the next one.
      Alert.alert('Report sent', 'Our team will review it.')
      close()
    } catch (err) {
      Alert.alert('Could not send', err?.response?.data?.message ?? 'Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormSheet
      visible={visible}
      onClose={close}
      title={`Report ${user?.name ?? 'this person'}`}
      onSave={submit}
      saving={saving}
      saveLabel="Send report"
    >
      <Text style={styles.intro}>
        Tell us what happened. Reports go to our moderation team and are not
        shown to the person you are reporting.
      </Text>

      <Text style={styles.label}>What is the problem?</Text>
      <View style={styles.options}>
        {CATEGORIES.map((c) => {
          const selected = category === c.value
          return (
            <Pressable
              key={c.value}
              onPress={() => setCategory(c.value)}
              style={[styles.option, selected && styles.optionSelected]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={c.label}
            >
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{c.label}</Text>
              {selected && <Icon name="check" size={18} color={colors.brand700} />}
            </Pressable>
          )
        })}
      </View>

      <Text style={styles.label}>What happened?</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={4}
        maxLength={2000}
        placeholder="Include anything that would help us understand — what was said, and when."
        placeholderTextColor={colors.slate500}
        style={styles.textArea}
        textAlignVertical="top"
      />
      {/* Stated up front rather than as an error after they press send. The
          floor exists so a moderator isn't handed "asdf" to act on. */}
      <Text style={styles.hint}>
        At least {MIN_DESCRIPTION} characters. {description.trim().length}/2000
      </Text>

      {!!conversationId && (
        <Text style={styles.hint}>
          This conversation will be attached so our team can see the messages in
          question.
        </Text>
      )}
    </FormSheet>
  )
}

const styles = StyleSheet.create({
  intro: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.slate600,
    lineHeight: 21,
    marginBottom: spacing.lg,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.slate800,
    marginBottom: spacing.sm,
  },
  options: { marginBottom: spacing.lg },
  option: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    marginBottom: spacing.sm,
    backgroundColor: colors.white,
  },
  optionSelected: { borderColor: colors.brand600, backgroundColor: colors.brand50 },
  optionText: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.slate800, flex: 1 },
  optionTextSelected: { fontFamily: fonts.semibold, color: colors.brand700 },
  textArea: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    padding: spacing.md,
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.slate800,
    backgroundColor: colors.white,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.slate500,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
})
