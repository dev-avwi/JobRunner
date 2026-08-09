import { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import { PressableRow } from './ui/PressableRow';
import { AppBottomSheet } from './ui/AppBottomSheet';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../lib/theme';
import { spacing, radius, shadows } from '../lib/design-tokens';
import {
  useAdvancedThemeStore,
  PRESET_THEMES,
  ThemePreset,
  AppearanceSettings,
  TypographySettings,
} from '../lib/advanced-theme-store';
import { Slider } from './ui/Slider';

interface AdvancedThemeControlsProps {
  onClose?: () => void;
}

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
  { name: 'Black', hex: '#1f2937' },
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

export function AdvancedThemeControls({ onClose }: AdvancedThemeControlsProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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

  const [showPresetPicker, setShowPresetPicker] = useState(false);
  const [customColor, setCustomColor] = useState('');

  const activePalette = getActivePalette();
  const activeTypography = getActiveTypography();
  const activeAppearance = getActiveAppearance();

  const handleCustomColorApply = () => {
    if (/^#[0-9A-Fa-f]{6}$/.test(customColor)) {
      setCustomPrimaryColor(customColor);
      setCustomColor('');
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Theme Mode */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance Mode</Text>
        <View style={styles.modeSelector}>
          {(['light', 'dark', 'system'] as const).map((m) => (
            <PressableRow key={m} style={[styles.modeOption, mode === m && styles.modeOptionActive]} onPress={() => setMode(m)} >
              <Feather
                name={m === 'light' ? 'sun' : m === 'dark' ? 'moon' : 'smartphone'}
                size={18}
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

      {/* Theme Presets */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Theme Preset</Text>
        <PressableRow style={styles.presetSelector} onPress={() => setShowPresetPicker(true)} >
          <View style={styles.presetInfo}>
            <View
              style={[
                styles.presetColorDot,
                { backgroundColor: activePalette.primary },
              ]}
            />
            <View>
              <Text style={styles.presetName}>
                {PRESET_THEMES.find((p) => p.id === activePresetId)?.name || 'Default'}
              </Text>
              <Text style={styles.presetDescription}>
                {PRESET_THEMES.find((p) => p.id === activePresetId)?.description || ''}
              </Text>
            </View>
          </View>
          <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
        </PressableRow>
      </View>

      {/* Primary Color */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Primary Color</Text>
        <View style={styles.colorGrid}>
          {PRESET_COLORS.map((color) => (
            <PressableRow key={color.hex} style={[ styles.colorSwatch, { backgroundColor: color.hex }, activePalette.primary === color.hex && styles.colorSwatchSelected, ]} onPress={() => setCustomPrimaryColor(color.hex)} >
              {activePalette.primary === color.hex && (
                <Feather name="check" size={16} color={colors.white} />
              )}
            </PressableRow>
          ))}
        </View>

        {/* Custom Color Input */}
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
            />
            <View
              style={[
                styles.customColorPreview,
                {
                  backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(customColor)
                    ? customColor
                    : activePalette.primary,
                },
              ]}
            />
            <PressableRow style={styles.applyButton} onPress={handleCustomColorApply} disabled={!/^#[0-9A-Fa-f]{6}$/.test(customColor)} >
              <Text style={styles.applyButtonText}>Apply</Text>
            </PressableRow>
          </View>
        </View>
      </View>

      {/* Typography Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Typography</Text>

        <View style={styles.sliderRow}>
          <Text style={styles.sliderLabel}>Font Scale</Text>
          <Text style={styles.sliderValue}>{(activeTypography.fontScale * 100).toFixed(0)}%</Text>
        </View>
        <Slider
          value={activeTypography.fontScale}
          minimumValue={0.8}
          maximumValue={1.2}
          step={0.05}
          onValueChange={(value) => setTypography({ fontScale: value })}
        />

        <View style={styles.sliderRow}>
          <Text style={styles.sliderLabel}>Line Height</Text>
          <Text style={styles.sliderValue}>{activeTypography.bodyLineHeight.toFixed(1)}</Text>
        </View>
        <Slider
          value={activeTypography.bodyLineHeight}
          minimumValue={1.2}
          maximumValue={1.8}
          step={0.1}
          onValueChange={(value) => setTypography({ bodyLineHeight: value })}
        />

        <Text style={styles.inputLabel}>Heading Weight</Text>
        <View style={styles.optionRow}>
          {HEADING_WEIGHT_OPTIONS.map((option) => (
            <PressableRow key={option.value} style={[ styles.optionChip, activeTypography.headingWeight === option.value && styles.optionChipActive, ]} onPress={() => setTypography({ headingWeight: option.value })} >
              <Text
                style={[
                  styles.optionChipText,
                  activeTypography.headingWeight === option.value && styles.optionChipTextActive,
                ]}
              >
                {option.label}
              </Text>
            </PressableRow>
          ))}
        </View>
      </View>

      {/* Appearance Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>

        <Text style={styles.inputLabel}>Corner Radius</Text>
        <View style={styles.optionRow}>
          {BORDER_RADIUS_OPTIONS.map((option) => (
            <PressableRow key={option.value} style={[ styles.optionChip, activeAppearance.borderRadius === option.value && styles.optionChipActive, ]} onPress={() => setAppearance({ borderRadius: option.value })} >
              <Text
                style={[
                  styles.optionChipText,
                  activeAppearance.borderRadius === option.value && styles.optionChipTextActive,
                ]}
              >
                {option.label}
              </Text>
            </PressableRow>
          ))}
        </View>

        <Text style={styles.inputLabel}>Shadow Intensity</Text>
        <View style={styles.optionRow}>
          {SHADOW_OPTIONS.map((option) => (
            <PressableRow key={option.value} style={[ styles.optionChip, activeAppearance.shadowIntensity === option.value && styles.optionChipActive, ]} onPress={() => setAppearance({ shadowIntensity: option.value })} >
              <Text
                style={[
                  styles.optionChipText,
                  activeAppearance.shadowIntensity === option.value && styles.optionChipTextActive,
                ]}
              >
                {option.label}
              </Text>
            </PressableRow>
          ))}
        </View>

        <Text style={styles.inputLabel}>Animation Speed</Text>
        <View style={styles.optionRow}>
          {ANIMATION_OPTIONS.map((option) => (
            <PressableRow key={option.value} style={[ styles.optionChip, activeAppearance.animationSpeed === option.value && styles.optionChipActive, ]} onPress={() => setAppearance({ animationSpeed: option.value })} >
              <Text
                style={[
                  styles.optionChipText,
                  activeAppearance.animationSpeed === option.value && styles.optionChipTextActive,
                ]}
              >
                {option.label}
              </Text>
            </PressableRow>
          ))}
        </View>

        <PressableRow style={[ styles.compactToggle, activeAppearance.compactMode && styles.compactToggleActive, ]} onPress={() => setAppearance({ compactMode: !activeAppearance.compactMode })} >
          <View style={styles.compactToggleContent}>
            <Feather
              name="minimize-2"
              size={18}
              color={activeAppearance.compactMode ? colors.primary : colors.foreground}
            />
            <View>
              <Text style={styles.compactToggleTitle}>Compact Mode</Text>
              <Text style={styles.compactToggleDescription}>
                Reduce spacing for more content
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.checkbox,
              activeAppearance.compactMode && styles.checkboxActive,
            ]}
          >
            {activeAppearance.compactMode && (
              <Feather name="check" size={14} color={colors.primaryForeground} />
            )}
          </View>
        </PressableRow>
      </View>

      {/* Reset Button */}
      <PressableRow style={styles.resetButton} onPress={resetToDefaults}>
        <Feather name="refresh-cw" size={16} color={colors.destructive} />
        <Text style={styles.resetButtonText}>Reset to Defaults</Text>
      </PressableRow>

      {/* Preset Picker Bottom Sheet */}
      <AppBottomSheet
        visible={showPresetPicker}
        onDismiss={() => setShowPresetPicker(false)}
        title="Choose Theme Preset"
        showCloseButton
        snapPoints={['70%']}
      >
        <View>
          {PRESET_THEMES.map((preset) => (
            <PressableRow key={preset.id} style={[ styles.presetItem, activePresetId === preset.id && styles.presetItemActive, ]} onPress={() => { setActivePreset(preset.id); setShowPresetPicker(false); }} >
              <View
                style={[
                  styles.presetColorDot,
                  { backgroundColor: preset.lightPalette.primary },
                ]}
              />
              <View style={styles.presetItemInfo}>
                <Text style={styles.presetItemName}>{preset.name}</Text>
                <Text style={styles.presetItemDesc}>{preset.description}</Text>
              </View>
              {activePresetId === preset.id && (
                <Feather name="check" size={18} color={colors.primary} />
              )}
            </PressableRow>
          ))}
        </View>
      </AppBottomSheet>
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    section: {
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.mutedForeground,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: spacing.md,
    },
    modeSelector: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    modeOption: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.muted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modeOptionActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    modeOptionText: {
      fontSize: 14,
      color: colors.foreground,
      fontWeight: '500',
    },
    modeOptionTextActive: {
      color: colors.primaryForeground,
    },
    presetSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    presetInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    presetColorDot: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    presetName: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.foreground,
    },
    presetDescription: {
      fontSize: 13,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    colorGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    colorSwatch: {
      width: 44,
      height: 44,
      borderRadius: 22,
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
      fontSize: 13,
      fontWeight: '600',
      color: colors.foreground,
      marginBottom: spacing.sm,
      marginTop: spacing.md,
    },
    customColorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    customColorInput: {
      flex: 1,
      height: 44,
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      fontSize: 14,
      color: colors.foreground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    customColorPreview: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 2,
      borderColor: colors.border,
    },
    applyButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.lg,
    },
    applyButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primaryForeground,
    },
    sliderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.xs,
      marginTop: spacing.md,
    },
    sliderLabel: {
      fontSize: 14,
      color: colors.foreground,
    },
    sliderValue: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
    optionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    optionChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.lg,
      backgroundColor: colors.muted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    optionChipActive: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.primary,
    },
    optionChipText: {
      fontSize: 13,
      color: colors.foreground,
    },
    optionChipTextActive: {
      color: colors.primary,
      fontWeight: '600',
    },
    compactToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginTop: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    compactToggleActive: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.primary,
    },
    compactToggleContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    compactToggleTitle: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.foreground,
    },
    compactToggleDescription: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    resetButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      margin: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.destructiveLight,
    },
    resetButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.destructive,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    bottomSheet: {
      flex: 1,
      backgroundColor: colors.card,
    },
    sheetHandle: {
      width: 40,
      height: 4,
      backgroundColor: colors.muted,
      borderRadius: 2,
      alignSelf: 'center',
      marginTop: spacing.md,
      marginBottom: spacing.md,
    },
    sheetTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.foreground,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.md,
    },
    presetList: {
      paddingHorizontal: spacing.lg,
    },
    presetItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.md,
    },
    presetItemActive: {
      backgroundColor: colors.primaryLight,
      marginHorizontal: -spacing.lg,
      paddingHorizontal: spacing.lg,
    },
    presetItemInfo: {
      flex: 1,
    },
    presetItemName: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.foreground,
    },
    presetItemDesc: {
      fontSize: 13,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    cancelButton: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: 16,
      color: colors.mutedForeground,
    },
  });

export default AdvancedThemeControls;
