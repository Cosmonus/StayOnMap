import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { savedSearchService } from '@services/savedSearch.service'
import { useAuth } from '@features/auth/hooks/useAuth'
import { toQueryParams, TYPE_CATEGORIES } from '@config/filters'
import { formatCompact } from '@utils/format'
import FormSheet from '@components/common/FormSheet'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// "Tell me when a new home matches this." Mirrors web's SaveSearchButton:
// same wire shape (toQueryParams + bounds), same nearMetro exclusion with the
// omission SAID rather than silent (the backend rejects proximity params —
// savedSearch.validation.js says why), same newly-listed-only promise.
//
// Renders NOTHING for a guest — a saved search needs an account to belong to,
// and a button that only ever bounces someone to login is the "button that
// cannot do anything here" the SMS rule already names.

function suggestName(filters) {
  const parts = []
  const cats = TYPE_CATEGORIES.filter((c) => c.types.some((t) => filters.types?.includes(t)))
  parts.push(cats.length && cats.length < TYPE_CATEGORIES.length
    ? cats.map((c) => c.label).join(' / ')
    : 'Homes')
  if (filters.bhk?.length) parts.push(`${[...filters.bhk].sort().join('/')} BHK`)
  if (filters.rentMax) parts.push(`under ${formatCompact(filters.rentMax)}`)
  if (filters.city) parts.push(`in ${filters.city}`)
  return parts.join(' ').slice(0, 80)
}

export default function SaveSearchButton({ filters, bounds }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => {
      const { nearMetro: _nearMetro, ...query } = toQueryParams(filters)
      return savedSearchService.create({ name: name.trim(), query: { ...query, ...(bounds ?? {}) } })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-searches'] })
      setOpen(false)
    },
    onError: (e) => setError(e?.message ?? 'Couldn’t save this search — please try again.'),
  })

  if (!user) return null

  return (
    <>
      <Pressable
        style={styles.pill}
        onPress={() => { setName(suggestName(filters)); setError(''); setOpen(true) }}
        accessibilityRole="button"
        accessibilityLabel="Save this search and get notified about new matches"
      >
        <Icon name="bell" size={14} color={colors.brand700} />
        <Text style={styles.pillText}>Save this search</Text>
      </Pressable>

      <FormSheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Save this search"
        onSave={() => name.trim() && mutation.mutate()}
        saving={mutation.isPending}
        saveLabel="Save search"
      >
        <Text style={styles.blurb}>
          We&rsquo;ll notify you when a newly listed home matches — never for edits or
          relistings.
        </Text>
        <Text style={styles.label}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={80}
          style={styles.input}
          accessibilityLabel="Saved search name"
        />
        {!!filters.nearMetro && (
          <Text style={styles.note}>
            The distance-to-metro filter isn&rsquo;t part of saved-search alerts —
            everything else you&rsquo;ve set is.
          </Text>
        )}
        {!!error && <Text style={styles.error}>{error}</Text>}
        {/* Spacer so the note never sits flush on the FormSheet's save bar. */}
        <View style={{ height: spacing.md }} />
      </FormSheet>
    </>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    minHeight: 44, paddingHorizontal: spacing.md,
    borderWidth: 1, borderColor: colors.brand200, borderRadius: radius.full,
    backgroundColor: colors.brand50,
  },
  pillText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.brand700 },
  blurb: { fontFamily: fonts.body, fontSize: fontSizes.sm, lineHeight: 20, color: colors.slate600, marginBottom: spacing.md },
  label: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.slate700, marginBottom: spacing.xs },
  input: {
    minHeight: 48, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.slate200,
    borderRadius: radius.md, backgroundColor: colors.white,
    fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate800,
  },
  note: { fontFamily: fonts.body, fontSize: fontSizes.xs, lineHeight: 18, color: '#b45309', marginTop: spacing.sm },
  error: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.danger, marginTop: spacing.sm },
})
