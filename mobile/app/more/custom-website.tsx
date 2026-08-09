import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Switch,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Modal,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { Stack, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavHeight } from '../../src/components/BottomNav';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, iconSizes, fontWeights } from '../../src/lib/design-tokens';
import { useAuthStore } from '../../src/lib/store';
import api from '../../src/lib/api';

const PRICING_TIERS = [
  {
    name: 'Portfolio',
    pages: 'Up to 3 pages',
    price: '$500',
    priceNote: 'one-off',
    desc: 'Online presence for your trade',
    icon: 'layout' as const,
    features: ['Responsive design', 'Contact form', 'Google Maps', 'Social links'],
  },
  {
    name: 'Business',
    pages: 'Up to 5 pages',
    price: '$1,000',
    priceNote: 'one-off',
    desc: 'Full site with lead generation',
    icon: 'briefcase' as const,
    popular: true,
    features: ['Everything in Portfolio', 'Photo gallery', 'Testimonials', 'Quote request form', 'Local SEO'],
  },
  {
    name: 'Premium',
    pages: '6+ pages',
    price: '$1,500+',
    priceNote: 'custom quote',
    desc: 'Enterprise-grade with advanced features',
    icon: 'star' as const,
    features: ['Everything in Business', 'Blog', 'Online booking', 'Before & after gallery', 'Live chat'],
  },
];

const HIGHLIGHTS = [
  { icon: 'smartphone' as const, title: 'Mobile-First', desc: 'Looks great on any device' },
  { icon: 'search' as const, title: 'SEO Optimised', desc: 'Rank higher on Google' },
  { icon: 'link' as const, title: 'JobRunner Integrated', desc: 'Bookings sync to your jobs' },
  { icon: 'server' as const, title: 'Hosting Included', desc: 'No extra monthly fees' },
];

const PROCESS_STEPS = [
  { step: '1', icon: 'send' as const, title: 'Request', desc: 'Tell us about your business' },
  { step: '2', icon: 'pen-tool' as const, title: 'Design', desc: 'We build your custom site' },
  { step: '3', icon: 'check-circle' as const, title: 'Launch', desc: 'Review, approve and go live' },
];

const WEBSITE_TYPES = ['Landing Page', 'Multi-Page', 'Portfolio', 'Booking Site', 'Other'];

const FEATURE_OPTIONS = [
  'Online Booking', 'Contact Form', 'Quote Request', 'Photo Gallery',
  'Testimonials', 'Google Maps', 'Social Links', 'Live Chat', 'Blog', 'Before & After',
];

const BUDGET_OPTIONS = ['~$500', '~$1,000', '$1,500+', 'Not sure'];
const TIMELINE_OPTIONS = ['ASAP', '2 weeks', '1 month', 'No rush'];

interface WebsiteAddonData {
  id: string;
  websiteClickToCall: boolean;
  websiteChatWidget: boolean;
  websiteBookingForm: boolean;
  domainUrl: string | null;
  domainStatus: string;
  hostingStatus: string;
}

