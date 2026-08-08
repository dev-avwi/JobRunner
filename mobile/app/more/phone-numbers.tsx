import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Linking,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { useBottomInset } from '../../src/components/ui/BottomInsetSpacer';
import { Stack, router } from 'expo-router';
import { asHref } from '../../src/lib/nav';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, typography, fontWeights } from '../../src/lib/design-tokens';
import api from '../../src/lib/api';
import { useAuthStore } from '../../src/lib/store';
import { useUserRole } from '../../src/hooks/use-user-role';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showToast } from '../../src/lib/toast';
import { isIAPAvailable, purchaseSubscription, setPendingDedicatedNumber, IAP_ADDON_PRODUCT_IDS } from '../../src/lib/iap';

function getLastNumberKey(businessId?: string | number) {
  const id = businessId || 'default';
  return `@jobrunner_last_dedicated_number:${id}`;
}

interface AvailableNumber {
  phoneNumber: string;
  friendlyName: string;
  locality?: string;
  region?: string;
  capabilities?: {
    voice?: boolean;
    sms?: boolean;
    mms?: boolean;
  };
}

interface PortRequest {
  id: string;
  phoneNumber: string;
  currentCarrier: string;
  accountNumber: string;
  status: 'submitted' | 'processing' | 'completed' | 'failed';
  adminNotes: string | null;
  estimatedCompletionDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AiConfig {
  id: string;
  dedicatedPhoneNumber: string | null;
  label: string | null;
  enabled: boolean;
  approvalStatus: string | null;
  voiceName: string | null;
  mode: string | null;
}

const MAX_NUMBERS = 5;
export default function PhoneNumbersPage() {
  const { colors } = useTheme();
  const bottomInset = useBottomInset(40);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, businessSettings, fetchBusinessSettings } = useAuthStore();
  const userTier = user?.subscriptionTier || 'free';
  const isFreePlan = userTier === 'free' && !user?.betaLifetimeAccess && !user?.isBeta;
  // Subcontractors viewing a joined business get read-only access — the
  // dedicated number is owned/managed by the business owner.
  const { isOwner, isManager, isLoading: roleLoading } = useUserRole();
  // Only owners and managers manage phone numbers / AI Receptionist provisioning.
  // Workers and joined-business subcontractors get a read-only view. Default to
  // read-only until the role resolves so privileged controls never flash.
  const readOnly = !isOwner && !isManager;

  const [numbers, setNumbers] = useState<AvailableNumber[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [releasing, setReleasing] = useState(false);
  const [areaCode, setAreaCode] = useState('');
  const [locality, setLocality] = useState('');
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [releaseConfirmText, setReleaseConfirmText] = useState('');
  const [lastOwnedNumber, setLastOwnedNumber] = useState<string | null>(null);
  const [reacquiring, setReacquiring] = useState(false);
  const [aiConfigs, setAiConfigs] = useState<AiConfig[]>([]);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const searchSectionY = useRef(0);
  const [labelText, setLabelText] = useState('');

  const [showPortForm, setShowPortForm] = useState(false);
  const [portPhone, setPortPhone] = useState('');
  const [portCarrier, setPortCarrier] = useState('');
  const [portAccount, setPortAccount] = useState('');
  const [portLoaAgreed, setPortLoaAgreed] = useState(false);
  const [submittingPort, setSubmittingPort] = useState(false);
  const [portRequests, setPortRequests] = useState<PortRequest[]>([]);
  const [loadingPortRequests, setLoadingPortRequests] = useState(false);

  const currentNumber = businessSettings?.dedicatedPhoneNumber;
  const archivedNumber = (businessSettings as any)?.archivedPhoneNumber || null;

  // Sender attribution: when multiple workers share one business number,
  // optionally tag each outbound SMS with "From [WorkerName]: " so the client
  // can tell who they're chatting with. 'off' (default) keeps the unified
  // business identity. 'per_worker' (dedicated number per worker) is on
  // the roadmap but not yet provisioned.
  const attributionMode = ((businessSettings as any)?.smsSenderAttribution || 'off') as
    | 'off'
    | 'name_prefix'
    | 'per_worker';
  const [savingAttribution, setSavingAttribution] = useState(false);
  const updateAttribution = useCallback(
    async (mode: 'off' | 'name_prefix') => {
      if (mode === attributionMode) return;
      setSavingAttribution(true);
      try {
        const res = await api.patch('/api/business-settings', {
          smsSenderAttribution: mode,
        });
        if (res.error) {
          showToast({ type: 'info', message: 'Could not save', description: res.error });
        } else {
          await fetchBusinessSettings();
        }
      } catch (e: any) {
        showToast({ type: 'info', message: 'Could not save', description: e?.message || 'Please try again.' });
      } finally {
        setSavingAttribution(false);
      }
    },
    [attributionMode, fetchBusinessSettings]
  );

  useEffect(() => {
    if (archivedNumber && !currentNumber) {
      setLastOwnedNumber(archivedNumber);
    } else if (currentNumber) {
      setLastOwnedNumber(null);
    }
  }, [archivedNumber, currentNumber]);

  const searchNumbers = useCallback(async () => {
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams();
      if (areaCode.trim()) params.set('areaCode', areaCode.trim());
      if (locality.trim()) params.set('locality', locality.trim());
      params.set('limit', '15');
      params.set('smsEnabled', 'true');

      const response = await api.get<{ numbers: AvailableNumber[] }>(`/api/sms/available-numbers?${params.toString()}`);
      if (response.data?.numbers) {
        const smsNumbers = response.data.numbers.filter(n => n.capabilities?.sms !== false);
        setNumbers(smsNumbers);
      } else if (response.error) {
        showToast({ type: 'error', message: response.error });
      }
    } catch (e: any) {
      showToast({ type: 'error', message: e?.message || 'Failed to search for numbers' });
    } finally {
      setLoading(false);
    }
  }, [areaCode, locality]);

