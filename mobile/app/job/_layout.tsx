import { Stack } from 'expo-router';
import { useTheme } from '../../src/lib/theme';

export default function JobLayout() {
  const { colors } = useTheme();
  
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerBackVisible: false,
        headerTitle: '',
        headerShadowVisible: false,
        headerTintColor: colors.primary,
        contentStyle: {
          backgroundColor: colors.background,
        },
        animation: 'ios_from_right',
        animationDuration: 220,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        presentation: 'card',
        freezeOnBlur: true,
      }}
    >
      <Stack.Screen name="[id]" />
      {/* The global <Header/> (app/_layout) is always on, so a native stack
          header here double-stacks and leaves a big top gap on iOS. Keep it off
          and use the in-content header row, matching the SMS conversation screen. */}
      <Stack.Screen name="chat" options={{ headerShown: false }} />
      {/* Phase detail — dedicated screen for a single job phase */}
      <Stack.Screen name="phase-detail" options={{ headerShown: false }} />
    </Stack>
  );
}
