import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, ThemeColors } from '../lib/theme';
import { useAuthStore } from '../lib/store';
import { useUserRole } from '../hooks/use-user-role';
import { 
  getFilteredSidebarMainItems, 
  getFilteredSidebarSettingsItems, 
  sidebarMainItems,
  SidebarNavItem, 
  isSidebarPathActive,
  FilterOptions,
  UserRole
} from '../lib/navigation-config';
import { SIDEBAR_WIDTH } from '../lib/device';

interface SidebarNavItemButtonProps {
  item: SidebarNavItem;
  active: boolean;
  onPress: () => void;
  colors: ThemeColors;
}

function SidebarNavItemButton({ item, active, onPress, colors }: SidebarNavItemButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.navItemPressable,
        active && { backgroundColor: colors.primaryLight },
        pressed && !active && { backgroundColor: colors.muted },
      ]}
      data-testid={`sidebar-item-${item.id}`}
    >
      {active && <View style={[styles.activeIndicator, { backgroundColor: colors.primary }]} />}
      <View style={styles.navItemRow}>
        <Feather 
          name={item.icon} 
          size={16}
          color={active ? colors.primary : colors.mutedForeground}
          style={styles.navItemIcon}
        />
        <Text style={[
          styles.navItemLabel,
          { color: active ? colors.primary : colors.foreground },
          active && { fontWeight: '600' },
        ]}>
          {item.title}
        </Text>
      </View>
    </Pressable>
  );
}

