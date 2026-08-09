import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { PressableRow } from './PressableRow';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../lib/theme';

interface DatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  label?: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    label: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.foreground,
      marginBottom: 8,
    },
    dateButton: {
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
    dateButtonText: {
      fontSize: 16,
      color: colors.foreground,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    pickerContainer: {
      backgroundColor: colors.background,
      borderRadius: 16,
      width: '100%',
      maxWidth: 360,
      padding: 16,
    },
    pickerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    pickerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.foreground,
    },
    monthHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    monthButton: {
      padding: 8,
    },
    monthTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.foreground,
    },
    daysHeader: {
      flexDirection: 'row',
      marginBottom: 8,
    },
    dayHeaderCell: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 8,
    },
    dayHeaderText: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.mutedForeground,
    },
    calendarGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    dayCell: {
      width: '14.28%',
      aspectRatio: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    dayText: {
      fontSize: 14,
      color: colors.foreground,
    },
    selectedDay: {
      backgroundColor: colors.primary,
      borderRadius: 20,
    },
    selectedDayText: {
      color: colors.primaryForeground || colors.white,
      fontWeight: '600',
    },
    todayDay: {
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 20,
    },
    todayDayText: {
      color: colors.primary,
      fontWeight: '500',
    },
    disabledDay: {
      opacity: 0.3,
    },
    disabledDayText: {
      color: colors.mutedForeground,
    },
    pickerFooter: {
      marginTop: 16,
      alignItems: 'center',
    },
    todayButton: {
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    todayButtonText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '500',
    },
  });
}

export function DatePicker({ value, onChange, minimumDate, label }: DatePickerProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [showPicker, setShowPicker] = useState(false);
  const [viewMonth, setViewMonth] = useState(value.getMonth());
  const [viewYear, setViewYear] = useState(value.getFullYear());

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleSelectDate = (day: number) => {
    const newDate = new Date(viewYear, viewMonth, day);
    if (minimumDate && newDate < minimumDate) {
      return;
    }
    onChange(newDate);
    setShowPicker(false);
  };

  const isDateDisabled = (day: number) => {
    if (!minimumDate) return false;
    const date = new Date(viewYear, viewMonth, day);
    return date < minimumDate;
  };

  const isSelectedDate = (day: number) => {
    return (
      value.getDate() === day &&
      value.getMonth() === viewMonth &&
      value.getFullYear() === viewYear
    );
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      today.getDate() === day &&
      today.getMonth() === viewMonth &&
      today.getFullYear() === viewYear
    );
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(viewMonth, viewYear);
    const firstDay = getFirstDayOfMonth(viewMonth, viewYear);
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.dayCell} />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const disabled = isDateDisabled(day);
      const selected = isSelectedDate(day);
      const today = isToday(day);

      days.push(
        <PressableRow key={day} style={[ styles.dayCell, selected && styles.selectedDay, today && !selected && styles.todayDay, disabled && styles.disabledDay, ]} onPress={() => !disabled && handleSelectDate(day)} disabled={disabled} >
          <Text
            style={[
              styles.dayText,
              selected && styles.selectedDayText,
              today && !selected && styles.todayDayText,
              disabled && styles.disabledDayText,
            ]}
          >
            {day}
          </Text>
        </PressableRow>
      );
    }

    return days;
  };

  return (
    <View>
      {label && <Text style={styles.label}>{label}</Text>}
      <PressableRow style={styles.dateButton} onPress={() => setShowPicker(true)} >
        <Feather name="calendar" size={20} color={colors.primary} />
        <Text style={styles.dateButtonText}>{formatDate(value)}</Text>
      </PressableRow>

      <Modal
      onRequestClose={() => setShowPicker(false)} visible={showPicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Date</Text>
              <PressableRow onPress={() => setShowPicker(false)}>
                <Feather name="x" size={24} color={colors.foreground} />
              </PressableRow>
            </View>

            <View style={styles.monthHeader}>
              <PressableRow onPress={handlePrevMonth} style={styles.monthButton}>
                <Feather name="chevron-left" size={24} color={colors.foreground} />
              </PressableRow>
              <Text style={styles.monthTitle}>
                {MONTHS[viewMonth]} {viewYear}
              </Text>
              <PressableRow onPress={handleNextMonth} style={styles.monthButton}>
                <Feather name="chevron-right" size={24} color={colors.foreground} />
              </PressableRow>
            </View>

            <View style={styles.daysHeader}>
              {DAYS.map((day) => (
                <View key={day} style={styles.dayHeaderCell}>
                  <Text style={styles.dayHeaderText}>{day}</Text>
                </View>
              ))}
            </View>

            <View style={styles.calendarGrid}>{renderCalendar()}</View>

            <View style={styles.pickerFooter}>
              <PressableRow style={styles.todayButton} onPress={() => { const today = new Date(); setViewMonth(today.getMonth()); setViewYear(today.getFullYear()); }} >
                <Text style={styles.todayButtonText}>Go to Today</Text>
              </PressableRow>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default DatePicker;
