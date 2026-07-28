import {
  Modal, View, Text, Pressable, ScrollView, KeyboardAvoidingView,
  ActivityIndicator, StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// Full-screen modal shell for the Settings sub-forms. Uses RN Modal so no
// navigator registration is needed; onRequestClose covers hardware back.
export default function FormSheet({ visible, onClose, title, children, onSave, saving, saveLabel = 'Save' }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel={`Close ${title}`}
          >
            <Icon name="close" size={20} color={colors.slate800} />
          </Pressable>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior="padding"
        >
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>

          {onSave && (
            <View style={styles.footer}>
              <Pressable
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={onSave}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel={saveLabel}
                accessibilityState={{ disabled: !!saving }}
              >
                {saving ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.saveButtonText}>{saveLabel}</Text>
                )}
              </Pressable>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.slate100,
  },
  closeButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  headerSpacer: { width: 48 },
  title: { fontFamily: fonts.displayBold, fontSize: fontSizes.lg, color: colors.slate800 },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.slate100,
    backgroundColor: colors.white,
  },
  saveButton: {
    minHeight: 48, borderRadius: radius.md, backgroundColor: colors.brand600,
    alignItems: 'center', justifyContent: 'center',
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.white },
})
