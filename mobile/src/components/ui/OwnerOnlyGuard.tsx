/**
 * OwnerOnlyGuard
 *
 * Wraps a screen that should only be accessible to owners / managers. When a
 * worker (staff / subcontractor) lands on the screen — e.g. via a deep-link
 * or back-navigation shortcut — the guard immediately redirects them to the
 * Jobs tab and shows a toast explaining they don't have access.
 *
 * Note: the `office_admin` role normalises to `manager` inside `useUserRole`,
 * so office_admin users are already allowed through by `isManager === true`.
 *
 * Usage:
 *   export default function MyOwnerScreen() {
 *     return (
 *       <OwnerOnlyGuard>
 *         {/* screen content *\/}
 *       </OwnerOnlyGuard>
 *     );
 *   }
 *
 * Props:
 *   redirectTo  — where to redirect when access is denied (default: '/jobs')
 */

import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useUserRole } from '../../hooks/use-user-role';
import { showToast } from '../../lib/toast';
import { useTheme } from '../../lib/theme';

interface OwnerOnlyGuardProps {
  children: React.ReactNode;
  /** Route to replace with when access is denied. Defaults to '/jobs'. */
  redirectTo?: string;
}

export function OwnerOnlyGuard({
  children,
  redirectTo = '/jobs',
}: OwnerOnlyGuardProps) {
  const { colors } = useTheme();
  const { isOwner, isManager, isLoading } = useUserRole();
  const redirectedRef = useRef(false);

  // isOwner covers owner + solo_owner.
  // isManager covers manager + office_admin (the hook normalises office_admin → manager).
  const hasAccess = isOwner || isManager;

  useEffect(() => {
    // Wait until the role has been resolved before deciding to redirect.
    if (isLoading) return;
    // Only redirect once per mount to avoid a redirect loop.
    if (redirectedRef.current) return;
    if (!hasAccess) {
      redirectedRef.current = true;
      showToast({
        type: 'error',
        message: "You don't have permission to access this page.",
      });
      // Use replace so the restricted screen is removed from the back-stack.
      router.replace(redirectTo as any);
    }
  }, [isLoading, hasAccess, redirectTo]);

  // While the role is still loading (or the redirect is about to fire), show a
  // minimal spinner instead of briefly rendering owner-only data.
  if (isLoading || !hasAccess) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="small" />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
