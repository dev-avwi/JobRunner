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
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/lib/theme';
import { fontWeights } from '../../src/lib/design-tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PHONE_W  = SCREEN_WIDTH * 0.60;
const PHONE_H  = PHONE_W * 2.06;
// How far the bottom of the phone sinks into the white sheet below it
const PHONE_OVERLAP = 60;

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

  const handleSkip = useCallback(() => {
    flatListRef.current?.scrollToIndex({ index: slides.length - 1, animated: true });
  }, []);

  const handleMomentumScrollEnd = useCallback((event: any) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCurrentIndex(index);
  }, []);

  const renderSlide = useCallback(({ item }: ListRenderItemInfo<typeof slides[number]>) => (
    <View style={[styles.slide, { backgroundColor: item.bg }]}>

      {/* ── Brand ── sits at the very top, inside the colour */}
      <View style={[styles.brand, { paddingTop: insets.top + 12 }]}>
        <Image
          source={require('../../assets/jobrunner-logo-header.png')}
          style={styles.brandIcon}
          resizeMode="contain"
        />
        <Text style={styles.brandText}>JobRunner</Text>
      </View>

      {/* ── Phone mockup ── flex space between brand and sheet */}
      <View style={styles.phoneArea}>
        <View style={styles.phoneWrap}>
          <Image source={item.image} style={styles.phone} resizeMode="contain" />
        </View>
      </View>

      {/* ── White sheet ── rises from bottom, phone overlaps from above */}
      <View style={styles.sheet}>
        {/* Spacer so text sits below the overlapping phone */}
        <View style={{ height: PHONE_OVERLAP + 12 }} />
        <Text style={[styles.headline, { color: colors.foreground }]}>{item.headline}</Text>
        <Text style={[styles.slideSubtitle, { color: colors.mutedForeground }]}>{item.subtitle}</Text>
      </View>
    </View>
  ), [insets.top, colors]);

  const isLastSlide = currentIndex === slides.length - 1;

  return (
    // Plain View — no SafeAreaView so colour fills right under the status bar
    <View style={styles.root}>

      {/* Skip — floated above everything */}
      {!isLastSlide && (
        <TouchableOpacity
          style={[styles.skipBtn, { top: insets.top + 10 }]}
          onPress={handleSkip}
          activeOpacity={0.7}
        >
          <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Carousel */}
      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
        style={styles.list}
        bounces={false}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {/* ── Sticky bottom — continues the white sheet ── */}
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
    backgroundColor: '#fff',
  },

  // Skip sits above the FlatList, positioned from top of screen
  skipBtn: {
    position: 'absolute',
    right: 24,
    zIndex: 20,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  skipText: { fontSize: 14, fontWeight: '500' },

  list: { flex: 1 },

  // Each slide = full width, flex 1, coloured bg
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
  },

  // Brand — icon + wordmark, left aligned, top of coloured area
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 9,
    marginBottom: 4,
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

  // Phone area takes remaining flex space between brand and sheet
  phoneArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    // Sink the phone into the white sheet below by PHONE_OVERLAP px
    marginBottom: -PHONE_OVERLAP,
    zIndex: 10,
  },
  phoneWrap: {
    width: PHONE_W,
    height: PHONE_H,
    // Subtle shadow — no elevation bleed
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
  },
  phone: {
    width: '100%',
    height: '100%',
  },

  // White sheet — rounded top, sits at bottom of the coloured slide
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 28,
    paddingBottom: 12,
    // zIndex lower than phoneArea so phone appears above the sheet
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

  // Sticky bottom continues the white sheet (no border, no shadow)
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
