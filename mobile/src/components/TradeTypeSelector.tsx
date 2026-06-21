import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from './ui/PressableRow';
import { AppBottomSheet } from './ui/AppBottomSheet';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../lib/theme';
import { spacing, radius, typography } from '../lib/design-tokens';

const TRADE_CATEGORIES = {
  'Electrical & Mechanical': ['electrical', 'hvac'],
  'Plumbing & Water': ['plumbing'],
  'Building & Construction': ['building', 'concreting', 'roofing', 'fencing'],
  'Interior & Finishing': ['painting', 'tiling'],
  'Outdoor & Landscaping': ['landscaping', 'grounds_maintenance', 'cleaning'],
  'Specialty Services': ['handyman', 'general'],
};

const TRADE_DISPLAY_NAMES: Record<string, string> = {
  electrical: 'Electrical',
  plumbing: 'Plumbing',
  building: 'Building & Construction',
  landscaping: 'Landscaping',
  painting: 'Painting & Decorating',
  hvac: 'HVAC & Air Conditioning',
  roofing: 'Roofing',
  tiling: 'Tiling',
  concreting: 'Concreting',
  fencing: 'Fencing',
  cleaning: 'Cleaning Services',
  handyman: 'Handyman',
  general: 'General Trades',
  grounds_maintenance: 'Grounds Maintenance',
};

const TRADE_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  electrical: 'zap',
  plumbing: 'droplet',
  building: 'home',
  landscaping: 'sun',
  painting: 'edit-3',
  hvac: 'wind',
  roofing: 'layers',
  tiling: 'grid',
  concreting: 'square',
  fencing: 'align-justify',
  cleaning: 'refresh-cw',
  handyman: 'tool',
  general: 'briefcase',
  grounds_maintenance: 'scissors',
};

interface TradeTypeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  onRequestNewTrade?: (tradeName: string) => void;
}

export function TradeTypeSelector({
  value,
  onChange,
  label = 'Trade Type',
  onRequestNewTrade,
}: TradeTypeSelectorProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [showPicker, setShowPicker] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestTradeName, setRequestTradeName] = useState('');

  const selectedDisplayName = TRADE_DISPLAY_NAMES[value] || value || 'Select Trade Type';
  const selectedIcon = TRADE_ICONS[value] || 'briefcase';

  const handleSelectTrade = (tradeId: string) => {
    onChange(tradeId);
    setShowPicker(false);
  };

  const handleRequestSubmit = () => {
    if (!requestTradeName.trim()) {
      Alert.alert('Required', 'Please enter a trade name');
      return;
    }
    if (onRequestNewTrade) {
      onRequestNewTrade(requestTradeName.trim());
    }
    Alert.alert(
      'Request Submitted',
      `Thanks! We'll review "${requestTradeName}" and add it soon. For now, you can use "General Trades".`,
      [{ text: 'OK', onPress: () => {
        setRequestTradeName('');
        setShowRequestModal(false);
        onChange('general');
        setShowPicker(false);
      }}]
    );
  };

  return (
    <View>
      {label && (
        <View style={styles.labelRow}>
          <Feather name="briefcase" size={14} color={colors.mutedForeground} />
          <Text style={styles.label}>{label}</Text>
        </View>
      )}

      <PressableRow style={styles.selectorButton} onPress={() => setShowPicker(true)} >
        <View style={styles.selectorContent}>
          <View style={[styles.iconContainer, { backgroundColor: colors.primaryLight }]}>
            <Feather name={selectedIcon} size={18} color={colors.primary} />
          </View>
          <Text style={styles.selectorText} numberOfLines={1}>
            {selectedDisplayName}
          </Text>
        </View>
        <Feather name="chevron-down" size={18} color={colors.mutedForeground} />
      </PressableRow>

      <AppBottomSheet
        visible={showPicker}
        onDismiss={() => setShowPicker(false)}
        title="Select Trade Type"
        showCloseButton
        snapPoints={['80%']}
      >
        <View>
              {Object.entries(TRADE_CATEGORIES).map(([category, trades]) => (
                <View key={category} style={styles.categorySection}>
                  <Text style={styles.categoryLabel}>{category}</Text>
                  {trades.map((tradeId) => {
                    const isSelected = value === tradeId;
                    return (
                      <PressableRow key={tradeId} style={[styles.tradeItem, isSelected && styles.tradeItemSelected]} onPress={() => handleSelectTrade(tradeId)} >
                        <View style={[
                          styles.tradeIcon,
                          isSelected && { backgroundColor: colors.primaryLight }
                        ]}>
                          <Feather
                            name={TRADE_ICONS[tradeId] || 'briefcase'}
                            size={16}
                            color={isSelected ? colors.primary : colors.mutedForeground}
                          />
                        </View>
                        <Text style={[
                          styles.tradeName,
                          isSelected && { color: colors.primary, fontWeight: '600' }
                        ]}>
                          {TRADE_DISPLAY_NAMES[tradeId] || tradeId}
                        </Text>
                        {isSelected && (
                          <Feather name="check" size={18} color={colors.primary} />
                        )}
                      </PressableRow>
                    );
                  })}
                </View>
              ))}

              <View style={styles.requestSection}>
                <PressableRow style={styles.requestButton} onPress={() => setShowRequestModal(true)} >
                  <Feather name="plus-circle" size={18} color={colors.primary} />
                  <Text style={styles.requestButtonText}>Request New Trade Type</Text>
                </PressableRow>
              </View>
        </View>
      </AppBottomSheet>

      <Modal
        visible={showRequestModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRequestModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.requestModalContent]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request New Trade</Text>
              <PressableRow style={styles.closeButton} onPress={() => setShowRequestModal(false)} >
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </PressableRow>
            </View>

            <Text style={styles.requestDescription}>
              Don't see your trade? Let us know and we'll add it with custom fields, 
              materials catalog, and rate cards tailored to your industry.
            </Text>

            <TextInput
              style={styles.requestInput}
              placeholder="Enter trade name (e.g., Pool Technician)"
              placeholderTextColor={colors.mutedForeground}
              value={requestTradeName}
              onChangeText={setRequestTradeName}
              autoCapitalize="words"
            />

            <View style={styles.requestActions}>
              <PressableRow style={styles.cancelButton} onPress={() => { setRequestTradeName(''); setShowRequestModal(false); }} >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </PressableRow>
              <PressableRow style={styles.submitButton} onPress={handleRequestSubmit} >
                <Feather name="send" size={16} color={colors.primaryForeground} />
                <Text style={styles.submitButtonText}>Submit Request</Text>
              </PressableRow>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.foreground,
  },
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.foreground,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: spacing['3xl'],
  },
  requestModalContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
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
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
  },
  closeButton: {
    padding: spacing.sm,
  },
  scrollView: {
    paddingHorizontal: spacing.md,
  },
  categorySection: {
    paddingTop: spacing.md,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginLeft: spacing.sm,
  },
  tradeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.md,
  },
  tradeItemSelected: {
    backgroundColor: colors.primaryLight,
  },
  tradeIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tradeName: {
    fontSize: 15,
    color: colors.foreground,
    flex: 1,
  },
  requestSection: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.md,
  },
  requestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
  },
  requestButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  requestDescription: {
    fontSize: 14,
    color: colors.mutedForeground,
    lineHeight: 20,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  requestInput: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
    fontSize: 16,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  requestActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  submitButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
});
