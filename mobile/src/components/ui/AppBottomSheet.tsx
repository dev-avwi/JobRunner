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
  Platform,
  ScrollView,
  ScrollViewProps,
  FlatList,
  Dimensions,
  Animated,
  PanResponder,
  Keyboard,
  KeyboardEvent,
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
  /**
   * When true (default when no snapPoints provided), the sheet sizes to its
   * content with a 92% screen-height cap. When false (or when snapPoints is
   * provided), the sheet uses a fixed height from snapPoints (last entry).
   */
  autoHeight?: boolean;
  /**
   * Snap point — accepts gorhom-style "%" strings or pixel numbers.
   * We use the LAST (largest) snap point as the fixed sheet height.
   * Providing snapPoints implies autoHeight=false.
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
      autoHeight,
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
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();

    const screenHeight = Dimensions.get('window').height;
    const maxSheetHeight = screenHeight * 0.92;
    // autoHeight defaults to true UNLESS snapPoints is provided.
    const useAutoHeight = autoHeight ?? !snapPoints;
    const fixedSheetHeight = Math.min(
      resolveSheetHeight(snapPoints, screenHeight),
      maxSheetHeight,
    );

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

    // Keyboard tracking — we don't use KeyboardAvoidingView because it lifts
    // the entire sheet off the bottom edge, leaving a visible gap between
    // the sheet and the keyboard with the dimmed backdrop showing through.
    // Instead we extend the footer (or a spacer) downward by the keyboard
    // height. The sheet stays anchored at screen bottom; its bottom edge
    // hides behind the keyboard with no visible gap, while content and
    // footer ride up above the keyboard.
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    useEffect(() => {
      const showEv = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
      const hideEv = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
      const onShow = (e: KeyboardEvent) => {
        const h = e?.endCoordinates?.height ?? 0;
        setKeyboardHeight(h);
      };
      const onHide = () => setKeyboardHeight(0);
      const s = Keyboard.addListener(showEv, onShow);
      const h = Keyboard.addListener(hideEv, onHide);
      return () => {
        s.remove();
        h.remove();
      };
    }, []);

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

    // Drag-to-dismiss — attached to the WHOLE sheet, but only steals the
    // gesture when it's clearly a downward, vertical-dominant drag. This
    // lets inner ScrollViews/FlatLists keep handling upward scrolls and
    // horizontal gestures (taps, swipes). The threshold avoids stealing
    // taps on buttons inside the sheet.
    const closeRef = useRef(handleBackdropPress);
    useEffect(() => {
      closeRef.current = handleBackdropPress;
    }, [handleBackdropPress]);

    const panResponder = useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => false,
          onMoveShouldSetPanResponder: (_e, g) =>
            g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
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
      paddingTop: spacing.sm,
      paddingBottom: footer
        ? contentPadding
        : contentPadding + Math.max(insets.bottom, 0),
    };

    // Sheet sizing:
    //   autoHeight → maxHeight only, content drives size
    //   fixed     → explicit height
    const sheetSizingStyle = useAutoHeight
      ? { maxHeight: maxSheetHeight }
      : { height: fixedSheetHeight };

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
          <View
            style={styles.kbWrapper}
            pointerEvents="box-none"
          >
            <Animated.View
              {...panResponder.panHandlers}
              style={[
                styles.sheet,
                sheetSizingStyle,
                {
                  backgroundColor: colors.card,
                  transform: [{ translateY }],
                },
                shadows.lg as object,
              ]}
            >
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
                  style={useAutoHeight ? undefined : { flex: 1, backgroundColor: colors.card }}
                  contentContainerStyle={innerContentStyle}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                >
                  {children}
                </ScrollView>
              ) : (
                <View
                  style={[
                    innerContentStyle,
                    { backgroundColor: colors.card },
                    !useAutoHeight && { flex: 1 },
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
                    paddingBottom:
                      keyboardHeight > 0
                        ? keyboardHeight + spacing.md
                        : Math.max(insets.bottom, spacing.md),
                  }}
                >
                  {footer}
                </View>
              ) : keyboardHeight > 0 ? (
                // No footer + keyboard open → push content above the keyboard
                // with a card-colored spacer so the sheet visually extends
                // down behind the keyboard with no gap.
                <View
                  style={{
                    height: keyboardHeight,
                    backgroundColor: colors.card,
                  }}
                />
              ) : null}
            </Animated.View>
          </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
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
