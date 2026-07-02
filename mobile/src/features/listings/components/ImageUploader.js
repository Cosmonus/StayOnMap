import { useState } from 'react'
import { View, Text, Image, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { uploadService } from '@services/upload.service'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

const MAX_IMAGES = 10

export default function ImageUploader({ value, onChange }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handlePick() {
    setError('')
    const remaining = MAX_IMAGES - value.length
    if (remaining <= 0) return

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      setError('Photo library permission is required to add images.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.7,
    })
    if (result.canceled || !result.assets?.length) return

    setUploading(true)
    try {
      const urls = await Promise.all(result.assets.map((a) => uploadService.uploadPropertyImage(a).then((r) => r.data.url)))
      onChange([...value, ...urls])
    } catch {
      setError('Failed to upload one or more images. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  function removeAt(i) {
    onChange(value.filter((_, idx) => idx !== i))
  }

  return (
    <View>
      <View style={styles.grid}>
        {value.map((url, i) => (
          <View key={url} style={styles.thumbWrap}>
            <Image source={{ uri: url }} style={styles.thumb} />
            {i === 0 && (
              <View style={styles.coverBadge}><Text style={styles.coverBadgeText}>Cover</Text></View>
            )}
            <Pressable style={styles.removeButton} onPress={() => removeAt(i)}>
              <Text style={styles.removeButtonText}>×</Text>
            </Pressable>
          </View>
        ))}

        {value.length < MAX_IMAGES && (
          <Pressable style={styles.addButton} onPress={handlePick} disabled={uploading}>
            {uploading ? <ActivityIndicator color={colors.brand600} /> : <Text style={styles.addButtonText}>+ Add</Text>}
          </Pressable>
        )}
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Text style={styles.hint}>{value.length}/{MAX_IMAGES} photos · JPEG, PNG or WebP, up to 5MB each</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumbWrap: { width: 88, height: 88, borderRadius: radius.md, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  coverBadge: { position: 'absolute', bottom: 4, left: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  coverBadgeText: { fontFamily: fonts.bodySemiBold, fontSize: 9, color: colors.white },
  removeButton: { position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  removeButtonText: { color: colors.white, fontSize: 14, lineHeight: 16 },
  addButton: { width: 88, height: 88, borderRadius: radius.md, borderWidth: 1, borderColor: colors.slate200, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.slate50 },
  addButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.brand600 },
  error: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.danger, marginTop: spacing.sm },
  hint: { fontFamily: fonts.body, fontSize: 11, color: colors.slate400, marginTop: spacing.sm },
})
