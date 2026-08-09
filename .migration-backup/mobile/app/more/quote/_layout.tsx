import { Stack } from 'expo-router';
import { useTheme } from '../../../src/lib/theme';

export default function QuoteLayout() {
  const { colors } = useTheme();
  
  return (
    <Stack
      screenOptions={{
        headerShown: false,
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
    />
  );
}
