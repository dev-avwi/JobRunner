import { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { useConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { useAuthStore } from '../../src/lib/store';
import { spacing, radius, shadows, typography, fontWeights } from '../../src/lib/design-tokens';
import { Slider } from '../../src/components/ui/Slider';
import {
  useAdvancedThemeStore,
  AppearanceSettings,
  TypographySettings,
  PRESET_THEMES,
} from '../../src/lib/advanced-theme-store';
import api from '../../src/lib/api';
import { getBottomNavHeight } from '../../src/components/BottomNav';
import { OwnerOnlyGuard } from '../../src/components/ui/OwnerOnlyGuard';

const PRESET_COLORS = [
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Orange', hex: '#E8862E' },
  { name: 'Red', hex: '#ef4444' },
  { name: 'Purple', hex: '#8b5cf6' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Blue', hex: '#2563EB' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Yellow', hex: '#eab308' },
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Gray', hex: '#64748b' },
  { name: 'Slate', hex: '#475569' },
];

const BORDER_RADIUS_OPTIONS: { value: AppearanceSettings['borderRadius']; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'sm', label: 'Small' },
  { value: 'md', label: 'Medium' },
  { value: 'lg', label: 'Large' },
  { value: 'xl', label: 'Extra Large' },
];

const SHADOW_OPTIONS: { value: AppearanceSettings['shadowIntensity']; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'subtle', label: 'Subtle' },
  { value: 'medium', label: 'Medium' },
  { value: 'strong', label: 'Strong' },
];

const ANIMATION_OPTIONS: { value: AppearanceSettings['animationSpeed']; label: string }[] = [
  { value: 'reduced', label: 'Reduced' },
  { value: 'normal', label: 'Normal' },
  { value: 'fast', label: 'Fast' },
];

const HEADING_WEIGHT_OPTIONS: { value: TypographySettings['headingWeight']; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'medium', label: 'Medium' },
  { value: 'semibold', label: 'Semibold' },
  { value: 'bold', label: 'Bold' },
];

const createStyles = (colors: ThemeColors, bottomNavHeight: number = 0) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: bottomNavHeight,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
    marginTop: spacing.xl,
    marginLeft: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoSection: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  logoPreview: {
    width: 80,
    height: 80,
    borderRadius: radius.xl,
    backgroundColor: colors.muted,
  },
  logoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: radius.xl,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  logoActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  logoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
  },
  logoButtonPrimary: {
    backgroundColor: colors.primary,
  },
  logoButtonText: {
    ...typography.body,
    color: colors.foreground,
    fontWeight: fontWeights.medium,
    fontSize: typography.button.fontSize,
  },
  logoButtonTextPrimary: {
    color: colors.primaryForeground,
  },
  logoRemoveButton: {
    backgroundColor: colors.destructiveLight,
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: 4,
    marginTop: spacing.sm,
  },
  modeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  modeOptionActive: {
    backgroundColor: colors.primary,
  },
  modeOptionText: {
    ...typography.body,
    color: colors.foreground,
    fontWeight: fontWeights.medium,
    fontSize: typography.button.fontSize,
  },
  modeOptionTextActive: {
    color: colors.primaryForeground,
  },
  themePresetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
  },
  themePresetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  themePresetDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  themePresetName: {
    ...typography.body,
    color: colors.foreground,
    fontWeight: fontWeights.semibold,
  },
  themePresetDesc: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  colorSwatch: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: colors.foreground,
  },
  customColorSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  inputLabel: {
    ...typography.body,
    color: colors.foreground,
    fontWeight: fontWeights.medium,
    marginBottom: spacing.sm,
    fontSize: typography.button.fontSize,
  },
  customColorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  customColorInput: {
    flex: 1,
    height: 44,
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  customColorPreview: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  applyButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  applyButtonText: {
    color: colors.primaryForeground,
    fontWeight: fontWeights.semibold,
    fontSize: typography.button.fontSize,
  },
  sliderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  sliderLabel: {
    ...typography.body,
    color: colors.foreground,
    fontWeight: fontWeights.medium,
    fontSize: typography.button.fontSize,
  },
  sliderValue: {
    ...typography.body,
    color: colors.primary,
    fontWeight: fontWeights.semibold,
    fontSize: typography.button.fontSize,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  optionChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionChipText: {
    ...typography.body,
    color: colors.foreground,
    fontWeight: fontWeights.medium,
    fontSize: typography.sizes.sm,
  },
  optionChipTextActive: {
    color: colors.primaryForeground,
  },
  previewSection: {
    marginTop: spacing.lg,
  },
  previewCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  previewIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  previewTitle: {
    ...typography.subtitle,
    color: colors.foreground,
  },
  previewSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  previewButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    alignSelf: 'flex-start',
    marginTop: spacing.md,
  },
  previewButtonText: {
    color: colors.primaryForeground,
    fontWeight: fontWeights.semibold,
    fontSize: typography.button.fontSize,
  },
  previewBadge: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
  previewBadgeText: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.semibold,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  infoText: {
    ...typography.caption,
    color: colors.mutedForeground,
    flex: 1,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resetButtonText: {
    ...typography.body,
    color: colors.destructive,
    fontWeight: fontWeights.medium,
  },
});

