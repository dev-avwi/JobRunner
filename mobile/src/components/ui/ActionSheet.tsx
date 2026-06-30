import { createContext, useCallback, useContext, useMemo, useRef, useState, ReactNode } from 'react';
import { View, Text, Pressable, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../lib/theme';
import { radius, spacing, shadows, typography } from '../../lib/design-tokens';
import AppBottomSheet, { AppBottomSheetRef } from './AppBottomSheet';

export interface ActionSheetAction {
  label: string;
  /** Optional secondary line shown under the label (premium card layout). */
  description?: string;
  onPress?: () => void;
  icon?: keyof typeof Feather.glyphMap;
  style?: 'default' | 'destructive' | 'cancel';
}

export interface ActionSheetOptions {
  title?: string;
  message?: string;
  actions: ActionSheetAction[];
  /**
   * 'list'  — full-width stacked cards (icon left, chevron right). Best for
   *           longer menus or items with descriptions. Default.
   * 'grid'  — equal-width cards laid out horizontally (icon on top, label
   *           below, centered). Best for a small set (2-4) of short sources.
   */
  layout?: 'list' | 'grid';
}

interface ActionSheetContextType {
  show: (options: ActionSheetOptions) => void;
}

const ActionSheetContext = createContext<ActionSheetContextType | null>(null);

export function ActionSheetProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ActionSheetOptions | null>(null);
  const [visible, setVisible] = useState(false);
  const [gridWidth, setGridWidth] = useState(0);
  const sheetRef = useRef<AppBottomSheetRef>(null);
  const { colors } = useTheme();

  const show = useCallback((options: ActionSheetOptions) => {
    setOpts(options);
    setVisible(true);
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
  }, []);

  const onActionPress = useCallback(
    (action: ActionSheetAction) => {
      Haptics.selectionAsync().catch(() => {});
      setVisible(false);
      // Defer the side-effect until AFTER the sheet's Modal has fully
      // unmounted. AppBottomSheet's close runs ~220ms with a 280ms safety
      // unmount; firing too early meant a follow-up native modal (document
      // picker) or Alert tried to present WHILE this sheet's Modal was still
      // up — iOS silently refuses, so the row appeared to "do nothing".
      if (action.style !== 'cancel') {
        setTimeout(() => action.onPress?.(), 320);
      }
    },
    []
  );

  const primaryActions = useMemo(
    () => (opts?.actions ?? []).filter((a) => a.style !== 'cancel'),
    [opts]
  );
  const cancelAction = useMemo(
    () => (opts?.actions ?? []).find((a) => a.style === 'cancel'),
    [opts]
  );
  const layout = opts?.layout ?? 'list';

  return (
    <ActionSheetContext.Provider value={{ show }}>
      {children}
      <AppBottomSheet
        ref={sheetRef}
        visible={visible}
        onDismiss={dismiss}
        scrollable={false}
        title={opts?.title}
        showCloseButton
        footer={
          cancelAction ? (
            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: colors.border }]}
              onPress={() => onActionPress(cancelAction)}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.foreground }}>
                {cancelAction.label}
              </Text>
            </TouchableOpacity>
          ) : undefined
        }
      >
        {opts?.message ? (
          <Text style={[typography.caption, styles.message, { color: colors.mutedForeground }]}>
            {opts.message}
          </Text>
        ) : null}

        {primaryActions.length === 0 ? (
          !cancelAction ? (
            <Text style={[typography.body, { color: colors.mutedForeground, paddingVertical: spacing.md }]}>
              No actions available
            </Text>
          ) : null
        ) : layout === 'grid' ? (
          <View
            style={styles.grid}
            onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}
          >
            {primaryActions.map((action, idx) => {
              const isDestructive = action.style === 'destructive';
              const tint = isDestructive ? colors.destructive : colors.primary;
              const labelColor = isDestructive ? colors.destructive : colors.foreground;
              const perRow = Math.min(primaryActions.length, 4);
              // Pixel widths from the measured grid width — percentage widths
              // are unreliable inside AppBottomSheet's vertical ScrollView
              // content container, which is why the items bunched/collapsed.
              const itemWidth =
                gridWidth > 0 ? Math.floor(gridWidth / perRow) : undefined;
              return (
                <Pressable
                  key={`${action.label}-${idx}`}
                  onPress={() => onActionPress(action)}
                  style={({ pressed }) => [
                    styles.gridItem,
                    itemWidth ? { width: itemWidth } : { width: `${100 / perRow}%` as const },
                    pressed && { opacity: 0.55 },
                  ]}
                >
                  {action.icon ? (
                    <View style={[styles.gridIconChip, { backgroundColor: `${tint}1A` }]}>
                      <Feather name={action.icon} size={26} color={tint} />
                    </View>
                  ) : null}
                  <Text style={[styles.gridLabel, { color: labelColor }]} numberOfLines={2}>
                    {action.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          primaryActions.map((action, idx) => {
            const isDestructive = action.style === 'destructive';
            const tint = isDestructive ? colors.destructive : colors.primary;
            const labelColor = isDestructive ? colors.destructive : colors.foreground;
            const isLast = idx === primaryActions.length - 1;
            return (
              <Pressable
                key={`${action.label}-${idx}`}
                onPress={() => onActionPress(action)}
                style={({ pressed }) => [
                  styles.card,
                  { backgroundColor: colors.card, borderColor: colors.cardBorder },
                  !isLast && { marginBottom: spacing.sm },
                  pressed && { backgroundColor: colors.muted },
                ]}
              >
                {action.icon ? (
                  <View style={[styles.iconChip, { backgroundColor: `${tint}1A` }]}>
                    <Feather name={action.icon} size={22} color={tint} />
                  </View>
                ) : null}
                <View style={styles.content}>
                  <Text style={[styles.value, { color: labelColor }]} numberOfLines={1}>
                    {action.label}
                  </Text>
                  {action.description ? (
                    <Text style={[styles.desc, { color: colors.mutedForeground }]} numberOfLines={2}>
                      {action.description}
                    </Text>
                  ) : null}
                </View>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </Pressable>
            );
          })
        )}
      </AppBottomSheet>
    </ActionSheetContext.Provider>
  );
}

export function useActionSheet(): ActionSheetContextType['show'] {
  const ctx = useContext(ActionSheetContext);
  if (!ctx) {
    return () => {
      if (__DEV__) console.warn('useActionSheet called outside ActionSheetProvider');
    };
  }
  return ctx.show;
}

const styles = StyleSheet.create({
  message: {
    marginBottom: spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    ...shadows.sm,
  },
  iconChip: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
  },
  desc: {
    fontSize: 13,
    marginTop: 2,
  },
  cancelBtn: {
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    borderWidth: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'stretch',
    width: '100%',
  },
  gridItem: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  gridIconChip: {
    width: 60,
    height: 60,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  gridLabel: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default ActionSheetProvider;