export default function CustomWebsitePage() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const { user, businessSettings } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [addonData, setAddonData] = useState<WebsiteAddonData | null>(null);
  const [addonLoading, setAddonLoading] = useState(true);
  const [togglingFeature, setTogglingFeature] = useState<string | null>(null);

  const fetchAddon = useCallback(async () => {
    try {
      const res = await api.get<WebsiteAddonData>('/api/website-addon');
      setAddonData(res.data || null);
    } catch {
      setAddonData(null);
    } finally {
      setAddonLoading(false);
    }
  }, []);

  useEffect(() => { fetchAddon(); }, [fetchAddon]);

  const toggleFeatureSetting = async (feature: string, value: boolean) => {
    setTogglingFeature(feature);
    try {
      await api.patch('/api/website-addon/features', { [feature]: value });
      setAddonData(prev => prev ? { ...prev, [feature]: value } : prev);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed to update feature.');
    } finally {
      setTogglingFeature(null);
    }
  };

  const [businessName, setBusinessName] = useState(businessSettings?.businessName || '');
  const [tradeType, setTradeType] = useState(businessSettings?.tradeType || '');
  const [location, setLocation] = useState(businessSettings?.businessAddress || '');
  const [websiteType, setWebsiteType] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [hasExistingSite, setHasExistingSite] = useState(false);
  const [existingUrl, setExistingUrl] = useState('');
  const [budget, setBudget] = useState('');
  const [timeline, setTimeline] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  const toggleFeature = (feat: string) => {
    setSelectedFeatures(prev =>
      prev.includes(feat) ? prev.filter(f => f !== feat) : [...prev, feat]
    );
  };

  const handleSubmit = async () => {
    if (!businessName.trim()) {
      Alert.alert('Required', 'Please enter your business name.');
      return;
    }
    if (!tradeType.trim()) {
      Alert.alert('Required', 'Please enter your trade type.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post('/api/website-request', {
        businessName: businessName.trim(),
        tradeType: tradeType.trim(),
        location: location.trim(),
        websiteType,
        description: description.trim(),
        features: selectedFeatures,
        hasExistingWebsite: hasExistingSite,
        existingWebsiteUrl: existingUrl.trim(),
        budget,
        timeline,
        additionalNotes: additionalNotes.trim(),
      });

      if (response.error) {
        Alert.alert('Error', response.error);
      } else {
        setSubmitted(true);
        setShowForm(false);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectTierAndStartForm = (tierIndex: number) => {
    setSelectedTier(tierIndex);
    const tier = PRICING_TIERS[tierIndex];
    setBudget(tier.price === '$1,500+' ? '$1,500+' : tier.price === '$1,000' ? '~$1,000' : '~$500');
    setShowForm(true);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: bottomNavHeight }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.heroSection}>
            <Text style={styles.pageTitle}>Custom Website</Text>
            <Text style={styles.pageSubtitle}>
              Professional site built for your trade — designed, hosted & integrated with JobRunner.
            </Text>
          </View>

          <View style={styles.highlightsGrid}>
            {HIGHLIGHTS.map((h, i) => (
              <View key={i} style={styles.highlightCard}>
                <View style={styles.highlightIconWrap}>
                  <Feather name={h.icon} size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.highlightTitle}>{h.title}</Text>
                  <Text style={styles.highlightDesc}>{h.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          {addonData && (
            <View style={styles.listSection}>
              <Text style={styles.sectionLabel}>Website Features</Text>
              <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground, marginBottom: spacing.md, marginTop: -spacing.sm }}>
                Enable interactive features to generate more leads
              </Text>

              <View style={styles.tierCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#2563EB12', alignItems: 'center', justifyContent: 'center' }}>
                      <Feather name="phone-call" size={16} color="#2563EB" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground }}>Click-to-Call</Text>
                      <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground }}>Floating call button on your site</Text>
                    </View>
                  </View>
                  <Switch
                    value={addonData.websiteClickToCall}
                    onValueChange={(v) => toggleFeatureSetting('websiteClickToCall', v)}
                    disabled={togglingFeature === 'websiteClickToCall'}
                    trackColor={{ false: colors.muted, true: `${colors.primary}60` }}
                    thumbColor={addonData.websiteClickToCall ? colors.primary : colors.mutedForeground}
                  />
                </View>

                <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.sm }} />

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#7c3aed12', alignItems: 'center', justifyContent: 'center' }}>
                      <Feather name="message-circle" size={16} color="#7c3aed" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground }}>AI Chat Widget</Text>
                      <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground }}>AI-powered live chat with your knowledge</Text>
                    </View>
                  </View>
                  <Switch
                    value={addonData.websiteChatWidget}
                    onValueChange={(v) => toggleFeatureSetting('websiteChatWidget', v)}
                    disabled={togglingFeature === 'websiteChatWidget'}
                    trackColor={{ false: colors.muted, true: `${colors.primary}60` }}
                    thumbColor={addonData.websiteChatWidget ? colors.primary : colors.mutedForeground}
                  />
                </View>

                <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.sm }} />

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#16a34a12', alignItems: 'center', justifyContent: 'center' }}>
                      <Feather name="calendar" size={16} color="#16a34a" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground }}>Booking Form</Text>
                      <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground }}>Collect leads with name, phone, job type</Text>
                    </View>
                  </View>
                  <Switch
                    value={addonData.websiteBookingForm}
                    onValueChange={(v) => toggleFeatureSetting('websiteBookingForm', v)}
                    disabled={togglingFeature === 'websiteBookingForm'}
                    trackColor={{ false: colors.muted, true: `${colors.primary}60` }}
                    thumbColor={addonData.websiteBookingForm ? colors.primary : colors.mutedForeground}
                  />
                </View>
              </View>
            </View>
          )}

          {submitted ? (
            <View style={styles.listSection}>
              <View style={styles.successCard}>
                <View style={styles.successIconWrap}>
                  <Feather name="check-circle" size={24} color="#22c55e" />
                </View>
                <Text style={styles.successTitle}>Request Submitted</Text>
                <Text style={styles.successDesc}>We'll be in touch within 1-2 business days to discuss your project.</Text>
                <PressableRow style={styles.successButton} onPress={() => router.back()} >
                  <Text style={styles.successButtonText}>Back to More</Text>
                </PressableRow>
              </View>
            </View>
          ) : (
            <View style={styles.listSection}>
              <Text style={styles.sectionLabel}>How It Works</Text>
              <View style={styles.processRow}>
                {PROCESS_STEPS.map((step, i) => (
                  <View key={i} style={styles.processStep}>
                    <View style={styles.processNumberWrap}>
                      <Text style={styles.processNumber}>{step.step}</Text>
                    </View>
                    <Text style={styles.processTitle}>{step.title}</Text>
                    <Text style={styles.processDesc}>{step.desc}</Text>
                  </View>
                ))}
              </View>

              <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>Choose a Package</Text>
              {PRICING_TIERS.map((tier, i) => (
                <PressableRow key={i} style={[styles.tierCard, tier.popular && styles.tierCardPopular]} onPress={() => selectTierAndStartForm(i)} >
                  {tier.popular && (
                    <View style={styles.popularBadge}>
                      <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
                    </View>
                  )}
                  <View style={styles.tierHeader}>
                    <View style={[styles.tierIconWrap, tier.popular && { backgroundColor: `${colors.primary}20` }]}>
                      <Feather name={tier.icon} size={18} color={tier.popular ? colors.primary : colors.mutedForeground} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tierName}>{tier.name}</Text>
                      <Text style={styles.tierDesc}>{tier.pages}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.tierPrice, tier.popular && { color: colors.primary }]}>{tier.price}</Text>
                      <Text style={styles.tierPriceNote}>{tier.priceNote}</Text>
                    </View>
                  </View>
                  <View style={styles.tierFeatures}>
                    {tier.features.map((feat, j) => (
                      <View key={j} style={styles.tierFeatureRow}>
                        <View style={styles.tierFeatureCheck}>
                          <Feather name="check" size={10} color={colors.white} />
                        </View>
                        <Text style={styles.tierFeatureText}>{feat}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={[styles.tierCta, tier.popular && styles.tierCtaPopular]}>
                    <Text style={[styles.tierCtaText, tier.popular && { color: colors.primaryForeground }]}>Get Started</Text>
                    <Feather name="arrow-right" size={14} color={tier.popular ? colors.primaryForeground : colors.primary} />
                  </View>
                </PressableRow>
              ))}
            </View>
          )}
        </ScrollView>

        <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowForm(false)}>
          <View style={styles.modalContainer}>
            <View style={[styles.modalHeader, { paddingTop: Math.max(insets.top, spacing.md) }]}>
              <PressableRow onPress={() => setShowForm(false)}>
                <Feather name="x" size={24} color={colors.foreground} />
              </PressableRow>
              <Text style={styles.modalTitle}>Your Project Details</Text>
              <View style={{ width: 24 }} />
            </View>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
              <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
                {selectedTier !== null && (
                  <View style={styles.selectedTierPill}>
                    <Feather name={PRICING_TIERS[selectedTier].icon} size={14} color={colors.primary} />
                    <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.primary }}>
                      {PRICING_TIERS[selectedTier].name} — {PRICING_TIERS[selectedTier].price}
                    </Text>
                  </View>
                )}

                <Text style={styles.fieldLabel}>Business Name *</Text>
                <TextInput style={styles.input} value={businessName} onChangeText={setBusinessName} placeholder="e.g. Mike's Plumbing Services" placeholderTextColor={colors.mutedForeground} />

                <Text style={styles.fieldLabel}>Trade Type *</Text>
                <TextInput style={styles.input} value={tradeType} onChangeText={setTradeType} placeholder="e.g. Plumber, Electrician" placeholderTextColor={colors.mutedForeground} />

                <Text style={styles.fieldLabel}>Location</Text>
                <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="e.g. Cairns, QLD" placeholderTextColor={colors.mutedForeground} />

                <Text style={styles.fieldLabel}>Website Type</Text>
                <View style={styles.chipRow}>
                  {WEBSITE_TYPES.map(type => (
                    <PressableRow key={type} style={[styles.chip, websiteType === type && styles.chipActive]} onPress={() => setWebsiteType(websiteType === type ? '' : type)} >
                      <Text style={[styles.chipText, websiteType === type && styles.chipTextActive]}>{type}</Text>
                    </PressableRow>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Goals</Text>
                <TextInput style={[styles.input, { minHeight: 72, textAlignVertical: 'top' }]} value={description} onChangeText={setDescription} placeholder="What do you want your site to achieve?" placeholderTextColor={colors.mutedForeground} multiline numberOfLines={3} />

                <Text style={styles.fieldLabel}>Features</Text>
                <View style={styles.chipRow}>
                  {FEATURE_OPTIONS.map(feat => (
                    <PressableRow key={feat} style={[styles.chip, selectedFeatures.includes(feat) && styles.chipActive]} onPress={() => toggleFeature(feat)} >
                      {selectedFeatures.includes(feat) && <Feather name="check" size={11} color={colors.primaryForeground} style={{ marginRight: 3 }} />}
                      <Text style={[styles.chipText, selectedFeatures.includes(feat) && styles.chipTextActive]}>{feat}</Text>
                    </PressableRow>
                  ))}
                </View>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Existing website?</Text>
                  <Switch value={hasExistingSite} onValueChange={setHasExistingSite} trackColor={{ false: colors.muted, true: `${colors.primary}60` }} thumbColor={hasExistingSite ? colors.primary : colors.mutedForeground} />
                </View>
                {hasExistingSite && (
                  <TextInput style={styles.input} value={existingUrl} onChangeText={setExistingUrl} placeholder="www.mybusiness.com.au" placeholderTextColor={colors.mutedForeground} autoCapitalize="none" keyboardType="url" />
                )}

                <Text style={styles.fieldLabel}>Timeline</Text>
                <View style={styles.chipRow}>
                  {TIMELINE_OPTIONS.map(opt => (
                    <PressableRow key={opt} style={[styles.chip, timeline === opt && styles.chipActive]} onPress={() => setTimeline(timeline === opt ? '' : opt)} >
                      <Text style={[styles.chipText, timeline === opt && styles.chipTextActive]}>{opt}</Text>
                    </PressableRow>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Notes</Text>
                <TextInput style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]} value={additionalNotes} onChangeText={setAdditionalNotes} placeholder="Branding, logo, colours, anything else..." placeholderTextColor={colors.mutedForeground} multiline numberOfLines={2} />

                <PressableRow style={[styles.submitBtn, submitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={submitting} >
                  {submitting ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : <Feather name="send" size={16} color={colors.primaryForeground} />}
                  <Text style={styles.submitBtnText}>{submitting ? 'Submitting...' : 'Submit Request'}</Text>
                </PressableRow>

                <View style={{ height: 60 }} />
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      </View>
    </>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  heroSection: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  heroIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: `${colors.primary}12`, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { fontSize: typography.sizes['3xl'], fontWeight: fontWeights.extrabold, color: colors.foreground, letterSpacing: -0.5 },
  pageSubtitle: { fontSize: typography.button.fontSize, color: colors.mutedForeground, marginTop: 4, lineHeight: 20 },
  highlightsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.md },
  highlightCard: { width: '48%' as any, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.cardBorder },
  highlightIconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: `${colors.primary}12`, alignItems: 'center', justifyContent: 'center' },
  highlightTitle: { fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.foreground },
  highlightDesc: { fontSize: typography.sizes.xs, color: colors.mutedForeground, marginTop: 1, lineHeight: 14 },
  listSection: { paddingHorizontal: spacing.lg },
  sectionLabel: { fontSize: typography.sizes.lg, fontWeight: fontWeights.bold, color: colors.foreground, marginBottom: spacing.md },
  processRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  processStep: { flex: 1, alignItems: 'center', gap: 4 },
  processNumberWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: `${colors.primary}12`, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  processNumber: { fontSize: typography.sizes.md, fontWeight: fontWeights.bold, color: colors.primary },
  processTitle: { fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.foreground },
  processDesc: { fontSize: typography.sizes.xs, color: colors.mutedForeground, textAlign: 'center', lineHeight: 15 },
  tierCard: { backgroundColor: colors.card, borderRadius: radius['2xl'], padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.cardBorder, ...shadows.sm },
  tierCardPopular: { borderColor: colors.primary, borderWidth: 1.5 },
  popularBadge: { position: 'absolute', top: -10, alignSelf: 'center', left: '30%', backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 3, borderRadius: radius.full, zIndex: 1 },
  popularBadgeText: { fontSize: typography.sizes.xs, fontWeight: fontWeights.bold, color: colors.primaryForeground, letterSpacing: 0.5 },
  tierHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  tierIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  tierName: { fontSize: typography.subtitle.fontSize, fontWeight: fontWeights.bold, color: colors.foreground },
  tierDesc: { fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, marginTop: 1 },
  tierPrice: { fontSize: typography.sizes['2xl'], fontWeight: fontWeights.extrabold, color: colors.foreground, letterSpacing: -0.5 },
  tierPriceNote: { fontSize: typography.sizes.xs, color: colors.mutedForeground },
  tierFeatures: { marginBottom: spacing.md, gap: 6 },
  tierFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tierFeatureCheck: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center' },
  tierFeatureText: { fontSize: typography.button.fontSize, color: colors.foreground },
  tierCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: radius.lg, backgroundColor: `${colors.primary}10` },
  tierCtaPopular: { backgroundColor: colors.primary },
  tierCtaText: { fontSize: typography.sizes.md, fontWeight: fontWeights.semibold, color: colors.primary },
  modalContainer: { flex: 1, backgroundColor: colors.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { ...typography.subtitle, color: colors.foreground },
  modalBody: { padding: spacing.lg },
  selectedTierPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: `${colors.primary}10`, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full, alignSelf: 'flex-start', marginBottom: spacing.md },
  fieldLabel: { fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.foreground, marginBottom: 6, marginTop: spacing.md },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: typography.sizes.md, color: colors.foreground, marginBottom: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: typography.captionSmall.fontSize, fontWeight: fontWeights.medium, color: colors.foreground },
  chipTextActive: { color: colors.primaryForeground },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md, marginBottom: spacing.xs },
  switchLabel: { fontSize: typography.button.fontSize, color: colors.foreground, flex: 1, marginRight: spacing.sm },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: 14, marginTop: spacing.lg },
  submitBtnText: { fontSize: typography.subtitle.fontSize, fontWeight: fontWeights.semibold, color: colors.primaryForeground },
  successCard: { backgroundColor: colors.card, borderRadius: radius['2xl'], padding: spacing.xl, alignItems: 'center', borderWidth: 1, borderColor: `${colors.success}30`, ...shadows.sm, marginTop: spacing.md },
  successIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#22c55e12', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  successTitle: { fontSize: typography.sizes.xl, fontWeight: fontWeights.bold, color: colors.foreground, marginBottom: spacing.xs },
  successDesc: { fontSize: typography.button.fontSize, color: colors.mutedForeground, textAlign: 'center', lineHeight: 20, marginBottom: spacing.md },
  successButton: { backgroundColor: `${colors.primary}10`, paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radius.lg },
  successButtonText: { fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.primary },
});
