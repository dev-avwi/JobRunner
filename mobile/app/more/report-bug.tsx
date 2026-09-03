import { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Image,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Device from 'expo-device';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';
import NetInfo from '@react-native-community/netinfo';
import { useAuthStore } from '../../src/lib/store';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import api, { API_URL } from '../../src/lib/api';
import { spacing, radius, typography, iconSizes, fontWeights } from '../../src/lib/design-tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavHeight } from '../../src/components/BottomNav';

const CATEGORIES = [
  { id: 'crash', label: 'App Crash', icon: 'alert-triangle' },
  { id: 'feature', label: 'Feature Not Working', icon: 'x-circle' },
  { id: 'ui', label: 'Display Issue', icon: 'layout' },
  { id: 'performance', label: 'Slow/Laggy', icon: 'clock' },
  { id: 'data', label: 'Data Problem', icon: 'database' },
  { id: 'other', label: 'Other', icon: 'help-circle' },
] as const;

const SEVERITY_LEVELS = [
  { id: 'low', label: 'Low', description: 'Minor issue, workaround exists', color: '#22c55e' },
  { id: 'medium', label: 'Medium', description: 'Noticeable but not blocking', color: '#f59e0b' },
  { id: 'high', label: 'High', description: 'Blocking my work', color: '#ef4444' },
] as const;

const createStyles = (colors: ThemeColors, bottomNavHeight: number = 0) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: bottomNavHeight,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.destructive + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  headerTitle: {
    ...typography.pageTitle,
    color: colors.foreground,
    textAlign: 'center',
  },
  headerSubtitle: {
    ...typography.body,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  sectionTitle: {
    ...typography.sectionHeader,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryButton: {
    flexBasis: '48%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  categoryIcon: {
    marginBottom: spacing.xs,
  },
  categoryLabel: {
    ...typography.bodySmall,
    color: colors.foreground,
    textAlign: 'center',
  },
  severityRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  severityButton: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  severityButtonSelected: {
    borderColor: colors.primary,
  },
  severityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: spacing.xs,
  },
  severityLabel: {
    ...typography.bodySmall,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  severityDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: 2,
  },
  inputContainer: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.sm,
  },
  input: {
    padding: spacing.md,
    ...typography.body,
    color: colors.foreground,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'right',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  errorCard: {
    backgroundColor: colors.destructive + '10',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.destructive + '30',
  },
  errorCardTitle: {
    ...typography.bodySmall,
    fontWeight: fontWeights.semibold,
    color: colors.destructive,
    marginBottom: spacing.xs,
  },
  errorCardText: {
    ...typography.caption,
    color: colors.mutedForeground,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
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
  submitButtonText: {
    ...typography.body,
    fontWeight: fontWeights.semibold,
    color: colors.primaryForeground,
  },
  infoCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  infoCardText: {
    ...typography.bodySmall,
    color: colors.mutedForeground,
    flex: 1,
  },
  deviceInfoCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  deviceInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  deviceInfoLabel: {
    ...typography.bodySmall,
    color: colors.mutedForeground,
  },
  deviceInfoValue: {
    ...typography.bodySmall,
    color: colors.foreground,
    fontWeight: fontWeights.medium,
  },
});

export default function ReportBugScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, bottomNavHeight), [colors, bottomNavHeight]);
  const params = useLocalSearchParams();
  const { user, businessSettings } = useAuthStore();
  
  const [category, setCategory] = useState<string>('');
  const [severity, setSeverity] = useState<string>('medium');
  const [description, setDescription] = useState('');
  const [reproductionSteps, setReproductionSteps] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<string>('unknown');
  const [photos, setPhotos] = useState<Array<{ uri: string; type?: string }>>([]);

  const MAX_PHOTOS = 3;

  const pickPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
      quality: 0.7,
    });
    if (!result.canceled) {
      setPhotos(prev => [...prev, ...result.assets.map(a => ({ uri: a.uri, type: a.mimeType || 'image/jpeg' }))].slice(0, MAX_PHOTOS));
    }
  };
  
  const prefilledError = params.errorMessage as string | undefined;
  const prefilledStack = params.stackTrace as string | undefined;
  const prefilledScreen = params.screenName as string | undefined;

  useEffect(() => {
    NetInfo.fetch().then(state => {
      setNetworkStatus(state.isConnected ? (state.type || 'connected') : 'offline');
    }).catch(() => {
      setNetworkStatus('unknown');
    });
  }, []);

  const deviceInfo = {
    platform: Platform.OS,
    deviceName: Device.modelName || Device.deviceName || 'Unknown',
    osVersion: Platform.Version?.toString() || 'Unknown',
    buildNumber: Constants.expoConfig?.version || '1.1.0',
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert('Required', 'Please describe the problem you experienced.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload any attached photos first, then include URLs in the JSON body
      let photoUrls: string[] = [];
      if (photos.length > 0) {
        const uploadForm = new FormData();
        photos.forEach((photo, i) => {
          const ext = (photo.type || 'image/jpeg').split('/')[1] || 'jpg';
          uploadForm.append('photos', { uri: photo.uri, name: `photo_${i}.${ext}`, type: photo.type || 'image/jpeg' } as any);
        });
        const uploadRes = await api.uploadFile('/api/feedback/upload-photos', uploadForm);
        if (!uploadRes.error) {
          photoUrls = (uploadRes.data as any)?.urls ?? [];
        }
      }

      const response = await fetch(`${API_URL}/api/bug-reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: category || 'other',
          severity,
          description: description.trim(),
          reproductionSteps: reproductionSteps.trim() || undefined,
          errorMessage: prefilledError,
          stackTrace: prefilledStack,
          deviceInfo,
          appVersion: Constants.expoConfig?.version || '1.1.0',
          userEmail: user?.email,
          userName: user?.firstName ? `${user.firstName} ${user?.lastName || ''}`.trim() : (user as any)?.name,
          userId: user?.id,
          screenName: prefilledScreen,
          networkStatus,
          photoUrls,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert(
          'Report Sent',
          'Thank you for your feedback! We\'ll look into this issue and may contact you if we need more information.',
          [{ text: 'OK', onPress: () => {} }]
        );
        setDescription('');
        setReproductionSteps('');
        setCategory('');
      } else {
        throw new Error(data.error || 'Failed to submit report');
      }
    } catch (error: any) {
      Alert.alert(
        'Submission Failed',
        `Unable to submit your report. Please try again or email us directly at admin@avwebinnovation.com\n\nError: ${error.message}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Report a Problem',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
        }} 
      />
      
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Feather name="alert-circle" size={28} color={colors.destructive} />
            </View>
            <Text style={styles.headerTitle}>Report a Problem</Text>
            <Text style={styles.headerSubtitle}>
              Help us fix issues by telling us what went wrong
            </Text>
          </View>

          {prefilledError && (
            <View style={styles.errorCard}>
              <Text style={styles.errorCardTitle}>Error Detected</Text>
              <Text style={styles.errorCardText} numberOfLines={3}>
                {prefilledError}
              </Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>WHAT TYPE OF PROBLEM?</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => (
              <PressableRow key={cat.id} style={[ styles.categoryButton, category === cat.id && styles.categoryButtonSelected ]} onPress={() => setCategory(cat.id)} >
                <Feather 
                  name={cat.icon as any} 
                  size={iconSizes.lg} 
                  color={category === cat.id ? colors.primary : colors.mutedForeground}
                  style={styles.categoryIcon}
                />
                <Text style={styles.categoryLabel}>{cat.label}</Text>
              </PressableRow>
            ))}
          </View>

          <Text style={styles.sectionTitle}>HOW BAD IS IT?</Text>
          <View style={styles.severityRow}>
            {SEVERITY_LEVELS.map((level) => (
              <PressableRow key={level.id} style={[ styles.severityButton, severity === level.id && styles.severityButtonSelected ]} onPress={() => setSeverity(level.id)} >
                <View style={[styles.severityDot, { backgroundColor: level.color }]} />
                <Text style={styles.severityLabel}>{level.label}</Text>
                <Text style={styles.severityDescription}>{level.description}</Text>
              </PressableRow>
            ))}
          </View>

          <Text style={styles.sectionTitle}>DESCRIBE THE PROBLEM *</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="What happened? What were you trying to do?"
              placeholderTextColor={colors.mutedForeground}
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={2000}
            />
            <Text style={styles.charCount}>{description.length}/2000</Text>
          </View>

          <Text style={styles.sectionTitle}>STEPS TO REPRODUCE (OPTIONAL)</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="1. Go to...&#10;2. Tap on...&#10;3. See error..."
              placeholderTextColor={colors.mutedForeground}
              value={reproductionSteps}
              onChangeText={setReproductionSteps}
              multiline
              maxLength={1000}
            />
            <Text style={styles.charCount}>{reproductionSteps.length}/1000</Text>
          </View>

          <Text style={styles.sectionTitle}>DEVICE INFORMATION</Text>
          <View style={styles.deviceInfoCard}>
            <View style={styles.deviceInfoRow}>
              <Text style={styles.deviceInfoLabel}>Platform</Text>
              <Text style={styles.deviceInfoValue}>{deviceInfo.platform}</Text>
            </View>
            <View style={styles.deviceInfoRow}>
              <Text style={styles.deviceInfoLabel}>Device</Text>
              <Text style={styles.deviceInfoValue}>{deviceInfo.deviceName}</Text>
            </View>
            <View style={styles.deviceInfoRow}>
              <Text style={styles.deviceInfoLabel}>OS Version</Text>
              <Text style={styles.deviceInfoValue}>{deviceInfo.osVersion}</Text>
            </View>
            <View style={styles.deviceInfoRow}>
              <Text style={styles.deviceInfoLabel}>App Version</Text>
              <Text style={styles.deviceInfoValue}>{deviceInfo.buildNumber}</Text>
            </View>
            <View style={styles.deviceInfoRow}>
              <Text style={styles.deviceInfoLabel}>Network</Text>
              <Text style={styles.deviceInfoValue}>{networkStatus}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>ATTACH PHOTOS (OPTIONAL)</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {photos.map((photo, i) => (
              <View key={i} style={{ width: 72, height: 72, borderRadius: radius.md, overflow: 'hidden', position: 'relative' }}>
                <Image source={{ uri: photo.uri }} style={{ width: '100%', height: '100%' }} />
                <TouchableOpacity
                  style={{ position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, padding: 2 }}
                  onPress={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
                >
                  <Feather name="x" size={12} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < MAX_PHOTOS && (
              <TouchableOpacity
                style={{ width: 72, height: 72, borderRadius: radius.md, borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                onPress={pickPhoto}
                activeOpacity={0.7}
              >
                <Feather name="image" size={iconSizes.lg} color={colors.mutedForeground} />
                <Text style={{ ...typography.captionSmall, color: colors.mutedForeground }}>Add Photo</Text>
              </TouchableOpacity>
            )}
          </View>

          <PressableRow style={[ styles.submitButton, (isSubmitting || !description.trim()) && styles.submitButtonDisabled ]} onPress={handleSubmit} disabled={isSubmitting || !description.trim()} >
            {isSubmitting ? (
              <ActivityIndicator color={colors.primaryForeground} size="small" />
            ) : (
              <Feather name="send" size={iconSizes.md} color={colors.primaryForeground} />
            )}
            <Text style={styles.submitButtonText}>
              {isSubmitting ? 'Submitting...' : 'Submit Report'}
            </Text>
          </PressableRow>

          <View style={styles.infoCard}>
            <Feather name="info" size={iconSizes.md} color={colors.primary} />
            <Text style={styles.infoCardText}>
              Your report will be sent to our development team. We may contact you at {user?.email || 'your email'} if we need more details.
            </Text>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
