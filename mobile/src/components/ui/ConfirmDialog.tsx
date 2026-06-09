import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { Alert, Modal, View, Text, Pressable, StyleSheet, Platform, KeyboardAvoidingView, Animated } from 'react-native';
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

function nativeConfirm(options: ConfirmDialogOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const buttons: Array<{ text: string; style?: 'default' | 'cancel' | 'destructive'; onPress: () => void }> = [];
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
      onPress: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        resolve(true);
      },
    });
    Alert.alert(options.title, options.message, buttons, {
      cancelable: options.showCancel !== false,
      onDismiss: () => resolve(false),
    });
  });
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
    // iOS users expect the native system alert (it has the right typography,
    // blur, and destructive-red colour out of the box). Android's native
    // Alert looks unbranded and out of place next to our themed sheets, so
    // on Android (and web) we use the in-app modal which respects the
    // user's theme tokens and provides proper haptics.
    if (Platform.OS === 'ios') {
      return nativeConfirm(options);
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
                  const bg = pending?.destructive ? colors.destructive : colors.primary;
                  return [
                    styles.btn,
                    {
                      backgroundColor: pressed ? bg + 'cc' : bg,
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
                        ? colors.destructiveForeground
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
