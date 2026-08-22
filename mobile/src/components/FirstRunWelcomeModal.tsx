/**
 * FirstRunWelcomeModal
 * Shown to new business owners on their first dashboard visit.
 * Collects trade type + team size (pre-filled from existing settings if available).
 * Not dismissible until both questions are answered and persisted successfully.
 *
 * Trade IDs must match the server-side shared-tradeCatalog. The full list is in
 * artifacts/api-server/src/shared-tradeCatalog.ts; the IDs below are a curated
 * subset of the most common trades, all of which are present in that catalog.
 */
import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, colorWithOpacity } from '../lib/theme';
import { fontWeights, spacing, radius, typography } from '../lib/design-tokens';
import { useAuthStore } from '../lib/store';
import { api } from '../lib/api';

// All values must be valid trade IDs in shared-tradeCatalog.ts
const TRADE_TYPES: { value: string; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { value: 'electrical',  label: 'Electrical',     icon: 'flash'     },
  { value: 'plumbing',    label: 'Plumbing',        icon: 'water'     },
  { value: 'hvac',        label: 'HVAC',            icon: 'snow'      },
  { value: 'painting',    label: 'Painting',        icon: 'brush'     },
  { value: 'building',    label: 'Building',        icon: 'home'      },
  { value: 'landscaping', label: 'Landscaping',     icon: 'leaf'      },
  { value: 'handyman',    label: 'Handyman',        icon: 'hammer'    },
  { value: 'general',     label: 'General / Other', icon: 'construct' },
];

const TEAM_SIZES: { value: string; label: string; description: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { value: 'solo',  label: 'Just me', description: 'Solo operator',     icon: 'person'   },
  { value: 'small', label: '2 – 10',  description: 'Small crew',        icon: 'people'   },
  { value: 'large', label: '10+',     description: 'Larger operation',  icon: 'business' },
];

interface Props {
  visible: boolean;
  onDone: () => void;
}

