import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useShouldUseSidebar } from '../lib/device';

/**
 * Preserve a screen's vertical scroll offset across a fold/unfold (or any
 * tablet<->phone chrome swap).
 *
 * Task #251 keeps the navigator + active screen mounted when the layout crosses
 * the tablet-width threshold, so the FlatList/ScrollView instance survives. But
 * the content column width changes (sidebar appears/disappears, reading column
 * re-caps), which reflows the list and makes the underlying native scroll view
 * snap back toward the top. This hook records the live offset and re-applies it
 * (across several frames, to outlast the reflow) the moment the layout swaps.
 *
 * Usage:
 *   const scrollRef = useRef<FlatList>(null); // or ScrollView
 *   const { onScroll, scrollEventThrottle } = usePreserveScrollOnFold(scrollRef);
 *   <FlatList ref={scrollRef} onScroll={onScroll} scrollEventThrottle={scrollEventThrottle} ... />
 *
 * The returned onScroll can be composed with an existing handler if the screen
 * already listens to scroll events.
 */
export function usePreserveScrollOnFold(
  scrollRef: RefObject<any>,
  options?: { onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void },
) {
  const shouldUseSidebar = useShouldUseSidebar();
  const offsetRef = useRef(0);
  const prevSidebarRef = useRef(shouldUseSidebar);
  const userOnScroll = options?.onScroll;

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e?.nativeEvent?.contentOffset?.y;
      if (typeof y === 'number') offsetRef.current = y;
      userOnScroll?.(e);
    },
    [userOnScroll],
  );

  useEffect(() => {
    // Only react to an actual layout swap, not the initial mount.
    if (prevSidebarRef.current === shouldUseSidebar) return;
    prevSidebarRef.current = shouldUseSidebar;

    const target = offsetRef.current;
    if (target <= 0) return;

    const restore = () => {
      const node = scrollRef.current;
      if (!node) return;
      if (typeof node.scrollToOffset === 'function') {
        node.scrollToOffset({ offset: target, animated: false });
      } else if (typeof node.scrollTo === 'function') {
        node.scrollTo({ y: target, animated: false });
      }
    };

    // Re-apply across several frames: the reflow that follows the chrome swap
    // can settle a frame or two late, and a single restore would be undone.
    const raf = requestAnimationFrame(() => {
      restore();
      requestAnimationFrame(restore);
    });
    const timers = [
      setTimeout(restore, 60),
      setTimeout(restore, 180),
      setTimeout(restore, 350),
    ];

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
  }, [shouldUseSidebar, scrollRef]);

  return { onScroll, scrollEventThrottle: 16 };
}
