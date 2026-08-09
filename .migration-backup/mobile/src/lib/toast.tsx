import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Toast, { ToastConfig, ToastConfigParams } from 'react-native-toast-message';
import * as Haptics from 'expo-haptics';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react-native';
import { useTheme } from './theme';
import { radius, spacing, typography, shadows } from './design-tokens';

export type ToastType = 'success' | 'error' | 'info';

export interface ShowToastOptions {
  type: ToastType;
  message: string;
  description?: string;
}

export function showToast(opts: ShowToastOptions) {
  const { type, message, description } = opts;

  if (type === 'success') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  } else if (type === 'error') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  }

  Toast.show({
    type,
    text1: message,
    text2: description,
    position: 'top',
    topOffset: 60,
    visibilityTime: 3000,
    autoHide: true,
  });
}

export function hideToast() {
  Toast.hide();
}

interface ToastBodyProps {
  message: string;
  description?: string;
  variant: ToastType;
  Icon: typeof CheckCircle2;
}

function ToastBody({ message, description, variant, Icon }: ToastBodyProps) {
  const { colors } = useTheme();
  const accent =
    variant === 'success'
      ? colors.success
      : variant === 'error'
      ? colors.destructive
      : colors.info;
  return (
    <Pressable
      onPress={hideToast}
      style={[
        styles.container,
        shadows.md as object,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderLeftColor: accent,
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: accent + '22' }]}>
        <Icon size={20} color={accent} />
      </View>
      <View style={styles.textWrap}>
        <Text
          style={[typography.bodySemibold, { color: colors.foreground }]}
          numberOfLines={2}
        >
          {message}
        </Text>
        {description ? (
          <Text
            style={[typography.caption, { color: colors.mutedForeground, marginTop: 2 }]}
            numberOfLines={3}
          >
            {description}
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={hideToast}
        hitSlop={8}
        style={styles.closeBtn}
      >
        <X size={16} color={colors.mutedForeground} />
      </Pressable>
    </Pressable>
  );
}

export function buildToastConfig(): ToastConfig {
  return {
    success: (params: ToastConfigParams<unknown>) => (
      <ToastBody
        message={params.text1 || ''}
        description={params.text2}
        variant="success"
        Icon={CheckCircle2}
      />
    ),
    error: (params: ToastConfigParams<unknown>) => (
      <ToastBody
        message={params.text1 || ''}
        description={params.text2}
        variant="error"
        Icon={AlertCircle}
      />
    ),
    info: (params: ToastConfigParams<unknown>) => (
      <ToastBody
        message={params.text1 || ''}
        description={params.text2}
        variant="info"
        Icon={Info}
      />
    ),
  };
}

const styles = StyleSheet.create({
  container: {
    width: '92%',
    maxWidth: 480,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    paddingTop: 2,
  },
  closeBtn: {
    padding: 4,
    marginLeft: spacing.xs,
  },
});

export default showToast;
