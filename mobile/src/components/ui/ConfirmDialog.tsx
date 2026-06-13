import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Platform, KeyboardAvoidingView, Animated, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../lib/theme';
import { radius, spacing, typography, shadows } from '../../lib/design-tokens';

export interface ConfirmDialogOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  showCancel?: boolean;
}

interface ConfirmDialogContextType {
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
}

const ConfirmDialogContext = createContext<ConfirmDialogContextType | null>(null);

interface PendingState extends ConfirmDialogOptions {
  resolve: (value: boolean) => void;
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingState | null>(null);
  const { colors, isDark } = useTheme();
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (pending) {
      scaleAnim.setValue(0.9);
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 7,
        tension: 90,
      }).start();
    }
  }, [pending, scaleAnim]);

  const confirm = useCallback((options: ConfirmDialogOptions) => {
    // iOS: use the native system alert (it looks polished / Liquid Glass).
    // Android & web: the native Android alert looks poor, so use the in-app
    // themed modal instead.
    if (Platform.OS === 'ios') {
      return new Promise<boolean>((resolve) => {
        const buttons: any[] = [];
        if (options.showCancel !== false) {
          buttons.push({
            text: options.cancelText ?? 'Cancel',
            style: 'cancel',
            onPress: () => resolve(false),
          });
        }
        buttons.push({
          text: options.confirmText ?? 'Confirm',
          style: options.destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        });
        Alert.alert(options.title, options.message, buttons, {
          cancelable: options.showCancel !== false,
          onDismiss: () => resolve(false),
        });
      });
    }
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  const handleClose = (result: boolean) => {
    if (pending) pending.resolve(result);
    setPending(null);
  };

  return (
    <ConfirmDialogContext.Provider value={{ confirm }}>
      {children}
      <Modal
        visible={!!pending}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => handleClose(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <Pressable style={styles.backdrop} onPress={() => handleClose(false)}>
          <Animated.View style={[styles.dialogWrap, { transform: [{ scale: scaleAnim }] }]}>
          <Pressable
            style={[
              styles.dialog,
              { backgroundColor: colors.card, borderColor: colors.border },
              shadows.lg as object,
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={3}>
              {pending?.title}
            </Text>
            {pending?.message ? (
              <Text style={[styles.message, { color: colors.mutedForeground }]}>
                {pending.message}
              </Text>
            ) : null}
            <View style={styles.actions}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  handleClose(true);
                }}
                style={({ pressed }) => {
                  // Hardcode the confirm colours so the button is ALWAYS visible
                  // regardless of how the theme tokens resolve. Destructive =
                  // red fill + white text; primary = brand colour + safe text.
                  const bg = pending?.destructive
                    ? (pressed ? '#DC2626' : '#EF4444')
                    : (pressed ? colors.primary + 'cc' : colors.primary);
                  return [
                    styles.btn,
                    {
                      backgroundColor: bg,
                      borderColor: bg,
                    },
                  ];
                }}
              >
                <Text
                  style={[
                    styles.btnText,
                    {
                      color: pending?.destructive
                        ? '#FFFFFF'
                        : colors.primaryForeground,
                    },
                  ]}
                >
                  {pending?.confirmText ?? 'Confirm'}
                </Text>
              </Pressable>
              {pending?.showCancel !== false ? (
                <Pressable
                  onPress={() => handleClose(false)}
                  style={({ pressed }) => [
                    styles.btn,
                    {
                      backgroundColor: pressed ? colors.accent : colors.background,
                      borderColor: colors.input,
                    },
                  ]}
                >
                  <Text style={[styles.btnText, { color: colors.foreground }]}>
                    {pending?.cancelText ?? 'Cancel'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </Pressable>
          </Animated.View>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog(): ConfirmDialogContextType['confirm'] {
  const ctx = useContext(ConfirmDialogContext);
  if (!ctx) {
    return async (opts) => {
      if (Platform.OS === 'web') {
        // eslint-disable-next-line no-alert
        return Promise.resolve(window.confirm(opts.message ?? opts.title));
      }
      return Promise.resolve(false);
    };
  }
  return ctx.confirm;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  dialogWrap: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  dialog: {
    width: '100%',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    ...typography.cardTitle,
  },
  message: {
    ...typography.body,
  },
  actions: {
    flexDirection: 'column',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  btn: {
    width: '100%',
    minHeight: 52,
    borderRadius: radius.xl,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  btnText: {
    ...typography.bodySemibold,
    textAlign: 'center',
  },
});

export default ConfirmDialogProvider;
