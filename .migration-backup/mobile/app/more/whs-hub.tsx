import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet, ActivityIndicator, TextInput, Platform, KeyboardAvoidingView } from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '@/components/ui/PressableRow';
import { useConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Stack, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavHeight } from '../../src/components/BottomNav';
import { useTheme, ThemeColors, colorWithOpacity } from '../../src/lib/theme';
import { AppBottomSheet } from '../../src/components/ui/AppBottomSheet';
import { BottomSheetScrollView } from '../../src/components/ui/AppBottomSheet';
import { api } from '../../src/lib/api';
import { spacing, radius, shadows, typography, pageShell, componentStyles, iconSizes, typographySizes, sizes, fontWeights } from '../../src/lib/design-tokens';
import { JobLinkField } from '../../src/components/JobLinkField';

type TabKey = 'incidents' | 'emergency' | 'jsa' | 'environments' | 'signage' | 'hazard_reports' | 'ppe' | 'training';

const TABS: { key: TabKey; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'incidents', label: 'Incidents', icon: 'alert-triangle' },
  { key: 'emergency', label: 'Emergency', icon: 'phone' },
  { key: 'jsa', label: 'JSA', icon: 'clipboard' },
  { key: 'environments', label: 'Hazards', icon: 'zap' },
  { key: 'signage', label: 'Signs', icon: 'eye' },
  { key: 'hazard_reports', label: 'Reports', icon: 'file-text' },
  { key: 'ppe', label: 'PPE', icon: 'check-square' },
  { key: 'training', label: 'Training', icon: 'award' },
];

const PPE_ITEMS = [
  { key: 'hardHat', label: 'Hard Hat' },
  { key: 'hiVis', label: 'Hi-Vis Vest/Shirt' },
  { key: 'safetyBoots', label: 'Safety Boots' },
  { key: 'safetyGlasses', label: 'Safety Glasses' },
  { key: 'hearingProtection', label: 'Hearing Protection' },
  { key: 'gloves', label: 'Gloves' },
  { key: 'sunscreen', label: 'Sunscreen' },
  { key: 'respirator', label: 'Respirator/Mask' },
  { key: 'safetyHarness', label: 'Safety Harness' },
];

const COMMON_COURSES = [
  { code: 'CPCCWHS1001', name: 'White Card' },
  { code: 'HLTAID011', name: 'Provide First Aid' },
  { code: 'HLTAID009', name: 'CPR' },
  { code: 'TLILIC0003', name: 'Forklift Licence' },
  { code: 'RIIWHS204E', name: 'Work Safely at Heights' },
  { code: 'CPCCLSF2001A', name: 'Scaffolding — Basic' },
  { code: 'CPCCLDG3001A', name: 'Dogging Licence' },
];

const INCIDENT_TYPES = [
  { value: 'near_miss', label: 'Near Miss' },
  { value: 'injury', label: 'Injury' },
  { value: 'property_damage', label: 'Property Damage' },
  { value: 'environmental', label: 'Environmental' },
  { value: 'dangerous_occurrence', label: 'Dangerous Occurrence' },
  { value: 'notifiable_incident', label: 'Notifiable Incident' },
];

const buildWhsConfig = (colors: ThemeColors) => ({
  severities: [
    { value: 'minor', label: 'Minor', color: colors.warning },
    { value: 'moderate', label: 'Moderate', color: colors.destructive },
    { value: 'serious', label: 'Serious', color: colors.destructive },
    { value: 'critical', label: 'Critical', color: colors.destructive },
  ],
  riskColor: (level: string) => {
    if (level === 'low') return colors.success;
    if (level === 'medium') return colors.warning;
    return colors.destructive;
  },
  statusColor: (status: string) =>
    status === 'open' ? colors.info : status === 'resolved' || status === 'closed' ? colors.success : colors.info,
  trainingStatusColor: (status: string) =>
    status === 'current' ? colors.success : status === 'expired' ? colors.destructive : colors.warning,
  emergency: colors.destructive,
  installed: colors.info,
  emergencyAccent: colors.success,
  firstAidKit: colors.info,
  firstAider: colors.primary,
  hospital: colors.destructive,
  ppeYes: colors.success,
  ppeNo: colors.destructive,
  notifiable: colors.destructive,
  signInstalled: colors.success,
  attentionWarning: colors.warning,
  attentionDestructive: colors.destructive,
  attentionInfo: colors.info,
  attentionPrimary: colors.primary,
});

const REPORTED_TO_ROLES = [
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'leading_hand', label: 'Leading Hand' },
  { value: 'foreman', label: 'Foreman' },
  { value: 'hse_advisor', label: 'HSE Advisor' },
  { value: 'hsr', label: 'HSR' },
];

const createStyles = (colors: ThemeColors, isDark: boolean, bottomNavHeight: number = 0) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  heroSection: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  pageTitle: { fontSize: typography.sizes['3xl'], fontWeight: fontWeights.extrabold, color: colors.foreground, letterSpacing: -0.5 },
  pageSubtitle: { fontSize: typography.button.fontSize, color: colors.mutedForeground, marginTop: spacing.xs, lineHeight: 20 },
  heroTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  heroTitleText: { flex: 1 },
  heroAddButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: spacing.xs + 2, paddingHorizontal: spacing.md, marginTop: 4, ...shadows.sm },
  heroAddText: { fontSize: typography.sizes.sm, fontWeight: fontWeights.bold, color: colors.primaryForeground },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  statCard: { flex: 1, backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.cardBorder, ...shadows.sm },
  signRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.cardBorder, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  statIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  statValue: { fontSize: typography.subtitle.fontSize, fontWeight: fontWeights.bold, color: colors.foreground },
  statLabel: { fontSize: typography.sizes.xs, color: colors.mutedForeground, marginTop: 1 },
  actionBanner: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, marginTop: spacing.md, borderWidth: 1, borderColor: colors.cardBorder },
  actionBannerHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  actionBannerIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionBannerTitle: { flex: 1, fontSize: typography.button.fontSize, fontWeight: fontWeights.bold, color: colors.foreground },
  actionItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  actionItemText: { flex: 1, fontSize: typography.sizes.sm, color: colors.foreground },
  actionMoreText: { fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, textAlign: 'center', marginTop: spacing.xs },
  complianceBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, marginTop: spacing.md, borderWidth: 1, borderColor: colors.cardBorder },
  complianceBannerText: { fontSize: typography.button.fontSize, fontWeight: fontWeights.medium, color: colors.success },
  stickyBar: { backgroundColor: colors.background, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  filterChip: { paddingHorizontal: spacing.sm, paddingVertical: 8, borderRadius: radius.full, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, flexDirection: 'row', alignItems: 'center', gap: 5 },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary, ...shadows.sm },
  filterChipText: { fontSize: typography.sizes.sm, color: colors.mutedForeground, fontWeight: fontWeights.medium },
  filterChipTextActive: { color: colors.primaryForeground, fontWeight: fontWeights.bold },
  chipCount: { minWidth: 18, paddingHorizontal: 5, paddingVertical: 1, borderRadius: radius.full, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  chipCountActive: { backgroundColor: colorWithOpacity(colors.primaryForeground, 0.25) },
  chipCountText: { fontSize: typography.sizes.xs, fontWeight: fontWeights.bold, color: colors.mutedForeground },
  chipCountTextActive: { color: colors.primaryForeground },
  catHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap', paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.sm },
  catHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1, minWidth: 0 },
  catTitle: { fontSize: typography.sizes.lg, fontWeight: fontWeights.bold, color: colors.foreground, flexShrink: 1 },
  catCountBadge: { minWidth: 22, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.full, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  catCountText: { fontSize: typography.captionSmall.fontSize, fontWeight: fontWeights.bold, color: colors.mutedForeground },
  catAddButton: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: spacing.xs + 2, paddingHorizontal: spacing.md, ...shadows.sm },
  catAddText: { fontSize: typography.sizes.sm, fontWeight: fontWeights.bold, color: colors.primaryForeground },
  viewJobRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  linkedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colorWithOpacity(colors.primary, 0.12), paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  linkedBadgeText: { fontSize: typography.sizes.xs, fontWeight: fontWeights.bold, color: colors.primary },
  viewJobText: { flex: 1, fontSize: typography.captionSmall.fontSize, fontWeight: fontWeights.semibold, color: colors.primary },
  listSection: { paddingHorizontal: spacing.lg, paddingBottom: bottomNavHeight },
  card: { backgroundColor: colors.card, borderRadius: radius['2xl'], padding: spacing.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.cardBorder, ...shadows.sm },
  cardTitle: { fontSize: typography.sizes.md, fontWeight: fontWeights.semibold, color: colors.foreground },
  cardSubtext: { fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, marginTop: 2, lineHeight: 17 },
  cardMeta: { fontSize: typography.captionSmall.fontSize, lineHeight: 17 },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full, marginRight: spacing.xs, marginBottom: 4 },
  badgeText: { fontSize: typography.sizes.xs, fontWeight: fontWeights.semibold },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl * 2, paddingHorizontal: spacing.lg, gap: spacing.sm },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: `${colors.primary}12`, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  emptyTitle: { fontSize: typography.sizes.lg, fontWeight: fontWeights.semibold, color: colors.foreground },
  emptyDesc: { fontSize: typography.button.fontSize, color: colors.mutedForeground, textAlign: 'center' as const, lineHeight: 20 },
  emptyButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.lg, marginTop: spacing.md, ...shadows.sm },
  emptyButtonText: { fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.primaryForeground },
  fab: { position: 'absolute', bottom: spacing.xl, right: spacing.lg, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadows.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.muted, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full },
  metaChipText: { fontSize: typography.sizes.xs, color: colors.mutedForeground },
  stepCard: { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderRadius: radius.lg, padding: spacing.sm, marginBottom: spacing.sm },
  stepHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  hazardBadge: { backgroundColor: colorWithOpacity(colors.destructive, 0.12), paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: radius.sm, marginRight: spacing.xs, marginBottom: 4 },
  hazardBadgeText: { fontSize: typography.sizes.xs, color: colors.destructive, fontWeight: fontWeights.semibold },
  ppeBadge: { backgroundColor: colorWithOpacity(colors.info, 0.12), paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: radius.sm, marginRight: spacing.xs, marginBottom: 4 },
  ppeBadgeText: { fontSize: typography.sizes.xs, color: colors.info, fontWeight: fontWeights.semibold },
  checkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs + 2, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  sectionTitle: { fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground, marginBottom: spacing.sm, marginTop: spacing.sm },
  modalContainer: { flex: 1, backgroundColor: colors.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { ...typography.subtitle, color: colors.foreground },
  modalBody: { padding: spacing.md },
  inputLabel: { fontSize: typography.sizes.sm, fontWeight: fontWeights.medium, color: colors.foreground, marginBottom: spacing.xs },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, fontSize: typography.sizes.md, color: colors.foreground, marginBottom: spacing.md },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
  optionChip: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  optionChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionChipText: { fontSize: typography.captionSmall.fontSize, color: colors.foreground },
  optionChipTextActive: { color: colors.primaryForeground },
  chipButton: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.lg, borderWidth: 1 },
  saveButton: { fontSize: typography.subtitle.fontSize, fontWeight: fontWeights.semibold },
});

