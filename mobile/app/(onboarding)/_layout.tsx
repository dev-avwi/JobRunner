import { Stack } from 'expo-router';
import { useTheme } from '../../src/lib/theme';

export default function OnboardingLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="setup" options={{ gestureEnabled: false }} />
      <Stack.Screen name="notifications-permission" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
