import { Link, Stack } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../src/lib/theme';
import { typography, fontWeights } from '../src/lib/design-tokens';

export default function NotFoundScreen() {
  const { colors } = useTheme();

  return (
    <>
      <Stack.Screen options={{ title: "Page Not Found", headerShown: false }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.content}>
          <Feather name="alert-circle" size={64} color={colors.mutedForeground} />
          <Text style={[styles.title, { color: colors.foreground }]}>
            Page Not Found
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            The page you're looking for doesn't exist.
          </Text>
          <Link href="/" asChild>
            <TouchableOpacity 
              style={[styles.button, { backgroundColor: colors.primary }]}
              data-testid="link-go-home"
            >
              <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>
                Go to Home
              </Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: fontWeights.semibold,
    marginTop: 24,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: typography.subtitle.fontSize,
    textAlign: 'center',
    marginBottom: 32,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
  },
});