export default function WhsHubScreen() {
  const { colors, isDark } = useTheme();
  const confirm = useConfirmDialog();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, isDark, bottomNavHeight), [colors, isDark, bottomNavHeight]);
  const whsConfig = useMemo(() => buildWhsConfig(colors), [colors]);
  const SEVERITIES = whsConfig.severities;
  const [activeTab, setActiveTab] = useState<TabKey>('incidents');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [incidents, setIncidents] = useState<any[]>([]);
  const [emergencyInfo, setEmergencyInfo] = useState<any[]>([]);
  const [jsaDocs, setJsaDocs] = useState<any[]>([]);
  const [environments, setEnvironments] = useState<any[]>([]);
  const [signs, setSigns] = useState<any[]>([]);
  const [hazardReports, setHazardReports] = useState<any[]>([]);
  const [ppeChecklists, setPpeChecklists] = useState<any[]>([]);
  const [trainingRecords, setTrainingRecords] = useState<any[]>([]);
  const [envTypes, setEnvTypes] = useState<any[]>([]);
  const [signTypes, setSignTypes] = useState<any[]>([]);

  const [showIncidentForm, setShowIncidentForm] = useState(false);
  const [showEmergencyForm, setShowEmergencyForm] = useState(false);
  const [showJsaForm, setShowJsaForm] = useState(false);
  const [showEnvForm, setShowEnvForm] = useState(false);
  const [showSignForm, setShowSignForm] = useState(false);
  const [showHazardForm, setShowHazardForm] = useState(false);
  const [showPpeForm, setShowPpeForm] = useState(false);
  const [showTrainingForm, setShowTrainingForm] = useState(false);

  const [incidentForm, setIncidentForm] = useState({
    title: '', description: '', incidentType: 'near_miss', severity: 'minor',
    location: '', reportedTo: '', reportedToRole: 'supervisor', workerName: '',
    immediateActions: '', isNotifiable: false, jobId: '',
  });

  const [emergencyForm, setEmergencyForm] = useState({
    siteName: '', siteAddress: '', assemblyPoint: '', firstAidLocation: '',
    firstAidOfficer: '', firstAidOfficerPhone: '', emergencyNumber: '000',
    nearestHospital: '', jobId: '',
  });

  const [jsaForm, setJsaForm] = useState({
    title: '', description: '', siteAddress: '', assessedBy: '', jobId: '',
    steps: [{ taskDescription: '', hazards: '', riskLevel: 'medium', controlMeasures: '', responsiblePerson: '' }],
  });

  const [selectedEnvType, setSelectedEnvType] = useState('');
  const [signForm, setSignForm] = useState({ signType: '', signCategory: '', location: '' });
  const [hazardForm, setHazardForm] = useState({
    description: '', location: '', dateIdentified: new Date().toISOString().split('T')[0],
    timeIdentified: '', recommendedAction: '', reportedBy: '', supervisorName: '',
    riskLevel: 'medium', status: 'open', jobId: '',
  });
  const [ppeForm, setPpeForm] = useState<Record<string, any>>({
    workerName: '', date: new Date().toISOString().split('T')[0],
    hardHat: false, hiVis: false, safetyBoots: false, safetyGlasses: false,
    hearingProtection: false, gloves: false, sunscreen: false, respirator: false,
    safetyHarness: false, otherPpe: '', supervisorName: '', notes: '',
  });
  const [trainingForm, setTrainingForm] = useState({
    workerName: '', courseCode: 'CPCCWHS1001', courseName: 'White Card',
    rtoName: '', completionDate: '', expiryDate: '', certificateNumber: '',
    status: 'current', notes: '',
  });

  const fetchData = useCallback(async () => {
    try {
      const [incRes, emRes, jsaRes, envRes, signRes, hazRes, ppeRes, trainRes, envTypesRes, signTypesRes] = await Promise.all([
        api.get('/api/whs/incidents'),
        api.get('/api/whs/emergency-info'),
        api.get('/api/whs/jsa'),
        api.get('/api/whs/hazardous-environments'),
        api.get('/api/whs/safety-signage'),
        api.get('/api/whs/hazard-reports'),
        api.get('/api/whs/ppe-checklists'),
        api.get('/api/whs/training-records'),
        api.get('/api/whs/reference/environment-types'),
        api.get('/api/whs/reference/sign-types'),
      ]);
      setIncidents(Array.isArray(incRes.data) ? incRes.data : []);
      setEmergencyInfo(Array.isArray(emRes.data) ? emRes.data : []);
      const jsaList = Array.isArray(jsaRes.data) ? jsaRes.data : [];
      setJsaDocs(jsaList);
      // Write-through cache for offline access
      if (jsaList.length > 0 || !jsaRes.error) {
        try {
          const { offlineStorage } = await import('@/lib/offline-storage');
          await offlineStorage.cacheJsaDocs(jsaList);
        } catch {}
      }
      setEnvironments(Array.isArray(envRes.data) ? envRes.data : []);
      setSigns(Array.isArray(signRes.data) ? signRes.data : []);
      setHazardReports(Array.isArray(hazRes.data) ? hazRes.data : []);
      setPpeChecklists(Array.isArray(ppeRes.data) ? ppeRes.data : []);
      setTrainingRecords(Array.isArray(trainRes.data) ? trainRes.data : []);
      setEnvTypes(Array.isArray(envTypesRes.data) ? envTypesRes.data : []);
      setSignTypes(Array.isArray(signTypesRes.data) ? signTypesRes.data : []);
    } catch (e) {
      console.error('Failed to fetch WHS data:', e);
      // Offline / network failure: hydrate JSA list from cache
      try {
        const { offlineStorage } = await import('@/lib/offline-storage');
        const cached = await offlineStorage.getJsaDocsOffline();
        if (Array.isArray(cached) && cached.length > 0) {
          setJsaDocs(cached);
        }
      } catch {}
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchData(); }, [fetchData]);

  async function submitIncident() {
    if (!incidentForm.title || !incidentForm.description) {
      Alert.alert('Required', 'Title and description are required');
      return;
    }
    try {
      await api.post('/api/whs/incidents', incidentForm);
      setShowIncidentForm(false);
      setIncidentForm({ title: '', description: '', incidentType: 'near_miss', severity: 'minor', location: '', reportedTo: '', reportedToRole: 'supervisor', workerName: '', immediateActions: '', isNotifiable: false, jobId: '' });
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to submit');
    }
  }

  async function submitEmergency() {
    if (!emergencyForm.siteName) {
      Alert.alert('Required', 'Site name is required');
      return;
    }
    try {
      await api.post('/api/whs/emergency-info', emergencyForm);
      setShowEmergencyForm(false);
      setEmergencyForm({ siteName: '', siteAddress: '', assemblyPoint: '', firstAidLocation: '', firstAidOfficer: '', firstAidOfficerPhone: '', emergencyNumber: '000', nearestHospital: '', jobId: '' });
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save');
    }
  }

  async function submitJsa() {
    if (!jsaForm.title) {
      Alert.alert('Required', 'Title is required');
      return;
    }
    const validSteps = jsaForm.steps.filter(s => s.taskDescription && s.hazards && s.controlMeasures);
    if (validSteps.length === 0) {
      Alert.alert('Required', 'At least one complete step is required');
      return;
    }
    try {
      await api.post('/api/whs/jsa', { ...jsaForm, steps: validSteps });
      setShowJsaForm(false);
      setJsaForm({ title: '', description: '', siteAddress: '', assessedBy: '', jobId: '', steps: [{ taskDescription: '', hazards: '', riskLevel: 'medium', controlMeasures: '', responsiblePerson: '' }] });
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create');
    }
  }

  async function addEnvironment() {
    const envType = envTypes.find((t: any) => t.type === selectedEnvType);
    if (!envType) return;
    try {
      await api.post('/api/whs/hazardous-environments', {
        environmentType: envType.type,
        hazards: envType.defaultHazards,
        controlMeasures: [],
        requiredPpe: envType.defaultPpe,
        requiredLicenses: envType.requiredLicenses,
      });
      setShowEnvForm(false);
      setSelectedEnvType('');
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to add');
    }
  }

  async function addSign() {
    if (!signForm.signType || !signForm.signCategory) {
      Alert.alert('Required', 'Select a sign type');
      return;
    }
    try {
      await api.post('/api/whs/safety-signage', signForm);
      setShowSignForm(false);
      setSignForm({ signType: '', signCategory: '', location: '' });
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to add');
    }
  }

  async function toggleSignInstalled(sign: any) {
    try {
      await api.patch(`/api/whs/safety-signage/${sign.id}`, { isInstalled: !sign.isInstalled });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  }

  async function deleteItem(endpoint: string, id: string) {
    confirm({
      title: 'Delete',
      message: 'Are you sure?',
      confirmText: 'Delete',
      destructive: true,
    }).then(async (ok) => {
      if (!ok) return;
      try {
        await api.delete(`${endpoint}/${id}`);
        fetchData();
      } catch (e) { console.error(e); }
    });
  }

  async function closeIncident(id: string) {
    try {
      await api.patch(`/api/whs/incidents/${id}`, { status: 'closed' });
      fetchData();
    } catch (e) { console.error(e); }
  }

  const openIncidents = incidents.filter(r => r.status === 'open').length;
  const openHazards = hazardReports.filter(h => h.status === 'open').length;
  const expiredTraining = trainingRecords.filter((r: any) => r.status === 'expired').length;
  const expiringSoonTraining = trainingRecords.filter((r: any) => r.status === 'expiring_soon').length;
  const signsNotInstalled = signs.filter(s => !s.isInstalled).length;
  const ppeFailCount = ppeChecklists.filter((c: any) => !c.allCorrect).length;

  const actionItems = useMemo(() => {
    const items: { icon: keyof typeof Feather.glyphMap; text: string; color: string; tab: TabKey }[] = [];
    if (openIncidents > 0) items.push({ icon: 'alert-triangle', text: `${openIncidents} open incident${openIncidents > 1 ? 's' : ''} to resolve`, color: colors.destructive, tab: 'incidents' });
    if (openHazards > 0) items.push({ icon: 'alert-circle', text: `${openHazards} hazard${openHazards > 1 ? 's' : ''} need attention`, color: colors.destructive, tab: 'hazard_reports' });
    if (expiredTraining > 0) items.push({ icon: 'award', text: `${expiredTraining} expired training record${expiredTraining > 1 ? 's' : ''}`, color: colors.destructive, tab: 'training' });
    if (expiringSoonTraining > 0) items.push({ icon: 'clock', text: `${expiringSoonTraining} training expiring soon`, color: colors.warning, tab: 'training' });
    if (signsNotInstalled > 0) items.push({ icon: 'eye', text: `${signsNotInstalled} sign${signsNotInstalled > 1 ? 's' : ''} not yet installed`, color: colors.info, tab: 'signage' });
    if (ppeFailCount > 0) items.push({ icon: 'check-square', text: `${ppeFailCount} incomplete PPE check-in${ppeFailCount > 1 ? 's' : ''}`, color: colors.warning, tab: 'ppe' });
    if (emergencyInfo.length === 0) items.push({ icon: 'phone', text: 'No emergency plan set up', color: colors.primary, tab: 'emergency' });
    if (jsaDocs.length === 0 && incidents.length + hazardReports.length + environments.length > 0) items.push({ icon: 'clipboard', text: 'No JSAs created for active sites', color: colors.primary, tab: 'jsa' });
    return items;
  }, [openIncidents, openHazards, expiredTraining, expiringSoonTraining, signsNotInstalled, ppeFailCount, emergencyInfo.length, jsaDocs.length, incidents.length, hazardReports.length, environments.length, colors.primary]);

  const totalItems = incidents.length + emergencyInfo.length + jsaDocs.length + environments.length + signs.length + hazardReports.length + ppeChecklists.length + trainingRecords.length;
  // Compliance baseline: count distinct "setup" categories with at least one entry.
  // Reactive categories (incidents, hazardReports) are excluded — having zero of those is good, not a setup gap.
  const setupCategoriesPopulated = [
    emergencyInfo.length > 0,
    jsaDocs.length > 0,
    trainingRecords.length > 0,
    ppeChecklists.length > 0,
    signs.length > 0,
    environments.length > 0,
  ].filter(Boolean).length;
  const SETUP_CATEGORIES_TOTAL = 6;
  const MIN_SETUP_FOR_SCORE = 3;
  const hasComplianceBaseline = setupCategoriesPopulated >= MIN_SETUP_FOR_SCORE;
  const complianceScore = !hasComplianceBaseline
    ? null
    : (totalItems === 0 ? 0 : Math.round(((totalItems - actionItems.length) / totalItems) * 100));

  function renderJobLink(jobId?: string) {
    if (!jobId) return null;
    return (
      <TouchableOpacity style={styles.viewJobRow} onPress={() => router.push(`/job/${jobId}` as any)} activeOpacity={0.7}>
        <View style={styles.linkedBadge}>
          <Feather name="link" size={11} color={colors.primary} />
          <Text style={styles.linkedBadgeText}>Linked</Text>
        </View>
        <Text style={styles.viewJobText}>View job</Text>
        <Feather name="chevron-right" size={15} color={colors.primary} />
      </TouchableOpacity>
    );
  }

  function renderIncidents() {
    if (incidents.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Feather name="alert-triangle" size={28} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No Incident Reports</Text>
          <Text style={styles.emptyDesc}>Report incidents to keep your site safe and maintain compliance.</Text>
          <PressableRow style={styles.emptyButton} onPress={() => setShowIncidentForm(true)}>
            <Feather name="plus" size={14} color={colors.primaryForeground} />
            <Text style={styles.emptyButtonText}>Report Incident</Text>
          </PressableRow>
        </View>
      );
    }
    return incidents.map(report => {
      const severity = SEVERITIES.find(s => s.value === report.severity);
      return (
        <View key={report.id} style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{report.title}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                <View style={[styles.badge, { backgroundColor: colorWithOpacity(severity?.color || colors.warning, 0.12) }]}>
                  <Text style={[styles.badgeText, { color: severity?.color || colors.warning }]}>{report.severity}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: colors.border }]}>
                  <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>{INCIDENT_TYPES.find(t => t.value === report.incidentType)?.label || report.incidentType}</Text>
                </View>
                {report.isNotifiable && (
                  <View style={[styles.badge, { backgroundColor: colorWithOpacity(colors.destructive, 0.12) }]}>
                    <Text style={[styles.badgeText, { color: colors.destructive }]}>Notifiable</Text>
                  </View>
                )}
                <View style={[styles.badge, { backgroundColor: colorWithOpacity(whsConfig.statusColor(report.status), 0.12) }]}>
                  <Text style={[styles.badgeText, { color: whsConfig.statusColor(report.status) }]}>{report.status}</Text>
                </View>
              </View>
              <Text numberOfLines={2} style={[styles.cardSubtext, { marginTop: 6 }]}>{report.description}</Text>
              {report.location && <Text style={styles.cardSubtext}>{report.location}</Text>}
              {renderJobLink(report.jobId)}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {report.status === 'open' && (
                <TouchableOpacity onPress={() => closeIncident(report.id)}>
                  <Feather name="check-circle" size={20} color={colors.success} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => deleteItem('/api/whs/incidents', report.id)}>
                <Feather name="trash-2" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    });
  }

  function renderEmergency() {
    if (emergencyInfo.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Feather name="phone" size={28} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No Emergency Plans</Text>
          <Text style={styles.emptyDesc}>Set up emergency info for your sites including assembly points and first aid.</Text>
          <PressableRow style={styles.emptyButton} onPress={() => setShowEmergencyForm(true)}>
            <Feather name="plus" size={14} color={colors.primaryForeground} />
            <Text style={styles.emptyButtonText}>Add Plan</Text>
          </PressableRow>
        </View>
      );
    }
    return emergencyInfo.map(info => (
      <View key={info.id} style={styles.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <View style={styles.row}>
              <Feather name="home" size={16} color={colors.primary} />
              <Text style={styles.cardTitle}>{info.siteName}</Text>
            </View>
            {info.siteAddress && <Text style={styles.cardSubtext}>{info.siteAddress}</Text>}
          </View>
          <TouchableOpacity onPress={() => deleteItem('/api/whs/emergency-info', info.id)}>
            <Feather name="trash-2" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
        <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
          {info.assemblyPoint && (
            <View style={styles.row}>
              <Feather name="map-pin" size={14} color={whsConfig.emergencyAccent} />
              <Text style={{ fontSize: typography.sizes.sm, color: colors.foreground }}>Assembly: {info.assemblyPoint}</Text>
            </View>
          )}
          {info.firstAidLocation && (
            <View style={styles.row}>
              <Feather name="plus-circle" size={14} color={whsConfig.firstAidKit} />
              <Text style={{ fontSize: typography.sizes.sm, color: colors.foreground }}>First Aid: {info.firstAidLocation}</Text>
            </View>
          )}
          {info.firstAidOfficer && (
            <View style={styles.row}>
              <Feather name="user" size={14} color={whsConfig.firstAider} />
              <Text style={{ fontSize: typography.sizes.sm, color: colors.foreground }}>First Aid Officer: {info.firstAidOfficer} {info.firstAidOfficerPhone ? `(${info.firstAidOfficerPhone})` : ''}</Text>
            </View>
          )}
          {info.nearestHospital && (
            <View style={styles.row}>
              <Feather name="activity" size={14} color={whsConfig.hospital} />
              <Text style={{ fontSize: typography.sizes.sm, color: colors.foreground }}>Hospital: {info.nearestHospital}</Text>
            </View>
          )}
          <View style={[styles.row, { marginTop: spacing.xs }]}>
            <View style={[styles.badge, { backgroundColor: colorWithOpacity(colors.destructive, 0.12) }]}>
              <Text style={[styles.badgeText, { color: colors.destructive }]}>Emergency: {info.emergencyNumber || '000'}</Text>
            </View>
          </View>
        </View>
        {renderJobLink(info.jobId)}
      </View>
    ));
  }

  function renderJsa() {
    if (jsaDocs.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Feather name="clipboard" size={28} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No JSAs Created</Text>
          <Text style={styles.emptyDesc}>Create a Job Safety Analysis before starting work on site.</Text>
          <PressableRow style={styles.emptyButton} onPress={() => setShowJsaForm(true)}>
            <Feather name="plus" size={14} color={colors.primaryForeground} />
            <Text style={styles.emptyButtonText}>Create JSA</Text>
          </PressableRow>
        </View>
      );
    }
    return jsaDocs.map(doc => (
      <View key={doc.id} style={styles.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{doc.title}</Text>
            <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
              <View style={[styles.badge, { backgroundColor: doc.status === 'active' ? colorWithOpacity(colors.success, 0.12) : colors.border }]}>
                <Text style={[styles.badgeText, { color: doc.status === 'active' ? colors.success : colors.mutedForeground }]}>{doc.status}</Text>
              </View>
            </View>
            {doc.siteAddress && <Text style={styles.cardSubtext}>{doc.siteAddress}</Text>}
            {doc.assessedBy && <Text style={styles.cardSubtext}>Assessed by: {doc.assessedBy}</Text>}
          </View>
          <TouchableOpacity onPress={() => deleteItem('/api/whs/jsa', doc.id)}>
            <Feather name="trash-2" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
        {doc.steps && doc.steps.length > 0 && (
          <View style={{ marginTop: spacing.sm }}>
            <Text style={{ fontSize: typography.captionSmall.fontSize, fontWeight: fontWeights.semibold, color: colors.mutedForeground, marginBottom: 4 }}>STEPS ({doc.steps.length})</Text>
            {doc.steps.map((step: any, i: number) => {
              const riskColor = whsConfig.riskColor(step.riskLevel);
              return (
                <View key={step.id || i} style={styles.stepCard}>
                  <View style={styles.stepHeader}>
                    <Text style={{ fontSize: typography.captionSmall.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground }}>Step {i + 1}: {step.taskDescription}</Text>
                    <View style={[styles.badge, { backgroundColor: riskColor + '20', marginBottom: 0 }]}>
                      <Text style={[styles.badgeText, { color: riskColor }]}>{step.riskLevel}</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground }}>Hazards: {step.hazards}</Text>
                  <Text style={{ fontSize: typography.sizes.xs, color: colors.foreground, marginTop: 2 }}>Controls: {step.controlMeasures}</Text>
                </View>
              );
            })}
          </View>
        )}
        {renderJobLink(doc.jobId)}
      </View>
    ));
  }

  function renderEnvironments() {
    if (environments.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Feather name="zap" size={28} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No Hazardous Environments</Text>
          <Text style={styles.emptyDesc}>Track hazardous environments and required PPE for your work sites.</Text>
          <PressableRow style={styles.emptyButton} onPress={() => setShowEnvForm(true)}>
            <Feather name="plus" size={14} color={colors.primaryForeground} />
            <Text style={styles.emptyButtonText}>Add Environment</Text>
          </PressableRow>
        </View>
      );
    }
    return environments.map(env => {
      const envType = envTypes.find((t: any) => t.type === env.environmentType);
      return (
        <View key={env.id} style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={styles.cardTitle}>{envType?.label || env.environmentType}</Text>
            <TouchableOpacity onPress={() => deleteItem('/api/whs/hazardous-environments', env.id)}>
              <Feather name="trash-2" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          {env.hazards?.length > 0 && (
            <View style={{ marginTop: spacing.xs }}>
              <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.semibold, color: colors.mutedForeground }}>HAZARDS</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
                {env.hazards.map((h: string, i: number) => (
                  <View key={i} style={styles.hazardBadge}><Text style={styles.hazardBadgeText}>{h}</Text></View>
                ))}
              </View>
            </View>
          )}
          {env.requiredPpe?.length > 0 && (
            <View style={{ marginTop: spacing.xs }}>
              <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.semibold, color: colors.mutedForeground }}>PPE REQUIRED</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
                {env.requiredPpe.map((p: string, i: number) => (
                  <View key={i} style={styles.ppeBadge}><Text style={styles.ppeBadgeText}>{p}</Text></View>
                ))}
              </View>
            </View>
          )}
        </View>
      );
    });
  }

  function renderSignage() {
    if (signs.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Feather name="eye" size={28} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No Safety Signage</Text>
          <Text style={styles.emptyDesc}>Track safety signage requirements for your work sites.</Text>
          <PressableRow style={styles.emptyButton} onPress={() => setShowSignForm(true)}>
            <Feather name="plus" size={14} color={colors.primaryForeground} />
            <Text style={styles.emptyButtonText}>Add Sign</Text>
          </PressableRow>
        </View>
      );
    }
    const installed = signs.filter(s => s.isInstalled).length;
    return (
      <>
        <View style={[styles.badge, { backgroundColor: colorWithOpacity(colors.info, 0.12), alignSelf: 'flex-start', marginBottom: spacing.sm }]}>
          <Text style={[styles.badgeText, { color: colors.info }]}>{installed}/{signs.length} Installed</Text>
        </View>
        {signs.map(sign => (
          <TouchableOpacity key={sign.id} onPress={() => toggleSignInstalled(sign)} style={styles.signRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: spacing.sm }}>
              <Feather name={sign.isInstalled ? 'check-circle' : 'circle'} size={20} color={sign.isInstalled ? colors.success : colors.mutedForeground} />
              <View>
                <Text style={[{ fontSize: typography.button.fontSize, color: colors.foreground }, sign.isInstalled && { textDecorationLine: 'line-through', color: colors.mutedForeground }]}>{sign.signType}</Text>
                {sign.location && <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground }}>{sign.location}</Text>}
              </View>
            </View>
            <TouchableOpacity onPress={() => deleteItem('/api/whs/safety-signage', sign.id)}>
              <Feather name="trash-2" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </>
    );
  }

  function renderIncidentModal() {
    return (
      <AppBottomSheet visible={showIncidentForm} onDismiss={() => setShowIncidentForm(false)} snapPoints={['90%']} scrollable={false} contentPadding={0}>
        <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowIncidentForm(false)}>
              <Text style={{ fontSize: typography.subtitle.fontSize, color: colors.primary }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Report Incident</Text>
            <TouchableOpacity onPress={submitIncident}>
              <Text style={{ fontSize: typography.subtitle.fontSize, fontWeight: fontWeights.semibold, color: colors.primary }}>Submit</Text>
            </TouchableOpacity>
          </View>
          <BottomSheetScrollView style={styles.modalBody}>
            <Text style={styles.inputLabel}>Title *</Text>
            <TextInput style={styles.input} value={incidentForm.title} onChangeText={v => setIncidentForm(p => ({ ...p, title: v }))} placeholder="What happened?" placeholderTextColor={colors.mutedForeground} />

            <JobLinkField
              value={incidentForm.jobId}
              onChange={id => setIncidentForm(p => ({ ...p, jobId: id }))}
              onJobSelected={job => setIncidentForm(p => ({ ...p, location: p.location || job.address || '' }))}
            />

            <Text style={styles.inputLabel}>Incident Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
              <View style={styles.optionRow}>
                {INCIDENT_TYPES.map(t => (
                  <TouchableOpacity key={t.value} style={[styles.optionChip, incidentForm.incidentType === t.value && styles.optionChipActive]} onPress={() => setIncidentForm(p => ({ ...p, incidentType: t.value }))}>
                    <Text style={[styles.optionChipText, incidentForm.incidentType === t.value && styles.optionChipTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.inputLabel}>Severity</Text>
            <View style={[styles.optionRow, { marginBottom: spacing.md }]}>
              {SEVERITIES.map(s => (
                <TouchableOpacity key={s.value} style={[styles.optionChip, incidentForm.severity === s.value && { backgroundColor: s.color + '30', borderColor: s.color }]} onPress={() => setIncidentForm(p => ({ ...p, severity: s.value }))}>
                  <Text style={[styles.optionChipText, incidentForm.severity === s.value && { color: s.color, fontWeight: fontWeights.semibold }]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Description *</Text>
            <TextInput style={[styles.input, styles.textArea]} value={incidentForm.description} onChangeText={v => setIncidentForm(p => ({ ...p, description: v }))} placeholder="Detailed description..." placeholderTextColor={colors.mutedForeground} multiline />

            <Text style={styles.inputLabel}>Location</Text>
            <TextInput style={styles.input} value={incidentForm.location} onChangeText={v => setIncidentForm(p => ({ ...p, location: v }))} placeholder="Where did it happen?" placeholderTextColor={colors.mutedForeground} />

            <Text style={styles.inputLabel}>Reported To</Text>
            <TextInput style={styles.input} value={incidentForm.reportedTo} onChangeText={v => setIncidentForm(p => ({ ...p, reportedTo: v }))} placeholder="Supervisor/HSR name" placeholderTextColor={colors.mutedForeground} />

            <Text style={styles.inputLabel}>Worker Involved</Text>
            <TextInput style={styles.input} value={incidentForm.workerName} onChangeText={v => setIncidentForm(p => ({ ...p, workerName: v }))} placeholder="Name of worker" placeholderTextColor={colors.mutedForeground} />

            <Text style={styles.inputLabel}>Immediate Actions Taken</Text>
            <TextInput style={[styles.input, styles.textArea]} value={incidentForm.immediateActions} onChangeText={v => setIncidentForm(p => ({ ...p, immediateActions: v }))} placeholder="What was done immediately?" placeholderTextColor={colors.mutedForeground} multiline />

            <TouchableOpacity style={[styles.row, { marginBottom: spacing.xl }]} onPress={() => setIncidentForm(p => ({ ...p, isNotifiable: !p.isNotifiable }))}>
              <Feather name={incidentForm.isNotifiable ? 'check-square' : 'square'} size={20} color={incidentForm.isNotifiable ? colors.primary : colors.mutedForeground} />
              <Text style={{ fontSize: typography.button.fontSize, color: colors.foreground }}>This is a notifiable incident</Text>
            </TouchableOpacity>
          </BottomSheetScrollView>
        </KeyboardAvoidingView>
      </AppBottomSheet>
    );
  }

  function renderEmergencyModal() {
    return (
      <AppBottomSheet
        visible={showEmergencyForm}
        onDismiss={() => setShowEmergencyForm(false)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
        <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowEmergencyForm(false)}>
              <Text style={{ fontSize: typography.subtitle.fontSize, color: colors.primary }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Emergency Plan</Text>
            <TouchableOpacity onPress={submitEmergency}>
              <Text style={{ fontSize: typography.subtitle.fontSize, fontWeight: fontWeights.semibold, color: colors.primary }}>Save</Text>
            </TouchableOpacity>
          </View>
          <BottomSheetScrollView style={styles.modalBody}>
            <Text style={styles.inputLabel}>Site Name *</Text>
            <TextInput style={styles.input} value={emergencyForm.siteName} onChangeText={v => setEmergencyForm(p => ({ ...p, siteName: v }))} placeholder="e.g. 42 Smith St Build" placeholderTextColor={colors.mutedForeground} />

            <JobLinkField
              value={emergencyForm.jobId}
              onChange={id => setEmergencyForm(p => ({ ...p, jobId: id }))}
              onJobSelected={job => setEmergencyForm(p => ({ ...p, siteName: p.siteName || job.title || '', siteAddress: p.siteAddress || job.address || '' }))}
            />

            <Text style={styles.inputLabel}>Site Address</Text>
            <TextInput style={styles.input} value={emergencyForm.siteAddress} onChangeText={v => setEmergencyForm(p => ({ ...p, siteAddress: v }))} placeholder="Full address" placeholderTextColor={colors.mutedForeground} />

            <Text style={styles.inputLabel}>Assembly Point</Text>
            <TextInput style={styles.input} value={emergencyForm.assemblyPoint} onChangeText={v => setEmergencyForm(p => ({ ...p, assemblyPoint: v }))} placeholder="e.g. Front car park" placeholderTextColor={colors.mutedForeground} />

            <Text style={styles.inputLabel}>First Aid Station</Text>
            <TextInput style={styles.input} value={emergencyForm.firstAidLocation} onChangeText={v => setEmergencyForm(p => ({ ...p, firstAidLocation: v }))} placeholder="e.g. Site office" placeholderTextColor={colors.mutedForeground} />

            <Text style={styles.inputLabel}>First Aid Officer</Text>
            <TextInput style={styles.input} value={emergencyForm.firstAidOfficer} onChangeText={v => setEmergencyForm(p => ({ ...p, firstAidOfficer: v }))} placeholder="Officer name" placeholderTextColor={colors.mutedForeground} />

            <Text style={styles.inputLabel}>First Aid Officer Phone</Text>
            <TextInput style={styles.input} value={emergencyForm.firstAidOfficerPhone} onChangeText={v => setEmergencyForm(p => ({ ...p, firstAidOfficerPhone: v }))} placeholder="Phone number" placeholderTextColor={colors.mutedForeground} keyboardType="phone-pad" />

            <Text style={styles.inputLabel}>Emergency Number</Text>
            <TextInput style={styles.input} value={emergencyForm.emergencyNumber} onChangeText={v => setEmergencyForm(p => ({ ...p, emergencyNumber: v }))} placeholderTextColor={colors.mutedForeground} keyboardType="phone-pad" />

            <Text style={styles.inputLabel}>Nearest Hospital</Text>
            <TextInput style={styles.input} value={emergencyForm.nearestHospital} onChangeText={v => setEmergencyForm(p => ({ ...p, nearestHospital: v }))} placeholder="Hospital name" placeholderTextColor={colors.mutedForeground} />
          </BottomSheetScrollView>
        </KeyboardAvoidingView>
      </AppBottomSheet>
    );
  }

  function renderJsaModal() {
    return (
      <AppBottomSheet
        visible={showJsaForm}
        onDismiss={() => setShowJsaForm(false)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
        <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowJsaForm(false)}>
              <Text style={{ fontSize: typography.subtitle.fontSize, color: colors.primary }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New JSA</Text>
            <TouchableOpacity onPress={submitJsa}>
              <Text style={{ fontSize: typography.subtitle.fontSize, fontWeight: fontWeights.semibold, color: colors.primary }}>Create</Text>
            </TouchableOpacity>
          </View>
          <BottomSheetScrollView style={styles.modalBody}>
            <Text style={styles.inputLabel}>Title *</Text>
            <TextInput style={styles.input} value={jsaForm.title} onChangeText={v => setJsaForm(p => ({ ...p, title: v }))} placeholder="e.g. Roof Repair" placeholderTextColor={colors.mutedForeground} />

            <JobLinkField
              value={jsaForm.jobId}
              onChange={id => setJsaForm(p => ({ ...p, jobId: id }))}
              onJobSelected={job => setJsaForm(p => ({ ...p, title: p.title || job.title || '', siteAddress: p.siteAddress || job.address || '' }))}
            />

            <Text style={styles.inputLabel}>Site Address</Text>
            <TextInput style={styles.input} value={jsaForm.siteAddress} onChangeText={v => setJsaForm(p => ({ ...p, siteAddress: v }))} placeholder="Job site address" placeholderTextColor={colors.mutedForeground} />

            <Text style={styles.inputLabel}>Assessed By</Text>
            <TextInput style={styles.input} value={jsaForm.assessedBy} onChangeText={v => setJsaForm(p => ({ ...p, assessedBy: v }))} placeholder="Your name" placeholderTextColor={colors.mutedForeground} />

            <Text style={styles.sectionTitle}>Job Steps</Text>
            {jsaForm.steps.map((step, i) => (
              <View key={i} style={styles.stepCard}>
                <View style={styles.stepHeader}>
                  <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.foreground }}>Step {i + 1}</Text>
                  {jsaForm.steps.length > 1 && (
                    <TouchableOpacity onPress={() => setJsaForm(p => ({ ...p, steps: p.steps.filter((_, idx) => idx !== i) }))}>
                      <Feather name="trash-2" size={16} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  )}
                </View>
                <TextInput style={styles.input} value={step.taskDescription} onChangeText={v => { const s = [...jsaForm.steps]; s[i] = { ...s[i], taskDescription: v }; setJsaForm(p => ({ ...p, steps: s })); }} placeholder="Task description *" placeholderTextColor={colors.mutedForeground} />
                <TextInput style={styles.input} value={step.hazards} onChangeText={v => { const s = [...jsaForm.steps]; s[i] = { ...s[i], hazards: v }; setJsaForm(p => ({ ...p, steps: s })); }} placeholder="Hazards *" placeholderTextColor={colors.mutedForeground} />
                <TextInput style={[styles.input, styles.textArea]} value={step.controlMeasures} onChangeText={v => { const s = [...jsaForm.steps]; s[i] = { ...s[i], controlMeasures: v }; setJsaForm(p => ({ ...p, steps: s })); }} placeholder="Control measures *" placeholderTextColor={colors.mutedForeground} multiline />
                <View style={styles.optionRow}>
                  {['low', 'medium', 'high', 'extreme'].map(level => {
                    const riskColor = whsConfig.riskColor(level);
                    return (
                      <TouchableOpacity key={level} style={[styles.optionChip, step.riskLevel === level && { backgroundColor: riskColor + '30', borderColor: riskColor }]} onPress={() => { const s = [...jsaForm.steps]; s[i] = { ...s[i], riskLevel: level }; setJsaForm(p => ({ ...p, steps: s })); }}>
                        <Text style={[styles.optionChipText, step.riskLevel === level && { color: riskColor, fontWeight: fontWeights.semibold }]}>{level}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
            <TouchableOpacity style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', marginTop: spacing.sm, borderStyle: 'dashed' }} onPress={() => setJsaForm(p => ({ ...p, steps: [...p.steps, { taskDescription: '', hazards: '', riskLevel: 'medium', controlMeasures: '', responsiblePerson: '' }] }))}>
              <Text style={{ color: colors.foreground, fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold }}>+ Add Step</Text>
            </TouchableOpacity>
          </BottomSheetScrollView>
        </KeyboardAvoidingView>
      </AppBottomSheet>
    );
  }

  function renderEnvModal() {
    const envType = envTypes.find((t: any) => t.type === selectedEnvType);
    return (
      <AppBottomSheet
        visible={showEnvForm}
        onDismiss={() => setShowEnvForm(false)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setShowEnvForm(false); setSelectedEnvType(''); }}>
              <Text style={{ fontSize: typography.subtitle.fontSize, color: colors.primary }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Environment</Text>
            <TouchableOpacity onPress={addEnvironment}>
              <Text style={{ fontSize: typography.subtitle.fontSize, fontWeight: fontWeights.semibold, color: selectedEnvType ? colors.primary : colors.mutedForeground }}>Add</Text>
            </TouchableOpacity>
          </View>
          <BottomSheetScrollView style={styles.modalBody}>
            <Text style={styles.inputLabel}>Select Environment Type</Text>
            <View style={{ gap: spacing.xs }}>
              {envTypes.map((t: any) => (
                <TouchableOpacity key={t.type} style={[styles.card, selectedEnvType === t.type && { borderWidth: 2, borderColor: colors.primary }]} onPress={() => setSelectedEnvType(t.type)}>
                  <Text style={[styles.cardTitle, { fontSize: typography.button.fontSize }]}>{t.label}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
                    {t.defaultHazards.slice(0, 3).map((h: string, i: number) => (
                      <View key={i} style={styles.hazardBadge}><Text style={styles.hazardBadgeText}>{h}</Text></View>
                    ))}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            {envType && (
              <View style={{ marginTop: spacing.md }}>
                <Text style={styles.sectionTitle}>Required PPE</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {envType.defaultPpe.map((p: string, i: number) => (
                    <View key={i} style={styles.ppeBadge}><Text style={styles.ppeBadgeText}>{p}</Text></View>
                  ))}
                </View>
              </View>
            )}
          </BottomSheetScrollView>
        </View>
      </AppBottomSheet>
    );
  }

  function renderSignModal() {
    return (
      <AppBottomSheet
        visible={showSignForm}
        onDismiss={() => setShowSignForm(false)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowSignForm(false)}>
              <Text style={{ fontSize: typography.subtitle.fontSize, color: colors.primary }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Sign</Text>
            <TouchableOpacity onPress={addSign}>
              <Text style={{ fontSize: typography.subtitle.fontSize, fontWeight: fontWeights.semibold, color: colors.primary }}>Add</Text>
            </TouchableOpacity>
          </View>
          <BottomSheetScrollView style={styles.modalBody}>
            <Text style={styles.inputLabel}>Category</Text>
            {signTypes.map((cat: any) => (
              <View key={cat.category} style={{ marginBottom: spacing.md }}>
                <TouchableOpacity onPress={() => setSignForm(p => ({ ...p, signCategory: cat.category, signType: '' }))}>
                  <Text style={[styles.sectionTitle, signForm.signCategory === cat.category && { color: colors.primary }]}>{cat.label}</Text>
                </TouchableOpacity>
                {signForm.signCategory === cat.category && (
                  <View style={{ gap: spacing.xs }}>
                    {cat.signs.map((s: string) => (
                      <TouchableOpacity key={s} style={[styles.checkRow, signForm.signType === s && { backgroundColor: colors.primary + '10' }]} onPress={() => setSignForm(p => ({ ...p, signType: s }))}>
                        <View style={styles.row}>
                          <Feather name={signForm.signType === s ? 'check-circle' : 'circle'} size={18} color={signForm.signType === s ? colors.primary : colors.mutedForeground} />
                          <Text style={{ fontSize: typography.button.fontSize, color: colors.foreground }}>{s}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ))}
            <Text style={styles.inputLabel}>Location</Text>
            <TextInput style={styles.input} value={signForm.location} onChangeText={v => setSignForm(p => ({ ...p, location: v }))} placeholder="Where should this sign be?" placeholderTextColor={colors.mutedForeground} />
          </BottomSheetScrollView>
        </View>
      </AppBottomSheet>
    );
  }

  async function submitHazardReport() {
    if (!hazardForm.description || !hazardForm.location || !hazardForm.reportedBy || !hazardForm.recommendedAction) {
      Alert.alert('Required', 'Description, location, reported by, and recommended action are required');
      return;
    }
    try {
      await api.post('/api/whs/hazard-reports', hazardForm);
      setShowHazardForm(false);
      setHazardForm({ description: '', location: '', dateIdentified: new Date().toISOString().split('T')[0], timeIdentified: '', recommendedAction: '', reportedBy: '', supervisorName: '', riskLevel: 'medium', status: 'open', jobId: '' });
      fetchData();
    } catch (e) { Alert.alert('Error', 'Failed to submit hazard report'); }
  }

  async function deleteHazardReport(id: string) {
    confirm({
      title: 'Delete',
      message: 'Delete this hazard report?',
      confirmText: 'Delete',
      destructive: true,
    }).then(async (ok) => {
      if (!ok) return;
      try { await api.delete(`/api/whs/hazard-reports/${id}`); fetchData(); } catch (e) { Alert.alert('Error', 'Failed to delete'); }
    });
  }

  function renderHazardReports() {
    const riskColors: Record<string, string> = { low: colors.success, medium: colors.warning, high: colors.destructive, critical: colors.destructive };
    const statusLabels: Record<string, string> = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' };
    if (hazardReports.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Feather name="file-text" size={28} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No Hazard Reports</Text>
          <Text style={styles.emptyDesc}>Spot a hazard? Report it before someone gets hurt.</Text>
          <PressableRow style={styles.emptyButton} onPress={() => setShowHazardForm(true)}>
            <Feather name="plus" size={14} color={colors.primaryForeground} />
            <Text style={styles.emptyButtonText}>Report Hazard</Text>
          </PressableRow>
        </View>
      );
    }
    return hazardReports.map((h: any) => (
      <View key={h.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: spacing.xs, flexWrap: 'wrap' }}>
              <View style={[styles.badge, { backgroundColor: riskColors[h.riskLevel] || colors.warning }]}>
                <Text style={styles.badgeText}>{h.riskLevel?.toUpperCase()}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: h.status === 'open' ? colors.destructive : h.status === 'resolved' ? colors.success : colors.info }]}>
                <Text style={styles.badgeText}>{statusLabels[h.status] || h.status}</Text>
              </View>
            </View>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>{h.description}</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: spacing.xs, flexWrap: 'wrap' }}>
              <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}><Feather name="map-pin" size={12} /> {h.location}</Text>
              <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>{h.dateIdentified}{h.timeIdentified ? ` at ${h.timeIdentified}` : ''}</Text>
            </View>
            {h.recommendedAction ? <Text style={[styles.cardMeta, { color: colors.foreground, marginTop: 4 }]}>Action: {h.recommendedAction}</Text> : null}
            <Text style={[styles.cardMeta, { color: colors.mutedForeground, marginTop: 2 }]}>By: {h.reportedBy}</Text>
          </View>
          <TouchableOpacity onPress={() => deleteHazardReport(h.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="trash-2" size={18} color={colors.destructive} />
          </TouchableOpacity>
        </View>
        {renderJobLink(h.jobId)}
      </View>
    ));
  }

  function renderHazardModal() {
    const RISK_LEVELS = [
      { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' }, { value: 'critical', label: 'Critical' },
    ];
    return (
      <AppBottomSheet
        visible={showHazardForm}
        onDismiss={() => setShowHazardForm(false)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.cardBorder }]}>
            <TouchableOpacity onPress={() => setShowHazardForm(false)}>
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Report Hazard</Text>
            <TouchableOpacity onPress={submitHazardReport}>
              <Text style={[styles.saveButton, { color: colors.primary }]}>Submit</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1, padding: spacing.md }}>
            <Text style={styles.inputLabel}>Hazard Description *</Text>
            <TextInput style={[styles.input, styles.textArea, { color: colors.foreground, borderColor: colors.cardBorder, backgroundColor: colors.card }]} value={hazardForm.description} onChangeText={v => setHazardForm(p => ({ ...p, description: v }))} placeholder="Briefly describe the hazard..." placeholderTextColor={colors.mutedForeground} multiline numberOfLines={3} />

            <Text style={styles.inputLabel}>Location *</Text>
            <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.cardBorder, backgroundColor: colors.card }]} value={hazardForm.location} onChangeText={v => setHazardForm(p => ({ ...p, location: v }))} placeholder="Where is the hazard located?" placeholderTextColor={colors.mutedForeground} />

            <JobLinkField
              value={hazardForm.jobId}
              onChange={id => setHazardForm(p => ({ ...p, jobId: id }))}
              onJobSelected={job => setHazardForm(p => ({ ...p, location: p.location || job.address || '' }))}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Date Identified</Text>
                <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.cardBorder, backgroundColor: colors.card }]} value={hazardForm.dateIdentified} onChangeText={v => setHazardForm(p => ({ ...p, dateIdentified: v }))} placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedForeground} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Time</Text>
                <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.cardBorder, backgroundColor: colors.card }]} value={hazardForm.timeIdentified} onChangeText={v => setHazardForm(p => ({ ...p, timeIdentified: v }))} placeholder="e.g. 10am" placeholderTextColor={colors.mutedForeground} />
              </View>
            </View>

            <Text style={styles.inputLabel}>Recommended Action *</Text>
            <TextInput style={[styles.input, styles.textArea, { color: colors.foreground, borderColor: colors.cardBorder, backgroundColor: colors.card }]} value={hazardForm.recommendedAction} onChangeText={v => setHazardForm(p => ({ ...p, recommendedAction: v }))} placeholder="How would you eliminate or minimise the risk?" placeholderTextColor={colors.mutedForeground} multiline numberOfLines={3} />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Reported By *</Text>
                <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.cardBorder, backgroundColor: colors.card }]} value={hazardForm.reportedBy} onChangeText={v => setHazardForm(p => ({ ...p, reportedBy: v }))} placeholder="Your name" placeholderTextColor={colors.mutedForeground} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Supervisor</Text>
                <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.cardBorder, backgroundColor: colors.card }]} value={hazardForm.supervisorName} onChangeText={v => setHazardForm(p => ({ ...p, supervisorName: v }))} placeholder="Supervisor name" placeholderTextColor={colors.mutedForeground} />
              </View>
            </View>

            <Text style={styles.inputLabel}>Risk Level</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: spacing.md }}>
              {RISK_LEVELS.map(r => (
                <TouchableOpacity key={r.value} onPress={() => setHazardForm(p => ({ ...p, riskLevel: r.value }))}
                  style={[styles.chipButton, { borderColor: hazardForm.riskLevel === r.value ? colors.primary : colors.cardBorder, backgroundColor: hazardForm.riskLevel === r.value ? colors.primaryLight : colors.card }]}>
                  <Text style={{ color: hazardForm.riskLevel === r.value ? colors.primary : colors.foreground, fontSize: typography.sizes.sm }}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </AppBottomSheet>
    );
  }

  async function submitPpeChecklist() {
    if (!ppeForm.workerName) { Alert.alert('Required', 'Worker name is required'); return; }
    try {
      const allCorrect = PPE_ITEMS.every(p => ppeForm[p.key]);
      await api.post('/api/whs/ppe-checklists', { ...ppeForm, allCorrect });
      setShowPpeForm(false);
      setPpeForm({ workerName: '', date: new Date().toISOString().split('T')[0], hardHat: false, hiVis: false, safetyBoots: false, safetyGlasses: false, hearingProtection: false, gloves: false, sunscreen: false, respirator: false, safetyHarness: false, otherPpe: '', supervisorName: '', notes: '' });
      fetchData();
    } catch (e: any) { Alert.alert('Error', e.message || 'Failed to save PPE checklist'); }
  }

  async function deletePpeChecklist(id: string) {
    try { await api.delete(`/api/whs/ppe-checklists/${id}`); fetchData(); } catch (e) { Alert.alert('Error', 'Failed to delete'); }
  }

  async function submitTrainingRecord() {
    if (!trainingForm.workerName || !trainingForm.courseCode || !trainingForm.completionDate) {
      Alert.alert('Required', 'Worker name, course, and completion date are required'); return;
    }
    try {
      await api.post('/api/whs/training-records', trainingForm);
      setShowTrainingForm(false);
      setTrainingForm({ workerName: '', courseCode: 'CPCCWHS1001', courseName: 'White Card', rtoName: '', completionDate: '', expiryDate: '', certificateNumber: '', status: 'current', notes: '' });
      fetchData();
    } catch (e: any) { Alert.alert('Error', e.message || 'Failed to save training record'); }
  }

  async function deleteTrainingRecord(id: string) {
    try { await api.delete(`/api/whs/training-records/${id}`); fetchData(); } catch (e) { Alert.alert('Error', 'Failed to delete'); }
  }

  function renderPpeChecklists() {
    if (ppeChecklists.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Feather name="check-square" size={28} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No PPE Check-ins</Text>
          <Text style={styles.emptyDesc}>Start a daily PPE check-in to verify workers have proper safety gear.</Text>
          <PressableRow style={styles.emptyButton} onPress={() => setShowPpeForm(true)}>
            <Feather name="plus" size={14} color={colors.primaryForeground} />
            <Text style={styles.emptyButtonText}>Start Check-in</Text>
          </PressableRow>
        </View>
      );
    }
    return ppeChecklists.map((c: any) => {
      const count = PPE_ITEMS.filter(p => c[p.key]).length;
      return (
        <View key={c.id} style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{c.workerName}</Text>
              <Text style={styles.cardSubtext}>{c.date}{c.supervisorName ? ` — ${c.supervisorName}` : ''}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: c.allCorrect ? colorWithOpacity(colors.success, 0.15) : colorWithOpacity(colors.destructive, 0.15) }]}>
              <Text style={[styles.badgeText, { color: c.allCorrect ? colors.success : colors.destructive }]}>{count}/{PPE_ITEMS.length}</Text>
            </View>
            <TouchableOpacity onPress={() => deletePpeChecklist(c.id)} style={{ marginLeft: spacing.sm }}>
              <Feather name="trash-2" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.xs }}>
            {PPE_ITEMS.map(p => (
              <View key={p.key} style={[styles.ppeBadge, { backgroundColor: c[p.key] ? colorWithOpacity(colors.success, 0.12) : colorWithOpacity(colors.destructive, 0.08) }]}>
                <Text style={[styles.ppeBadgeText, { color: c[p.key] ? colors.success : colors.destructive }]}>
                  {c[p.key] ? '\u2713' : '\u2717'} {p.label}
                </Text>
              </View>
            ))}
          </View>
          {c.notes ? <Text style={[styles.cardSubtext, { marginTop: 4 }]}>{c.notes}</Text> : null}
        </View>
      );
    });
  }

  function renderPpeModal() {
    return (
      <AppBottomSheet
        visible={showPpeForm}
        onDismiss={() => setShowPpeForm(false)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowPpeForm(false)}><Feather name="x" size={24} color={colors.foreground} /></TouchableOpacity>
            <Text style={styles.modalTitle}>PPE Check-in</Text>
            <TouchableOpacity onPress={submitPpeChecklist}><Text style={[styles.saveButton, { color: colors.primary }]}>Save</Text></TouchableOpacity>
          </View>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <BottomSheetScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Worker Name *</Text>
              <TextInput style={styles.input} value={ppeForm.workerName} onChangeText={(t) => setPpeForm({ ...ppeForm, workerName: t })} placeholder="Worker name" placeholderTextColor={colors.mutedForeground} />

              <Text style={styles.inputLabel}>Date</Text>
              <TextInput style={styles.input} value={ppeForm.date} onChangeText={(t) => setPpeForm({ ...ppeForm, date: t })} placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedForeground} />

              <Text style={styles.inputLabel}>PPE Items — tick what is worn correctly</Text>
              {PPE_ITEMS.map(item => (
                <TouchableOpacity key={item.key} style={styles.checkRow} onPress={() => setPpeForm({ ...ppeForm, [item.key]: !ppeForm[item.key] })}>
                  <Text style={{ color: colors.foreground, fontSize: typography.button.fontSize }}>{item.label}</Text>
                  <Feather name={ppeForm[item.key] ? 'check-square' : 'square'} size={20} color={ppeForm[item.key] ? colors.primary : colors.mutedForeground} />
                </TouchableOpacity>
              ))}

              <Text style={[styles.inputLabel, { marginTop: spacing.md }]}>Other PPE</Text>
              <TextInput style={styles.input} value={ppeForm.otherPpe} onChangeText={(t) => setPpeForm({ ...ppeForm, otherPpe: t })} placeholder="Any additional PPE..." placeholderTextColor={colors.mutedForeground} />

              <Text style={styles.inputLabel}>Supervisor Name</Text>
              <TextInput style={styles.input} value={ppeForm.supervisorName} onChangeText={(t) => setPpeForm({ ...ppeForm, supervisorName: t })} placeholder="Supervisor who verified" placeholderTextColor={colors.mutedForeground} />

              <Text style={styles.inputLabel}>Notes</Text>
              <TextInput style={[styles.input, styles.textArea]} value={ppeForm.notes} onChangeText={(t) => setPpeForm({ ...ppeForm, notes: t })} placeholder="Issues or observations..." placeholderTextColor={colors.mutedForeground} multiline />

              <View style={{ height: 60 }} />
            </BottomSheetScrollView>
          </KeyboardAvoidingView>
        </View>
      </AppBottomSheet>
    );
  }

  function renderTrainingRecords() {
    if (trainingRecords.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Feather name="award" size={28} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No Training Records</Text>
          <Text style={styles.emptyDesc}>Track White Cards, licences, first aid certs, and other qualifications.</Text>
          <TouchableOpacity style={styles.emptyButton} onPress={() => setShowTrainingForm(true)}>
            <Feather name="plus" size={14} color={colors.primaryForeground} />
            <Text style={styles.emptyButtonText}>Add Record</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return trainingRecords.map((r: any) => {
      const statusColor = whsConfig.trainingStatusColor(r.status);
      const statusLabel = r.status === 'current' ? 'Current' : r.status === 'expired' ? 'Expired' : 'Expiring Soon';
      return (
        <View key={r.id} style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{r.workerName}</Text>
              <Text style={[styles.cardMeta, { color: colors.primary, fontWeight: fontWeights.semibold }]}>{r.courseCode} — {r.courseName}</Text>
              <Text style={[styles.cardSubtext]}>
                {r.rtoName ? `${r.rtoName} | ` : ''}Completed: {r.completionDate}
                {r.expiryDate ? ` | Expires: ${r.expiryDate}` : ''}
              </Text>
              {r.certificateNumber ? <Text style={[styles.cardSubtext]}>Cert #: {r.certificateNumber}</Text> : null}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <View style={[styles.badge, { backgroundColor: `${statusColor}20` }]}>
                <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
              </View>
              <TouchableOpacity onPress={() => deleteTrainingRecord(r.id)}>
                <Feather name="trash-2" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>
          {r.notes ? <Text style={[styles.cardSubtext, { marginTop: 4 }]}>{r.notes}</Text> : null}
        </View>
      );
    });
  }

  function renderTrainingModal() {
    return (
      <AppBottomSheet
        visible={showTrainingForm}
        onDismiss={() => setShowTrainingForm(false)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowTrainingForm(false)}><Feather name="x" size={24} color={colors.foreground} /></TouchableOpacity>
            <Text style={styles.modalTitle}>Add Training Record</Text>
            <TouchableOpacity onPress={submitTrainingRecord}><Text style={[styles.saveButton, { color: colors.primary }]}>Save</Text></TouchableOpacity>
          </View>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <BottomSheetScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Worker Name *</Text>
              <TextInput style={styles.input} value={trainingForm.workerName} onChangeText={(t) => setTrainingForm({ ...trainingForm, workerName: t })} placeholder="Worker name" placeholderTextColor={colors.mutedForeground} />

              <Text style={styles.inputLabel}>Course</Text>
              <View style={styles.optionRow}>
                {COMMON_COURSES.map(c => (
                  <TouchableOpacity key={c.code} style={[styles.optionChip, trainingForm.courseCode === c.code && styles.optionChipActive]}
                    onPress={() => setTrainingForm({ ...trainingForm, courseCode: c.code, courseName: c.name })}>
                    <Text style={[styles.optionChipText, trainingForm.courseCode === c.code && styles.optionChipTextActive]}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Course Code *</Text>
              <TextInput style={styles.input} value={trainingForm.courseCode} onChangeText={(t) => setTrainingForm({ ...trainingForm, courseCode: t })} placeholder="e.g. CPCCWHS1001" placeholderTextColor={colors.mutedForeground} />

              <Text style={styles.inputLabel}>Course Name *</Text>
              <TextInput style={styles.input} value={trainingForm.courseName} onChangeText={(t) => setTrainingForm({ ...trainingForm, courseName: t })} placeholder="Course name" placeholderTextColor={colors.mutedForeground} />

              <Text style={styles.inputLabel}>RTO / Training Provider</Text>
              <TextInput style={styles.input} value={trainingForm.rtoName} onChangeText={(t) => setTrainingForm({ ...trainingForm, rtoName: t })} placeholder="e.g. Blue Dog Training" placeholderTextColor={colors.mutedForeground} />

              <Text style={styles.inputLabel}>Completion Date *</Text>
              <TextInput style={styles.input} value={trainingForm.completionDate} onChangeText={(t) => setTrainingForm({ ...trainingForm, completionDate: t })} placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedForeground} />

              <Text style={styles.inputLabel}>Expiry Date</Text>
              <TextInput style={styles.input} value={trainingForm.expiryDate} onChangeText={(t) => setTrainingForm({ ...trainingForm, expiryDate: t })} placeholder="YYYY-MM-DD (if applicable)" placeholderTextColor={colors.mutedForeground} />

              <Text style={styles.inputLabel}>Certificate Number</Text>
              <TextInput style={styles.input} value={trainingForm.certificateNumber} onChangeText={(t) => setTrainingForm({ ...trainingForm, certificateNumber: t })} placeholder="Certificate or licence number" placeholderTextColor={colors.mutedForeground} />

              <Text style={styles.inputLabel}>Status</Text>
              <View style={styles.optionRow}>
                {[{ value: 'current', label: 'Current' }, { value: 'expiring_soon', label: 'Expiring Soon' }, { value: 'expired', label: 'Expired' }].map(s => (
                  <TouchableOpacity key={s.value} style={[styles.optionChip, trainingForm.status === s.value && styles.optionChipActive]}
                    onPress={() => setTrainingForm({ ...trainingForm, status: s.value })}>
                    <Text style={[styles.optionChipText, trainingForm.status === s.value && styles.optionChipTextActive]}>{s.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Notes</Text>
              <TextInput style={[styles.input, styles.textArea]} value={trainingForm.notes} onChangeText={(t) => setTrainingForm({ ...trainingForm, notes: t })} placeholder="Additional notes..." placeholderTextColor={colors.mutedForeground} multiline />

              <View style={{ height: 60 }} />
            </BottomSheetScrollView>
          </KeyboardAvoidingView>
        </View>
      </AppBottomSheet>
    );
  }

  const showFab = !showIncidentForm && !showEmergencyForm && !showJsaForm && !showEnvForm && !showSignForm && !showHazardForm && !showPpeForm && !showTrainingForm;
  const tabActionLabel: Record<TabKey, string> = {
    incidents: 'New Report',
    emergency: 'Add Plan',
    jsa: 'New JSA',
    environments: 'Add Hazard',
    signage: 'Add Sign',
    hazard_reports: 'New Report',
    ppe: 'New Checklist',
    training: 'Add Record',
  };

  const fabAction = () => {
    switch (activeTab) {
      case 'incidents': setShowIncidentForm(true); break;
      case 'emergency': setShowEmergencyForm(true); break;
      case 'jsa': setShowJsaForm(true); break;
      case 'environments': setShowEnvForm(true); break;
      case 'signage': setShowSignForm(true); break;
      case 'hazard_reports': setShowHazardForm(true); break;
      case 'ppe': setShowPpeForm(true); break;
      case 'training': setShowTrainingForm(true); break;
    }
  };

  const tabFullLabel: Record<TabKey, string> = {
    incidents: 'Incidents',
    emergency: 'Emergency Plans',
    jsa: 'Job Safety Analyses',
    environments: 'Hazardous Environments',
    signage: 'Safety Signage',
    hazard_reports: 'Hazard Reports',
    ppe: 'PPE Checklists',
    training: 'Training Records',
  };

  const tabCounts: Record<TabKey, number> = {
    incidents: incidents.length,
    emergency: emergencyInfo.length,
    jsa: jsaDocs.length,
    environments: environments.length,
    signage: signs.length,
    hazard_reports: hazardReports.length,
    ppe: ppeChecklists.length,
    training: trainingRecords.length,
  };

  const activeTabMeta = TABS.find(t => t.key === activeTab) || TABS[0];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.mutedForeground, fontSize: typography.button.fontSize }}>Loading safety data...</Text>
        </View>
      ) : (
        <>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: bottomNavHeight }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            keyboardShouldPersistTaps="handled"
            stickyHeaderIndices={[1]}
          >
            <View style={styles.heroSection}>
              <View style={styles.heroTitleRow}>
                <View style={styles.heroTitleText}>
                  <Text style={styles.pageTitle}>WHS Safety</Text>
                  <Text style={styles.pageSubtitle}>
                    Incidents, JSAs & site compliance all in one place.
                  </Text>
                </View>
              </View>

              <View style={styles.statsRow}>
                {[
                  { icon: 'alert-triangle' as const, value: openIncidents, label: 'Open', color: openIncidents > 0 ? colors.destructive : colors.success, tab: 'incidents' as TabKey },
                  { icon: 'phone' as const, value: emergencyInfo.length, label: 'Plans', color: colors.primary, tab: 'emergency' as TabKey },
                  { icon: 'clipboard' as const, value: jsaDocs.length, label: 'JSAs', color: colors.primary, tab: 'jsa' as TabKey },
                  { icon: 'award' as const, value: trainingRecords.length, label: 'Training', color: colors.info, tab: 'training' as TabKey },
                ].map((stat, idx) => (
                  <TouchableOpacity key={idx} style={styles.statCard} onPress={() => setActiveTab(stat.tab)} activeOpacity={0.7}>
                    <View style={[styles.statIcon, { backgroundColor: `${stat.color}15` }]}>
                      <Feather name={stat.icon} size={16} color={stat.color} />
                    </View>
                    <Text style={styles.statValue}>{stat.value}</Text>
                    <Text style={styles.statLabel}>{stat.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {actionItems.length > 0 && (
                <View style={styles.actionBanner}>
                  <View style={styles.actionBannerHeader}>
                    <View style={[styles.actionBannerIcon, { backgroundColor: actionItems[0].color + '15' }]}>
                      <Feather name="alert-circle" size={14} color={actionItems[0].color} />
                    </View>
                    <Text style={styles.actionBannerTitle}>
                      {actionItems.length} item{actionItems.length > 1 ? 's' : ''} need{actionItems.length === 1 ? 's' : ''} attention
                    </Text>
                  </View>
                  {actionItems.slice(0, 3).map((item, idx) => (
                    <TouchableOpacity key={idx} style={styles.actionItem} onPress={() => setActiveTab(item.tab)} activeOpacity={0.7}>
                      <Feather name={item.icon} size={13} color={item.color} />
                      <Text style={styles.actionItemText}>{item.text}</Text>
                      <Feather name="chevron-right" size={13} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  ))}
                  {actionItems.length > 3 && (
                    <Text style={styles.actionMoreText}>+{actionItems.length - 3} more</Text>
                  )}
                  {!hasComplianceBaseline && (
                    <Text style={[styles.actionItemText, { paddingHorizontal: spacing.sm, paddingTop: 4 }]}>
                      Add at least {MIN_SETUP_FOR_SCORE} categories to unlock your compliance score.
                    </Text>
                  )}
                </View>
              )}

              {!hasComplianceBaseline && actionItems.length === 0 && (
                <View style={[styles.actionBanner, { borderColor: colorWithOpacity(colors.warning, 0.25) }]}>
                  <View style={styles.actionBannerHeader}>
                    <View style={[styles.actionBannerIcon, { backgroundColor: colorWithOpacity(colors.warning, 0.12) }]}>
                      <Feather name="alert-circle" size={14} color={colors.warning} />
                    </View>
                    <Text style={styles.actionBannerTitle}>
                      Setup needed — {setupCategoriesPopulated}/{SETUP_CATEGORIES_TOTAL} safety categories started
                    </Text>
                  </View>
                  <Text style={[styles.actionItemText, { paddingHorizontal: spacing.sm, paddingTop: 4 }]}>
                    Add at least {MIN_SETUP_FOR_SCORE} categories to unlock your compliance score.
                  </Text>
                </View>
              )}

              {hasComplianceBaseline && actionItems.length === 0 && (
                <View style={styles.complianceBanner}>
                  <View style={[styles.actionBannerIcon, { backgroundColor: colorWithOpacity(colors.success, 0.12) }]}>
                    <Feather name="check-circle" size={14} color={colors.success} />
                  </View>
                  <Text style={styles.complianceBannerText}>
                    All clear — {complianceScore}% compliant, no outstanding items
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.stickyBar}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
              >
                {TABS.map(tab => (
                  <TouchableOpacity
                    key={tab.key}
                    style={[styles.filterChip, activeTab === tab.key && styles.filterChipActive]}
                    onPress={() => setActiveTab(tab.key)}
                  >
                    <Feather name={tab.icon} size={14} color={activeTab === tab.key ? colors.primaryForeground : colors.mutedForeground} />
                    <Text style={[styles.filterChipText, activeTab === tab.key && styles.filterChipTextActive]} numberOfLines={1}>{tab.label}</Text>
                    <View style={[styles.chipCount, activeTab === tab.key && styles.chipCountActive]}>
                      <Text style={[styles.chipCountText, activeTab === tab.key && styles.chipCountTextActive]}>{tabCounts[tab.key]}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.catHeader}>
                <View style={styles.catHeaderLeft}>
                  <Feather name={activeTabMeta.icon} size={18} color={colors.primary} />
                  <Text style={styles.catTitle} numberOfLines={1}>{tabFullLabel[activeTab]}</Text>
                  <View style={styles.catCountBadge}>
                    <Text style={styles.catCountText}>{tabCounts[activeTab]}</Text>
                  </View>
                </View>
                <PressableRow style={styles.catAddButton} onPress={fabAction}>
                  <Feather name="plus" size={15} color={colors.primaryForeground} />
                  <Text style={styles.catAddText}>{tabActionLabel[activeTab]}</Text>
                </PressableRow>
              </View>
            </View>

            <View style={styles.listSection}>
              {activeTab === 'incidents' && renderIncidents()}
              {activeTab === 'emergency' && renderEmergency()}
              {activeTab === 'jsa' && renderJsa()}
              {activeTab === 'environments' && renderEnvironments()}
              {activeTab === 'signage' && renderSignage()}
              {activeTab === 'hazard_reports' && renderHazardReports()}
              {activeTab === 'ppe' && renderPpeChecklists()}
              {activeTab === 'training' && renderTrainingRecords()}
            </View>
          </ScrollView>

        </>
      )}

      {renderIncidentModal()}
      {renderEmergencyModal()}
      {renderJsaModal()}
      {renderEnvModal()}
      {renderSignModal()}
      {renderHazardModal()}
      {renderPpeModal()}
      {renderTrainingModal()}
    </View>
  );
}
