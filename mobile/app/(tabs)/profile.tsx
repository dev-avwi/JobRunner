import { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuthStore } from '../../src/lib/store';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { useUserRole, type UserRoleType } from '../../src/hooks/use-user-role';
import { spacing, radius, shadows, typography, iconSizes, sizes, usePageShell, fontWeights } from '../../src/lib/design-tokens';
import { useBottomInset } from '../../src/components/ui/BottomInsetSpacer';
import { 
  getMorePageItemsByCategory, 
  categoryOrder,
  type NavItem,
  type FilterOptions,
  type UserRole,
} from '../../src/lib/navigation-config';
import { useScrollToTop } from '../../src/contexts/ScrollContext';
import { usePreserveScrollOnFold } from '../../src/hooks/usePreserveScrollOnFold';
import { WorkspaceSwitcher } from '../../src/components/WorkspaceSwitcher';
import { api } from '../../src/lib/api';
import { TeamAvatar } from '../../src/components/TeamAvatar';

const categoryMeta: Record<string, { icon: keyof typeof Feather.glyphMap; label: string; colorKey: string; description?: string }> = {
  featured: { icon: 'zap', label: 'Featured', colorKey: 'warning', description: 'Smart tools & automation' },
  work: { icon: 'briefcase', label: 'Work', colorKey: 'primary', description: 'Jobs, scheduling & tracking' },
  addons: { icon: 'cpu', label: 'Add-ons', colorKey: 'primary', description: 'AI & automation extras' },
  money: { icon: 'dollar-sign', label: 'Money', colorKey: 'success', description: 'Quotes, invoices & payments' },
  team: { icon: 'users', label: 'Team', colorKey: 'info', description: 'Manage your crew' },
  communication: { icon: 'message-circle', label: 'Comms', colorKey: 'info', description: 'Chat & messaging' },
  settings: { icon: 'settings', label: 'Settings', colorKey: 'muted', description: 'Preferences & config' },
  legal: { icon: 'shield', label: 'Legal', colorKey: 'muted' },
  account: { icon: 'user', label: 'Account', colorKey: 'muted' },
  admin: { icon: 'shield', label: 'Admin', colorKey: 'destructive' },
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    minHeight: 80,
    ...shadows.md,
  },
  avatar: {
    width: sizes.avatarLg,
    height: sizes.avatarLg,
    borderRadius: sizes.avatarLg / 2,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  avatarText: {
    ...typography.subtitle,
    color: colors.primary,
    fontWeight: fontWeights.bold,
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    ...typography.subtitle,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  userEmail: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  businessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  businessName: {
    ...typography.captionSmall,
    fontWeight: fontWeights.medium,
    color: colors.primary,
  },
  quickActionsContainer: {
    marginBottom: spacing.lg,
  },
  quickActionsLabel: {
    ...typography.label,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.foreground,
    marginBottom: spacing.sm,
    paddingLeft: spacing.xs,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickActionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  quickActionIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionText: {
    ...typography.caption,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  categoryTabsContainer: {
    marginBottom: spacing.md,
  },
  categoryTabsScroll: {
    marginBottom: spacing.xs,
  },
  categoryTabsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
  },
  categoryTabActive: {
    backgroundColor: colors.primary,
  },
  categoryTabText: {
    ...typography.caption,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
  },
  categoryTabTextActive: {
    color: colors.primaryForeground || colors.white,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
    paddingLeft: spacing.xs,
    paddingVertical: spacing.sm,
  },
  sectionHeaderIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderTextContainer: {
    flex: 1,
  },
  sectionTitle: {
    ...typography.subtitle,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
  },
  sectionDescription: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginTop: 1,
  },
  sectionCount: {
    ...typography.captionSmall,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    ...shadows.md,
  },
  featuredSection: {
    borderColor: colors.warning,
    borderWidth: 1.5,
    backgroundColor: colors.isDark 
      ? `${colors.warningLight}` 
      : colors.card,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    minHeight: 52,
  },
  menuItemIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  menuItemTitle: {
    ...typography.body,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
  },
  menuItemSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  badgeText: {
    ...typography.badge,
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
  },
  footerText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  versionText: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  itemCount: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    paddingLeft: spacing.xs,
    marginBottom: spacing.sm,
  },
});

