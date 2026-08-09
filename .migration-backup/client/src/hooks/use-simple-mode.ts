import { useCallback } from "react";

// Simple Mode has been removed — every account now uses the full layout and
// navigation. This hook is kept as a no-op so existing imports keep working.
export function useSimpleMode() {
  const setSimpleMode = useCallback((_value: boolean) => {}, []);

  return {
    isSimpleMode: false,
    setSimpleMode,
    isLoading: false,
  };
}
