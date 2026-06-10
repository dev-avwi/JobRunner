import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from './PressableRow';
import { useConfirmDialog } from './ConfirmDialog';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../lib/theme';
import { useAuthStore } from '../../lib/store';
import { spacing, radius, shadows } from '../../lib/design-tokens';

interface LogoPickerProps {
  value?: string | null;
  onChange: (url: string | null, extractedColor?: string) => void;
  label?: string;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  triggerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  logoPreview: {
    width: 44,
    height: 44,
    borderRadius: radius.xl,
    backgroundColor: colors.muted,
  },
  logoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: radius.xl,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerText: {
    flex: 1,
  },
  triggerLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.foreground,
  },
  triggerValue: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  modal: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    padding: spacing.xs,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.foreground,
  },
  modalContent: {
    flex: 1,
    padding: spacing.lg,
  },
  previewSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  previewImage: {
    width: 160,
    height: 160,
    borderRadius: radius['2xl'],
    backgroundColor: colors.muted,
  },
  previewPlaceholder: {
    width: 160,
    height: 160,
    borderRadius: radius['2xl'],
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  placeholderText: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: spacing.md,
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: radius['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.white,
    marginTop: spacing.md,
  },
  progressBar: {
    width: 120,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  actions: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.foreground,
  },
  removeButton: {
    borderColor: colors.destructiveLight,
    backgroundColor: colors.destructiveLight,
  },
  removeButtonText: {
    color: colors.destructive,
  },
  infoSection: {
    backgroundColor: colors.muted,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  infoText: {
    fontSize: 13,
    color: colors.mutedForeground,
    lineHeight: 20,
    textAlign: 'center',
  },
});

export function LogoPicker({ value, onChange, label }: LogoPickerProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const confirm = useConfirmDialog();
  const { token } = useAuthStore();
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const pickImage = async (useCamera: boolean) => {
    try {
      const permissionResult = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(
          'Permission Required',
          `Please grant ${useCamera ? 'camera' : 'photo library'} access to upload your logo.`
        );
        return;
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });

      if (!result.canceled && result.assets[0]) {
        setPreviewUri(result.assets[0].uri);
        await uploadImage(result.assets[0]);
      }
    } catch (error) {
      if (__DEV__) console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const uploadImage = async (asset: ImagePicker.ImagePickerAsset) => {
    setUploading(true);
    setUploadProgress(0);

    try {
      const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://jobrunner.com.au';
      
      const filename = `logo-${Date.now()}.${asset.uri.split('.').pop() || 'jpg'}`;
      const mimeType = asset.mimeType || 'image/jpeg';

      const paramsResponse = await fetch(`${API_BASE}/api/objects/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          filename,
          contentType: mimeType,
          directory: 'public/logos',
        }),
      });

      if (!paramsResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { url, method, publicUrl } = await paramsResponse.json();

      setUploadProgress(30);

      const fileResponse = await fetch(asset.uri);
      const blob = await fileResponse.blob();

      setUploadProgress(50);

      const uploadResponse = await fetch(url, {
        method: method || 'PUT',
        headers: {
          'Content-Type': mimeType,
        },
        body: blob,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file');
      }

      setUploadProgress(80);

      const logoResponse = await fetch(`${API_BASE}/api/logo`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ logoUrl: publicUrl }),
      });

      if (logoResponse.ok) {
        const logoData = await logoResponse.json();
        setUploadProgress(100);
        
        onChange(publicUrl, logoData.extractedColor);
        
        setTimeout(() => {
          setShowModal(false);
          setPreviewUri(null);
          setUploading(false);
          setUploadProgress(0);
        }, 500);
      } else {
        onChange(publicUrl);
        setShowModal(false);
        setPreviewUri(null);
        setUploading(false);
      }
    } catch (error) {
      if (__DEV__) console.error('Upload error:', error);
      Alert.alert('Upload Failed', 'Could not upload your logo. Please try again.');
      setUploading(false);
      setPreviewUri(null);
    }
  };

  const handleRemoveLogo = async () => {
    const ok = await confirm({ title: 'Remove Logo', message: 'Are you sure you want to remove your business logo?', confirmText: 'Remove', cancelText: 'Cancel', destructive: true });
    if (ok) {
      onChange(null);
      setShowModal(false);
    }
  };

  return (
    <>
      <PressableRow style={styles.trigger} onPress={() => setShowModal(true)} >
        <View style={styles.triggerContent}>
          {value ? (
            <Image source={{ uri: value }} style={styles.logoPreview} />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Feather name="image" size={24} color={colors.mutedForeground} />
            </View>
          )}
          <View style={styles.triggerText}>
            <Text style={styles.triggerLabel}>{label || 'Business Logo'}</Text>
            <Text style={styles.triggerValue}>
              {value ? 'Tap to change' : 'Tap to upload'}
            </Text>
          </View>
        </View>
        <Feather name="upload" size={20} color={colors.mutedForeground} />
      </PressableRow>

      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => !uploading && setShowModal(false)}
      >
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <PressableRow onPress={() => !uploading && setShowModal(false)} style={styles.closeButton} disabled={uploading} >
              <Feather name="x" size={24} color={uploading ? colors.mutedForeground : colors.foreground} />
            </PressableRow>
            <Text style={styles.modalTitle}>Business Logo</Text>
            <View style={{ width: 32 }} />
          </View>

          <View style={styles.modalContent}>
            <View style={styles.previewSection}>
              {previewUri || value ? (
                <Image 
                  source={{ uri: previewUri || value! }} 
                  style={styles.previewImage}
                />
              ) : (
                <View style={styles.previewPlaceholder}>
                  <Feather name="image" size={48} color={colors.mutedForeground} />
                  <Text style={styles.placeholderText}>No logo uploaded</Text>
                </View>
              )}
              
              {uploading && (
                <View style={styles.uploadOverlay}>
                  <ActivityIndicator size="large" color={colors.white} />
                  <Text style={styles.uploadText}>Uploading... {uploadProgress}%</Text>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
                  </View>
                </View>
              )}
            </View>

            <View style={styles.actions}>
              <PressableRow style={styles.actionButton} onPress={() => pickImage(false)} disabled={uploading} >
                <Feather name="upload" size={24} color={colors.primary} />
                <Text style={styles.actionButtonText}>Choose Photo</Text>
              </PressableRow>

              <PressableRow style={styles.actionButton} onPress={() => pickImage(true)} disabled={uploading} >
                <Feather name="camera" size={24} color={colors.primary} />
                <Text style={styles.actionButtonText}>Take Photo</Text>
              </PressableRow>

              {value && (
                <PressableRow style={[styles.actionButton, styles.removeButton]} onPress={handleRemoveLogo} disabled={uploading} >
                  <Feather name="trash-2" size={24} color={colors.destructive} />
                  <Text style={[styles.actionButtonText, styles.removeButtonText]}>
                    Remove Logo
                  </Text>
                </PressableRow>
              )}
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.infoText}>
                Upload a square logo for best results. Your logo will appear on quotes, 
                invoices, and other documents sent to clients.
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
