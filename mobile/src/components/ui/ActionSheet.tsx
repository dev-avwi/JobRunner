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
      // Defer to allow the sheet to dismiss before running side-effects
      setTimeout(() => {
        if (action.style !== 'cancel') action.onPress?.();
      }, 200);
    },
    []
  );

  const visibleActions = useMemo(() => opts?.actions ?? [], [opts]);

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
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
            <Text style={[typography.caption, { color: colors.mutedForeground }]}>
              {opts.message}
            </Text>
          </View>
        ) : null}
        <View>
          {visibleActions.length === 0 ? (
            <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.lg }}>
              <Text style={[typography.body, { color: colors.mutedForeground }]}>
                No actions available
              </Text>
            </View>
          ) : visibleActions.map((action, idx) => {
            const isDestructive = action.style === 'destructive';
            const isCancel = action.style === 'cancel';
            const tint = isDestructive
              ? colors.destructive
              : isCancel
                ? colors.mutedForeground
                : colors.foreground;
            return (
              <Pressable
                key={`${action.label}-${idx}`}
                onPress={() => onActionPress(action)}
                style={({ pressed }) => [
                  styles.row,
                  {
                    borderTopColor: colors.border,
                    borderTopWidth: idx === 0 ? StyleSheet.hairlineWidth : 0,
                    borderBottomColor: colors.border,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    backgroundColor: pressed ? colors.muted : 'transparent',
                  },
                ]}
              >
                {action.icon ? (
                  <Feather name={action.icon} size={18} color={tint} style={{ marginRight: spacing.md }} />
                ) : null}
                <Text
                  style={[
                    typography.body,
                    {
                      color: tint,
                      fontFamily: isDestructive || isCancel ? 'Inter_600SemiBold' : 'Inter_500Medium',
                      flex: 1,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {action.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    minHeight: 56,
  },
});

export default ActionSheetProvider;
