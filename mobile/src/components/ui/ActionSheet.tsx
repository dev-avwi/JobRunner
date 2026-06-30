import { createContext, useCallback, useContext, useMemo, useRef, useState, ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../lib/theme';
import { radius, spacing, typography } from '../../lib/design-tokens';
import AppBottomSheet, { AppBottomSheetRef } from './AppBottomSheet';

export interface ActionSheetAction {
  label: string;
  onPress?: () => void;
  icon?: keyof typeof Feather.glyphMap;
  style?: 'default' | 'destructive' | 'cancel';
}

export interface ActionSheetOptions {
  title?: string;
  message?: string;
  actions: ActionSheetAction[];
}

interface ActionSheetContextType {
  show: (options: ActionSheetOptions) => void;
}

const ActionSheetContext = createContext<ActionSheetContextType | null>(null);

export function ActionSheetProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ActionSheetOptions | null>(null);
  const [visible, setVisible] = useState(false);
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
      // unmounted. The close animation runs ~220ms with a 280ms safety
      // unmount in AppBottomSheet; firing too early (the old 200ms) meant a
      // follow-up native modal (document picker) or Alert tried to present
      // WHILE this sheet's Modal was still up — iOS silently refuses to
      // present, so the row appeared to "do nothing". 320ms clears it.
      if (action.style !== 'cancel') {
        setTimeout(() => action.onPress?.(), 320);
      }
    },
    []
  );

  // Cancel actions render as a separate grouped button below the main list,
  // matching the premium iOS action-sheet pattern used elsewhere in the app.
  const primaryActions = useMemo(
    () => (opts?.actions ?? []).filter((a) => a.style !== 'cancel'),
    [opts]
  );
  const cancelAction = useMemo(
    () => (opts?.actions ?? []).find((a) => a.style === 'cancel'),
    [opts]
  );

  const renderRow = (action: ActionSheetAction, idx: number, isLast: boolean) => {
    const isDestructive = action.style === 'destructive';
    const tint = isDestructive ? colors.destructive : colors.foreground;
    const chipBg = isDestructive ? `${colors.destructive}1A` : colors.muted;
    return (
      <Pressable
        key={`${action.label}-${idx}`}
        onPress={() => onActionPress(action)}
        style={({ pressed }) => [
          styles.row,
          !isLast && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
          pressed && { backgroundColor: colors.muted },
        ]}
      >
        {action.icon ? (
          <View style={[styles.iconChip, { backgroundColor: chipBg }]}>
            <Feather name={action.icon} size={18} color={tint} />
          </View>
        ) : null}
        <Text
          style={[
            typography.body,
            {
              color: tint,
              fontFamily: isDestructive ? 'Inter_600SemiBold' : 'Inter_500Medium',
              flex: 1,
            },
          ]}
          numberOfLines={1}
        >
          {action.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <ActionSheetContext.Provider value={{ show }}>
      {children}
      <AppBottomSheet
        ref={sheetRef}
        visible={visible}
        onDismiss={dismiss}
        scrollable={false}
        contentPadding={0}
        title={opts?.title}
        showCloseButton
      >
        {opts?.message ? (
          <View style={styles.messageWrap}>
            <Text style={[typography.caption, { color: colors.mutedForeground }]}>
              {opts.message}
            </Text>
          </View>
        ) : null}

        {primaryActions.length === 0 && !cancelAction ? (
          <View style={styles.emptyWrap}>
            <Text style={[typography.body, { color: colors.mutedForeground }]}>
              No actions available
            </Text>
          </View>
        ) : primaryActions.length === 0 ? null : (
          <View
            style={[
              styles.group,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {primaryActions.map((action, idx) =>
              renderRow(action, idx, idx === primaryActions.length - 1)
            )}
          </View>
        )}

        {cancelAction ? (
          <Pressable
            onPress={() => onActionPress(cancelAction)}
            style={({ pressed }) => [
              styles.group,
              styles.cancelGroup,
              { backgroundColor: colors.card, borderColor: colors.border },
              pressed && { backgroundColor: colors.muted },
            ]}
          >
            <Text
              style={[
                typography.body,
                { color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold', textAlign: 'center', flex: 1 },
              ]}
            >
              {cancelAction.label}
            </Text>
          </Pressable>
        ) : null}
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
  messageWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  emptyWrap: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  group: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  cancelGroup: {
    marginTop: spacing.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 60,
    gap: spacing.md,
  },
  iconChip: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ActionSheetProvider;
