import { Stack } from 'expo-router';
import { useTheme } from '../../src/lib/theme';

export default function AuthLayout() {
  const { colors } = useTheme();
  
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        contentStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <Stack.Screen name="login" options={{ gestureEnabled: false }} />
      <Stack.Screen name="register" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