  const handleRelease = () => {
    setReleaseConfirmText('');
    setShowReleaseModal(true);
  };

  const executeRelease = async () => {
    setReleasing(true);
    setShowReleaseModal(false);
    try {
      const response = await api.post('/api/sms/release-number', {});
      if (response.error) {
        showToast({ type: 'error', message: response.error });
      } else {
        await fetchBusinessSettings();
        showToast({ type: 'info', message: 'Reverted to Shared', description: 'Your dedicated number has been archived. You can re-apply it anytime from this screen without losing it.' });
      }
    } catch (e: any) {
      showToast({ type: 'error', message: e?.message || 'Failed to archive number' });
    } finally {
      setReleasing(false);
    }
  };

  const handleReacquireLastNumber = async () => {
    if (!lastOwnedNumber) return;
    // A dedicated number is a paid add-on — Pro plan or higher only.
    if (isFreePlan) {
      Alert.alert(
        'Upgrade Required',
        'A dedicated phone number requires a Pro plan or higher. Please upgrade your subscription first.',
        [
          { text: 'Not Now', style: 'cancel' },
          { text: 'View Plans', onPress: () => router.push(asHref('/more/subscription')) },
        ],
      );
      return;
    }
    Alert.alert(
      'Re-acquire Number',
      `Get ${formatPhone(lastOwnedNumber)} back as your dedicated business number?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Get It Back',
          onPress: async () => {
            setReacquiring(true);
            try {
              // iOS: re-acquiring is the same paid add-on, so go through Apple IAP and never
              // fall through to Stripe checkout.
              if (Platform.OS === 'ios') {
                if (!isIAPAvailable()) {
                  setReacquiring(false);
                  Alert.alert('Purchase Unavailable', 'In-app purchases are not available on this device right now. Please try again later.');
                  return;
                }
                setPendingDedicatedNumber(lastOwnedNumber);
                await purchaseSubscription(IAP_ADDON_PRODUCT_IDS.dedicatedNumber);
                setReacquiring(false);
                Alert.alert(
                  'Finishing Up',
                  `We're reactivating ${formatPhone(lastOwnedNumber)}. This can take a moment. Pull to refresh if it doesn't appear right away.`,
                );
                setTimeout(() => { fetchBusinessSettings(); }, 4000);
                return;
              }
              const response = await api.post('/api/sms/purchase-number', { phoneNumber: lastOwnedNumber });
              if (response.error) {
                if (response.error.includes('not available') || response.error.includes('not found')) {
                  showToast({ type: 'info', message: 'Number Unavailable', description: `${formatPhone(lastOwnedNumber)} is no longer available. You can search for a new number instead.` });
                  setLastOwnedNumber(null);
                } else if (response.error.includes('address') || response.error.includes('Address')) {
                  Alert.alert(
                    'Business Address Required',
                    'Australian phone numbers require a registered business address. Please add your full address in Settings first.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Go to Settings', onPress: () => router.push('/more/settings') },
                    ]
                  );
                } else {
                  showToast({ type: 'error', message: 'Error', description: response.error });
                }
              } else if (response.data && (response.data as any).requiresPayment) {
                const checkoutUrl = (response.data as any).checkoutUrl;
                if (checkoutUrl) {
                  Alert.alert(
                    'Payment Required',
                    'Dedicated phone numbers are a $10/month telecommunications service. You\'ll be taken to checkout to complete your purchase.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Continue to Payment', onPress: () => {
                        const Linking = require('react-native').Linking;
                        Linking.openURL(checkoutUrl);
                      }},
                    ]
                  );
                } else {
                  showToast({ type: 'error', message: 'Payment Required', description: 'Dedicated phone numbers are $10/month. Please contact admin@avwebinnovation.com for assistance.' });
                }
              } else {
                await fetchBusinessSettings();
                showToast({ type: 'info', message: 'Number Reactivated!', description: `${formatPhone(lastOwnedNumber)} is your dedicated number again.` });
              }
            } catch (e: any) {
              // Any failure drops the stashed number so it can't attach to a later purchase.
              setPendingDedicatedNumber(null);
              if (e?.code !== 'E_USER_CANCELLED' && e?.code !== 'E_PURCHASE_SUPERSEDED') {
                showToast({ type: 'error', message: 'Error', description: e?.message || 'Failed to re-acquire number' });
              }
            } finally {
              setReacquiring(false);
            }
          },
        },
      ]
    );
  };

  const handlePurchase = (number: AvailableNumber) => {
    // A dedicated number is a paid add-on — Pro plan or higher only.
    if (isFreePlan) {
      Alert.alert(
        'Upgrade Required',
        'A dedicated phone number requires a Pro plan or higher. Please upgrade your subscription first.',
        [
          { text: 'Not Now', style: 'cancel' },
          { text: 'View Plans', onPress: () => router.push(asHref('/more/subscription')) },
        ],
      );
      return;
    }

    Alert.alert(
      'Get This Number',
      `Set up ${formatPhone(number.phoneNumber)} as your dedicated business number?${number.locality ? `\n\nLocation: ${number.locality}` : ''}\n\nThis becomes your own business line. Clients call AND text it — it handles incoming and outgoing calls, SMS, and picture messages (MMS). You can also add an AI Receptionist to answer it for you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Get Number',
          onPress: async () => {
            setPurchasing(number.phoneNumber);
            try {
              // On iOS, dedicated numbers are sold as an Apple In-App Purchase. Apple policy
              // means iOS must NEVER open the Stripe checkout for add-ons, so handle the
              // whole iOS path here and return regardless of outcome.
              if (Platform.OS === 'ios') {
                if (!isIAPAvailable()) {
                  setPurchasing(null);
                  Alert.alert('Purchase Unavailable', 'In-app purchases are not available on this device right now. Please try again later.');
                  return;
                }
                setPendingDedicatedNumber(number.phoneNumber);
                await purchaseSubscription(IAP_ADDON_PRODUCT_IDS.dedicatedNumber);
                setPurchasing(null);
                Alert.alert(
                  'Finishing Up',
                  `We're activating ${formatPhone(number.phoneNumber)}. This can take a moment. Pull to refresh if it doesn't appear right away.`,
                );
                setTimeout(() => { fetchBusinessSettings(); }, 4000);
                return;
              }
              const response = await api.post('/api/sms/purchase-number', {
                phoneNumber: number.phoneNumber,
              });
              if (response.error) {
                if (response.error.includes('address') || response.error.includes('Address')) {
                  Alert.alert(
                    'Business Address Required',
                    'Australian phone numbers require a registered business address. Please add your full address (including street, suburb, state, and postcode) in Settings first.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Go to Settings', onPress: () => router.push('/more/settings') },
                    ]
                  );
                } else if (response.error.includes('already has')) {
                  showToast({ type: 'info', message: 'Already Have a Number', description: response.error });
                  await fetchBusinessSettings();
                } else {
                  showToast({ type: 'error', message: 'Error', description: response.error });
                }
              } else if (response.data && (response.data as any).requiresPayment) {
                const checkoutUrl = (response.data as any).checkoutUrl;
                if (checkoutUrl) {
                  Alert.alert(
                    'Payment Required',
                    'Dedicated phone numbers are a $10/month telecommunications service. You\'ll be taken to checkout to complete your purchase.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Continue to Payment', onPress: () => {
                        const Linking = require('react-native').Linking;
                        Linking.openURL(checkoutUrl);
                      }},
                    ]
                  );
                } else {
                  showToast({ type: 'error', message: 'Payment Required', description: 'Dedicated phone numbers are available as a $10/month add-on. Please contact admin@avwebinnovation.com for assistance.' });
                }
              } else {
                await fetchBusinessSettings();
                Alert.alert(
                  'Number Activated!',
                  `${formatPhone(number.phoneNumber)} is now your dedicated business number.\n\nYou've upgraded from the shared JobRunner number (0485 013 993). Your clients will now see your own number when you send SMS.\n\nYou can also set up an AI Receptionist on this number.`,
                  [
                    { text: 'Set Up AI Receptionist', onPress: () => router.replace(asHref('/more/ai-receptionist')) },
                    { text: 'Go to Chat Hub', onPress: () => router.replace('/more/chat-hub') },
                  ]
                );
              }
            } catch (e: any) {
              // Any failure (cancel, superseded, or a store error like "Invalid product ID")
              // must drop the stashed number so it can't attach to a later purchase.
              setPendingDedicatedNumber(null);
              if (e?.code !== 'E_USER_CANCELLED' && e?.code !== 'E_PURCHASE_SUPERSEDED') {
                showToast({ type: 'error', message: 'Error', description: e?.message || 'Failed to set up number. Please try again.' });
              }
            } finally {
              setPurchasing(null);
            }
          },
        },
      ]
    );
  };

  const fetchPortRequests = useCallback(async () => {
    setLoadingPortRequests(true);
    try {
      const response = await api.get<{ portRequests: PortRequest[] }>('/api/port-requests');
      if (response.data?.portRequests) {
        setPortRequests(response.data.portRequests);
      }
    } catch (e) {
      console.error('Failed to fetch port requests:', e);
    } finally {
      setLoadingPortRequests(false);
    }
  }, []);

  const submitPortRequest = useCallback(async () => {
    if (!portPhone.trim() || !portCarrier.trim() || !portAccount.trim()) {
      Alert.alert('Missing Details', 'Please fill in all required fields.');
      return;
    }
    if (!portLoaAgreed) {
      showToast({ type: 'info', message: 'Authorisation Required', description: 'You must agree to the Letter of Authorisation to proceed.' });
      return;
    }
    setSubmittingPort(true);
    try {
      const response = await api.post('/api/port-requests', {
        phoneNumber: portPhone.trim(),
        currentCarrier: portCarrier.trim(),
        accountNumber: portAccount.trim(),
        authorisationAgreed: true,
      });
      if (response.error) {
        showToast({ type: 'error', message: response.error });
      } else {
        showToast({ type: 'info', message: 'Port Request Submitted', description: 'Your number porting request has been submitted. Australian number ports typically take 5\u201310 business days. You can track the status on this screen.' });
        setShowPortForm(false);
        setPortPhone('');
        setPortCarrier('');
        setPortAccount('');
        setPortLoaAgreed(false);
        fetchPortRequests();
      }
    } catch (e: any) {
      showToast({ type: 'error', message: e?.message || 'Failed to submit port request.' });
    } finally {
      setSubmittingPort(false);
    }
  }, [portPhone, portCarrier, portAccount, portLoaAgreed, fetchPortRequests]);

  const fetchAiConfigs = useCallback(async () => {
    try {
      const response = await api.get<AiConfig[]>('/api/ai-receptionist/configs');
      if (response.data && Array.isArray(response.data)) {
        setAiConfigs(response.data);
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (readOnly) {
      // Read-only: only need to display the active number/config.
      fetchAiConfigs();
      return;
    }
    if (!currentNumber) searchNumbers();
    fetchPortRequests();
    fetchAiConfigs();
  }, []);

  const saveLabel = async (configId: string) => {
    try {
      await api.patch(`/api/ai-receptionist/configs/${configId}/label`, { label: labelText });
      setEditingLabel(null);
      fetchAiConfigs();
    } catch (e: any) {
      showToast({ type: 'error', message: e?.message || 'Failed to update label' });
    }
  };

  useEffect(() => {
    if (readOnly) return;
    if (!currentNumber && aiConfigs.length === 0) searchNumbers();
  }, [aiConfigs]);

  const formatPhone = (phone: string) => {
    if (phone.startsWith('+61')) {
      const local = phone.replace('+61', '0');
      return local.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3');
    }
    return phone;
  };

  // While the role is still resolving, show a spinner rather than flashing
  // either the owner controls or the read-only view.
  if (roleLoading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Read-only view for workers and subcontractors in a joined business. They can
  // see the active number(s)/AI Receptionist status, but cannot buy, release,
  // port, relabel, or change SMS attribution — those belong to the business owner.
  if (readOnly) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}>
          <Text style={styles.pageTitle}>Phone Numbers</Text>
          <Text style={styles.pageSubtitle}>
            The phone number and AI Receptionist for this business.
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: `${colors.info}10`, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.lg, gap: spacing.xs, borderWidth: 1, borderColor: `${colors.info}30` }}>
            <Feather name="lock" size={14} color={colors.info} />
            <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.info, flex: 1, lineHeight: 17 }}>
              These numbers are managed by the business owner. You have view-only access.
            </Text>
          </View>

          {aiConfigs.length > 0 ? (
            aiConfigs.map((cfg) => {
              const num = cfg.dedicatedPhoneNumber ? formatPhone(cfg.dedicatedPhoneNumber) : 'Pending setup';
              const statusLabel = cfg.enabled ? 'Active' : 'Inactive';
              const statusColor = cfg.enabled ? colors.success : colors.mutedForeground;
              return (
                <View key={cfg.id} style={{ backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, marginBottom: spacing.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
                      <Feather name="phone" size={16} color={colors.primary} />
                      <Text style={{ fontSize: typography.subtitle.fontSize, fontWeight: fontWeights.bold, color: colors.foreground }}>{num}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: `${statusColor}15`, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusColor }} />
                      <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.semibold, color: statusColor }}>{statusLabel}</Text>
                    </View>
                  </View>
                  {!!cfg.label && (
                    <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground, marginTop: spacing.xs }}>{cfg.label}</Text>
                  )}
                </View>
              );
            })
          ) : currentNumber ? (
            <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Feather name="phone" size={16} color={colors.primary} />
                <Text style={{ fontSize: typography.subtitle.fontSize, fontWeight: fontWeights.bold, color: colors.foreground }}>{formatPhone(currentNumber)}</Text>
              </View>
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: spacing['2xl'], gap: spacing.sm }}>
              <Feather name="phone-off" size={32} color={colors.mutedForeground} />
              <Text style={{ fontSize: typography.button.fontSize, color: colors.mutedForeground, textAlign: 'center' }}>
                No dedicated number set up for this business yet.
              </Text>
            </View>
          )}
        </ScrollView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView ref={scrollViewRef} style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.pageTitle}>Phone Numbers</Text>
        <Text style={styles.pageSubtitle}>
          Your dedicated Australian phone number for two-way SMS with clients and AI Receptionist calls.
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: `${colors.info}10`, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md, gap: spacing.xs, borderWidth: 1, borderColor: `${colors.info}30` }}>
          <Feather name="info" size={14} color={colors.info} />
          <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.info, flex: 1, lineHeight: 17 }}>
            Each dedicated number is $9.99/mo and includes two-way SMS with clients and AI Receptionist calls.
          </Text>
        </View>

        {/* SMS Sender Attribution — for teams sharing one business number */}
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: radius.lg,
            padding: spacing.md,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            marginBottom: spacing.lg,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 4 }}>
            <Feather name="users" size={14} color={colors.foreground} />
            <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.bold, color: colors.foreground }}>
              Team SMS attribution
            </Text>
          </View>
          <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, lineHeight: 17, marginBottom: spacing.md }}>
            When several workers reply from one shared business number, choose how clients see who sent each message.
          </Text>

          {[
            {
              key: 'off' as const,
              title: 'One business identity',
              desc: 'Every reply looks like it comes from your business — clean and consistent. (Default)',
            },
            {
              key: 'name_prefix' as const,
              title: 'Tag with worker name',
              desc: 'Prepend "From [Name]: " when a team member replies, so clients know who they\'re chatting with.',
            },
          ].map((opt) => {
            const selected = attributionMode === opt.key;
            return (
              <PressableRow key={opt.key} onPress={() => updateAttribution(opt.key)} disabled={savingAttribution} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? `${colors.primary}10` : 'transparent', marginBottom: spacing.xs, opacity: savingAttribution ? 0.6 : 1, }} >
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    borderWidth: 2,
                    borderColor: selected ? colors.primary : colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 2,
                  }}
                >
                  {selected && (
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.foreground, marginBottom: 2 }}>
                    {opt.title}
                  </Text>
                  <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, lineHeight: 17 }}>
                    {opt.desc}
                  </Text>
                </View>
              </PressableRow>
            );
          })}

          {/* Roadmap teaser for Phase B */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: spacing.sm,
              padding: spacing.sm,
              borderRadius: radius.md,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.border,
              backgroundColor: `${colors.muted}40`,
              marginTop: 2,
            }}
          >
            <Feather name="clock" size={14} color={colors.mutedForeground} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.foreground, marginBottom: 2 }}>
                Per-worker numbers — coming soon
              </Text>
              <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, lineHeight: 17 }}>
                Give each worker their own dedicated SMS number, with replies routed back to the right person automatically.
              </Text>
            </View>
          </View>
        </View>

        {aiConfigs.length > 0 ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm, gap: spacing.sm }}>
              <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.bold, color: colors.foreground }}>
                Your Numbers ({aiConfigs.length}/{MAX_NUMBERS})
              </Text>
              {aiConfigs.length < MAX_NUMBERS && (
                <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground }}>
                  {MAX_NUMBERS - aiConfigs.length} slot{MAX_NUMBERS - aiConfigs.length !== 1 ? 's' : ''} available
                </Text>
              )}
            </View>

            {aiConfigs.map((cfg) => (
              <View key={cfg.id} style={styles.currentNumberCard}>
                <View style={styles.currentNumberHeader}>
                  <View style={styles.activeIndicator}>
                    <View style={[styles.activeDot, !cfg.enabled && { backgroundColor: colors.mutedForeground }]} />
                    <Text style={styles.activeLabel}>
                      {cfg.enabled ? 'Active' : cfg.approvalStatus === 'provisioning' ? 'Setting Up' : 'Inactive'}
                    </Text>
                  </View>
                  {editingLabel === cfg.id ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                      <TextInput
                        style={{ fontSize: typography.captionSmall.fontSize, color: colors.foreground, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.xs, paddingVertical: 2, minWidth: 100 }}
                        value={labelText}
                        onChangeText={setLabelText}
                        placeholder="Label"
                        placeholderTextColor={colors.mutedForeground}
                        maxLength={100}
                        autoFocus
                      />
                      <PressableRow onPress={() => saveLabel(cfg.id)} >
                        <Feather name="check" size={16} color={colors.success} />
                      </PressableRow>
                      <PressableRow onPress={() => setEditingLabel(null)} >
                        <Feather name="x" size={16} color={colors.mutedForeground} />
                      </PressableRow>
                    </View>
                  ) : (
                    <PressableRow onPress={() => { setEditingLabel(cfg.id); setLabelText(cfg.label || ''); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} >
                      <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.primary }}>
                        {cfg.label || 'Add Label'}
                      </Text>
                      <Feather name="edit-2" size={11} color={colors.primary} />
                    </PressableRow>
                  )}
                </View>
                <View style={styles.currentNumberRow}>
                  <View style={styles.currentNumberIcon}>
                    <Feather name="phone" size={22} color={cfg.enabled ? colors.success : colors.mutedForeground} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.currentNumberText}>
                      {cfg.dedicatedPhoneNumber ? formatPhone(cfg.dedicatedPhoneNumber) : 'No number'}
                    </Text>
                    <Text style={styles.currentNumberDesc}>
                      {cfg.label || (cfg.mode === 'always_on_message' ? 'Message Mode' : cfg.mode === 'always_on_transfer' ? 'Transfer Mode' : cfg.mode || 'AI Receptionist')}
                      {cfg.voiceName ? ` \u2022 ${cfg.voiceName}` : ''}
                    </Text>
                  </View>
                </View>

                <View style={styles.currentNumberActions}>
                  <PressableRow style={styles.actionButton} onPress={() => router.push(asHref(`/more/ai-receptionist?configId=${cfg.id}`))} >
                    <Feather name="settings" size={14} color={colors.primary} />
                    <Text style={[styles.actionButtonText, { color: colors.primary }]}>Configure AI</Text>
                  </PressableRow>
                  <PressableRow style={styles.actionButton} onPress={() => router.push('/more/chat-hub')} >
                    <Feather name="message-square" size={14} color={colors.primary} />
                    <Text style={[styles.actionButtonText, { color: colors.primary }]}>Chat Hub</Text>
                  </PressableRow>
                </View>
              </View>
            ))}

            {aiConfigs.length < MAX_NUMBERS && (
              <>
                <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.bold, color: colors.foreground, marginTop: spacing.lg, marginBottom: spacing.sm }}>Add Another Number</Text>
                <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, marginBottom: spacing.md }}>
                  You can add up to {MAX_NUMBERS} dedicated numbers, each with its own AI Receptionist configuration.
                </Text>
              </>
            )}
          </>
        ) : currentNumber ? (
          <>
            <View style={styles.currentNumberCard}>
              <View style={styles.currentNumberHeader}>
                <View style={styles.activeIndicator}>
                  <View style={styles.activeDot} />
                  <Text style={styles.activeLabel}>Active - Your Dedicated Number</Text>
                </View>
              </View>
              <View style={styles.currentNumberRow}>
                <View style={styles.currentNumberIcon}>
                  <Feather name="phone" size={22} color={colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.currentNumberText}>{formatPhone(currentNumber)}</Text>
                  <Text style={styles.currentNumberDesc}>Your business SMS & calling number</Text>
                </View>
              </View>

              <View style={styles.currentNumberActions}>
                <PressableRow style={styles.actionButton} onPress={() => router.push(asHref('/more/ai-receptionist'))} >
                  <Feather name="cpu" size={14} color={colors.primary} />
                  <Text style={[styles.actionButtonText, { color: colors.primary }]}>AI Receptionist</Text>
                </PressableRow>
                <PressableRow style={styles.actionButton} onPress={() => router.push('/more/chat-hub')} >
                  <Feather name="message-square" size={14} color={colors.primary} />
                  <Text style={[styles.actionButtonText, { color: colors.primary }]}>Chat Hub</Text>
                </PressableRow>
              </View>
            </View>

            <PressableRow style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: `${colors.destructive}06`, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: `${colors.destructive}15`, marginTop: spacing.md, marginBottom: spacing.lg }} onPress={handleRelease} >
              <Feather name="rotate-ccw" size={14} color={colors.destructive} />
              <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.destructive }}>Revert to Shared Number</Text>
            </PressableRow>
          </>
        ) : (
          <>
            <View style={{ backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, marginBottom: spacing.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.mutedForeground }} />
                <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.mutedForeground }}>
                  Using Shared Number
                </Text>
              </View>
              <Text style={{ fontSize: typography.sizes['2xl'], fontWeight: fontWeights.bold, color: colors.foreground, marginBottom: 4 }}>0485 013 993</Text>
              <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, lineHeight: 18 }}>
                You're on the shared JobRunner platform number. Get a dedicated number below so clients see your own business number.
              </Text>
            </View>
          </>
        )}

        {lastOwnedNumber && !currentNumber && (
          <View style={{ backgroundColor: `${colors.primary}08`, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: `${colors.primary}25`, marginBottom: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
              <Feather name="rotate-ccw" size={14} color={colors.primary} />
              <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.foreground }}>Previously Owned Number</Text>
            </View>
            <Text style={{ fontSize: typography.sizes.lg, fontWeight: fontWeights.bold, color: colors.primary, marginBottom: spacing.xs }}>
              {formatPhone(lastOwnedNumber)}
            </Text>
            <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, lineHeight: 18, marginBottom: spacing.md }}>
              Want this number back? Tap below to re-acquire it if it's still available.
            </Text>
            <PressableRow style={{ backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: spacing.xs }} onPress={handleReacquireLastNumber} disabled={reacquiring} >
              {reacquiring ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Feather name="phone" size={14} color={colors.primaryForeground} />
              )}
              <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.primaryForeground }}>
                {reacquiring ? 'Re-acquiring...' : 'Get This Number Back'}
              </Text>
            </PressableRow>
          </View>
        )}

        {aiConfigs.length < MAX_NUMBERS && (
          <>
            {portRequests.filter(r => r.status === 'submitted' || r.status === 'processing' || r.status === 'completed').map(pr => {
              const statusConfig: Record<string, { color: string; icon: 'clock' | 'loader' | 'check-circle' | 'x-circle'; label: string }> = {
                submitted: { color: colors.warning, icon: 'clock', label: 'Submitted' },
                processing: { color: colors.info, icon: 'loader', label: 'Processing' },
                completed: { color: colors.success, icon: 'check-circle', label: 'Completed' },
                failed: { color: colors.destructive, icon: 'x-circle', label: 'Failed' },
              };
              const sc = statusConfig[pr.status] || statusConfig.submitted;
              return (
                <View key={pr.id} style={{ backgroundColor: `${sc.color}08`, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: `${sc.color}25`, marginBottom: spacing.lg }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                    <Feather name={pr.status === 'completed' ? 'check-circle' : 'phone-forwarded'} size={14} color={sc.color} />
                    <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.foreground }}>
                      {pr.status === 'completed' ? 'Number Ported Successfully' : `Port Request — ${sc.label}`}
                    </Text>
                  </View>
                  <Text style={{ fontSize: typography.sizes.lg, fontWeight: fontWeights.bold, color: colors.foreground, marginBottom: spacing.xs }}>
                    {formatPhone(pr.phoneNumber)}
                  </Text>
                  <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, lineHeight: 18 }}>
                    Carrier: {pr.currentCarrier}
                  </Text>

                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, gap: spacing.xs }}>
                    {['submitted', 'processing', 'completed'].map((step, idx) => {
                      const stepDone = ['submitted', 'processing', 'completed'].indexOf(pr.status) >= idx;
                      return (
                        <View key={step} style={{ flex: 1, alignItems: 'center' }}>
                          <View style={{ width: '100%', height: 4, borderRadius: 2, backgroundColor: stepDone ? sc.color : `${colors.muted}80`, marginBottom: 4 }} />
                          <Text style={{ fontSize: typography.sizes.xs, color: stepDone ? sc.color : colors.mutedForeground, textTransform: 'capitalize' }}>
                            {step}
                          </Text>
                        </View>
                      );
                    })}
                  </View>

                  {pr.status === 'completed' && pr.completedAt && (
                    <Text style={{ fontSize: typography.sizes.xs, color: colors.success, marginTop: spacing.sm, fontWeight: fontWeights.medium }}>
                      Ported on {new Date(pr.completedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })} — Number is now active on your account.
                    </Text>
                  )}
                  {pr.status !== 'completed' && pr.estimatedCompletionDate && (
                    <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground, marginTop: spacing.sm }}>
                      Estimated completion: {new Date(pr.estimatedCompletionDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  )}
                  {pr.adminNotes && (
                    <View style={{ backgroundColor: `${colors.muted}50`, borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.sm }}>
                      <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground }}>{pr.adminNotes}</Text>
                    </View>
                  )}

                  {pr.status !== 'completed' && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: `${colors.info}10`, borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.sm, gap: spacing.xs }}>
                      <Feather name="info" size={12} color={colors.info} />
                      <Text style={{ fontSize: typography.sizes.xs, color: colors.info, flex: 1, lineHeight: 16 }}>
                        AU number ports typically take 5–10 business days. We'll update the status as it progresses.
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}

            {portRequests.filter(r => r.status === 'failed').length > 0 && (
              <View style={{ marginBottom: spacing.md }}>
                {portRequests.filter(r => r.status === 'failed').map(pr => (
                  <View key={pr.id} style={{ backgroundColor: `${colors.destructive}08`, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: `${colors.destructive}25`, marginBottom: spacing.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
                      <Feather name="x-circle" size={14} color={colors.destructive} />
                      <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.destructive }}>Port Failed</Text>
                    </View>
                    <Text style={{ fontSize: typography.button.fontSize, color: colors.foreground }}>{formatPhone(pr.phoneNumber)}</Text>
                    {pr.adminNotes && (
                      <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, marginTop: spacing.xs }}>{pr.adminNotes}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            <View onLayout={(e) => { searchSectionY.current = e.nativeEvent.layout.y; }} style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
              <PressableRow style={{ flex: 1, backgroundColor: showPortForm ? `${colors.primary}15` : colors.card, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: showPortForm ? colors.primary : colors.border, alignItems: 'center', gap: spacing.xs }} onPress={() => setShowPortForm(true)} >
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `${colors.primary}15`, alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="phone-forwarded" size={16} color={colors.primary} />
                </View>
                <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.foreground }}>Port My Number</Text>
                <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground, textAlign: 'center' }}>Keep your existing number</Text>
              </PressableRow>
              <PressableRow style={{ flex: 1, backgroundColor: !showPortForm ? `${colors.primary}15` : colors.card, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: !showPortForm ? colors.primary : colors.border, alignItems: 'center', gap: spacing.xs }} onPress={() => setShowPortForm(false)} >
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `${colors.primary}15`, alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="plus" size={16} color={colors.primary} />
                </View>
                <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.foreground }}>Get New Number</Text>
                <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground, textAlign: 'center' }}>Search Australian numbers</Text>
              </PressableRow>
            </View>

            {showPortForm ? (
              <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, marginBottom: spacing.lg }}>
                <Text style={{ fontSize: typography.subtitle.fontSize, fontWeight: fontWeights.bold, color: colors.foreground, marginBottom: spacing.xs }}>Port Your Existing Number</Text>
                <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, lineHeight: 18, marginBottom: spacing.md }}>
                  Bring your current business number to JobRunner. Your clients keep calling the same number — and our AI can answer it.
                </Text>

                <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.foreground, marginBottom: 4 }}>Phone Number</Text>
                <TextInput
                  style={[styles.searchInput, { marginBottom: spacing.sm }]}
                  placeholder="e.g. 0412 345 678"
                  placeholderTextColor={colors.mutedForeground}
                  value={portPhone}
                  onChangeText={setPortPhone}
                  keyboardType="phone-pad"
                />

                <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.foreground, marginBottom: 4 }}>Current Carrier / Provider</Text>
                <TextInput
                  style={[styles.searchInput, { marginBottom: spacing.sm }]}
                  placeholder="e.g. Telstra, Optus, Vodafone"
                  placeholderTextColor={colors.mutedForeground}
                  value={portCarrier}
                  onChangeText={setPortCarrier}
                />

                <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.foreground, marginBottom: 4 }}>Account Number</Text>
                <TextInput
                  style={[styles.searchInput, { marginBottom: spacing.md }]}
                  placeholder="Your carrier account number"
                  placeholderTextColor={colors.mutedForeground}
                  value={portAccount}
                  onChangeText={setPortAccount}
                />

                <PressableRow style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.md }} onPress={() => setPortLoaAgreed(!portLoaAgreed)} >
                  <View style={{
                    width: 22, height: 22, borderRadius: 4, borderWidth: 2,
                    borderColor: portLoaAgreed ? colors.primary : colors.border,
                    backgroundColor: portLoaAgreed ? colors.primary : 'transparent',
                    alignItems: 'center', justifyContent: 'center', marginTop: 1,
                  }}>
                    {portLoaAgreed && <Feather name="check" size={14} color={colors.primaryForeground} />}
                  </View>
                  <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.foreground, flex: 1, lineHeight: 18 }}>
                    I authorise JobRunner to submit a porting request on my behalf (Letter of Authorisation). I confirm I am the authorised account holder for this number.
                  </Text>
                </PressableRow>

                <View style={{ backgroundColor: `${colors.info}10`, borderRadius: radius.sm, padding: spacing.sm, marginBottom: spacing.md, flexDirection: 'row', gap: spacing.xs }}>
                  <Feather name="clock" size={12} color={colors.info} style={{ marginTop: 2 }} />
                  <Text style={{ fontSize: typography.sizes.xs, color: colors.info, flex: 1, lineHeight: 16 }}>
                    Australian number ports typically take 5–10 business days. Your number will continue working with your current carrier during this time.
                  </Text>
                </View>

                <PressableRow style={{ backgroundColor: (portPhone && portCarrier && portAccount && portLoaAgreed) ? colors.primary : colors.muted, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, opacity: (portPhone && portCarrier && portAccount && portLoaAgreed) ? 1 : 0.5, }} onPress={submitPortRequest} disabled={submittingPort || !portPhone || !portCarrier || !portAccount || !portLoaAgreed} >
                  {submittingPort ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <Feather name="send" size={14} color={(portPhone && portCarrier && portAccount && portLoaAgreed) ? colors.primaryForeground : colors.mutedForeground} />
                  )}
                  <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: (portPhone && portCarrier && portAccount && portLoaAgreed) ? colors.primaryForeground : colors.mutedForeground }}>
                    {submittingPort ? 'Submitting...' : 'Submit Port Request'}
                  </Text>
                </PressableRow>
              </View>
            ) : (
            <>
            <View style={styles.searchCard}>
              <Text style={styles.searchLabel}>Filter by area (optional)</Text>
              <View style={styles.searchRow}>
                <TextInput
                  style={[styles.searchInput, { flex: 1 }]}
                  placeholder="Area code (e.g. 07)"
                  placeholderTextColor={colors.mutedForeground}
                  value={areaCode}
                  onChangeText={setAreaCode}
                  keyboardType="number-pad"
                  maxLength={4}
                />
                <TextInput
                  style={[styles.searchInput, { flex: 1.5 }]}
                  placeholder="City (e.g. Brisbane)"
                  placeholderTextColor={colors.mutedForeground}
                  value={locality}
                  onChangeText={setLocality}
                />
              </View>
              <PressableRow style={[styles.searchButton, loading && { opacity: 0.6 }]} onPress={searchNumbers} disabled={loading} >
                {loading ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Feather name="search" size={16} color={colors.primaryForeground} />
                )}
                <Text style={styles.searchButtonText}>{loading ? 'Searching...' : 'Search Numbers'}</Text>
              </PressableRow>
            </View>

            {loading && !searched ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Finding available numbers...</Text>
              </View>
            ) : numbers.length > 0 ? (
              <View style={styles.resultsSection}>
                <Text style={styles.resultsTitle}>Available Numbers</Text>
                <Text style={styles.resultsSubtitle}>{numbers.length} numbers found. Tap to select.</Text>
                {numbers.map((num) => (
                  <PressableRow key={num.phoneNumber} style={styles.numberCard} onPress={() => handlePurchase(num)} disabled={purchasing === num.phoneNumber} >
                    <View style={styles.numberIcon}>
                      {purchasing === num.phoneNumber ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Feather name="phone" size={18} color={colors.primary} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.numberText}>{formatPhone(num.phoneNumber)}</Text>
                      {num.locality && (
                        <Text style={styles.numberLocation}>
                          <Feather name="map-pin" size={11} color={colors.mutedForeground} /> {num.locality}{num.region ? `, ${num.region}` : ''}
                        </Text>
                      )}
                      <View style={styles.capsRow}>
                        <View style={[styles.capBadge, { backgroundColor: `${colors.primary}15` }]}>
                          <Feather name="phone-call" size={10} color={colors.primary} />
                          <Text style={[styles.capText, { color: colors.primary }]}>Calls</Text>
                        </View>
                        <View style={[styles.capBadge, { backgroundColor: `${colors.success}15` }]}>
                          <Feather name="message-square" size={10} color={colors.success} />
                          <Text style={[styles.capText, { color: colors.success }]}>Texts (SMS/MMS)</Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.selectButton}>
                      <Text style={styles.selectButtonText}>Select</Text>
                    </View>
                  </PressableRow>
                ))}
              </View>
            ) : searched && !loading ? (
              <View style={styles.emptyContainer}>
                <Feather name="phone-off" size={32} color={colors.mutedForeground} />
                <Text style={styles.emptyTitle}>No SMS Numbers Found</Text>
                <Text style={styles.emptyDesc}>
                  Try searching without filters, or with a different area code or city. Australian mobile numbers typically support SMS.
                </Text>
                <PressableRow style={styles.retryButton} onPress={() => { setAreaCode(''); setLocality(''); setTimeout(searchNumbers, 100); }} >
                  <Feather name="refresh-cw" size={14} color={colors.primary} />
                  <Text style={[styles.actionButtonText, { color: colors.primary }]}>Search All Numbers</Text>
                </PressableRow>
              </View>
            ) : null}
          </>
        )}
          </>
        )}

        <View style={{ height: spacing.xl }} />
      </ScrollView>

      <Modal
        visible={showReleaseModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowReleaseModal(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <View style={{ flex: 1, backgroundColor: colors.background, padding: spacing.lg, paddingTop: spacing.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xl }}>
            <Text style={{ fontSize: typography.sizes.xl, fontWeight: fontWeights.bold, color: colors.foreground }}>Revert to Shared</Text>
            <PressableRow onPress={() => setShowReleaseModal(false)} >
              <Feather name="x" size={24} color={colors.mutedForeground} />
            </PressableRow>
          </View>

          <View style={{ backgroundColor: `${colors.primary}10`, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
              <Feather name="info" size={18} color={colors.primary} />
              <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.primary }}>Your number will be archived</Text>
            </View>
            <Text style={{ fontSize: typography.sizes.sm, color: colors.foreground, lineHeight: 20 }}>
              Reverting {formatPhone(currentNumber || '')} means:{'\n'}
              {'\n'}{'\u2022'} You'll go back to the shared JobRunner number
              {'\n'}{'\u2022'} Your AI Receptionist will be paused if active
              {'\n'}{'\u2022'} Existing SMS conversations will be kept
              {'\n'}{'\u2022'} Your number is archived — re-apply it anytime
            </Text>
          </View>

          <Text style={{ fontSize: typography.button.fontSize, color: colors.foreground, fontWeight: fontWeights.semibold, marginBottom: spacing.sm }}>
            Type REVERT to confirm
          </Text>
          <TextInput
            style={{
              backgroundColor: colors.card,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: releaseConfirmText === 'REVERT' ? colors.primary : colors.border,
              padding: spacing.md,
              fontSize: typography.subtitle.fontSize,
              fontWeight: fontWeights.semibold,
              color: colors.foreground,
              letterSpacing: 2,
              textAlign: 'center',
              marginBottom: spacing.lg,
            }}
            placeholder="REVERT"
            placeholderTextColor={colors.mutedForeground + '60'}
            value={releaseConfirmText}
            onChangeText={setReleaseConfirmText}
            autoCapitalize="characters"
            autoCorrect={false}
          />

          <PressableRow style={{ backgroundColor: releaseConfirmText === 'REVERT' ? colors.primary : colors.muted, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', opacity: releaseConfirmText === 'REVERT' ? 1 : 0.5, }} onPress={executeRelease} disabled={releaseConfirmText !== 'REVERT' || releasing} >
            {releasing ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={{ fontSize: typography.sizes.md, fontWeight: fontWeights.bold, color: releaseConfirmText === 'REVERT' ? colors.white : colors.mutedForeground }}>
                Revert to Shared
              </Text>
            )}
          </PressableRow>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
  },
  pageTitle: {
    fontSize: typography.sizes['3xl'],
    fontWeight: fontWeights.bold,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  pageSubtitle: {
    fontSize: typography.sizes.md,
    color: colors.mutedForeground,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  currentNumberCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  currentNumberHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: spacing.md,
  },
  activeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${colors.success}15`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  activeLabel: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.success,
  },
  currentNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  currentNumberIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: `${colors.success}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentNumberText: {
    fontSize: typography.sizes['2xl'],
    fontWeight: fontWeights.bold,
    color: colors.foreground,
    letterSpacing: 0.5,
  },
  currentNumberDesc: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  currentNumberActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: `${colors.primary}10`,
  },
  releaseButton: {
    backgroundColor: `${colors.destructive}10`,
  },
  actionButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.semibold,
  },
  searchCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  searchLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  searchRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  searchInput: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.sm,
    fontSize: typography.sizes.md,
    color: colors.foreground,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  searchButtonText: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.primaryForeground,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: typography.button.fontSize,
    color: colors.mutedForeground,
  },
  resultsSection: {
    marginBottom: spacing.md,
  },
  resultsTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
    marginBottom: 4,
  },
  resultsSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
  numberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  numberIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    letterSpacing: 0.5,
  },
  numberLocation: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  capsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: 4,
  },
  capBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  capText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.medium,
  },
  selectButton: {
    backgroundColor: `${colors.primary}15`,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  selectButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  emptyDesc: {
    fontSize: typography.button.fontSize,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.md,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: `${colors.primary}10`,
    marginTop: spacing.sm,
  },
});
