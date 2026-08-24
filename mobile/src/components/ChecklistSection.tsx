import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../lib/theme';
import { api } from '../lib/api';
import { showToast } from '../lib/toast';
import { fontWeights, spacing, radius, typography } from '../lib/design-tokens';

const ROW_HEIGHT = 48;
const SPRING_CONFIG = { damping: 20, stiffness: 200, mass: 0.5 };

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

// ─── Single draggable row ────────────────────────────────────────────────────

interface DraggableRowProps {
  item: ChecklistItem;
  index: number;
  total: number;
  activeIndex: SharedValue<number>;
  dragY: SharedValue<number>;
  colors: ReturnType<typeof import('../lib/theme').useTheme>['colors'];
  onToggle: (item: ChecklistItem) => void;
  onRemove: (item: ChecklistItem) => void;
  onDragEnd: (fromIndex: number, toIndex: number) => void;
  readOnly: boolean;
}

function DraggableRow({
  item,
  index,
  total,
  activeIndex,
  dragY,
  colors,
  onToggle,
  onRemove,
  onDragEnd,
  readOnly,
}: DraggableRowProps) {
  const done = item.isCompleted;
  const startY = useSharedValue(0);
  const isActive = useSharedValue(false);

  // Compute the target index from the current drag Y position
  const computeTarget = (fromIndex: number, dy: number): number => {
    'worklet';
    const rawTarget = fromIndex + Math.round(dy / ROW_HEIGHT);
    return Math.max(0, Math.min(total - 1, rawTarget));
  };

  const panGesture = Gesture.Pan()
    .activateAfterLongPress(300)
    .onStart(() => {
      startY.value = 0;
      isActive.value = true;
      activeIndex.value = index;
      dragY.value = 0;
    })
    .onUpdate((e) => {
      dragY.value = e.translationY;
    })
    .onEnd(() => {
      const toIndex = computeTarget(index, dragY.value);
      isActive.value = false;
      activeIndex.value = -1;
      dragY.value = 0;
      if (toIndex !== index) {
        runOnJS(onDragEnd)(index, toIndex);
      }
    })
    .onFinalize(() => {
      if (isActive.value) {
        isActive.value = false;
        activeIndex.value = -1;
        dragY.value = 0;
      }
    });

  // Animate this row's translateY:
  // - If this row IS the active one, it follows the drag
  // - Other rows shift to make room
  const animStyle = useAnimatedStyle(() => {
    const active = activeIndex.value;
    if (active === -1) {
      return { translateY: 0, zIndex: 0, shadowOpacity: 0, elevation: 0, opacity: 1 };
    }

    if (active === index) {
      // This is the dragged item — follow the finger
      return {
        translateY: dragY.value,
        zIndex: 100,
        shadowOpacity: 0.25,
        elevation: 8,
        opacity: 0.95,
      };
    }

    // Compute where the active item currently hovers
    const hoverIndex = Math.max(
      0,
      Math.min(total - 1, Math.round(active + dragY.value / ROW_HEIGHT))
    );

    let shift = 0;
    if (active < index && hoverIndex >= index) {
      shift = -ROW_HEIGHT; // displaced up
    } else if (active > index && hoverIndex <= index) {
      shift = ROW_HEIGHT; // displaced down
    }

    return {
      translateY: withSpring(shift, SPRING_CONFIG),
      zIndex: 0,
      shadowOpacity: 0,
      elevation: 0,
      opacity: 1,
    };
  });

  return (
    <Animated.View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          height: ROW_HEIGHT,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          backgroundColor: colors.background,
          gap: spacing.sm,
        },
        animStyle,
      ]}
    >
      {/* Drag handle — only shown in edit mode */}
      {!readOnly && (
        <GestureDetector gesture={panGesture}>
          <View
            style={{
              padding: 8,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Feather name="menu" size={16} color={colors.mutedForeground} />
          </View>
        </GestureDetector>
      )}

      {/* Checkbox */}
      <TouchableOpacity
        onPress={() => !readOnly && onToggle(item)}
        disabled={readOnly}
        style={[
          {
            width: 22,
            height: 22,
            borderRadius: 6,
            borderWidth: 1.5,
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            borderColor: done ? colors.success : colors.border,
            backgroundColor: done ? colors.success : 'transparent',
          },
        ]}
        hitSlop={8}
      >
        {done && <Feather name="check" size={13} color={colors.primaryForeground} />}
      </TouchableOpacity>

      {/* Label */}
      <Text
        style={{
          flex: 1,
          fontSize: typography.sizes.sm,
          color: done ? colors.mutedForeground : colors.foreground,
          lineHeight: 20,
          textDecorationLine: done ? 'line-through' : 'none',
        }}
        numberOfLines={2}
      >
        {item.text}
      </Text>

      {/* Delete */}
      {!readOnly && (
        <TouchableOpacity
          onPress={() => onRemove(item)}
          hitSlop={8}
          style={{ padding: 4 }}
        >
          <Feather name="trash-2" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// ─── ChecklistSection ────────────────────────────────────────────────────────

export function ChecklistSection({ jobId, readOnly, onCountsChange }: ChecklistSectionProps) {
  const { colors } = useTheme();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newText, setNewText] = useState('');
  const [adding, setAdding] = useState(false);

  // Shared values for drag state — one pair shared across all rows
  const activeIndex = useSharedValue(-1);
  const dragY = useSharedValue(0);

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

  // Keep a stable ref so we can call the latest callback without it being
  // a useEffect dependency — an inline arrow prop changes reference on every
  // parent re-render, which would cause an infinite setState → re-render loop.
  const onCountsChangeRef = useRef(onCountsChange);
  onCountsChangeRef.current = onCountsChange;

  useEffect(() => {
    if (onCountsChangeRef.current) {
      const completed = items.filter((i) => i.isCompleted).length;
      onCountsChangeRef.current(completed, items.length);
    }
  }, [items]); // deliberately omit onCountsChange — use ref above instead

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

  // Called from the worklet thread via runOnJS when a drag ends
  const handleDragEnd = useCallback(
    async (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;

      // Reorder the local array
      const next = [...items];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);

      // Assign sequential sortOrder values
      const reordered = next.map((item, idx) => ({ ...item, sortOrder: idx }));
      setItems(reordered);

      // Find items whose sortOrder actually changed and persist them
      const toUpdate = reordered.filter((item) => {
        const original = items.find((o) => o.id === item.id);
        return original && original.sortOrder !== item.sortOrder;
      });

      if (toUpdate.length === 0) return;

      const results = await Promise.all(
        toUpdate.map((item) =>
          api.patch(`/api/checklist/${item.id}`, { sortOrder: item.sortOrder })
        )
      );

      if (results.some((r) => r.error)) {
        showToast({ type: 'error', message: 'Could not save new order' });
        load();
      }
    },
    [items, load]
  );

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
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.md,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Feather name="check-square" size={18} color={colors.foreground} />
          <Text
            style={{
              fontSize: typography.sizes.md,
              fontWeight: fontWeights.semibold,
              color: colors.foreground,
            }}
          >
            Checklist
          </Text>
        </View>
        <View
          style={{
            backgroundColor: colors.muted,
            paddingHorizontal: spacing.sm,
            paddingVertical: 2,
            borderRadius: radius.sm,
          }}
        >
          <Text
            style={{
              fontSize: typography.sizes.sm,
              color: colors.mutedForeground,
              fontWeight: fontWeights.semibold,
            }}
          >
            {badgeLabel}
          </Text>
        </View>
      </View>

      {items.length === 0 && (
        <Text
          style={{
            fontSize: typography.sizes.sm,
            color: colors.mutedForeground,
            textAlign: 'center',
            paddingVertical: spacing.lg,
          }}
        >
          {readOnly ? 'No checklist items.' : 'Add your first checklist item below.'}
        </Text>
      )}

      {/* Draggable item list */}
      <View style={{ overflow: 'hidden' }}>
        {items.map((item, index) => (
          <DraggableRow
            key={item.id}
            item={item}
            index={index}
            total={items.length}
            activeIndex={activeIndex}
            dragY={dragY}
            colors={colors}
            onToggle={toggle}
            onRemove={remove}
            onDragEnd={handleDragEnd}
            readOnly={readOnly ?? false}
          />
        ))}
      </View>

      {!readOnly && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            marginTop: spacing.md,
          }}
        >
          <TextInput
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              color: colors.foreground,
              fontSize: typography.sizes.sm,
              backgroundColor: colors.background,
            }}
            value={newText}
            onChangeText={setNewText}
            placeholder="Add a checklist item"
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="done"
            onSubmitEditing={add}
          />
          <TouchableOpacity
            style={[
              {
                width: 44,
                height: 44,
                borderRadius: radius.md,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              },
              (!newText.trim() || adding) && { opacity: 0.5 },
            ]}
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
