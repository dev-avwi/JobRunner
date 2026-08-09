import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  TextInput,
  ScrollView,
  Dimensions,
} from 'react-native';
import { PressableRow } from './PressableRow';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../lib/colors';

const PRESET_COLORS = [
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Purple', hex: '#8b5cf6' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Red', hex: '#ef4444' },
  { name: 'Orange', hex: '#E8862E' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Yellow', hex: '#eab308' },
  { name: 'Lime', hex: '#84cc16' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Blue', hex: '#2563EB' },
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Sky', hex: '#0ea5e9' },
  { name: 'Slate', hex: '#64748b' },
  { name: 'Gray', hex: '#6b7280' },
  { name: 'Zinc', hex: '#71717a' },
  { name: 'Stone', hex: '#78716c' },
  { name: 'Navy', hex: '#1e3a5f' },
  { name: 'Forest', hex: '#166534' },
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
}

export function ColorPicker({ value, onChange, label }: ColorPickerProps) {
  const [showModal, setShowModal] = useState(false);
  const [customHex, setCustomHex] = useState(value || '#3b82f6');
  const [selectedColor, setSelectedColor] = useState(value || '#3b82f6');

  const handlePresetSelect = (hex: string) => {
    setSelectedColor(hex);
    setCustomHex(hex);
  };

  const handleCustomHexChange = (text: string) => {
    let formatted = text.toUpperCase();
    if (!formatted.startsWith('#')) {
      formatted = '#' + formatted;
    }
    formatted = formatted.slice(0, 7);
    formatted = '#' + formatted.slice(1).replace(/[^0-9A-F]/g, '');
    setCustomHex(formatted);
    
    if (/^#[0-9A-F]{6}$/i.test(formatted)) {
      setSelectedColor(formatted);
    }
  };

  const handleConfirm = () => {
    if (/^#[0-9A-F]{6}$/i.test(selectedColor)) {
      onChange(selectedColor);
      setShowModal(false);
    }
  };

  const isValidColor = /^#[0-9A-F]{6}$/i.test(selectedColor);

  return (
    <>
      <PressableRow style={styles.trigger} onPress={() => setShowModal(true)} >
        <View style={styles.triggerContent}>
          <View style={[styles.colorSwatch, { backgroundColor: value || colors.primary }]} />
          <View style={styles.triggerText}>
            <Text style={styles.triggerLabel}>{label || 'Brand Color'}</Text>
            <Text style={styles.triggerValue}>{value?.toUpperCase() || '#3B82F6'}</Text>
          </View>
        </View>
        <Feather name="sliders" size={20} color={colors.mutedForeground} />
      </PressableRow>

      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <PressableRow onPress={() => setShowModal(false)} style={styles.closeButton}>
              <Feather name="x" size={24} color={colors.foreground} />
            </PressableRow>
            <Text style={styles.modalTitle}>Choose Brand Color</Text>
            <PressableRow onPress={handleConfirm} style={[styles.doneButton, !isValidColor && styles.doneButtonDisabled]} disabled={!isValidColor} >
              <Text style={[styles.doneButtonText, !isValidColor && styles.doneButtonTextDisabled]}>
                Done
              </Text>
            </PressableRow>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.previewSection}>
              <View style={[styles.previewSwatch, { backgroundColor: selectedColor }]}>
                <Feather name="check" size={32} color={colors.white} />
              </View>
              <Text style={styles.previewHex}>{selectedColor.toUpperCase()}</Text>
            </View>

            <View style={styles.customSection}>
              <Text style={styles.sectionLabel}>Custom Hex Color</Text>
              <TextInput
                style={styles.hexInput}
                value={customHex}
                onChangeText={handleCustomHexChange}
                placeholder="#3B82F6"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="characters"
                maxLength={7}
              />
            </View>

            <View style={styles.presetsSection}>
              <Text style={styles.sectionLabel}>Preset Colors</Text>
              <View style={styles.presetsGrid}>
                {PRESET_COLORS.map((color) => (
                  <PressableRow key={color.hex} style={[ styles.presetItem, { backgroundColor: color.hex }, selectedColor.toLowerCase() === color.hex.toLowerCase() && styles.presetItemSelected, ]} onPress={() => handlePresetSelect(color.hex)} >
                    {selectedColor.toLowerCase() === color.hex.toLowerCase() && (
                      <Feather name="check" size={20} color={colors.white} />
                    )}
                  </PressableRow>
                ))}
              </View>
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.infoText}>
                Your brand color will be applied to buttons, accents, and other UI elements 
                throughout the app to match your business identity.
              </Text>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const { width } = Dimensions.get('window');
const SWATCH_SIZE = (width - 64 - 32) / 5;

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  triggerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  colorSwatch: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.foreground,
  },
  doneButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  doneButtonDisabled: {
    opacity: 0.5,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  doneButtonTextDisabled: {
    color: colors.mutedForeground,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  previewSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  previewSwatch: {
    width: 100,
    height: 100,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  previewHex: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
    marginTop: 12,
  },
  customSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  hexInput: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
    fontFamily: 'monospace',
  },
  presetsSection: {
    marginBottom: 24,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetItem: {
    width: SWATCH_SIZE,
    height: SWATCH_SIZE,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetItemSelected: {
    borderWidth: 3,
    borderColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  infoSection: {
    backgroundColor: colors.muted,
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
  },
  infoText: {
    fontSize: 13,
    color: colors.mutedForeground,
    lineHeight: 20,
    textAlign: 'center',
  },
});
