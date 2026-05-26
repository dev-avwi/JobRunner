import { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../src/lib/api';
import { useAuthStore } from '../../src/lib/store';
import { validateABN, formatABN } from '../../src/lib/format';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const [hasHydratedDraft, setHasHydratedDraft] = useState(false);

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
            // Brand new owner signup: skip the role chooser and go
            // straight to the business setup step. Worker/sub joiners
            // can switch from the business step via the link there.
            setSelectedRole('owner');
            setOwnerStep('business');
          }
        } else {
          // No settings record yet — fresh email signup.
          setSelectedRole('owner');
          setOwnerStep('business');
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

    if (code.length !== 8) {
      setValidation(null);
      return;
    }

    setValidating(true);
    try {
      const response = await api.get(`/api/team/invite-code/validate/${code.toUpperCase()}`);
      setValidation(response.data as { valid: boolean; businessName?: string; roleType?: string; ownerName?: string; error?: string });
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

  const markOnboardingComplete = async () => {
    try {
      try {
        await api.post('/api/onboarding/seed-demo-data', {});
        setDemoDataSeeded(true);
      } catch (error) {
        if (__DEV__) console.log('Demo data seeding skipped:', error);
      }
      
      await api.post('/api/onboarding/complete', {});
      await fetchBusinessSettings();
    } catch (error) {
      console.error('Failed to mark onboarding complete:', error);
    }
  };

  const handleOwnerComplete = async () => {
    const saved = await handleSaveBusinessSettings();
    if (!saved) return;
    await markOnboardingComplete();
    clearOnboardingDraft();
    setOwnerStep('complete');
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
          await api.post('/api/onboarding/complete', {}).catch(() => {});
          await fetchBusinessSettings();
          setWorkerStep('complete');
          return;
        }
        Alert.alert('Error', errorMsg || 'Failed to join team');
        return;
      }

      if (workerName.trim() || workerLastName.trim()) {
        await api.patch('/api/user/profile', {
          firstName: workerName.trim(),
          lastName: workerLastName.trim(),
        });
      }

      await api.post('/api/onboarding/complete', {}).catch(() => {});
      await fetchBusinessSettings();
      
      setWorkerStep('complete');
    } catch (error: any) {
      const errorMsg = error?.message || error?.error || '';
      if (typeof errorMsg === 'string' && errorMsg.toLowerCase().includes('already a member')) {
        await api.post('/api/onboarding/complete', {}).catch(() => {});
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
      await api.patch('/api/user/profile', {
        firstName: subName.trim(),
        lastName: subLastName.trim(),
        tradeType: subTradeType || undefined,
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

  const handleSubConnect = async (skip: boolean) => {
    if (!skip && subInviteValidation?.valid) {
      setIsLoading(true);
      try {
        const response = await api.post('/api/team/invite-code/redeem', {
          code: subInviteCode,
          phone: subPhone || undefined,
        });

        if (response.error) {
          Alert.alert('Error', response.error);
          setIsLoading(false);
          return;
        }
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Failed to connect');
        setIsLoading(false);
        return;
      } finally {
        setIsLoading(false);
      }
    }
    setSubStep('privacy');
  };

  const handleSubPrivacyAcknowledge = async () => {
    try {
      await api.post('/api/onboarding/complete', {}).catch(() => {});
      await fetchBusinessSettings();
      setSubStep('complete');
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  };

  const handleComplete = () => {
    router.replace('/(tabs)');
  };

  const handleSkipOnboarding = () => {
    Alert.alert(
      'Skip setup?',
      "You can finish your business profile any time from Settings. We'll keep a quick reminder on your dashboard.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip for now',
          style: 'destructive',
          onPress: async () => {
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
          },
        },
      ],
    );
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
        <Text style={styles.stepSubtitle}>We'll use this to set up your account</Text>
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
          style={{ marginTop: 16, alignItems: 'center', paddingVertical: 8 }}
          onPress={() => { setSelectedRole(null); setOwnerStep('role'); }}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 14, color: colors.mutedForeground }}>
            Joining a crew? <Text style={{ color: colors.primary, fontWeight: '600' }}>Use invite code</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderOwnerTrade = () => (
    <ScrollView style={styles.stepContainer} contentContainerStyle={styles.centeredContent} showsVerticalScrollIndicator={false}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>What's your trade?</Text>
        <Text style={styles.stepSubtitle}>This personalises your templates and demo data</Text>
      </View>

      <View style={styles.tradeGrid}>
        {tradeTypes.map((trade) => {
          const selected = businessData.tradeType === trade.value;
          return (
            <TouchableOpacity
              key={trade.value}
              style={[styles.tradePill, selected && styles.tradePillSelected]}
              onPress={() => setBusinessData(prev => ({ ...prev, tradeType: trade.value }))}
              activeOpacity={0.7}
              testID={`option-trade-${trade.value}`}
            >
              <Ionicons 
                name={trade.icon} 
                size={18} 
                color={selected ? colors.primary : colors.mutedForeground} 
              />
              <Text style={[styles.tradePillLabel, selected && { color: colors.primary, fontWeight: '600' }]}>{trade.label}</Text>
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
          <Ionicons name="arrow-forward" size={18} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderOwnerTeamSize = () => (
    <ScrollView style={styles.stepContainer} contentContainerStyle={styles.centeredContent} showsVerticalScrollIndicator={false}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>How big is your team?</Text>
        <Text style={styles.stepSubtitle}>We'll tailor the experience to your needs</Text>
      </View>

      <View style={styles.teamGrid}>
        {teamSizes.map((size) => {
          const selected = businessData.teamSize === size.value;
          return (
            <TouchableOpacity
              key={size.value}
              style={[styles.teamCard, selected && styles.teamCardSelected]}
              onPress={() => setBusinessData(prev => ({ ...prev, teamSize: size.value }))}
              activeOpacity={0.7}
              testID={`option-team-${size.value}`}
            >
              <Ionicons 
                name={size.icon} 
                size={24} 
                color={selected ? colors.primary : colors.mutedForeground} 
              />
              <Text style={[styles.teamLabel, selected && { color: colors.primary }]}>{size.label}</Text>
              <Text style={styles.teamDesc}>{size.description}</Text>
            </TouchableOpacity>
          );
        })}
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
          placeholder="e.g. MIKE42"
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
            Joining <Text style={{ fontWeight: '700' }}>{inviteValidation.businessName}</Text> as <Text style={{ fontWeight: '700', textTransform: 'capitalize' }}>{inviteValidation.roleType}</Text>
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
      <View style={styles.tradeGrid}>
        {tradeTypes.map((trade) => {
          const selected = subTradeType === trade.value;
          return (
            <TouchableOpacity
              key={trade.value}
              style={[styles.tradePill, selected && styles.tradePillSelected]}
              onPress={() => setSubTradeType(trade.value)}
              activeOpacity={0.7}
            >
              <Ionicons name={trade.icon} size={18} color={selected ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.tradePillLabel, selected && { color: colors.primary, fontWeight: '600' }]}>{trade.label}</Text>
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
        <Text style={styles.stepSubtitle}>Enter an invite code from a business you work with</Text>
      </View>

      <View style={styles.codeInputWrap}>
        <TextInput
          style={styles.codeInput}
          placeholder="e.g. MIKE42"
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
            Connecting to <Text style={{ fontWeight: '700' }}>{subInviteValidation.businessName}</Text>
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
          style={[styles.ctaButton, isLoading && { opacity: 0.5 }]}
          onPress={() => handleSubConnect(false)}
          disabled={isLoading || (!subInviteValidation?.valid && subInviteCode.length > 0)}
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

      <TouchableOpacity style={styles.skipButton} onPress={() => handleSubConnect(true)} activeOpacity={0.6}>
        <Text style={styles.skipText}>Skip for now</Text>
      </TouchableOpacity>
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
          <View style={[styles.privacyDot, { backgroundColor: colors.accent + '18' }]}>
            <Ionicons name="eye-off" size={18} color={colors.accent} />
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
      <View style={[styles.stepContainer, styles.doneContainer, { paddingBottom: 24 + setupInsets.bottom }]}>
        <View style={styles.doneContent}>
          <View style={styles.doneBadge}>
            <Ionicons name="checkmark" size={36} color={colors.primaryForeground} />
          </View>
          
          <Text style={styles.doneTitle}>
            {isWorkerPath ? 'Welcome to the team' : isSubPath ? "You're all set" : "You're good to go"}
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
          <View style={styles.topBar}>
            {canGoBack() ? (
              <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="chevron-back" size={20} color={colors.foreground} />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 40 }} />
            )}

            {total > 1 && (
              <View style={styles.dotsRow}>
                {Array.from({ length: total }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      i < current
                        ? { backgroundColor: colors.primary }
                        : { backgroundColor: colors.border },
                    ]}
                  />
                ))}
              </View>
            )}

            <TouchableOpacity
              onPress={handleSkipOnboarding}
              disabled={isLoading}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              testID="button-skip-onboarding"
              style={styles.skipChip}
              activeOpacity={0.7}
            >
              <Text style={styles.skipChipText}>Skip</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.primary} />
            </TouchableOpacity>
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

        {currentStep !== 'complete' && (
          <TouchableOpacity
            onPress={handleSkipOnboarding}
            disabled={isLoading}
            style={styles.skipFooter}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            testID="button-skip-onboarding-footer"
            activeOpacity={0.7}
          >
            <Text style={styles.skipFooterText}>Skip setup for now</Text>
          </TouchableOpacity>
        )}
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
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  contentArea: {
    flex: 1,
  },

  stepContainer: {
    flex: 1,
  },
  stepContent: {
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 40,
  },
  centeredContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 40,
  },

  welcomeHeader: {
    marginBottom: 28,
  },
  welcomeGreeting: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 6,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.foreground,
    lineHeight: 32,
    letterSpacing: -0.5,
  },

  roleCardsWrap: {
    gap: 12,
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
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 3,
    letterSpacing: -0.2,
  },
  roleDesc: {
    fontSize: 13,
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
    marginLeft: 8,
  },

  stepHeader: {
    marginBottom: 24,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.foreground,
    lineHeight: 28,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  stepSubtitle: {
    fontSize: 15,
    color: colors.mutedForeground,
    lineHeight: 22,
  },

  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
    marginBottom: 8,
  },
  fieldOptional: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.mutedForeground,
  },
  fieldInput: {
    height: 48,
    paddingHorizontal: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    color: colors.foreground,
    fontSize: 16,
  },
  fieldError: {
    color: colors.destructive,
    fontSize: 12,
    marginTop: 6,
  },

  sectionHeading: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 12,
    marginTop: 4,
  },

  tradeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  tradePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    gap: 7,
  },
  tradePillSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '0A',
  },
  tradePillLabel: {
    fontSize: 14,
    color: colors.foreground,
  },

  teamGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  teamCard: {
    width: (SCREEN_WIDTH - 68) / 2,
    paddingVertical: 20,
    paddingHorizontal: 14,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    gap: 8,
  },
  teamCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '08',
  },
  teamLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.foreground,
    letterSpacing: -0.2,
  },
  teamDesc: {
    fontSize: 12,
    color: colors.mutedForeground,
  },

  ctaWrap: {
    marginTop: 8,
  },
  ctaButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  ctaText: {
    color: colors.primaryForeground,
    fontSize: 15,
    fontWeight: '600',
  },

  skipButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  skipText: {
    fontSize: 14,
    color: colors.mutedForeground,
    fontWeight: '500',
  },
  skipTopText: {
    fontSize: 14,
    color: colors.mutedForeground,
    fontWeight: '500',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  skipChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.primary + '15',
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  skipChipText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  skipFooter: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  skipFooterText: {
    fontSize: 14,
    color: colors.mutedForeground,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },

  codeInputWrap: {
    position: 'relative',
    marginBottom: 16,
  },
  codeInput: {
    height: 60,
    paddingHorizontal: 20,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    color: colors.foreground,
    fontSize: 28,
    fontWeight: '700',
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
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 10,
    marginBottom: 16,
  },
  validationText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },

  privacyList: {
    gap: 20,
    marginBottom: 32,
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
    marginTop: 2,
  },
  privacyTextWrap: {
    flex: 1,
  },
  privacyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 4,
  },
  privacyDesc: {
    fontSize: 13,
    color: colors.mutedForeground,
    lineHeight: 19,
  },

  doneContainer: {
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingBottom: 24,
    paddingTop: 48,
  },
  doneContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  doneBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  doneTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.foreground,
    textAlign: 'center',
    lineHeight: 32,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  doneSubtitle: {
    fontSize: 15,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingHorizontal: 16,
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
    fontSize: 14,
    color: colors.foreground,
  },
  doneButtonWrap: {
    paddingTop: 16,
  },

  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
});
