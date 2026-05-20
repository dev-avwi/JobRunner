import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ScrollViewProps,
  FlatList,
  Dimensions,
  Animated,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useTheme } from '../../lib/theme';
import { radius, spacing, shadows, typography } from '../../lib/design-tokens';

export interface AppBottomSheetRef {
  present: () => void;
  dismiss: () => void;
}

export interface AppBottomSheetProps {
  children: ReactNode;
  /** Legacy gorhom prop — accepted but ignored. */
  enableDynamicSizing?: boolean;
  /** Legacy gorhom prop — accepted but ignored. */
  enablePanDownToClose?: boolean;
  /** Legacy gorhom prop — accepted but ignored. */
  keyboardBehavior?: 'interactive' | 'extend' | 'fillParent';
  /** Legacy autoHeight prop — accepted but ignored. The sheet always uses the
   * snap point as a fixed height (or 90% default). */
  autoHeight?: boolean;
  /**
   * Snap point — accepts gorhom-style "%" strings or pixel numbers.
   * We use the LAST (largest) snap point as the fixed sheet height.
   * Defaults to 90% of screen when omitted; hard-capped at 92%.
   */
  snapPoints?: (string | number)[];
  onDismiss?: () => void;
  title?: string;
  showCloseButton?: boolean;
  /** Wrap children in a ScrollView when true (default). */
  scrollable?: boolean;
  contentPadding?: number;
  /** Declarative visibility. When provided, drives open/close. */
  visible?: boolean;
  /**
   * Optional sticky footer pinned to the bottom of the sheet, above the
   * safe-area inset. Use for primary actions (Cancel / Confirm).
   */
  footer?: ReactNode;
}

/**
 * Resolve a snap-points array into a fixed sheet height in pixels.
 * Always picks the LAST (largest) entry — matches gorhom open-to-largest.
 */
function resolveSheetHeight(
  snapPoints: (string | number)[] | undefined,
  screenHeight: number,
): number {
  if (snapPoints && snapPoints.length > 0) {
    const sp = snapPoints[snapPoints.length - 1];
    if (typeof sp === 'number') {
      return sp <= 1 ? Math.round(screenHeight * sp) : sp;
    }
    const trimmed = sp.trim();
    if (trimmed.endsWith('%')) {
      const pct = parseFloat(trimmed) / 100;
      return Math.round(screenHeight * pct);
    }
    const n = parseFloat(trimmed);
    if (!Number.isNaN(n)) return n;
  }
  return Math.round(screenHeight * 0.9);
}