function BrandingScreenInner() {
  const { colors, brandColor } = useTheme();
  const confirm = useConfirmDialog();
  const { businessSettings, updateBusinessSettings } = useAuthStore();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, bottomNavHeight), [colors, bottomNavHeight]);
  
  const [customColor, setCustomColor] = useState('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoUrl, setLogoUrl] = useState(businessSettings?.logoUrl || '');

  const {
    mode,
    activePresetId,
    setMode,
    setActivePreset,
    setCustomPrimaryColor,
    setTypography,
    setAppearance,
    getActivePalette,
    getActiveTypography,
    getActiveAppearance,
    resetToDefaults,
  } = useAdvancedThemeStore();

  const activePalette = getActivePalette();
  const activeTypography = getActiveTypography();
  const activeAppearance = getActiveAppearance();

  // Sync server brand color to local store on mount (for cross-device sync)
  useEffect(() => {
    const serverBrandColor = businessSettings?.brandColor;
    if (serverBrandColor && /^#[0-9A-Fa-f]{6}$/i.test(serverBrandColor)) {
      const serverColor = serverBrandColor.toUpperCase();
      const localColor = activePalette?.primary?.toUpperCase();
      // Only sync if different (avoids unnecessary updates)
      if (serverColor !== localColor) {
        setCustomPrimaryColor(serverBrandColor);
      }
    }
    // Update logo URL from server if different
    if (businessSettings?.logoUrl && businessSettings.logoUrl !== logoUrl) {
      setLogoUrl(businessSettings.logoUrl);
    }
  }, [businessSettings?.brandColor, businessSettings?.logoUrl]);

  const isValidHex = (hex: string) => /^#[0-9A-Fa-f]{6}$/.test(hex);

  const handleCustomColorApply = useCallback(async () => {
    if (!isValidHex(customColor)) {
      Alert.alert('Invalid Color', 'Please enter a valid hex color (e.g., #3b82f6)');
      return;
    }
    setCustomPrimaryColor(customColor);
    await updateBusinessSettings({ brandColor: customColor });
    setCustomColor('');
    Alert.alert('Success', 'Brand color updated!');
  }, [customColor, setCustomPrimaryColor, updateBusinessSettings]);

  const handleColorSelect = useCallback(async (hex: string) => {
    setCustomPrimaryColor(hex);
    await updateBusinessSettings({ brandColor: hex });
  }, [setCustomPrimaryColor, updateBusinessSettings]);

  const handleResetTheme = useCallback(async () => {
    const ok = await confirm({
      title: 'Reset Theme',
      message: 'This will reset all theme settings to defaults. Continue?',
      confirmText: 'Reset',
      cancelText: 'Cancel',
      destructive: true,
    });
    if (ok) {
      resetToDefaults();
      Alert.alert('Success', 'Theme reset to defaults');
    }
  }, [resetToDefaults, confirm]);

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
        await uploadImage(result.assets[0]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const uploadImage = async (asset: ImagePicker.ImagePickerAsset) => {
    setIsUploadingLogo(true);

    try {
      const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://jobrunner.com.au';
      const token = await api.getToken();
      
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
          isPublic: true,
        }),
      });

      if (!paramsResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { signedUrl, publicUrl } = await paramsResponse.json();

      const imageResponse = await fetch(asset.uri);
      const imageBlob = await imageResponse.blob();

      await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': mimeType },
        body: imageBlob,
      });

      setLogoUrl(publicUrl);
      
      await fetch(`${API_BASE}/api/business-settings/logo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ logoUrl: publicUrl }),
      });

      await updateBusinessSettings({ logoUrl: publicUrl });
      Alert.alert('Success', 'Logo uploaded successfully!');
    } catch (error) {
      console.error('Error uploading logo:', error);
      Alert.alert('Error', 'Failed to upload logo. Please try again.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    const ok = await confirm({
      title: 'Remove Logo',
      message: 'Are you sure you want to remove your business logo?',
      confirmText: 'Remove',
      cancelText: 'Cancel',
      destructive: true,
    });
    if (ok) {
      setLogoUrl('');
      await updateBusinessSettings({ logoUrl: '' });
    }
  };

  const activePreset = PRESET_THEMES.find((p) => p.id === activePresetId);

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Theme & Branding',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
        }} 
      />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Business Logo */}
          <Text style={[styles.sectionTitle, { marginTop: 0 }]}>Business Logo</Text>
          <View style={styles.card}>
            <View style={styles.logoSection}>
              {logoUrl ? (
                <View>
                  <Image source={{ uri: logoUrl }} style={styles.logoPreview} />
                  {isUploadingLogo && (
                    <View style={[styles.uploadOverlay, { width: 80, height: 80 }]}>
                      <ActivityIndicator size="small" color={colors.primaryForeground} />
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.logoPlaceholder}>
                  {isUploadingLogo ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Feather name="image" size={28} color={colors.mutedForeground} />
                  )}
                </View>
              )}
              
              <View style={styles.logoActions}>
                <PressableRow style={[styles.logoButton, styles.logoButtonPrimary]} onPress={() => pickImage(false)} disabled={isUploadingLogo} data-testid="button-upload-logo" >
                  <Feather name="upload" size={14} color={colors.primaryForeground} />
                  <Text style={[styles.logoButtonText, styles.logoButtonTextPrimary]}>
                    {logoUrl ? 'Change' : 'Upload'}
                  </Text>
                </PressableRow>
                
                <PressableRow style={styles.logoButton} onPress={() => pickImage(true)} disabled={isUploadingLogo} data-testid="button-camera-logo" >
                  <Feather name="camera" size={14} color={colors.foreground} />
                  <Text style={styles.logoButtonText}>Camera</Text>
                </PressableRow>
                
                {logoUrl && (
                  <PressableRow style={[styles.logoButton, styles.logoRemoveButton]} onPress={handleRemoveLogo} disabled={isUploadingLogo} data-testid="button-remove-logo" >
                    <Feather name="trash-2" size={14} color={colors.destructive} />
                  </PressableRow>
                )}
              </View>
            </View>
          </View>

          {/* Appearance Mode */}
          <Text style={styles.sectionTitle}>Appearance</Text>
          <View style={styles.card}>
            <View style={styles.modeSelector}>
              {(['light', 'dark', 'system'] as const).map((m) => (
                <PressableRow key={m} style={[styles.modeOption, mode === m && styles.modeOptionActive]} onPress={() => setMode(m)} data-testid={`mode-${m}`} >
                  <Feather
                    name={m === 'light' ? 'sun' : m === 'dark' ? 'moon' : 'smartphone'}
                    size={16}
                    color={mode === m ? colors.primaryForeground : colors.foreground}
                  />
                  <Text
                    style={[styles.modeOptionText, mode === m && styles.modeOptionTextActive]}
                  >
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </Text>
                </PressableRow>
              ))}
            </View>
          </View>

          {/* Primary Color */}
          <Text style={styles.sectionTitle}>Primary Color</Text>
          <View style={styles.card}>
            <View style={styles.colorGrid}>
              {PRESET_COLORS.map((color) => (
                <PressableRow key={color.hex} style={[ styles.colorSwatch, { backgroundColor: color.hex }, activePalette.primary === color.hex && styles.colorSwatchSelected, ]} onPress={() => handleColorSelect(color.hex)} data-testid={`color-${color.name.toLowerCase()}`} >
                  {activePalette.primary === color.hex && (
                    <Feather name="check" size={16} color={colors.white} />
                  )}
                </PressableRow>
              ))}
            </View>

            <View style={styles.customColorSection}>
              <Text style={styles.inputLabel}>Custom Color (Hex)</Text>
              <View style={styles.customColorRow}>
                <TextInput
                  style={styles.customColorInput}
                  value={customColor}
                  onChangeText={setCustomColor}
                  placeholder="#3b82f6"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  maxLength={7}
                  data-testid="input-custom-color"
                />
                <View
                  style={[
                    styles.customColorPreview,
                    { backgroundColor: isValidHex(customColor) ? customColor : activePalette.primary },
                  ]}
                />
                <PressableRow style={[styles.applyButton, !isValidHex(customColor) && { opacity: 0.5 }]} onPress={handleCustomColorApply} disabled={!isValidHex(customColor)} data-testid="button-apply-color" >
                  <Text style={styles.applyButtonText}>Apply</Text>
                </PressableRow>
              </View>
            </View>
          </View>

          {/* Typography */}
          <Text style={styles.sectionTitle}>Typography</Text>
          <View style={styles.card}>
            <View style={styles.sliderRow}>
              <Text style={styles.sliderLabel}>Font Scale</Text>
              <Text style={styles.sliderValue}>{((activeTypography.fontScale ?? 1) * 100).toFixed(0)}%</Text>
            </View>
            <Slider
              value={activeTypography.fontScale ?? 1}
              minimumValue={0.8}
              maximumValue={1.2}
              step={0.05}
              onValueChange={(value) => setTypography({ fontScale: value })}
            />

            <View style={styles.sliderRow}>
              <Text style={styles.sliderLabel}>Line Height</Text>
              <Text style={styles.sliderValue}>{(activeTypography.bodyLineHeight ?? 1.5).toFixed(1)}</Text>
            </View>
            <Slider
              value={activeTypography.bodyLineHeight ?? 1.5}
              minimumValue={1.2}
              maximumValue={2.0}
              step={0.1}
              onValueChange={(value) => setTypography({ bodyLineHeight: value })}
            />

            <Text style={[styles.inputLabel, { marginTop: spacing.lg }]}>Heading Weight</Text>
            <View style={styles.optionGrid}>
              {HEADING_WEIGHT_OPTIONS.map((opt) => (
                <PressableRow key={opt.value} style={[ styles.optionChip, activeTypography.headingWeight === opt.value && styles.optionChipActive, ]} onPress={() => setTypography({ headingWeight: opt.value })} data-testid={`heading-${opt.value}`} >
                  <Text
                    style={[
                      styles.optionChipText,
                      activeTypography.headingWeight === opt.value && styles.optionChipTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </PressableRow>
              ))}
            </View>
          </View>

          {/* Appearance Settings */}
          <Text style={styles.sectionTitle}>Style</Text>
          <View style={styles.card}>
            <Text style={styles.inputLabel}>Corner Radius</Text>
            <View style={styles.optionGrid}>
              {BORDER_RADIUS_OPTIONS.map((opt) => (
                <PressableRow key={opt.value} style={[ styles.optionChip, activeAppearance.borderRadius === opt.value && styles.optionChipActive, ]} onPress={() => setAppearance({ borderRadius: opt.value })} data-testid={`radius-${opt.value}`} >
                  <Text
                    style={[
                      styles.optionChipText,
                      activeAppearance.borderRadius === opt.value && styles.optionChipTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </PressableRow>
              ))}
            </View>

            <Text style={[styles.inputLabel, { marginTop: spacing.lg }]}>Shadow Intensity</Text>
            <View style={styles.optionGrid}>
              {SHADOW_OPTIONS.map((opt) => (
                <PressableRow key={opt.value} style={[ styles.optionChip, activeAppearance.shadowIntensity === opt.value && styles.optionChipActive, ]} onPress={() => setAppearance({ shadowIntensity: opt.value })} data-testid={`shadow-${opt.value}`} >
                  <Text
                    style={[
                      styles.optionChipText,
                      activeAppearance.shadowIntensity === opt.value && styles.optionChipTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </PressableRow>
              ))}
            </View>

            <Text style={[styles.inputLabel, { marginTop: spacing.lg }]}>Animation Speed</Text>
            <View style={styles.optionGrid}>
              {ANIMATION_OPTIONS.map((opt) => (
                <PressableRow key={opt.value} style={[ styles.optionChip, activeAppearance.animationSpeed === opt.value && styles.optionChipActive, ]} onPress={() => setAppearance({ animationSpeed: opt.value })} data-testid={`animation-${opt.value}`} >
                  <Text
                    style={[
                      styles.optionChipText,
                      activeAppearance.animationSpeed === opt.value && styles.optionChipTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </PressableRow>
              ))}
            </View>
          </View>

          {/* Live Preview */}
          <Text style={styles.sectionTitle}>Live Preview</Text>
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <View style={[styles.previewIcon, { backgroundColor: `${activePalette.primary}20` }]}>
                <Feather name="briefcase" size={20} color={activePalette.primary} />
              </View>
              <View>
                <Text style={styles.previewTitle}>Sample Job Card</Text>
                <Text style={styles.previewSubtitle}>This is how your brand looks</Text>
              </View>
            </View>
            <View style={[styles.previewBadge, { backgroundColor: `${activePalette.primary}20` }]}>
              <Text style={[styles.previewBadgeText, { color: activePalette.primary }]}>In Progress</Text>
            </View>
            <PressableRow style={[styles.previewButton, { backgroundColor: activePalette.primary }]} >
              <Text style={styles.previewButtonText}>Primary Button</Text>
            </PressableRow>
          </View>

          <View style={styles.infoRow}>
            <Feather name="info" size={14} color={colors.mutedForeground} />
            <Text style={styles.infoText}>
              Your brand color will be applied throughout the app including buttons, badges, and accent elements.
            </Text>
          </View>

          {/* Reset Button */}
          <PressableRow style={styles.resetButton} onPress={handleResetTheme} data-testid="button-reset-theme" >
            <Feather name="refresh-cw" size={16} color={colors.destructive} />
            <Text style={styles.resetButtonText}>Reset to Defaults</Text>
          </PressableRow>
        </View>
      </ScrollView>
    </>
  );
}

export default function BrandingScreen() {
  return (
    <OwnerOnlyGuard requiredPermission={['manage_settings']}>
      <BrandingScreenInner />
    </OwnerOnlyGuard>
  );
}