interface MenuItemProps {
  icon: keyof typeof Feather.glyphMap;
  iconBg?: string;
  iconColor?: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
  destructive?: boolean;
  isLast?: boolean;
  badge?: string;
  badgeBg?: string;
  badgeColor?: string;
  locked?: boolean;
  lockReason?: string;
}

function MenuItem({ 
  icon, 
  iconBg,
  iconColor,
  title, 
  subtitle, 
  onPress, 
  destructive = false, 
  isLast = false, 
  badge,
  badgeBg,
  badgeColor,
  locked = false,
  lockReason,
}: MenuItemProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const effectiveIconBg = locked ? (colors.muted || '#f3f4f6') : (iconBg || colors.primaryLight);
  const effectiveIconColor = locked ? colors.mutedForeground : (iconColor || colors.primary);
  const effectiveBadgeBg = locked ? colors.warningLight : (badgeBg || colors.successLight);
  const effectiveBadgeColor = locked ? colors.warning : (badgeColor || colors.success);
  
  const handlePress = () => {
    if (locked) {
      Alert.alert(
        'Plan Required',
        lockReason || 'This feature is available on a higher plan. Upgrade in the Subscription page.',
        [
          { text: 'OK', style: 'cancel' },
          { text: 'View My Plan', onPress: () => router.push('/more/subscription') },
        ]
      );
    } else {
      onPress();
    }
  };
  
  return (
    <PressableRow onPress={handlePress} style={[ styles.menuItem, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, locked && { opacity: 0.6 } ]} >
      <View style={[styles.menuItemIcon, { backgroundColor: effectiveIconBg }]}>
        <Feather name={locked ? 'lock' : icon} size={iconSizes.lg} color={effectiveIconColor} />
      </View>
      <View style={styles.menuItemContent}>
        <View style={styles.menuItemTitleRow}>
          <Text style={[
            styles.menuItemTitle, 
            destructive && { color: colors.destructive }
          ]}>
            {title}
          </Text>
          {badge && (
            <View style={[styles.badge, { backgroundColor: effectiveBadgeBg }]}>
              <Text style={[styles.badgeText, { color: effectiveBadgeColor }]}>{badge}</Text>
            </View>
          )}
        </View>
        {subtitle && (
          <Text style={styles.menuItemSubtitle} numberOfLines={1}>{subtitle}</Text>
        )}
      </View>
      <Feather 
        name={locked ? 'lock' : 'chevron-right'} 
        size={iconSizes.lg} 
        color={locked ? colors.warning : (destructive ? colors.destructive : colors.mutedForeground)} 
      />
    </PressableRow>
  );
}

function getColorValues(colorKey: string | undefined, colors: ThemeColors): { bg: string; fg: string } {
  switch (colorKey) {
    case 'primary':
      return { bg: colors.primaryLight, fg: colors.primary };
    case 'success':
      return { bg: colors.successLight, fg: colors.success };
    case 'warning':
      return { bg: colors.warningLight, fg: colors.warning };
    case 'info':
      return { bg: colors.infoLight, fg: colors.info };
    case 'muted':
      return { bg: colors.muted, fg: colors.mutedForeground };
    case 'destructive':
      return { bg: colors.destructiveLight, fg: colors.destructive };
    default:
      return { bg: colors.primaryLight, fg: colors.primary };
  }
}

function getBadgeColors(colorKey: string | undefined, colors: ThemeColors): { bg: string; fg: string } {
  switch (colorKey) {
    case 'warning':
      return { bg: colors.warningLight, fg: colors.warning };
    case 'success':
      return { bg: colors.successLight, fg: colors.success };
    case 'destructive':
      return { bg: colors.destructiveLight, fg: colors.destructive };
    case 'info':
      return { bg: colors.infoLight, fg: colors.info };
    default:
      return { bg: colors.successLight, fg: colors.success };
  }
}

