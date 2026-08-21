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
 * Workers who have been granted a specific permission via custom roles can
 * also be let through by passing `requiredPermission`. The guard allows access
 * if the user holds ANY of the listed permissions (additive unlock, matching
 * the `requiredPermission` behaviour in navigation-config.ts).
 *
 * Usage:
 *   export default function MyOwnerScreen() {
 *     return (
 *       <OwnerOnlyGuard requiredPermission={['collect_payments', 'manage_payments']}>
 *         {/* screen content *\/}
 *       </OwnerOnlyGuard>
 *     );
 *   }
 *
 * Props:
 *   redirectTo          — where to redirect when access is denied (default: '/jobs')
 *   requiredPermission  — permission key(s); holding ANY of these also grants access
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
  /**
   * Additive permission unlock. A worker who holds ANY of these permission
   * keys is allowed through even if their role is not owner/manager.
   * Accepts a single key or an array — matches the `requiredPermission`
   * field in navigation-config.ts so the nav and screen guard stay in sync.
   */
  requiredPermission?: string | string[];
}

export function OwnerOnlyGuard({
  children,
  redirectTo = '/jobs',
  requiredPermission,
}: OwnerOnlyGuardProps) {
  const { colors } = useTheme();
  const { isOwner, isManager, isStandaloneSubcontractor, isLoading, hasPermission } = useUserRole();
  const redirectedRef = useRef(false);

  // isOwner covers owner + solo_owner.
  // isManager covers manager + office_admin (the hook normalises office_admin → manager).
  // isStandaloneSubcontractor: a subcontractor operating in their own Personal workspace
  // has full owner powers (server returns isOwner:true for them). The hook keeps
  // role='subcontractor' so the dashboard/badge still shows, but they must pass
  // owner-only guards the same way a solo owner would.
  const hasRoleAccess = isOwner || isManager || isStandaloneSubcontractor;

  // Additive unlock: check if the user holds any of the required permissions.
  // This mirrors the `requiredPermission` unlock in navigation-config.ts so the
  // navigation item visibility and the screen guard stay in sync.
  const hasPermissionAccess = (() => {
    if (!requiredPermission) return false;
    const keys = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
    return keys.some((key) => hasPermission(key));
  })();

  const hasAccess = hasRoleAccess || hasPermissionAccess;

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
