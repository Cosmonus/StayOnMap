import { useState } from 'react'
import { Text, TextInput, Alert, StyleSheet } from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import FormSheet from '@components/common/FormSheet'
import Dropdown from '@components/common/Dropdown'
import { supportService } from '@services/support.service'
import { CATEGORY_LABEL, TENANT_CATEGORIES, OWNER_CATEGORIES } from '../supportCopy'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

/**
 * Open a support request. Mirrors web's NewCaseModal.
 *
 * Three fields and nothing else. Every ticketing system's instinct is to ask
 * for priority, severity and a dozen tags — each of them a question the person
 * cannot answer about a problem they do not yet understand. Priority is ours to
 * set, the category routes it, and the description is the actual content.
 */
const MAX = 4000

export default function NewCaseSheet({ visible, hat, onClose, onCreated, context = {} }) {
  const qc = useQueryClient()
  const categories = hat === 'OWNER' ? OWNER_CATEGORIES : TENANT_CATEGORIES

  const [type, setType] = useState('')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')

  const create = useMutation({
    mutationFn: () => supportService.createCase({
      type, subject: subject.trim(), description: description.trim(), hat, ...context,
    }).then((r) => r.data),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['support-cases'] })
      setType(''); setSubject(''); setDescription('')
      onCreated?.(created.id)
    },
    onError: (err) => Alert.alert('Could not send that', err?.message ?? 'Please try again.'),
  })

  // 20 characters, matching the server. Checked here too so somebody learns it
  // before they press send rather than after — but the server is the rule.
  const ready = type && subject.trim().length >= 3 && description.trim().length >= 20 && !create.isPending

  return (
    <FormSheet
      visible={visible}
      onClose={onClose}
      title="New support request"
      onSave={ready ? () => create.mutate() : undefined}
      saving={create.isPending}
      saveLabel="Send request"
    >
      <Text style={styles.label}>What is it about?</Text>
      <Dropdown
        value={type}
        onChange={setType}
        placeholder="Choose one"
        options={categories.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))}
      />

      <Text style={styles.label}>One line</Text>
      <TextInput
        value={subject}
        onChangeText={(t) => t.length <= 140 && setSubject(t)}
        placeholder="The owner is asking for money before a viewing"
        placeholderTextColor={colors.slate500}
        style={styles.input}
      />

      <Text style={styles.label}>What happened?</Text>
      <TextInput
        value={description}
        onChangeText={(t) => t.length <= MAX && setDescription(t)}
        multiline
        placeholder="As much as you can tell us — which listing, what was said, when."
        placeholderTextColor={colors.slate500}
        style={[styles.input, styles.multiline]}
      />
      {description.trim().length > 0 && description.trim().length < 20 && (
        // Shown only once they have started, not as a warning on an empty box —
        // a validation error before anybody has done anything is a telling-off.
        <Text style={styles.hint}>A little more detail helps us answer without asking first.</Text>
      )}

      <Text style={styles.privacy}>Only our team sees this.</Text>
    </FormSheet>
  )
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate500, marginTop: spacing.md, marginBottom: spacing.xs },
  input: {
    fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate800,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.slate200, borderRadius: radius.md,
    paddingHorizontal: spacing.sm, minHeight: 48, backgroundColor: colors.slate50,
  },
  multiline: { minHeight: 120, textAlignVertical: 'top', paddingTop: spacing.sm },
  hint: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, marginTop: spacing.xs },
  privacy: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, marginTop: spacing.md },
})
