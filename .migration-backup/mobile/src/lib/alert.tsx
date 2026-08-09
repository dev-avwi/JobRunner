import { useEffect, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert as RNAlert,
} from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * App-wide styled alert.
 *
 * Drop-in replacement for React Native's `Alert` — same `Alert.alert(title,
 * message?, buttons?, options?)` signature — but it renders our own themed
 * modal (white card, rounded corners, explicit button colours) instead of the
 * unbranded native system dialog. Mount <AlertHost /> once at the app root.
 */

export type AlertButtonStyle =
  | 'default'
  | 'cancel'
  | 'destructive'
  | 'secondary'
  | 'plain';

export interface AlertButton {
  text?: string;
  onPress?: (value?: string) => void;
  style?: AlertButtonStyle;
}

export interface AlertOptions {
  cancelable?: boolean;
  onDismiss?: () => void;
}

type ShowFn = (
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: AlertOptions,
) => void;

let externalShow: ShowFn | null = null;

export const Alert = {
  alert(
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: AlertOptions,
  ) {
    // iOS uses the native system alert so every alert matches the rest of the
    // app (the confirm dialogs already go native on iOS). Android/web keep the
    // branded modal via the mounted <AlertHost />.
    if (Platform.OS === 'ios') {
      const nativeButtons = buttons?.map((b) => ({
        text: b.text,
        onPress: b.onPress ? () => b.onPress!() : undefined,
        style:
          b.style === 'destructive'
            ? 'destructive'
            : b.style === 'cancel'
            ? 'cancel'
            : 'default',
      }));
      RNAlert.alert(title, message, nativeButtons as never, options as never);
      return;
    }
    if (externalShow) {
      externalShow(title, message, buttons, options);
      return;
    }
    // Host not mounted yet (very early startup) — fall back to native so the
    // message is never silently dropped.
    RNAlert.alert(title, message as string | undefined, buttons as never, options as never);
  },
  // iOS-only text prompt. We don't have a styled equivalent, so delegate to the
  // native implementation to preserve existing behaviour.
  prompt(...args: unknown[]) {
    const fn = (RNAlert as { prompt?: (...a: unknown[]) => void }).prompt;
    if (fn) fn(...args);
  },
};

interface AlertState {
  title: string;
  message?: string;
  buttons: AlertButton[];
  options?: AlertOptions;
}

// Action buttons render at the top, dismiss-style buttons at the bottom — a
// consistent layout regardless of the order the caller passed them in.
function buttonWeight(style?: AlertButtonStyle): number {
  switch (style) {
    case 'destructive':
    case 'default':
      return 0;
    case 'secondary':
      return 1;
    case 'cancel':
    case 'plain':
    default:
      return 2;
  }
}

export function AlertHost() {
  const [queue, setQueue] = useState<AlertState[]>([]);
  const current = queue[0] ?? null;

  useEffect(() => {
    externalShow = (title, message, buttons, options) => {
      const btns =
        buttons && buttons.length > 0
          ? buttons
          : [{ text: 'OK', style: 'default' as const }];
      setQueue((q) => [...q, { title, message, buttons: btns, options }]);
    };
    return () => {
      externalShow = null;
    };
  }, []);

  const dismiss = useCallback((btn?: AlertButton) => {
    setQueue((q) => q.slice(1));
    if (btn?.onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      btn.onPress();
    }
  }, []);

  const handleBackdrop = useCallback(() => {
    if (!current) return;
    if (current.options?.cancelable === false) return;
    setQueue((q) => q.slice(1));
    // Match native RN Alert: outside/back dismissal runs only onDismiss, never
    // a button's onPress handler.
    current.options?.onDismiss?.();
  }, [current]);

  const sortedButtons = current
    ? [...current.buttons].sort(
        (a, b) => buttonWeight(a.style) - buttonWeight(b.style),
      )
    : [];

  return (
    <Modal
      visible={!!current}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleBackdrop}
    >
      <TouchableOpacity
        activeOpacity={1}
        style={styles.overlay}
        onPress={handleBackdrop}
      >
        <TouchableOpacity activeOpacity={1} style={styles.card}>
          {!!current?.title && <Text style={styles.title}>{current.title}</Text>}
          {!!current?.message && (
            <Text style={styles.message}>{current.message}</Text>
          )}
          <View style={styles.actions}>
            {sortedButtons.map((btn, i) => {
              const style = btn.style ?? 'default';
              const isDestructive = style === 'destructive';
              const isDefault = style === 'default';
              const isPlain = style === 'plain';
              const isFilled = isDestructive || isDefault;

              const bg = isDestructive
                ? '#EF4444'
                : isDefault
                ? '#2B7DE9'
                : isPlain
                ? 'transparent'
                : '#FFFFFF';
              const textColor = isFilled
                ? '#FFFFFF'
                : isPlain
                ? '#6B7280'
                : '#374151';

              return (
                <TouchableOpacity
                  key={`${btn.text}-${i}`}
                  activeOpacity={0.85}
                  onPress={() => dismiss(btn)}
                  style={[
                    styles.btn,
                    { backgroundColor: bg },
                    !isFilled && !isPlain
                      ? { borderWidth: 1.5, borderColor: '#E5E7EB' }
                      : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.btnText,
                      { color: textColor, fontWeight: isFilled ? '700' : '500' },
                    ]}
                  >
                    {btn.text ?? 'OK'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 420,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  message: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    lineHeight: 20,
  },
  actions: {
    marginTop: 24,
    gap: 10,
  },
  btn: {
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnText: {
    fontSize: 16,
  },
});

export default AlertHost;