export function SidebarNav() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user, businessSettings, isInitialized, roleInfo } = useAuthStore();
  const { permissions } = useUserRole();
  const themedStyles = useMemo(() => createStyles(colors), [colors]);

  const handlePress = (item: SidebarNavItem) => {
    router.push(item.path as any);
  };

  const businessName = businessSettings?.businessName || 'JobRunner';
  const logoUrl = businessSettings?.logoUrl;
  const initials = businessName
    .split(' ')
    .map((word: string) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Derive role from user.role OR roleInfo.roleId, normalizing values
  const rawRole = user?.role || roleInfo?.roleId || '';
  // A subcontractor in their OWN business has server isOwner:true. Give them the
  // solo-owner kit (trimmed of team/owner-advanced items via the
  // isStandaloneSubcontractor filter flag), not the owner menu. A subbie
  // switched INTO a builder's business has isOwner absent → stays a worker.
  const isStandaloneSub =
    roleInfo?.isOwner === true &&
    (roleInfo?.roleName || '').toLowerCase().includes('subcontractor');
  const normalizedRole = useMemo(() => {
    if (isStandaloneSub) return 'solo_owner';
    const r = rawRole.toLowerCase();
    if (r === 'team_member' || r === 'team') return 'team';
    if (r === 'staff_tradie' || r === 'staff') return 'staff';
    if (r === 'solo_owner') return 'solo_owner';
    if (r === 'owner') return 'owner';
    if (r === 'manager') return 'manager';
    if (r === 'office_admin') return 'office_admin';
    // Fallback based on roleInfo.isOwner
    if (roleInfo?.isOwner) return 'owner';
    // Authenticated but no role string at all → treat as owner (solo default)
    if (user?.id && !r) return 'owner';
    // Authenticated worker with an unrecognized/custom role → treat as staff so
    // the sidebar shows worker-appropriate items ('staff' is in allowedRoles).
    // Without this, custom roles match no allowedRoles and the menu is empty.
    if (user?.id) return 'staff';
    return r as UserRole;
  }, [rawRole, roleInfo?.isOwner, user?.id, isStandaloneSub]);
  
  const userRole = (normalizedRole || 'owner') as UserRole;
  const isOwner = userRole === 'owner' || userRole === 'solo_owner' || roleInfo?.isOwner;
  const isManager = userRole === 'manager';
  const isStaffTradie = userRole === 'staff_tradie' || userRole === 'staff' || userRole === 'team';
  
  const subscriptionTier = user?.subscriptionTier || 'free';
  const hasProSubscription = subscriptionTier === 'pro' || subscriptionTier === 'team' || subscriptionTier === 'business' || subscriptionTier === 'beta';
  const hasTeamSubscription = subscriptionTier === 'team' || subscriptionTier === 'business' || subscriptionTier === 'beta';

  const filterOptions: FilterOptions = useMemo(() => ({
    isTeam: hasTeamSubscription || ((businessSettings as any)?.teamSize ?? 'solo') !== 'solo',
    isTradie: isStaffTradie,
    isOwner: Boolean(isOwner),
    isManager: isManager,
    isSolo: userRole === 'solo_owner',
    isSubcontractor: isStandaloneSub ? false : undefined,
    isStandaloneSubcontractor: isStandaloneSub,
    userRole: userRole,
    hasProSubscription,
    hasTeamSubscription,
    permissions,
  }), [userRole, isOwner, isManager, isStaffTradie, businessSettings, hasProSubscription, hasTeamSubscription, isStandaloneSub, permissions]);

  // User is ready ONLY once the authoritative role is known. Gating on role
  // (not just user.id) prevents the full owner menu from flashing before
  // fetchRoleInfo resolves on cold reopen / re-login.
  const isReady = isInitialized && !!roleInfo;
  
  const filteredMainItems = useMemo(() => {
    if (!isReady) {
      return [];
    }
    return getFilteredSidebarMainItems(filterOptions);
  }, [filterOptions, isReady]);
  
  const filteredSettingsItems = useMemo(() => {
    if (!isReady) {
      return [];
    }
    return getFilteredSidebarSettingsItems(filterOptions);
  }, [filterOptions, isReady]);
  
  const isLoading = !isReady;

  return (
    <View style={themedStyles.container}>
      {/* Safe area spacer */}
      <View style={{ height: insets.top + 8, backgroundColor: colors.background }} />
      
      {/* Sidebar Header with Logo + Business Name - navigates to profile */}
      <Pressable 
        style={({ pressed }) => [
          themedStyles.headerSection,
          pressed && { opacity: 0.8 }
        ]}
        onPress={() => router.push('/more/profile-edit' as any)}
        data-testid="sidebar-header-profile"
      >
        <View style={themedStyles.headerRow}>
          {/* Logo or Initials */}
          <View style={themedStyles.logoContainer}>
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={themedStyles.logo} resizeMode="cover" />
            ) : (
              <Text style={themedStyles.logoText}>
                {initials || businessName.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          {/* Business Name */}
          <View style={themedStyles.headerTextContainer}>
            <Text 
              style={themedStyles.businessName} 
              numberOfLines={1} 
              ellipsizeMode="tail"
            >
              {businessName || 'JobRunner'}
            </Text>
            <Text style={themedStyles.businessTagline}>
              Profile Settings
            </Text>
          </View>
        </View>
      </Pressable>

      <ScrollView 
        style={themedStyles.scrollView} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={themedStyles.scrollContent}
      >
        <View style={themedStyles.section}>
          <Text style={[themedStyles.sectionLabel, { color: colors.mutedForeground }]}>
            Main Menu
          </Text>
          {isLoading ? (
            <>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <View key={i} style={[styles.navItemPressable, { marginBottom: 2 }]}>
                  <View style={[styles.navItemRow, { opacity: 0.4 }]}>
                    <View style={{ width: 16, height: 16, backgroundColor: colors.muted, borderRadius: 4, marginRight: 10 }} />
                    <View style={{ flex: 1, height: 14, backgroundColor: colors.muted, borderRadius: 4 }} />
                  </View>
                </View>
              ))}
            </>
          ) : (
            filteredMainItems.map((item) => (
              <SidebarNavItemButton
                key={item.id}
                item={item}
                active={isSidebarPathActive(pathname, item)}
                onPress={() => handlePress(item)}
                colors={colors}
              />
            ))
          )}
        </View>

        {!isLoading && filteredSettingsItems.length > 0 && (
          <View style={themedStyles.section}>
            <Text style={[themedStyles.sectionLabel, { color: colors.mutedForeground }]}>
              Settings
            </Text>
            {filteredSettingsItems.map((item) => (
              <SidebarNavItemButton
                key={item.id}
                item={item}
                active={isSidebarPathActive(pathname, item)}
                onPress={() => handlePress(item)}
                colors={colors}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <View style={[themedStyles.footer, { borderTopColor: colors.border, paddingBottom: Math.max(12, insets.bottom) }]}>
        <Pressable 
          style={({ pressed }) => [
            themedStyles.logoutButton,
            pressed && { opacity: 0.7 }
          ]}
          onPress={async () => {
            // Await logout so auth state is cleared BEFORE we navigate.
            // Navigating to '/' while logout was still running raced the index
            // redirect, which still saw isAuthenticated=true and bounced back
            // to the dashboard. Go straight to the login screen instead.
            await useAuthStore.getState().logout();
            router.replace('/(auth)/login');
          }}
          data-testid="sidebar-logout"
        >
          <Feather name="log-out" size={16} color={colors.mutedForeground} />
          <Text style={[themedStyles.logoutText, { color: colors.mutedForeground }]}>Logout</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function getSidebarWidth(): number {
  return SIDEBAR_WIDTH;
}

const styles = StyleSheet.create({
  navItemPressable: {
    borderRadius: 6,
    marginBottom: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: 4,
    bottom: 4,
    width: 3,
    borderRadius: 2,
  },
  navItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    width: '100%',
  },
  navItemIcon: {
    marginRight: 10,
    width: 16,
    height: 16,
  },
  navItemLabel: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
});

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    width: SIDEBAR_WIDTH,
    height: '100%',
    backgroundColor: colors.background,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    flexGrow: 0,
    flexShrink: 0,
  },
  headerSection: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 14,
    paddingRight: 14,
  },
  logoContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  logo: {
    width: 40,
    height: 40,
  },
  logoText: {
    color: colors.primaryForeground,
    fontSize: 16,
    fontWeight: '700',
  },
  headerTextContainer: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  businessName: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 19,
    color: colors.foreground,
  },
  businessTagline: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 14,
    color: colors.mutedForeground,
  },
  scrollView: {
    flex: 1,
    flexGrow: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  section: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  footer: {
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 12,
    borderTopWidth: 1,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
    minHeight: 56,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
    flexShrink: 0,
  },
  avatarImage: {
    width: 36,
    height: 36,
  },
  avatarText: {
    color: colors.primaryForeground,
    fontSize: 12,
    fontWeight: '600',
  },
  userDetails: {
    flex: 1,
    flexShrink: 1,
    overflow: 'hidden',
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 0,
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    flexShrink: 0,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  planText: {
    fontSize: 11,
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 14,
    gap: 10,
  },
  logoutText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
