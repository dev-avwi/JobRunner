import { createContext, useCallback, useContext, useMemo, useRef, useState, ReactNode } from 'react';
import { View, Text, Pressable, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
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
  const { width: windowWidth } = useWindowDimensions();
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

  // Even-spread grid sizing — DETERMINISTIC pixel widths only. On-device
  // diagnostics proved the grid CONTAINER already spans the full content box
  // (windowWidth - spacing.lg*2), yet the cards still bunched left. The reason:
  // inside AppBottomSheet's ScrollView content container, `flex:1` (flex-basis
  // 0%) does NOT distribute across the row (same collapse as percentage widths)
  // — the cards stay content-sized and pack to flex-start. The fix that holds:
  //   - explicit CONTAINER width = windowWidth - spacing.lg*2 (the real box);
  //   - explicit ITEM width = that / columns (NOT flex, NOT %);
  //   - styles.grid uses justifyContent:'space-between' (NO flexWrap) so the
  //     columns reach both edges even if rounding leaves a pixel of slack.
  // Do NOT switch the items back to flex:1 / '%' — it silently bunches here.
  const gridColumns = Math.min(Math.max(primaryActions.length, 1), 4);
  const gridInnerWidth = Math.max(0, windowWidth - spacing.lg * 2);
  const gridItemWidth = gridInnerWidth / gridColumns;

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
          <View style={[styles.grid, { width: gridInnerWidth }]}>
            {primaryActions.map((action, idx) => {
              const isDestructive = action.style === 'destructive';
              const tint = isDestructive ? colors.destructive : colors.primary;
              const labelColor = isDestructive ? colors.destructive : colors.foreground;
              return (
                <Pressable
                  key={`${action.label}-${idx}`}
                  onPress={() => onActionPress(action)}
                  style={({ pressed }) => [
                    styles.gridItem,
                    { width: gridItemWidth },
                    pressed && { opacity: 0.55 },
                  ]}
                >
                  {action.icon ? (
                    <View style={styles.gridIconWrap}>
                      <View style={[styles.gridIconChip, { backgroundColor: `${tint}1A` }]}>
                        <Feather name={action.icon} size={26} color={tint} />
                      </View>
                    </View>
                  ) : null}
                  <Text
                    style={[styles.gridLabel, { color: labelColor }]}
                    numberOfLines={2}
                  >
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  gridItem: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: spacing.sm,
    // RN flex items default to minWidth:auto (= min-content), which lets a card
    // with a wide label (e.g. "Attach File (PDF)") grow past its computed column
    // width. That makes the three columns unequal, so space-between spaces the
    // icon CENTERS unevenly (middle icon drifts left). minWidth:0 forces every
    // cell to honor its equal `width: gridItemWidth`, so the icons sit on a true
    // even grid and long labels wrap within their cell instead of stretching it.
    minWidth: 0,
  },
  gridIconWrap: {
    alignSelf: 'stretch',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  gridIconChip: {
    width: 60,
    height: 60,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridLabel: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
    textAlign: 'center',
    alignSelf: 'stretch',
    paddingHorizontal: spacing.xs,
  },
});

export default ActionSheetProvider;
