import { useMemo, useRef, useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Image, Animated, Easing, Platform, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../lib/store';
import { useTheme, ThemeColors } from '../lib/theme';
import { useAdvancedThemeStore } from '../lib/advanced-theme-store';
import { useNotificationsStore } from '../lib/notifications-store';
import { useUserRole } from '../hooks/use-user-role';
import { HEADER_HEIGHT, shadows, spacing, radius, typography } from '../lib/design-tokens';
import { BackgroundLocationIndicator } from './BackgroundLocationIndicator';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { api } from '../lib/api';
import { TeamAvatar } from './TeamAvatar';

const isIOS = Platform.OS === 'ios';

interface HeaderProps {
  title?: string;
  showSearch?: boolean;
  showBackButton?: boolean;
  showMenuButton?: boolean;
  showAvatar?: boolean;
  onBackPress?: () => void;
}

// Re-export for backward compatibility
export { HEADER_HEIGHT };

function HeaderIconButton({ 
  icon, 
  onPress, 
  color, 
  badge,
  colors,
}: { 
  icon: keyof typeof Feather.glyphMap; 
  onPress: () => void; 
  color: string;
  badge?: number;
  colors: ThemeColors;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 0.9,
        duration: 100,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0.7,
        duration: 100,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        tension: 400,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 150,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      android_ripple={{ color: 'transparent', borderless: true, radius: 22 }}
    >
      <Animated.View 
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale }],
          opacity,
        }}
      >
        <View style={{ position: 'relative' }}>
          <Feather name={icon} size={20} color={color} />
          {badge !== undefined && badge > 0 && (
            <View style={{
              position: 'absolute',
              top: -6,
              right: -6,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: colors.destructive,
              borderWidth: 2,
              borderColor: colors.background,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 9, fontWeight: '700', color: colors.destructiveForeground }}>
                {badge > 9 ? '9+' : badge}
              </Text>
            </View>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const getPageTitleFromPath = (pathname: string): string => {
  const path = pathname.replace(/^\/(tabs)\//, '/').replace(/^\(tabs\)\//, '/');
  
  if (path === '/' || path === '/index' || pathname.includes('(tabs)/index') || pathname === '/(tabs)') return 'Dashboard';
  if (path.startsWith('/jobs') || pathname.includes('(tabs)/jobs')) return 'Jobs';
  if (path.startsWith('/job/')) return 'Job Details';
  if (path.startsWith('/map') || pathname.includes('(tabs)/map')) return 'Map';
  if (path.startsWith('/money') || pathname.includes('(tabs)/money')) return 'Money';
  if (path.startsWith('/collect') || pathname.includes('(tabs)/collect')) return 'Collect Payment';
  if (path.startsWith('/profile') || pathname.includes('(tabs)/profile')) return 'Profile';
  if (pathname.includes('/more/chat-hub')) return 'Chat';
  if (pathname.includes('/more/team-chat')) return 'Team Chat';
  if (pathname.includes('/more/direct-messages')) return 'Messages';
  if (pathname.includes('/more/clients')) return 'Clients';
  if (pathname.includes('/more/client')) return 'Client';
  if (pathname.includes('/more/dispatch-board')) return 'Dispatch Board';
  if (pathname.includes('/more/reports')) return 'Reports';
  if (pathname.includes('/more/team-management')) return 'Team';
  if (pathname.includes('/more/team')) return 'Team';
  if (pathname.includes('/more/integrations')) return 'Integrations';
  if (pathname.includes('/more/business-settings') || pathname.includes('/more/app-settings')) return 'Settings';
  if (pathname.includes('/more/settings')) return 'Settings';
  if (pathname.includes('/more/invoices') || pathname.includes('/more/invoice')) return 'Invoices';
  if (pathname.includes('/more/quotes') || pathname.includes('/more/quote')) return 'Quotes';
  if (pathname.includes('/more/notifications')) return 'Notifications';
  if (pathname.includes('/more/search')) return 'Search';
  if (pathname.includes('/more/ai-assistant')) return 'AI Assistant';
  if (pathname.includes('/more/branding')) return 'Branding';
  if (pathname.includes('/more/payment-hub')) return 'Payment Hub';
  if (pathname.includes('/more/time-tracking')) return 'Time Tracking';
  if (pathname.includes('/more/subscription')) return 'Subscription';
  return '';
};

export function Header({ 
  title,
  showSearch = true, 
  showBackButton = false,
  showMenuButton = true,
  showAvatar = true,
  onBackPress,
}: HeaderProps) {
  const { user, isOwner: isOwnerFromStore, roleInfo, businessSettings } = useAuthStore();
  const { colors, isDark, setThemeMode, themeMode } = useTheme();
  const advancedSetMode = useAdvancedThemeStore(state => state.setMode);
  const advancedMode = useAdvancedThemeStore(state => state.mode);
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  // On very narrow phones the brand wordmark "JobRunner" can squeeze the page
  // title. Most Androids are 360dp+ (Galaxy S, Pixel) so we keep it visible
  // there. Only hide on truly tiny screens (<340dp = small/legacy Android).
  const isNarrowPhone = windowWidth < 340;
  const styles = useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);
  const { unreadCount } = useNotificationsStore();
  const pathname = usePathname();
  const { canAccessMap, isSubcontractor, isLoading: roleLoading } = useUserRole();
  const isManagerFromStore = /manager|admin|supervisor/i.test(roleInfo?.roleName || '');
  const cachedCanViewMap = isOwnerFromStore() || isManagerFromStore;
  // Map is open to every role — owners, managers, subcontractors and workers all
  // want to see their jobs (and the jobs assigned to them).
  const canViewMap = canAccessMap || isSubcontractor || (roleLoading && cachedCanViewMap) || true;
  
  const displayTitle = title || (!showMenuButton ? getPageTitleFromPath(pathname) : '');
  
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [multiBusinessCount, setMultiBusinessCount] = useState(0);
  const [pendingInviteCount, setPendingInviteCount] = useState(0);
  
  useEffect(() => {
    const fetchWorkspaceInfo = async () => {
      try {
        const [bizRes, invRes] = await Promise.all([
          api.getMyBusinesses(),
          api.getPendingInvites(),
        ]);
        if (bizRes.data) {
          setMultiBusinessCount(bizRes.data.businesses?.length || 0);
        }
        if (invRes.data) {
          setPendingInviteCount(invRes.data.invites?.length || 0);
        }
      } catch (err) {
        if (__DEV__) console.log('[Header] Could not fetch workspace info:', err);
      }
    };
    fetchWorkspaceInfo();
  }, []);
  
  // Subcontractors always get a prominent workspace switcher so they can hop
  // between Personal profile and any joined businesses (or join another).
  const showWorkspaceIndicator = multiBusinessCount > 1 || pendingInviteCount > 0 || isSubcontractor;
  
  const avatarScale = useRef(new Animated.Value(1)).current;
  
  const getUserInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.firstName) {
      return user.firstName[0].toUpperCase();
    }
    return 'U';
  };

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };

  const toggleTheme = () => {
    // Use advanced theme mode as the source of truth, fallback to themeMode
    const currentMode = advancedMode || themeMode;
    let newMode: 'light' | 'dark' | 'system';
    
    if (currentMode === 'light') {
      newMode = 'dark';
    } else if (currentMode === 'dark') {
      newMode = 'system';
    } else {
      newMode = 'light';
    }
    
    // Update both theme systems to stay in sync
    setThemeMode(newMode);
    advancedSetMode(newMode);
  };

  const handleAvatarPressIn = () => {
    Animated.timing(avatarScale, {
      toValue: 0.9,
      duration: 100,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  const handleAvatarPressOut = () => {
    Animated.spring(avatarScale, {
      toValue: 1,
      friction: 5,
      tension: 400,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <View style={styles.leftSection}>
          {showBackButton ? (
            <HeaderIconButton
              icon="arrow-left"
              onPress={handleBack}
              color={colors.foreground}
              colors={colors}
            />
          ) : showMenuButton ? (
            <View style={styles.brandContainer}>
              <Image 
                source={require('../../assets/jobrunner-logo-header.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                {!isNarrowPhone && (
                  <Text style={styles.brandName} numberOfLines={1}>JobRunner</Text>
                )}
                {showWorkspaceIndicator && (
                  <Pressable 
                    onPress={() => setShowSwitcher(true)} 
                    style={styles.businessBadge}
                  >
                    <Feather name={pendingInviteCount > 0 ? 'mail' : 'repeat'} size={10} color={pendingInviteCount > 0 ? colors.warning : colors.primary} />
                    <Text style={[styles.businessBadgeText, pendingInviteCount > 0 && { color: colors.warning }]} numberOfLines={1}>
                      {pendingInviteCount > 0 ? `${pendingInviteCount} invite${pendingInviteCount > 1 ? 's' : ''}` : (businessSettings?.businessName || 'Switch')}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          ) : null}
          
          {displayTitle && (showBackButton || !showMenuButton) && (
            <Text style={styles.pageTitleWithBack} numberOfLines={2} ellipsizeMode="tail">{displayTitle}</Text>
          )}
        </View>

        <View style={styles.rightSection}>
          <BackgroundLocationIndicator compact showLabel={false} />
          
          {showSearch && (
            <HeaderIconButton
              icon="search"
              onPress={() => router.push('/more/search')}
              color={colors.mutedForeground}
              colors={colors}
            />
          )}
          
          {canViewMap && (
            <HeaderIconButton
              icon="map"
              onPress={() => router.push('/(tabs)/map')}
              color={pathname === '/map' || pathname === '/(tabs)/map' ? colors.primary : colors.mutedForeground}
              colors={colors}
            />
          )}
          
          <HeaderIconButton
            icon={isDark ? 'sun' : 'moon'}
            onPress={toggleTheme}
            color={colors.mutedForeground}
            colors={colors}
          />
          
          <HeaderIconButton
            icon="bell"
            onPress={() => router.push('/more/notifications-inbox')}
            color={colors.mutedForeground}
            badge={unreadCount}
            colors={colors}
          />
          
          {showAvatar && (
            <Pressable 
              onPress={() => router.push('/(tabs)/profile')}
              onPressIn={handleAvatarPressIn}
              onPressOut={handleAvatarPressOut}
            >
              <Animated.View 
                style={[
                  styles.avatarButton,
                  { transform: [{ scale: avatarScale }] }
                ]}
              >
                <TeamAvatar
                  firstName={user?.firstName || undefined}
                  lastName={user?.lastName || undefined}
                  email={user?.email || undefined}
                  userId={user?.id ? String(user.id) : undefined}
                  profileImageUrl={(user as any)?.profileImageUrl}
                  size={32}
                />
              </Animated.View>
            </Pressable>
          )}
        </View>
      </View>
      <WorkspaceSwitcher
        visible={showSwitcher}
        onClose={() => setShowSwitcher(false)}
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
              if (__DEV__) console.log('[Header] Could not refresh workspace info:', err);
            }
          };
          refetch();
        }}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors, topInset: number) => StyleSheet.create({
  header: {
    backgroundColor: colors.background,
    paddingTop: topInset,
    ...shadows.header as object,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    height: HEADER_HEIGHT,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
    minWidth: 0,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 8,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  logo: {
    width: 34,
    height: 34,
    borderRadius: 8,
  },
  // Use typography presets so brand + page title share the same font
  // pipeline as card text (Inter on Android, System/SF on iOS via the
  // global text-defaults patch). Previously these used raw fontSize/
  // fontWeight which on iOS reads as San Francisco at non-standard weights
  // and visually clashes with card text rendered through typography presets.
  brandName: {
    ...typography.headline,
    color: colors.primary,
    flexShrink: 1,
  },
  pageTitleWithBack: {
    ...typography.cardTitle,
    fontSize: 19,
    color: colors.foreground,
    flex: 1,
    flexShrink: 1,
    lineHeight: 22,
  },
  businessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  businessBadgeText: {
    ...typography.label,
    textTransform: 'none',
    letterSpacing: 0,
    color: colors.primary,
    maxWidth: 120,
  },
  avatarButton: {
    marginLeft: 2,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
});
