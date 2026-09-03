import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { AppBottomSheet, AppBottomSheetRef } from './ui/AppBottomSheet';
import { useTheme } from '../lib/theme';
import { spacing, radius, typography, iconSizes, fontWeights } from '../lib/design-tokens';
import { useAuthStore } from '../lib/store';
import api from '../lib/api';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

export interface FeedbackBottomSheetRef {
  present: () => void;
  dismiss: () => void;
}

const FEEDBACK_TYPES = [
  { id: 'bug', label: 'Bug Report', icon: 'alert-circle' as const },
  { id: 'feature', label: 'Feature Request', icon: 'star' as const },
  { id: 'general', label: 'General', icon: 'message-circle' as const },
];

const MAX_PHOTOS = 3;

interface Props {
  sheetRef: React.RefObject<AppBottomSheetRef | null>;
  currentScreen?: string;
  onSuccess?: () => void;
}

export default function FeedbackBottomSheet({ sheetRef, currentScreen, onSuccess }: Props) {
  const { colors } = useTheme();
  const { user } = useAuthStore();

  const [feedbackType, setFeedbackType] = useState('general');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(0);
  const [photos, setPhotos] = useState<Array<{ uri: string; base64?: string; type?: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);

  const styles = makeStyles(colors);

  function reset() {
    setFeedbackType('general');
    setMessage('');
    setRating(0);
    setPhotos([]);
    setSuccessVisible(false);
  }

  const pickPhotos = useCallback(async () => {
    if (photos.length >= MAX_PHOTOS) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
      quality: 0.7,
      base64: false,
    });

    if (!result.canceled) {
      const newPhotos = result.assets.map((a) => ({
        uri: a.uri,
        type: a.mimeType || 'image/jpeg',
      }));
      setPhotos((prev) => [...prev, ...newPhotos].slice(0, MAX_PHOTOS));
    }
  }, [photos.length]);

  const takePhoto = useCallback(async () => {
    if (photos.length >= MAX_PHOTOS) return;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      base64: false,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPhotos((prev) =>
        [...prev, { uri: asset.uri, type: asset.mimeType || 'image/jpeg' }].slice(0, MAX_PHOTOS),
      );
    }
  }, [photos.length]);

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('feedbackType', feedbackType);
      formData.append('message', message.trim());
      if (rating > 0) formData.append('rating', String(rating));
      formData.append('platform', Platform.OS === 'ios' ? 'ios' : 'android');
      formData.append('appVersion', Application.nativeApplicationVersion || Constants.expoConfig?.version || '1.1.0');
      if (currentScreen) formData.append('currentRoute', currentScreen);

      const deviceInfo: Record<string, string> = {
        platform: Platform.OS,
        deviceName: Device.modelName || Device.deviceName || 'Unknown',
        osVersion: Platform.Version?.toString() || 'Unknown',
      };
      formData.append('deviceInfo', JSON.stringify(deviceInfo));

      // Attach photos
      photos.forEach((photo, i) => {
        const ext = (photo.type || 'image/jpeg').split('/')[1] || 'jpg';
        formData.append('photos', {
          uri: photo.uri,
          name: `photo_${i}.${ext}`,
          type: photo.type || 'image/jpeg',
        } as any);
      });

      const response = await api.uploadFile('/api/feedback', formData);

      if (response.error) {
        throw new Error(response.error);
      }

      setSuccessVisible(true);
      setTimeout(() => {
        reset();
        sheetRef.current?.dismiss();
        onSuccess?.();
      }, 1500);
    } catch (err: any) {
      // Show inline error
      setErrorMsg(err?.message || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Inline error state
  const [errorMsg, setErrorMsg] = useState('');

  return (
    <AppBottomSheet
      ref={sheetRef}
      title="Send Feedback"
      snapPoints={['85%']}
      onDismiss={reset}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {successVisible ? (
          <View style={styles.successContainer}>
            <View style={styles.successIcon}>
              <Feather name="check-circle" size={40} color={colors.primary} />
            </View>
            <Text style={styles.successTitle}>Thank you!</Text>
            <Text style={styles.successSubtitle}>Your feedback has been submitted.</Text>
          </View>
        ) : (
          <>
            {/* Type selector */}
            <Text style={styles.sectionLabel}>FEEDBACK TYPE</Text>
            <View style={styles.typeRow}>
              {FEEDBACK_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.typeButton, feedbackType === t.id && styles.typeButtonSelected]}
                  onPress={() => setFeedbackType(t.id)}
                  activeOpacity={0.7}
                >
                  <Feather
                    name={t.icon}
                    size={iconSizes.md}
                    color={feedbackType === t.id ? colors.primary : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.typeLabel,
                      feedbackType === t.id && { color: colors.primary },
                    ]}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Message */}
            <Text style={styles.sectionLabel}>MESSAGE *</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder={
                  feedbackType === 'bug'
                    ? 'Describe what happened and what you expected...'
                    : feedbackType === 'feature'
                    ? 'What would you like to see added or improved?'
                    : "What's on your mind?"
                }
                placeholderTextColor={colors.mutedForeground}
                value={message}
                onChangeText={(v) => { setMessage(v); setErrorMsg(''); }}
                multiline
                maxLength={2000}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>{message.length}/2000</Text>
            </View>

            {/* Star rating */}
            <Text style={styles.sectionLabel}>RATING (OPTIONAL)</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star === rating ? 0 : star)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                >
                  <Feather
                    name="star"
                    size={28}
                    color={star <= rating ? '#f59e0b' : colors.border}
                    style={{ marginHorizontal: 4 }}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Photos */}
            <Text style={styles.sectionLabel}>SCREENSHOTS (OPTIONAL, UP TO {MAX_PHOTOS})</Text>
            <View style={styles.photosRow}>
              {photos.map((photo, i) => (
                <View key={i} style={styles.photoThumb}>
                  <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                  <TouchableOpacity
                    style={styles.photoRemove}
                    onPress={() => removePhoto(i)}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    <Feather name="x" size={12} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              {photos.length < MAX_PHOTOS && (
                <View style={styles.photoAddGroup}>
                  <TouchableOpacity style={styles.photoAdd} onPress={pickPhotos} activeOpacity={0.7}>
                    <Feather name="image" size={iconSizes.lg} color={colors.mutedForeground} />
                    <Text style={styles.photoAddLabel}>Library</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.photoAdd} onPress={takePhoto} activeOpacity={0.7}>
                    <Feather name="camera" size={iconSizes.lg} color={colors.mutedForeground} />
                    <Text style={styles.photoAddLabel}>Camera</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Error */}
            {!!errorMsg && (
              <View style={styles.errorBanner}>
                <Feather name="alert-circle" size={iconSizes.sm} color={colors.destructive} />
                <Text style={styles.errorText}>{errorMsg}</Text>
                <TouchableOpacity onPress={handleSubmit}>
                  <Text style={[styles.errorText, { color: colors.primary, fontWeight: fontWeights.semibold }]}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Submit */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                (submitting || !message.trim()) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={submitting || !message.trim()}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator color={colors.primaryForeground} size="small" />
              ) : (
                <Feather name="send" size={iconSizes.md} color={colors.primaryForeground} />
              )}
              <Text style={styles.submitText}>
                {submitting ? 'Sending...' : 'Send Feedback'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </AppBottomSheet>
  );
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    content: {
      padding: spacing.lg,
      paddingBottom: spacing.xl,
    },
    sectionLabel: {
      ...typography.label,
      color: colors.mutedForeground,
      marginBottom: spacing.sm,
      marginTop: spacing.lg,
    },
    typeRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    typeButton: {
      flex: 1,
      flexDirection: 'column',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      paddingVertical: spacing.md,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    typeButtonSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },
    typeLabel: {
      ...typography.captionSmall,
      color: colors.mutedForeground,
      textAlign: 'center',
    },
    inputContainer: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    input: {
      padding: spacing.md,
      ...typography.body,
      color: colors.foreground,
    },
    textArea: {
      minHeight: 100,
    },
    charCount: {
      ...typography.caption,
      color: colors.mutedForeground,
      textAlign: 'right',
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
    },
    starsRow: {
      flexDirection: 'row',
      paddingVertical: spacing.sm,
    },
    photosRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    photoThumb: {
      width: 72,
      height: 72,
      borderRadius: radius.md,
      overflow: 'hidden',
      position: 'relative',
    },
    photoImage: {
      width: '100%',
      height: '100%',
    },
    photoRemove: {
      position: 'absolute',
      top: 4,
      right: 4,
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderRadius: 8,
      padding: 2,
    },
    photoAddGroup: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    photoAdd: {
      width: 72,
      height: 72,
      borderRadius: radius.md,
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    photoAddLabel: {
      ...typography.captionSmall,
      color: colors.mutedForeground,
    },
    submitButton: {
      backgroundColor: colors.primary,
      borderRadius: radius.lg,
      padding: spacing.lg,
      alignItems: 'center',
      marginTop: spacing.xl,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    submitButtonDisabled: {
      opacity: 0.5,
    },
    submitText: {
      ...typography.body,
      fontWeight: fontWeights.semibold,
      color: colors.primaryForeground,
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.destructive + '15',
      borderRadius: radius.md,
      padding: spacing.md,
      marginTop: spacing.md,
    },
    errorText: {
      ...typography.bodySmall,
      color: colors.destructive,
      flex: 1,
    },
    successContainer: {
      alignItems: 'center',
      paddingVertical: spacing.xl * 2,
      gap: spacing.md,
    },
    successIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    successTitle: {
      ...typography.pageTitle,
      color: colors.foreground,
    },
    successSubtitle: {
      ...typography.body,
      color: colors.mutedForeground,
      textAlign: 'center',
    },
  });
