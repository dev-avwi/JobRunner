import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useFocusEffect } from 'expo-router';

/**
 * Runs `fn` on an interval, but only while this screen is focused AND the
 * app is in the foreground. Polling that ignores both — a bare setInterval
 * in a useEffect — keeps hitting the server and draining battery for
 * screens nobody is looking at (background app, or a different tab).
 *
 * `fn` is read from a ref each tick, so passing a fresh closure every render
 * is fine — no dependency array to keep in sync.
 */
export function usePolling(
  fn: () => void,
  ms: number,
  options?: { enabled?: boolean; immediate?: boolean }
) {
  const enabled = options?.enabled ?? true;
  const immediate = options?.immediate ?? true;
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const [isFocused, setIsFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, [])
  );

  const [isForeground, setIsForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      setIsForeground(state === 'active');
    });
    return () => sub.remove();
  }, []);

  const active = enabled && isFocused && isForeground;

  useEffect(() => {
    if (!active) return;
    if (immediate) fnRef.current();
    const id = setInterval(() => fnRef.current(), ms);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ms]);
}
