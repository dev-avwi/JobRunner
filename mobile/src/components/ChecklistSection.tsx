import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../lib/theme';
import { api } from '../lib/api';
import { showToast } from '../lib/toast';
import { fontWeights, spacing, radius, typography } from '../lib/design-tokens';

interface ChecklistItem {
  id: string;
  jobId: string;
  text: string;
  isCompleted: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface ChecklistSectionProps {
  jobId: string;
  readOnly?: boolean;
  onCountsChange?: (completed: number, total: number) => void;
}

export function ChecklistSection({ jobId, readOnly, onCountsChange }: ChecklistSectionProps) {
  const { colors } = useTheme();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newText, setNewText] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const res = await api.get<ChecklistItem[]>(`/api/jobs/${jobId}/checklist`);
    if (!res.error && Array.isArray(res.data)) {
      const sorted = [...res.data].sort((a, b) => a.sortOrder - b.sortOrder);
      setItems(sorted);
    }
    setLoading(false);
  }, [jobId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Notify parent of counts whenever items change
  useEffect(() => {
    if (onCountsChange) {
      const completed = items.filter((i) => i.isCompleted).length;
      onCountsChange(completed, items.length);
    }
  }, [items, onCountsChange]);

  const toggle = async (item: ChecklistItem) => {
    const next = !item.isCompleted;
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, isCompleted: next } : i))
    );
    const res = await api.patch(`/api/checklist/${item.id}`, { isCompleted: next });
    if (res.error) {
      showToast({ type: 'error', message: 'Could not update item' });
      load();
    }
  };

  const remove = async (item: ChecklistItem) => {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    const res = await api.delete(`/api/checklist/${item.id}`);
    if (res.error) {
      showToast({ type: 'error', message: 'Could not delete item' });
      load();
    }
  };

  const add = async () => {
    const text = newText.trim();
    if (!text) return;
    setAdding(true);
    const maxOrder = items.length > 0 ? Math.max(...items.map((i) => i.sortOrder)) : -1;
    const res = await api.post<ChecklistItem>(`/api/jobs/${jobId}/checklist`, {
      text,
      sortOrder: maxOrder + 1,
    });
    setAdding(false);
    if (res.error) {
      showToast({ type: 'error', message: 'Could not add item' });
      return;
    }
    setNewText('');
    load();
  };

  const moveItem = async (index: number, direction: 'up' | 'down') => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= items.length) return;

    const next = [...items];
    // Swap sort orders
    const tempOrder = next[index].sortOrder;
    next[index] = { ...next[index], sortOrder: next[swapIndex].sortOrder };
    next[swapIndex] = { ...next[swapIndex], sortOrder: tempOrder };
    // Swap positions in array
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    setItems(next);

    // Persist both changes
    await Promise.all([
      api.patch(`/api/checklist/${next[index].id}`, { sortOrder: next[index].sortOrder }),
      api.patch(`/api/checklist/${next[swapIndex].id}`, { sortOrder: next[swapIndex].sortOrder }),
    ]);
  };

  const styles = StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    title: {
      fontSize: typography.sizes.md,
      fontWeight: fontWeights.semibold,
      color: colors.foreground,
    },
    badge: {
      backgroundColor: colors.muted,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.sm,
    },
    badgeText: {
      fontSize: typography.sizes.sm,
      color: colors.mutedForeground,
      fontWeight: fontWeights.semibold,
    },
    emptyText: {
      fontSize: typography.sizes.sm,
      color: colors.mutedForeground,
      textAlign: 'center',
      paddingVertical: spacing.lg,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    check: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    itemText: {
      flex: 1,
      fontSize: typography.sizes.sm,
      color: colors.foreground,
      lineHeight: 20,
    },
    itemTextDone: {
      textDecorationLine: 'line-through',
      color: colors.mutedForeground,
    },
    reorderBtn: {
      padding: 4,
    },
    deleteBtn: {
      padding: 4,
    },
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: colors.foreground,
      fontSize: typography.sizes.sm,
      backgroundColor: colors.background,
    },
    addBtn: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addBtnDisabled: {
      opacity: 0.5,
    },
  });

  if (loading) {
    return (
      <View style={{ paddingVertical: spacing.lg, alignItems: 'center' }}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  const completedCount = items.filter((i) => i.isCompleted).length;
  const totalCount = items.length;
  const badgeLabel = totalCount > 0 ? `${completedCount}/${totalCount} done` : 'No items';

  return (
    <View>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Feather name="check-square" size={18} color={colors.foreground} />
          <Text style={styles.title}>Checklist</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeLabel}</Text>
        </View>
      </View>

      {items.length === 0 && (
        <Text style={styles.emptyText}>
          {readOnly ? 'No checklist items.' : 'Add your first checklist item below.'}
        </Text>
      )}

      {items.map((item, index) => {
        const done = item.isCompleted;
        return (
          <View key={item.id} style={styles.row}>
            <TouchableOpacity
              onPress={() => !readOnly && toggle(item)}
              disabled={readOnly}
              style={[
                styles.check,
                {
                  borderColor: done ? colors.success : colors.border,
                  backgroundColor: done ? colors.success : 'transparent',
                },
              ]}
              hitSlop={8}
            >
              {done && <Feather name="check" size={13} color={colors.primaryForeground} />}
            </TouchableOpacity>

            <Text style={[styles.itemText, done && styles.itemTextDone]}>{item.text}</Text>

            {!readOnly && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <TouchableOpacity
                  style={styles.reorderBtn}
                  onPress={() => moveItem(index, 'up')}
                  disabled={index === 0}
                  hitSlop={6}
                >
                  <Feather
                    name="chevron-up"
                    size={16}
                    color={index === 0 ? colors.border : colors.mutedForeground}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.reorderBtn}
                  onPress={() => moveItem(index, 'down')}
                  disabled={index === items.length - 1}
                  hitSlop={6}
                >
                  <Feather
                    name="chevron-down"
                    size={16}
                    color={index === items.length - 1 ? colors.border : colors.mutedForeground}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => remove(item)}
                  hitSlop={8}
                >
                  <Feather name="trash-2" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}

      {!readOnly && (
        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            value={newText}
            onChangeText={setNewText}
            placeholder="Add a checklist item"
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="done"
            onSubmitEditing={add}
          />
          <TouchableOpacity
            style={[styles.addBtn, (!newText.trim() || adding) && styles.addBtnDisabled]}
            onPress={add}
            disabled={adding || !newText.trim()}
          >
            {adding ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Feather name="plus" size={20} color={colors.primaryForeground} />
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
