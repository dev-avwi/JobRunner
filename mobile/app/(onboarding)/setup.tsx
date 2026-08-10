import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../src/lib/api';
import { useAuthStore } from '../../src/lib/store';
import { validateABN, formatABN } from '../../src/lib/format';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingMagicScreen } from '../../src/components/OnboardingMagicScreen';
import { OnboardingTour, hasCompletedOnboarding } from '../../src/components/OnboardingTour';
import { markOnboardingSetupFailed, clearOnboardingSetupFailure } from '../../src/lib/onboardingSetupStatus';
import { useConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { typography, fontWeights, spacing } from '../../src/lib/design-tokens';

const ONBOARDING_DRAFT_KEY = 'onboarding:owner-draft:v1';

type OnboardingRole = 'owner' | 'worker' | 'subcontractor' | null;

type OwnerStep = 'role' | 'business' | 'trade' | 'teamSize' | 'complete';
type WorkerStep = 'role' | 'inviteCode' | 'workerDetails' | 'complete';
type SubcontractorStep = 'role' | 'subDetails' | 'subConnect' | 'privacy' | 'complete';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const tradeTypes = [
  { value: 'electrical', label: 'Electrical', icon: 'flash' as const },
  { value: 'plumbing', label: 'Plumbing', icon: 'water' as const },
  { value: 'carpentry', label: 'Carpentry', icon: 'hammer' as const },
  { value: 'hvac', label: 'HVAC', icon: 'snow' as const },
  { value: 'painting', label: 'Painting', icon: 'brush' as const },
  { value: 'landscaping', label: 'Landscaping', icon: 'leaf' as const },
  { value: 'building', label: 'Building', icon: 'home' as const },
  { value: 'other', label: 'General/Other', icon: 'construct' as const },
];

const teamSizes = [
  { value: 'solo', label: 'Just me', description: 'Solo operator', icon: 'person' as const },
  { value: 'small', label: '2 \u2013 5', description: 'Small crew', icon: 'people' as const },
  { value: 'medium', label: '6 \u2013 10', description: 'Growing team', icon: 'business' as const },
  { value: 'large', label: '10+', description: 'Large operation', icon: 'globe' as const },
];


export default function OnboardingSetupScreen() {
  const setupInsets = useSafeAreaInsets();
  const [selectedRole, setSelectedRole] = useState<OnboardingRole>(null);
  const [ownerStep, setOwnerStep] = useState<OwnerStep>('role');
  const [workerStep, setWorkerStep] = useState<WorkerStep>('role');
  const [subStep, setSubStep] = useState<SubcontractorStep>('role');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSettings, setIsCheckingSettings] = useState(true);
  
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const confirm = useConfirmDialog();
  const { user, fetchBusinessSettings } = useAuthStore();

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  const [businessData, setBusinessData] = useState({
    teamSize: '',
    businessName: '',
    tradeType: '',
    abn: '',
    phone: '',
    ownerName: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || '',
    gstEnabled: true,
    defaultHourlyRate: '120',
    calloutFee: '90',
  });

  const [inviteCode, setInviteCode] = useState('');
  const [inviteValidation, setInviteValidation] = useState<{ valid: boolean; businessName?: string; roleType?: string; ownerName?: string; error?: string } | null>(null);
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const validateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [workerName, setWorkerName] = useState(user?.firstName || '');
  const [workerLastName, setWorkerLastName] = useState(user?.lastName || '');
  const [workerPhone, setWorkerPhone] = useState('');

  const [subName, setSubName] = useState(user?.firstName || '');
  const [subLastName, setSubLastName] = useState(user?.lastName || '');
  const [subPhone, setSubPhone] = useState('');
  const [subTradeType, setSubTradeType] = useState('');
  const [subAbn, setSubAbn] = useState('');
  const [subInviteCode, setSubInviteCode] = useState('');
  const [subInviteValidation, setSubInviteValidation] = useState<{ valid: boolean; businessName?: string; roleType?: string; ownerName?: string; error?: string } | null>(null);
  const [isValidatingSubCode, setIsValidatingSubCode] = useState(false);
  const subValidateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [demoDataSeeded, setDemoDataSeeded] = useState(false);
  // Owner-only choice on the final setup step: whether to preload sample
  // clients/jobs/quotes so the app isn't empty while they explore. Defaults on,
  // but is now an explicit, visible toggle (previously it always seeded).
  const [loadSampleData, setLoadSampleData] = useState(true);
  const [hasHydratedDraft, setHasHydratedDraft] = useState(false);
  const [showMagic, setShowMagic] = useState(false);
  const [showTour, setShowTour] = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;

  const searchParams = useLocalSearchParams<{ resume?: string }>();
  const isResuming = searchParams?.resume === '1';

  // Autosave owner-step entries (business name, trade, phone, ABN, etc.) to
  // AsyncStorage so a force-quit mid-wizard doesn't lose them. Server-side
  // settings still win on next mount — this only fills the gaps.
  useEffect(() => {
    if (!hasHydratedDraft) return;
    const timer = setTimeout(() => {
      AsyncStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(businessData)).catch(() => {});
    }, 400);
    return () => clearTimeout(timer);
  }, [businessData, hasHydratedDraft]);

  const clearOnboardingDraft = () => {
    AsyncStorage.removeItem(ONBOARDING_DRAFT_KEY).catch(() => {});
  };

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        // Hydrate any local draft FIRST so server values overlay on top of
        // it (server wins for fields it has, draft fills the rest).
        try {
          const raw = await AsyncStorage.getItem(ONBOARDING_DRAFT_KEY);
          if (raw) {
            const draft = JSON.parse(raw);
            if (draft && typeof draft === 'object') {
              setBusinessData(prev => ({ ...prev, ...draft }));
            }
          }
        } catch {}
        await fetchBusinessSettings();
        const settings = useAuthStore.getState().businessSettings;

        // Honor `?resume=1` from the dashboard reminder banner — owners who
        // skipped onboarding need to be allowed back into the wizard even
        // though `onboardingCompleted=true`.
        if (settings?.onboardingCompleted && !isResuming) {
          router.replace('/(tabs)');
          return;
        }
        if (isResuming) {
          // Pre-seed the wizard with whatever the owner has so far.
          if (settings) {
            setBusinessData(prev => ({
              ...prev,
              teamSize: settings.teamSize || '',
              businessName: settings.businessName || '',
              tradeType: settings.tradeType || '',
              abn: settings.abn || '',
              phone: settings.phone || '',
              gstEnabled: settings.gstEnabled ?? true,
              defaultHourlyRate: String(settings.defaultHourlyRate || '120'),
              calloutFee: String(settings.calloutFee || '90'),
            }));
            setSelectedRole('owner');
            setOwnerStep(settings.businessName ? 'trade' : 'business');
          }
          setIsCheckingSettings(false);
          return;
        }

        const currentUser = useAuthStore.getState().user;
        const hasTeam = currentUser?.teamOwnerId || currentUser?.activeTeamId;
        const hasBusinessSetup = settings?.businessName && settings?.tradeType;

        if (hasTeam || hasBusinessSetup) {
          try {
            await api.post('/api/onboarding/complete', {});
            await fetchBusinessSettings();
            router.replace('/(tabs)');
            return;
          } catch (e) {
            console.error('Auto-complete onboarding failed:', e);
          }
        }

        try {
          const invitesRes = await api.get<{ invites?: Array<{ id: string }> }>('/api/auth/pending-invites');
          const invites = invitesRes?.data?.invites;
          if (invites && invites.length > 0) {
            const invite = invites[0];
            try {
              await api.post('/api/auth/accept-invite', { teamMemberId: invite.id });
              await api.post('/api/onboarding/complete', {});
              await fetchBusinessSettings();
              router.replace('/(tabs)');
              return;
            } catch (acceptErr) {
              console.error('Auto-accept invite failed:', acceptErr);
            }
          }
        } catch (inviteErr) {
          console.log('Could not check pending invites:', inviteErr);
        }

        if (settings) {
          setBusinessData(prev => ({
            ...prev,
            teamSize: settings.teamSize || '',
            businessName: settings.businessName || '',
            tradeType: settings.tradeType || '',
            abn: settings.abn || '',
            phone: settings.phone || '',
            gstEnabled: settings.gstEnabled ?? true,
            defaultHourlyRate: String(settings.defaultHourlyRate || '120'),
            calloutFee: String(settings.calloutFee || '90'),
          }));

          if (settings.businessName && settings.tradeType) {
            setSelectedRole('owner');
            setOwnerStep('teamSize');
          } else if (settings.businessName) {
            setSelectedRole('owner');
            setOwnerStep('trade');
          } else {
            // Brand new signup: show the role chooser first so the user
            // can pick owner / worker / subcontractor for themselves
            // instead of being forced down the owner path.
            setSelectedRole(null);
          }
        } else {
          // No settings record yet — fresh signup: show the role chooser.
          setSelectedRole(null);
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
      } finally {
        setIsCheckingSettings(false);
        setHasHydratedDraft(true);
      }
    };
    checkOnboardingStatus();
  }, []);

  const validateInviteCode = async (code: string, isSub = false) => {
    const setValidation = isSub ? setSubInviteValidation : setInviteValidation;
    const setValidating = isSub ? setIsValidatingSubCode : setIsValidatingCode;

    if (code.length !== 6) {
      setValidation(null);
      return;
    }

    setValidating(true);
    try {
      const response = await api.get(`/api/team/invite-code/validate/${code.toUpperCase()}`);
      if (response.error || !response.data) {
        // A timeout / network / 5xx / 429 returns { error } with NO data. Surface
        // it as an invalid result so the user sees a message instead of a button
        // that silently refuses to do anything.
        setValidation({ valid: false, error: response.error || "Couldn't check this code. Check your connection and try again." });
      } else {
        setValidation(response.data as { valid: boolean; businessName?: string; roleType?: string; ownerName?: string; error?: string });
      }
    } catch (error) {
      setValidation({ valid: false, error: 'Failed to validate code' });
    } finally {
      setValidating(false);
    }
  };

  const handleInviteCodeChange = (text: string, isSub = false) => {
    const clean = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (isSub) {
      setSubInviteCode(clean);
      if (subValidateTimer.current) clearTimeout(subValidateTimer.current);
      if (clean.length === 6) {
        subValidateTimer.current = setTimeout(() => validateInviteCode(clean, true), 300);
      } else {
        setSubInviteValidation(null);
      }
    } else {
      setInviteCode(clean);
      if (validateTimer.current) clearTimeout(validateTimer.current);
      if (clean.length === 6) {
        validateTimer.current = setTimeout(() => validateInviteCode(clean, false), 300);
      } else {
        setInviteValidation(null);
      }
    }
  };

  const handleSaveBusinessSettings = async (): Promise<boolean> => {
    if (!businessData.businessName || !businessData.tradeType) {
      Alert.alert('Missing Info', 'Please enter business name and trade type');
      return false;
    }

    // ABN is optional and validated softly — show inline error in the field
    // (see fieldHint render around line ~575) but do NOT block onboarding.
    // Tradies in the bush often skip ABN at signup and add it later in settings.
    let cleanedAbn: string | null = null;
    if (businessData.abn) {
      const abnResult = validateABN(businessData.abn);
      cleanedAbn = abnResult.valid ? businessData.abn : null;
    }

    setIsLoading(true);
    try {
      const settingsPayload = {
        teamSize: businessData.teamSize || 'solo',
        businessName: businessData.businessName,
        tradeType: businessData.tradeType,
        abn: cleanedAbn,
        phone: businessData.phone || null,
        gstEnabled: businessData.gstEnabled,
        defaultHourlyRate: Number(businessData.defaultHourlyRate) || 120,
        calloutFee: Number(businessData.calloutFee) || 90,
      };

      const existingSettings = useAuthStore.getState().businessSettings;
      if (existingSettings?.id) {
        await api.patch('/api/business-settings', settingsPayload);
      } else {
        await api.post('/api/business-settings', settingsPayload);
      }
      await fetchBusinessSettings();
      // ABN is optional. If entered but invalid (or skipped entirely) we just
      // save without it and move on — no popup. Inline field hint already
      // shows a soft warning while typing.
      return true;
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save settings');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const markOnboardingComplete = async (seedSample: boolean): Promise<{ seedFailed: boolean; completeFailed: boolean }> => {
    const userId = useAuthStore.getState().user?.id;
    let seedFailed = false;
    let completeFailed = false;

    if (seedSample) {
      try {
        const seedRes = await api.post('/api/onboarding/seed-demo-data', {});
        if (seedRes?.error) {
          seedFailed = true;
          if (__DEV__) console.log('Demo data seeding failed:', seedRes.error);
        } else {
          setDemoDataSeeded(true);
        }
      } catch (error) {
        seedFailed = true;
        if (__DEV__) console.log('Demo data seeding failed:', error);
      }
    }

    try {
      const completeRes = await api.post('/api/onboarding/complete', {});
      if (completeRes?.error) {
        completeFailed = true;
        console.error('Failed to mark onboarding complete:', completeRes.error);
      } else {
        await fetchBusinessSettings();
      }
    } catch (error) {
      completeFailed = true;
      console.error('Failed to mark onboarding complete:', error);
    }

    // Persist the outcome so the dashboard can show a non-blocking, retryable
    // banner if the background setup failed (the magic screen already advanced
    // the owner into the app without waiting on these calls).
    if (seedFailed || completeFailed) {
      await markOnboardingSetupFailed(userId, { seedFailed, completeFailed });
    } else {
      await clearOnboardingSetupFailure(userId);
    }
    return { seedFailed, completeFailed };
  };

  // Marks onboarding complete for joiners (workers/subcontractors). This runs
  // inline (unlike the owner magic path), but the call previously swallowed all
  // errors with .catch(() => {}). We now record a failure so the dashboard
  // banner can offer a non-blocking retry after the joiner lands in the app.
  const completeOnboardingTracked = async () => {
    const userId = useAuthStore.getState().user?.id;
    let completeFailed = false;
    try {
      const res = await api.post('/api/onboarding/complete', {});
      if (res?.error) completeFailed = true;
    } catch {
      completeFailed = true;
    }
    if (completeFailed) {
      await markOnboardingSetupFailed(userId, { seedFailed: false, completeFailed: true });
    } else {
      await clearOnboardingSetupFailure(userId);
    }
    // Re-resolve the authoritative role now that the join/redeem has committed.
    // fetchBusinessSettings does NOT refresh roleInfo, so without this a freshly
    // joined subcontractor/worker lands on the dashboard with the stale owner
    // default role and sees the Owner dashboard until a manual reload.
    try {
      await useAuthStore.getState().fetchRoleInfo();
    } catch {}
  };

  const handleOwnerComplete = async () => {
    const saved = await handleSaveBusinessSettings();
    if (!saved) return;
    clearOnboardingDraft();
    // Suppress the global onboarding guard (app/_layout.tsx) so the magic
    // screen + tour can play their full timed sequence even though completion
    // flips `onboardingCompleted` true a few seconds in. The flag is cleared
    // automatically once the user leaves the onboarding stack for the app.
    useAuthStore.getState().setOnboardingFinishing(true);
    // Fire-and-forget: seeding + completion run in the background while the
    // magic screen plays its timed animation. We do NOT await here — the
    // screen advances on its own timer regardless of network speed. Sample data
    // is only seeded if the owner left the toggle on.
    markOnboardingComplete(loadSampleData);
    setShowMagic(true);
  };

  // "Bring my existing business across" from the final owner step: save the
  // business settings, mark onboarding complete (awaited — we're leaving the
  // onboarding stack, so the guard needs onboardingCompleted=true before we
  // land in /more), then open the native migration screen.
  const handleBringBusinessAcross = async () => {
    const saved = await handleSaveBusinessSettings();
    if (!saved) return;
    clearOnboardingDraft();
    setIsLoading(true);
    try {
      useAuthStore.getState().setOnboardingFinishing(true);
      const { completeFailed } = await markOnboardingComplete(loadSampleData);
      if (completeFailed) {
        // Completion didn't commit server-side (offline / server error). If we
        // redirected anyway, the owner would land in /more with
        // onboardingCompleted=false and bounce between the onboarding guard
        // and the migration screen. Stay in the wizard with a clear error so
        // they can retry.
        useAuthStore.getState().setOnboardingFinishing(false);
        Alert.alert(
          "Couldn't finish setup",
          'We saved your business details, but could not complete setup. Check your connection and tap "Bring it across" again.'
        );
        return;
      }
      router.replace('/more/bring-your-business?from=onboarding');
    } finally {
      setIsLoading(false);
    }
  };

  const proceedToNotifications = () => {
    router.replace('/(onboarding)/notifications-permission');
  };

  const handleMagicDone = async () => {
    const tourSeen = await hasCompletedOnboarding();
    if (!tourSeen) {
      setShowMagic(false);
      setShowTour(true);
    } else {
      proceedToNotifications();
    }
  };

  const handleWorkerRedeem = async () => {
    if (!inviteValidation?.valid) {
      Alert.alert('Invalid Code', 'Please enter a valid invite code');
      return;
    }

    if (!workerName.trim()) {
      Alert.alert('Missing Info', 'Please enter your name');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post('/api/team/invite-code/redeem', {
        code: inviteCode,
        phone: workerPhone || undefined,
      });

      if (response.error) {
        const errorMsg = typeof response.error === 'string' ? response.error : '';
        if (errorMsg.toLowerCase().includes('already a member')) {
          await completeOnboardingTracked();
          await fetchBusinessSettings();
          setWorkerStep('complete');
          return;
        }
        Alert.alert('Error', errorMsg || 'Failed to join team');
        return;
      }

      if (workerName.trim() || workerLastName.trim()) {
        await api.patch('/api/profile/me', {
          firstName: workerName.trim(),
          lastName: workerLastName.trim(),
        });
      }

      await completeOnboardingTracked();
      await fetchBusinessSettings();
      
      setWorkerStep('complete');
    } catch (error: any) {
      const errorMsg = error?.message || error?.error || '';
      if (typeof errorMsg === 'string' && errorMsg.toLowerCase().includes('already a member')) {
        await completeOnboardingTracked();
        await fetchBusinessSettings();
        setWorkerStep('complete');
        return;
      }
      Alert.alert('Error', errorMsg || 'Failed to join team');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubDetailsNext = async () => {
    if (!subName.trim()) {
      Alert.alert('Missing Info', 'Please enter your name');
      return;
    }

    setIsLoading(true);
    try {
      await api.patch('/api/profile/me', {
        firstName: subName.trim(),
        lastName: subLastName.trim(),
      });

      const existingSettings = useAuthStore.getState().businessSettings;
      // Subcontractors don't have a "business" — they work under other
      // businesses. Leave businessName empty so the subcontractor dashboard
      // shows its proper empty state instead of a fake "X's Services".
      const settingsPayload = {
        businessName: existingSettings?.businessName || '',
        tradeType: subTradeType || 'other',
        phone: subPhone || null,
        abn: subAbn || null,
        teamSize: 'solo',
        // Tag the account as subcontractor so /api/team/my-role labels it
        // correctly. The next step (subConnect) now REQUIRES redeeming an invite
        // into a paid Team/Business — there is no standalone finish — so this is
        // just the label; the redeemed team membership overrides it.
        accountType: 'subcontractor',
      };

      if (existingSettings?.id) {
        await api.patch('/api/business-settings', settingsPayload);
      } else {
        await api.post('/api/business-settings', settingsPayload);
      }
      await fetchBusinessSettings();
      setSubStep('subConnect');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubConnect = async () => {
    // Subcontractor accounts only exist by joining a business that invited them.
    // A valid invite code is mandatory — there is no standalone "skip" path.
    // The redeem itself enforces that the business is on a paid Team/Business
    // plan with an available seat (team_plan_required / seat-limit errors).
    if (!subInviteValidation?.valid) {
      Alert.alert(
        'Invite code required',
        'Subcontractors can only join through a business that invites them. Enter a valid invite code from a business on a Team or Business plan to continue.',
      );
      return;
    }
    setIsLoading(true);
    try {
      const response = await api.post('/api/team/invite-code/redeem', {
        code: subInviteCode,
        phone: subPhone || undefined,
      });

      if (response.error) {
        Alert.alert('Error', response.error);
        return;
      }
      setSubStep('privacy');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to connect');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubPrivacyAcknowledge = async () => {
    try {
      await completeOnboardingTracked();
      await fetchBusinessSettings();
      setSubStep('complete');
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  };

  const handleComplete = () => {
    proceedToNotifications();
  };

  const handleSkipOnboarding = async () => {
    const ok = await confirm({ title: 'Skip setup?', message: "You can finish your business profile any time from Settings. We'll keep a quick reminder on your dashboard.", confirmText: 'Skip for now', cancelText: 'Cancel', destructive: true });
    if (ok) {
      setIsLoading(true);
      try {
        const res = await api.post('/api/onboarding/complete', {});
        if (res.error) {
          Alert.alert("Couldn't skip setup", res.error || 'Please check your connection and try again.');
          return;
        }
        try { await fetchBusinessSettings(); } catch {}
        const bs = useAuthStore.getState().businessSettings;
        if (!bs?.onboardingCompleted) {
          Alert.alert("Couldn't skip setup", 'We saved your progress but could not confirm with the server. Please try again.');
          return;
        }
        router.replace('/(tabs)');
      } catch (e: any) {
        Alert.alert("Couldn't skip setup", e?.message || 'Please check your connection and try again.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const canSkipCurrentStep = () => {
    // Only owners can skip, and only on the genuinely-optional steps (trade +
    // team size). The role choice, required owner details, and the
    // worker/subcontractor "join" steps must be completed — otherwise the user
    // lands in a broken half-set-up account that the server then blocks with
    // "complete your business setup".
    return selectedRole === 'owner' && (ownerStep === 'trade' || ownerStep === 'teamSize');
  };

  const getCurrentStep = () => {
    if (!selectedRole) return 'role';
    if (selectedRole === 'owner') return ownerStep;
    if (selectedRole === 'worker') return workerStep;
    return subStep;
  };

  const getStepCount = () => {
    if (!selectedRole) return { current: 1, total: 1 };
    if (selectedRole === 'owner') {
      const steps: OwnerStep[] = ['role', 'business', 'trade', 'teamSize', 'complete'];
      return { current: steps.indexOf(ownerStep) + 1, total: steps.length };
    }
    if (selectedRole === 'worker') {
      const steps: WorkerStep[] = ['role', 'inviteCode', 'workerDetails', 'complete'];
      return { current: steps.indexOf(workerStep) + 1, total: steps.length };
    }
    const steps: SubcontractorStep[] = ['role', 'subDetails', 'subConnect', 'privacy', 'complete'];
    return { current: steps.indexOf(subStep) + 1, total: steps.length };
  };

  const firstName = user?.firstName || '';

  const renderRoleSelection = () => (
    <ScrollView style={styles.stepContainer} contentContainerStyle={styles.centeredContent} showsVerticalScrollIndicator={false}>
      <View style={styles.welcomeHeader}>
        <Text style={styles.welcomeGreeting}>
          {firstName ? `Hey ${firstName}` : 'Welcome'}
        </Text>
        <Text style={styles.welcomeTitle}>How will you use JobRunner?</Text>
      </View>

      <View style={styles.roleCardsWrap}>
        <TouchableOpacity
          style={styles.roleCard}
          onPress={() => { setSelectedRole('owner'); setOwnerStep('business'); }}
          activeOpacity={0.7}
          testID="role-owner"
        >
          <View style={styles.roleCardInner}>
            <View style={[styles.roleIconCircle, { backgroundColor: colors.primary + '14' }]}>
              <Ionicons name="briefcase" size={22} color={colors.primary} />
            </View>
            <View style={styles.roleTextWrap}>
              <Text style={styles.roleTitle}>I run a business</Text>
              <Text style={styles.roleDesc}>Set up your business and start managing jobs</Text>
            </View>
          </View>
          <View style={styles.roleArrow}>
            <Ionicons name="arrow-forward" size={16} color={colors.mutedForeground} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.roleCard}
          onPress={() => { setSelectedRole('worker'); setWorkerStep('inviteCode'); }}
          activeOpacity={0.7}
          testID="role-worker"
        >
          <View style={styles.roleCardInner}>
            <View style={[styles.roleIconCircle, { backgroundColor: colors.warning + '14' }]}>
              <Ionicons name="people" size={22} color={colors.warning} />
            </View>
            <View style={styles.roleTextWrap}>
              <Text style={styles.roleTitle}>I was invited to a team</Text>
              <Text style={styles.roleDesc}>Join your employer's business with an invite code</Text>
            </View>
          </View>
          <View style={styles.roleArrow}>
            <Ionicons name="arrow-forward" size={16} color={colors.mutedForeground} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.roleCard}
          onPress={() => { setSelectedRole('subcontractor'); setSubStep('subDetails'); }}
          activeOpacity={0.7}
          testID="role-subcontractor"
        >
          <View style={styles.roleCardInner}>
            <View style={[styles.roleIconCircle, { backgroundColor: colors.success + '14' }]}>
              <Ionicons name="construct" size={22} color={colors.success} />
            </View>
            <View style={styles.roleTextWrap}>
              <Text style={styles.roleTitle}>I'm a subcontractor</Text>
              <Text style={styles.roleDesc}>Work for multiple businesses independently</Text>
            </View>
          </View>
          <View style={styles.roleArrow}>
            <Ionicons name="arrow-forward" size={16} color={colors.mutedForeground} />
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderOwnerBusiness = () => (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView style={styles.stepContainer} contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>Tell us about your business</Text>
        <Text style={styles.stepSubtitle}>Used on your quotes and invoices.</Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Business name</Text>
        <TextInput
          style={styles.fieldInput}
          placeholder="e.g. Smith Electrical"
          placeholderTextColor={colors.mutedForeground + '80'}
          value={businessData.businessName}
          onChangeText={(text) => setBusinessData(prev => ({ ...prev, businessName: text }))}
          testID="input-business-name"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Your name</Text>
        <TextInput
          style={styles.fieldInput}
          placeholder="e.g. John Smith"
          placeholderTextColor={colors.mutedForeground + '80'}
          value={businessData.ownerName}
          onChangeText={(text) => setBusinessData(prev => ({ ...prev, ownerName: text }))}
          testID="input-owner-name"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Phone <Text style={styles.fieldOptional}>optional</Text></Text>
        <TextInput
          style={styles.fieldInput}
          placeholder="0412 345 678"
          placeholderTextColor={colors.mutedForeground + '80'}
          value={businessData.phone}
          onChangeText={(text) => setBusinessData(prev => ({ ...prev, phone: text }))}
          keyboardType="phone-pad"
          testID="input-phone"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>ABN <Text style={styles.fieldOptional}>optional</Text></Text>
        <TextInput
          style={[styles.fieldInput, businessData.abn && !validateABN(businessData.abn).valid ? { borderColor: colors.destructive } : null]}
          placeholder="12 345 678 901"
          placeholderTextColor={colors.mutedForeground + '80'}
          value={formatABN(businessData.abn)}
          onChangeText={(text) => {
            const digits = text.replace(/\s/g, '').replace(/[^0-9]/g, '').slice(0, 11);
            setBusinessData(prev => ({ ...prev, abn: digits }));
          }}
          keyboardType="number-pad"
          maxLength={14}
          testID="input-abn"
        />
        {businessData.abn.length > 0 && !validateABN(businessData.abn).valid && (
          <Text style={styles.fieldError}>
            {validateABN(businessData.abn).error}
          </Text>
        )}
      </View>

      <View style={styles.ctaWrap}>
        <TouchableOpacity style={styles.ctaButton} onPress={() => {
          if (!businessData.businessName.trim()) {
            Alert.alert('Required', 'Please enter your business name');
            return;
          }
          setOwnerStep('trade');
        }} activeOpacity={0.8}>
          <Text style={styles.ctaText}>Continue</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.primaryForeground} />
        </TouchableOpacity>

        <TouchableOpacity
          style={{ marginTop: spacing.lg, alignItems: 'center', paddingVertical: spacing.sm }}
          onPress={() => { setSelectedRole(null); setOwnerStep('role'); }}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: typography.button.fontSize, color: colors.mutedForeground }}>
            Joining a crew? <Text style={{ color: colors.primary, fontWeight: fontWeights.semibold }}>Use invite code</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderOwnerTrade = () => (
    <ScrollView style={styles.stepContainer} contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>What's your trade?</Text>
        <Text style={styles.stepSubtitle}>We'll use this to set up your templates and demo data.</Text>
      </View>

      <View style={styles.selectionList}>
        {tradeTypes.map((trade) => {
          const selected = businessData.tradeType === trade.value;
          return (
            <TouchableOpacity
              key={trade.value}
              style={[styles.selectionCard, selected && styles.selectionCardSelected]}
              onPress={() => setBusinessData(prev => ({ ...prev, tradeType: trade.value }))}
              activeOpacity={0.7}
              testID={`option-trade-${trade.value}`}
            >
              <View style={[styles.selectionIconWrap, { backgroundColor: selected ? colors.primary + '14' : colors.muted }]}>
                <Ionicons name={trade.icon} size={20} color={selected ? colors.primary : colors.mutedForeground} />
              </View>
              <Text style={[styles.selectionLabel, selected && { color: colors.primary, fontWeight: fontWeights.semibold }]}>
                {trade.label}
              </Text>
              {selected && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.ctaWrap}>
        <TouchableOpacity style={styles.ctaButton} onPress={() => {
          if (!businessData.tradeType) {
            Alert.alert('Required', 'Please select your trade type');
            return;
          }
          setOwnerStep('teamSize');
        }} activeOpacity={0.8}>
          <Text style={styles.ctaText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderOwnerTeamSize = () => (
    <ScrollView style={styles.stepContainer} contentContainerStyle={styles.centeredContent} showsVerticalScrollIndicator={false}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>How big is your team?</Text>
        <Text style={styles.stepSubtitle}>Helps us tailor the features you'll use most.</Text>
      </View>

      <View style={styles.selectionList}>
        {teamSizes.map((size) => {
          const selected = businessData.teamSize === size.value;
          return (
            <TouchableOpacity
              key={size.value}
              style={[styles.selectionCard, selected && styles.selectionCardSelected]}
              onPress={() => setBusinessData(prev => ({ ...prev, teamSize: size.value }))}
              activeOpacity={0.7}
              testID={`option-team-${size.value}`}
            >
              <View style={[styles.selectionIconWrap, { backgroundColor: selected ? colors.primary + '14' : colors.muted }]}>
                <Ionicons name={size.icon} size={20} color={selected ? colors.primary : colors.mutedForeground} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.selectionLabel, selected && { color: colors.primary, fontWeight: fontWeights.semibold }]}>
                  {size.label}
                </Text>
                <Text style={styles.selectionDesc}>{size.description}</Text>
              </View>
              {selected && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.sampleToggleRow}>
        <View style={styles.sampleToggleText}>
          <Text style={styles.sampleToggleTitle}>Load sample data</Text>
          <Text style={styles.sampleToggleDesc}>Adds example clients, jobs and quotes so you can explore. Turn off to start empty. You can remove it anytime from your dashboard.</Text>
        </View>
        <Switch
          value={loadSampleData}
          onValueChange={setLoadSampleData}
          trackColor={{ false: colors.cardBorder, true: colors.primary }}
          thumbColor={colors.background}
          ios_backgroundColor={colors.cardBorder}
          testID="switch-load-sample-data"
        />
      </View>

      <View style={styles.ctaWrap}>
        <TouchableOpacity style={[styles.ctaButton, isLoading && { opacity: 0.5 }]} onPress={() => {
          if (!businessData.teamSize) {
            Alert.alert('Required', 'Please select your team size');
            return;
          }
          handleOwnerComplete();
        }} disabled={isLoading} activeOpacity={0.8}>
          {isLoading ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <>
              <Text style={styles.ctaText}>Get Started</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.primaryForeground} />
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bringBusinessLink}
          onPress={() => {
            if (!businessData.teamSize) {
              Alert.alert('Required', 'Please select your team size');
              return;
            }
            handleBringBusinessAcross();
          }}
          disabled={isLoading}
          activeOpacity={0.7}
          testID="button-bring-business"
        >
          <Ionicons name="briefcase-outline" size={16} color={colors.primary} />
          <Text style={styles.bringBusinessLinkText}>Already running a business? Bring it across</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );


  const renderWorkerInviteCode = () => (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView style={styles.stepContainer} contentContainerStyle={styles.centeredContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>Enter your invite code</Text>
        <Text style={styles.stepSubtitle}>Your employer will have given you a 6-character code</Text>
      </View>

      <View style={styles.codeInputWrap}>
        <TextInput
          style={styles.codeInput}
          placeholder="e.g. A8B49S"
          placeholderTextColor={colors.mutedForeground + '60'}
          value={inviteCode}
          onChangeText={(text) => handleInviteCodeChange(text)}
          autoCapitalize="characters"
          maxLength={6}
          testID="input-invite-code"
        />
        {isValidatingCode && (
          <ActivityIndicator style={styles.codeSpinner} color={colors.primary} />
        )}
      </View>

      {inviteValidation?.valid && (
        <View style={styles.validationBox}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={[styles.validationText, { color: colors.success }]}>
            Joining <Text style={{ fontWeight: fontWeights.bold }}>{inviteValidation.businessName}</Text> as <Text style={{ fontWeight: fontWeights.bold, textTransform: 'capitalize' }}>{inviteValidation.roleType}</Text>
          </Text>
        </View>
      )}

      {inviteValidation && !inviteValidation.valid && (
        <View style={[styles.validationBox, { backgroundColor: colors.destructive + '0C' }]}>
          <Ionicons name="alert-circle" size={20} color={colors.destructive} />
          <Text style={[styles.validationText, { color: colors.destructive }]}>{inviteValidation.error}</Text>
        </View>
      )}

      <View style={styles.ctaWrap}>
        <TouchableOpacity
          style={[styles.ctaButton, (!inviteValidation?.valid) && { opacity: 0.4 }]}
          onPress={() => setWorkerStep('workerDetails')}
          disabled={!inviteValidation?.valid}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaText}>Continue</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderWorkerDetails = () => (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView style={styles.stepContainer} contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>A bit about you</Text>
        <Text style={styles.stepSubtitle}>So your team knows who you are</Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>First name</Text>
        <TextInput
          style={styles.fieldInput}
          placeholder="John"
          placeholderTextColor={colors.mutedForeground + '80'}
          value={workerName}
          onChangeText={setWorkerName}
          autoCapitalize="words"
          testID="input-worker-first-name"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Last name</Text>
        <TextInput
          style={styles.fieldInput}
          placeholder="Smith"
          placeholderTextColor={colors.mutedForeground + '80'}
          value={workerLastName}
          onChangeText={setWorkerLastName}
          autoCapitalize="words"
          testID="input-worker-last-name"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Phone <Text style={styles.fieldOptional}>optional</Text></Text>
        <TextInput
          style={styles.fieldInput}
          placeholder="0412 345 678"
          placeholderTextColor={colors.mutedForeground + '80'}
          value={workerPhone}
          onChangeText={setWorkerPhone}
          keyboardType="phone-pad"
          testID="input-worker-phone"
        />
      </View>

      <View style={styles.ctaWrap}>
        <TouchableOpacity
          style={[styles.ctaButton, isLoading && { opacity: 0.5 }]}
          onPress={handleWorkerRedeem}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <>
              <Text style={styles.ctaText}>Join Team</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.primaryForeground} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderSubDetails = () => (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView style={styles.stepContainer} contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>Your details</Text>
        <Text style={styles.stepSubtitle}>Tell us a bit about yourself</Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>First name</Text>
        <TextInput
          style={styles.fieldInput}
          placeholder="John"
          placeholderTextColor={colors.mutedForeground + '80'}
          value={subName}
          onChangeText={setSubName}
          autoCapitalize="words"
          testID="input-sub-first-name"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Last name</Text>
        <TextInput
          style={styles.fieldInput}
          placeholder="Smith"
          placeholderTextColor={colors.mutedForeground + '80'}
          value={subLastName}
          onChangeText={setSubLastName}
          autoCapitalize="words"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Phone <Text style={styles.fieldOptional}>optional</Text></Text>
        <TextInput
          style={styles.fieldInput}
          placeholder="0412 345 678"
          placeholderTextColor={colors.mutedForeground + '80'}
          value={subPhone}
          onChangeText={setSubPhone}
          keyboardType="phone-pad"
        />
      </View>

      <Text style={styles.sectionHeading}>Trade</Text>
      <View style={styles.selectionList}>
        {tradeTypes.map((trade) => {
          const selected = subTradeType === trade.value;
          return (
            <TouchableOpacity
              key={trade.value}
              style={[styles.selectionCard, selected && styles.selectionCardSelected]}
              onPress={() => setSubTradeType(trade.value)}
              activeOpacity={0.7}
            >
              <View style={[styles.selectionIconWrap, { backgroundColor: selected ? colors.primary + '14' : colors.muted }]}>
                <Ionicons name={trade.icon} size={20} color={selected ? colors.primary : colors.mutedForeground} />
              </View>
              <Text style={[styles.selectionLabel, selected && { color: colors.primary, fontWeight: fontWeights.semibold }]}>
                {trade.label}
              </Text>
              {selected && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>ABN <Text style={styles.fieldOptional}>optional</Text></Text>
        <TextInput
          style={styles.fieldInput}
          placeholder="12 345 678 901"
          placeholderTextColor={colors.mutedForeground + '80'}
          value={formatABN(subAbn)}
          onChangeText={(text) => {
            const digits = text.replace(/\s/g, '').replace(/[^0-9]/g, '').slice(0, 11);
            setSubAbn(digits);
          }}
          keyboardType="number-pad"
          maxLength={14}
        />
      </View>

      <View style={styles.ctaWrap}>
        <TouchableOpacity
          style={[styles.ctaButton, isLoading && { opacity: 0.5 }]}
          onPress={handleSubDetailsNext}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? <ActivityIndicator color={colors.primaryForeground} /> : (
            <>
              <Text style={styles.ctaText}>Continue</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.primaryForeground} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderSubConnect = () => (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView style={styles.stepContainer} contentContainerStyle={styles.centeredContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>Connect to a business</Text>
        <Text style={styles.stepSubtitle}>Subcontractors join through a business that invites them. Enter your invite code to continue.</Text>
      </View>

      <View style={styles.codeInputWrap}>
        <TextInput
          style={styles.codeInput}
          placeholder="e.g. A8B49S"
          placeholderTextColor={colors.mutedForeground + '60'}
          value={subInviteCode}
          onChangeText={(text) => handleInviteCodeChange(text, true)}
          autoCapitalize="characters"
          maxLength={6}
          testID="input-sub-invite-code"
        />
        {isValidatingSubCode && (
          <ActivityIndicator style={styles.codeSpinner} color={colors.primary} />
        )}
      </View>

      {subInviteValidation?.valid && (
        <View style={styles.validationBox}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={[styles.validationText, { color: colors.success }]}>
            Connecting to <Text style={{ fontWeight: fontWeights.bold }}>{subInviteValidation.businessName}</Text>
          </Text>
        </View>
      )}

      {subInviteValidation && !subInviteValidation.valid && (
        <View style={[styles.validationBox, { backgroundColor: colors.destructive + '0C' }]}>
          <Ionicons name="alert-circle" size={20} color={colors.destructive} />
          <Text style={[styles.validationText, { color: colors.destructive }]}>{subInviteValidation.error}</Text>
        </View>
      )}

      <View style={styles.ctaWrap}>
        <TouchableOpacity
          style={[styles.ctaButton, (isLoading || !subInviteValidation?.valid) && { opacity: 0.5 }]}
          onPress={() => handleSubConnect()}
          disabled={isLoading || !subInviteValidation?.valid}
          activeOpacity={0.8}
        >
          {isLoading ? <ActivityIndicator color={colors.primaryForeground} /> : (
            <>
              <Text style={styles.ctaText}>Connect & Continue</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.primaryForeground} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderSubPrivacy = () => (
    <ScrollView style={styles.stepContainer} contentContainerStyle={styles.centeredContent} showsVerticalScrollIndicator={false}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>Your privacy matters</Text>
        <Text style={styles.stepSubtitle}>How location sharing works as a subcontractor</Text>
      </View>

      <View style={styles.privacyList}>
        <View style={styles.privacyRow}>
          <View style={[styles.privacyDot, { backgroundColor: colors.success + '18' }]}>
            <Ionicons name="location" size={18} color={colors.success} />
          </View>
          <View style={styles.privacyTextWrap}>
            <Text style={styles.privacyTitle}>Active jobs only</Text>
            <Text style={styles.privacyDesc}>Your location is only shared when you're actively working on a job.</Text>
          </View>
        </View>

        <View style={styles.privacyRow}>
          <View style={[styles.privacyDot, { backgroundColor: colors.primary + '18' }]}>
            <Ionicons name="stop-circle" size={18} color={colors.primary} />
          </View>
          <View style={styles.privacyTextWrap}>
            <Text style={styles.privacyTitle}>Auto-stops</Text>
            <Text style={styles.privacyDesc}>The moment you complete a job, tracking stops. No exceptions.</Text>
          </View>
        </View>

        <View style={styles.privacyRow}>
          <View style={[styles.privacyDot, { backgroundColor: '#8b5cf6' + '18' }]}>
            <Ionicons name="eye-off" size={18} color="#8b5cf6" />
          </View>
          <View style={styles.privacyTextWrap}>
            <Text style={styles.privacyTitle}>Private between jobs</Text>
            <Text style={styles.privacyDesc}>Businesses cannot see your location between jobs. Your personal time stays private.</Text>
          </View>
        </View>
      </View>

      <View style={styles.ctaWrap}>
        <TouchableOpacity style={styles.ctaButton} onPress={handleSubPrivacyAcknowledge} activeOpacity={0.8}>
          <Text style={styles.ctaText}>I Understand</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderComplete = () => {
    const isWorkerPath = selectedRole === 'worker';
    const isSubPath = selectedRole === 'subcontractor';

    return (
      <View style={[styles.stepContainer, styles.doneContainer, { paddingBottom: spacing['2xl'] + setupInsets.bottom }]}>
        <View style={styles.doneContent}>
          <View style={styles.doneBadge}>
            <Ionicons name="checkmark" size={44} color={colors.primaryForeground} />
          </View>
          
          <Text style={styles.doneTitle}>
            {isWorkerPath ? 'Welcome to the team' : "You're all set."}
          </Text>
          <Text style={styles.doneSubtitle}>
            {isWorkerPath 
              ? `You've joined ${inviteValidation?.businessName || 'the team'}. Your assigned jobs will appear on your dashboard.`
              : isSubPath
                ? subInviteValidation?.valid 
                  ? `Connected to ${subInviteValidation.businessName}. Jobs will appear when assigned.`
                  : 'Your account is ready. When a business assigns you jobs, they\'ll appear here.'
                : demoDataSeeded 
                  ? "We've loaded sample data so you can explore everything right away."
                  : "Your business is set up and ready to go."
            }
          </Text>

          {!isWorkerPath && !isSubPath && (
            <View style={styles.doneChecks}>
              <View style={styles.doneCheckRow}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={styles.doneCheckText}>Business details saved</Text>
              </View>
              {demoDataSeeded && (
                <View style={styles.doneCheckRow}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                  <Text style={styles.doneCheckText}>Sample data loaded</Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.doneButtonWrap}>
          <TouchableOpacity style={styles.ctaButton} onPress={handleComplete} activeOpacity={0.8}>
            <Text style={styles.ctaText}>
              {isWorkerPath ? 'View My Jobs' : isSubPath ? 'Get Started' : 'Start Using JobRunner'}
            </Text>
            <Ionicons name="arrow-forward" size={18} color={colors.primaryForeground} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const currentStep = getCurrentStep();
  const { current, total } = getStepCount();

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: total > 0 ? current / total : 0,
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [current, total]);

  if (showMagic) {
    return (
      <OnboardingMagicScreen
        firstName={user?.firstName}
        businessName={businessData.businessName}
        onDone={handleMagicDone}
      />
    );
  }

  if (showTour) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <OnboardingTour onComplete={proceedToNotifications} />
      </View>
    );
  }

  if (isCheckingSettings) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingLabel, { color: colors.mutedForeground }]}>Setting up...</Text>
      </View>
    );
  }

  const canGoBack = () => {
    if (currentStep === 'role') return false;
    if (currentStep === 'complete') return false;
    return true;
  };

  const handleBack = () => {
    if (selectedRole === 'owner') {
      const steps: OwnerStep[] = ['role', 'business', 'trade', 'teamSize'];
      const idx = steps.indexOf(ownerStep);
      if (idx === 1) { setSelectedRole(null); setOwnerStep('role'); }
      else if (idx > 1) setOwnerStep(steps[idx - 1]);
    } else if (selectedRole === 'worker') {
      const steps: WorkerStep[] = ['role', 'inviteCode', 'workerDetails'];
      const idx = steps.indexOf(workerStep);
      if (idx === 1) { setSelectedRole(null); setWorkerStep('role'); }
      else if (idx > 1) setWorkerStep(steps[idx - 1]);
    } else if (selectedRole === 'subcontractor') {
      const steps: SubcontractorStep[] = ['role', 'subDetails', 'subConnect', 'privacy'];
      const idx = steps.indexOf(subStep);
      if (idx === 1) { setSelectedRole(null); setSubStep('role'); }
      else if (idx > 1) setSubStep(steps[idx - 1]);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'right', 'bottom', 'left']}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {currentStep !== 'complete' && (
          <View>
            <View style={styles.topBar}>
              {canGoBack() ? (
                <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Ionicons name="chevron-back" size={22} color={colors.foreground} />
                </TouchableOpacity>
              ) : (
                <View style={{ width: 40 }} />
              )}

              {canSkipCurrentStep() ? (
                <TouchableOpacity
                  onPress={handleSkipOnboarding}
                  disabled={isLoading}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  testID="button-skip-onboarding"
                  style={styles.skipChip}
                  activeOpacity={0.7}
                >
                  <Text style={styles.skipChipText}>Skip</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ width: 40 }} />
              )}
            </View>

            {total > 1 && (
              <View style={styles.progressTrack}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
            )}
          </View>
        )}

        <View style={styles.contentArea}>
          {currentStep === 'role' && renderRoleSelection()}
          {selectedRole === 'owner' && ownerStep === 'business' && renderOwnerBusiness()}
          {selectedRole === 'owner' && ownerStep === 'trade' && renderOwnerTrade()}
          {selectedRole === 'owner' && ownerStep === 'teamSize' && renderOwnerTeamSize()}
          {selectedRole === 'worker' && workerStep === 'inviteCode' && renderWorkerInviteCode()}
          {selectedRole === 'worker' && workerStep === 'workerDetails' && renderWorkerDetails()}
          {selectedRole === 'subcontractor' && subStep === 'subDetails' && renderSubDetails()}
          {selectedRole === 'subcontractor' && subStep === 'subConnect' && renderSubConnect()}
          {selectedRole === 'subcontractor' && subStep === 'privacy' && renderSubPrivacy()}
          {currentStep === 'complete' && renderComplete()}
        </View>

      </Animated.View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.primary,
  },

  contentArea: {
    flex: 1,
  },

  stepContainer: {
    flex: 1,
  },
  stepContent: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: spacing['4xl'],
  },
  centeredContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: spacing['4xl'],
  },

  welcomeHeader: {
    marginBottom: 28,
  },
  welcomeGreeting: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
    marginBottom: 6,
  },
  welcomeTitle: {
    fontSize: 30,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
    lineHeight: 36,
    letterSpacing: -0.7,
  },

  roleCardsWrap: {
    gap: spacing.md,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  roleCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 14,
  },
  roleIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleTextWrap: {
    flex: 1,
  },
  roleTitle: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    marginBottom: 3,
    letterSpacing: -0.2,
  },
  roleDesc: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    lineHeight: 18,
  },
  roleArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },

  stepHeader: {
    marginBottom: spacing['2xl'],
  },
  stepTitle: {
    fontSize: 30,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
    lineHeight: 36,
    letterSpacing: -0.7,
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    lineHeight: 20,
  },

  fieldGroup: {
    marginBottom: spacing.xl,
  },
  fieldLabel: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  fieldOptional: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.regular,
    color: colors.mutedForeground,
  },
  fieldInput: {
    height: 48,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    color: colors.foreground,
    fontSize: typography.subtitle.fontSize,
    letterSpacing: 0,
  },
  fieldError: {
    color: colors.destructive,
    fontSize: typography.captionSmall.fontSize,
    marginTop: 6,
  },

  sectionHeading: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },

  selectionList: {
    gap: 10,
    marginBottom: spacing['2xl'],
  },
  selectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: 18,
    paddingHorizontal: 16,
    gap: 14,
  },
  selectionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '08',
  },
  selectionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
  },
  selectionDesc: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },

  sampleToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    marginBottom: spacing.lg,
  },
  sampleToggleText: {
    flex: 1,
    gap: spacing.xs,
  },
  sampleToggleTitle: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    letterSpacing: -0.2,
  },
  sampleToggleDesc: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
    lineHeight: 17,
  },
  ctaWrap: {
    marginTop: spacing.sm,
  },
  ctaButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing['2xl'],
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  ctaText: {
    color: colors.primaryForeground,
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.semibold,
  },
  bringBusinessLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 14,
    marginTop: spacing.sm,
  },
  bringBusinessLinkText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: fontWeights.semibold,
  },

  skipTopText: {
    fontSize: typography.button.fontSize,
    color: colors.mutedForeground,
    fontWeight: fontWeights.medium,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  skipChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.primary + '15',
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  skipChipText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: fontWeights.semibold,
  },

  codeInputWrap: {
    position: 'relative',
    marginBottom: spacing.lg,
  },
  codeInput: {
    height: 60,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    color: colors.foreground,
    fontSize: typography.sizes['3xl'],
    fontWeight: fontWeights.bold,
    letterSpacing: 10,
    textAlign: 'center',
  },
  codeSpinner: {
    position: 'absolute',
    right: 18,
    top: 20,
  },

  validationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '0C',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    gap: 10,
    marginBottom: spacing.lg,
  },
  validationText: {
    flex: 1,
    fontSize: typography.button.fontSize,
    lineHeight: 20,
  },

  privacyList: {
    gap: spacing.xl,
    marginBottom: spacing['3xl'],
  },
  privacyRow: {
    flexDirection: 'row',
    gap: 14,
  },
  privacyDot: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xxs,
  },
  privacyTextWrap: {
    flex: 1,
  },
  privacyTitle: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  privacyDesc: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    lineHeight: 19,
  },

  doneContainer: {
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingBottom: spacing['2xl'],
    paddingTop: 48,
  },
  doneContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  doneBadge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  doneTitle: {
    fontSize: 28,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
    textAlign: 'center',
    lineHeight: 34,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  doneSubtitle: {
    fontSize: typography.sizes.md,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    lineHeight: 22,
  },
  doneChecks: {
    marginTop: 28,
    gap: 10,
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  doneCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  doneCheckText: {
    fontSize: typography.button.fontSize,
    color: colors.foreground,
  },
  doneButtonWrap: {
    paddingTop: spacing.lg,
  },

  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
  },
  loadingLabel: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.medium,
  },
});
