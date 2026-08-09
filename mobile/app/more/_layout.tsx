import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/lib/theme';
import { IOSBackButton } from '../../src/components/ui/IOSBackButton';
import { getNavigationConfig, isIOS } from '../../src/lib/platform';

export default function MoreLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigationConfig = getNavigationConfig(colors, { isDark: colors.isDark });
  
  const headerHeight = isIOS ? 44 + insets.top : 0;
  
  return (
    <Stack
      screenOptions={{
        ...navigationConfig,
        headerShown: false,
        headerBackVisible: false,
        headerLeft: isIOS ? () => <IOSBackButton /> : undefined,
        headerTitle: '',
        headerTintColor: colors.primary,
        contentStyle: {
          backgroundColor: colors.background,
        },
        animationDuration: 220,
        presentation: 'card',
        freezeOnBlur: true,
      }}
    >
    </Stack>
  );
}