export function FirstRunWelcomeModal({ visible, onDone }: Props) {
  const { colors } = useTheme();
  const { businessSettings, user, fetchBusinessSettings } = useAuthStore();

  // Pre-fill from existing settings if the wizard already captured them
  const [step, setStep] = useState<'trade' | 'teamSize'>('trade');
  const [selectedTrade, setSelectedTrade] = useState(businessSettings?.tradeType || '');
  const [selectedTeamSize, setSelectedTeamSize] = useState(businessSettings?.teamSize || '');
  const [isLoading, setIsLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const styles = makeStyles(colors);
  const firstName = user?.firstName;

  const handleTradeNext = () => {
    if (!selectedTrade) return;
    setSaveError(null);
    setStep('teamSize');
  };

  const handleFinish = async () => {
    if (!selectedTeamSize || !selectedTrade) return;
    setIsLoading(true);
    setSaveError(null);

    // Step 1: save trade + team via quick-setup. This is the critical call —
    // if it fails we must NOT mark hasSeenWalkthrough and must allow retry.
    try {
      const quickSetupTeam = selectedTeamSize === 'solo' ? 'solo' : 'team';
      const setupRes = await api.post('/api/onboarding/quick-setup', {
        tradeType: selectedTrade,
        teamSize: quickSetupTeam,
      });
      if (setupRes.error) {
        setSaveError(
          typeof setupRes.error === 'string'
            ? setupRes.error
            : 'Could not save your details. Please try again.'
        );
        setIsLoading(false);
        return;
      }
    } catch {
      setSaveError('Could not save your details. Please check your connection and try again.');
      setIsLoading(false);
      return;
    }

    // Step 2: mark hasSeenWalkthrough so this modal never re-appears.
    // Only reached after a successful quick-setup above.
    try {
      const patchRes = await api.patch('/api/business-settings', {
        hasSeenWalkthrough: true,
        teamSize: selectedTeamSize,
      });
      if (patchRes.error && __DEV__) {
        console.warn('[FirstRunWelcomeModal] hasSeenWalkthrough save warning:', patchRes.error);
      }
      await fetchBusinessSettings();
    } catch {
      // Non-blocking: quick-setup already committed. If this fails the modal
      // may show again next session, which is acceptable vs. losing setup data.
      if (__DEV__) console.warn('[FirstRunWelcomeModal] settings patch failed (non-fatal)');
    }

    setIsLoading(false);
    onDone();
  };

  const canProceedTrade = !!selectedTrade;
  const canProceedTeam  = !!selectedTeamSize;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconBadge, { backgroundColor: colorWithOpacity(colors.primary, 0.12) }]}>
              <Ionicons name="rocket" size={28} color={colors.primary} />
            </View>
            <Text style={styles.title}>
              {step === 'trade'
                ? (firstName ? `Welcome, ${firstName}` : 'Welcome')
                : 'One more thing'}
            </Text>
            <Text style={styles.subtitle}>
              {step === 'trade'
                ? 'What type of trade do you run?'
                : 'How big is your team?'}
            </Text>
            <Text style={styles.stepIndicator}>Step {step === 'trade' ? '1' : '2'} of 2</Text>
          </View>

          {/* Trade type step */}
          {step === 'trade' && (
            <ScrollView showsVerticalScrollIndicator={false} style={styles.optionsScroll}>
              <View style={styles.tradeGrid}>
                {TRADE_TYPES.map((trade) => {
                  const isSelected = selectedTrade === trade.value;
                  return (
                    <TouchableOpacity
                      key={trade.value}
                      style={[
                        styles.tradeOption,
                        {
                          backgroundColor: isSelected
                            ? colorWithOpacity(colors.primary, 0.12)
                            : colors.muted,
                          borderColor: isSelected ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => { setSelectedTrade(trade.value); setSaveError(null); }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={trade.icon}
                        size={22}
                        color={isSelected ? colors.primary : colors.mutedForeground}
                      />
                      <Text
                        style={[
                          styles.tradeLabel,
                          {
                            color: isSelected ? colors.primary : colors.foreground,
                            fontWeight: isSelected ? fontWeights.semibold : fontWeights.regular,
                          },
                        ]}
                      >
                        {trade.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}

          {/* Team size step */}
          {step === 'teamSize' && (
            <View style={styles.optionsScroll}>
              {TEAM_SIZES.map((size) => {
                const isSelected = selectedTeamSize === size.value;
                return (
                  <TouchableOpacity
                    key={size.value}
                    style={[
                      styles.teamOption,
                      {
                        backgroundColor: isSelected
                          ? colorWithOpacity(colors.primary, 0.1)
                          : colors.muted,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => { setSelectedTeamSize(size.value); setSaveError(null); }}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.teamOptionIcon,
                      { backgroundColor: isSelected ? colorWithOpacity(colors.primary, 0.18) : colorWithOpacity(colors.mutedForeground, 0.1) },
                    ]}>
                      <Ionicons
                        name={size.icon}
                        size={20}
                        color={isSelected ? colors.primary : colors.mutedForeground}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[
                        styles.teamLabel,
                        { color: isSelected ? colors.primary : colors.foreground, fontWeight: isSelected ? fontWeights.semibold : fontWeights.regular },
                      ]}>
                        {size.label}
                      </Text>
                      <Text style={[styles.teamDesc, { color: colors.mutedForeground }]}>
                        {size.description}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Inline error message — shown when save fails so user can retry */}
          {saveError ? (
            <View style={[styles.errorBanner, { backgroundColor: colorWithOpacity(colors.destructive, 0.08), borderColor: colorWithOpacity(colors.destructive, 0.2) }]}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive }]}>{saveError}</Text>
            </View>
          ) : null}

          {/* Footer buttons */}
          <View style={styles.footer}>
            {step === 'teamSize' && (
              <TouchableOpacity
                style={[styles.backButton, { borderColor: colors.border }]}
                onPress={() => { setStep('trade'); setSaveError(null); }}
                disabled={isLoading}
                activeOpacity={0.7}
              >
                <Text style={[styles.backButtonText, { color: colors.mutedForeground }]}>Back</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.primaryButton,
                {
                  backgroundColor: (step === 'trade' ? !canProceedTrade : !canProceedTeam)
                    ? colorWithOpacity(colors.primary, 0.4)
                    : colors.primary,
                  flex: step === 'teamSize' ? 1 : undefined,
                },
              ]}
              onPress={step === 'trade' ? handleTradeNext : handleFinish}
              disabled={
                isLoading ||
                (step === 'trade' && !canProceedTrade) ||
                (step === 'teamSize' && !canProceedTeam)
              }
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {step === 'trade' ? 'Next' : saveError ? 'Retry' : "Let's go"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      width: '100%',
      maxWidth: 480,
      overflow: 'hidden',
    },
    header: {
      alignItems: 'center',
      paddingTop: spacing.xl,
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.md,
    },
    iconBadge: {
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    title: {
      fontSize: typography.sizes.xl,
      fontWeight: fontWeights.bold,
      color: colors.foreground,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: typography.sizes.md,
      color: colors.mutedForeground,
      textAlign: 'center',
      marginTop: spacing.xs,
    },
    stepIndicator: {
      fontSize: typography.sizes.xs,
      color: colors.mutedForeground,
      marginTop: spacing.sm,
      fontWeight: fontWeights.medium,
    },
    optionsScroll: {
      maxHeight: 300,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
    },
    tradeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    tradeOption: {
      width: '47%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1.5,
    },
    tradeLabel: {
      fontSize: typography.sizes.sm,
      flexShrink: 1,
    },
    teamOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1.5,
      marginBottom: spacing.sm,
    },
    teamOptionIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    teamLabel: {
      fontSize: typography.sizes.md,
    },
    teamDesc: {
      fontSize: typography.sizes.sm,
      marginTop: 2,
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginHorizontal: spacing.lg,
      marginTop: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
    },
    errorText: {
      fontSize: typography.sizes.sm,
      flex: 1,
    },
    footer: {
      flexDirection: 'row',
      gap: spacing.sm,
      padding: spacing.lg,
      paddingTop: spacing.md,
    },
    backButton: {
      flex: 1,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    backButtonText: {
      fontSize: typography.sizes.md,
      fontWeight: fontWeights.medium,
    },
    primaryButton: {
      flex: 1,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonText: {
      fontSize: typography.sizes.md,
      fontWeight: fontWeights.semibold,
      color: '#fff',
    },
  });
}