const AppBottomSheet = forwardRef<AppBottomSheetRef, AppBottomSheetProps>(
  (
    {
      children,
      snapPoints,
      onDismiss,
      title,
      showCloseButton = false,
      scrollable = true,
      contentPadding = spacing.lg,
      visible: visibleProp,
      footer,
    },
    ref,
  ) => {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();

    const screenHeight = Dimensions.get('window').height;
    const requestedHeight = resolveSheetHeight(snapPoints, screenHeight);
    // Hard cap at 92% so the status bar is never covered.
    const sheetHeight = Math.min(requestedHeight, screenHeight * 0.92);

    // The Modal stays mounted across the close animation so the slide-down
    // plays before unmount. `mounted` mirrors that lifecycle; `isVisible`
    // is the user-facing open/close intent.
    const [internalVisible, setInternalVisible] = useState(false);
    const [mounted, setMounted] = useState(false);
    const isVisible = visibleProp !== undefined ? visibleProp : internalVisible;

    // Animations: manual translateY for the sheet, separate fade for the
    // backdrop. NOT using Modal's animationType="slide" — that fought the
    // translateY transform and produced jank on drag-dismiss.
    const translateY = useRef(new Animated.Value(screenHeight)).current;
    const backdropOpacity = useRef(new Animated.Value(0)).current;

    const present = useCallback(() => {
      if (visibleProp === undefined) setInternalVisible(true);
    }, [visibleProp]);

    const dismiss = useCallback(() => {
      if (visibleProp === undefined) setInternalVisible(false);
      else onDismiss?.();
    }, [visibleProp, onDismiss]);

    useImperativeHandle(ref, () => ({ present, dismiss }), [present, dismiss]);

    // Open / close animation driver.
    useEffect(() => {
      if (isVisible) {
        setMounted(true);
        translateY.setValue(screenHeight);
        backdropOpacity.setValue(0);
        Animated.parallel([
          Animated.timing(backdropOpacity, {
            toValue: 1,
            duration: 220,
            useNativeDriver: true,
          }),
          Animated.spring(translateY, {
            toValue: 0,
            damping: 22,
            stiffness: 220,
            mass: 0.9,
            useNativeDriver: true,
          }),
        ]).start();
      } else if (mounted) {
        Animated.parallel([
          Animated.timing(backdropOpacity, {
            toValue: 0,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: screenHeight,
            duration: 220,
            useNativeDriver: true,
          }),
        ]).start(({ finished }) => {
          if (finished) setMounted(false);
        });
      }
    }, [isVisible, screenHeight, translateY, backdropOpacity, mounted]);

    const handleBackdropPress = useCallback(() => {
      if (visibleProp === undefined) setInternalVisible(false);
      onDismiss?.();
    }, [visibleProp, onDismiss]);

    const handleRequestClose = useCallback(() => {
      // Hardware back on Android.
      if (visibleProp === undefined) setInternalVisible(false);
      onDismiss?.();
    }, [visibleProp, onDismiss]);

    // Drag-to-dismiss — attached ONLY to the drag handle at the top of the
    // sheet, NOT the whole sheet. Whole-sheet pan responders compete with
    // inner ScrollViews/FlatLists and cause "lists feel stuck" + "content
    // clipped"-style symptoms. Restricting to the handle gives a clear,
    // dedicated drag target and keeps body interactions untouched.
    const closeRef = useRef(handleBackdropPress);
    useEffect(() => {
      closeRef.current = handleBackdropPress;
    }, [handleBackdropPress]);

    const panResponder = useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4,
          onPanResponderMove: (_e, g) => {
            translateY.setValue(g.dy > 0 ? g.dy : 0);
          },
          onPanResponderRelease: (_e, g) => {
            if (g.dy > 80 || g.vy > 0.8) {
              Animated.timing(translateY, {
                toValue: screenHeight,
                duration: 200,
                useNativeDriver: true,
              }).start(() => {
                closeRef.current();
              });
            } else {
              Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: true,
                bounciness: 6,
                speed: 24,
              }).start();
            }
          },
          onPanResponderTerminate: () => {
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 6,
              speed: 24,
            }).start();
          },
        }),
      [translateY, screenHeight],
    );

    if (!mounted) return null;

    // When a sticky footer is present, the footer handles bottom safe-area
    // padding itself; don't double-pad inside the scrollable content.
    const innerContentStyle = {
      paddingHorizontal: contentPadding,
      paddingBottom: footer
        ? contentPadding
        : contentPadding + Math.max(insets.bottom, 0),
    };

    return (
      <Modal
        visible={mounted}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={handleRequestClose}
        presentationStyle="overFullScreen"
        hardwareAccelerated
      >
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* Backdrop */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: 'rgba(0,0,0,0.5)', opacity: backdropOpacity },
            ]}
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={handleBackdropPress}
            />
          </Animated.View>

          {/* Sheet */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.kbWrapper}
            pointerEvents="box-none"
          >
            <Animated.View
              style={[
                styles.sheet,
                {
                  height: sheetHeight,
                  backgroundColor: colors.card,
                  transform: [{ translateY }],
                },
                shadows.lg as object,
              ]}
            >
              {/* Drag handle — the ONLY pan target. */}
              <View style={styles.handleArea} {...panResponder.panHandlers}>
                <View
                  style={[
                    styles.handle,
                    {
                      backgroundColor: isDark
                        ? colors.borderLight
                        : colors.mutedForeground,
                    },
                  ]}
                />
              </View>

              {(title || showCloseButton) && (
                <View
                  style={[
                    styles.header,
                    { borderBottomColor: colors.border },
                  ]}
                >
                  <Text
                    style={[
                      typography.cardTitle,
                      { color: colors.foreground, flex: 1 },
                    ]}
                    numberOfLines={1}
                  >
                    {title || ''}
                  </Text>
                  {showCloseButton ? (
                    <Pressable
                      onPress={handleBackdropPress}
                      hitSlop={8}
                      style={styles.closeBtn}
                    >
                      <X size={20} color={colors.mutedForeground} />
                    </Pressable>
                  ) : null}
                </View>
              )}

              {scrollable ? (
                <ScrollView
                  style={{ flex: 1, backgroundColor: colors.card }}
                  contentContainerStyle={innerContentStyle}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {children}
                </ScrollView>
              ) : (
                <View
                  style={[
                    innerContentStyle,
                    { backgroundColor: colors.card, flex: 1 },
                  ]}
                >
                  {children}
                </View>
              )}

              {footer ? (
                <View
                  style={{
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                    backgroundColor: colors.card,
                    paddingTop: spacing.md,
                    paddingHorizontal: spacing.lg,
                    paddingBottom: Math.max(insets.bottom, spacing.md),
                  }}
                >
                  {footer}
                </View>
              ) : null}
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    );
  },
);

AppBottomSheet.displayName = 'AppBottomSheet';

export function useAppBottomSheet() {
  const ref = useRef<AppBottomSheetRef>(null);
  const present = useCallback(() => ref.current?.present(), []);
  const dismiss = useCallback(() => ref.current?.dismiss(), []);
  return { ref, present, dismiss };
}

const styles = StyleSheet.create({
  kbWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
  },
  handleArea: {
    paddingTop: 10,
    paddingBottom: 6,
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    opacity: 0.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export { AppBottomSheet };
export default AppBottomSheet;

// Back-compat re-exports so existing call-sites that imported these from
// AppBottomSheet keep working. They resolve to plain react-native primitives.
export const BottomSheetScrollView = (props: ScrollViewProps) => (
  <ScrollView {...props} keyboardShouldPersistTaps="handled" />
);
export const BottomSheetView = View;
export const BottomSheetFlatList = FlatList;
