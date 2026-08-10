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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const PHONE_W = SCREEN_WIDTH * 0.70;
const PHONE_H = PHONE_W * 2.06; // ~iPhone aspect ratio

const slides = [
  {
    key: 'dashboard',
    image: require('../../assets/welcome/dashboard.png'),
    gradient: ['#060D1F', '#0D1F42'] as const,
    glow: '#3B82F6',
    badge: 'SCHEDULING & DISPATCH',
    headline: 'Run every job,\nend to end.',
    subtitle: 'Schedule jobs, track your team and stay on top of your day — from one screen.',
  },
  {
    key: 'map',
    image: require('../../assets/welcome/map.png'),
    gradient: ['#051209', '#0B2214'] as const,
    glow: '#10B981',
    badge: 'LIVE TEAM TRACKING',
    headline: 'See your whole\nteam, live.',
    subtitle: 'Watch who\'s where, who\'s working and which jobs are active — in real time.',
  },
  {
    key: 'quote',
    image: require('../../assets/welcome/quote.png'),
    gradient: ['#140900', '#271400'] as const,
    glow: '#F59E0B',
    badge: 'QUOTES & INVOICES',
    headline: 'Quote, invoice\nand get paid.',
    subtitle: 'Send professional quotes in seconds and get notified the moment you\'re paid.',
  },
];

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
    <LinearGradient colors={item.gradient} style={styles.slide}>
      {/* Glow bloom behind phone */}
      <View
        style={[
          styles.glow,
          {
            backgroundColor: item.glow,
            shadowColor: item.glow,
          },
        ]}
      />

      {/* Phone mockup — perspective tilt for 3D depth */}
      <View style={styles.phoneWrap}>
        <Image source={item.image} style={styles.phone} resizeMode="contain" />
        {/* Glass shine overlay */}
        <LinearGradient
          colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.phoneShine}
          pointerEvents="none"
        />
      </View>

      {/* Text section */}
      <View style={styles.textSection}>
        {/* Feature badge */}
        <View style={[styles.badge, { borderColor: item.glow + '60', backgroundColor: item.glow + '18' }]}>
          <View style={[styles.badgeDot, { backgroundColor: item.glow }]} />
          <Text style={[styles.badgeText, { color: item.glow }]}>{item.badge}</Text>
        </View>

        <Text style={styles.headline}>{item.headline}</Text>
        <Text style={styles.subtitle}>{item.subtitle}</Text>
      </View>
    </LinearGradient>
  );

  const isLastSlide = currentIndex === slides.length - 1;
  const currentSlide = slides[currentIndex];

  return (
    <View style={styles.root}>
      {/* Skip */}
      {!isLastSlide && (
        <TouchableOpacity
          style={[styles.skipBtn, { top: insets.top + 12 }]}
          onPress={handleSkip}
          activeOpacity={0.7}
        >
          <Text style={styles.skipText}>Skip</Text>
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

      {/* Bottom sheet */}
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 8, 28) }]}>
        {/* Accent line */}
        <View style={[styles.accentLine, { backgroundColor: currentSlide.glow }]} />

        {/* Dots */}
        <View style={styles.dots}>
          {slides.map((s, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === currentIndex ? currentSlide.glow : colors.border,
                  width: i === currentIndex ? 22 : 6,
                },
              ]}
            />
          ))}
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: currentSlide.glow }]}
          onPress={() => router.replace('/(auth)/register')}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>Get Started</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.loginLink}
          onPress={() => router.replace('/(auth)/login')}
          activeOpacity={0.7}
        >
          <Text style={[styles.loginText, { color: colors.mutedForeground }]}>
            Already have an account?{' '}
            <Text style={{ color: currentSlide.glow, fontWeight: fontWeights.semibold }}>Log in</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#060D1F',
  },
  skipBtn: {
    position: 'absolute',
    right: 24,
    zIndex: 20,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.55)',
  },
  list: {
    flex: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: 'center',
    paddingTop: 0,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.04,
    width: PHONE_W * 1.3,
    height: PHONE_W * 1.3,
    borderRadius: PHONE_W * 0.65,
    opacity: 0.22,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 80,
  },
  phoneWrap: {
    marginTop: SCREEN_HEIGHT * 0.06,
    width: PHONE_W,
    height: PHONE_H,
    transform: [
      { perspective: 900 },
      { rotateX: '-10deg' },
      { rotateZ: '-3deg' },
    ],
    shadowColor: '#000',
    shadowOffset: { width: -8, height: 32 },
    shadowOpacity: 0.75,
    shadowRadius: 48,
    elevation: 30,
  },
  phone: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
  },
  phoneShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 40,
  },
  textSection: {
    width: SCREEN_WIDTH,
    paddingHorizontal: 28,
    paddingTop: 20,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 14,
    gap: 6,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  headline: {
    fontSize: 38,
    fontWeight: '800',
    lineHeight: 44,
    letterSpacing: -1.2,
    color: '#FFFFFF',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.60)',
    fontWeight: '400',
  },

  // Bottom sheet
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 20,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 20,
  },
  accentLine: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 4,
    opacity: 0.8,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  primaryBtn: {
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  loginLink: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  loginText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
