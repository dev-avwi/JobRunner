import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Platform,
} from 'react-native';
import { PressableRow } from './PressableRow';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme, ThemeColors } from '../../lib/theme';

interface TimePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  label?: string;
  disabled?: boolean;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    label: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.foreground,
      marginBottom: 8,
    },
    timeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 14,
      gap: 12,
    },
    disabledButton: {
      opacity: 0.5,
    },
    timeButtonText: {
      flex: 1,
      fontSize: 16,
      color: colors.foreground,
    },
    disabledText: {
      color: colors.mutedForeground,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    pickerContainer: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingBottom: 34,
    },
    pickerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    pickerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.foreground,
    },
  });
}

export function TimePicker({ value, onChange, label, disabled }: TimePickerProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState(value);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-AU', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handleConfirm = () => {
    onChange(tempDate);
    setShowPicker(false);
  };

  const handleOpen = () => {
    setTempDate(value);
    setShowPicker(true);
  };

  return (
    <View>
      {label && <Text style={styles.label}>{label}</Text>}
      <PressableRow style={[styles.timeButton, disabled && styles.disabledButton]} onPress={() => !disabled && handleOpen()} disabled={disabled} >
        <Feather name="clock" size={20} color={disabled ? colors.mutedForeground : colors.primary} />
        <Text style={[styles.timeButtonText, disabled && styles.disabledText]}>
          {formatTime(value)}
        </Text>
        <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
      </PressableRow>

      {/* Android: use the platform-native clock dialog (its own modal window).
          A custom modal with display="spinner" looks foreign on Android and
          themeVariant is iOS-only. The dialog commits/dismisses in one step,
          so we apply the change directly in onChange. MUST clear showPicker in
          onChange or the dialog re-opens forever (native dialog gotcha). */}
      {Platform.OS === 'android' && showPicker && (
        <DateTimePicker
          value={tempDate}
          mode="time"
          display="default"
          minuteInterval={5}
          onChange={(event, selectedDate) => {
            setShowPicker(false);
            if (event.type !== 'dismissed' && selectedDate) {
              onChange(selectedDate);
            }
          }}
        />
      )}

      {/* iOS: inline spinner in a bottom-sheet style modal with explicit
          Cancel/Done, matching native iOS picker conventions. */}
      {Platform.OS === 'ios' && (
        <Modal
          onRequestClose={() => setShowPicker(false)} visible={showPicker} transparent animationType="slide">
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowPicker(false)}
          >
            <View style={styles.pickerContainer}>
              <View style={styles.pickerHeader}>
                <PressableRow onPress={() => setShowPicker(false)}>
                  <Text style={{ fontSize: 16, color: colors.mutedForeground }}>Cancel</Text>
                </PressableRow>
                <Text style={styles.pickerTitle}>Select Time</Text>
                <PressableRow onPress={handleConfirm}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: colors.primary }}>Done</Text>
                </PressableRow>
              </View>

              <DateTimePicker
                value={tempDate}
                mode="time"
                display="spinner"
                minuteInterval={5}
                onChange={(event, selectedDate) => {
                  if (selectedDate) {
                    setTempDate(selectedDate);
                  }
                }}
                themeVariant={isDark ? 'dark' : 'light'}
                style={{ height: 200 }}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

export default TimePicker;
