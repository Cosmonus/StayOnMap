import { useState } from 'react'
import { View, Text, Pressable, ActivityIndicator, Alert, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { uploadService } from '@services/upload.service'
import Icon from '@components/common/Icon'
import { imgUrl } from '@utils/format'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// The photo step's board — mirrors web's PhotoBoard.jsx. The cover photo is
// rendered at the size of the decision it makes (it is what shows on the map);
// the rest sit in a three-up row beneath it.
//
// Replaced the old uniform 88px thumbnail grid, which said nothing about which
// photo mattered.
const MAX_IMAGES = 10
const RECOMMENDED = 5

// A photo you just picked is already on the phone, so re-downloading it to look
// at it is the grey tile people were seeing: `value` holds REMOTE urls (the
// draft has to survive this device), and a fresh upload has nothing cached, so
// the slate100 tile showed through until the round trip finished.
//
// Keyed by remote url, session-only, deliberately not persisted — a picker uri
// points at a cache file the OS may reclaim, so it is a display shortcut and
// never a source of truth. `onError` drops the entry and the tile falls back to
// the remote url, which by then is almost certainly cached anyway.
function LocalOrRemote({ url, local, size, onLocalFailed, style }) {
  return (
    <Image
      source={{ uri: local ?? imgUrl(url, size) }}
      style={style}
      contentFit="cover"
      cachePolicy="memory-disk"
      transition={200}
      onError={local ? onLocalFailed : undefined}
    />
  )
}

export default function PhotoBoard({ value = [], onChange }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [localByUrl, setLocalByUrl] = useState({})

  const forgetLocal = (url) => setLocalByUrl(({ [url]: _gone, ...rest }) => rest)

  async function handlePick() {
    setError('')
    const remaining = MAX_IMAGES - value.length
    if (remaining <= 0) return

    let result
    try {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.7,
      })
    } catch {
      setError('Could not open the photo picker. Please try again.')
      return
    }
    if (result.canceled || !result.assets?.length) return

    setUploading(true)
    try {
      const added = await Promise.all(result.assets.map(async (a) => ({
        url: (await uploadService.uploadPropertyImage(a)).data.url,
        local: a.uri,
      })))
      setLocalByUrl((prev) => ({ ...prev, ...Object.fromEntries(added.map((x) => [x.url, x.local])) }))
      onChange([...value, ...added.map((x) => x.url)])
    } catch {
      setError('Failed to upload one or more images. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  function makeCover(i) {
    const next = [...value]
    next.unshift(next.splice(i, 1)[0])
    onChange(next)
  }

  // Long-press is the reorder affordance: a phone can't hover, and dragging
  // between grid cells needs a drag library this app deliberately doesn't
  // carry. Choosing the cover is the reorder that actually matters.
  function openActions(i) {
    Alert.alert(`Photo ${i + 1}`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      ...(i === 0 ? [] : [{ text: 'Make this the cover', onPress: () => makeCover(i) }]),
      { text: 'Remove', style: 'destructive', onPress: () => onChange(value.filter((_, x) => x !== i)) },
    ])
  }

  const [cover, ...rest] = value

  return (
    <View style={{ gap: spacing.sm }}>
      {cover ? (
        <Pressable
          style={styles.coverTile}
          onPress={() => openActions(0)}
          accessibilityRole="button"
          accessibilityLabel="Cover photo — open photo actions"
        >
          {/* 'detail' — the cover fills the screen width, where the ~480px
              thumb variant reads as soft. The three-up row below is small
              enough that 'card' is the right ask. */}
          <LocalOrRemote
            url={cover}
            local={localByUrl[cover]}
            size="detail"
            onLocalFailed={() => forgetLocal(cover)}
            style={styles.image}
          />
          <View style={styles.coverBadge}><Text style={styles.coverBadgeText}>Cover</Text></View>
        </Pressable>
      ) : (
        <Pressable
          style={styles.coverEmpty}
          onPress={handlePick}
          disabled={uploading}
          accessibilityRole="button"
          accessibilityLabel="Add your cover photo"
          accessibilityState={{ disabled: uploading }}
        >
          {uploading
            ? <ActivityIndicator color={colors.brand600} />
            : <><Icon name="image" size={28} color={colors.slate500} /><Text style={styles.coverEmptyText}>Add your cover photo</Text></>}
        </Pressable>
      )}

      {rest.length > 0 && (
        <View style={styles.thumbRow}>
          {rest.map((url, i) => (
            <Pressable
              key={url}
              style={styles.thumbTile}
              onPress={() => openActions(i + 1)}
              accessibilityRole="button"
              accessibilityLabel={`Photo ${i + 2} — open photo actions`}
            >
              <LocalOrRemote
                url={url}
                local={localByUrl[url]}
                size="card"
                onLocalFailed={() => forgetLocal(url)}
                style={styles.image}
              />
            </Pressable>
          ))}
        </View>
      )}

      {value.length > 0 && value.length < MAX_IMAGES && (
        <Pressable
          style={styles.addButton}
          onPress={handlePick}
          disabled={uploading}
          accessibilityRole="button"
          accessibilityLabel="Add photos"
          accessibilityState={{ disabled: uploading }}
        >
          {uploading ? (
            <ActivityIndicator color={colors.brand600} size="small" />
          ) : (
            <>
              <Icon name="plus" size={16} color={colors.brand700} />
              <Text style={styles.addButtonText}>Add photos</Text>
            </>
          )}
        </Pressable>
      )}

      {!!error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.note}>
        <Icon name="check" size={16} color={colors.brand600} />
        <Text style={styles.noteText}>
          <Text style={styles.noteStrong}>{value.length} of {RECOMMENDED} recommended.</Text>{' '}
          Long-press a photo to make it the cover — that one shows on the map.
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  coverTile: { aspectRatio: 1.1, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.slate100 },
  coverEmpty: {
    aspectRatio: 1.1, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.slate200, borderStyle: 'dashed',
    backgroundColor: colors.slate50, alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
  },
  coverEmptyText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate600 },
  image: { width: '100%', height: '100%' },
  coverBadge: { position: 'absolute', top: spacing.sm, left: spacing.sm, backgroundColor: colors.brand600, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 4 },
  coverBadgeText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.white },
  thumbRow: { flexDirection: 'row', gap: spacing.sm },
  thumbTile: { flex: 1, aspectRatio: 1, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.slate100 },
  addButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    minHeight: 56, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.brand100,
    borderStyle: 'dashed', backgroundColor: colors.brand50,
  },
  addButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.brand700 },
  error: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.danger },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.slate50, borderRadius: radius.lg, padding: spacing.md },
  noteText: { flex: 1, fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate600, lineHeight: 18 },
  noteStrong: { fontFamily: fonts.bodySemiBold, color: colors.slate800 },
})
