import { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, fontWeights } from '../../src/lib/design-tokens';
import notificationService from '../../src/lib/notifications';

const NOTIFICATIONS_SEEN_KEY = 'notifications_permission_seen';

interface FeatureItemProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}

function FeatureItem({ icon, title, description, colors, styles }: FeatureItemProps) {
  return (
    <View style={styles.featureItem}>
      <View style={styles.featureIcon}>
        <Feather name={icon} size={16} color={colors.primary} />
      </View>
      <View style={styles.featureContent}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
    </View>
  );
}

export default function NotificationsPermissionScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [isRequesting, setIsRequesting] = useState(false);
  const [checking, setChecking] = useState(true);

  const goToApp = () => {
    router.replace('/(tabs)');
  };

  const markSeen = async () => {
    try {
      await AsyncStorage.setItem(NOTIFICATIONS_SEEN_KEY, 'true');
    } catch {
      // ignore persistence failure
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(NOTIFICATIONS_SEEN_KEY);
        if (seen) {
          goToApp();
          return;
        }
      } catch {
        // ignore and show the screen
      }
      setChecking(false);
    })();
  }, []);

  const handleEnable = async () => {
    setIsRequesting(true);
    try {
      await notificationService.initialize();
    } catch (error) {
      if (__DEV__) console.log('Notification init skipped:', error);
    } finally {
      await markSeen();
      setIsRequesting(false);
      goToApp();
    }
  };

  const handleSkip = async () => {
    await markSeen();
    goToApp();
  };

  if (checking) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroSection}>
        <View style={styles.heroIcon}>
          <Feather name="bell" size={36} color={colors.primary} />
        </View>
        <Text style={styles.heroTitle}>Stay in the loop</Text>
        <Text style={styles.heroSubtitle}>
          Turn on notifications so you never miss a job update, payment, or
          message from your clients and team.
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.featureList}>
          <FeatureItem
            icon="briefcase"
            title="Job updates"
            description="Know the moment a job is assigned, accepted, or changes status."
            colors={colors}
            styles={styles}
          />
          <FeatureItem
            icon="dollar-sign"
            title="Payments"
            description="Get alerted the instant a quote is approved or an invoice is paid."
            colors={colors}
            styles={styles}
          />
          <FeatureItem
            icon="message-circle"
            title="Messages"
            description="See new client and team messages without checking the app."
            colors={colors}
            styles={styles}
          />
          <FeatureItem
            icon="calendar"
            title="Schedule changes"
            description="Stay across reschedules and reminders for your day."
            colors={colors}
            styles={styles}
          />
        </View>

        <View style={styles.privacyNote}>
          <Feather name="shield" size={16} color={colors.mutedForeground} style={styles.privacyIcon} />
          <Text style={styles.privacyText}>
            You can change notification settings at any time from your phone's
            Settings or inside the app.
          </Text>
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <PressableRow
          style={styles.primaryButton}
          onPress={handleEnable}
          disabled={isRequesting}
          testID="button-enable-notifications"
        >
          {isRequesting ? (
            <ActivityIndicator color={colors.primaryForeground} size="small" />
          ) : (
            <Text style={styles.primaryButtonText}>Enable Notifications</Text>
          )}
        </PressableRow>

        <PressableRow
          style={styles.skipButton}
          onPress={handleSkip}
          disabled={isRequesting}
          testID="button-skip-notifications"
        >
          <Text style={styles.skipButtonText}>Maybe Later</Text>
        </PressableRow>
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
    paddingTop: spacing.xl,
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight ?? colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  heroTitle: {
    ...typography.title,
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  heroSubtitle: {
    ...typography.body,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 24,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  featureList: {
    marginBottom: spacing.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight ?? colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    ...typography.subtitle,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  featureDescription: {
    ...typography.body,
    color: colors.mutedForeground,
    lineHeight: 22,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  privacyIcon: {
    marginRight: spacing.sm,
    marginTop: 2,
  },
  privacyText: {
    ...typography.body,
    color: colors.mutedForeground,
    flex: 1,
    lineHeight: 22,
  },
  buttonContainer: {
    marginTop: spacing.lg,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  primaryButtonText: {
    ...typography.subtitle,
    color: colors.primaryForeground,
    fontWeight: fontWeights.bold,
  },
  skipButton: {
    padding: spacing.md,
    alignItems: 'center',
  },
  skipButtonText: {
    ...typography.body,
    color: colors.mutedForeground,
  },
});
