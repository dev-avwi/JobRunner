import { useMemo, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme, ThemeColors } from '../lib/theme';
import { useScrollToTop } from '../contexts/ScrollContext';
import { isIPad } from '../lib/device';
import { useNotificationsStore } from '../lib/notifications-store';
import { useAuthStore } from '../lib/store';

interface NavItem {
  title: string;
  icon: keyof typeof Feather.glyphMap;
  path: string;
  matchPaths?: string[];
}

const defaultNavItems: NavItem[] = [
  { 
    title: 'Dashboard', 
    icon: 'home', 
    path: '/',
    matchPaths: ['/', '/index']
  },
  { 
    title: 'Work', 
    icon: 'briefcase', 
    path: '/jobs',
    matchPaths: ['/jobs', '/job']
  },
  { 
    title: 'Chat', 
    icon: 'message-circle', 
    path: '/more/chat-hub',
    matchPaths: ['/more/chat-hub', '/more/team-chat', '/more/direct-messages']
  },
  { 
    title: 'More', 
    icon: 'more-horizontal', 
    path: '/profile',
    matchPaths: ['/profile', '/more', '/money', '/more/invoices', '/more/quotes', '/more/payment-hub', '/collect']
  },
];

const subcontractorNavItems: NavItem[] = [
  { 
    title: 'Dashboard', 
    icon: 'home', 
    path: '/',
    matchPaths: ['/', '/index']
  },
  { 
    title: 'My Jobs', 
    icon: 'briefcase', 
    path: '/jobs',
    matchPaths: ['/jobs', '/job']
  },
  { 
    title: 'Chat', 
    icon: 'message-circle', 
    path: '/more/chat-hub',
    matchPaths: ['/more/chat-hub', '/more/team-chat', '/more/direct-messages']
  },
  { 
    title: 'More', 
    icon: 'more-horizontal', 
    path: '/profile',
    matchPaths: ['/profile', '/more', '/money', '/more/invoices', '/more/quotes', '/more/payment-hub', '/collect']
  },
];

// iPad uses a taller bottom nav for better touch targets
export const BOTTOM_NAV_HEIGHT = 64;
export const BOTTOM_NAV_HEIGHT_IPAD = 80;

function NavButton({ 
  item, 
  active, 
  onPress,
  colors,
  styles,
  isPad,
  badgeCount,
}: { 
  item: NavItem; 
  active: boolean; 
  onPress: () => void;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
  isPad: boolean;
  badgeCount?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 0.95,
        duration: 100,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0.8,
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
    >
      <Animated.View 
        style={[
          styles.navButton,
          active && styles.navButtonActive,
          { transform: [{ scale }], opacity }
        ]}
      >
        <View style={{ position: 'relative' }}>
          <Feather 
            name={item.icon} 
            size={isPad ? 24 : 22}
            color={active ? colors.primary : colors.mutedForeground}
          />
          {badgeCount != null && badgeCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {badgeCount > 99 ? '99+' : badgeCount}
              </Text>
            </View>
          )}
        </View>
        <Text style={[
          styles.navLabel,
          active && styles.navLabelActive,
        ]}>
          {item.title}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const isPadDevice = isIPad();
  const styles = useMemo(() => createStyles(colors, isPadDevice), [colors, isPadDevice]);
  const { triggerScrollToTop } = useScrollToTop();
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const { roleInfo } = useAuthStore();
  
  const isSubcontractorRole = roleInfo?.roleName?.toLowerCase() === 'subcontractor' || roleInfo?.roleName?.toLowerCase() === 'sub_contractor';
  const navItems = isSubcontractorRole ? subcontractorNavItems : defaultNavItems;

  const isActive = (item: NavItem) => {
    const chatRoutes = ['/more/chat-hub', '/more/team-chat', '/more/direct-messages', '/more/sms-conversation', '/more/new-sms-conversation'];
    const isChatRoute = chatRoutes.some(r => pathname === r || pathname.startsWith(r + '/'));
    if (isChatRoute) {
      return item.title === 'Chat';
    }

    const jobChatMatch = pathname.match(/^\/job\/[^/]+\/chat/);
    if (jobChatMatch) {
      return item.title === 'Chat';
    }
    
    if (item.matchPaths) {
      return item.matchPaths.some(p => pathname === p || pathname.startsWith(p + '/'));
    }
    return pathname === item.path;
  };

  const isOnMainPage = (item: NavItem) => {
    // Check if we're on the exact main page for this tab (not a subpage)
    return pathname === item.path || 
           (item.path === '/' && (pathname === '/' || pathname === '/index'));
  };

  const handlePress = (item: NavItem) => {
    if (isActive(item)) {
      if (isOnMainPage(item)) {
        triggerScrollToTop();
      } else {
        router.replace(item.path as any);
      }
    } else {
      router.replace(item.path as any);
    }
  };

  const bottomPadding = Math.max(insets.bottom, 8);
  const totalHeight = (isPadDevice ? BOTTOM_NAV_HEIGHT_IPAD : BOTTOM_NAV_HEIGHT) + bottomPadding;
  const containerStyle = [styles.container, { paddingBottom: bottomPadding, height: totalHeight }];

  return (
    <View style={containerStyle}>
      <View style={styles.gapCover} />
      <View style={styles.navBar}>
        {navItems.map((item) => (
          <NavButton
            key={item.title}
            item={item}
            active={isActive(item)}
            onPress={() => handlePress(item)}
            colors={colors}
            styles={styles}
            isPad={isPadDevice}
            badgeCount={item.title === 'Chat' ? unreadCount : undefined}
          />
        ))}
      </View>
    </View>
  );
}

export function getBottomNavHeight(bottomInset: number): number {
  const navHeight = isIPad() ? BOTTOM_NAV_HEIGHT_IPAD : BOTTOM_NAV_HEIGHT;
  return navHeight + Math.max(bottomInset, 8);
}

const createStyles = (colors: ThemeColors, isPad: boolean = false) => StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    borderTopWidth: 0,
    borderTopColor: 'transparent',
    elevation: 0,
    shadowOpacity: 0,
    zIndex: 100,
  },
  gapCover: {
    position: 'absolute',
    top: -16,
    left: 0,
    right: 0,
    height: 16,
    backgroundColor: colors.background,
    zIndex: 100,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    height: isPad ? BOTTOM_NAV_HEIGHT_IPAD : BOTTOM_NAV_HEIGHT,
    paddingHorizontal: isPad ? 24 : 8,
  },
  navButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: isPad ? 12 : 8,
    paddingHorizontal: isPad ? 24 : 16,
    borderRadius: 9999,
    gap: isPad ? 4 : 2,
    position: 'relative',
  },
  navButtonActive: {
    backgroundColor: colors.primaryLight,
  },
  navLabel: {
    fontSize: isPad ? 13 : 11,
    fontWeight: '500',
    color: colors.mutedForeground,
    marginTop: isPad ? 4 : 2,
    letterSpacing: 0.1,
  },
  navLabelActive: {
    fontWeight: '700',
    color: colors.primary,
  },
  badge: {
    position: 'absolute' as const,
    top: -4,
    right: -8,
    backgroundColor: colors.destructive || '#ef4444',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 4,
    zIndex: 10,
  },
  badgeText: {
    color: colors.destructiveForeground,
    fontSize: 10,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
  },
});
