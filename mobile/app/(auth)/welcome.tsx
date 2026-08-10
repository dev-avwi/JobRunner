import { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  Image,
  ListRenderItemInfo,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/lib/theme';
import { fontWeights } from '../../src/lib/design-tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PHONE_W       = SCREEN_WIDTH * 0.60;
const PHONE_H       = PHONE_W * 2.06;
// How far the phone bottom sinks below the colour-area edge into the white sheet
const PHONE_OVERLAP = 100;

const slides = [
  {
    key: 'dashboard',
    image: require('../../assets/welcome/dashboard.png'),
    bg: '#DBEAFE',
    headline: 'Run every job,\nend to end.',
    subtitle: 'Schedule jobs, track your team and stay on top of your day — all in one place.',
  },
  {
    key: 'map',
    image: require('../../assets/welcome/map.png'),
    bg: '#D1FAE5',
    headline: 'See your whole\nteam, live.',
    subtitle: "Watch who's where, who's working and which jobs are active — in real time.",
  },
  {
    key: 'quote',
    image: require('../../assets/welcome/quote.png'),
    bg: '#FFEDD5',
    headline: 'Quote, invoice\nand get paid.',
    subtitle: "Send professional quotes in seconds and get notified the moment you're paid.",
  },
] as const;

export default function WelcomeScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleMomentumScrollEnd = useCallback((event: any) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCurrentIndex(index);
  }, []);

  const renderSlide = useCallback(({ item }: ListRenderItemInfo<typeof slides[number]>) => {
    return (
      <View style={[styles.slide, { backgroundColor: item.bg }]}>

        {/* ── Brand row — top of the coloured area ── */}
        <View style={[styles.topRow, { paddingTop: insets.top + 14 }]}>
          <View style={styles.brand}>
            <Image
              source={require('../../assets/jobrunner-logo-header.png')}
              style={styles.brandIcon}
              resizeMode="contain"
            />
            <Text style={styles.brandText}>JobRunner</Text>
          </View>
        </View>

        {/* ── Phone area — fills the remaining colour space, phone hangs below ── */}
        <View style={styles.phoneArea}>
          <View style={styles.phoneWrap}>
            <Image source={item.image} style={styles.phone} resizeMode="contain" />
          </View>
        </View>

        {/* ── White sheet — phone overlaps from above ── */}
        <View style={styles.sheet}>
          {/* Spacer so headline starts below the overlapping phone */}
          <View style={{ height: PHONE_OVERLAP + 16 }} />
          <Text style={[styles.headline, { color: colors.foreground }]}>{item.headline}</Text>
          <Text style={[styles.slideSubtitle, { color: colors.mutedForeground }]}>{item.subtitle}</Text>
        </View>
      </View>
    );
  }, [insets.top, colors]);

  return (
    // Root bg matches the first slide — prevents any white flash at edges
    <View style={[styles.root, { backgroundColor: slides[currentIndex].bg }]}>

      {/* Carousel */}
      <FlatList
        ref={flatListRef}
        data={slides as unknown as typeof slides[number][]}
        renderItem={renderSlide as any}
        keyExtractor={(item: any) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
        style={styles.list}
        bounces={false}
        extraData={currentIndex}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {/* ── Sticky bottom — white, continues the white sheet ── */}
      <View style={[styles.bottomSection, { paddingBottom: Math.max(insets.bottom + 8, 28) }]}>
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === currentIndex ? colors.primary : colors.border,
                  width: i === currentIndex ? 20 : 6,
                },
              ]}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.replace('/(auth)/register')}
          activeOpacity={0.85}
        >
          <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Get Started</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.loginLink}
          onPress={() => router.replace('/(auth)/login')}
          activeOpacity={0.7}
        >
          <Text style={[styles.loginText, { color: colors.mutedForeground }]}>
            Already have an account?{' '}
            <Text style={{ color: colors.primary, fontWeight: fontWeights.semibold }}>Log in</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // bg is set dynamically above to match the active slide colour
  },

  list: { flex: 1 },

  // Each slide = full-width, fills the FlatList height
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
  },

  // Brand + Skip sit in the same row at the top of the coloured area
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  brandIcon: {
    width: 30,
    height: 30,
  },
  brandText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  // Phone area takes remaining flex, phone bottom sinks into the sheet
  phoneArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: -PHONE_OVERLAP,
    zIndex: 10,
  },
  phoneWrap: {
    width: PHONE_W,
    height: PHONE_H,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 12,
  },
  phone: {
    width: '100%',
    height: '100%',
  },

  // White sheet — rounded top, phone overlaps from above
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 28,
    paddingBottom: 12,
    zIndex: 1,
  },
  headline: {
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 40,
    letterSpacing: -0.9,
    marginBottom: 10,
  },
  slideSubtitle: {
    fontSize: 15,
    lineHeight: 23,
  },

  // Sticky bottom — white, no border, seamlessly continues the sheet
  bottomSection: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingTop: 4,
    gap: 12,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  dot: { height: 6, borderRadius: 3 },
  primaryBtn: {
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  loginLink: { alignItems: 'center', paddingVertical: 8 },
  loginText: { fontSize: 14, lineHeight: 20 },
});
