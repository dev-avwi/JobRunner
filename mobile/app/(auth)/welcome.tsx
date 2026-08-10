import { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  ListRenderItemInfo,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/lib/theme';
import { fontWeights } from '../../src/lib/design-tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const slides = [
  {
    key: 'jobs',
    icon: 'clipboard-outline' as const,
    accentBg: '#EEF2FF',
    accentColor: '#4F46E5',
    headline: 'Run every job,\nend to end.',
    subtitle: 'Track jobs from first quote to final invoice\n— all in one place.',
  },
  {
    key: 'quotes',
    icon: 'document-text-outline' as const,
    accentBg: '#F0FDF4',
    accentColor: '#16A34A',
    headline: 'Send quotes\nin seconds.',
    subtitle: 'Win more work with professional quotes\ndelivered instantly.',
  },
  {
    key: 'payment',
    icon: 'checkmark-circle-outline' as const,
    accentBg: '#FFF7ED',
    accentColor: '#EA580C',
    headline: 'Get paid\nfaster.',
    subtitle: 'Invoice on-site and get notified the\nmoment you\'re paid.',
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
    <View style={[styles.slide, { backgroundColor: colors.background }]}>
      {/* Illustration area */}
      <View style={styles.illustrationArea}>
        <View style={[styles.iconCard, { backgroundColor: item.accentBg }]}>
          <Ionicons name={item.icon} size={96} color={item.accentColor} />
        </View>
      </View>

      {/* Text area */}
      <View style={styles.textArea}>
        <Text style={[styles.headline, { color: colors.foreground }]}>{item.headline}</Text>
        <Text style={[styles.slideSubtitle, { color: colors.mutedForeground }]}>{item.subtitle}</Text>
      </View>
    </View>
  );

  const isLastSlide = currentIndex === slides.length - 1;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* Skip button — only visible on slides 1 and 2 */}
      {!isLastSlide && (
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} activeOpacity={0.7}>
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
        style={styles.flatList}
        bounces={false}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {/* Sticky bottom — always visible */}
      <View style={[styles.bottomSection, { paddingBottom: Math.max(insets.bottom + 8, 28), backgroundColor: colors.background }]}>
        {/* Pagination dots */}
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

        {/* Primary CTA */}
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.replace('/(auth)/register')}
          activeOpacity={0.85}
        >
          <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Get Started</Text>
        </TouchableOpacity>

        {/* Login link */}
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
  container: {
    flex: 1,
  },
  skipBtn: {
    position: 'absolute',
    top: 16,
    right: 24,
    zIndex: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  flatList: {
    flex: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    paddingHorizontal: 32,
  },
  illustrationArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCard: {
    width: 200,
    height: 200,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textArea: {
    paddingBottom: 24,
  },
  headline: {
    fontSize: 40,
    fontWeight: '700',
    lineHeight: 46,
    letterSpacing: -1.2,
    marginBottom: 14,
  },
  slideSubtitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingTop: 8,
    gap: 12,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
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
  loginLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  loginText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
