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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/lib/theme';
import { fontWeights } from '../../src/lib/design-tokens';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const PHONE_W = SCREEN_WIDTH * 0.62;
const PHONE_H = PHONE_W * 2.06;
// How far the phone hangs below the coloured section into the white text area
const PHONE_HANG = PHONE_H * 0.30;

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

  const renderSlide = ({ item }: ListRenderItemInfo<typeof slides[number]>) => (
    <View style={[styles.slide, { backgroundColor: '#fff' }]}>

      {/* ── Coloured hero area ── */}
      <View style={[styles.coloredSection, { backgroundColor: item.bg }]}>
        {/* Brand wordmark — like Strava has their logo */}
        <Text style={styles.wordmark}>JobRunner</Text>

        {/* Phone mockup sits at the bottom, hangs below */}
        <View style={styles.phoneWrap}>
          <Image source={item.image} style={styles.phone} resizeMode="contain" />
        </View>
      </View>

      {/* ── White text area — padded to clear the hanging phone ── */}
      <View style={[styles.textArea, { paddingTop: PHONE_HANG + 20 }]}>
        <Text style={[styles.headline, { color: colors.foreground }]}>{item.headline}</Text>
        <Text style={[styles.slideSubtitle, { color: colors.mutedForeground }]}>{item.subtitle}</Text>
      </View>
    </View>
  );

  const isLastSlide = currentIndex === slides.length - 1;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#fff' }]} edges={['top', 'left', 'right']}>
      {!isLastSlide && (
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} activeOpacity={0.7}>
          <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip</Text>
        </TouchableOpacity>
      )}

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

      {/* Sticky bottom */}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  skipBtn: {
    position: 'absolute',
    top: 16,
    right: 24,
    zIndex: 20,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  skipText: { fontSize: 14, fontWeight: '500' },

  list: { flex: 1 },

  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
  },

  // Coloured hero — takes ~58% of slide height
  coloredSection: {
    height: SCREEN_HEIGHT * 0.50,
    alignItems: 'center',
    // overflow visible so phone hangs below
    overflow: 'visible',
    zIndex: 2,
  },

  wordmark: {
    marginTop: 20,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.8,
    color: '#1D4ED8',   // JobRunner blue
  },

  // Phone anchored to the BOTTOM of the coloured section, hanging into white
  phoneWrap: {
    position: 'absolute',
    bottom: -PHONE_HANG,   // negative = hangs below coloured section
    width: PHONE_W,
    height: PHONE_H,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 16,
    zIndex: 10,
  },

  phone: {
    width: '100%',
    height: '100%',
  },

  // White text section — padded top so text appears below the hanging phone
  textArea: {
    paddingHorizontal: 28,
    paddingBottom: 8,
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

  // Sticky bottom CTA area
  bottomSection: {
    paddingHorizontal: 24,
    paddingTop: 8,
    gap: 12,
    backgroundColor: '#fff',
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
