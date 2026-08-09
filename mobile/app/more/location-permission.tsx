import { useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Image,
  Platform
} from 'react-native';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, fontWeights } from '../../src/lib/design-tokens';
import { useLocationStore } from '../../src/lib/location-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavHeight } from '../../src/components/BottomNav';

const createStyles = (colors: ThemeColors, bottomNavHeight: number = 0) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: bottomNavHeight,
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
    backgroundColor: colors.infoLight,
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
  sectionTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    marginBottom: spacing.md,
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
    backgroundColor: colors.infoLight,
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
  optionalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
    marginBottom: spacing.lg,
  },
  optionalBadgeIcon: {
    marginRight: spacing.xs,
  },
  optionalBadgeText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: fontWeights.semibold,
  },
  paragraph: {
    ...typography.body,
    color: colors.foreground,
    lineHeight: 24,
    marginBottom: spacing.md,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
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
  privacyLink: {
    color: colors.primary,
    fontWeight: fontWeights.semibold,
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
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  secondaryButtonText: {
    ...typography.body,
    color: colors.foreground,
    fontWeight: fontWeights.semibold,
  },
  skipButton: {
    padding: spacing.md,
    alignItems: 'center',
  },
  skipButtonText: {
    ...typography.body,
    color: colors.mutedForeground,
  },
  permissionExplainer: {
    backgroundColor: colors.warningLight,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.warning,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  permissionExplainerTitle: {
    ...typography.subtitle,
    color: colors.warning,
    marginBottom: spacing.xs,
  },
  permissionExplainerText: {
    ...typography.caption,
    color: colors.foreground,
    lineHeight: 20,
  },
});

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
        <Feather name={icon} size={16} color={colors.info} />
      </View>
      <View style={styles.featureContent}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
    </View>
  );
}

export default function LocationPermissionScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, bottomNavHeight), [colors, bottomNavHeight]);
  const { enableTracking, permissionGranted } = useLocationStore();
  
  const [isRequesting, setIsRequesting] = useState(false);
  
  const handleEnableLocation = async () => {
    setIsRequesting(true);
    try {
      const success = await enableTracking();
      if (success) {
        router.back();
      }
    } catch (error) {
      console.error('Failed to enable location:', error);
    } finally {
      setIsRequesting(false);
    }
  };
  
  const handleMaybeLater = () => {
    router.back();
  };
  
  const handleSkip = () => {
    router.back();
  };
  
  const navigateToPrivacy = () => {
    router.push('/more/privacy-policy');
  };

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Location Permission',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
        }} 
      />
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <View style={styles.heroIcon}>
            <Feather name="map-pin" size={36} color={colors.info} />
          </View>
          <Text style={styles.heroTitle}>Enable Background Location</Text>
          <Text style={styles.heroSubtitle}>
            JobRunner needs to access your location, including in the background
            (when the app is closed or not in use), so your team and clients
            always know where you are.
          </Text>
        </View>
        
        <View style={styles.optionalBadge}>
          <Feather 
            name="check-circle" 
            size={14} 
            color={colors.success} 
            style={styles.optionalBadgeIcon}
          />
          <Text style={styles.optionalBadgeText}>Optional - You can disable anytime</Text>
        </View>
        
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Why We Need Location Access</Text>
          <View style={styles.featureList}>
            <FeatureItem
              icon="users"
              title="Live team tracking (background)"
              description="Your location is shared with your business owner's dispatch board so they can see all field workers on a live map, even when the app is closed and your phone is in your pocket while you drive between jobs."
              colors={colors}
              styles={styles}
            />
            <FeatureItem
              icon="navigation"
              title='"On My Way" ETA alerts (background)'
              description="JobRunner uses your background location to automatically send accurate arrival ETAs by SMS to the next client, so they know exactly when to expect you — without you having to message them."
              colors={colors}
              styles={styles}
            />
            <FeatureItem
              icon="zap"
              title="Automatic clock-in at job sites"
              description="Geofences detect when you arrive and leave a job site so your timer starts and stops automatically, even when the app isn't open."
              colors={colors}
              styles={styles}
            />
            <FeatureItem
              icon="map"
              title="Route optimization"
              description="Smart route suggestions to minimise travel time between jobs across your day."
              colors={colors}
              styles={styles}
            />
          </View>
        </View>
        
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Your Privacy Matters</Text>
          <Text style={styles.paragraph}>
            Your location data is only shared with your business owner / dispatcher
            (so they can see your live position on their team map) and used to send
            ETA alerts to the specific client whose job you are travelling to.
            It is never sold or shared with any other third parties.
          </Text>
          
          <View style={styles.privacyNote}>
            <Feather 
              name="shield" 
              size={16} 
              color={colors.mutedForeground} 
              style={styles.privacyIcon}
            />
            <Text style={styles.privacyText}>
              Location tracking can be disabled at any time from Settings. 
              Read our{' '}
              <Text style={styles.privacyLink} onPress={navigateToPrivacy}>
                Privacy Policy
              </Text>
              {' '}for more details.
            </Text>
          </View>
          
          {Platform.OS === 'ios' && (
            <View style={styles.permissionExplainer}>
              <Text style={styles.permissionExplainerTitle}>
                About "Always Allow" Permission
              </Text>
              <Text style={styles.permissionExplainerText}>
                For automatic clock-in and team tracking to work when the app is in the background, 
                iOS requires "Always Allow" location permission. You can change this setting at any 
                time in your device's Settings app.
              </Text>
            </View>
          )}

          {Platform.OS === 'android' && (
            <View style={styles.permissionExplainer}>
              <Text style={styles.permissionExplainerTitle}>
                About "Allow all the time"
              </Text>
              <Text style={styles.permissionExplainerText}>
                When you tap Enable Location below, Android will first ask if you
                want to share your location while using the app. After you accept,
                you'll see a second prompt to "Allow all the time" — please pick
                this so live team tracking and arrival ETAs keep working when your
                phone is in your pocket and the app is closed. You can change this
                in your phone's Settings at any time.
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.buttonContainer}>
          <PressableRow style={styles.primaryButton} onPress={handleEnableLocation} disabled={isRequesting} testID="button-enable-location" >
            {isRequesting ? (
              <ActivityIndicator color={colors.primaryForeground} size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Enable Location</Text>
            )}
          </PressableRow>
          
          <PressableRow style={styles.secondaryButton} onPress={handleMaybeLater} disabled={isRequesting} testID="button-maybe-later" >
            <Text style={styles.secondaryButtonText}>Maybe Later</Text>
          </PressableRow>
          
          <PressableRow style={styles.skipButton} onPress={handleSkip} disabled={isRequesting} testID="button-skip-location" >
            <Text style={styles.skipButtonText}>Skip for Now</Text>
          </PressableRow>
        </View>
      </ScrollView>
    </>
  );
}