function mapRoleToFilterRole(role: UserRoleType): UserRole {
  if (role === 'staff') return 'staff_tradie';
  if (role === 'subcontractor') return 'subcontractor';
  if (role === 'loading') return 'staff_tradie';
  return role as UserRole;
}

export default function MoreScreen() {
  const { user, businessSettings, logout } = useAuthStore();
  const { colors } = useTheme();
  const responsiveShell = usePageShell();
  const bottomInset = useBottomInset(40);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView | null>(null);
  const { scrollToTopTrigger } = useScrollToTop();
  const { onScroll: preserveOnScroll, scrollEventThrottle } = usePreserveScrollOnFold(scrollRef);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [showWorkspaceSwitcher, setShowWorkspaceSwitcher] = useState(false);
  const [multiBusinessCount, setMultiBusinessCount] = useState(0);
  const [pendingInviteCount, setPendingInviteCount] = useState(0);
  
  useEffect(() => {
    const fetchWorkspaceInfo = async () => {
      try {
        const [bizRes, invRes] = await Promise.all([
          api.getMyBusinesses(),
          api.getPendingInvites(),
        ]);
        if (bizRes.data) setMultiBusinessCount(bizRes.data.businesses?.length || 0);
        if (invRes.data) setPendingInviteCount(invRes.data.invites?.length || 0);
      } catch (err) {
        if (__DEV__) console.log('[Profile] Could not fetch workspace info:', err);
      }
    };
    fetchWorkspaceInfo();
  }, []);
  
  useEffect(() => {
    if (scrollToTopTrigger > 0) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  }, [scrollToTopTrigger]);
  
  const { 
    role,
    isLoading: isRoleLoading,
    isStaff, 
    isSubcontractor,
    isStandaloneSubcontractor,
    isSolo,
    hasTeamAccess,
    canAccessTeamPages,
    hasTeamSubscription,
    hasProSubscription,
    isOwner,
    isManager,
    canAccessBilling,
    permissions,
  } = useUserRole();

  // A subcontractor in their OWN Personal profile has full owner powers
  // (server returns isOwner:true). The Quick Create FAB already unlocks
  // create for them, so the More menu must match: treat them as a solo
  // owner so Clients / Documents / Payment Hub and the rest of the solo
  // work tools appear instead of the locked-worker subset. A subcontractor
  // switched INTO a joined business stays a worker (isStandalone=false).
  const filterOptions: FilterOptions = useMemo(() => ({
    isTeam: canAccessTeamPages && !isSolo,
    isTradie: isStandaloneSubcontractor ? false : isStaff,
    isOwner: isOwner || isStandaloneSubcontractor,
    isManager,
    isSolo: isSolo || isStandaloneSubcontractor,
    isSubcontractor: isStandaloneSubcontractor ? false : isSubcontractor,
    isStandaloneSubcontractor,
    userRole: isStandaloneSubcontractor ? 'solo_owner' : mapRoleToFilterRole(role),
    isPlatformAdmin: user?.isPlatformAdmin || false,
    hasProSubscription,
    hasTeamSubscription,
    isSimpleMode: businessSettings?.simpleMode || false,
    permissions,
  }), [canAccessTeamPages, isSolo, isStaff, isSubcontractor, isStandaloneSubcontractor, isOwner, isManager, role, user?.isPlatformAdmin, hasProSubscription, hasTeamSubscription, businessSettings?.simpleMode, permissions]);

  const categorizedItems = useMemo(() => 
    getMorePageItemsByCategory(filterOptions), 
    [filterOptions]
  );

  const visibleCategories = useMemo(() => {
    const cats: string[] = [];
    for (const key of categoryOrder) {
      const items = categorizedItems[key] || [];
      if (items.length > 0) {
        cats.push(key);
      }
    }
    return cats;
  }, [categorizedItems]);

  const allItems = useMemo(() => {
    const items: NavItem[] = [];
    for (const key of categoryOrder) {
      const catItems = categorizedItems[key] || [];
      items.push(...catItems);
    }
    return items;
  }, [categorizedItems]);

  const filteredCategories = useMemo(() => {
    if (activeCategory === 'all') return visibleCategories;
    return visibleCategories.filter(k => k === activeCategory);
  }, [activeCategory, visibleCategories]);

  const [signingOut, setSigningOut] = useState(false);

  // While signing out, logout() clears the role cache before this screen
  // unmounts, so useUserRole briefly re-resolves to the full owner role and
  // the owner menu flashes. Keep the skeleton up through sign-out to hide it.
  const showSkeleton = isRoleLoading || signingOut;

  const handleLogout = () => {
    if (signingOut) return;
    Alert.alert(
      'Sign out?',
      "You'll need to sign back in.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setSigningOut(true);
            try {
              await logout();
              router.replace('/(auth)/login');
            } catch {
              setSigningOut(false);
            }
          },
        },
      ],
    );
  };

  const getInitials = () => {
    const first = user?.firstName?.[0] || '';
    const last = user?.lastName?.[0] || '';
    return (first + last).toUpperCase() || 'T';
  };

  const handleNavItemPress = (item: NavItem) => {
    router.push(item.url as any);
  };

  const quickActions = useMemo(() => {
    if (isStaff) return [];
    const actions: { icon: keyof typeof Feather.glyphMap; label: string; route: string; bg: string; fg: string }[] = [];
    actions.push({ icon: 'plus-circle', label: 'New Job', route: '/more/create-job', bg: colors.primaryLight, fg: colors.primary });
    actions.push({ icon: 'file-text', label: 'Invoice', route: '/more/invoices', bg: colors.successLight, fg: colors.success });
    actions.push({ icon: 'clock', label: 'Time', route: '/more/time-tracking', bg: colors.infoLight, fg: colors.info });
    actions.push({ icon: 'help-circle', label: 'Help', route: '/more/support', bg: colors.muted, fg: colors.mutedForeground });
    return actions;
  }, [isStaff, isOwner, isManager, isSolo, hasTeamSubscription, colors]);

  const renderSectionHeader = (categoryKey: string) => {
    if (activeCategory !== 'all') return null;
    const meta = categoryMeta[categoryKey];
    if (!meta || !meta.label) return null;
    const colorVals = getColorValues(meta.colorKey, colors);
    const itemCount = (categorizedItems[categoryKey] || []).length;
    
    return (
      <View style={styles.sectionHeaderRow}>
        <View style={[styles.sectionHeaderIcon, { backgroundColor: colorVals.bg }]}>
          <Feather name={meta.icon} size={16} color={colorVals.fg} />
        </View>
        <View style={styles.sectionHeaderTextContainer}>
          <Text style={styles.sectionTitle}>{meta.label}</Text>
          {meta.description && (
            <Text style={styles.sectionDescription}>{meta.description}</Text>
          )}
        </View>
        <Text style={styles.sectionCount}>{itemCount}</Text>
      </View>
    );
  };

  const renderSection = (categoryKey: string, items: NavItem[]) => {
    if (items.length === 0) return null;
    
    const isFeatured = categoryKey === 'featured';
    
    return (
      <View key={categoryKey}>
        {renderSectionHeader(categoryKey)}
        <View style={[styles.section, isFeatured && styles.featuredSection]}>
          {items.map((item, index) => {
            const catMeta = categoryMeta[categoryKey];
            const categoryColor = catMeta?.colorKey || 'primary';
            const effectiveColor = (item.color !== 'primary' ? item.color : categoryColor) || 'primary';
            const colorValues = getColorValues(effectiveColor, colors);
            const badgeColorValues = getBadgeColors(item.color, colors);
            const isLast = index === items.length - 1;
            
            return (
              <MenuItem
                key={item.url}
                icon={item.icon}
                iconBg={colorValues.bg}
                iconColor={colorValues.fg}
                title={item.title}
                subtitle={item.description}
                badge={item.badge}
                badgeBg={badgeColorValues.bg}
                badgeColor={badgeColorValues.fg}
                onPress={() => handleNavItemPress(item)}
                isLast={isLast}
                locked={item.locked}
                lockReason={item.lockReason}
              />
            );
          })}
        </View>
      </View>
    );
  };

  const responsiveContentStyle = useMemo(() => ({
    padding: responsiveShell.paddingHorizontal,
    paddingBottom: bottomInset,
  }), [responsiveShell, bottomInset]);

  const totalItemCount = allItems.length;

  return (
    <ScrollView 
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={responsiveContentStyle}
      showsVerticalScrollIndicator={false}
      onScroll={preserveOnScroll}
      scrollEventThrottle={scrollEventThrottle}
    >
      <PressableRow style={styles.profileHeader} onPress={() => router.push('/more/profile-edit')} >
        <TeamAvatar
          firstName={user?.firstName || undefined}
          lastName={user?.lastName || undefined}
          email={user?.email || undefined}
          userId={user?.id ? String(user.id) : undefined}
          profileImageUrl={(user as any)?.profileImageUrl}
          size={52}
        />
        <View style={styles.profileInfo}>
          <Text style={styles.userName}>
            {user?.firstName} {user?.lastName}
          </Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          {businessSettings?.businessName && (
            <View style={styles.businessRow}>
              <Feather name="briefcase" size={iconSizes.md} color={colors.primary} />
              <Text style={styles.businessName}>{businessSettings.businessName}</Text>
            </View>
          )}
          {(isOwner || isStaff) && (
            <View style={[styles.businessRow, { marginTop: spacing.xs }]}>
              <View style={{
                backgroundColor: isSubcontractor ? colors.warningLight : (isOwner ? colors.primaryLight : colors.infoLight),
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
                borderRadius: radius.full,
              }}>
                <Text style={{
                  ...typography.captionSmall,
                  fontWeight: fontWeights.semibold,
                  color: isSubcontractor ? colors.warning : (isOwner ? colors.primary : colors.info),
                }}>{isSubcontractor ? 'Subcontractor' : (isOwner ? 'Owner' : 'Team Member')}</Text>
              </View>
            </View>
          )}
        </View>
        <Feather name="chevron-right" size={iconSizes.xl} color={colors.mutedForeground} />
      </PressableRow>

      {(multiBusinessCount > 1 || pendingInviteCount > 0) && (
        <PressableRow style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: pendingInviteCount> 0 ? colors.warningLight : colors.primaryLight, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: pendingInviteCount > 0 ? colors.warning : colors.primary, gap: spacing.md, }} onPress={() => setShowWorkspaceSwitcher(true)} >
          <View style={{
            width: 40,
            height: 40,
            borderRadius: radius.lg,
            backgroundColor: pendingInviteCount > 0 ? colors.warning : colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Feather name={pendingInviteCount > 0 ? 'mail' : 'repeat'} size={18} color={pendingInviteCount > 0 ? colors.white : colors.primaryForeground} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.body, fontWeight: fontWeights.semibold, color: colors.foreground }}>
              {pendingInviteCount > 0 ? 'Pending Invitations' : 'Switch Workspace'}
            </Text>
            <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: 2 }}>
              {pendingInviteCount > 0 
                ? `${pendingInviteCount} invitation${pendingInviteCount > 1 ? 's' : ''} waiting` 
                : `${multiBusinessCount} connected businesses`}
            </Text>
          </View>
          <Feather name="chevron-right" size={iconSizes.lg} color={pendingInviteCount > 0 ? colors.warning : colors.primary} />
        </PressableRow>
      )}

      <WorkspaceSwitcher
        visible={showWorkspaceSwitcher}
        onClose={() => setShowWorkspaceSwitcher(false)}
        onSwitch={() => {
          const refetch = async () => {
            try {
              const [bizRes, invRes] = await Promise.all([
                api.getMyBusinesses(),
                api.getPendingInvites(),
              ]);
              if (bizRes.data) setMultiBusinessCount(bizRes.data.businesses?.length || 0);
              if (invRes.data) setPendingInviteCount(invRes.data.invites?.length || 0);
            } catch (err) {
              if (__DEV__) console.log('[Profile] Could not refresh workspace info:', err);
            }
          };
          refetch();
        }}
      />

      {showSkeleton && (
        <View style={styles.section}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={{
                height: 56,
                borderRadius: radius.md,
                backgroundColor: colors.muted,
                marginBottom: spacing.sm,
                opacity: 0.5,
              }}
            />
          ))}
        </View>
      )}

      {!showSkeleton && quickActions.length > 0 && (
        <View style={styles.quickActionsContainer}>
          <Text style={styles.quickActionsLabel}>Quick Actions</Text>
          <View style={styles.quickActionsRow}>
            {quickActions.map((action) => (
              <PressableRow key={action.route} style={styles.quickActionBtn} onPress={() => router.push(action.route as any)} >
                <View style={[styles.quickActionIcon, { backgroundColor: action.bg }]}>
                  <Feather name={action.icon} size={18} color={action.fg} />
                </View>
                <Text style={styles.quickActionText}>{action.label}</Text>
              </PressableRow>
            ))}
          </View>
        </View>
      )}

      {!showSkeleton && (
      <View style={styles.categoryTabsContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.categoryTabsScroll}
        >
          <View style={styles.categoryTabsRow}>
            <PressableRow style={[styles.categoryTab, activeCategory === 'all' && styles.categoryTabActive]} onPress={() => setActiveCategory('all')} >
              <Text style={[styles.categoryTabText, activeCategory === 'all' && styles.categoryTabTextActive]}>
                All
              </Text>
            </PressableRow>
            {visibleCategories.map(catKey => {
              const meta = categoryMeta[catKey];
              if (!meta) return null;
              const isActive = activeCategory === catKey;
              const catColorVals = getColorValues(meta.colorKey, colors);
              return (
                <PressableRow key={catKey} style={[ styles.categoryTab, isActive && { backgroundColor: catColorVals.fg }, ]} onPress={() => setActiveCategory(catKey)} >
                  <Feather 
                    name={meta.icon} 
                    size={14} 
                    color={isActive ? colors.white : colors.mutedForeground} 
                  />
                  <Text style={[
                    styles.categoryTabText, 
                    isActive && { color: colors.white },
                  ]}>
                    {meta.label}
                  </Text>
                </PressableRow>
              );
            })}
          </View>
        </ScrollView>
        {activeCategory === 'all' && (
          <Text style={styles.itemCount}>{totalItemCount} features available</Text>
        )}
        {activeCategory !== 'all' && (
          <Text style={styles.itemCount}>
            {(categorizedItems[activeCategory] || []).length} items in {categoryMeta[activeCategory]?.label || activeCategory}
          </Text>
        )}
      </View>
      )}

      {!showSkeleton && filteredCategories.filter(k => k !== 'account').map(categoryKey => 
        renderSection(categoryKey, categorizedItems[categoryKey] || [])
      )}

      {!showSkeleton && (activeCategory === 'all' || activeCategory === 'account') && (
        <>
          {activeCategory === 'all' && renderSectionHeader('account')}
          <View style={styles.section}>
            {(categorizedItems.account || []).map((item, index) => {
              const colorValues = getColorValues(item.color, colors);
              const badgeColorValues = getBadgeColors(item.color, colors);
              return (
                <MenuItem
                  key={item.url}
                  icon={item.icon}
                  iconBg={colorValues.bg}
                  iconColor={colorValues.fg}
                  title={item.title}
                  subtitle={item.description}
                  badge={item.badge}
                  badgeBg={badgeColorValues.bg}
                  badgeColor={badgeColorValues.fg}
                  onPress={() => handleNavItemPress(item)}
                  locked={item.locked}
                  lockReason={item.lockReason}
                />
              );
            })}
            <MenuItem
              icon="log-out"
              iconBg={colors.destructiveLight}
              iconColor={colors.destructive}
              title="Sign Out"
              onPress={handleLogout}
              destructive
              isLast
            />
          </View>
        </>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>JobRunner Mobile</Text>
        <Text style={styles.versionText}>Version 1.1.0</Text>
      </View>

      <View style={{ height: spacing['4xl'] }} />
    </ScrollView>
  );
}
