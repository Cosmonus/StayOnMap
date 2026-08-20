import { useEffect, useRef, useState } from 'react'
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
// the remote url. The local file is the one that was UPLOADED (1920px), not the
// raw camera original: decoding a 12MP frame into a screen-wide cover took
// longer than the watchdog below, so the cover — and only the cover — was
// dropped to the network every time (2026-08-20).
//
// A tile says what it is doing: it spins while loading and shows a
// broken-image glyph when the remote fetch fails; tapping the tile (the
// existing action sheet) is how you remove and re-add it.
//
// Two rules, both learned from a cover photo that uploaded fine and showed as
// a grey square (2026-08-20):
// - The loading overlay is TRANSPARENT. The tile beneath is already slate100,
//   so while the bytes are genuinely in flight it looks the same — but if the
//   spinner ever outlives the load it sits over the photo instead of hiding
//   it. Only `failed` may paint over the image, because then there is none.
// - No `onLoadStart` reset. On Android expo-image can deliver onLoadStart
//   AFTER onLoad for a local or cached image, and a reset there pinned the
//   state on 'loading' forever. `onDisplay` is accepted as ready as well — it
//   is the event that fires when pixels are on screen.
//
// The local preview keeps a watchdog, because on a real device it sometimes
// fired NEITHER onLoad nor onError: a local file that hasn't painted in 1.5s
// is dropped for the remote url, which is already uploaded.
//
// The REMOTE side has no watchdog, and must not get one back. It used to
// remount the <Image> every few seconds "so a tile may be slow, never stuck" —
// and a remount CANCELS the in-flight download (nothing resumes a partial
// fetch), so the cover's 1.3MB `_full.webp` on mobile data was killed at 4s,
// restarted from zero, killed again, forever. The thumbs finished inside the
// window, which is why only the first photo stayed grey (2026-08-20). Instead:
// every remote tile's SOURCE is the ~40KB `_thumb`, which always lands, and the
// cover upgrades to `_full` only once `Image.prefetch` has put it in the disk
// cache — a slow cover looks soft for a moment rather than blank for good.
//
// THE ACTUAL BUG, found with logging on the emulator (2026-08-20): none of the
// above. The cover tile's image reported `onLoad` with a real 1200x1600 source,
// the spinner cleared, and the tile was STILL grey — and so was the "Cover"
// badge beside it, which is not an image at all. `overflow: 'hidden'` on the
// Pressable (there for the rounded corners) was clipping every child away on
// Android, while the tile's own background painted fine. Removing that one
// style painted the photo instantly. So neither tile clips: the corner radius
// goes on the <Image> itself, which expo-image rounds natively, and on the
// failed overlay. A tile that is grey AFTER onLoad is a painting problem, not a
// loading one — look at what else in the tile is missing.
const LOCAL_PAINT_MS = 1500

function LocalOrRemote({ url, local, size, onLocalFailed, style, radius: r }) {
  const [state, setState] = useState('loading')
  const [fullReady, setFullReady] = useState(false)
  const thumbUrl = imgUrl(url, 'card')
  const fullUrl = imgUrl(url, 'detail')
  const wantFull = size === 'detail' && fullUrl !== thumbUrl
  const uri = local ?? (wantFull && fullReady ? fullUrl : thumbUrl)
  const ready = () => setState('ready')
  // Ref, not dep: the parent passes an inline arrow, and a new identity every
  // render would restart the watchdog before it could ever fire.
  const onLocalFailedRef = useRef(onLocalFailed)
  useEffect(() => { onLocalFailedRef.current = onLocalFailed })

  useEffect(() => {
    if (state !== 'loading' || !local) return undefined
    const t = setTimeout(() => onLocalFailedRef.current(), LOCAL_PAINT_MS)
    return () => clearTimeout(t)
  }, [state, local])

  useEffect(() => {
    if (!wantFull || fullReady) return undefined
    let cancelled = false
    Image.prefetch(fullUrl, 'memory-disk')
      .then((ok) => { if (!cancelled && ok) setFullReady(true) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [wantFull, fullReady, fullUrl])

  return (
    <View style={style}>
      <Image
        source={{ uri }}
        // The thumb is already on screen when the full variant swaps in, so
        // the upgrade cross-fades instead of flashing grey.
        placeholder={uri === fullUrl ? { uri: thumbUrl } : undefined}
        placeholderContentFit="cover"
        style={[styles.image, { borderRadius: r }]}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={200}
        onLoad={ready}
        onDisplay={ready}
        onError={() => {
          if (local) { onLocalFailed(); return }
          setState('failed')
        }}
      />
      {state === 'loading' && (
        <View style={styles.tileSpinner} pointerEvents="none">
          <ActivityIndicator color={colors.brand600} size="small" />
        </View>
      )}
      {state === 'failed' && (
        <View style={[styles.tileOverlay, { borderRadius: r }]} pointerEvents="none">
          <Icon name="image-off" size={20} color={colors.slate500} />
          <Text style={styles.tileFailedText}>Couldn&apos;t load</Text>
        </View>
      )}
    </View>
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
    // allSettled, not all: five photos picked and one timing out on mobile
    // data used to discard the four that had already landed on storage and
    // show nothing — which read as "the preview doesn't load". Keep what
    // worked, and name what didn't with the server's own reason.
    const settled = await Promise.allSettled(result.assets.map(async (a) => {
      const res = await uploadService.uploadPropertyImage(a)
      return { url: res.data.url, local: res.localUri }
    }))
    const added = settled.filter((s) => s.status === 'fulfilled').map((s) => s.value)
    const failed = settled.filter((s) => s.status === 'rejected')
    if (added.length) {
      setLocalByUrl((prev) => ({ ...prev, ...Object.fromEntries(added.map((x) => [x.url, x.local])) }))
      onChange([...value, ...added.map((x) => x.url)])
    }
    if (failed.length) {
      const reason = failed[0].reason?.message
      const timedOut = failed[0].reason?.code === 'ECONNABORTED'
      setError(`${failed.length} of ${result.assets.length} photo${result.assets.length === 1 ? '' : 's'} didn't upload — ${
        timedOut ? 'the connection was too slow' : reason ?? 'please try again'}.`)
    }
    setUploading(false)
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
            radius={radius.lg}
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
                radius={radius.md}
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
  coverTile: { aspectRatio: 1.1, borderRadius: radius.lg, backgroundColor: colors.slate100 },
  coverEmpty: {
    aspectRatio: 1.1, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.slate200, borderStyle: 'dashed',
    backgroundColor: colors.slate50, alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
  },
  coverEmptyText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate600 },
  image: { width: '100%', height: '100%' },
  tileSpinner: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  tileOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.slate100 },
  tileFailedText: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate600 },
  coverBadge: { position: 'absolute', top: spacing.sm, left: spacing.sm, backgroundColor: colors.brand600, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 4 },
  coverBadgeText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.white },
  thumbRow: { flexDirection: 'row', gap: spacing.sm },
  thumbTile: { flex: 1, aspectRatio: 1, borderRadius: radius.md, backgroundColor: colors.slate100 },
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
