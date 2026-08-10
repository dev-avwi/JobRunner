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

const slides = [
  {
    key: 'dashboard',
    image: require('../../assets/welcome/dashboard.png'),
    bg: '#EEF2FF',
    headline: 'Run every job,\nend to end.',
    subtitle: 'Schedule jobs, track your team and stay on top of your day — all from one screen.',
  },
  {
    key: 'map',
    image: require('../../assets/welcome/map.png'),
    bg: '#ECFDF5',
    headline: 'See your whole\nteam, live.',
    subtitle: 'Watch where everyone is, who\'s working and which jobs are active — in real time.',
  },
  {
    key: 'quote',
    image: require('../../assets/welcome/quote.png'),
    bg: '#FFF7ED',
    headline: 'Quote, invoice\nand get paid.',
    subtitle: 'Send professional quotes in seconds and get notified the moment you\'re paid.',
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
    <View style={[styles.slide, { backgroundColor: item.bg }]}>
      <View style={styles.imageWrap}>
        <Image
          source={item.image}
          style={styles.screenshot}
          resizeMode="contain"
        />
      </View>

      <View style={[styles.textArea, { backgroundColor: colors.background }]}>
        <Text style={[styles.headline, { color: colors.foreground }]}>{item.headline}</Text>
        <Text style={[styles.slideSubtitle, { color: colors.mutedForeground }]}>{item.subtitle}</Text>
      </View>
    </View>
  );

  const isLastSlide = currentIndex === slides.length - 1;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: slides[currentIndex].bg }]} edges={['top', 'left', 'right']}>
      {!isLastSlide && (
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} activeOpacity={0.7}>
          <Text style={[styles.skipText, { color: '#00000066' }]}>Skip</Text>
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
        style={styles.flatList}
        bounces={false}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      <View style={[styles.bottomSection, { paddingBottom: Math.max(insets.bottom + 8, 28), backgroundColor: colors.background }]}>
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
  },
  imageWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: 16,
  },
  screenshot: {
    width: SCREEN_WIDTH * 0.72,
    height: SCREEN_HEIGHT * 0.52,
  },
  textArea: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 8,
  },
  headline: {
    fontSize: 36,
    fontWeight: '700',
    lineHeight: 42,
    letterSpacing: -1,
    marginBottom: 10,
  },
  slideSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingTop: 16,
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
