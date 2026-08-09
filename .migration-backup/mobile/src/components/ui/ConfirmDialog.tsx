import { createContext, useCallback, useContext, ReactNode } from 'react';
import { Platform } from 'react-native';
import { Alert } from '../../lib/alert';

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

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  // All confirm dialogs delegate to the shared Alert (lib/alert): native system
  // alert on iOS, the single branded AlertHost modal on Android/web. This is
  // the SAME component that renders every other popup (e.g. Sign out), so
  // confirm dialogs can never drift out of style with the rest of the app.
  const confirm = useCallback((options: ConfirmDialogOptions) => {
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const settle = (value: boolean) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const buttons: {
        text: string;
        style: 'default' | 'cancel' | 'destructive';
        onPress: () => void;
      }[] = [
        {
          text: options.confirmText ?? 'Confirm',
          style: options.destructive ? 'destructive' : 'default',
          onPress: () => settle(true),
        },
      ];
      if (options.showCancel !== false) {
        buttons.push({
          text: options.cancelText ?? 'Cancel',
          style: 'cancel',
          onPress: () => settle(false),
        });
      }
      Alert.alert(options.title, options.message, buttons, {
        cancelable: options.showCancel !== false,
        onDismiss: () => settle(false),
      });
    });
  }, []);

  return (
    <ConfirmDialogContext.Provider value={{ confirm }}>
      {children}
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

export default ConfirmDialogProvider;
