import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Linking,
  RefreshControl,
  Platform,
  Modal,
  TextInput,
  Image,
  FlatList,
  Switch,
  KeyboardAvoidingView,
  Dimensions,
  Animated,
  Easing,
  AppState,
  AppStateStatus,
  ActionSheetIOS,
  InteractionManager,
  LayoutAnimation,
} from 'react-native';
import { Alert } from '@/lib/alert';
import LiveActivity from '../../modules/LiveActivity/src';
import { PressableRow } from '@/components/ui/PressableRow';
import { useConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useActionSheet } from '@/components/ui/ActionSheet';
import { usePreserveScrollOnFold } from '@/hooks/usePreserveScrollOnFold';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { WebView } from 'react-native-webview';
import { Slider } from '../../src/components/ui/Slider';
import { useLocalSearchParams, router, Stack, useFocusEffect } from 'expo-router';
import { GlassButton } from '../../src/components/ui/GlassButton';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { getDocumentPicker } from '../../src/lib/document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Location from 'expo-location';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import api, { API_URL, isAuthErrorMessage } from '../../src/lib/api';
import { maybeRequestReview } from '../../src/lib/store-review';
import { locationTracking } from '../../src/lib/location-tracking';
import { useJobsStore, useTimeTrackingStore, useAuthStore } from '../../src/lib/store';
import { Button } from '../../src/components/ui/Button';
import { SheetButton } from '../../src/components/ui/SheetButton';
import { AIPhotoAnalysisModal } from '../../src/components/AIPhotoAnalysis';
import { StatusBadge } from '../../src/components/ui/StatusBadge';
import { useTheme, ThemeColors, colorWithOpacity } from '../../src/lib/theme';
import { AppBottomSheet } from '../../src/components/ui/AppBottomSheet';
import { BottomSheetScrollView } from '../../src/components/ui/AppBottomSheet';
import { MobileSendModal } from '../../src/components/MobileSendModal';
import { fontWeights, spacing, radius, shadows, iconSizes, typography, pageShell } from '../../src/lib/design-tokens';
import { getAvatarColor } from '../../src/lib/avatar-colors';
import { TeamAvatar } from '../../src/components/TeamAvatar';
import { WorkspaceSwitcher } from '../../src/components/WorkspaceSwitcher';
import { VoiceRecorder, VoiceNotePlayer } from '../../src/components/VoiceRecorder';
import { SignaturePad } from '../../src/components/SignaturePad';
import { JobForms } from '../../src/components/FormRenderer';
import { JobTasksSection } from '../../src/components/JobTasksSection';
import SmartActionsPanel, { SmartAction, getJobSmartActions } from '../../src/components/SmartActionsPanel';
import { JobProgressBar, LinkedDocumentsCard, NextActionCard, PaymentCollectionCard } from '../../src/components/JobWorkflowComponents';
import { CollapsibleSection } from '../../src/components/ui/CollapsibleSection';
import { PhotoAnnotationEditor } from '../../src/components/PhotoAnnotationEditor';
import offlineStorage, { useOfflineStore } from '../../src/lib/offline-storage';
import { getJobUrgency } from '../../src/lib/jobUrgency';
import { useIntegrationHealth } from '../../src/hooks/useIntegrationHealth';
import { getBottomNavHeight } from '../../src/components/BottomNav';
import { showToast } from '../../src/lib/toast';
import { SignatureSection } from '../../src/components/jobDetail/SignatureSection';
import { SwmsSection } from '../../src/components/jobDetail/SwmsSection';
import { ChatSection } from '../../src/components/jobDetail/ChatSection';
import { MaterialsSection } from '../../src/components/jobDetail/MaterialsSection';
import { PhotosSection } from '../../src/components/jobDetail/PhotosSection';

interface JobNoteItem {
  id: string;
  content: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
}

interface Job {
  id: string;
  userId?: string;
  title: string;
  description?: string;
  address?: string;
  latitude?: string;
  longitude?: string;
  status: 'pending' | 'scheduled' | 'in_progress' | 'done' | 'invoiced';
  scheduledAt?: string;
  clientId?: string;
  assignedTo?: string;
  notes?: string;
  estimatedHours?: number;
  estimatedCost?: number;
  estimatedDuration?: number;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  completedAt?: string;
  workerStatus?: string;
  isRecurring?: boolean;
  recurrencePattern?: string;
  nextRecurrenceDate?: string | null;
  recurrenceEndDate?: string | null;
  isXeroImport?: boolean;
  clientName?: string;
  geofenceEnabled?: boolean;
  geofenceRadius?: number;
  geofenceAutoClockIn?: boolean;
  geofenceAutoClockOut?: boolean;
  portalEnabled?: boolean;
}

interface Invoice {
  id: string;
  number: string;
  title: string;
  description?: string;
  terms?: string;
  total: number;
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'partial';
  dueDate?: string;
  paidAmount?: number;
  isRecurring?: boolean;
  recurrencePattern?: string | null;
  recurrenceEndDate?: string | null;
}

interface Quote {
  id: string;
  number: string;
  title: string;
  total: number;
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired';
}

interface LinkedReceipt {
  id: string;
  receiptNumber?: string;
  amount: number;
  paymentMethod?: string;
  createdAt?: string;
}

interface JobMaterial {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  unitPrice?: number;
  markupPercent?: number;
  supplier?: string;
  category?: string;
  status?: string;
}

const MATERIAL_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  needed: { bg: '#FEF3C7', text: '#92400E' },
  ordered: { bg: '#DBEAFE', text: '#1E40AF' },
  shipped: { bg: '#EDE9FE', text: '#6D28D9' },
  received: { bg: '#D1FAE5', text: '#065F46' },
  installed: { bg: '#A7F3D0', text: '#047857' },
};

const MATERIAL_STATUS_OPTIONS = ['needed', 'ordered', 'shipped', 'received', 'installed'] as const;

interface TeamMember {
  id: string;
  name: string;
  email?: string;
  role?: string;
  memberId?: string;
  userId?: string;
  themeColor?: string;
}

interface JobChatMessage {
  id: string;
  message: string;
  createdAt: string;
  senderName?: string;
  userId?: string;
  chatType?: string;
}

// TTL for offline snapshots of job sub-resources (materials, team, assignments)
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

interface JobPhoto {
  id: string;
  url?: string;
  signedUrl?: string;
  thumbnailUrl?: string;
  caption?: string;
  createdAt?: string;
  fileName?: string;
  category?: string;
  takenAt?: string;
  mimeType?: string;
}

const isVideo = (photo: JobPhoto) => {
  const mimeType = photo.mimeType || '';
  const fileName = photo.fileName?.toLowerCase() || '';
  const ext = fileName.split('.').pop() || '';
  return mimeType.startsWith('video/') || ['mp4', 'mov', 'avi', 'webm', 'm4v', '3gp'].includes(ext);
};

interface CompletedTimeEntry {
  id: string;
  userId: string;
  jobId?: string;
  description?: string;
  startTime: string;
  endTime?: string;
  notes?: string;
  userName?: string;
  hourlyRate?: string;
  isBreak?: boolean;
  isPaused?: boolean;
}

interface ActivityItem {
  id: string;
  type: string;
  description: string;
  createdAt: string;
  userId?: string;
  userName?: string;
  title?: string;
}

interface VoiceNote {
  id: string;
  fileName: string;
  duration: number | null;
  title: string | null;
  transcription: string | null;
  summary?: string | null;
  createdAt: string | null;
  signedUrl?: string;
}

interface DigitalSignature {
  id: string;
  signerName: string;
  signerEmail?: string;
  signatureData: string;
  signedAt: string;
  documentType: string;
  signerRole?: 'client' | 'worker' | 'owner';
}

interface JobExpense {
  id: string;
  categoryId: string;
  categoryName?: string;
  amount: string;
  gstAmount?: string;
  description: string;
  vendor?: string;
  expenseDate: string;
  isBillable: boolean;
}

interface JobDocument {
  id: string;
  jobId: string;
  title: string;
  documentType?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  fileUrl?: string | null;
  createdAt?: string;
  objectStorageKey: string;
}

interface SubcontractorToken {
  id: string;
  jobId: string;
  token: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  permissions: string[];
  status: string;
  currentStatus?: string;
  expiresAt?: string;
  createdAt?: string;
  noteCount?: number;
  photoCount?: number;
  notes?: { content?: string; createdAt?: string }[];
  photos?: { url?: string; caption?: string; category?: string; createdAt?: string }[];
}

interface SwmsDocument {
  id: string;
  title: string;
  description?: string;
  jobId?: string;
  siteAddress?: string;
  workActivityDescription?: string;
  ppeRequirements?: string[];
  emergencyContact?: string;
  firstAidLocation?: string;
  status?: string;
  createdAt?: string;
  hazardCount?: number;
  signatureCount?: number;
  hazards?: SwmsHazard[];
  signatures?: SwmsSignature[];
}

interface SwmsHazard {
  id: string;
  hazardDescription: string;
  riskConsequence?: string;
  riskLikelihood?: string;
  riskRating?: string;
  controlMeasures?: string;
  responsiblePerson?: string;
}

interface SwmsSignature {
  id: string;
  workerName: string;
  signedAt?: string;
  address?: string;
}

interface SwmsTemplate {
  id: string;
  title: string;
  description?: string;
  hazards?: SwmsHazard[];
  ppeRequirements?: string[];
  workActivityDescription?: string;
}

const PPE_OPTIONS: { key: string; label: string; icon: string }[] = [
  { key: 'hard_hat', label: 'Hard Hat', icon: 'hard-hat' },
  { key: 'safety_glasses', label: 'Safety Glasses', icon: 'eye' },
  { key: 'hi_vis', label: 'Hi-Vis Vest', icon: 'sun' },
  { key: 'steel_caps', label: 'Steel Caps', icon: 'anchor' },
  { key: 'hearing_protection', label: 'Hearing Protection', icon: 'volume-x' },
  { key: 'dust_mask', label: 'Dust Mask', icon: 'wind' },
  { key: 'gloves', label: 'Gloves', icon: 'hand' },
  { key: 'fall_harness', label: 'Fall Harness', icon: 'link' },
  { key: 'face_shield', label: 'Face Shield', icon: 'shield' },
  { key: 'sun_protection', label: 'Sun Protection', icon: 'sun' },
];

const STATUS_ACTIONS = {
  pending: { next: 'scheduled', label: 'Schedule Job', icon: 'calendar' as const, iconSize: 20 },
  scheduled: { next: 'in_progress', label: 'Start Job', icon: 'play' as const, iconSize: 20 },
  in_progress: { next: 'done', label: 'Complete Job', icon: 'check-circle' as const, iconSize: 20 },
  done: { next: 'invoiced', label: 'Create Invoice', icon: 'file-text' as const, iconSize: 20 },
  invoiced: null,
};

// hint: Logic changed on both sides. Requires understanding intent of each change.
const createStyles = (colors: ThemeColors, bottomNavHeight: number = 0) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: pageShell.paddingHorizontal,
    paddingTop: pageShell.paddingTop,
    paddingBottom: pageShell.paddingBottom,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  errorText: {
    color: colors.foreground,
    fontSize: typography.sizes.lg,
    fontWeight: fontWeights.medium,
    marginBottom: spacing.md,
  },
  errorButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderRadius: radius.md,
  },
  errorButtonText: {
    color: colors.primary,
    fontWeight: fontWeights.semibold,
  },
  errorPrimaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 40,
  },
  errorPrimaryBtnText: {
    color: colors.primaryForeground,
    fontWeight: fontWeights.semibold,
    fontSize: typography.button.fontSize,
  },
  errorSecondaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.buttonOutline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  errorSecondaryBtnText: {
    color: colors.foreground,
    fontWeight: fontWeights.semibold,
    fontSize: typography.button.fontSize,
  },
  header: {
    marginBottom: spacing.xl,
  },
  statusRow: {
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  headerUrgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    gap: 6,
  },
  headerUrgencyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  headerUrgencyText: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.semibold,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontSize: typography.sizes['3xl'],
    fontWeight: fontWeights.bold,
    color: colors.foreground,
    letterSpacing: -0.5,
    flex: 1,
  },
  description: {
    fontSize: typography.sizes.md,
    color: colors.mutedForeground,
    lineHeight: 22,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  cardPressable: {
    backgroundColor: colors.card,
  },
  cardIconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  cardContent: {
    flex: 1,
  },
  cardLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  cardValue: {
    fontSize: typography.sizes.md,
    color: colors.foreground,
    fontWeight: fontWeights.medium,
  },
  cardActionIcon: {
    marginLeft: spacing.sm,
  },
  clientCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  clientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  clientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  clientAvatarText: {
    fontSize: typography.sizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.primaryForeground,
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  clientEmail: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  clientActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  clientActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    gap: spacing.xs,
    minHeight: 44,
  },
  clientActionText: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  timerCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  timerActiveCard: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderLeftWidth: 3,
    borderLeftColor: colors.success,
  },
  timerIconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  timerActiveIcon: {
    backgroundColor: colors.success,
  },
  timerContent: {
    flex: 1,
  },
  timerLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  timerValue: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
    marginTop: 2,
  },
  timerActiveValue: {
    color: colors.success,
    fontWeight: fontWeights.bold,
  },
  timerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButton: {
    backgroundColor: colors.primary,
  },
  stopButton: {
    backgroundColor: colors.destructive,
  },
  timerBreakCard: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  timerBreakIcon: {
    backgroundColor: colors.warning,
  },
  timerBreakValue: {
    color: colors.warning,
    fontWeight: fontWeights.bold,
  },
  timerButtonGroup: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  breakButton: {
    backgroundColor: colors.warningLight,
  },
  resumeButton: {
    backgroundColor: colors.primary,
  },
  quickActionsSection: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.bold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
    paddingLeft: spacing.xs,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
    minHeight: 90,
  },
  quickActionIcon: {
    marginBottom: spacing.sm,
  },
  quickActionText: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  notesCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  notesIconContainer: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  notesLabel: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    flex: 1,
    marginRight: spacing.sm,
  },
  notesText: {
    fontSize: typography.button.fontSize,
    color: colors.foreground,
    lineHeight: 21,
    marginTop: spacing.xs,
  },
  emptyNotesPlaceholder: {
    paddingVertical: spacing.md,
  },
  emptyNotesText: {
    fontSize: typography.button.fontSize,
    color: colors.mutedForeground,
    fontStyle: 'italic',
  },
  geofenceCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  geofenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  geofenceHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  geofenceIconContainer: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  geofenceLabel: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  geofenceBadge: {
    backgroundColor: `${colors.success}20`,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  geofenceBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.success,
  },
  geofenceSettingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.muted,
  },
  geofenceSettingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  geofenceSettingIcon: {
    marginRight: spacing.sm,
  },
  geofenceSettingLabel: {
    fontSize: typography.button.fontSize,
    color: colors.foreground,
  },
  geofenceSettingDescription: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  geofenceRadiusRow: {
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.muted,
  },
  geofenceRadiusLabel: {
    fontSize: typography.button.fontSize,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  geofenceRadiusValue: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  geofenceSlider: {
    marginTop: spacing.xs,
  },
  geofenceNoLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  geofenceNoLocationText: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    marginLeft: spacing.sm,
    flex: 1,
  },
  photosCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  photosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  photosIconContainer: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  photosHeaderLabel: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    flex: 1,
  },
  photosCountBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.md,
  },
  photosCountText: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
  },
  photosScrollView: {
    flexDirection: 'row',
  },
  photosScrollContent: {
    paddingRight: spacing.md,
  },
  inlinePhotoItem: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  inlinePhotoImage: {
    width: '100%',
    height: '100%',
  },
  morePhotosButton: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  morePhotosText: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
  },
  morePhotosLabel: {
    fontSize: typography.sizes.xs,
    color: colors.mutedForeground,
  },
  addPhotoButton: {
    width: 100,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary + '50',
    marginRight: spacing.sm,
    gap: 4,
  },
  viewAllPhotosButton: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  emptyPhotosContainer: {
    flexDirection: 'row',
    paddingTop: spacing.sm,
  },
  takePhotoInlineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    marginRight: spacing.sm,
    minHeight: 44,
  },
  takePhotoInlineButtonIcon: {
    marginRight: spacing.sm,
  },
  takePhotoInlineText: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  galleryInlineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.muted,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 44,
  },
  galleryInlineButtonIcon: {
    marginRight: spacing.sm,
  },
  galleryInlineText: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  actionButtonContainer: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  mainActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    borderRadius: radius.xl,
  },
  mainActionButtonIcon: {
    marginRight: spacing.sm,
  },
  mainActionText: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.bold,
    color: colors.primaryForeground,
  },
  invoicedMessage: {
    textAlign: 'center',
    fontSize: typography.button.fontSize,
    color: colors.mutedForeground,
    paddingVertical: spacing.lg,
  },
  documentCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  documentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  documentIconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  documentInfo: {
    flex: 1,
  },
  documentTitle: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    marginBottom: 2,
  },
  documentNumber: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
  },
  documentStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  documentStatusText: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.semibold,
    textTransform: 'capitalize',
  },
  documentDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  documentAmount: {
    fontSize: typography.sizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
  },
  documentViewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
  },
  documentViewButtonText: {
    color: colors.primaryForeground,
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.semibold,
  },
  costingCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  costingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  costingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  costingTitle: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  costingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  costingItem: {
    width: '50%',
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.md,
  },
  costingLabel: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
    marginBottom: 4,
  },
  costingValue: {
    fontSize: typography.sizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
  },
  paymentReceivedCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  paymentReceivedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentReceivedIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  paymentReceivedContent: {
    flex: 1,
  },
  paymentReceivedTitle: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    marginBottom: 2,
  },
  paymentReceivedSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
  },
  paymentReceivedAmount: {
    alignItems: 'flex-end',
  },
  paymentReceivedAmountText: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.bold,
    color: colors.success,
  },
  paymentReceivedDate: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  // Quick Collect Payment Styles
  quickCollectCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    ...shadows.sm,
  },
  quickCollectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  quickCollectIconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  quickCollectTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickCollectTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: fontWeights.bold,
  },
  quickCollectBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.md,
  },
  quickCollectBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.semibold,
    textTransform: 'uppercase',
  },
  quickCollectDescription: {
    fontSize: typography.button.fontSize,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  quickCollectAmountBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  quickCollectAmountLabel: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.medium,
  },
  quickCollectAmountValue: {
    fontSize: typography.sizes['2xl'],
    fontWeight: fontWeights.bold,
  },
  quickCollectButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickCollectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  quickCollectButtonText: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
  },
  activityCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  activityIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  activityTitle: {
    flex: 1,
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  activityCount: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
    backgroundColor: colors.muted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  activityList: {
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
    marginLeft: 8,
    paddingLeft: spacing.md,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  activityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.inProgress,
    marginRight: spacing.sm,
    marginTop: 5,
    marginLeft: -spacing.md - 6,
  },
  activityContent: {
    flex: 1,
  },
  activityDescription: {
    fontSize: typography.button.fontSize,
    color: colors.foreground,
    marginBottom: 2,
  },
  activityTime: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
  },
  activityMore: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: fontWeights.medium,
    marginTop: spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingLeft: spacing.xs,
  },
  sectionHeaderIcon: {
    marginRight: spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  modalContent: {
    padding: spacing.lg,
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  notesInput: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: typography.sizes.md,
    color: colors.foreground,
    minHeight: 150,
    textAlignVertical: 'top',
  },
  singleLineInput: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.md,
    color: colors.foreground,
    height: 44,
    textAlignVertical: 'center',
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  saveButtonText: {
    color: colors.primaryForeground,
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
  },
  photosContainer: {
    padding: spacing.lg,
  },
  photosGrid: {
    gap: spacing.sm,
  },
  photoItem: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    marginRight: '2%',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photosEmpty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  photosEmptyText: {
    fontSize: typography.button.fontSize,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  photoActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  photoActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
  },
  photoActionButtonSecondary: {
    backgroundColor: colors.muted,
  },
  photoActionText: {
    color: colors.primaryForeground,
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
  },
  photoActionTextSecondary: {
    color: colors.foreground,
  },
  photoPreviewModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullPhoto: {
    width: '100%',
    height: '80%',
  },
  closePhotoButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Bottom toolbar for photo actions
  photoToolbar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16, // Safe area
    paddingTop: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  photoToolbarRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    gap: 8,
  },
  photoToolbarButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    minHeight: 56,
  },
  photoToolbarButtonText: {
    fontSize: typography.sizes.xs,
    color: colors.white,
    marginTop: 4,
    textAlign: 'center',
  },
  photoToolbarDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  // Legacy styles kept for compatibility but now using photoToolbar
  deletePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  deletePhotoText: {
    color: colors.primaryForeground,
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
  },
  markupPhotoButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 120 : 100,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  markupPhotoText: {
    color: colors.primaryForeground,
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
  },
  categoryPhotoButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 180 : 160,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(100,100,100,0.8)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  categoryPhotoText: {
    color: colors.primaryForeground,
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
  },
  photoCategoryBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(100,100,100,0.9)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCategoryBadgeText: {
    color: colors.white,
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.bold,
  },
  savePhotoButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 180 : 160,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.success,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  savePhotoText: {
    color: colors.primaryForeground,
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
  },
  saveVideoButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 120 : 100,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.success,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  photoCountBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  photoCountText: {
    color: colors.primaryForeground,
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.semibold,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 2,
  },
  tab: {
    flex: 1,
    paddingHorizontal: spacing.xs,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    gap: 4,
    minHeight: 48,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabIcon: {
    color: colors.mutedForeground,
  },
  tabIconActive: {
    color: colors.primaryForeground,
  },
  tabLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: colors.primaryForeground,
    fontWeight: fontWeights.bold,
  },
  fixedHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  androidNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  tabSection: {
    marginBottom: spacing.lg,
  },
  tabSectionTitle: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.bold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
    paddingLeft: spacing.xs,
  },
  completionModal: {
    flex: 1,
    backgroundColor: colors.background,
  },
  completionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  completionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
  },
  completionScrollContent: {
    padding: spacing.lg,
    paddingBottom: bottomNavHeight,
  },
  completionSection: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  completionSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  completionSectionIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  completionSectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    flex: 1,
  },
  completionSectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  completionStatusText: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.medium,
  },
  completionSectionContent: {
    paddingLeft: 48,
  },
  completionSectionDetail: {
    fontSize: typography.button.fontSize,
    color: colors.mutedForeground,
  },
  completionWarning: {
    backgroundColor: colors.warning + '15',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.warning + '30',
  },
  completionWarningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  completionWarningTitle: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.warning,
  },
  completionWarningText: {
    fontSize: typography.button.fontSize,
    color: colors.mutedForeground,
    lineHeight: 20,
  },
  completionFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 34 : spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    gap: spacing.md,
  },
  completionButton: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionButtonPrimary: {
    backgroundColor: colors.success,
  },
  completionButtonSecondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  completionButtonText: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.white,
  },
  completionButtonTextSecondary: {
    color: colors.foreground,
  },
  photoThumbnailsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  photoThumbnail: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
  },
  videoPlayIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordVideoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    marginRight: spacing.sm,
    minHeight: 44,
  },
  recordVideoButtonIcon: {
    marginRight: spacing.sm,
  },
  recordVideoText: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  videoPlayerModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayerContainer: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height * 0.6,
    backgroundColor: '#000',
  },
  closeVideoButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteVideoButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 60 : 40,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.destructive,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
});

// hint: Logic changed on both sides. Requires understanding intent of each change.
export default function JobDetailScreen() {
  console.log('[LA-DEBUG] LiveActivity module:', typeof LiveActivity, LiveActivity && Object.keys(LiveActivity));
  const { id, action: navAction } = useLocalSearchParams<{ id: string; action?: string }>();
  const { colors, isDark } = useTheme();
  const confirm = useConfirmDialog();
  const showActionSheet = useActionSheet();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, bottomNavHeight), [colors, bottomNavHeight]);
  const scrollRef = useRef<ScrollView | null>(null);
  const { onScroll: preserveOnScroll, scrollEventThrottle } = usePreserveScrollOnFold(scrollRef);
  
  const [job, setJob] = useState<Job | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [linkedReceipt, setLinkedReceipt] = useState<LinkedReceipt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notesSummary, setNotesSummary] = useState<string | null>(null);
  const [isSummarizingNotes, setIsSummarizingNotes] = useState(false);
  const [jobNotes, setJobNotes] = useState<JobNoteItem[]>([]);
  const [showPhotosModal, setShowPhotosModal] = useState(false);
  const [showAIAnalysisModal, setShowAIAnalysisModal] = useState(false);
  const [editedNotes, setEditedNotes] = useState('');
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newJobTitle, setNewJobTitle] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [editingNote, setEditingNote] = useState<JobNoteItem | null>(null);
  
  const [photos, setPhotos] = useState<JobPhoto[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<JobPhoto | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<JobPhoto | null>(null);
  
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [isUploadingVoiceNote, setIsUploadingVoiceNote] = useState(false);
  const [showFABVoiceModal, setShowFABVoiceModal] = useState(false);
  const [isFABRecording, setIsFABRecording] = useState(false);
  const [isUploadingFABVoice, setIsUploadingFABVoice] = useState(false);
  const fabPulseAnim = useRef(new Animated.Value(1)).current;
  
  const [signatures, setSignatures] = useState<DigitalSignature[]>([]);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [isSavingSignature, setIsSavingSignature] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [signerRole, setSignerRole] = useState<'client' | 'worker' | 'owner'>('client');
  const [saveToClient, setSaveToClient] = useState(true);
  const [clientSavedSignature, setClientSavedSignature] = useState<{ signatureData: string; signerName: string } | null>(null);
  
  const [sliderRadius, setSliderRadius] = useState(100);
  
  const [timeEntries, setTimeEntries] = useState<CompletedTimeEntry[]>([]);
  type SiteAttendance = { events: Array<{ userId?: string; type?: string; timestamp?: string; latitude?: number; longitude?: number; userName?: string }>; arrivalCount: number; departureCount: number; firstArrival: string | null; lastDeparture: string | null };
  const [siteAttendance, setSiteAttendance] = useState<SiteAttendance | null>(null);
  const [activityLog, setActivityLog] = useState<ActivityItem[]>([]);
  const [isConvertingToInvoice, setIsConvertingToInvoice] = useState(false);
  
  const [smartActions, setSmartActions] = useState<SmartAction[]>([]);
  const [isExecutingActions, setIsExecutingActions] = useState(false);
  const [dismissedActionIds, setDismissedActionIds] = useState<Set<string>>(new Set());
  const [hideAllActions, setHideAllActions] = useState(false);
  
  const [jobExpenses, setJobExpenses] = useState<JobExpense[]>([]);
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(false);
  const [availableForms, setAvailableForms] = useState<any[]>([]);
  const [hasJobCardForms, setHasJobCardForms] = useState(false);
  const [formSubmissions, setFormSubmissions] = useState<any[]>([]);
  
  // Automation settings for photo gates
  const [automationSettings, setAutomationSettings] = useState<{
    requirePhotoBeforeStart: boolean;
    requirePhotoAfterComplete: boolean;
  } | null>(null);

  const [jobConflictWarning, setJobConflictWarning] = useState<{ otherJobTitle: string; otherBusinessName: string; overlapMinutes: number } | null>(null);

  const [subcontractorTokens, setSubcontractorTokens] = useState<SubcontractorToken[]>([]);
  const [showSubcontractorModal, setShowSubcontractorModal] = useState(false);
  const [isLoadingSubcontractors, setIsLoadingSubcontractors] = useState(false);
  const [isSavingSubcontractor, setIsSavingSubcontractor] = useState(false);
  const [subcontractorForm, setSubcontractorForm] = useState({
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    sendViaSms: true,
    sendViaEmail: true,
    permissions: ['view_job', 'add_notes', 'add_photos', 'update_status'] as string[],
    expiryDays: '30',
  });

  const isSafetyForm = (form: any) => {
    const name = (form.name || '').toLowerCase();
    return name.includes('swms') || name.includes('jsa') || name.includes('safety') || name.includes('compliance');
  };

  const [linkedJobs, setLinkedJobs] = useState<Job[]>([]);

  const [showSiteUpdateModal, setShowSiteUpdateModal] = useState(false);
  const [siteUpdateNote, setSiteUpdateNote] = useState('');
  const [siteUpdatePhotoUri, setSiteUpdatePhotoUri] = useState<string | null>(null);
  const [isSendingSiteUpdate, setIsSendingSiteUpdate] = useState(false);

  const [uploadedDocuments, setUploadedDocuments] = useState<JobDocument[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);

  interface JobVariation {
    id: string;
    jobId: string;
    number: string;
    title: string;
    description: string | null;
    reason: string | null;
    additionalAmount: string;
    gstAmount: string;
    totalAmount: string;
    status: 'draft' | 'sent' | 'approved' | 'rejected' | 'pending';
    amount?: string | number;
    approvedByName: string | null;
    approvedBySignature: string | null;
    rejectionReason: string | null;
    createdAt: string;
  }
  const [variations, setVariations] = useState<JobVariation[]>([]);
  const [isLoadingVariations, setIsLoadingVariations] = useState(false);
  const [showAddVariationModal, setShowAddVariationModal] = useState(false);
  const [isSavingVariation, setIsSavingVariation] = useState(false);
  const [variationForm, setVariationForm] = useState({ title: '', description: '', reason: '', amount: '' });
  const [showApproveVariationModal, setShowApproveVariationModal] = useState<string | null>(null);
  const [approveVariationName, setApproveVariationName] = useState('');
  const [approveVariationSignature, setApproveVariationSignature] = useState<string | null>(null);
  const [isApprovingVariation, setIsApprovingVariation] = useState(false);
  const [showRejectVariationModal, setShowRejectVariationModal] = useState<string | null>(null);
  const [rejectVariationReason, setRejectVariationReason] = useState('');
  const [isRejectingVariation, setIsRejectingVariation] = useState(false);

  const [swmsDocuments, setSwmsDocuments] = useState<SwmsDocument[]>([]);

  const completedSafetyFormCount = useMemo(() => {
    return formSubmissions.filter(s => {
      const form = availableForms.find((f: any) => f.id === s.formId);
      return form && isSafetyForm(form) && s.status === 'submitted';
    }).length;
  }, [availableForms, formSubmissions]);
  
  const hasSafetyFormsAvailable = useMemo(() => {
    return availableForms.some(isSafetyForm);
  }, [availableForms]);

  const pendingSafetyForms = useMemo(() => {
    if (completedSafetyFormCount > 0) return [];
    if (!hasSafetyFormsAvailable) return [];
    return [{ pending: true }];
  }, [completedSafetyFormCount, hasSafetyFormsAvailable]);

  const hasIncompleteSwms = useMemo(() => {
    if (swmsDocuments.length === 0) return false;
    return swmsDocuments.some(s => s.status === 'draft' || (s.signatureCount ?? 0) === 0);
  }, [swmsDocuments]);

  const hasNoSafetyDocs = useMemo(() => {
    const completedForms = formSubmissions.filter(s => {
      const form = availableForms.find((f: any) => f.id === s.formId);
      return form && isSafetyForm(form) && s.status === 'submitted';
    });
    const activeSwms = swmsDocuments.filter(s => s.status === 'active');
    return completedForms.length === 0 && activeSwms.length === 0;
  }, [availableForms, formSubmissions, swmsDocuments]);

  // Forms data is loaded by JobForms component and passed via onFormsChange/onSubmissionsChange callbacks
  // This eliminates duplicate API calls
  
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'chat' | 'manage'>('overview');

  const [materials, setMaterials] = useState<JobMaterial[]>([]);
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(false);
  const [showAddMaterialModal, setShowAddMaterialModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<JobMaterial | null>(null);
  const [materialForm, setMaterialForm] = useState({ name: '', quantity: '1', unitCost: '', unitPrice: '', markupPercent: '', supplier: '', description: '' });
  const [isSavingMaterial, setIsSavingMaterial] = useState(false);
  const [costPromptMaterial, setCostPromptMaterial] = useState<{ id: string; name: string; status: string } | null>(null);
  const [costPromptValue, setCostPromptValue] = useState('');
  const [showCostPromptModal, setShowCostPromptModal] = useState(false);

  const [isLoadingSwms, setIsLoadingSwms] = useState(false);
  const [expandedSwmsId, setExpandedSwmsId] = useState<string | null>(null);
  const [showCreateSwmsModal, setShowCreateSwmsModal] = useState(false);
  const [showTemplatePickerModal, setShowTemplatePickerModal] = useState(false);
  const [swmsTemplates, setSwmsTemplates] = useState<SwmsTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [showSignSwmsModal, setShowSignSwmsModal] = useState(false);
  const [signingSwmsId, setSigningSwmsId] = useState<string | null>(null);
  const [signWorkerName, setSignWorkerName] = useState('');
  const [swmsSignatureData, setSwmsSignatureData] = useState<string | null>(null);
  const swmsSignWebViewRef = useRef<any>(null);
  const [isSigningSwms, setIsSigningSwms] = useState(false);
  const [isSavingSwms, setIsSavingSwms] = useState(false);
  const [swmsForm, setSwmsForm] = useState({
    title: '',
    description: '',
    workActivityDescription: '',
    siteAddress: '',
    ppeRequirements: [] as string[],
    emergencyContact: '',
    firstAidLocation: '',
    hazards: [] as { hazardDescription: string; riskConsequence: string; riskLikelihood: string; controlMeasures: string; responsiblePerson: string }[],
  });

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [showMagicLinkInAssign, setShowMagicLinkInAssign] = useState(false);
  const [magicLinkName, setMagicLinkName] = useState('');
  const [magicLinkPhone, setMagicLinkPhone] = useState('');
  const [magicLinkRate, setMagicLinkRate] = useState('');
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
  const [jobAssignments, setJobAssignments] = useState<any[]>([]);
  const [assignmentsLoaded, setAssignmentsLoaded] = useState(false);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<Set<string>>(new Set());
  const [teamAvailability, setTeamAvailability] = useState<Map<string, any>>(new Map());
  const [isNudging, setIsNudging] = useState<string | null>(null);

  const [jobMessages, setJobMessages] = useState<JobChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  
  const [teamTimers, setTeamTimers] = useState<Array<{
    id: string;
    userId: string;
    workerName: string;
    workerAvatar: string | null;
    startTime: string;
    isPaused: boolean;
    pausedDuration: string | null;
    isBreak: boolean;
    elapsedMinutes: number;
    hourlyRate: string;
    isCurrentUser: boolean;
  }>>([]);

  // Owner/manager rate correction for a worker's running entry on this job
  const [editRateTimer, setEditRateTimer] = useState<{ id: string; workerName: string; hourlyRate: string } | null>(null);
  const [rateInput, setRateInput] = useState('');
  const [isSavingRate, setIsSavingRate] = useState(false);
  
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionMode, setCompletionMode] = useState<'owner' | 'worker'>('owner');
  const [showNextJobModal, setShowNextJobModal] = useState(false);
  const [nextJob, setNextJob] = useState<any>(null);
  const [nextJobDriveInfo, setNextJobDriveInfo] = useState<{ distanceKm: number; driveMinutes: number } | null>(null);
  const [nextJobClientPhone, setNextJobClientPhone] = useState<string | null>(null);
  const [isCompletingJob, setIsCompletingJob] = useState(false);
  const [isHeadingToNext, setIsHeadingToNext] = useState(false);
  const [showWrapUpBanner, setShowWrapUpBanner] = useState(false);
  const [wrapUpNextJob, setWrapUpNextJob] = useState<any>(null);
  const [wrapUpDriveMinutes, setWrapUpDriveMinutes] = useState<number>(0);
  const [showAnnotationEditor, setShowAnnotationEditor] = useState(false);
  
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isDeletingJob, setIsDeletingJob] = useState(false);
  const [isCloningJob, setIsCloningJob] = useState(false);
  const [isSendingOnMyWay, setIsSendingOnMyWay] = useState(false);
  
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendModalDefaultTab, setSendModalDefaultTab] = useState<'email' | 'sms'>('email');

  const [isGeneratingProofPack, setIsGeneratingProofPack] = useState(false);
  const [isExportingProofPackTsv, setIsExportingProofPackTsv] = useState(false);
  const [isExportingJobCard, setIsExportingJobCard] = useState(false);
  const [jobCardPreviewHtml, setJobCardPreviewHtml] = useState<string | null>(null);
  const [showJobCardPreview, setShowJobCardPreview] = useState(false);
  const [showProofPackModal, setShowProofPackModal] = useState(false);
  const [proofPackSections, setProofPackSections] = useState({
    timeline: true,
    attendance: true,
    gpsProof: true,
    materials: true,
    photos: true,
    invoice: true,
    compliance: true,
    subcontractors: true,
    swms: true,
    forms: true,
  });
  const [portalEnabled, setPortalEnabled] = useState(false);
  const [portalLinks, setPortalLinks] = useState<{ id: string; url: string; token: string; expiresAt?: string; createdAt?: string }[]>([]);
  const [isTogglingPortal, setIsTogglingPortal] = useState(false);
  const [isGeneratingPortalLink, setIsGeneratingPortalLink] = useState(false);
  const [isSendingPortalSMS, setIsSendingPortalSMS] = useState(false);
  const [isSendingPortalEmail, setIsSendingPortalEmail] = useState(false);
  const [proofPackPreviewHtml, setProofPackPreviewHtml] = useState<string | null>(null);
  const [showProofPackPreview, setShowProofPackPreview] = useState(false);
  const [isLoadingProofPackPreview, setIsLoadingProofPackPreview] = useState(false);

  interface ProfitabilityData {
    jobId: string;
    jobTitle: string;
    jobStatus: string;
    clientName: string;
    quoted: { amount: number; gst: number; quoteNumber: string } | null;
    revenue: { invoiced: number; pending: number; received: number };
    costs: { labour: number; subcontractor: number; materials: number; otherExpenses: number; expenses?: number; total: number };
    profit: { amount: number; margin: number; vsQuote: number | null };
    hours: { total: number; billable: number; nonBillable: number };
    status: 'profitable' | 'tight' | 'loss';
    materials: Array<{ id: string; name: string; quantity: number; unitCost: number; totalCost: number; supplier: string; status: string }>;
  }
  const [profitabilityData, setProfitabilityData] = useState<ProfitabilityData | null>(null);
  const [isLoadingProfitability, setIsLoadingProfitability] = useState(false);

  const [showRollbackConfirm, setShowRollbackConfirm] = useState(false);
  const [rollbackTargetStatus, setRollbackTargetStatus] = useState<string | null>(null);
  
  const { updateJobStatus } = useJobsStore();
  const { businessSettings, roleInfo, user, hasPermission, logout } = useAuthStore();
  const [showWorkspaceSwitcher, setShowWorkspaceSwitcher] = useState(false);
  const { isSmsReady } = useIntegrationHealth();
  
  const isOwnerOrManager = roleInfo 
    ? (roleInfo.isOwner || ['OWNER', 'ADMIN', 'MANAGER'].includes(roleInfo.roleName?.toUpperCase() || ''))
    : (user && businessSettings ? true : false);
  const _rl = roleInfo?.roleName?.toLowerCase() || '';
  const isSubcontractor = _rl.includes('subcontractor') || _rl.includes('sub_contractor');
  const [subbieLocationSharing, setSubbieLocationSharing] = useState(false);
  const [subbieLocationStopped, setSubbieLocationStopped] = useState(false);
  const isSoloOwner = user && businessSettings && (!roleInfo || roleInfo.isOwner);
  const isSubcontractorUser = roleInfo?.roleName?.toLowerCase() === 'subcontractor' || roleInfo?.roleName?.toLowerCase() === 'sub_contractor';
  const canDeleteJobs = isOwnerOrManager || isSoloOwner;
  
  // Check if user can collect payments (owners always can, workers need permission)
  // Guard against hasPermission being undefined during auth hydration
  const canCollectPayments = isOwnerOrManager || isSoloOwner || (typeof hasPermission === 'function' && hasPermission('collect_payments'));
  const { 
    activeTimer, 
    fetchActiveTimer, 
    startTimer, 
    stopTimer, 
    pauseTimer,
    resumeTimer,
    isLoading: timerLoading, 
    getElapsedMinutes,
    isOnBreak,
    error: timerError 
  } = useTimeTrackingStore();

  const isTimerForThisJob = activeTimer?.jobId === id;

  // Pulse animation for active timer
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    if (isTimerForThisJob) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.02,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
      return () => pulseAnimation.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isTimerForThisJob]);

  useEffect(() => {
    if (isFABRecording) {
      const fabPulse = Animated.loop(
        Animated.sequence([
          Animated.timing(fabPulseAnim, {
            toValue: 1.15,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(fabPulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      fabPulse.start();
      return () => fabPulse.stop();
    } else {
      fabPulseAnim.setValue(1);
    }
  }, [isFABRecording]);

  // Create ref for AppState tracking
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    setJobNotes([]);
    loadJob();
    fetchActiveTimer();
    loadPhotos();
    loadVoiceNotes();
    loadJobNotes();
    loadSignatures();
    loadRelatedDocuments();
    loadTimeEntries();
    loadTeamTimers();
    loadActivityLog();
    loadJobExpenses();
    loadAutomationSettings();
    loadSubcontractorTokens();
    loadProfitability();
    loadPortalLinks();
    loadSwmsDocuments();
    loadUploadedDocuments();
    loadVariations();
    // Forms data is loaded by JobForms component via callbacks
    
    // Auto-refresh when app comes to foreground
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to the foreground - refresh job data and timer
        loadJob();
        fetchActiveTimer();
        loadTimeEntries();
        loadTeamTimers();
      }
      appStateRef.current = nextAppState;
    });
    
    return () => {
      subscription.remove();
    };
  }, [id]);

  // Refresh core job data whenever the screen regains focus (e.g. after the
  // office edits the job while a worker was viewing it, or returning from a
  // sub-screen). Skip the very first focus — the mount effect above already
  // loads everything.
  const initialFocusRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (initialFocusRef.current) {
        initialFocusRef.current = false;
        return;
      }
      loadJob();
      fetchActiveTimer();
      loadTimeEntries();
      loadTeamTimers();
    }, [id])
  );

  // Fire the auto-open exactly once per navAction value, regardless of how
  // many times `job` refetches. Previously a query refetch would clear the
  // 400ms timer and restart it, so on slow connections the Assign Workers
  // sheet never actually opened from the dashboard alert.
  const navActionFiredRef = useRef<string | null>(null);
  useEffect(() => {
    if (!job || isLoading || !navAction) return;
    // For the complete action we must know the user's assignment before
    // choosing worker vs owner mode — otherwise an assigned worker gets the
    // owner "Complete Job" flow, which the server rejects (NOT_LEAD_WORKER).
    if (navAction === 'complete' && !assignmentsLoaded) return;
    if (navActionFiredRef.current === navAction) return;
    navActionFiredRef.current = navAction;
    // Wait for the stack-transition animation + initial layout to finish
    // before opening the sheet. Without this, gorhom's BottomSheetModal can
    // call present() while the screen is still animating in and silently
    // no-op — the user lands on the page with no sheet visible.
    const handle = InteractionManager.runAfterInteractions(() => {
      if (navAction === 'assign') {
        setShowAssignModal(true);
      } else if (navAction === 'invoice') {
        router.replace(`/more/invoice/new?jobId=${job.id}${client ? `&clientId=${client.id}` : ''}`);
      } else if (navAction === 'complete') {
        // Same worker-vs-owner decision as the main CTA: assigned workers
        // (who don't own the job) mark their OWN part complete.
        const mine = jobAssignments.find((a: any) => a.userId === user?.id);
        const hasMine = !!mine && mine.isActive !== false;
        const ownsJob = !!user && !!job.userId && job.userId === user.id;
        if (!ownsJob && hasMine && mine?.completedAt) {
          showToast({ type: 'info', message: 'Already done', description: 'Your part of this job is already marked complete.' });
          return;
        }
        setCompletionMode(!ownsJob && hasMine ? 'worker' : 'owner');
        setShowCompletionModal(true);
      }
    });
    return () => handle.cancel();
  }, [job, isLoading, navAction, client, assignmentsLoaded, jobAssignments, user]);

  useEffect(() => {
    if (timerError) {
      showToast({ type: 'info', message: 'Timer Error', description: timerError });
    }
  }, [timerError]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    
    if (isTimerForThisJob && activeTimer) {
      setElapsedTime(getElapsedMinutes());
      interval = setInterval(() => {
        setElapsedTime(getElapsedMinutes());
      }, 1000);
    } else {
      setElapsedTime(0);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerForThisJob, activeTimer?.id, activeTimer?.startTime]);

  useEffect(() => {
    if (job?.status === 'in_progress') {
      const teamTimerInterval = setInterval(() => {
        loadTeamTimers();
      }, 30000);
      return () => clearInterval(teamTimerInterval);
    }
  }, [job?.status, id]);

  // Generate smart actions when job/client/quote/invoice change
  useEffect(() => {
    if (job) {
      const actions = getJobSmartActions(job, client, quote, invoice);
      setSmartActions(actions);
    }
  }, [job?.status, client?.email, client?.phone, quote?.id, invoice?.id]);

  useEffect(() => {
    if (!isSubcontractor || !job) return;

    const businessName = businessSettings?.businessName || 'Business';

    if (job.status === 'in_progress') {
      setSubbieLocationStopped(false);
      locationTracking.setSubcontractorMode(true);
      locationTracking.startJobTracking(job.id, job.title, businessName).then((started) => {
        setSubbieLocationSharing(started);
      });
    } else if (locationTracking.isTrackingJob(job.id)) {
      locationTracking.stopJobTrackingForJob(job.id);
      setSubbieLocationSharing(false);
      setSubbieLocationStopped(true);
    }
  }, [isSubcontractor, job?.status, job?.id]);

  useEffect(() => {
    if (!isSubcontractor || !job) return;
    const isTracking = locationTracking.isTrackingJob(job.id);
    setSubbieLocationSharing(isTracking && job.status === 'in_progress');
  }, []);

  // Keep the worker's live location flowing to the client portal while EN ROUTE
  // (workerStatus === 'on_my_way'), so the tracking page shows a real,
  // counting-down road ETA instead of a single static estimate. Works for
  // owners and subbies: /api/team-locations updates the live pin and bridges the
  // moving location into the portal's ETA recompute. Stops on arrival; the
  // in_progress working phase is handled by the subcontractor effect above.
  useEffect(() => {
    if (!job) return;
    const businessName = businessSettings?.businessName || 'Business';
    if (job.workerStatus === 'on_my_way') {
      if (!locationTracking.isTrackingJob(job.id)) {
        if (isSubcontractor) locationTracking.setSubcontractorMode(true);
        locationTracking.startJobTracking(job.id, job.title, businessName)
          .then((started) => setSubbieLocationSharing(started))
          .catch(() => {});
      }
    } else if (locationTracking.isTrackingJob(job.id) && job.status !== 'in_progress') {
      locationTracking.stopJobTrackingForJob(job.id);
      setSubbieLocationSharing(false);
    }
  }, [job?.workerStatus, job?.status, job?.id, isSubcontractor]);

  const loadMaterials = useCallback(async () => {
    if (!id) return;
    setIsLoadingMaterials(true);
    try {
      const res = await api.get<JobMaterial[]>(`/api/jobs/${id}/materials`);
      if (Array.isArray(res.data)) {
        setMaterials(res.data);
        offlineStorage.cacheSubscriptionData(`job_materials_${id}`, res.data, SEVEN_DAYS_MS).catch(() => {});
      } else if (res.isOffline) {
        const cached = await offlineStorage.getCachedSubscriptionData<JobMaterial[]>(`job_materials_${id}`);
        setMaterials(Array.isArray(cached) ? cached : []);
      } else {
        setMaterials([]);
      }
    } catch (e) {
      console.error('Error loading materials:', e);
    } finally {
      setIsLoadingMaterials(false);
    }
  }, [id]);

  const loadTeamMembers = useCallback(async () => {
    try {
      const res = await api.get<TeamMember[]>('/api/team/members');
      if (Array.isArray(res.data)) {
        setTeamMembers(res.data);
        offlineStorage.cacheSubscriptionData('team_members', res.data, SEVEN_DAYS_MS).catch(() => {});
      } else if (res.isOffline) {
        const cached = await offlineStorage.getCachedSubscriptionData<TeamMember[]>('team_members');
        setTeamMembers(Array.isArray(cached) ? cached : []);
      } else {
        setTeamMembers([]);
      }
    } catch (e) {
      console.error('Error loading team members:', e);
    }
  }, []);

  const loadSubcontractorTokens = useCallback(async () => {
    if (!id) return;
    setIsLoadingSubcontractors(true);
    try {
      const res = await api.get<SubcontractorToken[]>(`/api/jobs/${id}/subcontractor-tokens`);
      setSubcontractorTokens(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error('Error loading subcontractor tokens:', e);
    } finally {
      setIsLoadingSubcontractors(false);
    }
  }, [id]);

  const handleInviteSubcontractor = async () => {
    if (!id) return;
    if (!subcontractorForm.contactName.trim()) {
      showToast({ type: 'error', message: 'Please enter a name' });
      return;
    }
    if (!subcontractorForm.contactPhone.trim() && !subcontractorForm.contactEmail.trim()) {
      showToast({ type: 'error', message: 'Please enter a phone number or email' });
      return;
    }

    setIsSavingSubcontractor(true);
    try {
      const expiryDays = parseInt(subcontractorForm.expiryDays);
      const expiresAt = expiryDays > 0
        ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const res = await api.post(`/api/jobs/${id}/subcontractor-token`, {
        contactName: subcontractorForm.contactName.trim(),
        contactPhone: subcontractorForm.contactPhone.trim() || null,
        contactEmail: subcontractorForm.contactEmail.trim() || null,
        sendViaSms: subcontractorForm.sendViaSms && !!subcontractorForm.contactPhone.trim(),
        sendViaEmail: subcontractorForm.sendViaEmail && !!subcontractorForm.contactEmail.trim(),
        permissions: subcontractorForm.permissions,
        expiresAt,
      });

      if (res.error) {
        showToast({ type: 'error', message: res.error });
      } else {
        showToast({ type: 'success', message: 'Subcontractor invite sent successfully' });
        setShowSubcontractorModal(false);
        setSubcontractorForm({
          contactName: '',
          contactPhone: '',
          contactEmail: '',
          sendViaSms: true,
          sendViaEmail: true,
          permissions: ['view_job', 'add_notes', 'add_photos', 'update_status'],
          expiryDays: '30',
        });
        loadSubcontractorTokens();
      }
    } catch (e) {
      showToast({ type: 'error', message: 'Failed to send invite' });
    } finally {
      setIsSavingSubcontractor(false);
    }
  };

  const handleRevokeSubcontractor = (tokenId: string, name?: string) => {
    confirm({
      title: 'Revoke Access',
      message: `Remove access for ${name || 'this subcontractor'}?`,
      confirmText: 'Revoke',
      destructive: true,
    }).then(async (ok) => {
      if (!ok) return;
      try {
        await api.delete(`/api/jobs/${id}/subcontractor-tokens/${tokenId}`);
        loadSubcontractorTokens();
      } catch (e) {
        showToast({ type: 'error', message: 'Error', description: 'Failed to revoke access' });
      }
    });
  };

  const toggleSubcontractorPermission = (perm: string) => {
    setSubcontractorForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter(p => p !== perm)
        : [...prev.permissions, perm],
    }));
  };

  const loadJobMessages = useCallback(async () => {
    if (!id) return;
    setIsLoadingMessages(true);
    try {
      const res = await api.get<JobChatMessage[]>(`/api/jobs/${id}/chat`);
      if (Array.isArray(res.data)) {
        setJobMessages(res.data);
        offlineStorage.cacheChatMessages('job', id as string, res.data).catch(() => {});
      } else if (res.isOffline) {
        const cached = await offlineStorage.getChatMessagesOffline('job', id as string);
        setJobMessages(Array.isArray(cached) ? (cached as JobChatMessage[]) : []);
      } else {
        setJobMessages([]);
      }
    } catch (e) {
      console.error('Error loading job chat:', e);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      setAssignmentsLoaded(false);
      loadMaterials();
      loadTeamMembers();
      loadJobAssignments();
    }
  }, [id]);

  const loadSwmsDocuments = useCallback(async () => {
    if (!id) return;
    setIsLoadingSwms(true);
    try {
      const res = await api.get<SwmsDocument[]>(`/api/jobs/${id}/swms`);
      setSwmsDocuments(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error('Error loading SWMS:', e);
    } finally {
      setIsLoadingSwms(false);
    }
  }, [id]);

  const loadUploadedDocuments = useCallback(async () => {
    if (!id) return;
    setIsLoadingDocuments(true);
    try {
      const res = await api.get<JobDocument[]>(`/api/jobs/${id}/documents`);
      setUploadedDocuments(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error('Error loading uploaded documents:', e);
    } finally {
      setIsLoadingDocuments(false);
    }
  }, [id]);

  const uploadDocumentFile = useCallback(async (file: { uri: string; name: string; type: string }) => {
    if (!id) return;
    try {
      setIsUploadingDocument(true);
      const token = await api.getToken();
      const title = file.name.replace(/\.[^/.]+$/, '');

      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.type,
      } as any);
      formData.append('title', title);
      formData.append('documentType', 'general');

      const response = await fetch(`${API_URL}/api/jobs/${id}/documents`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-mobile-app': 'true',
        },
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Upload failed');
      }

      showToast({ type: 'success', message: 'Document uploaded' });
      loadUploadedDocuments();
    } catch (e: any) {
      showToast({ type: 'error', message: e.message || 'Failed to upload document' });
    } finally {
      setIsUploadingDocument(false);
    }
  }, [id, loadUploadedDocuments]);

  const pickDocumentFromCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showToast({ type: 'error', message: 'Camera permission is required to take a photo' });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const name = asset.fileName || asset.uri.split('/').pop() || `photo-${Date.now()}.jpg`;
    await uploadDocumentFile({ uri: asset.uri, name, type: asset.mimeType || 'image/jpeg' });
  }, [uploadDocumentFile]);

  const pickDocumentFromLibrary = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const name = asset.fileName || asset.uri.split('/').pop() || 'document.jpg';
    await uploadDocumentFile({ uri: asset.uri, name, type: asset.mimeType || 'image/jpeg' });
  }, [uploadDocumentFile]);

  const pickDocumentFile = useCallback(async () => {
    const DocumentPicker = getDocumentPicker();
    if (!DocumentPicker) {
      Alert.alert(
        'Update required',
        'Attaching PDFs needs the latest app build. Please update the app, then try again. You can still attach photos in the meantime.'
      );
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const name = asset.name || asset.uri.split('/').pop() || 'document';
      await uploadDocumentFile({ uri: asset.uri, name, type: asset.mimeType || 'application/octet-stream' });
    } catch (e: any) {
      showToast({ type: 'error', message: e?.message || 'Could not open the file picker' });
    }
  }, [uploadDocumentFile]);

  const handleUploadDocument = useCallback(() => {
    showActionSheet({
      title: 'Upload Document',
      message: 'Choose a source',
      layout: 'grid',
      actions: [
        { label: 'Take Photo', icon: 'camera', onPress: pickDocumentFromCamera },
        { label: 'Choose Photo', icon: 'image', onPress: pickDocumentFromLibrary },
        { label: 'Attach File (PDF)', icon: 'file-text', onPress: pickDocumentFile },
        { label: 'Cancel', style: 'cancel' },
      ],
    });
  }, [showActionSheet, pickDocumentFromCamera, pickDocumentFromLibrary, pickDocumentFile]);

  const handleDeleteDocument = useCallback((doc: JobDocument) => {
    confirm({
      title: 'Delete Document',
      message: `Are you sure you want to delete "${doc.title}"?`,
      confirmText: 'Delete',
      destructive: true,
    }).then(async (ok) => {
      if (!ok) return;
      try {
        const res = await api.delete(`/api/jobs/${id}/documents/${doc.id}`);
        if (res.error) {
          showToast({ type: 'error', message: 'Error', description: res.error });
        } else {
          setUploadedDocuments(prev => prev.filter(d => d.id !== doc.id));
        }
      } catch (e) {
        showToast({ type: 'error', message: 'Error', description: 'Failed to delete document' });
      }
    });
  }, [id, confirm]);

  const handleOpenDocument = useCallback((doc: JobDocument) => {
    if (doc.fileUrl) {
      Linking.openURL(doc.fileUrl);
    } else {
      showToast({ type: 'error', message: 'Document URL not available' });
    }
  }, []);

  const formatFileSize = useCallback((bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }, []);

  const getDocTypeIcon = useCallback((mimeType?: string): string => {
    if (!mimeType) return 'file';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType === 'application/pdf') return 'file-text';
    return 'file';
  }, []);

  const getDocTypeBadge = useCallback((mimeType?: string): string => {
    if (!mimeType) return 'FILE';
    if (mimeType.startsWith('image/')) return 'IMAGE';
    if (mimeType === 'application/pdf') return 'PDF';
    return 'FILE';
  }, []);

  const loadVariations = useCallback(async () => {
    if (!id) return;
    setIsLoadingVariations(true);
    try {
      const res = await api.get<JobVariation[]>(`/api/jobs/${id}/variations`);
      setVariations(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error('Error loading variations:', e);
    } finally {
      setIsLoadingVariations(false);
    }
  }, [id]);

  const handleCreateVariation = useCallback(async () => {
    if (!id || !variationForm.title.trim() || !variationForm.amount.trim()) return;
    setIsSavingVariation(true);
    try {
      const amount = parseFloat(variationForm.amount) || 0;
      const res = await api.post(`/api/jobs/${id}/variations`, {
        title: variationForm.title.trim(),
        description: variationForm.description.trim() || null,
        reason: variationForm.reason.trim() || null,
        additionalAmount: amount.toFixed(2),
      });
      if (res.error) {
        showToast({ type: 'error', message: res.error });
      } else {
        setShowAddVariationModal(false);
        setVariationForm({ title: '', description: '', reason: '', amount: '' });
        loadVariations();
        showToast({ type: 'success', message: 'Variation created' });
      }
    } catch (e) {
      showToast({ type: 'error', message: 'Failed to create variation' });
    } finally {
      setIsSavingVariation(false);
    }
  }, [id, variationForm, loadVariations]);

  const handleSendVariation = useCallback(async (variationId: string) => {
    try {
      const res = await api.post(`/api/variations/${variationId}/send`, {});
      if (res.error) {
        showToast({ type: 'error', message: res.error });
      } else {
        loadVariations();
        showToast({ type: 'success', message: 'Variation sent to client' });
      }
    } catch (e) {
      showToast({ type: 'error', message: 'Failed to send variation' });
    }
  }, [loadVariations]);

  const handleApproveVariation = useCallback(async () => {
    if (!showApproveVariationModal || !approveVariationName.trim()) return;
    setIsApprovingVariation(true);
    try {
      const res = await api.post(`/api/variations/${showApproveVariationModal}/approve`, {
        approvedByName: approveVariationName.trim(),
        approvedBySignature: approveVariationSignature || undefined,
      });
      if (res.error) {
        showToast({ type: 'error', message: res.error });
      } else {
        setShowApproveVariationModal(null);
        setApproveVariationName('');
        setApproveVariationSignature(null);
        loadVariations();
        showToast({ type: 'success', message: 'Variation approved' });
      }
    } catch (e) {
      showToast({ type: 'error', message: 'Failed to approve variation' });
    } finally {
      setIsApprovingVariation(false);
    }
  }, [showApproveVariationModal, approveVariationName, approveVariationSignature, loadVariations]);

  const handleRejectVariation = useCallback(async () => {
    if (!showRejectVariationModal) return;
    setIsRejectingVariation(true);
    try {
      const res = await api.post(`/api/variations/${showRejectVariationModal}/reject`, {
        rejectionReason: rejectVariationReason.trim() || undefined,
      });
      if (res.error) {
        showToast({ type: 'error', message: res.error });
      } else {
        setShowRejectVariationModal(null);
        setRejectVariationReason('');
        loadVariations();
        showToast({ type: 'success', message: 'Variation rejected' });
      }
    } catch (e) {
      showToast({ type: 'error', message: 'Failed to reject variation' });
    } finally {
      setIsRejectingVariation(false);
    }
  }, [showRejectVariationModal, rejectVariationReason, loadVariations]);

  const loadSwmsTemplates = useCallback(async () => {
    setIsLoadingTemplates(true);
    try {
      const res = await api.get<SwmsTemplate[]>('/api/swms/templates');
      setSwmsTemplates(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error('Error loading SWMS templates:', e);
    } finally {
      setIsLoadingTemplates(false);
    }
  }, []);

  const loadSwmsDetails = useCallback(async (swmsId: string) => {
    try {
      const res = await api.get<SwmsDocument>(`/api/swms/${swmsId}`);
      if (res.data) {
        setSwmsDocuments(prev => prev.map(d => d.id === swmsId ? { ...d, ...res.data, hazards: res.data!.hazards, signatures: res.data!.signatures } : d));
      }
    } catch (e) {
      console.error('Error loading SWMS details:', e);
    }
  }, []);

  const handleSelectTemplate = useCallback(async (template: SwmsTemplate) => {
    setShowTemplatePickerModal(false);
    try {
      const res = await api.get<SwmsTemplate>(`/api/swms/templates/${template.id}`);
      const fullTemplate = res.data;
      setSwmsForm({
        title: fullTemplate?.title || template.title || '',
        description: fullTemplate?.description || template.description || '',
        workActivityDescription: fullTemplate?.workActivityDescription || '',
        siteAddress: job?.address || '',
        ppeRequirements: fullTemplate?.ppeRequirements || [],
        emergencyContact: '',
        firstAidLocation: '',
        hazards: (fullTemplate?.hazards || []).map((h: any) => ({
          hazardDescription: h.activityTask || h.hazardDescription || '',
          riskConsequence: h.consequence || h.riskConsequence || 'moderate',
          riskLikelihood: h.likelihood || h.riskLikelihood || 'possible',
          controlMeasures: h.controlMeasures || '',
          responsiblePerson: '',
        })),
      });
    } catch (e) {
      setSwmsForm(prev => ({
        ...prev,
        title: template.title || '',
        description: template.description || '',
        siteAddress: job?.address || '',
      }));
    }
    setShowCreateSwmsModal(true);
  }, [job]);

  const handleCreateSwms = useCallback(async () => {
    if (!id || !swmsForm.title.trim()) return;
    setIsSavingSwms(true);
    try {
      const res = await api.post<SwmsDocument>('/api/swms', {
        title: swmsForm.title,
        description: swmsForm.description,
        jobId: id as string,
        siteAddress: swmsForm.siteAddress,
        workActivityDescription: swmsForm.workActivityDescription,
        ppeRequirements: swmsForm.ppeRequirements,
        emergencyContact: swmsForm.emergencyContact,
        firstAidLocation: swmsForm.firstAidLocation,
        status: 'draft',
        hazards: swmsForm.hazards.map(h => ({
          activityTask: h.hazardDescription || 'Activity',
          hazard: h.riskConsequence || 'Hazard',
          likelihood: h.riskLikelihood || 'possible',
          consequence: h.riskConsequence || 'moderate',
          riskBefore: 'medium',
          controlMeasures: h.controlMeasures || '',
          riskAfter: 'low',
        })),
      });
      if (res.data) {
        setShowCreateSwmsModal(false);
        setSwmsForm({
          title: '', description: '', workActivityDescription: '', siteAddress: '',
          ppeRequirements: [], emergencyContact: '', firstAidLocation: '', hazards: [],
        });
        loadSwmsDocuments();
        showToast({ type: 'success', message: 'SWMS created successfully' });
      } else if (res.error) {
        showToast({ type: 'error', message: res.error });
      }
    } catch (e) {
      showToast({ type: 'error', message: 'Failed to create SWMS' });
    } finally {
      setIsSavingSwms(false);
    }
  }, [id, swmsForm, loadSwmsDocuments]);

  const handleSignSwms = useCallback(async () => {
    if (!signingSwmsId || !signWorkerName.trim()) return;
    setIsSigningSwms(true);
    try {
      let latitude: number | undefined;
      let longitude: number | undefined;
      let address: string | undefined;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          latitude = loc.coords.latitude;
          longitude = loc.coords.longitude;
          const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
          if (geocode.length > 0) {
            const g = geocode[0];
            address = [g.street, g.city, g.region].filter(Boolean).join(', ');
          }
        }
      } catch (locErr) {
        if (__DEV__) console.log('Location not available for SWMS signing');
      }

      // Detect offline state and fall back to local form_submissions queue
      const NetInfo = (await import('@react-native-community/netinfo')).default;
      const netState = await NetInfo.fetch();
      const isOnline = netState.isConnected !== false && netState.isInternetReachable !== false;

      if (!isOnline) {
        try {
          const { offlineStorage } = await import('@/lib/offline-storage');
          await offlineStorage.saveFormSubmissionOffline({
            formId: `swms:${signingSwmsId}`,
            jobId: id as string,
            submissionData: {
              swmsId: signingSwmsId,
              workerName: signWorkerName.trim(),
              latitude, longitude, address,
              signedAt: new Date().toISOString(),
              templateType: 'swms',
            },
            signatures: { worker: swmsSignatureData || 'mobile-text-signature' },
            status: 'pending_sync',
          });
          setShowSignSwmsModal(false);
          setSignWorkerName('');
          setSwmsSignatureData(null);
          setSigningSwmsId(null);
          showToast({ type: 'info', message: 'Saved offline', description: 'Your SWMS signature will sync automatically when you reconnect.' });
        } catch (offErr) {
          showToast({ type: 'error', message: 'Could not save signature offline.' });
        }
        setIsSigningSwms(false);
        return;
      }

      const res = await api.post(`/api/swms/${signingSwmsId}/sign`, {
        workerName: signWorkerName.trim(),
        signatureData: swmsSignatureData || 'mobile-text-signature',
        latitude,
        longitude,
        address,
      });
      if (res.error) {
        showToast({ type: 'error', message: res.error });
      } else {
        setShowSignSwmsModal(false);
        setSignWorkerName('');
        setSwmsSignatureData(null);
        setSigningSwmsId(null);
        loadSwmsDocuments();
        showToast({ type: 'success', message: 'SWMS signed successfully' });
      }
    } catch (e) {
      showToast({ type: 'error', message: 'Failed to sign SWMS' });
    } finally {
      setIsSigningSwms(false);
    }
  }, [signingSwmsId, signWorkerName, swmsSignatureData, loadSwmsDocuments, id]);

  const handleDownloadSwmsPdf = useCallback(async (swmsId: string) => {
    try {
      const token = await api.getToken();
      const url = `${API_URL}/api/swms/${swmsId}/pdf`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-mobile-app': 'true',
        },
      });
      if (!response.ok) throw new Error('Failed to download PDF');
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1];
          const fileUri = `${FileSystem.cacheDirectory}swms_${swmsId}.pdf`;
          await FileSystem.writeAsStringAsync(fileUri, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, {
              mimeType: 'application/pdf',
              dialogTitle: 'SWMS Document',
              UTI: 'com.adobe.pdf',
            });
          } else {
            showToast({ type: 'success', message: 'PDF saved to device' });
          }
        } catch (e) {
          showToast({ type: 'error', message: 'Failed to save PDF' });
        }
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      showToast({ type: 'error', message: 'Could not download PDF' });
    }
  }, []);

  const toggleSwmsExpand = useCallback((swmsId: string) => {
    if (expandedSwmsId === swmsId) {
      setExpandedSwmsId(null);
    } else {
      setExpandedSwmsId(swmsId);
      loadSwmsDetails(swmsId);
    }
  }, [expandedSwmsId, loadSwmsDetails]);

  const handleStartCreateSwms = useCallback(() => {
    setSwmsForm({
      title: '', description: '', workActivityDescription: '',
      siteAddress: job?.address || '',
      ppeRequirements: [], emergencyContact: '', firstAidLocation: '', hazards: [],
    });
    setShowTemplatePickerModal(true);
    loadSwmsTemplates();
  }, [job, loadSwmsTemplates]);

  const handleStartBlankSwms = useCallback(() => {
    setShowTemplatePickerModal(false);
    setSwmsForm({
      title: '', description: '', workActivityDescription: '',
      siteAddress: job?.address || '',
      ppeRequirements: [], emergencyContact: '', firstAidLocation: '', hazards: [],
    });
    setShowCreateSwmsModal(true);
  }, [job]);

  const togglePpe = useCallback((key: string) => {
    setSwmsForm(prev => ({
      ...prev,
      ppeRequirements: prev.ppeRequirements.includes(key)
        ? prev.ppeRequirements.filter(k => k !== key)
        : [...prev.ppeRequirements, key],
    }));
  }, []);

  const addHazardRow = useCallback(() => {
    setSwmsForm(prev => ({
      ...prev,
      hazards: [...prev.hazards, { hazardDescription: '', riskConsequence: 'moderate', riskLikelihood: 'possible', controlMeasures: '', responsiblePerson: '' }],
    }));
  }, []);

  const removeHazardRow = useCallback((index: number) => {
    setSwmsForm(prev => ({
      ...prev,
      hazards: prev.hazards.filter((_, i) => i !== index),
    }));
  }, []);

  const updateHazardRow = useCallback((index: number, field: string, value: string) => {
    setSwmsForm(prev => ({
      ...prev,
      hazards: prev.hazards.map((h, i) => i === index ? { ...h, [field]: value } : h),
    }));
  }, []);

  const getRiskColor = useCallback((rating?: string) => {
    switch (rating) {
      case 'low': return colors.success;
      case 'medium': return colors.warning;
      case 'high': return colors.warningDark;
      case 'extreme': return colors.destructive;
      default: return colors.mutedForeground;
    }
  }, [colors]);

  const getStatusColor = useCallback((status?: string) => {
    switch (status) {
      case 'pending': return colors.pending;
      case 'scheduled': return colors.scheduled;
      case 'in_progress': return colors.inProgress;
      case 'done': return colors.done;
      case 'invoiced': return colors.invoiced;
      case 'draft': return colors.mutedForeground;
      case 'active': return colors.success;
      case 'closed': return colors.primary;
      default: return colors.primary;
    }
  }, [colors]);

  useEffect(() => {
    if (activeTab === 'chat' && id) {
      loadJobMessages();
    }
    if (activeTab === 'manage' && id) {
      loadMaterials();
    }
    if (activeTab === 'documents' && id) {
      loadSwmsDocuments();
      loadUploadedDocuments();
    }
  }, [activeTab, id]);

  const handleSendJobMessage = async () => {
    if (!newMessage.trim() || !id) return;
    setIsSendingMessage(true);
    try {
      const res = await api.post<JobChatMessage>(`/api/jobs/${id}/chat`, { message: newMessage.trim() });
      if (res.data) {
        const newMsg = res.data as JobChatMessage;
        setJobMessages(prev => [...prev, newMsg]);
      }
      setNewMessage('');
    } catch (e) {
      showToast({ type: 'error', message: 'Failed to send message' });
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleSaveMaterial = async () => {
    if (!materialForm.name.trim() || !id) return;
    setIsSavingMaterial(true);
    try {
      const payload: any = {
        name: materialForm.name.trim(),
        description: materialForm.description.trim() || undefined,
        quantity: parseFloat(materialForm.quantity) || 1,
        unitCost: parseFloat(materialForm.unitCost) || 0,
        supplier: materialForm.supplier.trim() || undefined,
      };
      if (materialForm.unitPrice) {
        payload.unitPrice = parseFloat(materialForm.unitPrice) || 0;
      }
      if (materialForm.markupPercent) {
        payload.markupPercent = parseFloat(materialForm.markupPercent) || 0;
      }
      if (editingMaterial) {
        await api.patch(`/api/materials/${editingMaterial.id}`, payload);
      } else {
        await api.post(`/api/jobs/${id}/materials`, payload);
      }
      await loadMaterials();
      setShowAddMaterialModal(false);
      setEditingMaterial(null);
      setMaterialForm({ name: '', quantity: '1', unitCost: '', unitPrice: '', markupPercent: '', supplier: '', description: '' });
    } catch (e) {
      showToast({ type: 'error', message: 'Failed to save material' });
    } finally {
      setIsSavingMaterial(false);
    }
  };

  const handleDeleteMaterial = (material: JobMaterial) => {
    confirm({
      title: 'Delete Material',
      message: `Remove "${material.name}" from this job?`,
      confirmText: 'Delete',
      destructive: true,
    }).then(async (ok) => {
      if (!ok) return;
      try {
        await api.delete(`/api/materials/${material.id}`);
        await loadMaterials();
      } catch (e) {
        showToast({ type: 'error', message: 'Error', description: 'Failed to delete material' });
      }
    });
  };

  const handleMaterialStatusChange = (material: JobMaterial) => {
    const currentStatus = material.status || 'needed';
    const options = MATERIAL_STATUS_OPTIONS.map(s => ({
      text: s.charAt(0).toUpperCase() + s.slice(1),
      onPress: () => {
        const newStatus = s;
        const hasCost = Number(material.unitCost || 0) > 0;
        if ((newStatus === 'received' || newStatus === 'installed') && !hasCost) {
          setCostPromptMaterial({ id: material.id, name: material.name, status: newStatus });
          setCostPromptValue('');
          setShowCostPromptModal(true);
        } else {
          updateMaterialStatus(material.id, newStatus);
        }
      },
    }));
    showActionSheet({
      title: 'Material Status',
      message: `Current: ${currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)}`,
      actions: options.map(o => ({ label: o.text, onPress: o.onPress })),
    });
  };

  const updateMaterialStatus = async (materialId: string, status: string, unitCost?: string) => {
    try {
      const body: any = { status };
      if (unitCost !== undefined) body.unitCost = parseFloat(unitCost) || 0;
      await api.patch(`/api/materials/${materialId}`, body);
      await loadMaterials();
    } catch (e) {
      showToast({ type: 'error', message: 'Failed to update material status' });
    }
  };

  const handleCostPromptSubmit = () => {
    if (!costPromptMaterial) return;
    const cost = costPromptValue ? costPromptValue : '0';
    updateMaterialStatus(costPromptMaterial.id, costPromptMaterial.status, cost);
    setCostPromptMaterial(null);
    setCostPromptValue('');
    setShowCostPromptModal(false);
  };

  const handleCostPromptSkip = () => {
    if (!costPromptMaterial) return;
    updateMaterialStatus(costPromptMaterial.id, costPromptMaterial.status);
    setCostPromptMaterial(null);
    setCostPromptValue('');
    setShowCostPromptModal(false);
  };

  const loadJobAssignments = async () => {
    if (!id) return;
    try {
      const response = await api.get(`/api/jobs/${id}/assignments`);
      if (Array.isArray(response.data)) {
        const active = response.data.filter((a: any) => a.isActive);
        setJobAssignments(active);
        offlineStorage.cacheSubscriptionData(`job_assignments_${id}`, active, SEVEN_DAYS_MS).catch(() => {});
      } else if (response.isOffline) {
        const cached = await offlineStorage.getCachedSubscriptionData<any[]>(`job_assignments_${id}`);
        setJobAssignments(Array.isArray(cached) ? cached : []);
      } else {
        setJobAssignments([]);
      }
    } catch (e) {
      setJobAssignments([]);
    } finally {
      // Mark loaded even on failure: the server is the source of truth and
      // safely rejects non-lead completion, so we must not permanently block a
      // legitimate legacy single-assignee from completing when the fetch fails.
      setAssignmentsLoaded(true);
    }
  };

  const loadTeamAvailability = async () => {
    try {
      const response = await api.get('/api/team/members/availability');
      const avail = new Map<string, any>();
      if (Array.isArray(response.data)) {
        response.data.forEach((item: any) => avail.set(item.memberId, item));
      }
      setTeamAvailability(avail);
    } catch (e) {}
  };

  const handleMultiAssign = async () => {
    if (!id || selectedWorkerIds.size === 0) return;
    setIsAssigning(true);
    try {
      const workerIds = Array.from(selectedWorkerIds);
      await api.post(`/api/jobs/${id}/multi-assign`, { workerIds });
      await Promise.all([loadJob(), loadJobAssignments()]);
      setShowAssignModal(false);
      setSelectedWorkerIds(new Set());
    } catch (e) {
      showToast({ type: 'error', message: 'Failed to assign workers' });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRemoveAssignment = async (workerId: string) => {
    if (!id) return;
    confirm({
      title: 'Remove Worker',
      message: 'Remove this worker from the job?',
      confirmText: 'Remove',
      destructive: true,
    }).then(async (ok) => {
      if (!ok) return;
      try {
        await api.delete(`/api/jobs/${id}/assignments/${workerId}/remove`);
        await Promise.all([loadJob(), loadJobAssignments()]);
      } catch (e) {
        showToast({ type: 'error', message: 'Error', description: 'Failed to remove worker' });
      }
    });
  };

  const handleNudgeWorker = async (workerId: string) => {
    if (!id) return;
    setIsNudging(workerId);
    try {
      await api.post(`/api/jobs/${id}/nudge-worker`, { workerId });
      showToast({ type: 'success', message: 'Heads up notification sent to worker' });
    } catch (e) {
      showToast({ type: 'error', message: 'Failed to send notification' });
    } finally {
      setIsNudging(null);
    }
  };

  const handleMakeLead = async (assignmentId: string, workerName: string) => {
    if (!id) return;
    const ok = await confirm({
      title: 'Set Lead Worker',
      message: `Make ${workerName} the lead worker for this job? The lead can finish the job once everyone's part is done.`,
      confirmText: 'Make Lead',
    });
    if (!ok) return;
    const res = await api.post(`/api/jobs/${id}/assignments/${assignmentId}/make-lead`, {});
    if (res.error) {
      showToast({ type: 'error', message: 'Error', description: res.error || 'Failed to set lead worker.' });
      return;
    }
    await Promise.all([loadJob(), loadJobAssignments()]);
    showToast({ type: 'success', message: 'Lead updated', description: `${workerName} is now the lead worker.` });
  };

  const handleAssignWorker = async (memberId: string | null) => {
    if (!id) return;
    setIsAssigning(true);
    try {
      await api.patch(`/api/jobs/${id}`, { assignedTo: memberId });
      await Promise.all([loadJob(), loadJobAssignments()]);
      setShowAssignModal(false);
    } catch (e) {
      showToast({ type: 'error', message: 'Failed to assign worker' });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleQuickMagicLink = async () => {
    if (!id) return;
    if (!magicLinkName.trim()) {
      showToast({ type: 'error', message: 'Please enter a name' });
      return;
    }
    if (!magicLinkPhone.trim()) {
      showToast({ type: 'error', message: 'Please enter a phone number' });
      return;
    }
    setIsSendingMagicLink(true);
    try {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const res = await api.post(`/api/jobs/${id}/subcontractor-token`, {
        contactName: magicLinkName.trim(),
        contactPhone: magicLinkPhone.trim(),
        hourlyRate: magicLinkRate.trim() ? parseFloat(magicLinkRate) : undefined,
        sendViaSms: true,
        sendViaEmail: false,
        permissions: ['view_job', 'add_notes', 'add_photos', 'update_status'],
        expiresAt,
      }) as { error?: string; data?: { sendResults?: { sms?: boolean } } };
      if (res.error) {
        showToast({ type: 'error', message: res.error });
      } else {
        const smsStatus = (res.data as { sendResults?: { sms?: boolean } } | null)?.sendResults?.sms;
        showToast({ type: 'info', message: 'Invite Sent', description: smsStatus !== false
            ? `Magic link sent to ${magicLinkName.trim()} via SMS`
            : `Invite created for ${magicLinkName.trim()}. SMS delivery may be pending.` });
        setShowAssignModal(false);
        setShowMagicLinkInAssign(false);
        setMagicLinkName('');
        setMagicLinkPhone('');
        setMagicLinkRate('');
        loadSubcontractorTokens();
      }
    } catch (e) {
      showToast({ type: 'error', message: 'Failed to send magic link' });
    } finally {
      setIsSendingMagicLink(false);
    }
  };

  // Fetch client's saved signature when client changes
  useEffect(() => {
    const fetchClientSavedSignature = async () => {
      if (!client?.id) {
        setClientSavedSignature(null);
        return;
      }
      try {
        const response = await api.get<{ signatureData: string; signerName: string }>(`/api/clients/${client.id}/saved-signature`);
        if (response.data && response.data.signatureData) {
          setClientSavedSignature(response.data);
        } else {
          setClientSavedSignature(null);
        }
      } catch (error) {
        if (__DEV__) console.log('No saved signature for client:', error);
        setClientSavedSignature(null);
      }
    };
    fetchClientSavedSignature();
  }, [client?.id]);

  const handleSmartActionToggle = (actionId: string, enabled: boolean) => {
    setSmartActions(prev => 
      prev.map(action => 
        action.id === actionId ? { ...action, enabled } : action
      )
    );
  };

  const executeAction = async (action: SmartAction): Promise<boolean> => {
    if (!job) return false;

    try {
      // Use action.id for more specific routing when needed
      switch (action.id) {
        case 'create_invoice':
          router.push(`/more/invoice/new?jobId=${job.id}${client ? `&clientId=${client.id}` : ''}`);
          return true;

        case 'create_quote':
          router.push(`/more/quote/new?jobId=${job.id}${client ? `&clientId=${client.id}` : ''}`);
          return true;

        case 'mark_complete':
          api.get<SiteAttendance>(`/api/jobs/${job.id}/site-attendance`).then(res => {
            if (res.data && !res.error) setSiteAttendance(res.data);
          }).catch(() => {});
          setShowCompletionModal(true);
          return true;

        case 'send_invoice_email':
          if (client?.email && invoice?.id) {
            try {
              const emailResponse = await api.post(`/api/invoices/${invoice.id}/send`, {
                method: 'email',
              });
              if (emailResponse.error) {
                const invoiceNumber = (invoice as any)?.number || (invoice.id || '').slice(0, 8);
                const total = invoice?.total ? `$${Number(invoice.total).toFixed(2)}` : '';
                const subject = `Invoice ${invoiceNumber}${total ? ` - ${total}` : ''}`;
                const body = `G'day ${client.name || 'there'},\n\nPlease find your invoice for ${job.title}${total ? ` totalling ${total}` : ''}.\n\nYou can view and pay your invoice here:\n${API_URL.replace('/api', '')}/invoices/${invoice.id}/pay\n\nThanks for your business!`;
                await Linking.openURL(`mailto:${client.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
                showToast({ type: 'info', message: 'Email Ready', description: 'Your email app has opened with the invoice details. Review and send when ready.' });
              } else {
                showToast({ type: 'success', message: 'Email Sent', description: `Invoice email sent to ${client.email}` });
              }
            } catch {
              const invoiceNumber = (invoice as any)?.number || (invoice.id || '').slice(0, 8);
              const total = invoice?.total ? `$${Number(invoice.total).toFixed(2)}` : '';
              const subject = `Invoice ${invoiceNumber}${total ? ` - ${total}` : ''}`;
              const body = `G'day ${client.name || 'there'},\n\nPlease find your invoice for ${job.title}${total ? ` totalling ${total}` : ''}.\n\nYou can view and pay your invoice here:\n${API_URL.replace('/api', '')}/invoices/${invoice.id}/pay\n\nThanks for your business!`;
              await Linking.openURL(`mailto:${client.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
              showToast({ type: 'info', message: 'Email Ready', description: 'Your email app has opened with the invoice details. Review and send when ready.' });
            }
          } else if (client?.email) {
            await Linking.openURL(`mailto:${client.email}?subject=Invoice for ${job.title}`);
          } else {
            showToast({ type: 'info', message: 'No Email', description: 'This client doesn\'t have an email address on file.' });
          }
          return true;

        case 'send_invoice_sms':
          if (client?.phone) {
            const invoiceSmsMessage = `Hi! Your invoice for ${job.title} is ready. Please check your email for payment details.`;
            try {
              const smsResponse = await api.post('/api/sms/send', {
                clientPhone: client.phone,
                message: invoiceSmsMessage,
                clientId: client.id,
                jobId: job.id,
              });
              if (smsResponse.error) {
                fallbackToNativeSms(client.phone, invoiceSmsMessage);
              } else {
                showToast({ type: 'success', message: 'SMS Sent', description: `Invoice SMS sent to ${client.name || client.phone}` });
              }
            } catch {
              fallbackToNativeSms(client.phone, invoiceSmsMessage);
            }
          }
          return true;

        case 'send_quote_email':
          if (client?.email && quote?.id) {
            try {
              const quoteEmailResponse = await api.post(`/api/quotes/${quote.id}/send`, {
                method: 'email',
              });
              if (quoteEmailResponse.error) {
                const quoteNumber = (quote as any)?.number || (quote.id || '').slice(0, 8);
                const total = (quote as any)?.total ? `$${Number((quote as any).total).toFixed(2)}` : '';
                const subject = `Quote ${quoteNumber}${total ? ` - ${total}` : ''}`;
                const body = `G'day ${client.name || 'there'},\n\nPlease find your quote for ${job.title}${total ? ` totalling ${total}` : ''}.\n\nYou can view and accept this quote here:\n${API_URL.replace('/api', '')}/q/${(quote as any)?.acceptanceToken || quote.id}\n\nLet me know if you have any questions!`;
                await Linking.openURL(`mailto:${client.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
                showToast({ type: 'info', message: 'Email Ready', description: 'Your email app has opened with the quote details. Review and send when ready.' });
              } else {
                showToast({ type: 'success', message: 'Email Sent', description: `Quote email sent to ${client.email}` });
              }
            } catch {
              const quoteNumber = (quote as any)?.number || (quote.id || '').slice(0, 8);
              const total = (quote as any)?.total ? `$${Number((quote as any).total).toFixed(2)}` : '';
              const subject = `Quote ${quoteNumber}${total ? ` - ${total}` : ''}`;
              const body = `G'day ${client.name || 'there'},\n\nPlease find your quote for ${job.title}${total ? ` totalling ${total}` : ''}.\n\nYou can view and accept this quote here:\n${API_URL.replace('/api', '')}/q/${(quote as any)?.acceptanceToken || quote.id}\n\nLet me know if you have any questions!`;
              await Linking.openURL(`mailto:${client.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
              showToast({ type: 'info', message: 'Email Ready', description: 'Your email app has opened with the quote details. Review and send when ready.' });
            }
          } else if (client?.email) {
            await Linking.openURL(`mailto:${client.email}?subject=Quote for ${job.title}`);
          } else {
            showToast({ type: 'info', message: 'No Email', description: 'This client doesn\'t have an email address on file.' });
          }
          return true;

        case 'send_confirmation':
          if (client?.email) {
            try {
              await api.post(`/api/jobs/${job.id}/send-confirmation`, {});
              showToast({ type: 'success', message: 'Confirmation email sent' });
            } catch {
              await Linking.openURL(`mailto:${client.email}?subject=Booking Confirmed: ${job.title}`);
            }
          }
          return true;

        case 'send_reminder':
          if (invoice?.id) {
            try {
              await api.post(`/api/invoices/${invoice.id}/reminder`, {});
              showToast({ type: 'success', message: 'Payment reminder sent' });
            } catch {
              showToast({ type: 'error', message: 'Failed to send reminder' });
            }
          }
          return true;

        case 'schedule_followup':
          router.push(`/more/create-job?copyFromId=${job.id}`);
          return true;

        case 'collect_payment':
          if (invoice?.id) {
            router.push(`/more/collect-payment?invoiceId=${invoice.id}&jobId=${job?.id}`);
          } else {
            showToast({ type: 'info', message: 'No Invoice', description: 'Please create an invoice first to collect payment.' });
          }
          return true;

        default:
          // Fall back to type-based routing for any other actions
          switch (action.type) {
            case 'send_email':
              if (client?.email) {
                await Linking.openURL(`mailto:${client.email}?subject=${encodeURIComponent(job.title)}`);
              }
              return true;

            case 'send_sms':
              if (client?.phone) {
                // Open the in-app SMS composer so the worker can pick a
                // template rather than firing a canned message blind.
                try {
                  const convRes = await api.post<any>('/api/sms/conversations/find-or-create', {
                    phone: client.phone,
                    clientId: client.id,
                    clientName: client.name,
                    jobId: job.id,
                  });
                  if (!convRes.error && convRes.data?.id) {
                    router.push(`/more/sms-conversation?id=${convRes.data.id}&phone=${encodeURIComponent(client.phone)}&name=${encodeURIComponent(client.name || '')}&jobId=${job.id}` as any);
                    return true;
                  }
                  fallbackToNativeSms(client.phone, `Re: ${job.title}`);
                } catch {
                  fallbackToNativeSms(client.phone, `Re: ${job.title}`);
                }
              }
              return true;

            default:
              return false;
          }
      }
    } catch (error) {
      console.error(`Error executing action ${action.id}:`, error);
      return false;
    }
  };

  const handleSmartActionExecute = async (actionId: string) => {
    const action = smartActions.find(a => a.id === actionId);
    if (!action || !job) return;

    setSmartActions(prev =>
      prev.map(a => a.id === actionId ? { ...a, status: 'running' as const } : a)
    );

    const success = await executeAction(action);

    setSmartActions(prev =>
      prev.map(a => a.id === actionId ? { ...a, status: success ? 'completed' as const : 'pending' as const } : a)
    );
  };

  const handleExecuteAllActions = async () => {
    if (!job) return;
    
    setIsExecutingActions(true);
    try {
      const enabledActions = smartActions.filter(a => a.enabled && a.status !== 'completed');
      
      for (const action of enabledActions) {
        setSmartActions(prev =>
          prev.map(a => a.id === action.id ? { ...a, status: 'running' as const } : a)
        );

        const success = await executeAction(action);

        setSmartActions(prev =>
          prev.map(a => a.id === action.id ? { ...a, status: success ? 'completed' as const : 'pending' as const } : a)
        );

        if ((action.type as string) === 'create_invoice' || (action.type as string) === 'create_quote') {
          break;
        }
      }
    } catch (error) {
      showToast({ type: 'error', message: 'Failed to execute actions' });
    } finally {
      setIsExecutingActions(false);
    }
  };

  const handleSkipAllActions = () => {
    setSmartActions(prev =>
      prev.map(action => ({ ...action, enabled: false, status: 'skipped' as const }))
    );
  };

  const loadJob = async () => {
    if (!id) {
      console.error('No job ID provided');
      setLoadError('No job ID provided');
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setLoadError(null);
    try {
      // Jobs created offline have a "local_" id the server doesn't know about
      // (it gets swapped for a real id when the sync queue runs). Load them
      // straight from the local cache — a server fetch would always 404.
      if (id.startsWith('local_')) {
        const cached = await offlineStorage.getCachedJob(id);
        if (cached) {
          setJob(cached as unknown as Job);
          setSliderRadius(cached.geofenceRadius || 100);
          setPortalEnabled(false);
          if (cached.clientId) {
            const cachedClient = await offlineStorage.getCachedClient(cached.clientId);
            if (cachedClient) setClient(cachedClient as unknown as Client);
          }
          setIsLoading(false);
          return;
        }
        // Not in cache under the local id — the sync queue may have already
        // swapped it for a server id. Fall through to the normal fetch; if the
        // server also doesn't know it, show a friendly syncing message.
        const response = await api.get<Job>(`/api/jobs/${id}`);
        if (response.data) {
          setJob(response.data);
          setSliderRadius(response.data.geofenceRadius || 100);
          setPortalEnabled(!!response.data.portalEnabled);
        } else {
          setLoadError('This job is still syncing. Go back and reopen it from the jobs list.');
        }
        setIsLoading(false);
        return;
      }

      const response = await api.get<Job>(`/api/jobs/${id}`);
      if (response.error) {
        // Offline fallback ONLY: when the device has no connection, the job
        // may be in the local SQLite cache (job lists cache every job they
        // load). Never fall back on real server errors (401/403/404) — that
        // would show cached data the server just denied.
        if (response.isOffline) {
          try {
            const cached = await offlineStorage.getCachedJob(id);
            if (cached) {
              setJob(cached as unknown as Job);
              setSliderRadius(cached.geofenceRadius || 100);
              setPortalEnabled(false);
              if (cached.clientId) {
                const cachedClient = await offlineStorage.getCachedClient(cached.clientId);
                if (cachedClient) setClient(cachedClient as unknown as Client);
              }
              setIsLoading(false);
              return;
            }
          } catch {}
        }
        setLoadError(response.error);
        setIsLoading(false);
        return;
      }
      if (response.data) {
        setJob(response.data);
        setSliderRadius(response.data.geofenceRadius || 100);
        setPortalEnabled(!!response.data.portalEnabled);
        if (response.data.clientId) {
          const clientResponse = await api.get<Client>(`/api/clients/${response.data.clientId}`);
          if (clientResponse.data) {
            setClient(clientResponse.data);
          }
          loadLinkedJobs(response.data.clientId);
        }
        api.getJobConflicts().then(conflictRes => {
          if (conflictRes.data?.conflicts) {
            const match = conflictRes.data.conflicts.find(
              (c: { job1: { id: string }; job2: { id: string } }) => c.job1.id === id || c.job2.id === id
            );
            if (match) {
              const isJob1 = match.job1.id === id;
              setJobConflictWarning({
                otherJobTitle: isJob1 ? match.job2.title : match.job1.title,
                otherBusinessName: isJob1 ? match.job2.businessName : match.job1.businessName,
                overlapMinutes: match.overlapMinutes,
              });
            }
          }
        }).catch((err) => {
          if (__DEV__) console.log('[JobDetail] Could not check job conflicts:', err);
        });
      }
    } catch (error) {
      console.error('Failed to load job:', error);
      setLoadError(error instanceof Error ? error.message : 'Failed to load job. Please try again.');
    }
    setIsLoading(false);
  };
  
  const loadLinkedJobs = async (clientId?: string) => {
    const cId = clientId || job?.clientId;
    if (!cId) return;
    try {
      const response = await api.get<Job[]>('/api/jobs');
      if (response.data && Array.isArray(response.data)) {
        const otherJobs = response.data
          .filter((j: any) => j.clientId === cId && j.id !== id)
          .sort((a: any, b: any) => {
            const dateA = a.scheduledAt || a.completedAt || '';
            const dateB = b.scheduledAt || b.completedAt || '';
            return new Date(dateB).getTime() - new Date(dateA).getTime();
          })
          .slice(0, 3);
        setLinkedJobs(otherJobs);
      }
    } catch (error) {
      if (__DEV__) console.log('Could not load linked jobs:', error);
      setLinkedJobs([]);
    }
  };

  // Load automation settings for photo gate enforcement
  const loadAutomationSettings = async () => {
    try {
      const response = await api.get<{
        requirePhotoBeforeStart: boolean;
        requirePhotoAfterComplete: boolean;
      }>('/api/automation-settings');
      if (response.data) {
        setAutomationSettings({
          requirePhotoBeforeStart: response.data.requirePhotoBeforeStart ?? false,
          requirePhotoAfterComplete: response.data.requirePhotoAfterComplete ?? false,
        });
      }
    } catch (error) {
      if (__DEV__) console.log('Could not load automation settings:', error);
      // Default to no photo requirements if settings can't be loaded
      setAutomationSettings({
        requirePhotoBeforeStart: false,
        requirePhotoAfterComplete: false,
      });
    }
  };

  const loadPhotos = async () => {
    try {
      const response = await api.get<JobPhoto[]>(`/api/jobs/${id}/photos`);
      if (Array.isArray(response.data)) {
        setPhotos(response.data);
      }
    } catch (error) {
      if (__DEV__) console.log('No photos or error loading:', error);
      setPhotos([]);
    }
  };

  const loadJobNotes = async () => {
    try {
      const response = await api.get<JobNoteItem[]>(`/api/jobs/${id}/notes`);
      if (!response.error && Array.isArray(response.data)) {
        setJobNotes(response.data);
      }
    } catch (error) {
      if (__DEV__) console.log('No job notes or error loading:', error);
    }
  };

  const loadVoiceNotes = async () => {
    try {
      const response = await api.get<VoiceNote[]>(`/api/jobs/${id}/voice-notes`);
      if (Array.isArray(response.data)) {
        setVoiceNotes(response.data);
      }
    } catch (error) {
      if (__DEV__) console.log('No voice notes or error loading:', error);
      setVoiceNotes([]);
    }
  };

  const handleUploadVoiceNote = async (uri: string, duration: number) => {
    if (!job) return;
    
    setIsUploadingVoiceNote(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      const audioData = await base64Promise;
      
      await api.post(`/api/jobs/${job.id}/voice-notes`, {
        audioData,
        fileName: `voice-note-${Date.now()}.m4a`,
        mimeType: 'audio/m4a',
        duration,
      });
      
      await loadVoiceNotes();
      setShowVoiceRecorder(false);
      showToast({ type: 'success', message: 'Voice note saved' });
    } catch (error) {
      console.error('Error uploading voice note:', error);
      showToast({ type: 'error', message: 'Failed to upload voice note' });
    } finally {
      setIsUploadingVoiceNote(false);
    }
  };

  const handleFABVoiceNoteSave = async (uri: string, duration: number) => {
    if (!job) return;
    
    setIsUploadingFABVoice(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      const audioData = await base64Promise;
      
      const uploadResponse = await api.post<{ id: string }>(`/api/jobs/${job.id}/voice-notes`, {
        audioData,
        fileName: `voice-note-${Date.now()}.m4a`,
        mimeType: 'audio/m4a',
        duration,
      });
      
      await loadVoiceNotes();
      setShowFABVoiceModal(false);
      setIsFABRecording(false);
      
      const noteId = uploadResponse.data?.id;
      if (noteId) {
        try {
          const transcribeResponse = await api.post<{ transcription: string }>(`/api/jobs/${job.id}/voice-notes/${noteId}/transcribe`);
          if (transcribeResponse.data?.transcription) {
            const transcribedText = transcribeResponse.data.transcription;
            
            setVoiceNotes(prev => prev.map(v => 
              v.id === noteId ? { ...v, transcription: transcribedText } : v
            ));
            
            // Save the transcription as a structured job note (the legacy
            // jobs.notes field is ignored by the server on PATCH).
            const noteRes = await api.post(`/api/jobs/${job.id}/notes`, { content: `[Voice Note]\n${transcribedText}` });
            if (!noteRes.error) {
              await loadJobNotes();
              showToast({ type: 'info', message: 'Voice Note Saved', description: 'Recording transcribed and added to job notes.' });
            } else {
              showToast({ type: 'info', message: 'Voice Note Saved', description: 'Transcribed, but could not add to job notes.' });
            }
          } else {
            showToast({ type: 'info', message: 'Voice Note Saved', description: 'Recording saved. Transcription unavailable.' });
          }
        } catch (transcribeError) {
          console.error('Transcription failed:', transcribeError);
          showToast({ type: 'info', message: 'Voice Note Saved', description: 'Recording saved but transcription failed.' });
        }
      } else {
        showToast({ type: 'success', message: 'Voice note saved' });
      }
    } catch (error) {
      console.error('Error uploading FAB voice note:', error);
      showToast({ type: 'error', message: 'Failed to upload voice note' });
    } finally {
      setIsUploadingFABVoice(false);
    }
  };

  const handleDeleteVoiceNote = async (voiceNoteId: string) => {
    if (!job) return;
    
    confirm({
      title: 'Delete Voice Note',
      message: 'Are you sure you want to delete this voice note?',
      confirmText: 'Delete',
      destructive: true,
    }).then(async (ok) => {
      if (!ok) return;
      try {
        await api.delete(`/api/jobs/${job.id}/voice-notes/${voiceNoteId}`);
        setVoiceNotes(voiceNotes.filter(v => v.id !== voiceNoteId));
      } catch (error) {
        console.error('Error deleting voice note:', error);
        showToast({ type: 'error', message: 'Error', description: 'Failed to delete voice note' });
      }
    });
  };

  const handleDeleteJob = () => {
    if (!job) return;
    
    confirm({
      title: 'Delete Job',
      message: `Are you sure you want to delete "${job.title}"? This action cannot be undone.\n\nAll photos, notes, and other data associated with this job will be permanently deleted.`,
      confirmText: 'Delete',
      destructive: true,
    }).then(async (ok) => {
      if (!ok) return;
      setIsDeletingJob(true);
      try {
        await api.delete(`/api/jobs/${job.id}`);
        showToast({ type: 'success', message: 'Job Deleted', description: 'The job has been permanently deleted' });
        router.back();
      } catch (error) {
        console.error('Error deleting job:', error);
        showToast({ type: 'error', message: 'Error', description: 'Failed to delete job' });
      } finally {
        setIsDeletingJob(false);
      }
    });
  };

  const handleCloneJob = async () => {
    if (!job) return;
    setIsCloningJob(true);
    try {
      const response = await api.post(`/api/jobs/${job.id}/clone`);
      if (response.data) {
        const newJob = response.data as Job;
        showToast({ type: 'info', message: 'Job Duplicated', description: `"${newJob.title}" has been created` });
        router.replace(`/job/${newJob.id}`);
      }
    } catch (error) {
      console.error('Error cloning job:', error);
      showToast({ type: 'error', message: 'Failed to duplicate job' });
    } finally {
      setIsCloningJob(false);
    }
  };

  const showJobActionsMenu = () => {
    const options: string[] = [];
    const actions: (() => void)[] = [];

    if (isOwnerOrManager || isSoloOwner) {
      options.push('Duplicate Job');
      actions.push(handleCloneJob);
    }
    if (canDeleteJobs) {
      options.push('Delete Job');
      actions.push(handleDeleteJob);
    }
    options.push('Cancel');

    const cancelButtonIndex = options.length - 1;
    const destructiveButtonIndex = options.indexOf('Delete Job');

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
          destructiveButtonIndex: destructiveButtonIndex >= 0 ? destructiveButtonIndex : undefined,
          title: 'Job Actions',
        },
        (buttonIndex) => {
          if (buttonIndex !== cancelButtonIndex && actions[buttonIndex]) {
            actions[buttonIndex]();
          }
        }
      );
    } else {
      Alert.alert(
        'Job Actions',
        undefined,
        options.map((label, i) => ({
          text: label,
          style: (label === 'Cancel'
            ? 'cancel'
            : label === 'Delete Job'
              ? 'destructive'
              : 'default') as 'cancel' | 'destructive' | 'default',
          onPress: label === 'Cancel' ? undefined : actions[i],
        })),
      );
    }
  };

  const loadSignatures = async () => {
    try {
      const response = await api.get<DigitalSignature[]>(`/api/jobs/${id}/signatures`);
      if (Array.isArray(response.data)) {
        setSignatures(response.data);
      }
    } catch (error) {
      if (__DEV__) console.log('No signatures or error loading:', error);
      setSignatures([]);
    }
  };

  const handleSaveSignature = async (data: { signerName: string; signerEmail?: string; signatureData: string }) => {
    if (!job) return;
    
    setIsSavingSignature(true);
    try {
      await api.post(`/api/jobs/${job.id}/signatures`, {
        signerName: data.signerName,
        signerEmail: data.signerEmail,
        signatureData: data.signatureData,
        signerRole: signerRole,
        saveToClient: saveToClient && signerRole === 'client'
      });
      await loadSignatures();
      setShowSignaturePad(false);
      setSignerRole('client');
      setSaveToClient(true);
      showToast({ type: 'success', message: 'Signature captured successfully' });
    } catch (error) {
      console.error('Error saving signature:', error);
      showToast({ type: 'error', message: 'Failed to save signature' });
    } finally {
      setIsSavingSignature(false);
    }
  };

  // Direct delete without confirmation (for re-sign flow) - returns success boolean
  const deleteSignatureDirectly = async (signatureId: string): Promise<boolean> => {
    if (!job) return false;
    try {
      await api.delete(`/api/jobs/${job.id}/signatures/${signatureId}`);
      // Use functional state update to prevent desync
      setSignatures(prev => prev.filter(s => s.id !== signatureId));
      return true;
    } catch (error) {
      console.error('Error deleting signature:', error);
      showToast({ type: 'error', message: 'Failed to delete signature. Please try again.' });
      return false;
    }
  };

  const handleDeleteSignature = (signatureId: string) => {
    if (!job) return;
    
    confirm({
      title: 'Delete Signature',
      message: 'Are you sure you want to delete this signature?',
      confirmText: 'Delete',
      destructive: true,
    }).then((ok) => {
      if (ok) deleteSignatureDirectly(signatureId);
    });
  };

  const loadRelatedDocuments = async () => {
    // Use the dedicated linked-documents endpoint for efficiency
    try {
      const response = await api.get<{
        linkedQuote: any;
        linkedInvoice: any;
        quoteCount: number;
        invoiceCount: number;
      }>(`/api/jobs/${id}/linked-documents`);
      
      if (response.data) {
        if (response.data.linkedQuote) {
          setQuote({
            id: response.data.linkedQuote.id,
            number: response.data.linkedQuote.number,
            title: response.data.linkedQuote.title,
            total: parseFloat(response.data.linkedQuote.total) || 0,
            status: response.data.linkedQuote.status,
          });
        } else {
          setQuote(null);
        }
        
        if (response.data.linkedInvoice) {
          const linkedInv = response.data.linkedInvoice;
          setInvoice({
            id: linkedInv.id,
            number: linkedInv.number,
            title: linkedInv.title,
            total: parseFloat(linkedInv.total) || 0,
            status: linkedInv.status,
            dueDate: linkedInv.dueDate,
            paidAmount: 0,
          });
          
          // If invoice is paid, try to fetch related receipt
          if (linkedInv.status?.toLowerCase() === 'paid') {
            try {
              const receiptsResponse = await api.get<any[]>(`/api/receipts?invoiceId=${linkedInv.id}`);
              if (receiptsResponse.data && receiptsResponse.data.length > 0) {
                const receipt = receiptsResponse.data[0];
                setLinkedReceipt({
                  id: receipt.id,
                  receiptNumber: receipt.receiptNumber,
                  amount: parseFloat(receipt.amount) || 0,
                  paymentMethod: receipt.paymentMethod,
                  createdAt: receipt.createdAt,
                });
              } else {
                setLinkedReceipt(null);
              }
            } catch {
              setLinkedReceipt(null);
            }
          } else {
            setLinkedReceipt(null);
          }
        } else {
          setInvoice(null);
          setLinkedReceipt(null);
        }
      }
    } catch (error) {
      if (__DEV__) console.log('Error loading linked documents:', error);
      // Clear the state on error
      setQuote(null);
      setInvoice(null);
      setLinkedReceipt(null);
    }
  };

  const loadTimeEntries = async () => {
    try {
      const response = await api.get<CompletedTimeEntry[]>(`/api/time-entries?jobId=${id}&teamView=true`);
      if (Array.isArray(response.data)) {
        setTimeEntries(response.data);
      }
    } catch (error) {
      if (__DEV__) console.log('Error loading time entries:', error);
      setTimeEntries([]);
    }
  };
  
  const loadTeamTimers = async () => {
    try {
      const response = await api.get(`/api/time-entries/job-team-timers/${id}`);
      if (response.data && Array.isArray(response.data)) {
        setTeamTimers(response.data);
      }
    } catch (error) {
      if (__DEV__) console.log('Error loading team timers:', error);
      setTeamTimers([]);
    }
  };

  const handleSaveRate = async () => {
    if (!editRateTimer) return;
    const parsed = parseFloat(rateInput);
    if (isNaN(parsed) || parsed < 0) {
      Alert.alert('Invalid Rate', 'Enter a valid hourly rate.');
      return;
    }
    setIsSavingRate(true);
    try {
      const res = await api.patch(`/api/time-entries/${editRateTimer.id}`, {
        hourlyRate: parsed.toFixed(2),
        editReason: 'Hourly rate corrected by manager',
      });
      if (res.error) {
        Alert.alert('Could not update', res.error);
        return;
      }
      setEditRateTimer(null);
      await loadTeamTimers();
      Alert.alert('Updated', 'Hourly rate updated for this job.');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to update rate.');
    } finally {
      setIsSavingRate(false);
    }
  };
  
  // Calculate total hours from completed time entries (startTime and endTime)
  // Also includes the active timer if it's running for this job
  const calculateTotalTrackedHours = (): number => {
    let totalMinutes = 0;
    timeEntries.forEach(entry => {
      // Only count entries that have a valid endTime (completed entries)
      // Skip active timers (no endTime) and entries with null/empty endTime
      if (entry.startTime && entry.endTime && entry.endTime !== 'null' && entry.endTime !== '') {
        try {
          const start = new Date(entry.startTime);
          const end = new Date(entry.endTime);
          // Validate dates are valid
          if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start) {
            const durationMs = end.getTime() - start.getTime();
            totalMinutes += durationMs / (1000 * 60);
          }
        } catch {
          // Skip invalid entries
        }
      }
    });
    
    // Add active timer elapsed time if it's for this job
    if (isTimerForThisJob && elapsedTime > 0) {
      totalMinutes += elapsedTime;
    }
    
    return totalMinutes / 60;
  };
  
  const totalTrackedHours = calculateTotalTrackedHours();

  const loadActivityLog = async () => {
    // Note: Timeline endpoint may not exist yet - fail gracefully
    try {
      const response = await api.get<ActivityItem[]>(`/api/jobs/${id}/activity`);
      if (response.data && Array.isArray(response.data)) {
        setActivityLog(response.data);
      }
    } catch (error) {
      // Activity log is optional - fail gracefully
      setActivityLog([]);
    }
  };

  const loadJobExpenses = async () => {
    setIsLoadingExpenses(true);
    try {
      const response = await api.get<any[]>(`/api/expenses?jobId=${id}`);
      if (response.data && Array.isArray(response.data)) {
        setJobExpenses(response.data);
      }
    } catch (error) {
      if (__DEV__) console.log('Error loading job expenses:', error);
      setJobExpenses([]);
    } finally {
      setIsLoadingExpenses(false);
    }
  };

  const handleConvertToInvoice = async () => {
    if (!quote?.id) return;
    
    setIsConvertingToInvoice(true);
    try {
      const response = await api.post<{ id: string }>(`/api/quotes/${quote.id}/convert-to-invoice`, {});
      if (response.data) {
        showToast({ type: 'success', message: 'Quote converted to invoice successfully' });
        router.push(`/more/invoice/${response.data.id}`);
      }
    } catch (error: any) {
      showToast({ type: 'error', message: error.message || 'Failed to convert quote to invoice' });
    } finally {
      setIsConvertingToInvoice(false);
    }
  };

  const handleRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    await Promise.all([
      loadJob(), 
      loadPhotos(), 
      loadVoiceNotes(),
      loadJobNotes(),
      loadSignatures(),
      loadRelatedDocuments(),
      loadTimeEntries(),
      loadTeamTimers(),
      loadActivityLog(),
      loadJobExpenses(),
      loadSubcontractorTokens(),
      loadProfitability(),
      loadPortalLinks(),
    ]);
    setRefreshing(false);
  };

  const loadProfitability = useCallback(async () => {
    if (!id) return;
    setIsLoadingProfitability(true);
    try {
      const res = await api.get<ProfitabilityData>(`/api/jobs/${id}/profitability`);
      // On a non-2xx the api client returns the ERROR body as res.data (e.g.
      // { error: "Job not found" } for a 404/403 — owner-only financials a
      // worker can't read). That object is truthy but has no revenue/costs, so
      // storing it would crash the render. Only accept a well-formed payload and
      // normalize once into a fully-formed shape with numeric defaults so no
      // render site can ever hit an undefined leaf.
      const raw = res.data as any;
      if (raw && !res.error && raw.revenue && raw.costs && raw.profit && raw.hours) {
        const n = (v: any) => (typeof v === 'number' && isFinite(v) ? v : 0);
        setProfitabilityData({
          jobId: raw.jobId,
          jobTitle: raw.jobTitle,
          jobStatus: raw.jobStatus,
          clientName: raw.clientName,
          quoted: raw.quoted ?? null,
          revenue: { invoiced: n(raw.revenue.invoiced), pending: n(raw.revenue.pending), received: n(raw.revenue.received) },
          costs: {
            labour: n(raw.costs.labour), subcontractor: n(raw.costs.subcontractor),
            materials: n(raw.costs.materials), otherExpenses: n(raw.costs.otherExpenses),
            expenses: n(raw.costs.expenses), total: n(raw.costs.total),
          },
          profit: { amount: n(raw.profit.amount), margin: n(raw.profit.margin), vsQuote: raw.profit.vsQuote ?? null },
          hours: { total: n(raw.hours.total), billable: n(raw.hours.billable), nonBillable: n(raw.hours.nonBillable) },
          status: raw.status === 'profitable' || raw.status === 'tight' || raw.status === 'loss' ? raw.status : 'loss',
          materials: Array.isArray(raw.materials) ? raw.materials : [],
        });
      } else {
        setProfitabilityData(null);
      }
    } catch (e) {
      if (__DEV__) console.log('Profitability data not available:', e);
    } finally {
      setIsLoadingProfitability(false);
    }
  }, [id]);

  const loadPortalLinks = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.get<any[]>(`/api/jobs/${id}/portal-links`);
      if (Array.isArray(res.data)) {
        setPortalLinks(res.data.filter((t: any) => !t.revokedAt));
      }
    } catch (e) {
      if (__DEV__) console.log('Portal links not available:', e);
    }
  }, [id]);

  const handleGenerateProofPack = async () => {
    if (!job) return;
    setIsGeneratingProofPack(true);
    try {
      const token = await api.getToken();
      const hiddenParts: string[] = [];
      Object.entries(proofPackSections).forEach(([key, val]) => {
        if (!val) hiddenParts.push(`hide_${key}=1`);
      });
      const queryStr = hiddenParts.join('&');
      const pdfUrl = `${API_URL}/api/jobs/${job.id}/proof-pack${queryStr ? `?${queryStr}` : ''}`;
      const filename = `proof-pack-${job.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      const localUri = `${FileSystem.cacheDirectory}${filename}`;

      const downloadResult = await FileSystem.downloadAsync(pdfUrl, localUri, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (downloadResult.status === 200) {
        setShowProofPackModal(false);
        const isSharingAvailable = await Sharing.isAvailableAsync();
        if (isSharingAvailable) {
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Share Proof Pack',
          });
        } else {
          showToast({ type: 'success', message: 'Proof Pack PDF downloaded successfully' });
        }
      } else {
        showToast({ type: 'error', message: 'Failed to generate Proof Pack PDF' });
      }
    } catch (error: any) {
      console.error('Proof pack error:', error);
      showToast({ type: 'error', message: error.message || 'Failed to generate Proof Pack' });
    } finally {
      setIsGeneratingProofPack(false);
    }
  };

  const handleExportProofPackTsv = async () => {
    if (!job) return;
    setIsExportingProofPackTsv(true);
    try {
      const token = await api.getToken();
      const hiddenParts: string[] = [];
      Object.entries(proofPackSections).forEach(([key, val]) => {
        if (!val) hiddenParts.push(`hide_${key}=1`);
      });
      hiddenParts.push('format=tsv');
      const tsvUrl = `${API_URL}/api/jobs/${job.id}/proof-pack/export?${hiddenParts.join('&')}`;
      const filename = `proof-pack-${job.title.replace(/[^a-zA-Z0-9]/g, '_')}.tsv`;
      const localUri = `${FileSystem.cacheDirectory}${filename}`;

      const downloadResult = await FileSystem.downloadAsync(tsvUrl, localUri, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (downloadResult.status === 200) {
        setShowProofPackModal(false);
        const isSharingAvailable = await Sharing.isAvailableAsync();
        if (isSharingAvailable) {
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType: 'text/tab-separated-values',
            dialogTitle: 'Share Proof Pack Export',
          });
        } else {
          showToast({ type: 'success', message: 'Proof Pack export downloaded' });
        }
      } else {
        showToast({ type: 'error', message: 'Failed to export Proof Pack' });
      }
    } catch (error: any) {
      console.error('Proof pack TSV export error:', error);
      showToast({ type: 'error', message: error.message || 'Failed to export Proof Pack' });
    } finally {
      setIsExportingProofPackTsv(false);
    }
  };

  // Preview-first: load the job card as HTML in a modal (same flow as the
  // Proof Pack) so the user sees it before downloading the PDF.
  const handleExportJobCard = async () => {
    if (!job) return;
    setIsExportingJobCard(true);
    try {
      const token = await api.getToken();
      const previewUrl = `${API_URL}/api/jobs/${job.id}/job-card-pdf/preview`;
      const response = await fetch(previewUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (response.ok) {
        const html = await response.text();
        setJobCardPreviewHtml(html);
        setShowJobCardPreview(true);
      } else {
        showToast({ type: 'error', message: 'Failed to load job card preview' });
      }
    } catch (error: any) {
      showToast({ type: 'error', message: error.message || 'Failed to load job card preview' });
    } finally {
      setIsExportingJobCard(false);
    }
  };

  const handleDownloadJobCard = async () => {
    if (!job) return;
    setIsExportingJobCard(true);
    try {
      const token = await api.getToken();
      const pdfUrl = `${API_URL}/api/jobs/${job.id}/job-card-pdf`;
      const filename = `job-card-${job.id}.pdf`;
      const localUri = `${FileSystem.cacheDirectory}${filename}`;

      const downloadResult = await FileSystem.downloadAsync(pdfUrl, localUri, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (downloadResult.status === 200) {
        const isSharingAvailable = await Sharing.isAvailableAsync();
        if (isSharingAvailable) {
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Share Job Card',
          });
        } else {
          showToast({ type: 'success', message: 'Job Card PDF downloaded successfully' });
        }
      } else {
        showToast({ type: 'error', message: 'Failed to generate Job Card PDF' });
      }
    } catch (error: any) {
      console.error('Job card export error:', error);
      showToast({ type: 'error', message: error.message || 'Failed to export Job Card' });
    } finally {
      setIsExportingJobCard(false);
    }
  };

  const handleTogglePortal = async () => {
    if (!job) return;
    setIsTogglingPortal(true);
    const newValue = !portalEnabled;
    try {
      await api.patch(`/api/jobs/${job.id}`, { portalEnabled: newValue });
      setPortalEnabled(newValue);
      setJob({ ...job, portalEnabled: newValue } as any);
      if (newValue) {
        await loadPortalLinks();
        if (portalLinks.length === 0) {
          try {
            const res = await api.post<any>(`/api/jobs/${job.id}/portal-link`, {});
            if (res.data?.url) {
              const t = res.data.token || {};
              setPortalLinks([{ id: t.id, url: res.data.url, token: t.token, expiresAt: t.expiresAt, createdAt: t.createdAt }]);
            }
          } catch {}
        }
      }
    } catch (error) {
      showToast({ type: 'error', message: 'Failed to toggle client portal' });
    } finally {
      setIsTogglingPortal(false);
    }
  };

  const handleGeneratePortalLink = async () => {
    if (!job) return;
    setIsGeneratingPortalLink(true);
    try {
      const res = await api.post<any>(`/api/jobs/${job.id}/portal-link`, {});
      if (res.data?.url) {
        const t = res.data.token || {};
        const link = { id: t.id, url: res.data.url, token: t.token, expiresAt: t.expiresAt, createdAt: t.createdAt };
        setPortalLinks(prev => [...prev, link]);
        showToast({ type: 'success', message: 'Portal link generated' });
      } else {
        showToast({ type: 'error', message: res.error || 'Failed to generate portal link' });
      }
    } catch (error) {
      showToast({ type: 'error', message: 'Failed to generate portal link' });
    } finally {
      setIsGeneratingPortalLink(false);
    }
  };

  const handleCopyPortalLink = async (url: string) => {
    try {
      await Clipboard.setStringAsync(url);
      showToast({ type: 'success', message: 'Portal link copied to clipboard' });
    } catch {
      showToast({ type: 'info', message: 'Share Link', description: url });
    }
  };

  const handleSharePortalLink = async (url: string) => {
    try {
      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (isSharingAvailable) {
        const tempFile = `${FileSystem.cacheDirectory}portal-link.txt`;
        await FileSystem.writeAsStringAsync(tempFile, url);
        await Sharing.shareAsync(tempFile, { mimeType: 'text/plain' });
      } else {
        Linking.openURL(url);
      }
    } catch {
      Linking.openURL(url);
    }
  };

  const getPortalLink = () => {
    return portalLinks.length > 0 ? (portalLinks[0].url || (portalLinks[0] as any).link || '') : '';
  };

  const handleSendPortalSMS = () => {
    if (!job || !client?.phone) return;
    const portalLink = getPortalLink();
    const message = `Hi ${client.name || 'there'}, here's a link to track your job "${job.title}" progress: ${portalLink}`;

    showActionSheet({
      title: 'Send Portal Link via SMS',
      message: 'How would you like to send the portal link?',
      actions: [
        {
          label: 'Send via JobRunner',
          onPress: () => {
            setSendModalDefaultTab('sms');
            setShowSendModal(true);
          },
        },
        {
          label: 'Open Phone SMS',
          onPress: async () => {
            try {
              const separator = Platform.OS === 'ios' ? '&' : '?';
              await Linking.openURL(`sms:${client.phone}${separator}body=${encodeURIComponent(message)}`);
            } catch {
              showToast({ type: 'error', message: 'Error', description: 'Could not open SMS app' });
            }
          },
        },
      ],
    });
  };

  const handleSendPortalEmail = () => {
    if (!job || !client?.email) return;
    const portalLink = getPortalLink();
    const subject = `Job Progress: ${job.title}`;
    const body = `Hi ${client.name || 'there'},\n\nHere's a link to track your job progress:\n${portalLink}\n\nYou can view the latest status, photos, and updates for "${job.title}".\n\nThanks`;

    showActionSheet({
      title: 'Send Portal Link via Email',
      message: 'How would you like to send the portal link?',
      actions: [
        {
          label: 'Send via JobRunner',
          onPress: () => {
            setSendModalDefaultTab('email');
            setShowSendModal(true);
          },
        },
        {
          label: 'Open Phone Email',
          onPress: async () => {
            try {
              await Linking.openURL(`mailto:${client.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
            } catch {
              showToast({ type: 'error', message: 'Error', description: 'Could not open email app' });
            }
          },
        },
      ],
    });
  };

  const handleLoadProofPackPreview = async () => {
    if (!job) return;
    setIsLoadingProofPackPreview(true);
    try {
      const token = await api.getToken();
      const hiddenParts: string[] = [];
      Object.entries(proofPackSections).forEach(([key, val]) => {
        if (!val) hiddenParts.push(`hide_${key}=1`);
      });
      const queryStr = hiddenParts.join('&');
      const previewUrl = `${API_URL}/api/jobs/${job.id}/proof-pack/preview${queryStr ? `?${queryStr}` : ''}`;
      const response = await fetch(previewUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (response.ok) {
        const html = await response.text();
        setProofPackPreviewHtml(html);
        setShowProofPackPreview(true);
        setShowProofPackModal(false);
      } else {
        showToast({ type: 'error', message: 'Failed to load proof pack preview' });
      }
    } catch (error: any) {
      showToast({ type: 'error', message: error.message || 'Failed to load preview' });
    } finally {
      setIsLoadingProofPackPreview(false);
    }
  };

  const STATUS_ORDER: Job['status'][] = ['pending', 'scheduled', 'in_progress', 'done', 'invoiced'];

  const handleStatusRollback = () => {
    if (!job) return;
    const currentIndex = STATUS_ORDER.indexOf(job.status);
    if (currentIndex <= 0) return;

    const previousStatus = STATUS_ORDER[currentIndex - 1];
    const statusLabels: Record<string, string> = {
      pending: 'Pending',
      scheduled: 'Scheduled',
      in_progress: 'In Progress',
      done: 'Done',
      invoiced: 'Invoiced',
    };

    confirm({
      title: 'Rollback Status',
      message: `Are you sure you want to change the status from "${statusLabels[job.status]}" back to "${statusLabels[previousStatus]}"?\n\nThis will undo the current status change.`,
      confirmText: 'Rollback',
      destructive: true,
    }).then(async (ok) => {
      if (!ok) return;
      try {
        const response = await api.patch(`/api/jobs/${job.id}`, { status: previousStatus });
        if (response.data) {
          setJob({ ...job, status: previousStatus });
          const { fetchJobs, fetchTodaysJobs } = useJobsStore.getState();
          fetchJobs();
          fetchTodaysJobs();
          showToast({ type: 'success', message: 'Success', description: `Status rolled back to "${statusLabels[previousStatus]}"` });
        } else {
          showToast({ type: 'error', message: 'Error', description: 'Failed to rollback status' });
        }
      } catch (error) {
        showToast({ type: 'error', message: 'Error', description: 'Failed to rollback status' });
      }
    });
  };

  // Use pre-calculated total tracked hours from completed time entries
  const actualHours = totalTrackedHours;
  const estimatedHours = job?.estimatedHours || 0;
  const hoursVariance = actualHours - estimatedHours;
  const estimatedCost = job?.estimatedCost || 0;

  const handleViewInvoice = () => {
    if (invoice?.id) {
      router.push(`/more/invoice/${invoice.id}`);
    }
  };

  const handleViewQuote = () => {
    if (quote?.id) {
      router.push(`/more/quote/${quote.id}`);
    }
  };

  // Payment collection handlers
  const handleTapToPay = () => {
    showToast({ type: 'info', message: 'Coming Soon', description: 'Tap to Pay will be available in a future update. Use QR Code or Payment Link to collect payments now.' });
  };

  const handleQRCode = () => {
    if (invoice?.id) {
      router.push(`/more/collect-payment?tab=qr&invoiceId=${invoice.id}&jobId=${job?.id}`);
    }
  };

  const handlePaymentLink = () => {
    if (invoice?.id) {
      router.push(`/more/collect-payment?tab=link&invoiceId=${invoice.id}&jobId=${job?.id}`);
    }
  };

  const handleRecordCash = async () => {
    if (!invoice || !job) return;
    
    // Parse amounts as numbers to handle string values from API
    const total = typeof invoice.total === 'number' ? invoice.total : parseFloat(String(invoice.total) || '0');
    const paidAmount = typeof invoice.paidAmount === 'number' ? invoice.paidAmount : parseFloat(String(invoice.paidAmount) || '0');
    const outstanding = total - paidAmount;
    
    const formatAmount = (amount: number) => 
      new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);
    
    confirm({
      title: 'Record Cash Payment',
      message: `Record ${formatAmount(outstanding)} cash payment for ${invoice.number}?`,
      confirmText: 'Record Payment',
    }).then(async (ok) => {
      if (!ok) return;
      try {
        await api.post('/api/receipts', {
          invoiceId: invoice.id,
          jobId: job.id,
          clientId: client?.id,
          amount: String(outstanding.toFixed(2)),
          paymentMethod: 'cash',
          reference: invoice.number,
          description: `Cash payment for ${invoice.number}`,
        });
        await api.patch(`/api/invoices/${invoice.id}`, {
          status: 'paid',
          paidAmount: total,
        });
        showToast({ type: 'success', message: 'Success', description: 'Cash payment recorded successfully' });
        handleRefresh();
      } catch (error: any) {
        showToast({ type: 'error', message: 'Error', description: error.message || 'Failed to record payment' });
      }
    });
  };

  // Quick Collect Payment - collect at job site, auto-creates invoice + receipt
  const [isQuickCollecting, setIsQuickCollecting] = useState(false);
  
  const getQuickCollectTotal = () => {
    if (quote && quote.status === 'accepted') {
      return typeof quote.total === 'number' ? quote.total : parseFloat(String(quote.total) || '0');
    }
    const matSell = materials.reduce((s, m) => {
      const up = Number(m.unitPrice || 0);
      return s + (up > 0 ? up * Number(m.quantity || 1) : Number(m.totalCost || 0));
    }, 0);
    return matSell;
  };

  const getQuickCollectLineItems = () => {
    if (quote && quote.status === 'accepted') return [];
    return materials.map(m => {
      const up = Number(m.unitPrice || 0);
      const qty = Number(m.quantity || 1);
      const lineTotal = up > 0 ? up * qty : Number(m.totalCost || 0);
      return {
        description: m.name,
        quantity: qty,
        unitPrice: up > 0 ? up : Number(m.unitCost || 0),
        total: lineTotal,
      };
    });
  };

  const getQuickCollectSource = () => {
    if (quote && quote.status === 'accepted') return 'quote';
    if (materials.length > 0) return 'materials';
    return 'custom';
  };
  
  const handleQuickCollect = async (paymentMethod: 'cash' | 'card' | 'bank_transfer') => {
    if (!job) return;
    if (isQuickCollecting) return;

    const source = getQuickCollectSource();
    const total = getQuickCollectTotal();
    
    if (total <= 0) {
      showToast({ type: 'info', message: 'No Amount', description: 'Add materials with pricing or a quote to use quick collect.' });
      return;
    }

    const formatAmount = (amount: number) => 
      new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);

    const methodLabels: Record<string, string> = {
      cash: 'Cash',
      card: 'Card',
      bank_transfer: 'Bank Transfer',
    };

    const sourceLabel = source === 'quote' ? 'accepted quote' : 'materials';

    confirm({
      title: 'Quick Collect Payment',
      message: `Collect ${formatAmount(total)} via ${methodLabels[paymentMethod]}?\n\nBased on ${sourceLabel}. Invoice and receipt will be created automatically.`,
      confirmText: 'Collect Payment',
    }).then(async (ok) => {
      if (!ok) return;
      setIsQuickCollecting(true);
      try {
        const body: any = {
          paymentMethod,
          amount: String(total.toFixed(2)),
        };
        if (quote && quote.status === 'accepted') {
          body.quoteId = quote.id;
        }
        const lineItems = getQuickCollectLineItems();
        if (lineItems.length > 0) {
          body.lineItems = lineItems;
        }

        const response = await api.post<{ receiptId: string; invoiceId: string }>(`/api/jobs/${job.id}/quick-collect`, body);

        if (response.error) {
          showToast({ type: 'error', message: 'Error', description: response.error });
          return;
        }

        showActionSheet({
          title: 'Payment Collected!',
          message: `${formatAmount(total)} collected successfully.\n\nInvoice and receipt have been created.`,
          actions: [
            {
              label: 'View Receipt',
              onPress: () => response.data?.receiptId && router.push(`/more/receipt/${response.data.receiptId}`),
            },
          ],
        });
        handleRefresh();
      } catch (error: any) {
        showToast({ type: 'error', message: 'Error', description: error.message || 'Failed to collect payment' });
      } finally {
        setIsQuickCollecting(false);
      }
    });
  };

  const formatCurrency = (amount: number) => {
    const { formatCurrency: fmt } = require('../../src/lib/format');
    return fmt(amount);
  };

  const getInvoiceStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return colors.success;
      case 'partial': return colors.warning;
      case 'overdue': return colors.destructive;
      case 'sent': return colors.scheduled;
      case 'viewed': return colors.inProgress;
      default: return colors.mutedForeground;
    }
  };

  const formatElapsedTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };
  
  // Format tracked hours with hours and minutes precision
  const formatTrackedHours = (hours: number): string => {
    const totalMins = Math.round(hours * 60);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    if (h > 0 && m > 0) {
      return `${h}h ${m}m`;
    } else if (h > 0) {
      return `${h}h`;
    }
    return `${m}m`;
  };

  const handleCall = () => {
    if (client?.phone) {
      Linking.openURL(`tel:${client.phone.replace(/\s/g, '')}`);
    }
  };

  const [isSendingSms, setIsSendingSms] = useState(false);

  const fallbackToNativeSms = (phone: string, message?: string) => {
    confirm({
      title: 'Send via SMS App?',
      message: 'Could not send directly. Would you like to open your messaging app instead?',
      confirmText: 'Open SMS App',
    }).then((ok) => {
      if (!ok) return;
      const url = message 
        ? `sms:${phone}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(message)}`
        : `sms:${phone}`;
      Linking.openURL(url).catch(() => showToast({ type: 'error', message: 'Error', description: 'Could not open SMS app' }));
    });
  };

  const handleSMS = async () => {
    if (!client?.phone) return;
    // Open the in-app SMS composer (with saved templates + real merge fields)
    // linked to this job. Falls back to the native SMS app if that fails.
    try {
      const res = await api.post<any>('/api/sms/conversations/find-or-create', {
        phone: client.phone,
        clientId: client.id,
        clientName: client.name,
        jobId: job?.id,
      });
      if (!res.error && res.data?.id) {
        router.push(`/more/sms-conversation?id=${res.data.id}&phone=${encodeURIComponent(client.phone)}&name=${encodeURIComponent(client.name || '')}&jobId=${job?.id || ''}` as any);
        return;
      }
    } catch {}
    const phone = client.phone.replace(/\s/g, '');
    const message = `Hi${client.name ? ` ${client.name.split(' ')[0]}` : ''}, just reaching out about ${job?.title || 'your job'}.`;
    const url = `sms:${phone}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => showToast({ type: 'error', message: 'Could not open SMS app' }));
  };

  const handleSendPhotoSms = async () => {
    if (!client?.phone) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const uri = asset.uri;
    const phone = client.phone.replace(/\s/g, '');
    const message = `Hi${client.name ? ` ${client.name.split(' ')[0]}` : ''}, here's a photo update for ${job?.title || 'your job'}.`;

    setIsSendingSms(true);
    try {
      const token = await api.getToken();
      const uploadUrl = `${API_URL}/api/sms/upload-media`;
      const uploadType = FileSystem.FileSystemUploadType?.MULTIPART ?? 1;
      const uploadResult = await FileSystem.uploadAsync(uploadUrl, uri, {
        httpMethod: 'POST',
        uploadType,
        fieldName: 'file',
        mimeType: 'image/jpeg',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      if (uploadResult.status !== 200) {
        showToast({ type: 'info', message: 'Upload Failed', description: 'Could not upload the photo. Please try again.' });
        return;
      }

      const { url: mediaUrl } = JSON.parse(uploadResult.body);

      const response = await api.post('/api/sms/send', {
        clientPhone: phone,
        message,
        clientId: client.id,
        jobId: job?.id,
        mediaUrls: [mediaUrl],
      });

      if (response.error) {
        fallbackToNativeSms(phone, message);
      } else {
        showToast({ type: 'info', message: 'MMS Sent', description: `Photo message sent to ${client.name || phone}` });
      }
    } catch {
      showToast({ type: 'error', message: 'Could not send photo message. Please try again.' });
    } finally {
      setIsSendingSms(false);
    }
  };

  const handleEmail = () => {
    if (client?.email) {
      Linking.openURL(`mailto:${client.email}`);
    }
  };

  const handleNavigate = () => {
    if (!job) return;
    
    if (job.latitude && job.longitude) {
      const { openMapsWithPreference } = require('../../src/lib/maps-store');
      openMapsWithPreference(job.latitude, job.longitude, job.address);
    } else if (job.address) {
      const { openMapsWithAddress } = require('../../src/lib/maps-store');
      openMapsWithAddress(job.address);
    }
  };

  const handleViewClient = () => {
    if (client?.id) {
      router.push(`/more/client/${client.id}`);
    }
  };

  const handleDuplicateJob = async () => {
    if (!job) return;
    
    confirm({
      title: 'Duplicate Job',
      message: 'Create a new job with the same details?',
      confirmText: 'Duplicate',
    }).then(async (ok) => {
      if (!ok) return;
      try {
        const newJobData = {
          title: job.title,
          description: job.description ? `${job.description}\n\n(Duplicated from job #${job.id})` : `Duplicated from job #${job.id}`,
          address: job.address,
          clientId: job.clientId,
          status: 'pending',
          estimatedDuration: job.estimatedDuration,
          estimatedCost: job.estimatedCost,
          geofenceRadius: job.geofenceRadius,
          latitude: job.latitude,
          longitude: job.longitude,
          notes: job.notes ? `${job.notes}\n\n(Original job: #${job.id})` : `Original job: #${job.id}`,
        };

        const response = await api.post<{ id: string }>('/api/jobs', newJobData);

        if (response.data?.id) {
          showActionSheet({
            title: 'Success',
            message: 'Job duplicated successfully',
            actions: [
              {
                label: 'View New Job',
                onPress: () => router.push(`/job/${response.data!.id}`),
              },
            ],
          });
        } else {
          showToast({ type: 'error', message: 'Error', description: 'Failed to duplicate job' });
        }
      } catch (error) {
        console.error('Error duplicating job:', error);
        showToast({ type: 'error', message: 'Error', description: 'Failed to duplicate job' });
      }
    });
  };

  const handleStopRecurring = async () => {
    if (!job) return;
    
    confirm({
      title: 'Stop Recurring',
      message: 'This will stop future jobs from being automatically created. Continue?',
      confirmText: 'Stop Recurring',
      destructive: true,
    }).then(async (ok) => {
      if (!ok) return;
      const { isOnline } = useOfflineStore.getState();
      const updates = { isRecurring: false, nextRecurrenceDate: null };
      setJob({ ...job, ...updates });

      if (!isOnline) {
        await offlineStorage.updateJobOffline(job.id, updates);
        showToast({ type: 'success', message: 'Saved Offline', description: 'Changes will sync when online' });
        return;
      }

      try {
        const response = await api.patch(`/api/jobs/${job.id}`, updates);
        if (response.data) {
          showToast({ type: 'success', message: 'Success', description: 'Recurring schedule stopped' });
        } else {
          setJob(job);
          showToast({ type: 'error', message: 'Error', description: 'Failed to stop recurring schedule' });
        }
      } catch (error: any) {
        if (error.message?.includes('Network') || error.code === 'ECONNABORTED') {
          await offlineStorage.updateJobOffline(job.id, updates);
          showToast({ type: 'success', message: 'Saved Offline', description: 'Changes will sync when connection is restored' });
        } else {
          setJob(job);
          console.error('Error stopping recurring:', error);
          showToast({ type: 'error', message: 'Error', description: 'Failed to stop recurring schedule' });
        }
      }
    });
  };

  const proceedWithTimerStart = async (skipStatusChange?: boolean) => {
    if (!job) return;
    const success = await startTimer(job.id, `Working on: ${job.title}`);
    if (success) {
      if (!skipStatusChange && job.status === 'scheduled') {
        await updateJobStatus(job.id, 'in_progress');
        setJob({ ...job, status: 'in_progress' });
      }
      loadTeamTimers();
    } else {
      showToast({ type: 'error', message: 'Failed to start timer. Please try again.' });
    }
  };

  const handleStartTimer = async () => {
    if (!job) return;
    
    if (activeTimer && !isTimerForThisJob) {
      confirm({
        title: 'Timer Already Running',
        message: 'You have an active timer on another job. Would you like to stop it and start timing this job?',
        confirmText: 'Switch',
      }).then(async (ok) => {
        if (!ok) return;
        const stopped = await stopTimer();
        if (!stopped) {
          showToast({ type: 'error', message: 'Error', description: 'Failed to stop the existing timer. Please try again.' });
          return;
        }
        await proceedWithTimerStart();
      });
      return;
    }

    if (job.status === 'scheduled' && (pendingSafetyForms.length > 0 || hasIncompleteSwms || hasNoSafetyDocs)) {
      Alert.alert(
        'Safety Check Required',
        'Safety documentation is incomplete. Starting the timer will transition this job to "In Progress". Complete safety docs first?',
        [
          { text: 'Complete Safety Docs', style: 'default', onPress: () => setActiveTab('documents') },
          { text: 'Start Anyway', style: 'secondary', onPress: () => proceedWithTimerStart() },
          { text: 'Cancel', style: 'plain' },
        ],
      );
      return;
    }

    await proceedWithTimerStart();
  };

  const handleStopTimer = async () => {
    const timeWorked = formatElapsedTime(elapsedTime);
    confirm({
      title: 'Stop Timer',
      message: `You've worked ${timeWorked}. Stop the timer?`,
      confirmText: 'Stop',
      cancelText: 'Keep Running',
    }).then(async (ok) => {
      if (!ok) return;
      const success = await stopTimer();
      if (success) {
        await loadTimeEntries();
        await loadTeamTimers();
      } else {
        showToast({ type: 'error', message: 'Error', description: 'Failed to stop timer. Please try again.' });
      }
    });
  };

  const handleCompleteMyPart = async () => {
    if (!job) return;
    setIsCompletingJob(true);
    try {
      // Clock off first via the store so the Live Activity / local timer end cleanly.
      if (isTimerForThisJob) {
        const stopped = await stopTimer();
        if (!stopped) {
          showToast({ type: 'error', message: 'Error', description: 'Failed to stop your timer. Please try again.' });
          return;
        }
      }

      const res = await api.post(`/api/jobs/${job.id}/complete-my-part`, {});
      if (res.error) {
        showToast({ type: 'error', message: 'Error', description: res.error || 'Failed to mark your part complete.' });
        return;
      }

      await loadTimeEntries();
      await loadTeamTimers();
      await loadJobAssignments();
      setShowCompletionModal(false);

      const data: any = res.data || {};
      if (data.allComplete) {
        showToast({ type: 'success', message: 'Your part is done', description: 'All workers have finished. The owner can now finish the job.' });
      } else {
        const done = data.completedCount ?? 0;
        const total = data.totalCount ?? 0;
        showToast({ type: 'success', message: 'Your part is done', description: total ? `${done}/${total} workers complete.` : 'Marked complete.' });
      }
    } finally {
      setIsCompletingJob(false);
    }
  };

  const handleTakeBreak = async () => {
    const success = await pauseTimer();
    if (!success) {
      showToast({ type: 'error', message: 'Failed to start break. Please try again.' });
    }
  };

  const handleResumeWork = async () => {
    const success = await resumeTimer();
    if (!success) {
      showToast({ type: 'error', message: 'Failed to resume work. Please try again.' });
    }
  };

  const handleStatusChange = async () => {
    if (!job) return;
    
    const action = STATUS_ACTIONS[job.status];
    if (!action) return;

    if (action.next === 'invoiced') {
      router.push(`/more/invoice/new?jobId=${job.id}`);
      return;
    }

    // PHOTO GATE: Check if "before" photos are required before starting job
    if (action.next === 'in_progress' && automationSettings?.requirePhotoBeforeStart) {
      const beforePhotos = photos.filter(p => p.category === 'before');
      if (beforePhotos.length === 0) {
        confirm({
          title: 'Before Photo Required',
          message: 'A "Before" photo is required before starting this job. Please take a photo to document the work site and mark it as "Before".',
          confirmText: 'Take Photo',
        }).then((ok) => { if (ok) setActiveTab('documents'); });
        return;
      }
    }

    // Show completion summary modal when completing a job
    if (action.next === 'done') {
      // PHOTO GATE: Check if "after" photos are required before completing job
      if (automationSettings?.requirePhotoAfterComplete) {
        const afterPhotos = photos.filter(p => p.category === 'after');
        if (afterPhotos.length === 0) {
          confirm({
            title: 'After Photo Required',
            message: 'An "After" photo is required before completing this job. Please take a photo to document the completed work and mark it as "After".',
            confirmText: 'Take Photo',
          }).then((ok) => { if (ok) setActiveTab('documents'); });
          return;
        }
      }
      api.get<SiteAttendance>(`/api/jobs/${job.id}/site-attendance`).then(res => {
        if (res.data && !res.error) setSiteAttendance(res.data);
      }).catch(() => {});
      setCompletionMode('owner');
      setShowCompletionModal(true);
      return;
    }

    // Show schedule picker when scheduling a job
    if (action.next === 'scheduled') {
      setScheduleDate(job.scheduledAt ? new Date(job.scheduledAt) : new Date());
      setShowScheduleModal(true);
      return;
    }

    // Safety check enforcement: check both custom safety forms and SWMS documents
    if (action.next === 'in_progress' && (pendingSafetyForms.length > 0 || hasIncompleteSwms || hasNoSafetyDocs)) {
      const warnings: string[] = [];
      if (pendingSafetyForms.length > 0) {
        warnings.push('Safety forms not completed');
      }
      if (hasIncompleteSwms) {
        const draftCount = swmsDocuments.filter(s => s.status === 'draft').length;
        const unsignedCount = swmsDocuments.filter(s => (s.signatureCount ?? 0) === 0 && s.status !== 'draft').length;
        if (draftCount > 0) warnings.push(`${draftCount} SWMS in draft`);
        if (unsignedCount > 0) warnings.push(`${unsignedCount} SWMS unsigned`);
      }
      if (hasNoSafetyDocs && warnings.length === 0) {
        warnings.push('No completed safety forms or SWMS');
      }

      const warningMsg = warnings.join(', ');

      Alert.alert(
        'Safety Check Required',
        `${warningMsg}.\n\nSWMS documents are legally required for high-risk construction work. Complete safety documentation before starting work?`,
        [
          { text: 'Complete Safety Docs', style: 'default', onPress: () => setActiveTab('documents') },
          {
            text: 'Start Anyway',
            style: 'secondary',
            onPress: async () => {
              const success = await updateJobStatus(job.id, action.next as any);
              if (success) {
                setJob({ ...job, status: action.next as any });
                if (action.next === 'in_progress') {
                  LiveActivity.start({
                    id: job.id,
                    address: job.address ?? '',
                    clientName: job.clientName ?? '',
                  }).catch(() => {});
                }
                await proceedWithTimerStart(true);
              }
            },
          },
          { text: 'Cancel', style: 'plain' },
        ],
      );
      return;
    }

    if (action.next === 'in_progress') {
      confirm({
        title: action.label,
        message: `Are you sure you want to ${action.label.toLowerCase()}?\n\nThe job timer will start automatically.`,
        confirmText: 'Confirm',
      }).then(async (ok) => {
        if (!ok) return;
        const success = await updateJobStatus(job.id, 'in_progress');
        if (success) {
          setJob({ ...job, status: 'in_progress' });
          LiveActivity.start({
            id: job.id,
            address: job.address ?? '',
            clientName: job.clientName ?? '',
          }).catch(() => {});
          await proceedWithTimerStart(true);
        }
      });
    } else {
      confirm({
        title: action.label,
        message: `Are you sure you want to ${action.label.toLowerCase()}?`,
        confirmText: 'Confirm',
      }).then(async (ok) => {
        if (!ok) return;
        const success = await updateJobStatus(job.id, action.next as any);
        if (success) {
          setJob({ ...job, status: action.next as any });
        }
      });
    }
  };

  const calcHaversineDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  const calcDriveMinutes = useCallback((distanceKm: number): number => {
    if (distanceKm <= 5) return Math.max(5, Math.round(distanceKm * 3));
    if (distanceKm <= 20) return Math.round(distanceKm * 2.5);
    if (distanceKm <= 50) return Math.round(distanceKm * 2);
    return Math.round(distanceKm * 1.5);
  }, []);

  useEffect(() => {
    if (!job || job.status !== 'in_progress') {
      setShowWrapUpBanner(false);
      return;
    }

    let cancelled = false;

    const checkWrapUp = async () => {
      try {
        const res = await api.get('/api/jobs');
        if (cancelled || !res.data || !Array.isArray(res.data)) return;

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

        const upcoming = res.data
          .filter((j: any) =>
            j.id !== job.id &&
            ['scheduled'].includes(j.status) &&
            j.scheduledAt
          )
          .filter((j: any) => {
            const d = new Date(j.scheduledAt);
            return d >= now && d < todayEnd;
          })
          .sort((a: any, b: any) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

        if (upcoming.length === 0) {
          if (!cancelled) setShowWrapUpBanner(false);
          return;
        }

        const nextScheduled = upcoming[0];
        const nextStartTime = new Date(nextScheduled.scheduledAt).getTime();
        let driveMinutes = 20;

        try {
          const { status } = await Location.getForegroundPermissionsAsync();
          if (status === 'granted') {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            if (nextScheduled.latitude && nextScheduled.longitude) {
              const dist = calcHaversineDistance(
                loc.coords.latitude, loc.coords.longitude,
                parseFloat(nextScheduled.latitude), parseFloat(nextScheduled.longitude)
              );
              driveMinutes = calcDriveMinutes(dist);
            }
          }
        } catch (e) {}

        const bufferMinutes = 15;
        const shouldLeaveBy = nextStartTime - (driveMinutes + bufferMinutes) * 60 * 1000;
        const minutesUntilLeave = (shouldLeaveBy - now.getTime()) / (1000 * 60);

        if (minutesUntilLeave <= 20 && minutesUntilLeave > -30) {
          if (!cancelled) {
            setWrapUpNextJob(nextScheduled);
            setWrapUpDriveMinutes(driveMinutes);
            setShowWrapUpBanner(true);
          }
        } else {
          if (!cancelled) setShowWrapUpBanner(false);
        }
      } catch (e) {
        if (__DEV__) console.log('[WrapUp] Check failed:', e);
      }
    };

    checkWrapUp();
    const interval = setInterval(checkWrapUp, 2 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [job?.id, job?.status, calcHaversineDistance, calcDriveMinutes]);

  const handleHeadToNextJob = async () => {
    if (!nextJob) return;
    setIsHeadingToNext(true);
    try {
      const coords = await locationTracking.getFreshCoordsForEta();

      const response = await api.post(`/api/jobs/${nextJob.id}/on-my-way`, {
        latitude: coords?.latitude,
        longitude: coords?.longitude,
      });

      if (response.error) {
        showToast({ type: 'info', message: 'Could Not Notify', description: response.error || 'Failed to send notification to client. You can still navigate manually.' });
        setIsHeadingToNext(false);
        return;
      }

      if (nextJob.latitude && nextJob.longitude) {
        try {
          await locationTracking.addJobGeofence(
            nextJob.id,
            parseFloat(nextJob.latitude),
            parseFloat(nextJob.longitude),
            nextJob.geofenceRadius || 100
          );
        } catch (e) {}
      }

      setShowNextJobModal(false);

      if (nextJob.address) {
        const encodedAddress = encodeURIComponent(nextJob.address);
        Linking.openURL(`https://maps.google.com/?daddr=${encodedAddress}`);
      } else if (nextJob.latitude && nextJob.longitude) {
        Linking.openURL(`https://maps.google.com/?daddr=${nextJob.latitude},${nextJob.longitude}`);
      }

      setTimeout(() => {
        router.push(`/job/${nextJob.id}`);
      }, 500);
    } catch (error: any) {
      showToast({ type: 'error', message: error.message || 'Failed to start transition. Please try again.' });
    } finally {
      setIsHeadingToNext(false);
    }
  };

  const handleOnMyWay = async () => {
    if (!job) return;
    
    const { isOnline } = useOfflineStore.getState();
    
    if (!isOnline) {
      try {
        await offlineStorage.queueOnMyWayNotification(job.id);
        setJob((prev: any) => prev ? { ...prev, workerStatus: 'on_my_way' } : prev);
        showToast({ type: 'info', message: 'Queued', description: 'You\'re offline — the "On My Way" SMS will be sent automatically as soon as you reconnect.' });
      } catch (queueErr) {
        showToast({ type: 'info', message: 'Could not queue', description: 'Failed to save "On My Way" for later. Please try again when online.' });
      }
      return;
    }
    
    if (!isSmsReady) {
      showToast({ type: 'info', message: 'SMS Not Configured', description: 'SMS notifications require Twilio setup. Configure in Settings > Integrations.' });
      return;
    }
    
    setIsSendingOnMyWay(true);
    try {
      // Get a fresh GPS fix (requesting permission if needed) so the server can
      // compute a REAL road ETA instead of falling back to the static default.
      const coords = await locationTracking.getFreshCoordsForEta();

      type OnMyWayResp = { notConfigured?: boolean; estimatedMinutes?: number; distanceKm?: number; etaSource?: string };
      const response = await api.post<OnMyWayResp>(`/api/jobs/${job.id}/on-my-way`, {
        latitude: coords?.latitude,
        longitude: coords?.longitude,
      });
      
      if (response.error) {
        if (response.data?.notConfigured) {
          showToast({ type: 'info', message: 'SMS Not Configured', description: 'Twilio SMS is not set up. Set up Twilio in Settings > Integrations to send SMS notifications to clients.' });
        } else {
          showToast({ type: 'error', message: response.error });
        }
      } else {
        const eta = response.data?.estimatedMinutes;
        const dist = response.data?.distanceKm;
        const etaSource = response.data?.etaSource;
        const etaInfo = (eta && etaSource !== 'default') ? `\nETA: ~${eta} min${dist ? ` (${dist.toFixed(1)} km)` : ''}` : '';
        setJob((prev: any) => prev ? { ...prev, workerStatus: 'on_my_way' } : prev);
        showToast({ type: 'info', message: 'En Route', description: `Client has been notified you're on your way.${etaInfo}` });
      }
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Failed to send notification. Please try again.';
      showToast({ type: 'error', message: message });
    } finally {
      setIsSendingOnMyWay(false);
    }
  };

  const handleConfirmComplete = async () => {
    if (!job) return;
    setIsCompletingJob(true);
    try {
      if (isTimerForThisJob) {
        await stopTimer();
        await loadTimeEntries();
      }
      const success = await updateJobStatus(job.id, 'done');
      if (!success) {
        // The store reverts silently on server rejection (safety gate, time
        // entry validation, lead-worker gate) — surface the reason here.
        const errMsg = useJobsStore.getState().error || 'Failed to complete the job. Please try again.';
        showToast({ type: 'error', message: 'Could not complete job', description: errMsg });
        return;
      }
      if (success) {
        setJob({ ...job, status: 'done' });
        LiveActivity.end().catch(() => {});
        setShowCompletionModal(false);
        maybeRequestReview('job_completed').catch(() => {});
        
        // Fetch next scheduled job for today
        try {
          const res = await api.get('/api/jobs');
          if (res.data && Array.isArray(res.data)) {
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
            
            const upcomingJobs = res.data
              .filter((j: any) => 
                j.id !== job.id && 
                ['scheduled', 'in_progress', 'on_my_way'].includes(j.status) &&
                j.scheduledAt
              )
              .filter((j: any) => {
                const scheduledDate = new Date(j.scheduledAt);
                return scheduledDate >= todayStart && scheduledDate < todayEnd;
              })
              .sort((a: any, b: any) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
            
            if (upcomingJobs.length > 0) {
              const nextScheduledJob = upcomingJobs[0];
              setNextJob(nextScheduledJob);

              let driveInfo: { distanceKm: number; driveMinutes: number } | null = null;
              try {
                const { status: locStatus } = await Location.getForegroundPermissionsAsync();
                if (locStatus === 'granted' && nextScheduledJob.latitude && nextScheduledJob.longitude) {
                  const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                  const dist = calcHaversineDistance(
                    loc.coords.latitude, loc.coords.longitude,
                    parseFloat(nextScheduledJob.latitude), parseFloat(nextScheduledJob.longitude)
                  );
                  driveInfo = {
                    distanceKm: Math.round(dist * 10) / 10,
                    driveMinutes: calcDriveMinutes(dist),
                  };
                }
              } catch (e) {}
              setNextJobDriveInfo(driveInfo);

              if (nextScheduledJob.clientId) {
                try {
                  const clientRes = await api.get<{ phone?: string }>(`/api/clients/${nextScheduledJob.clientId}`);
                  if (clientRes.data?.phone) {
                    setNextJobClientPhone(clientRes.data.phone);
                  } else {
                    setNextJobClientPhone(null);
                  }
                } catch (e) {
                  setNextJobClientPhone(null);
                }
              } else {
                setNextJobClientPhone(null);
              }
            } else {
              setNextJob(null);
              setNextJobDriveInfo(null);
              setNextJobClientPhone(null);
            }
            setShowNextJobModal(true);
          }
        } catch (e) {
          // If fetching next job fails, just don't show the modal
        }
      }
    } catch (e) {
      showToast({ type: 'error', message: 'Failed to complete job. Please try again.' });
    }
    setIsCompletingJob(false);
  };

  const handleConfirmSchedule = async () => {
    if (!job) return;
    
    // Validate that the selected time is not in the past
    const now = new Date();
    if (scheduleDate < now) {
      Alert.alert('Invalid Time', 'Please select a future date and time for scheduling.');
      return;
    }
    
    const { isOnline } = useOfflineStore.getState();
    const previousStatus = job.status;
    const scheduledAtISO = scheduleDate.toISOString();
    
    // Optimistic UI update
    setJob({ ...job, status: 'scheduled', scheduledAt: scheduledAtISO });
    setShowScheduleModal(false);
    
    if (!isOnline) {
      await offlineStorage.updateJobStatusOffline(job.id, 'scheduled', previousStatus);
      await offlineStorage.updateJobOffline(job.id, { scheduledAt: scheduledAtISO });
      showToast({ type: 'info', message: 'Saved Offline', description: 'Job will be scheduled when online' });
      return;
    }
    
    try {
      const response = await api.patch(`/api/jobs/${job.id}`, {
        status: 'scheduled',
        scheduledAt: scheduledAtISO,
      });
      
      if (response.data) {
        // Refresh the jobs store to update any cached job lists
        const { fetchJobs, fetchTodaysJobs } = useJobsStore.getState();
        fetchJobs();
        fetchTodaysJobs();
        
        showToast({ type: 'success', message: 'Job scheduled successfully' });
      } else {
        // Revert on failure
        setJob({ ...job, status: previousStatus });
        setShowScheduleModal(true);
        showToast({ type: 'error', message: 'Failed to schedule job' });
      }
    } catch (error: any) {
      if (error.message?.includes('Network') || error.code === 'ECONNABORTED') {
        await offlineStorage.updateJobStatusOffline(job.id, 'scheduled', previousStatus);
        await offlineStorage.updateJobOffline(job.id, { scheduledAt: scheduledAtISO });
        showToast({ type: 'info', message: 'Saved Offline', description: 'Job will be scheduled when connection is restored' });
      } else {
        // Revert on error
        setJob({ ...job, status: previousStatus });
        setShowScheduleModal(true);
        showToast({ type: 'error', message: 'Failed to schedule job. Please try again.' });
      }
    }
  };

  const handleRenameJob = async () => {
    if (!job || !newJobTitle.trim()) return;
    
    setIsSavingTitle(true);
    const previousTitle = job.title;
    
    // Optimistic UI update
    setJob({ ...job, title: newJobTitle.trim() });
    setShowRenameModal(false);
    
    try {
      const response = await api.patch<Job>(`/api/jobs/${job.id}`, { title: newJobTitle.trim() });
      if (response.data) {
        setJob(response.data);
        showToast({ type: 'success', message: 'Job title updated' });
      }
    } catch (error) {
      // Revert on error
      setJob({ ...job, title: previousTitle });
      showToast({ type: 'error', message: 'Failed to update job title' });
    } finally {
      setIsSavingTitle(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!job) return;
    const content = editedNotes.trim();
    if (!content) return;

    setIsSavingNotes(true);
    try {
      // Notes are stored as individual entries (job_notes) — the legacy
      // jobs.notes field is ignored by the server on PATCH of the job, so
      // always write structured notes here.
      const response = editingNote
        ? await api.patch<JobNoteItem>(`/api/jobs/${job.id}/notes/${editingNote.id}`, { content })
        : await api.post<JobNoteItem>(`/api/jobs/${job.id}/notes`, { content });
      if (!response.error && response.data?.id) {
        setEditedNotes('');
        setShowNotesModal(false);
        showToast({ type: 'success', message: editingNote ? 'Note updated' : 'Note added' });
        setEditingNote(null);
        await loadJobNotes();
      } else {
        showToast({ type: 'error', message: 'Failed to save note', description: response.isOffline ? 'You are offline — try again when connected' : response.error });
      }
    } catch (error: any) {
      showToast({ type: 'error', message: 'Failed to save note. Please try again.' });
    }
    setIsSavingNotes(false);
  };

  const handleDeleteNote = (note: JobNoteItem) => {
    confirm({
      title: 'Delete Note',
      message: 'Delete this note? This cannot be undone.',
      confirmText: 'Delete',
      destructive: true,
    }).then(async (ok) => {
      if (!ok || !job) return;
      const res = await api.delete(`/api/jobs/${job.id}/notes/${note.id}`);
      if (res.error) {
        showToast({ type: 'error', message: 'Failed to delete note', description: res.isOffline ? 'You are offline — try again when connected' : res.error });
      } else {
        showToast({ type: 'success', message: 'Note deleted' });
        await loadJobNotes();
      }
    });
  };

  const handleSiteUpdateTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera access is needed to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      setSiteUpdatePhotoUri(result.assets[0].uri);
    }
  };

  const handleSiteUpdatePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Media library access is needed to select photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      setSiteUpdatePhotoUri(result.assets[0].uri);
    }
  };

  const handleSubmitSiteUpdate = async () => {
    if (!job || (!siteUpdateNote.trim() && !siteUpdatePhotoUri)) {
      showToast({ type: 'error', message: 'Please add a progress note or photo.' });
      return;
    }

    setIsSendingSiteUpdate(true);
    try {
      if (siteUpdateNote.trim()) {
        const noteRes = await api.post(`/api/jobs/${job.id}/notes`, {
          content: `[Site Update] ${siteUpdateNote.trim()}`,
        });
        if (noteRes.error) {
          showToast({ type: 'error', message: noteRes.error });
          setIsSendingSiteUpdate(false);
          return;
        }
      }

      if (siteUpdatePhotoUri) {
        const filename = siteUpdatePhotoUri.split('/').pop() || 'photo.jpg';
        const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
        const mimeType = ext === 'png' ? 'image/png' : `image/${ext}`;
        const token = await api.getToken();
        const uploadUrl = `${API_URL}/api/jobs/${job.id}/photos/upload`;
        const uploadType = FileSystem.FileSystemUploadType?.MULTIPART ?? 1;
        const uploadResult = await FileSystem.uploadAsync(uploadUrl, siteUpdatePhotoUri, {
          httpMethod: 'POST',
          uploadType: uploadType,
          fieldName: 'file',
          mimeType: mimeType,
          parameters: {
            category: 'progress',
            caption: siteUpdateNote.trim() ? `[Site Update] ${siteUpdateNote.trim()}` : '[Site Update]',
          },
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
          },
        });
        if (uploadResult.status < 200 || uploadResult.status >= 300) {
          showToast({ type: 'error', message: 'Failed to upload photo' });
          setIsSendingSiteUpdate(false);
          return;
        }
        await loadPhotos();
      }

      setShowSiteUpdateModal(false);
      setSiteUpdateNote('');
      setSiteUpdatePhotoUri(null);
      loadJob();
      showToast({ type: 'success', message: 'Site update posted successfully.' });
    } catch (error: any) {
      console.error('Site update error:', error);
      showToast({ type: 'error', message: error.message || 'Failed to post site update. Please try again.' });
    }
    setIsSendingSiteUpdate(false);
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera access is needed to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (!result.canceled && result.assets[0]) {
      promptForCategoryAndUpload(result.assets[0].uri, 'image');
    }
  };

  const handleRecordVideo = async () => {
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    if (cameraPermission.status !== 'granted') {
      Alert.alert('Permission Required', 'Camera access is needed to record videos.');
      return;
    }

    const microphonePermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: 60,
      videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
    });

    if (!result.canceled && result.assets[0]) {
      promptForCategoryAndUpload(result.assets[0].uri, 'video');
    }
  };

  const promptForCategoryAndUpload = (uri: string, mediaType: 'image' | 'video') => {
    // Always prompt for category when any photo gate is enabled (even if already satisfied)
    // This ensures all uploads are properly categorized for documentation
    const hasBeforeGate = automationSettings?.requirePhotoBeforeStart;
    const hasAfterGate = automationSettings?.requirePhotoAfterComplete;
    
    if (hasBeforeGate || hasAfterGate) {
      // Build contextual message showing what's still needed
      const beforeCount = photos.filter(p => p.category === 'before').length;
      const afterCount = photos.filter(p => p.category === 'after').length;
      const needsMore: string[] = [];
      if (hasBeforeGate && beforeCount === 0) needsMore.push('Before photo');
      if (hasAfterGate && afterCount === 0 && job?.status === 'in_progress') needsMore.push('After photo');
      
      const message = needsMore.length > 0 
        ? `Still needed: ${needsMore.join(', ')}. What type of ${mediaType === 'video' ? 'video' : 'photo'} is this?`
        : `What type of ${mediaType === 'video' ? 'video' : 'photo'} is this?`;
      
      showActionSheet({
        title: `${mediaType === 'video' ? 'Video' : 'Photo'} Category`,
        message,
        actions: [
          { label: 'Before (Site Condition)', onPress: () => uploadMedia(uri, mediaType, 'before') },
          { label: 'After (Completed Work)', onPress: () => uploadMedia(uri, mediaType, 'after') },
          { label: 'Progress', onPress: () => uploadMedia(uri, mediaType, 'progress') },
          { label: 'Materials', onPress: () => uploadMedia(uri, mediaType, 'materials') },
          { label: 'General', onPress: () => uploadMedia(uri, mediaType, 'general') },
        ],
      });
    } else {
      uploadMedia(uri, mediaType, 'general');
    }
  };

  const handlePickMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Media library access is needed to select photos and videos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const isVideoFile = asset.type === 'video' || 
                          asset.uri.endsWith('.mp4') || 
                          asset.uri.endsWith('.mov') || 
                          asset.uri.endsWith('.m4v');
      promptForCategoryAndUpload(asset.uri, isVideoFile ? 'video' : 'image');
    }
  };

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Photo library access is needed to select photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (!result.canceled && result.assets[0]) {
      promptForCategoryAndUpload(result.assets[0].uri, 'image');
    }
  };

  const uploadMedia = async (uri: string, mediaType: 'image' | 'video', category: string = 'general') => {
    if (!job) return;
    
    setIsUploadingPhoto(true);
    
    // Create optimistic entry immediately for instant UI feedback
    const tempId = `temp-${Date.now()}`;
    const optimisticMedia: JobPhoto = {
      id: tempId,
      url: uri,
      signedUrl: uri,
      createdAt: new Date().toISOString(),
      mimeType: mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
      category: category,
    };
    
    // Add media optimistically
    setPhotos(prev => [...prev, optimisticMedia]);
    
    try {
      const filename = uri.split('/').pop() || (mediaType === 'video' ? 'video.mp4' : 'photo.jpg');
      const ext = filename.split('.').pop()?.toLowerCase() || (mediaType === 'video' ? 'mp4' : 'jpg');
      
      let mimeType: string;
      if (mediaType === 'video') {
        mimeType = ext === 'mov' ? 'video/quicktime' : `video/${ext}`;
      } else {
        mimeType = ext === 'png' ? 'image/png' : `image/${ext}`;
      }
      
      // Get session token for authorization
      const token = await api.getToken();
      
      // Use FileSystem.uploadAsync for streaming multipart upload (works for large videos)
      const uploadUrl = `${API_URL}/api/jobs/${job.id}/photos/upload`;
      // Use FileSystemUploadType.MULTIPART (value: 1) with fallback for compatibility
      const uploadType = FileSystem.FileSystemUploadType?.MULTIPART ?? 1;
      const uploadResult = await FileSystem.uploadAsync(uploadUrl, uri, {
        httpMethod: 'POST',
        uploadType: uploadType,
        fieldName: 'file',
        mimeType: mimeType,
        parameters: {
          category: category,
        },
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      if (uploadResult.status === 200) {
        const responseData = JSON.parse(uploadResult.body);
        if (responseData.success) {
          setPhotos(prev => prev.filter(p => p.id !== tempId));
          await loadPhotos();
          if (mediaType === 'image' && category === 'general') {
            setTimeout(async () => {
              await loadPhotos();
            }, 3000);
          }
          showToast({ type: 'success', message: `${mediaType === 'video' ? 'Video' : 'Photo'} uploaded successfully` });
        } else {
          setPhotos(prev => prev.filter(p => p.id !== tempId));
          showToast({ type: 'error', message: responseData.error || `Failed to upload ${mediaType}. Please try again.` });
        }
      } else {
        setPhotos(prev => prev.filter(p => p.id !== tempId));
        showToast({ type: 'error', message: `Failed to upload ${mediaType}. Server returned status ${uploadResult.status}` });
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      setPhotos(prev => prev.filter(p => p.id !== tempId));
      showToast({ type: 'error', message: `Failed to upload ${mediaType}. ${error.message || 'Please try again.'}` });
    }
    setIsUploadingPhoto(false);
  };

  const uploadPhoto = async (uri: string) => {
    uploadMedia(uri, 'image', 'general');
  };

  const handleChangePhotoCategory = (photo: JobPhoto) => {
    showActionSheet({
      title: 'Change Photo Category',
      message: `Current category: ${photo.category || 'general'}`,
      actions: [
        { label: 'Before (Site Condition)', onPress: () => updatePhotoCategory(photo, 'before') },
        { label: 'After (Completed Work)', onPress: () => updatePhotoCategory(photo, 'after') },
        { label: 'Progress', onPress: () => updatePhotoCategory(photo, 'progress') },
        { label: 'Materials', onPress: () => updatePhotoCategory(photo, 'materials') },
        { label: 'General', onPress: () => updatePhotoCategory(photo, 'general') },
      ],
    });
  };

  const updatePhotoCategory = async (photo: JobPhoto, newCategory: string) => {
    try {
      const response = await api.patch(`/api/jobs/${job?.id}/photos/${photo.id}`, { category: newCategory });
      if (response.data) {
        // Update local state
        setPhotos(prev => prev.map(p => 
          p.id === photo.id ? { ...p, category: newCategory } : p
        ));
        if (selectedPhoto?.id === photo.id) {
          setSelectedPhoto({ ...selectedPhoto, category: newCategory });
        }
        showToast({ type: 'success', message: `Photo category changed to "${newCategory}"` });
      } else {
        showToast({ type: 'error', message: 'Failed to update photo category' });
      }
    } catch (error: any) {
      console.error('Update category error:', error);
      showToast({ type: 'error', message: 'Failed to update photo category' });
    }
  };

  const handleDeletePhoto = async (photo: JobPhoto) => {
    confirm({
      title: 'Delete Photo',
      message: 'Are you sure you want to delete this photo?',
      confirmText: 'Delete',
      destructive: true,
    }).then(async (ok) => {
      if (!ok) return;
      try {
        await api.delete(`/api/jobs/${job?.id}/photos/${photo.id}`);
        setPhotos(photos.filter(p => p.id !== photo.id));
        setSelectedPhoto(null);
      } catch (error) {
        setPhotos(photos.filter(p => p.id !== photo.id));
        setSelectedPhoto(null);
      }
    });
  };

  const [isSavingMedia, setIsSavingMedia] = useState(false);
  
  const handleSaveMedia = async (photo: JobPhoto) => {
    if (isSavingMedia) return;
    
    const isVideo = photo.mimeType?.startsWith('video/');
    const mediaUrl = photo.signedUrl || photo.url || `${api.getBaseUrl()}/api/jobs/${job?.id}/photos/${photo.id}/view`;
    
    setIsSavingMedia(true);
    
    try {
      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (!isSharingAvailable) {
        showToast({ type: 'info', message: 'Not Available', description: 'Sharing is not available on this device' });
        setIsSavingMedia(false);
        return;
      }

      const extension = isVideo ? (photo.fileName?.split('.').pop() || 'mp4') : 'jpg';
      const filename = photo.fileName || `media_${Date.now()}.${extension}`;
      const localUri = `${FileSystem.cacheDirectory}${filename}`;

      const downloadResult = await FileSystem.downloadAsync(mediaUrl, localUri);
      
      if (downloadResult.status === 200) {
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: photo.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
          dialogTitle: `Save ${isVideo ? 'Video' : 'Photo'} to...`,
        });
      } else {
        showToast({ type: 'error', message: 'Failed to download media. Please try again.' });
      }
    } catch (error: any) {
      console.error('Save media error:', error);
      showToast({ type: 'error', message: `Failed to save ${isVideo ? 'video' : 'photo'}. ${error.message || 'Please try again.'}` });
    } finally {
      setIsSavingMedia(false);
    }
  };

  const handleAnnotatedPhotoSave = async (annotatedUri: string) => {
    if (!job) return;
    
    setIsUploadingPhoto(true);
    setShowAnnotationEditor(false);
    
    try {
      const base64Data = annotatedUri.split(',')[1];
      if (!base64Data) {
        throw new Error('Invalid image data');
      }
      
      const filename = `annotated_${Date.now()}.jpg`;
      const tempFilePath = `${FileSystem.cacheDirectory}${filename}`;
      
      await FileSystem.writeAsStringAsync(tempFilePath, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      const token = await api.getToken();
      const uploadUrl = `${API_URL}/api/jobs/${job.id}/photos/upload`;
      
      // Use FileSystemUploadType.MULTIPART (value: 1) with fallback for compatibility
      const uploadType = FileSystem.FileSystemUploadType?.MULTIPART ?? 1;
      const uploadResult = await FileSystem.uploadAsync(uploadUrl, tempFilePath, {
        httpMethod: 'POST',
        uploadType: uploadType,
        fieldName: 'file',
        mimeType: 'image/jpeg',
        parameters: {
          category: 'annotated',
        },
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
      
      await FileSystem.deleteAsync(tempFilePath, { idempotent: true });
      
      if (uploadResult.status >= 200 && uploadResult.status < 300) {
        await loadPhotos();
        setSelectedPhoto(null);
        showToast({ type: 'success', message: 'Annotated photo saved successfully' });
      } else {
        console.error('Upload failed:', uploadResult.status, uploadResult.body);
        showToast({ type: 'error', message: 'Failed to save annotated photo. Please try again.' });
      }
    } catch (error: any) {
      console.error('Annotated photo upload error:', error);
      showToast({ type: 'error', message: error.message || 'Failed to upload annotated photo. Please try again.' });
    }
    setIsUploadingPhoto(false);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Not scheduled';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-AU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-AU', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const tabBadgeCounts = useMemo(() => {
    const chatCount = jobMessages.length;
    const docsCount = pendingSafetyForms.length + (hasIncompleteSwms ? 1 : 0);
    return {
      overview: 0,
      documents: docsCount,
      chat: chatCount,
      manage: 0,
    };
  }, [jobMessages.length, pendingSafetyForms.length, hasIncompleteSwms]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen
          options={{
            headerShown: Platform.OS !== 'android',
            // The global <Header /> already consumes the status-bar inset, so on
            // Android this nested native header must NOT reserve it again (avoids
            // a phantom gap that pushes the job content too far down).
            // (headerStatusBarHeight is a valid native-stack option that
            // expo-router's option type doesn't surface, hence the cast.)
            ...(Platform.OS === 'android' ? ({ headerStatusBarHeight: 0 } as any) : {}),
            title: '',
            headerBackVisible: false,
            headerShadowVisible: false,
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.primary,
            headerLeft: () => (
              <Pressable
                onPress={() => router.back()}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{ flexDirection: 'row', alignItems: 'center' }}
              >
                <Feather name="chevron-left" size={17} color={colors.primary} />
                <Text style={{ fontSize: typography.subtitle.fontSize, color: colors.primary, marginLeft: -1 }}>Back</Text>
              </Pressable>
            ),
          }}
        />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!job) {
    const sessionExpired = isAuthErrorMessage(loadError);
    return (
      <View style={styles.errorContainer}>
        <Feather name={sessionExpired ? 'log-in' : 'alert-circle'} size={48} color={loadError ? colors.destructive : colors.mutedForeground} />
        <Text style={styles.errorText}>{sessionExpired ? 'Session expired' : (loadError ? 'Failed to load job' : 'Job not found')}</Text>
        <Text style={[styles.errorText, { fontSize: typography.button.fontSize, marginTop: 4 }]}>
          {sessionExpired
            ? 'Your session has timed out. Please sign in again to continue.'
            : (loadError || 'The job may have been deleted or you don\'t have access.')}
        </Text>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
          {sessionExpired ? (
            <TouchableOpacity activeOpacity={0.8} onPress={() => { logout(); }} style={styles.errorPrimaryBtn}>
              <Feather name="log-in" size={16} color={colors.primaryForeground} />
              <Text style={styles.errorPrimaryBtnText}>Sign in</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity activeOpacity={0.8} onPress={loadJob} style={styles.errorPrimaryBtn}>
              <Feather name="refresh-cw" size={16} color={colors.primaryForeground} />
              <Text style={styles.errorPrimaryBtnText}>Retry</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity activeOpacity={0.8} onPress={() => router.back()} style={styles.errorSecondaryBtn}>
            <Text style={styles.errorSecondaryBtnText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Cross-workspace gate. This job belongs to one business (job.userId). The
  // active workspace's owner is user.businessOwnerId — the server's /api/auth/me
  // resolves it from the active business membership (for joined workers it's the
  // business owner; for an owner / personal profile it's the user's own id). If
  // those don't match, the user is viewing a job from a DIFFERENT workspace —
  // timers and edits would silently fail — so we block the screen and make them
  // switch first. Fail open if user isn't loaded to avoid wrongly locking out a
  // legitimate worker.
  const activeOwnerId = user?.businessOwnerId ?? user?.id ?? null;
  const isOutOfWorkspace = !!user && !!job.userId && !!activeOwnerId && job.userId !== activeOwnerId;
  if (isOutOfWorkspace) {
    const targetBusinessName = (job as any).businessName || "the job's business";
    return (
      <View style={styles.errorContainer}>
        <Feather name="briefcase" size={48} color={colors.primary} />
        <Text style={styles.errorText}>Switch workspace to open this job</Text>
        <Text style={[styles.errorText, { fontSize: typography.button.fontSize, marginTop: 4 }]}>
          This job belongs to {targetBusinessName}. You're currently in a different workspace, so you can't start a timer or make changes here. Switch to that workspace to work on it.
        </Text>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
          <TouchableOpacity activeOpacity={0.8} onPress={() => setShowWorkspaceSwitcher(true)} style={styles.errorPrimaryBtn}>
            <Feather name="repeat" size={16} color={colors.primaryForeground} />
            <Text style={styles.errorPrimaryBtnText}>Switch workspace</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.8} onPress={() => router.back()} style={styles.errorSecondaryBtn}>
            <Text style={styles.errorSecondaryBtnText}>Go back</Text>
          </TouchableOpacity>
        </View>
        <WorkspaceSwitcher
          visible={showWorkspaceSwitcher}
          onClose={() => setShowWorkspaceSwitcher(false)}
          onSwitch={() => { setShowWorkspaceSwitcher(false); loadJob(); }}
        />
      </View>
    );
  }

  const rawAction = STATUS_ACTIONS[job.status];
  const canCreateInvoices = isOwnerOrManager || isSoloOwner || (typeof hasPermission === 'function' && hasPermission('create_invoices'));

  // Job-completion gate. Only the business owner / manager of THIS job gets the
  // overall "Complete Job" flow. Every assigned worker — including the primary
  // (lead) assignee and a standalone subcontractor assigned to someone else's
  // job — marks their OWN part instead. The owner closes the job once everyone
  // is done.
  const myAssignment = jobAssignments.find((a: any) => a.userId === user?.id);
  const hasMyActiveAssignment = !!myAssignment && myAssignment.isActive !== false;
  // True owner of this job (the business that owns the job record). A standalone
  // subcontractor whose own global role is "owner" is NOT the owner of a job that
  // belongs to a different business, so we key off the job's userId when present.
  const ownsThisJob = !!user && !!job.userId && job.userId === user.id;
  // The true job owner always gets the manager flow immediately. The role-based
  // fallback (owner/manager with no assignment of their own) is gated on
  // assignmentsLoaded so an owner-role standalone subcontractor assigned to this
  // job isn't briefly shown the owner "Complete Job" flow before their own
  // assignment row has loaded.
  const isJobManager =
    ownsThisJob ||
    ((isOwnerOrManager || isSoloOwner) && assignmentsLoaded && !hasMyActiveAssignment);

  // Per-worker completion progress (X/Y) for the lead/owner view.
  const completedWorkerCount = jobAssignments.filter((a: any) => a.completedAt).length;
  const totalWorkerCount = jobAssignments.length;
  const allWorkersComplete = totalWorkerCount > 1 && completedWorkerCount === totalWorkerCount;

  // When a worker is completing their own part, the completion sheet must only
  // ever show THEIR own tracked time — showing other workers' parts makes it
  // look like they're signing off on someone else's work. The owner summary
  // keeps the full per-worker breakdown.
  const completionTimeEntries = completionMode === 'worker' && user?.id
    ? timeEntries.filter((e: any) => e.userId === user.id)
    : timeEntries;

  let action: { next: string; label: string; icon: keyof typeof Feather.glyphMap; iconSize: number } | null =
    (!canCreateInvoices && rawAction?.next === 'invoiced') ? null : (rawAction as any);
  const myPartComplete = myAssignment?.completedAt != null;
  if (action && action.next === 'done' && !isJobManager) {
    // Assigned workers (incl. the lead) finish their OWN part: this marks their
    // assignment complete AND clocks them off. The owner closes the job.
    if (hasMyActiveAssignment && !myPartComplete) {
      action = { next: 'complete_my_part', label: 'Mark My Part Complete', icon: 'check-circle', iconSize: 20 };
    } else if (hasMyActiveAssignment && myPartComplete) {
      // Already done their part — nothing left for them to do on the CTA.
      action = null;
    } else {
      // No assignment row (legacy/edge): fall back to a plain clock-off.
      action = isTimerForThisJob
        ? { next: 'clock_off', label: "Clock Off / I'm Done", icon: 'check-circle', iconSize: 20 }
        : null;
    }
  }

  const handleMainAction = () => {
    if (action && action.next === 'complete_my_part') {
      // Open the same rich completion modal the owner sees, in worker mode.
      setCompletionMode('worker');
      if (job) {
        api.get<SiteAttendance>(`/api/jobs/${job.id}/site-attendance`).then(res => {
          if (res.data && !res.error) setSiteAttendance(res.data);
        }).catch(() => {});
      }
      setShowCompletionModal(true);
    } else if (action && action.next === 'clock_off') {
      handleStopTimer();
    } else {
      handleStatusChange();
    }
  };
  const statusColor = getStatusColor(job.status);
  const clientInitials = client?.name ? client.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '?';

  const TAB_CONFIG = [
    { id: 'overview' as const, label: 'Overview', icon: 'briefcase' as const },
    { id: 'documents' as const, label: 'Docs', icon: 'file-text' as const },
    { id: 'chat' as const, label: 'Chat', icon: 'message-circle' as const },
    ...((isOwnerOrManager || isSoloOwner) ? [{ id: 'manage' as const, label: 'More', icon: 'settings' as const }] : []),
  ];

  const renderOverviewTab = () => (
    <>
      {jobConflictWarning && (
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.destructiveLight,
          borderRadius: radius.md,
          padding: spacing.md,
          marginBottom: spacing.md,
          borderWidth: 1,
          borderColor: colors.destructive,
          gap: spacing.sm,
        }}>
          <Feather name="alert-triangle" size={18} color={colors.destructive} />
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.caption, fontWeight: fontWeights.semibold, color: colors.destructive }}>
              Schedule Conflict ({jobConflictWarning.overlapMinutes}min overlap)
            </Text>
            <Text style={{ ...typography.captionSmall, color: colors.mutedForeground, marginTop: 2 }}>
              Overlaps with "{jobConflictWarning.otherJobTitle}" at {jobConflictWarning.otherBusinessName}
            </Text>
          </View>
        </View>
      )}

      {/* Job Progress Bar - Visual workflow indicator */}
      <JobProgressBar status={job.status} />

      {/* Job Card Section - primary view, leads the Job Card tab.
          The card container only shows when a job card form actually exists,
          otherwise JobForms renders nothing and we'd be left with an empty card. */}
      <View style={hasJobCardForms ? styles.photosCard : undefined}>
        <JobForms
          jobId={job.id}
          jobCardMode
          readOnly={job.status === 'invoiced'}
          onExport={handleExportJobCard}
          isExporting={isExportingJobCard}
          onFormsChange={(forms) => setHasJobCardForms(forms.some((f: any) => f.isJobCard))}
        />
      </View>

      {/* Wrap-Up Banner - appears when next job is approaching */}
      {showWrapUpBanner && wrapUpNextJob && (
        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            backgroundColor: colors.warning + '15',
            borderWidth: 1,
            borderColor: colors.warning + '40',
            borderRadius: radius.lg,
            padding: spacing.md,
            marginBottom: spacing.md,
          }}
          onPress={() => router.push(`/job/${wrapUpNextJob.id}`)}
          activeOpacity={0.8}
        >
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.warning + '25', alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="clock" size={18} color={colors.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.bold, color: colors.warning }}>Time to wrap up</Text>
            <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.foreground, marginTop: 2 }} numberOfLines={1}>
              {wrapUpNextJob.title} at {new Date(wrapUpNextJob.scheduledAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground, marginTop: 1 }}>
              ~{wrapUpDriveMinutes} min drive to next site
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.warning} />
        </TouchableOpacity>
      )}

      {/* Main Action Button - Hero zone, first thing after status */}
      <View style={styles.actionButtonContainer}>
        {allWorkersComplete && isJobManager && job.status !== 'done' && job.status !== 'invoiced' && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            borderLeftWidth: 3,
            borderLeftColor: colors.success,
            borderRadius: radius.lg,
            padding: spacing.md,
            marginBottom: spacing.sm,
          }}>
            <Feather name="check-circle" size={18} color={colors.success} />
            <Text style={{ ...typography.caption, color: colors.foreground, flex: 1 }}>
              All {totalWorkerCount} workers have completed their part. You can finish the job.
            </Text>
          </View>
        )}
        {action ? (
          job.status === 'scheduled' && job.clientId ? (
            <View style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {job.workerStatus === 'on_my_way' ? (
                <TouchableOpacity
                  style={[styles.mainActionButton, {
                    flex: 1,
                    flexBasis: 0,
                    minWidth: 0,
                    borderWidth: 1.5,
                    borderColor: colors.info,
                    backgroundColor: colors.card,
                  }]}
                  onPress={() => {
                    const { openMapsWithPreference } = require('../../src/lib/maps-store');
                    if (job.latitude && job.longitude) {
                      openMapsWithPreference(job.latitude, job.longitude, job.address);
                    } else if (job.address) {
                      const { openMapsWithAddress } = require('../../src/lib/maps-store');
                      openMapsWithAddress(job.address);
                    }
                  }}
                  activeOpacity={0.8}
                  data-testid="button-directions"
                >
                  <Feather name="map" size={18} color={colors.info} />
                  <Text style={{ color: colors.info, fontWeight: fontWeights.semibold, fontSize: typography.button.fontSize, marginLeft: spacing.xs }}>
                    Directions
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.mainActionButton, {
                    flex: 1,
                    flexBasis: 0,
                    minWidth: 0,
                    borderWidth: 1.5,
                    borderColor: colors.info,
                    backgroundColor: colors.card,
                    opacity: isSendingOnMyWay ? 0.6 : 1,
                  }]}
                  onPress={handleOnMyWay}
                  activeOpacity={0.8}
                  disabled={isSendingOnMyWay}
                  data-testid="button-on-my-way"
                >
                  <Feather name="navigation" size={18} color={colors.info} />
                  <Text style={{ color: colors.info, fontWeight: fontWeights.semibold, fontSize: typography.button.fontSize }}>
                    On My Way
                  </Text>
                  {isSendingOnMyWay && (
                    <ActivityIndicator size="small" color={colors.info} style={{ marginLeft: 4 }} />
                  )}
                </TouchableOpacity>
              )}
              
              <PressableRow
                style={[styles.mainActionButton, { backgroundColor: colors.primary, flex: 1, flexBasis: 0, minWidth: 0 }]}
                onPress={handleMainAction}

                data-testid="button-main-action"
              >
                <View style={styles.mainActionButtonIcon}>
                  <Feather name={action.icon} size={action.iconSize} color={colors.primaryForeground} />
                </View>
                <Text style={styles.mainActionText}>{action.label}</Text>
              </PressableRow>
              </View>
              {job.workerStatus === 'on_my_way' && (
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingVertical: 6,
                    opacity: isSendingOnMyWay ? 0.5 : 1,
                  }}
                  onPress={handleOnMyWay}
                  activeOpacity={0.7}
                  disabled={isSendingOnMyWay}
                  data-testid="button-resend-on-my-way"
                >
                  {isSendingOnMyWay ? (
                    <ActivityIndicator size="small" color={colors.mutedForeground} />
                  ) : (
                    <>
                      <Feather name="refresh-cw" size={13} color={colors.mutedForeground} />
                      <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground }}>Resend "On My Way" notification</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <PressableRow
              style={[styles.mainActionButton, { backgroundColor: colors.primary }]}
              onPress={handleMainAction}

              data-testid="button-main-action"
            >
              <View style={styles.mainActionButtonIcon}>
                <Feather name={action.icon} size={action.iconSize} color={colors.primaryForeground} />
              </View>
              <Text style={styles.mainActionText}>{action.label}</Text>
            </PressableRow>
          )
        ) : job.status === 'invoiced' && !invoice && (
          <Text style={styles.invoicedMessage}>This job has been invoiced</Text>
        )}
      </View>

      {/* Scheduled Date Card - right after action buttons */}
      {(job.scheduledAt || job.status === 'scheduled') && (
        <PressableRow 
 
          style={styles.card}
          onPress={isSubcontractorUser ? undefined : () => {
            setScheduleDate(job.scheduledAt ? new Date(job.scheduledAt) : new Date());
            setShowScheduleModal(true);
          }}
        >
          <View style={[styles.cardIconContainer, { backgroundColor: `${colors.primary}15` }]}>
            <Feather name="clock" size={iconSizes.xl} color={colors.primary} />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardLabel}>Scheduled</Text>
            <Text style={[styles.cardValue, !job.scheduledAt && { color: colors.mutedForeground }]}>
              {job.scheduledAt
                ? `${formatDate(job.scheduledAt)} at ${formatTime(job.scheduledAt)}`
                : 'No time set — tap to schedule'}
            </Text>
          </View>
          {!isSubcontractorUser && (
            <Feather 
              name="edit-2" 
              size={iconSizes.lg} 
              color={colors.primary} 
              style={styles.cardActionIcon}
            />
          )}
        </PressableRow>
      )}

      {/* Safety & Compliance Section - Prominent before work starts */}
      {(job.status === 'scheduled' || job.status === 'in_progress') && (availableForms.some(isSafetyForm) || swmsDocuments.length > 0 || hasNoSafetyDocs) && (
        <View style={[
          styles.card, 
          (pendingSafetyForms.length > 0 || hasIncompleteSwms || hasNoSafetyDocs) && { borderColor: colors.warning, borderWidth: 1.5, backgroundColor: colors.warningLight }
        ]}>
          <View style={[styles.cardIconContainer, { backgroundColor: (pendingSafetyForms.length > 0 || hasIncompleteSwms || hasNoSafetyDocs) ? `${colors.warning}15` : `${colors.success}15` }]}>
            <Feather 
              name={(pendingSafetyForms.length > 0 || hasIncompleteSwms || hasNoSafetyDocs) ? "alert-triangle" : "shield"} 
              size={iconSizes.xl} 
              color={(pendingSafetyForms.length > 0 || hasIncompleteSwms || hasNoSafetyDocs) ? colors.warning : colors.success} 
            />
          </View>
          <View style={styles.cardContent}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Text style={styles.cardLabel}>Safety & Compliance</Text>
              {(pendingSafetyForms.length > 0 || hasIncompleteSwms || hasNoSafetyDocs) && (
                <View style={{ backgroundColor: colors.warning, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ color: 'white', fontSize: typography.sizes.xs, fontWeight: fontWeights.bold }}>REQUIRED</Text>
                </View>
              )}
            </View>
            <Text style={[styles.cardValue, (pendingSafetyForms.length > 0 || hasIncompleteSwms || hasNoSafetyDocs) && { color: colors.warning, fontWeight: fontWeights.bold }]}>
              {pendingSafetyForms.length > 0 && hasIncompleteSwms
                ? 'Safety forms + SWMS pending'
                : pendingSafetyForms.length > 0
                ? 'Safety forms not completed'
                : hasIncompleteSwms
                ? 'SWMS incomplete or unsigned'
                : hasNoSafetyDocs
                ? 'No safety documentation'
                : `All safety docs completed${completedSafetyFormCount > 0 ? ` (${completedSafetyFormCount})` : ''}`}
            </Text>
          </View>
          <TouchableOpacity 
            onPress={() => setActiveTab('documents')}
            style={{ padding: spacing.sm }}
          >
            <Feather name="chevron-right" size={iconSizes.lg} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      )}

      {/* Time Tracking Card - prominent for in-progress jobs */}
      {(job.status === 'in_progress') && (() => {
        const isBreakActive = isTimerForThisJob && isOnBreak();
        return (
          <Animated.View 
            style={[
              styles.timerCard, 
              isTimerForThisJob && (isBreakActive ? styles.timerBreakCard : styles.timerActiveCard),
              { transform: [{ scale: isTimerForThisJob ? pulseAnim : 1 }] }
            ]}
          >
            <View style={[
              styles.timerIconContainer, 
              isTimerForThisJob && (isBreakActive ? styles.timerBreakIcon : styles.timerActiveIcon)
            ]}>
              <Feather 
                name={isBreakActive ? "coffee" : "clock"} 
                size={iconSizes.xl} 
                color={isTimerForThisJob ? colors.primaryForeground : colors.primary} 
              />
            </View>
            <View style={styles.timerContent}>
              <Text style={styles.timerLabel}>
                {isBreakActive ? 'On Break' : 'Time Tracking'}
              </Text>
              {isTimerForThisJob ? (
                <Text style={[
                  styles.timerValue, 
                  isBreakActive ? styles.timerBreakValue : styles.timerActiveValue
                ]}>
                  {isBreakActive ? 'Break: ' : 'Running: '}{formatElapsedTime(elapsedTime)}
                </Text>
              ) : activeTimer ? (
                <Text style={styles.timerValue}>Timer on another job</Text>
              ) : totalTrackedHours > 0 ? (
                <Text style={styles.timerValue}>Total: {formatTrackedHours(totalTrackedHours)} tracked</Text>
              ) : (
                <Text style={styles.timerValue}>Not started</Text>
              )}
            </View>
            
            <View style={styles.timerButtonGroup}>
              {isTimerForThisJob ? (
                <>
                  <TouchableOpacity
                    onPress={isBreakActive ? handleResumeWork : handleTakeBreak}
                    style={[
                      styles.timerButton,
                      isBreakActive ? styles.resumeButton : styles.breakButton
                    ]}
                    disabled={timerLoading}
                  >
                    {timerLoading ? (
                      <ActivityIndicator size="small" color={colors.primaryForeground} />
                    ) : isBreakActive ? (
                      <Feather name="play" size={iconSizes.md} color={colors.primaryForeground} />
                    ) : (
                      <Feather name="coffee" size={iconSizes.md} color={colors.foreground} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleStopTimer}
                    style={[styles.timerButton, styles.stopButton]}
                    disabled={timerLoading}
                  >
                    <Feather name="square" size={iconSizes.md} color={colors.primaryForeground} />
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  onPress={handleStartTimer}
                  style={[styles.timerButton, styles.startButton]}
                  disabled={timerLoading}
                >
                  {timerLoading ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <Feather name="play" size={iconSizes.md} color={colors.primaryForeground} />
                  )}
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        );
      })()}

      {/* Time Entries List - shows individual completed entries */}
      {timeEntries.length > 0 && !isTimerForThisJob && (
        <View style={[styles.card, { flexDirection: 'column', alignItems: 'stretch', paddingVertical: spacing.md }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
            <View style={[styles.cardIconContainer, { backgroundColor: colorWithOpacity(colors.primary, 0.12) }]}>
              <Feather name="list" size={iconSizes.xl} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardLabel, { marginBottom: 0 }]}>Time Entries</Text>
              <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground }}>
                {timeEntries.filter(e => e.endTime && e.endTime !== 'null' && e.endTime !== '').length} entr{timeEntries.filter(e => e.endTime && e.endTime !== 'null' && e.endTime !== '').length === 1 ? 'y' : 'ies'} logged
              </Text>
            </View>
          </View>
          {timeEntries
            .filter(e => e.endTime && e.endTime !== 'null' && e.endTime !== '')
            .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
            .slice(0, 5)
            .map((entry, idx) => {
              const start = new Date(entry.startTime);
              const end = new Date(entry.endTime!);
              const durationMs = end.getTime() - start.getTime();
              const durationMin = Math.round(durationMs / (1000 * 60));
              const hrs = Math.floor(durationMin / 60);
              const mins = durationMin % 60;
              const timeStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
              const dateStr = start.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
              const startStr = start.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
              const endStr = end.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
              return (
                <View
                  key={entry.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: spacing.sm,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    gap: spacing.sm,
                  }}
                >
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: entry.isBreak ? colors.warning : colors.success }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.foreground }}>
                      {entry.isBreak ? 'Break' : (entry.userName || 'You')}
                    </Text>
                    <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground }}>
                      {dateStr} {startStr} - {endStr}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.bold, color: entry.isBreak ? colors.warning : colors.foreground }}>{timeStr}</Text>
                    {entry.hourlyRate && !entry.isBreak && (
                      <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground }}>${parseFloat(entry.hourlyRate).toFixed(0)}/hr</Text>
                    )}
                  </View>
                </View>
              );
            })}
          {timeEntries.filter(e => e.endTime && e.endTime !== 'null' && e.endTime !== '').length > 5 && (
            <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, textAlign: 'center', marginTop: spacing.sm }}>
              + {timeEntries.filter(e => e.endTime && e.endTime !== 'null' && e.endTime !== '').length - 5} more entries
            </Text>
          )}
        </View>
      )}

      {/* Team on Job - shows all workers currently tracked on this job */}
      {teamTimers.length > 0 && (
        <View style={[styles.card, { flexDirection: 'column', alignItems: 'stretch', paddingVertical: spacing.md }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
            <View style={[styles.cardIconContainer, { backgroundColor: colorWithOpacity(colors.info, 0.12) }]}>
              <Feather name="users" size={iconSizes.xl} color={colors.info} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardLabel, { marginBottom: 0 }]}>Team on Job</Text>
              <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground }}>
                {teamTimers.length} worker{teamTimers.length !== 1 ? 's' : ''} clocked in
              </Text>
            </View>
          </View>
          {teamTimers.map((timer, idx) => {
            const hrs = Math.floor(timer.elapsedMinutes / 60);
            const mins = timer.elapsedMinutes % 60;
            const timeStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
            return (
              <View 
                key={timer.id} 
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: spacing.sm,
                  borderTopWidth: idx === 0 ? 1 : 0,
                  borderBottomWidth: idx < teamTimers.length - 1 ? 1 : 0,
                  borderColor: colors.border,
                  gap: spacing.sm,
                }}
              >
                <TeamAvatar
                  name={timer.workerName}
                  userId={timer.userId ? String(timer.userId) : undefined}
                  themeColor={(timer as any).themeColor}
                  size={36}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: typography.sizes.md, fontWeight: fontWeights.semibold, color: colors.foreground }}>
                    {timer.workerName}{timer.isCurrentUser ? ' (You)' : ''}
                  </Text>
                  {(isOwnerOrManager || isSoloOwner) ? (
                    <TouchableOpacity
                      onPress={() => {
                        setEditRateTimer({ id: timer.id, workerName: timer.workerName, hourlyRate: timer.hourlyRate });
                        setRateInput(String(timer.hourlyRate ?? ''));
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    >
                      <Text style={{ fontSize: typography.sizes.sm, color: colors.primary, fontWeight: fontWeights.semibold }}>
                        ${timer.hourlyRate}/hr
                      </Text>
                      <Feather name="edit-2" size={12} color={colors.primary} />
                    </TouchableOpacity>
                  ) : (
                    <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground }}>
                      ${timer.hourlyRate}/hr
                    </Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ 
                    fontSize: typography.sizes.md, 
                    fontWeight: fontWeights.bold,
                    color: timer.isPaused || timer.isBreak ? colors.warning : colors.success,
                    fontVariant: ['tabular-nums'],
                  }}>
                    {timeStr}
                  </Text>
                  <View style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    gap: 4,
                    backgroundColor: timer.isPaused || timer.isBreak 
                      ? colorWithOpacity(colors.warning, 0.12)
                      : colorWithOpacity(colors.success, 0.12),
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                    marginTop: 2,
                  }}>
                    <View style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: timer.isPaused || timer.isBreak ? colors.warning : colors.success,
                    }} />
                    <Text style={{ 
                      fontSize: typography.sizes.xs, 
                      fontWeight: fontWeights.semibold,
                      color: timer.isPaused || timer.isBreak ? colors.warning : colors.success,
                    }}>
                      {timer.isPaused ? 'Paused' : timer.isBreak ? 'On Break' : 'Working'}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Site Update Quick Action - visible during in_progress - positioned prominently */}
      {job.status === 'in_progress' && (
        <PressableRow

          style={[styles.card, { borderColor: colors.primary + '40' }]}
          onPress={() => {
            setSiteUpdateNote('');
            setSiteUpdatePhotoUri(null);
            setShowSiteUpdateModal(true);
          }}
        >
          <View style={[styles.cardIconContainer, { backgroundColor: colorWithOpacity(colors.primary, 0.15) }]}>
            <Feather name="send" size={iconSizes.xl} color={colors.primary} />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardLabel}>Quick Action</Text>
            <Text style={[styles.cardValue, { color: colors.primary, fontWeight: fontWeights.semibold }]}>Post Site Update</Text>
          </View>
          <Feather name="chevron-right" size={iconSizes.lg} color={colors.primary} style={styles.cardActionIcon} />
        </PressableRow>
      )}

      {/* Smart Next Action Card - guides tradie through workflow (hidden for subcontractors) */}
      {!isSubcontractorUser && (
      <NextActionCard
        jobStatus={job.status}
        hasInvoice={!!invoice}
        hasQuote={!!quote}
        quoteStatus={(quote as any)?.status}
        invoiceStatus={(invoice as any)?.status}
        scheduledAt={job.scheduledAt}
        urgencyLabel={undefined}
        isOverdue={getJobUrgency(job.scheduledAt, job.status, colors.isDark)?.level === 'overdue'}
        clientPhone={client?.phone}
        clientName={client?.name?.split(' ')[0]}
        jobId={job.id}
        jobAddress={job.address}
        businessName={businessSettings?.businessName}
        tradieName={user?.firstName || user?.name?.split(' ')[0]}
        workerStatus={job.workerStatus}
        onCreateInvoice={canCreateInvoices ? () => router.push(`/more/invoice/new?jobId=${job.id}${client ? `&clientId=${client.id}` : ''}`) : undefined}
        onCreateQuote={() => router.push(`/more/quote/new?jobId=${job.id}${client ? `&clientId=${client.id}` : ''}`)}
        onSendQuote={async () => {
          if (quote?.id && client?.email) {
            try {
              await api.post(`/api/quotes/${quote.id}/send`, { method: 'email' });
              showToast({ type: 'success', message: 'Email Sent', description: `Quote sent to ${client.email}` });
            } catch {
              showToast({ type: 'error', message: 'Could not send quote. Please try again.' });
            }
          } else {
            showToast({ type: 'info', message: 'Cannot Send', description: client?.email ? 'No quote found' : 'Client has no email address on file.' });
          }
        }}
        onSchedule={handleStatusChange}
        onStartJob={handleStatusChange}
        onCompleteJob={handleStatusChange}
        canCompleteJob={!!isJobManager}
        onSendInvoice={async () => {
          if (invoice?.id && client?.email) {
            try {
              await api.post(`/api/invoices/${invoice.id}/send`, { method: 'email' });
              showToast({ type: 'success', message: 'Email Sent', description: `Invoice sent to ${client.email}` });
            } catch {
              showToast({ type: 'error', message: 'Could not send invoice. Please try again.' });
            }
          } else {
            showToast({ type: 'info', message: 'Cannot Send', description: client?.email ? 'No invoice found' : 'Client has no email address on file.' });
          }
        }}
        onSendReminder={async () => {
          if (invoice?.id && client?.email) {
            try {
              await api.post(`/api/invoices/${invoice.id}/send`, { method: 'email' });
              showToast({ type: 'success', message: 'Reminder Sent', description: `Payment reminder sent to ${client.email}` });
            } catch {
              showToast({ type: 'error', message: 'Could not send reminder. Please try again.' });
            }
          } else {
            showToast({ type: 'info', message: 'Cannot Send', description: 'Client has no email address on file.' });
          }
        }}
      />
      )}

      {/* Address Card */}
      {job.address && (
        <PressableRow 
 
          style={styles.card}
          onPress={handleNavigate}
        >
          <View style={[styles.cardIconContainer, { backgroundColor: `${colors.scheduled}15` }]}>
            <Feather name="map-pin" size={iconSizes.xl} color={colors.scheduled} />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardLabel}>Address</Text>
            <Text style={styles.cardValue} numberOfLines={2} ellipsizeMode="tail">{job.address}</Text>
          </View>
          <Feather 
            name="navigation" 
            size={iconSizes.lg} 
            color={colors.primary} 
            style={styles.cardActionIcon}
          />
        </PressableRow>
      )}


      {/* Client Card */}
      {client && (
        <View style={styles.clientCard}>
          <PressableRow 
            style={styles.clientHeader}
            onPress={handleViewClient}

          >
            <TeamAvatar
              name={client?.name}
              userId={client?.id ? String(client.id) : undefined}
              size={40}
            />
            <View style={styles.clientInfo}>
              <Text style={styles.clientName} numberOfLines={1} ellipsizeMode="tail">{client.name}</Text>
              {client.email && (
                <Text style={styles.clientEmail} numberOfLines={1} ellipsizeMode="tail">{client.email}</Text>
              )}
            </View>
            <Feather name="chevron-right" size={iconSizes.lg} color={colors.mutedForeground} />
          </PressableRow>
          
          <View style={styles.clientActions}>
            {client.phone && (
              <TouchableOpacity 
                style={[styles.clientActionButton, { backgroundColor: `${colors.success}15` }]}
                onPress={handleCall}
                activeOpacity={0.7}
              >
                <Feather name="phone" size={iconSizes.md} color={colors.success} />
                <Text style={[styles.clientActionText, { color: colors.success }]}>Call</Text>
              </TouchableOpacity>
            )}
            {client.phone && (
              <TouchableOpacity 
                style={[styles.clientActionButton, { backgroundColor: `${colors.scheduled}15` }]}
                onPress={handleSMS}
                activeOpacity={0.7}
              >
                <Feather name="message-square" size={iconSizes.md} color={colors.scheduled} />
                <Text style={[styles.clientActionText, { color: colors.scheduled }]}>SMS</Text>
              </TouchableOpacity>
            )}
            {client.email && (
              <TouchableOpacity 
                style={[styles.clientActionButton, { backgroundColor: `${colors.invoiced}15` }]}
                onPress={handleEmail}
                activeOpacity={0.7}
              >
                <Feather name="mail" size={iconSizes.md} color={colors.invoiced} />
                <Text style={[styles.clientActionText, { color: colors.invoiced }]}>Email</Text>
              </TouchableOpacity>
            )}
          </View>
          {(client?.email || client?.phone) && (
            <TouchableOpacity 
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                flexWrap: 'wrap',
                gap: spacing.xs,
                marginTop: spacing.md,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.lg,
                borderRadius: radius.lg,
                backgroundColor: `${colors.primary}10`,
                borderWidth: 1,
                borderColor: `${colors.primary}25`,
                minHeight: 48,
              }}
              onPress={() => {
                setSendModalDefaultTab(client?.email ? 'email' : 'sms');
                setShowSendModal(true);
              }}
              activeOpacity={0.7}
            >
              <Feather name="zap" size={15} color={colors.primary} />
              <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.bold, color: colors.primary }}>
                Send via JobRunner
              </Text>
              <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground }}>
                SMS & Email from +61 485 013 993
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Assigned Team Card */}
      {(roleInfo?.isOwner || roleInfo?.roleName === 'admin') && (
        <View style={{
          backgroundColor: colors.card,
          borderRadius: radius.xl,
          padding: spacing.lg,
          marginBottom: spacing.md,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          ...shadows.sm,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: jobAssignments.length > 0 ? spacing.md : 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View style={[styles.cardIconContainer, { backgroundColor: `${colors.primary}15` }]}>
                <Feather name="users" size={iconSizes.lg} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.cardLabel}>Assigned Team</Text>
                <Text style={{ ...typography.caption, color: allWorkersComplete ? colors.success : colors.mutedForeground }}>
                  {jobAssignments.length > 0
                    ? (totalWorkerCount > 1
                        ? `${completedWorkerCount}/${totalWorkerCount} workers complete`
                        : `${jobAssignments.length} worker`)
                    : 'No workers assigned'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => {
                const currentlyAssigned = new Set(jobAssignments.map((a: any) => a.userId));
                setSelectedWorkerIds(currentlyAssigned);
                loadTeamAvailability();
                setShowAssignModal(true);
              }}
              style={{
                backgroundColor: `${colors.primary}15`,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
                borderRadius: radius.lg,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}
              activeOpacity={0.7}
            >
              <Feather name="plus" size={14} color={colors.primary} />
              <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.primary }}>
                {jobAssignments.length > 0 ? 'Edit' : 'Assign'}
              </Text>
            </TouchableOpacity>
          </View>

          {jobAssignments.map((assignment: any) => {
            const member = teamMembers.find(m =>
              m.userId === assignment.userId || m.memberId === assignment.userId || m.id === assignment.userId
            );
            const displayName = assignment.workerDisplayNameSnapshot || member?.name || 'Worker';
            const statusColors: Record<string, string> = {
              assigned: colors.mutedForeground,
              accepted: colors.primary,
              en_route: colors.warning,
              arrived: colors.success,
              in_progress: colors.success,
              completed: colors.mutedForeground,
            };
            const statusLabels: Record<string, string> = {
              assigned: 'Assigned',
              accepted: 'Accepted',
              en_route: 'On the way',
              arrived: 'On site',
              in_progress: 'Working',
              completed: 'Done',
            };
            const statusColor = statusColors[assignment.assignmentStatus] || colors.mutedForeground;
            const statusLabel = statusLabels[assignment.assignmentStatus] || assignment.assignmentStatus;

            return (
              <View
                key={assignment.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: spacing.sm,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  gap: spacing.sm,
                }}
              >
                <TeamAvatar
                  name={displayName}
                  userId={assignment.userId}
                  themeColor={member?.themeColor || (member as any)?.themeColor}
                  size={36}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ ...typography.body, color: colors.foreground, fontWeight: fontWeights.semibold }}>{displayName}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    {assignment.completedAt ? (
                      <>
                        <Feather name="check-circle" size={12} color={colors.success} />
                        <Text style={{ ...typography.caption, color: colors.success }}>
                          Part done{assignment.completedAt ? ` · ${new Date(assignment.completedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} ${new Date(assignment.completedAt).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}` : ''}
                        </Text>
                      </>
                    ) : (
                      <>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusColor }} />
                        <Text style={{ ...typography.caption, color: statusColor }}>{statusLabel}</Text>
                      </>
                    )}
                    {assignment.isPrimary && (
                      <Text style={{ ...typography.caption, color: colors.mutedForeground }}> · Lead</Text>
                    )}
                  </View>
                </View>
                {!assignment.isPrimary && jobAssignments.length > 1 && (
                  <TouchableOpacity
                    onPress={() => handleMakeLead(assignment.id, displayName)}
                    style={{
                      padding: spacing.xs,
                      borderRadius: radius.md,
                      backgroundColor: `${colors.primary}10`,
                    }}
                    activeOpacity={0.7}
                  >
                    <Feather name="star" size={16} color={colors.primary} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => handleNudgeWorker(assignment.userId)}
                  disabled={isNudging === assignment.userId}
                  style={{
                    padding: spacing.xs,
                    borderRadius: radius.md,
                    backgroundColor: `${colors.primary}10`,
                  }}
                  activeOpacity={0.7}
                >
                  {isNudging === assignment.userId ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Feather name="bell" size={16} color={colors.primary} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleRemoveAssignment(assignment.userId)}
                  style={{
                    padding: spacing.xs,
                    borderRadius: radius.md,
                  }}
                  activeOpacity={0.7}
                >
                  <Feather name="x" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      {/* Description & Notes Card */}
      {(job.description || job.notes || jobNotes.length > 0) && (
        <View style={{
          backgroundColor: colors.card,
          borderRadius: radius.xl,
          padding: spacing.lg,
          marginBottom: spacing.md,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          ...shadows.sm,
        }}>
          {job.description && (
            <View style={{ marginBottom: (job.notes || jobNotes.length > 0) ? spacing.md : 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
                <Feather name="align-left" size={14} color={colors.mutedForeground} />
                <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.bold, color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.3 }}>Description</Text>
              </View>
              <Text style={{ fontSize: typography.button.fontSize, color: colors.foreground, lineHeight: 20 }}>{job.description}</Text>
            </View>
          )}
          {(jobNotes.length > 0 || job.notes) && (
            <TouchableOpacity
              onPress={() => { setEditingNote(null); setEditedNotes(''); setShowNotesModal(true); }}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
                <Feather name="edit-3" size={14} color={colors.mutedForeground} />
                <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.bold, color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.3 }}>Notes</Text>
                <Feather name="plus" size={12} color={colors.primary} style={{ marginLeft: 'auto' }} />
              </View>
              <Text style={{ fontSize: typography.button.fontSize, color: colors.mutedForeground, lineHeight: 20 }} numberOfLines={3}>
                {jobNotes.length > 0 ? jobNotes[jobNotes.length - 1].content : job.notes}
              </Text>
              {jobNotes.length > 1 && (
                <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.primary, marginTop: 4 }}>+{jobNotes.length - 1} more note{jobNotes.length - 1 === 1 ? '' : 's'}</Text>
              )}
            </TouchableOpacity>
          )}
          {!job.notes && jobNotes.length === 0 && (
            <TouchableOpacity
              onPress={() => { setEditingNote(null); setEditedNotes(''); setShowNotesModal(true); }}
              activeOpacity={0.7}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: job.description ? spacing.md : 0, borderTopWidth: job.description ? 1 : 0, borderTopColor: colors.border }}
            >
              <Feather name="plus" size={14} color={colors.primary} />
              <Text style={{ fontSize: typography.sizes.sm, color: colors.primary, fontWeight: fontWeights.medium }}>Add private notes</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {!job.description && !job.notes && jobNotes.length === 0 && (
        <PressableRow
          style={styles.card}
          onPress={() => { setEditingNote(null); setEditedNotes(''); setShowNotesModal(true); }}
        >
          <View style={[styles.cardIconContainer, { backgroundColor: `${colors.primary}15` }]}>
            <Feather name="edit-3" size={iconSizes.xl} color={colors.primary} />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardLabel}>Notes</Text>
            <Text style={[styles.cardValue, { color: colors.primary }]}>Add private notes</Text>
          </View>
          <Feather name="plus" size={iconSizes.lg} color={colors.primary} />
        </PressableRow>
      )}

      {/* Time Tracking Card - for scheduled jobs only (in_progress shown at top) */}
      {(job.status === 'scheduled') && (() => {
        const isBreakActive = isTimerForThisJob && isOnBreak();
        return (
          <Animated.View 
            style={[
              styles.timerCard, 
              isTimerForThisJob && (isBreakActive ? styles.timerBreakCard : styles.timerActiveCard),
              { transform: [{ scale: isTimerForThisJob ? pulseAnim : 1 }] }
            ]}
          >
            <View style={[
              styles.timerIconContainer, 
              isTimerForThisJob && (isBreakActive ? styles.timerBreakIcon : styles.timerActiveIcon)
            ]}>
              <Feather 
                name={isBreakActive ? "coffee" : "clock"} 
                size={iconSizes.xl} 
                color={isTimerForThisJob ? colors.primaryForeground : colors.primary} 
              />
            </View>
            <View style={styles.timerContent}>
              <Text style={styles.timerLabel}>
                {isBreakActive ? 'On Break' : 'Time Tracking'}
              </Text>
              {isTimerForThisJob ? (
                <Text style={[
                  styles.timerValue, 
                  isBreakActive ? styles.timerBreakValue : styles.timerActiveValue
                ]}>
                  {isBreakActive ? 'Break: ' : 'Running: '}{formatElapsedTime(elapsedTime)}
                </Text>
              ) : activeTimer ? (
                <Text style={styles.timerValue}>Timer on another job</Text>
              ) : totalTrackedHours > 0 ? (
                <Text style={styles.timerValue}>Total: {formatTrackedHours(totalTrackedHours)} tracked</Text>
              ) : (
                <Text style={styles.timerValue}>Not started</Text>
              )}
            </View>
            
            {/* Timer action buttons */}
            <View style={styles.timerButtonGroup}>
              {isTimerForThisJob ? (
                <>
                  {/* Break / Resume button */}
                  <TouchableOpacity
                    onPress={isBreakActive ? handleResumeWork : handleTakeBreak}
                    style={[
                      styles.timerButton,
                      isBreakActive ? styles.resumeButton : styles.breakButton
                    ]}
                    disabled={timerLoading}
                  >
                    {timerLoading ? (
                      <ActivityIndicator size="small" color={colors.primaryForeground} />
                    ) : isBreakActive ? (
                      <Feather name="play" size={iconSizes.md} color={colors.primaryForeground} />
                    ) : (
                      <Feather name="coffee" size={iconSizes.md} color={colors.foreground} />
                    )}
                  </TouchableOpacity>
                  {/* Stop button */}
                  <TouchableOpacity
                    onPress={handleStopTimer}
                    style={[styles.timerButton, styles.stopButton]}
                    disabled={timerLoading}
                  >
                    <Feather name="square" size={iconSizes.md} color={colors.primaryForeground} />
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  onPress={handleStartTimer}
                  style={[styles.timerButton, styles.startButton]}
                  disabled={timerLoading}
                >
                  {timerLoading ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <Feather name="play" size={iconSizes.md} color={colors.primaryForeground} />
                  )}
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        );
      })()}

      {/* ═══ More Details — Collapsible Layer 3 ═══ */}
      {(!isSubcontractorUser || linkedJobs.length > 0 || activityLog.length > 0 || isOwnerOrManager || isSoloOwner) && (
      <CollapsibleSection
        summaryItems={[
          (quote || invoice) ? `${[quote && 'Quote', invoice && 'Invoice'].filter(Boolean).join(' + ')}` : '',
          linkedReceipt ? `Paid ${formatCurrency(linkedReceipt.amount)}` : '',
          linkedJobs.length > 0 ? `${linkedJobs.length} prev job${linkedJobs.length !== 1 ? 's' : ''}` : '',
          activityLog.length > 0 ? `${activityLog.length} activit${activityLog.length !== 1 ? 'ies' : 'y'}` : '',
          (profitabilityData?.revenue?.invoiced || 0) > 0 ? `${formatCurrency(profitabilityData!.revenue.invoiced)} revenue` : '',
          materials.length > 0 ? `${materials.length} material${materials.length !== 1 ? 's' : ''}` : '',
          jobExpenses.length > 0 ? `${jobExpenses.length} expense${jobExpenses.length !== 1 ? 's' : ''}` : '',
        ]}
      >

      {/* Previous Jobs Card */}
      {linkedJobs.length > 0 && (
        <View style={{
          backgroundColor: colors.card,
          borderRadius: radius.xl,
          padding: spacing.lg,
          marginBottom: spacing.md,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          ...shadows.sm,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <View style={{
              width: 32,
              height: 32,
              borderRadius: radius.md,
              backgroundColor: `${colors.primary}15`,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: spacing.sm,
            }}>
              <Feather name="briefcase" size={iconSizes.md} color={colors.primary} />
            </View>
            <Text style={{
              fontSize: typography.button.fontSize,
              fontWeight: fontWeights.semibold,
              color: colors.foreground,
              flex: 1,
            }}>Previous Jobs</Text>
            <Text style={{
              fontSize: typography.captionSmall.fontSize,
              color: colors.mutedForeground,
            }}>{linkedJobs.length} job{linkedJobs.length !== 1 ? 's' : ''}</Text>
          </View>
          {linkedJobs.map((lj) => {
            const ljDate = lj.scheduledAt || lj.completedAt;
            const statusColors: Record<string, string> = {
              pending: colors.pending || colors.warning,
              scheduled: colors.scheduled || colors.primary,
              in_progress: colors.inProgress || colors.primary,
              done: colors.success,
              invoiced: colors.invoiced || colors.primary,
            };
            const ljStatusColor = statusColors[lj.status] || colors.mutedForeground;
            return (
              <TouchableOpacity
                key={lj.id}
                activeOpacity={0.7}
                onPress={() => router.push(`/job/${lj.id}`)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: spacing.sm,
                  borderTopWidth: 1,
                  borderTopColor: colors.muted,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{
                    fontSize: typography.button.fontSize,
                    fontWeight: fontWeights.medium,
                    color: colors.foreground,
                  }} numberOfLines={1}>{lj.title}</Text>
                  {ljDate && (
                    <Text style={{
                      fontSize: typography.captionSmall.fontSize,
                      color: colors.mutedForeground,
                      marginTop: 2,
                    }}>{new Date(ljDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                  )}
                </View>
                <View style={{
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 2,
                  borderRadius: radius.sm,
                  backgroundColor: `${ljStatusColor}20`,
                  marginRight: spacing.sm,
                }}>
                  <Text style={{
                    fontSize: typography.sizes.xs,
                    fontWeight: fontWeights.semibold,
                    color: ljStatusColor,
                    textTransform: 'capitalize',
                  }}>{lj.status.replace('_', ' ')}</Text>
                </View>
                <Feather name="chevron-right" size={iconSizes.sm} color={colors.mutedForeground} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Linked Documents Card - hidden for subcontractors */}
      {!isSubcontractorUser && (
      <LinkedDocumentsCard
        linkedQuote={quote ? {
          id: quote.id,
          status: quote.status,
          total: quote.total,
          quoteNumber: quote.number,
        } : null}
        linkedInvoice={invoice ? {
          id: invoice.id,
          status: invoice.status,
          total: invoice.total,
          invoiceNumber: invoice.number,
        } : null}
        linkedReceipt={linkedReceipt}
        jobStatus={job.status}
        onViewQuote={handleViewQuote}
        onViewInvoice={handleViewInvoice}
        onViewReceipt={(receiptId) => router.push(`/more/receipt/${receiptId}`)}
        onCreateQuote={() => router.push(`/more/quote/new?jobId=${job.id}${client ? `&clientId=${client.id}` : ''}`)}
        onCreateInvoice={canCreateInvoices ? () => router.push(`/more/invoice/new?jobId=${job.id}${client ? `&clientId=${client.id}` : ''}`) : undefined}
      />
      )}

      {/* Quick Collect Payment - Shows when job has collectible amount (quote or materials) and no paid invoice */}
      {!isSubcontractorUser && (job.status === 'done' || job.status === 'in_progress') && !invoice && canCollectPayments && 
       ((quote && quote.status === 'accepted') || materials.length > 0) && getQuickCollectTotal() > 0 && (
        <View style={[styles.quickCollectCard, { borderColor: colors.cardBorder }]}>
          <View style={styles.quickCollectHeader}>
            <View style={[styles.quickCollectIconContainer, { backgroundColor: colorWithOpacity(colors.primary, 0.15) }]}>
              <Feather name="credit-card" size={iconSizes.lg} color={colors.primary} />
            </View>
            <View style={styles.quickCollectTitleContainer}>
              <Text style={[styles.quickCollectTitle, { color: colors.foreground }]}>Collect Payment Now</Text>
              <View style={[styles.quickCollectBadge, { backgroundColor: colors.muted }]}>
                <Text style={[styles.quickCollectBadgeText, { color: colors.mutedForeground }]}>
                  {getQuickCollectSource() === 'quote' ? 'Based on quote' : `${materials.length} material${materials.length !== 1 ? 's' : ''}`}
                </Text>
              </View>
            </View>
          </View>
          <Text style={[styles.quickCollectDescription, { color: colors.mutedForeground }]}>
            {getQuickCollectSource() === 'quote' 
              ? 'Collect payment using the accepted quote amount. Invoice and receipt will be created automatically.'
              : 'Collect payment based on materials total. Invoice and receipt will be created automatically.'}
          </Text>
          <View style={[styles.quickCollectAmountBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.quickCollectAmountLabel, { color: colors.mutedForeground }]}>
              {getQuickCollectSource() === 'quote' ? 'Quote total' : 'Materials total'}
            </Text>
            <Text style={[styles.quickCollectAmountValue, { color: colors.primary }]}>
              {formatCurrency(getQuickCollectTotal())}
            </Text>
          </View>
          {getQuickCollectSource() === 'materials' && materials.length > 0 && (
            <View style={{ marginBottom: spacing.sm }}>
              {materials.slice(0, 4).map((m, i) => (
                <View key={m.id || i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, paddingHorizontal: spacing.xs }}>
                  <Text style={{ ...typography.caption, color: colors.mutedForeground, flex: 1 }} numberOfLines={1}>
                    {m.name} {Number(m.quantity) > 1 ? `× ${m.quantity}` : ''}
                  </Text>
                  <Text style={{ ...typography.caption, color: colors.foreground, fontWeight: fontWeights.semibold }}>
                    {formatCurrency(Number(m.unitPrice || 0) > 0 ? Number(m.unitPrice) * Number(m.quantity || 1) : Number(m.totalCost || 0))}
                  </Text>
                </View>
              ))}
              {materials.length > 4 && (
                <Text style={{ ...typography.caption, color: colors.mutedForeground, textAlign: 'center', marginTop: 4 }}>
                  +{materials.length - 4} more items
                </Text>
              )}
            </View>
          )}
          <View style={styles.quickCollectButtons}>
            <TouchableOpacity
              style={[styles.quickCollectButton, { backgroundColor: colors.muted }, isQuickCollecting && { opacity: 0.6 }]}
              onPress={() => handleQuickCollect('cash')}
              activeOpacity={0.8}
              disabled={isQuickCollecting}
              data-testid="button-quick-collect-cash"
            >
              {isQuickCollecting ? (
                <ActivityIndicator size="small" color={colors.foreground} />
              ) : (
                <>
                  <Feather name="dollar-sign" size={iconSizes.md} color={colors.foreground} />
                  <Text style={[styles.quickCollectButtonText, { color: colors.foreground }]}>Cash</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickCollectButton, { backgroundColor: colors.muted }, isQuickCollecting && { opacity: 0.6 }]}
              onPress={() => handleQuickCollect('card')}
              activeOpacity={0.8}
              disabled={isQuickCollecting}
              data-testid="button-quick-collect-card"
            >
              <Feather name="credit-card" size={iconSizes.md} color={colors.foreground} />
              <Text style={[styles.quickCollectButtonText, { color: colors.foreground }]}>Card</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickCollectButton, { backgroundColor: colors.muted }, isQuickCollecting && { opacity: 0.6 }]}
              onPress={() => handleQuickCollect('bank_transfer')}
              activeOpacity={0.8}
              disabled={isQuickCollecting}
              data-testid="button-quick-collect-bank"
            >
              <Feather name="home" size={iconSizes.md} color={colors.foreground} />
              <Text style={[styles.quickCollectButtonText, { color: colors.foreground }]}>Bank</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Payment Collection Card - for collecting payment on invoiced jobs */}
      {!isSubcontractorUser && (
      <PaymentCollectionCard
        invoice={invoice ? {
          id: invoice.id,
          number: invoice.number,
          status: invoice.status,
          total: invoice.total,
          paidAmount: invoice.paidAmount,
        } : null}
        jobId={job.id}
        canCollectPayments={canCollectPayments}
        onTapToPay={handleTapToPay}
        onQRCode={handleQRCode}
        onPaymentLink={handlePaymentLink}
        onRecordCash={handleRecordCash}
      />
      )}

      {/* Payment Received Section - shows when there are linked receipts */}
      {!isSubcontractorUser && linkedReceipt && (
        <TouchableOpacity 
          style={styles.paymentReceivedCard}
          onPress={() => router.push(`/more/receipt/${linkedReceipt.id}`)}
          activeOpacity={0.7}
          data-testid="card-payment-received"
        >
          <View style={styles.paymentReceivedHeader}>
            <View style={[styles.paymentReceivedIcon, { backgroundColor: `${colors.success}15` }]}>
              <Feather name="check-circle" size={iconSizes.lg} color={colors.success} />
            </View>
            <View style={styles.paymentReceivedContent}>
              <Text style={styles.paymentReceivedTitle}>Payment Received</Text>
              <Text style={styles.paymentReceivedSubtitle}>
                {linkedReceipt.receiptNumber || 'Receipt'} • {linkedReceipt.paymentMethod || 'Payment'}
              </Text>
            </View>
            <View style={styles.paymentReceivedAmount}>
              <Text style={styles.paymentReceivedAmountText}>
                {formatCurrency(linkedReceipt.amount)}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} style={{ marginLeft: spacing.sm }} />
          </View>
          {linkedReceipt.createdAt && (
            <Text style={styles.paymentReceivedDate}>
              Received {new Date(linkedReceipt.createdAt).toLocaleDateString('en-AU', { 
                day: 'numeric', 
                month: 'short', 
                year: 'numeric' 
              })}
            </Text>
          )}
        </TouchableOpacity>
      )}

      {/* Compact Activity Log - Recent job activity */}
      {activityLog.length > 0 && (
        <View style={{
          backgroundColor: colors.card,
          borderRadius: radius.xl,
          padding: spacing.lg,
          marginBottom: spacing.md,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          ...shadows.sm,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <View style={{
              width: 32,
              height: 32,
              borderRadius: radius.md,
              backgroundColor: `${colors.inProgress}15`,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: spacing.sm,
            }}>
              <Feather name="activity" size={iconSizes.md} color={colors.inProgress} />
            </View>
            <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground, flex: 1 }}>Recent Activity</Text>
            <TouchableOpacity onPress={() => setActiveTab('manage')} activeOpacity={0.7}>
              <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.primary, fontWeight: fontWeights.medium }}>View All</Text>
            </TouchableOpacity>
          </View>
          {activityLog.slice(0, 3).map((item, index) => (
            <View key={item.id || index} style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              paddingVertical: spacing.sm,
              borderTopWidth: index > 0 ? 1 : 0,
              borderTopColor: colors.muted,
              gap: spacing.sm,
            }}>
              <View style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: colors.inProgress,
                marginTop: 6,
              }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: typography.sizes.sm, color: colors.foreground, fontWeight: fontWeights.medium }} numberOfLines={1}>
                  {item.title || item.description}
                </Text>
                <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground, marginTop: 2 }}>
                  {new Date(item.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Quick Financial Summary - Compact overview with tap to More */}
      {(isOwnerOrManager || isSoloOwner) && (
        <View style={{
          backgroundColor: colors.card,
          borderRadius: radius.xl,
          padding: spacing.lg,
          marginBottom: spacing.md,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          ...shadows.sm,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <View style={{
              width: 32,
              height: 32,
              borderRadius: radius.md,
              backgroundColor: `${colors.success}15`,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: spacing.sm,
            }}>
              <Feather name="bar-chart-2" size={iconSizes.md} color={colors.success} />
            </View>
            <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground, flex: 1 }}>Financials</Text>
            <TouchableOpacity onPress={() => setActiveTab('manage')} activeOpacity={0.7}>
              <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.primary, fontWeight: fontWeights.medium }}>Details</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {(() => {
              const pd = profitabilityData;
              const summaryItems = [];
              if (pd && pd.revenue.invoiced > 0) {
                summaryItems.push({ label: 'Revenue', value: formatCurrency(pd.revenue.invoiced), color: colors.foreground });
              }
              if (pd && pd.costs.total > 0) {
                summaryItems.push({ label: 'Costs', value: formatCurrency(pd.costs.total), color: colors.foreground });
              }
              if (pd && (pd.revenue.invoiced > 0 || pd.costs.total > 0)) {
                const profitColor = pd.status === 'profitable' ? colors.success : pd.status === 'tight' ? colors.warning : colors.destructive;
                summaryItems.push({ label: 'Profit', value: `${pd.profit.margin.toFixed(0)}%`, color: profitColor });
              }
              if (materials.length > 0) {
                summaryItems.push({ label: 'Materials', value: `${materials.length}`, color: colors.foreground });
              }
              if (jobExpenses.length > 0) {
                summaryItems.push({ label: 'Expenses', value: `${jobExpenses.length}`, color: colors.foreground });
              }
              if (summaryItems.length === 0) {
                summaryItems.push({ label: 'Revenue', value: '$0', color: colors.mutedForeground });
                summaryItems.push({ label: 'Costs', value: '$0', color: colors.mutedForeground });
              }
              return summaryItems.slice(0, 4).map((item, i) => (
                <TouchableOpacity
                  key={item.label}
                  onPress={() => setActiveTab('manage')}
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    backgroundColor: colors.muted,
                    borderRadius: radius.lg,
                    padding: spacing.sm,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: typography.subtitle.fontSize, fontWeight: fontWeights.bold, color: item.color }}>{item.value}</Text>
                  <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 }}>{item.label}</Text>
                </TouchableOpacity>
              ));
            })()}
          </View>
        </View>
      )}

      </CollapsibleSection>
      )}

    </>
  );

  const renderManageTab = () => (
    <>
      {/* Client Tools Section Header */}
      {(isOwnerOrManager || isSoloOwner) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.sm }}>
          <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.bold, color: colors.mutedForeground, letterSpacing: 0.5, textTransform: 'uppercase' }}>Client Tools</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        </View>
      )}

      {/* Proof Pack Section - Available for all job statuses */}
      {(isOwnerOrManager || isSoloOwner) && (
        <View style={styles.costingCard}>
          <View style={styles.costingHeader}>
            <View style={[styles.costingIconContainer, { backgroundColor: `${colors.primary}15` }]}>
              <Feather name="file-text" size={iconSizes.lg} color={colors.primary} />
            </View>
            <Text style={styles.costingTitle}>Proof Pack</Text>
            {(job.status === 'done' || job.status === 'invoiced') && (
              <View style={{ backgroundColor: `${colors.success}20`, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm }}>
                <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.semibold, color: colors.success }}>Ready</Text>
              </View>
            )}
          </View>
          <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground, marginBottom: spacing.md, lineHeight: 19 }}>
            Generate a comprehensive PDF with job timeline, photos, signatures, and compliance records to share with your client.
          </Text>

          {/* Content Preview */}
          <View style={{ backgroundColor: colors.muted, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, gap: spacing.xs }}>
            <Text style={{ fontSize: typography.captionSmall.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground, marginBottom: 4 }}>Pack Contents</Text>
            {[
              { icon: 'clock' as const, label: 'Job Timeline', available: true },
              { icon: 'camera' as const, label: 'Site Photos', available: (job as any).photos?.length > 0 || (job as any).photoCount > 0 },
              { icon: 'edit-3' as const, label: 'Signatures', available: (job as any).signatureUrl || (job as any).clientSignatureUrl },
              { icon: 'map-pin' as const, label: 'GPS Records', available: true },
              { icon: 'shield' as const, label: 'Compliance & SWMS', available: true },
              { icon: 'file-text' as const, label: 'Invoice', available: job.status === 'invoiced' },
            ].map((item, idx) => (
              <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 3 }}>
                <Feather name={item.icon} size={14} color={item.available ? colors.primary : colors.mutedForeground} />
                <Text style={{ fontSize: typography.sizes.sm, color: item.available ? colors.foreground : colors.mutedForeground, flex: 1 }}>{item.label}</Text>
                <Feather 
                  name={item.available ? "check-circle" : "minus-circle"} 
                  size={14} 
                  color={item.available ? colors.success : colors.mutedForeground} 
                />
              </View>
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TouchableOpacity
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.sm,
                backgroundColor: `${colors.primary}12`,
                paddingVertical: spacing.md,
                borderRadius: radius.lg,
                minHeight: 44,
                borderWidth: 1,
                borderColor: `${colors.primary}25`,
              }}
              onPress={handleLoadProofPackPreview}
              activeOpacity={0.8}
              disabled={isLoadingProofPackPreview}
            >
              {isLoadingProofPackPreview ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Feather name="eye" size={16} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontWeight: fontWeights.semibold, fontSize: typography.button.fontSize }}>Preview</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.sm,
                backgroundColor: `${colors.primary}12`,
                paddingVertical: spacing.md,
                borderRadius: radius.lg,
                minHeight: 44,
                borderWidth: 1,
                borderColor: `${colors.primary}25`,
              }}
              onPress={() => setShowProofPackModal(true)}
              activeOpacity={0.8}
            >
              <Feather name="sliders" size={16} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: fontWeights.semibold, fontSize: typography.button.fontSize }}>Customise</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Client Portal Section */}
      {(isOwnerOrManager || isSoloOwner) && client && (
        <View style={styles.costingCard}>
          <View style={styles.costingHeader}>
            <View style={[styles.costingIconContainer, { backgroundColor: `${colors.invoiced}15` }]}>
              <Feather name="globe" size={iconSizes.lg} color={colors.invoiced} />
            </View>
            <Text style={styles.costingTitle}>Client Portal</Text>
            {portalEnabled && (
              <View style={{ backgroundColor: `${colors.success}20`, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm }}>
                <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.semibold, color: colors.success }}>Active</Text>
              </View>
            )}
          </View>
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, marginBottom: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: typography.button.fontSize, color: colors.foreground, fontWeight: fontWeights.medium }}>Enable Portal</Text>
              <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, marginTop: 2 }}>
                Let your client view job progress online
              </Text>
            </View>
            {isTogglingPortal ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Switch
                value={portalEnabled}
                onValueChange={handleTogglePortal}
                trackColor={{ false: colors.muted, true: colors.primary }}
                thumbColor={portalEnabled ? colors.primaryForeground : colors.foreground}
              />
            )}
          </View>

          {portalEnabled && portalLinks.length > 0 && (
            <View style={{ gap: spacing.sm }}>
              <TouchableOpacity
                onPress={async () => {
                  let url = portalLinks[0]?.url;
                  if (!url) {
                    showToast({ type: 'error', message: 'No portal link available' });
                    return;
                  }
                  // Ensure URL has a protocol — Linking.openURL silently no-ops on bare hostnames.
                  if (!/^https?:\/\//i.test(url)) {
                    url = 'https://' + url;
                  }
                  try {
                    const supported = await Linking.canOpenURL(url);
                    if (!supported) {
                      showToast({ type: 'error', message: "Can't open this link", description: url });
                      return;
                    }
                    await Linking.openURL(url);
                  } catch (e: any) {
                    showToast({ type: 'error', message: 'Failed to open portal', description: e?.message || String(e) });
                  }
                }}
                activeOpacity={0.7}
                style={{ 
                  backgroundColor: colors.muted, 
                  borderRadius: radius.lg, 
                  padding: spacing.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                }}
              >
                <Feather name="external-link" size={14} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.primary }}>
                    View Portal
                  </Text>
                  <Text
                    style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground, marginTop: 1 }}
                    numberOfLines={1}
                    ellipsizeMode="middle"
                  >
                    {portalLinks[0].url || 'Portal link active'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    const url = portalLinks[0].url;
                    if (url) {
                      Clipboard.setStringAsync(url).then(() => {
                        showToast({ type: 'success', message: 'Portal link copied to clipboard' });
                      }).catch(() => {
                        showToast({ type: 'info', message: 'Link', description: url });
                      });
                    }
                  }}
                  style={{ padding: spacing.xs }}
                  activeOpacity={0.7}
                >
                  <Feather name="copy" size={14} color={colors.mutedForeground} />
                </TouchableOpacity>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: spacing.xs,
                    paddingVertical: spacing.sm + 2,
                    borderRadius: radius.lg,
                    backgroundColor: `${colors.success}12`,
                    opacity: !client?.phone ? 0.5 : 1,
                  }}
                  onPress={handleSendPortalSMS}
                  activeOpacity={0.7}
                  disabled={!client?.phone}
                >
                  <Feather name="message-square" size={16} color={colors.success} />
                  <Text style={{ color: colors.success, fontWeight: fontWeights.semibold, fontSize: typography.sizes.sm }}>SMS Link</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: spacing.xs,
                    paddingVertical: spacing.sm + 2,
                    borderRadius: radius.lg,
                    backgroundColor: `${colors.invoiced}12`,
                    opacity: !client?.email ? 0.5 : 1,
                  }}
                  onPress={handleSendPortalEmail}
                  activeOpacity={0.7}
                  disabled={!client?.email}
                >
                  <Feather name="mail" size={16} color={colors.invoiced} />
                  <Text style={{ color: colors.invoiced, fontWeight: fontWeights.semibold, fontSize: typography.sizes.sm }}>Email Link</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {portalEnabled && portalLinks.length === 0 && !isTogglingPortal && (
            <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, marginTop: spacing.xs }}>
                Setting up portal...
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Financials Section Header */}
      {(isOwnerOrManager || isSoloOwner) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, marginTop: spacing.sm, gap: spacing.sm }}>
          <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.bold, color: colors.mutedForeground, letterSpacing: 0.5, textTransform: 'uppercase' }}>Financials</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        </View>
      )}

      {/* Job Profitability Card */}
      {(() => {
        const pd = profitabilityData;
        const hasFinancialData = pd && (pd.revenue.invoiced > 0 || pd.revenue.pending > 0 || pd.costs.total > 0);
        
        if (isLoadingProfitability) {
          return (
            <View style={styles.costingCard}>
              <View style={styles.costingHeader}>
                <View style={[styles.costingIconContainer, { backgroundColor: `${colors.success}15` }]}>
                  <Feather name="dollar-sign" size={iconSizes.lg} color={colors.success} />
                </View>
                <Text style={styles.costingTitle}>Profitability</Text>
              </View>
              <ActivityIndicator size="small" color={colors.primary} style={{ paddingVertical: spacing.md }} />
            </View>
          );
        }

        if (!hasFinancialData) {
          return (
            <View style={styles.costingCard}>
              <View style={styles.costingHeader}>
                <View style={[styles.costingIconContainer, { backgroundColor: `${colors.success}15` }]}>
                  <Feather name="trending-up" size={iconSizes.lg} color={colors.success} />
                </View>
                <Text style={styles.costingTitle}>Profitability</Text>
              </View>
              <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
                <Text style={{ ...typography.body, color: colors.mutedForeground, textAlign: 'center' }}>
                  No financial data yet
                </Text>
                <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: spacing.xs, textAlign: 'center' }}>
                  Create invoices and track expenses to see profitability
                </Text>
              </View>
            </View>
          );
        }

        const profitColor = pd.status === 'profitable' ? colors.success : pd.status === 'tight' ? colors.warning : colors.destructive;
        const marginCapped = Math.min(Math.max(pd.profit.margin, 0), 100);

        return (
          <View style={styles.costingCard}>
            <View style={styles.costingHeader}>
              <View style={[styles.costingIconContainer, { backgroundColor: `${profitColor}15` }]}>
                <Feather name="dollar-sign" size={iconSizes.lg} color={profitColor} />
              </View>
              <Text style={styles.costingTitle}>Profitability</Text>
              <View style={{ marginLeft: 'auto', backgroundColor: `${profitColor}15`, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.md }}>
                <Text style={{ fontSize: typography.captionSmall.fontSize, fontWeight: fontWeights.bold, color: profitColor, textTransform: 'capitalize' }}>
                  {pd.status}
                </Text>
              </View>
            </View>

            {pd.quoted?.amount ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ fontSize: typography.button.fontSize, color: colors.mutedForeground }}>Quoted</Text>
                <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground }}>{formatCurrency(pd.quoted.amount)}</Text>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: typography.button.fontSize, color: colors.mutedForeground }}>Revenue</Text>
              <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground }}>{formatCurrency(pd.revenue.invoiced)}</Text>
            </View>

            <View style={{ paddingTop: spacing.sm }}>
              <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.bold, color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: spacing.sm }}>Costs</Text>
              <View style={{ gap: spacing.xs }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: typography.button.fontSize, color: colors.mutedForeground }}>
                    Labour{pd.hours.total > 0 ? ` (${Number(pd.hours.total).toFixed(1)}hrs)` : ''}
                  </Text>
                  <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.medium, color: colors.foreground }}>{formatCurrency(pd.costs.labour)}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: typography.button.fontSize, color: colors.mutedForeground }}>Materials</Text>
                  <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.medium, color: colors.foreground }}>{formatCurrency(pd.costs.materials)}</Text>
                </View>
                {(pd.costs.expenses ?? 0) > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: typography.button.fontSize, color: colors.mutedForeground }}>Expenses</Text>
                    <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.medium, color: colors.foreground }}>{formatCurrency(pd.costs.expenses ?? 0)}</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={{ 
              flexDirection: 'row', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              paddingTop: spacing.md,
              marginTop: spacing.md,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}>
              <Text style={{ fontSize: typography.subtitle.fontSize, fontWeight: fontWeights.bold, color: colors.foreground }}>Profit</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: typography.sizes.lg, fontWeight: fontWeights.bold, color: profitColor }}>
                  {formatCurrency(pd.profit.amount)}
                </Text>
                <Text style={{ fontSize: typography.captionSmall.fontSize, fontWeight: fontWeights.semibold, color: profitColor }}>
                  {pd.profit.margin.toFixed(1)}% margin
                </Text>
              </View>
            </View>

            <View style={{ 
              marginTop: spacing.md, 
              height: 6, 
              backgroundColor: colors.muted, 
              borderRadius: 3, 
              overflow: 'hidden' 
            }}>
              <View style={{ 
                width: `${marginCapped}%`, 
                height: '100%', 
                backgroundColor: profitColor, 
                borderRadius: 3 
              }} />
            </View>
          </View>
        );
      })()}

      {/* Job Costing Section - hidden for subcontractors */}
      {!isSubcontractorUser && (estimatedHours > 0 || estimatedCost > 0 || actualHours > 0) && (
        <View style={styles.costingCard}>
          <View style={styles.costingHeader}>
            <View style={[styles.costingIconContainer, { backgroundColor: `${colors.warning}15` }]}>
              <Feather name="dollar-sign" size={iconSizes.lg} color={colors.warning} />
            </View>
            <Text style={styles.costingTitle}>Job Costing</Text>
          </View>
          <View style={styles.costingGrid}>
            {estimatedHours > 0 && (
              <View style={styles.costingItem}>
                <Text style={styles.costingLabel}>Estimated Hours</Text>
                <Text style={styles.costingValue}>{estimatedHours.toFixed(1)}h</Text>
              </View>
            )}
            {actualHours > 0 && (
              <View style={styles.costingItem}>
                <Text style={styles.costingLabel}>Actual Hours</Text>
                <Text style={[
                  styles.costingValue,
                  hoursVariance > 0 && { color: colors.destructive },
                  hoursVariance < 0 && { color: colors.success }
                ]}>{formatTrackedHours(actualHours)}</Text>
              </View>
            )}
            {estimatedCost > 0 && (
              <View style={styles.costingItem}>
                <Text style={styles.costingLabel}>Estimated Cost</Text>
                <Text style={styles.costingValue}>{formatCurrency(estimatedCost)}</Text>
              </View>
            )}
            {estimatedHours > 0 && actualHours > 0 && (
              <View style={styles.costingItem}>
                <Text style={styles.costingLabel}>Hours Variance</Text>
                <Text style={[
                  styles.costingValue,
                  hoursVariance > 0 && { color: colors.destructive },
                  hoursVariance < 0 && { color: colors.success }
                ]}>
                  {hoursVariance > 0 ? '+' : ''}{hoursVariance.toFixed(1)}h
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Job Expenses Section - hidden for subcontractors */}
      {!isSubcontractorUser && <View style={styles.costingCard}>
        <View style={styles.costingHeader}>
          <View style={[styles.costingIconContainer, { backgroundColor: `${colors.destructive}15` }]}>
            <Feather name="credit-card" size={iconSizes.lg} color={colors.destructive} />
          </View>
          <Text style={styles.costingTitle}>Job Expenses</Text>
          <TouchableOpacity 
            style={{ marginLeft: 'auto', padding: spacing.xs }}
            onPress={() => router.push(`/more/expenses?jobId=${job.id}`)}
            activeOpacity={0.6}
          >
            <Feather name="plus" size={iconSizes.lg} color={colors.primary} />
          </TouchableOpacity>
        </View>
        
        {jobExpenses.length > 0 ? (
          <>
            <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
              {jobExpenses.slice(0, 3).map((expense) => (
                <TouchableOpacity 
                  key={expense.id} 
                  onPress={() => router.push(`/more/expenses?jobId=${job.id}`)}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: spacing.sm,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: typography.button.fontSize, color: colors.foreground, fontWeight: fontWeights.medium }}>
                      {expense.description}
                    </Text>
                    <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground }}>
                      {expense.categoryName || 'Expense'} • {new Date(expense.expenseDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground }}>
                      {formatCurrency(parseFloat(expense.amount) || 0)}
                    </Text>
                    <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            {jobExpenses.length > 3 && (
              <TouchableOpacity onPress={() => router.push(`/more/expenses?jobId=${job.id}`)}>
                <Text style={{ fontSize: typography.sizes.sm, color: colors.primary, fontWeight: fontWeights.medium }}>
                  +{jobExpenses.length - 3} more expenses
                </Text>
              </TouchableOpacity>
            )}
            <View style={{ 
              flexDirection: 'row', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              paddingTop: spacing.md,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              marginTop: spacing.sm,
            }}>
              <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground }}>
                Total Expenses
              </Text>
              <Text style={{ fontSize: typography.subtitle.fontSize, fontWeight: fontWeights.bold, color: colors.destructive }}>
                {formatCurrency(jobExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0))}
              </Text>
            </View>
          </>
        ) : (
          <TouchableOpacity 
            style={{ alignItems: 'center', paddingVertical: spacing.lg }}
            onPress={() => router.push(`/more/expenses?jobId=${job.id}`)}
            activeOpacity={0.7}
          >
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: `${colors.primary}10`, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm }}>
              <Feather name="credit-card" size={24} color={colors.primary} />
            </View>
            <Text style={{ ...typography.body, color: colors.foreground, textAlign: 'center', marginBottom: spacing.xs, fontWeight: fontWeights.medium }}>
              Add Expense
            </Text>
            <Text style={{ ...typography.caption, color: colors.mutedForeground, textAlign: 'center', paddingHorizontal: spacing.md }}>
              Track costs, receipts, and billable expenses for this job
            </Text>
          </TouchableOpacity>
        )}
      </View>}

      {/* Team & Operations Section Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, marginTop: spacing.sm, gap: spacing.sm }}>
        <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.bold, color: colors.mutedForeground, letterSpacing: 0.5, textTransform: 'uppercase' }}>Team & Operations</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      </View>

      {/* Recurring Schedule Section */}
      {job.isRecurring && (
        <View style={styles.costingCard}>
          <View style={styles.costingHeader}>
            <View style={[styles.costingIconContainer, { backgroundColor: `${colors.primary}15` }]}>
              <Feather name="repeat" size={iconSizes.lg} color={colors.primary} />
            </View>
            <Text style={styles.costingTitle}>Recurring Schedule</Text>
          </View>
          
          <View style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: typography.button.fontSize, color: colors.mutedForeground }}>Frequency</Text>
              <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground }}>
                {job.recurrencePattern === 'weekly' && 'Weekly'}
                {job.recurrencePattern === 'fortnightly' && 'Fortnightly'}
                {job.recurrencePattern === 'monthly' && 'Monthly'}
                {job.recurrencePattern === 'quarterly' && 'Quarterly'}
                {job.recurrencePattern === 'yearly' && 'Yearly'}
              </Text>
            </View>
            
            {job.nextRecurrenceDate && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: typography.button.fontSize, color: colors.mutedForeground }}>Next Job</Text>
                <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.primary }}>
                  {new Date(job.nextRecurrenceDate).toLocaleDateString('en-AU', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </Text>
              </View>
            )}
            
            {job.recurrenceEndDate && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: typography.button.fontSize, color: colors.mutedForeground }}>Ends</Text>
                <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.medium, color: colors.foreground }}>
                  {new Date(job.recurrenceEndDate).toLocaleDateString('en-AU', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </Text>
              </View>
            )}
            
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.xs,
                backgroundColor: `${colors.destructive}12`,
                borderWidth: 1,
                borderColor: `${colors.destructive}30`,
                paddingVertical: spacing.md,
                borderRadius: radius.lg,
                marginTop: spacing.sm,
              }}
              onPress={handleStopRecurring}
              activeOpacity={0.8}
            >
              <Feather name="x-circle" size={18} color={colors.destructive} />
              <Text style={{ color: colors.destructive, fontWeight: fontWeights.semibold, fontSize: typography.button.fontSize }}>
                Stop Recurring
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Job Variations Section */}
      {(isOwnerOrManager || isSoloOwner) && (
        <View style={styles.costingCard}>
          <View style={styles.costingHeader}>
            <View style={[styles.costingIconContainer, { backgroundColor: `${colors.warning}15` }]}>
              <Feather name="git-branch" size={iconSizes.lg} color={colors.warning} />
            </View>
            <Text style={styles.costingTitle}>Variations</Text>
          </View>

          {isLoadingVariations ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ paddingVertical: spacing.md }} />
          ) : (
            <>
              {variations.length > 0 ? (
                <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
                  {variations.map((v) => (
                    <View
                      key={v.id}
                      style={{
                        backgroundColor: colors.muted,
                        borderRadius: radius.lg,
                        padding: spacing.md,
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground }}>{v.title}</Text>
                          {v.description && (
                            <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, marginTop: 2 }}>{v.description}</Text>
                          )}
                        </View>
                        <View style={{
                          backgroundColor: v.status === 'approved' ? `${colors.success}15` : v.status === 'rejected' ? `${colors.destructive}15` : `${colors.warning}15`,
                          paddingHorizontal: spacing.sm,
                          paddingVertical: 2,
                          borderRadius: radius.md,
                          marginLeft: spacing.sm,
                        }}>
                          <Text style={{
                            fontSize: typography.sizes.xs,
                            fontWeight: fontWeights.bold,
                            color: v.status === 'approved' ? colors.success : v.status === 'rejected' ? colors.destructive : colors.warning,
                            textTransform: 'capitalize',
                          }}>
                            {v.status}
                          </Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm }}>
                        <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground }}>
                          {formatCurrency(parseFloat(String(v.amount ?? '0')) || 0)}
                        </Text>
                        {v.status === 'pending' && (
                          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                            <TouchableOpacity
                              onPress={() => {
                                setApproveVariationName('');
                                setApproveVariationSignature(null);
                                setShowApproveVariationModal(v.id);
                              }}
                              style={{ paddingVertical: 4, paddingHorizontal: spacing.md, backgroundColor: `${colors.success}15`, borderRadius: radius.md }}
                              activeOpacity={0.7}
                            >
                              <Text style={{ fontSize: typography.captionSmall.fontSize, fontWeight: fontWeights.semibold, color: colors.success }}>Approve</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => {
                                setRejectVariationReason('');
                                setShowRejectVariationModal(v.id);
                              }}
                              style={{ paddingVertical: 4, paddingHorizontal: spacing.md, backgroundColor: `${colors.destructive}15`, borderRadius: radius.md }}
                              activeOpacity={0.7}
                            >
                              <Text style={{ fontSize: typography.captionSmall.fontSize, fontWeight: fontWeights.semibold, color: colors.destructive }}>Reject</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: `${colors.warning}10`, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm }}>
                    <Feather name="git-branch" size={24} color={colors.mutedForeground} />
                  </View>
                  <Text style={{ ...typography.body, color: colors.mutedForeground, textAlign: 'center' }}>
                    No variations yet
                  </Text>
                  <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: spacing.xs, textAlign: 'center' }}>
                    Track scope changes and price adjustments
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.xs,
                  backgroundColor: colors.muted,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingVertical: spacing.md,
                  borderRadius: radius.lg,
                }}
                onPress={() => {
                  setVariationForm({ title: '', description: '', reason: '', amount: '' });
                  setShowAddVariationModal(true);
                }}
                activeOpacity={0.8}
              >
                <Feather name="plus" size={16} color={colors.foreground} />
                <Text style={{ color: colors.foreground, fontWeight: fontWeights.semibold, fontSize: typography.button.fontSize }}>
                  Add Variation
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* Subcontractor Invites Section */}
      {(isOwnerOrManager || isSoloOwner) && (
        <View style={styles.costingCard}>
          <View style={styles.costingHeader}>
            <View style={[styles.costingIconContainer, { backgroundColor: `${colors.invoiced}15` }]}>
              <Feather name="user-plus" size={iconSizes.lg} color={colors.invoiced} />
            </View>
            <Text style={styles.costingTitle}>Subcontractors</Text>
            {subcontractorTokens.filter(t => t.status === 'pending' || t.status === 'active').length > 0 && (
              <View style={{ backgroundColor: `${colors.invoiced}15`, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.md, marginLeft: 'auto' }}>
                <Text style={{ fontSize: typography.captionSmall.fontSize, fontWeight: fontWeights.semibold, color: colors.invoiced }}>
                  {subcontractorTokens.filter(t => t.status === 'pending' || t.status === 'active').length}
                </Text>
              </View>
            )}
          </View>

          {isLoadingSubcontractors ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ paddingVertical: spacing.md }} />
          ) : (
            <>
              {subcontractorTokens.filter(t => t.status !== 'revoked').length > 0 ? (
                <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
                  {subcontractorTokens.filter(t => t.status !== 'revoked').map((token) => {
                    const statusLabel = token.currentStatus === 'done' ? 'Completed' :
                      token.currentStatus === 'working' ? 'In Progress' :
                      token.currentStatus === 'arrived' ? 'Arrived' :
                      token.currentStatus === 'en_route' ? 'En Route' :
                      token.currentStatus === 'accepted' ? 'Accepted' :
                      token.status === 'active' ? 'Active' :
                      token.status === 'pending' ? 'Pending' : token.status;
                    const statusColor = token.currentStatus === 'done' ? colors.success :
                      token.currentStatus === 'working' ? colors.primary :
                      token.currentStatus === 'en_route' || token.currentStatus === 'arrived' ? colors.warning :
                      token.currentStatus === 'accepted' ? colors.invoiced :
                      token.status === 'active' ? colors.success : colors.warning;
                    const statusIcon = token.currentStatus === 'done' ? 'check-circle' as const :
                      token.currentStatus === 'working' ? 'play' as const :
                      token.currentStatus === 'en_route' ? 'navigation' as const :
                      token.currentStatus === 'arrived' ? 'map-pin' as const :
                      token.currentStatus === 'accepted' ? 'thumbs-up' as const :
                      token.status === 'active' ? 'check-circle' as const : 'clock' as const;

                    return (
                      <View
                        key={token.id}
                        style={{
                          backgroundColor: colors.muted,
                          borderRadius: radius.lg,
                          padding: spacing.md,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                          <View style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            backgroundColor: `${statusColor}20`,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <Feather name={statusIcon} size={16} color={statusColor} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground }}>
                              {token.contactName || 'Subcontractor'}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' }}>
                              <Text style={{ fontSize: typography.captionSmall.fontSize, color: statusColor, fontWeight: fontWeights.medium }}>{statusLabel}</Text>
                              <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground }}>{token.contactPhone || token.contactEmail || ''}</Text>
                            </View>
                          </View>
                          <TouchableOpacity
                            onPress={() => handleRevokeSubcontractor(token.id, token.contactName)}
                            style={{ padding: spacing.sm }}
                            activeOpacity={0.7}
                          >
                            <Feather name="x" size={16} color={colors.destructive} />
                          </TouchableOpacity>
                        </View>

                        {(((token.noteCount ?? 0) > 0) || ((token.photoCount ?? 0) > 0)) && (
                          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm, paddingLeft: 48 }}>
                            {token.noteCount && token.noteCount > 0 ? (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Feather name="edit-3" size={12} color={colors.mutedForeground} />
                                <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground }}>{token.noteCount} note{token.noteCount > 1 ? 's' : ''}</Text>
                              </View>
                            ) : null}
                            {token.photoCount && token.photoCount > 0 ? (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Feather name="camera" size={12} color={colors.mutedForeground} />
                                <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground }}>{token.photoCount} photo{token.photoCount > 1 ? 's' : ''}</Text>
                              </View>
                            ) : null}
                          </View>
                        )}

                        {token.notes && token.notes.length > 0 && (
                          <View style={{ marginTop: spacing.sm, paddingLeft: 48, gap: spacing.xs }}>
                            {token.notes.slice(0, 3).map((note, idx) => (
                              <View key={idx} style={{ backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.sm }}>
                                <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.foreground }} numberOfLines={2}>{note.content}</Text>
                                {note.createdAt && (
                                  <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground, marginTop: 2 }}>
                                    {new Date(note.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                                  </Text>
                                )}
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: `${colors.invoiced}10`, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm }}>
                    <Feather name="users" size={24} color={colors.mutedForeground} />
                  </View>
                  <Text style={{ ...typography.body, color: colors.mutedForeground, textAlign: 'center' }}>
                    No subcontractors invited yet
                  </Text>
                  <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: spacing.xs, textAlign: 'center', paddingHorizontal: spacing.md }}>
                    Share job access with external contractors
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.xs,
                  backgroundColor: colors.invoiced,
                  paddingVertical: spacing.md,
                  borderRadius: radius.lg,
                }}
                onPress={() => setShowSubcontractorModal(true)}
                activeOpacity={0.8}
              >
                <Feather name="user-plus" size={16} color={colors.primaryForeground} />
                <Text style={{ color: colors.primaryForeground, fontWeight: fontWeights.semibold, fontSize: typography.button.fontSize }}>
                  Invite Subcontractor
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* Activity & History Section Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, marginTop: spacing.sm, gap: spacing.sm }}>
        <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.bold, color: colors.mutedForeground, letterSpacing: 0.5, textTransform: 'uppercase' }}>Activity & History</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      </View>

      {/* Full Activity Log */}
      <View style={styles.costingCard}>
        <View style={styles.costingHeader}>
          <View style={[styles.costingIconContainer, { backgroundColor: `${colors.inProgress}15` }]}>
            <Feather name="activity" size={iconSizes.lg} color={colors.inProgress} />
          </View>
          <Text style={styles.costingTitle}>Activity Log</Text>
          {activityLog.length > 0 && (
            <View style={{ backgroundColor: colors.muted, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm }}>
              <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.semibold, color: colors.mutedForeground }}>{activityLog.length}</Text>
            </View>
          )}
        </View>
        {activityLog.length > 0 ? (
          <View style={{ gap: 0 }}>
            {activityLog.slice(0, 10).map((item, index) => {
              const iconMap: Record<string, string> = {
                job_created: 'plus-circle',
                job_scheduled: 'calendar',
                job_started: 'play-circle',
                job_completed: 'check-circle',
                status_change: 'arrow-right-circle',
                invoice_sent: 'send',
                invoice_paid: 'dollar-sign',
                quote_sent: 'mail',
                quote_accepted: 'thumbs-up',
                photo_added: 'camera',
                note_added: 'edit-3',
                sms_sent: 'message-square',
                email_sent: 'mail',
                timer_started: 'clock',
                timer_stopped: 'square',
              };
              const iconName = iconMap[item.type] || 'circle';
              const actColor = item.type?.includes('completed') || item.type?.includes('paid') || item.type?.includes('accepted')
                ? colors.success
                : item.type?.includes('started') || item.type?.includes('progress')
                ? colors.inProgress
                : colors.mutedForeground;
              return (
                <View key={item.id || index} style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  paddingVertical: spacing.sm + 2,
                  borderTopWidth: index > 0 ? 1 : 0,
                  borderTopColor: colors.border,
                  gap: spacing.sm,
                }}>
                  <View style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: `${actColor}12`,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 1,
                  }}>
                    <Feather name={iconName as any} size={13} color={actColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: typography.sizes.sm, color: colors.foreground, fontWeight: fontWeights.medium }} numberOfLines={2}>
                      {item.title || item.description}
                    </Text>
                    {item.description && item.title && (
                      <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, marginTop: 1 }} numberOfLines={1}>
                        {item.description}
                      </Text>
                    )}
                    <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground, marginTop: 3 }}>
                      {new Date(item.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              );
            })}
            {activityLog.length > 10 && (
              <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground, textAlign: 'center', paddingVertical: spacing.sm }}>
                +{activityLog.length - 10} more activities
              </Text>
            )}
          </View>
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
            <Text style={{ ...typography.body, color: colors.mutedForeground, textAlign: 'center' }}>
              No activity recorded yet
            </Text>
            <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: spacing.xs, textAlign: 'center' }}>
              Actions taken on this job will appear here
            </Text>
          </View>
        )}
      </View>

      {/* Status Rollback Button */}
      {(isOwnerOrManager || isSoloOwner) && job.status !== 'pending' && (
        <View style={styles.costingCard}>
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              backgroundColor: colors.card,
              paddingVertical: spacing.md,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.warning + '50',
            }}
            onPress={handleStatusRollback}
            activeOpacity={0.8}
          >
            <Feather name="rotate-ccw" size={18} color={colors.warning} />
            <Text style={{ color: colors.warning, fontWeight: fontWeights.semibold, fontSize: typography.button.fontSize }}>
              Rollback Status
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  const renderMaterialsTab = () => (
    <MaterialsSection
      colors={colors}
      styles={styles}
      materials={materials}
      isLoadingMaterials={isLoadingMaterials}
      invoice={invoice}
      setEditingMaterial={setEditingMaterial}
      setMaterialForm={setMaterialForm}
      setShowAddMaterialModal={setShowAddMaterialModal}
      handleMaterialStatusChange={handleMaterialStatusChange}
      handleDeleteMaterial={handleDeleteMaterial}
    />
  );

  const renderSafetyTab = () => (
      <SwmsSection
        colors={colors}
        styles={styles}
        swmsDocuments={swmsDocuments}
        isLoadingSwms={isLoadingSwms}
        expandedSwmsId={expandedSwmsId}
        toggleSwmsExpand={toggleSwmsExpand}
        handleStartCreateSwms={handleStartCreateSwms}
        handleDownloadSwmsPdf={handleDownloadSwmsPdf}
        getStatusColor={getStatusColor}
        getRiskColor={getRiskColor}
        setSigningSwmsId={setSigningSwmsId}
        setSignWorkerName={setSignWorkerName}
        setShowSignSwmsModal={setShowSignSwmsModal}
      />
    );
  
  const renderChatTab = () => (
      <ChatSection
        colors={colors}
        client={client}
        currentUserId={user?.id}
        jobMessages={jobMessages}
        isLoadingMessages={isLoadingMessages}
        newMessage={newMessage}
        setNewMessage={setNewMessage}
        isSendingMessage={isSendingMessage}
        handleSendJobMessage={handleSendJobMessage}
        handleCall={handleCall}
        handleSMS={handleSMS}
        handleEmail={handleEmail}
        setSendModalDefaultTab={setSendModalDefaultTab}
        setShowSendModal={setShowSendModal}
      />
    );
  
  const renderDocumentsTab = () => (
    <>
      {/* Linked Documents Card - hidden for subcontractors */}
      {!isSubcontractorUser && (
      <LinkedDocumentsCard
        linkedQuote={quote ? {
          id: quote.id,
          status: quote.status,
          total: quote.total,
          quoteNumber: quote.number,
        } : null}
        linkedInvoice={invoice ? {
          id: invoice.id,
          status: invoice.status,
          total: invoice.total,
          invoiceNumber: invoice.number,
        } : null}
        linkedReceipt={linkedReceipt}
        jobStatus={job.status}
        onViewQuote={handleViewQuote}
        onViewInvoice={handleViewInvoice}
        onViewReceipt={(receiptId) => router.push(`/more/receipt/${receiptId}`)}
        onCreateQuote={() => router.push(`/more/quote/new?jobId=${job.id}${client ? `&clientId=${client.id}` : ''}`)}
        onCreateInvoice={canCreateInvoices ? () => router.push(`/more/invoice/new?jobId=${job.id}${client ? `&clientId=${client.id}` : ''}`) : undefined}
      />
      )}

      {/* Follow-up Tasks - spawned by form task rules, plus manual (owner-managed) */}
      <JobTasksSection
        jobId={job.id}
        readOnly={job.status === 'invoiced' || !(roleInfo?.isOwner || isSoloOwner)}
        containerStyle={styles.photosCard}
      />

      {/* Job Checklist Section - available for all job statuses */}
      <View style={styles.photosCard}>
        <JobForms 
          jobId={job.id} 
          readOnly={job.status === 'invoiced'} 
          onSubmissionsChange={setFormSubmissions}
          onFormsChange={setAvailableForms}
        />
      </View>

      {/* SWMS / Safety Section */}
      <View style={styles.photosCard}>
        {renderSafetyTab()}
      </View>

      {/* Uploaded Documents Section - owners/managers only */}
      {(isOwnerOrManager || isSoloOwner) && (
        <View style={styles.photosCard}>
          <View style={styles.photosHeader}>
            <View style={[styles.photosIconContainer, { backgroundColor: `${colors.primary}15` }]}>
              <Feather name="folder" size={iconSizes.lg} color={colors.primary} />
            </View>
            <Text style={styles.photosHeaderLabel}>Uploaded Documents</Text>
            {uploadedDocuments.length > 0 && (
              <View style={styles.photosCountBadge}>
                <Text style={styles.photosCountText}>{uploadedDocuments.length}</Text>
              </View>
            )}
          </View>

          {isLoadingDocuments ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ paddingVertical: spacing.lg }} />
          ) : uploadedDocuments.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
              <Feather name="file-plus" size={32} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, fontSize: typography.button.fontSize, marginTop: spacing.sm }}>
                No documents uploaded yet
              </Text>
            </View>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {uploadedDocuments.map((doc) => (
                <TouchableOpacity
                  key={doc.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: spacing.md,
                    backgroundColor: colors.muted,
                    borderRadius: radius.lg,
                    gap: spacing.md,
                  }}
                  onPress={() => handleOpenDocument(doc)}
                  activeOpacity={0.7}
                >
                  <View style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.md,
                    backgroundColor: `${colors.primary}15`,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Feather name={getDocTypeIcon(doc.mimeType) as any} size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground }} numberOfLines={1}>
                      {doc.title}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 }}>
                      <View style={{
                        backgroundColor: `${colors.primary}20`,
                        paddingHorizontal: 6,
                        paddingVertical: 1,
                        borderRadius: radius.sm,
                      }}>
                        <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.bold, color: colors.primary }}>
                          {getDocTypeBadge(doc.mimeType)}
                        </Text>
                      </View>
                      {doc.fileSize ? (
                        <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground }}>
                          {formatFileSize(doc.fileSize)}
                        </Text>
                      ) : null}
                      {doc.createdAt ? (
                        <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground }}>
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteDocument(doc)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{ padding: spacing.xs }}
                  >
                    <Feather name="trash-2" size={16} color={colors.destructive} />
                  </TouchableOpacity>
                  <Feather name="external-link" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              marginTop: spacing.md,
              paddingVertical: spacing.md,
              backgroundColor: colors.muted,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.lg,
              minHeight: 44,
              opacity: isUploadingDocument ? 0.6 : 1,
            }}
            onPress={handleUploadDocument}
            disabled={isUploadingDocument}
            activeOpacity={0.7}
          >
            {isUploadingDocument ? (
              <ActivityIndicator size="small" color={colors.foreground} />
            ) : (
              <Feather name="upload" size={16} color={colors.foreground} />
            )}
            <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground }}>
              {isUploadingDocument ? 'Uploading...' : 'Upload Document'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      <SignatureSection
          jobStatus={job.status}
          colors={colors}
          styles={styles}
          showSignaturePad={showSignaturePad}
          setShowSignaturePad={setShowSignaturePad}
          signerName={signerName}
          setSignerName={setSignerName}
          signerRole={signerRole}
          setSignerRole={setSignerRole}
          saveToClient={saveToClient}
          setSaveToClient={setSaveToClient}
          client={client}
          clientSavedSignature={clientSavedSignature}
          signatures={signatures}
          handleSaveSignature={handleSaveSignature}
          deleteSignatureDirectly={deleteSignatureDirectly}
          handleDeleteSignature={handleDeleteSignature}
          confirm={confirm}
        />
  
    </>
  );

  const renderPhotosTab = () => (
      <PhotosSection
        colors={colors}
        styles={styles}
        jobId={id as string}
        job={job}
        setJob={setJob as any}
        photos={photos}
        isUploadingPhoto={isUploadingPhoto}
        setSelectedPhoto={setSelectedPhoto}
        setSelectedVideo={setSelectedVideo}
        setShowVideoPlayer={setShowVideoPlayer}
        setShowPhotosModal={setShowPhotosModal}
        handleTakePhoto={handleTakePhoto}
        handleRecordVideo={handleRecordVideo}
        handlePickMedia={handlePickMedia}
        handleChangePhotoCategory={handleChangePhotoCategory}
        voiceNotes={voiceNotes}
        setVoiceNotes={setVoiceNotes as any}
        showVoiceRecorder={showVoiceRecorder}
        setShowVoiceRecorder={setShowVoiceRecorder}
        isUploadingVoiceNote={isUploadingVoiceNote}
        handleUploadVoiceNote={handleUploadVoiceNote}
        handleDeleteVoiceNote={handleDeleteVoiceNote}
        onNotesChanged={() => loadJobNotes()}
      />
    );
  
  const renderNotesTab = () => (
    <>
      {/* Notes Section */}
      <TouchableOpacity 
        style={styles.notesCard}
        onPress={() => {
          setEditingNote(null);
          setEditedNotes('');
          setShowNotesModal(true);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.notesHeader}>
          <View style={styles.notesIconContainer}>
            <Feather name="file-text" size={iconSizes.lg} color={colors.primary} />
          </View>
          <Text style={styles.notesLabel}>Notes</Text>
          <Feather name="plus" size={iconSizes.sm} color={colors.mutedForeground} />
        </View>
        {(jobNotes.length > 0 || job.notes) ? (
          <View style={{ gap: spacing.sm }}>
            {jobNotes.map((note) => (
              <View key={note.id} style={{ paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={styles.notesText}>{note.content}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 4 }}>
                  <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground, flex: 1 }}>
                    {note.createdByName ? `${note.createdByName} · ` : ''}{new Date(note.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} {new Date(note.createdAt).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}
                  </Text>
                  <TouchableOpacity
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={(e: any) => {
                      e?.stopPropagation?.();
                      setEditingNote(note);
                      setEditedNotes(note.content);
                      setShowNotesModal(true);
                    }}
                  >
                    <Feather name="edit-2" size={15} color={colors.mutedForeground} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={(e: any) => {
                      e?.stopPropagation?.();
                      handleDeleteNote(note);
                    }}
                  >
                    <Feather name="trash-2" size={15} color={colors.destructive} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            {job.notes ? (
              <View>
                {jobNotes.length > 0 && (
                  <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.bold, color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 }}>Earlier notes</Text>
                )}
                <Text style={styles.notesText}>{job.notes}</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: `${colors.primary}10`, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }}>
              <Feather name="file-text" size={28} color={colors.mutedForeground} />
            </View>
            <Text style={{ ...typography.body, color: colors.mutedForeground, textAlign: 'center', marginBottom: spacing.xs }}>
              No notes yet
            </Text>
            <Text style={{ ...typography.caption, color: colors.mutedForeground, textAlign: 'center' }}>
              Tap to add job notes, instructions, or reminders
            </Text>
          </View>
        )}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, backgroundColor: `${colors.primary}10` }}
            disabled={isSummarizingNotes}
            onPress={async (e: any) => {
              e?.stopPropagation?.();
              setIsSummarizingNotes(true);
              try {
                const res = await api.post<{ summary: string }>(`/api/jobs/${job.id}/notes/summarize`);
                if (res.error) {
                  showToast({ type: 'error', message: 'Summary failed', description: res.error });
                } else if (res.data?.summary) {
                  setNotesSummary(res.data.summary);
                }
              } catch {
                showToast({ type: 'error', message: 'Failed to summarise notes' });
              } finally {
                setIsSummarizingNotes(false);
              }
            }}
          >
            {isSummarizingNotes ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Feather name="zap" size={14} color={colors.primary} />
            )}
            <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.medium, color: colors.primary }}>
              {isSummarizingNotes ? 'Summarising...' : 'Summarise'}
            </Text>
          </TouchableOpacity>
        </View>
        {notesSummary && (
          <View style={{ marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs }}>
              <Feather name="zap" size={14} color={colors.mutedForeground} />
              <Text style={{ fontSize: typography.captionSmall.fontSize, fontWeight: fontWeights.medium, color: colors.mutedForeground }}>AI Summary</Text>
            </View>
            <Text style={styles.notesText}>{notesSummary}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Geofence Settings Section */}
      <View style={styles.geofenceCard}>
        <View style={styles.geofenceHeader}>
          <View style={styles.geofenceHeaderLeft}>
            <View style={styles.geofenceIconContainer}>
              <Feather name="map-pin" size={iconSizes.lg} color={colors.primary} />
            </View>
            <Text style={styles.geofenceLabel}>Geofence Settings</Text>
          </View>
          {job.geofenceEnabled && (
            <View style={styles.geofenceBadge}>
              <Text style={styles.geofenceBadgeText}>Active</Text>
            </View>
          )}
        </View>
        
        {job.latitude && job.longitude ? (
          <>
            <View style={styles.geofenceSettingRow}>
              <View style={styles.geofenceSettingLeft}>
                <Feather name="circle" size={iconSizes.md} color={colors.mutedForeground} style={styles.geofenceSettingIcon} />
                <View>
                  <Text style={styles.geofenceSettingLabel}>Enable Geofence</Text>
                  <Text style={styles.geofenceSettingDescription}>Track arrival and departure from job site</Text>
                </View>
              </View>
              <Switch
                value={job.geofenceEnabled || false}
                onValueChange={async (value) => {
                  const { isOnline } = useOfflineStore.getState();
                  const previousValue = job.geofenceEnabled;
                  
                  // Optimistic UI update
                  setJob({ ...job, geofenceEnabled: value });
                  
                  // Register/unregister the native geofence on device
                  if (value && job.latitude && job.longitude) {
                    await locationTracking.addJobGeofence(
                      job.id,
                      Number(job.latitude),
                      Number(job.longitude),
                      job.geofenceRadius || 100
                    );
                  } else if (!value) {
                    await locationTracking.removeJobGeofence(job.id);
                  }
                  
                  if (!isOnline) {
                    await offlineStorage.updateJobOffline(job.id, { geofenceEnabled: value });
                    showToast({ type: 'info', message: 'Saved Offline', description: 'Settings will sync when online' });
                    return;
                  }
                  
                  try {
                    const resp = await api.patch(`/api/jobs/${job.id}/geofence`, { geofenceEnabled: value });
                    // api.patch doesn't throw on HTTP errors — surface them so
                    // the toggle doesn't silently look saved when it wasn't.
                    if (resp?.error) throw new Error(resp.error);
                  } catch (e: any) {
                    if (e.message?.includes('Network') || e.code === 'ECONNABORTED') {
                      await offlineStorage.updateJobOffline(job.id, { geofenceEnabled: value });
                      showToast({ type: 'info', message: 'Saved Offline', description: 'Settings will sync when connection is restored' });
                    } else {
                      // Rollback the native geofence too
                      if (value) {
                        await locationTracking.removeJobGeofence(job.id);
                      } else if (previousValue && job.latitude && job.longitude) {
                        await locationTracking.addJobGeofence(job.id, Number(job.latitude), Number(job.longitude), job.geofenceRadius || 100);
                      }
                      setJob({ ...job, geofenceEnabled: previousValue });
                      showToast({ type: 'error', message: 'Failed to update geofence settings' });
                    }
                  }
                }}
                trackColor={{ false: colors.muted, true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>
            
            {job.geofenceEnabled && (
              <>
                <View style={styles.geofenceRadiusRow}>
                  <Text style={styles.geofenceRadiusLabel}>Detection Radius</Text>
                  <Text style={styles.geofenceRadiusValue}>{sliderRadius}m</Text>
                  <Slider
                    style={styles.geofenceSlider}
                    minimumValue={50}
                    maximumValue={500}
                    step={10}
                    value={sliderRadius}
                    onValueChange={(value) => setSliderRadius(value)}
                    onSlidingComplete={async (value) => {
                      const { isOnline } = useOfflineStore.getState();
                      const previousValue = job.geofenceRadius;
                      
                      // Optimistic UI update
                      setJob({ ...job, geofenceRadius: value });
                      
                      // Update the native geofence with new radius
                      if (job.geofenceEnabled && job.latitude && job.longitude) {
                        await locationTracking.removeJobGeofence(job.id);
                        await locationTracking.addJobGeofence(job.id, Number(job.latitude), Number(job.longitude), value);
                      }
                      
                      if (!isOnline) {
                        await offlineStorage.updateJobOffline(job.id, { geofenceRadius: value });
                        showToast({ type: 'info', message: 'Saved Offline', description: 'Radius will sync when online' });
                        return;
                      }
                      
                      try {
                        await api.patch(`/api/jobs/${job.id}/geofence`, { geofenceRadius: value });
                      } catch (e: any) {
                        if (e.message?.includes('Network') || e.code === 'ECONNABORTED') {
                          await offlineStorage.updateJobOffline(job.id, { geofenceRadius: value });
                          showToast({ type: 'info', message: 'Saved Offline', description: 'Radius will sync when connection is restored' });
                        } else {
                          // Rollback native geofence
                          if (job.geofenceEnabled && job.latitude && job.longitude) {
                            await locationTracking.removeJobGeofence(job.id);
                            await locationTracking.addJobGeofence(job.id, Number(job.latitude), Number(job.longitude), previousValue || 100);
                          }
                          setJob({ ...job, geofenceRadius: previousValue });
                          setSliderRadius(previousValue || 100);
                          showToast({ type: 'error', message: 'Failed to update radius' });
                        }
                      }
                    }}
                    minimumTrackTintColor={colors.primary}
                    maximumTrackTintColor={colors.muted}
                    thumbTintColor={colors.primary}
                  />
                </View>
                
                <View style={styles.geofenceSettingRow}>
                  <View style={styles.geofenceSettingLeft}>
                    <Feather name="log-in" size={iconSizes.md} color={colors.success} style={styles.geofenceSettingIcon} />
                    <View>
                      <Text style={styles.geofenceSettingLabel}>Auto Clock-In</Text>
                      <Text style={styles.geofenceSettingDescription}>Start timer when arriving at job</Text>
                    </View>
                  </View>
                  <Switch
                    value={job.geofenceAutoClockIn || false}
                    onValueChange={async (value) => {
                      const { isOnline } = useOfflineStore.getState();
                      const previousValue = job.geofenceAutoClockIn;
                      
                      // Optimistic UI update
                      setJob({ ...job, geofenceAutoClockIn: value });
                      
                      if (!isOnline) {
                        await offlineStorage.updateJobOffline(job.id, { geofenceAutoClockIn: value });
                        showToast({ type: 'info', message: 'Saved Offline', description: 'Settings will sync when online' });
                        return;
                      }
                      
                      try {
                        await api.patch(`/api/jobs/${job.id}/geofence`, { geofenceAutoClockIn: value });
                      } catch (e: any) {
                        if (e.message?.includes('Network') || e.code === 'ECONNABORTED') {
                          await offlineStorage.updateJobOffline(job.id, { geofenceAutoClockIn: value });
                          showToast({ type: 'info', message: 'Saved Offline', description: 'Settings will sync when connection is restored' });
                        } else {
                          setJob({ ...job, geofenceAutoClockIn: previousValue });
                          showToast({ type: 'error', message: 'Failed to update setting' });
                        }
                      }
                    }}
                    trackColor={{ false: colors.muted, true: colors.success }}
                    thumbColor={colors.white}
                  />
                </View>
                
                <View style={styles.geofenceSettingRow}>
                  <View style={styles.geofenceSettingLeft}>
                    <Feather name="log-out" size={iconSizes.md} color={colors.warning} style={styles.geofenceSettingIcon} />
                    <View>
                      <Text style={styles.geofenceSettingLabel}>Auto Clock-Out</Text>
                      <Text style={styles.geofenceSettingDescription}>Stop timer when leaving job site</Text>
                    </View>
                  </View>
                  <Switch
                    value={job.geofenceAutoClockOut || false}
                    onValueChange={async (value) => {
                      const { isOnline } = useOfflineStore.getState();
                      const previousValue = job.geofenceAutoClockOut;
                      
                      // Optimistic UI update
                      setJob({ ...job, geofenceAutoClockOut: value });
                      
                      if (!isOnline) {
                        await offlineStorage.updateJobOffline(job.id, { geofenceAutoClockOut: value });
                        showToast({ type: 'info', message: 'Saved Offline', description: 'Settings will sync when online' });
                        return;
                      }
                      
                      try {
                        await api.patch(`/api/jobs/${job.id}/geofence`, { geofenceAutoClockOut: value });
                      } catch (e: any) {
                        if (e.message?.includes('Network') || e.code === 'ECONNABORTED') {
                          await offlineStorage.updateJobOffline(job.id, { geofenceAutoClockOut: value });
                          showToast({ type: 'info', message: 'Saved Offline', description: 'Settings will sync when connection is restored' });
                        } else {
                          setJob({ ...job, geofenceAutoClockOut: previousValue });
                          showToast({ type: 'error', message: 'Failed to update setting' });
                        }
                      }
                    }}
                    trackColor={{ false: colors.muted, true: colors.warning }}
                    thumbColor={colors.white}
                  />
                </View>
              </>
            )}
          </>
        ) : (
          <View style={styles.geofenceNoLocation}>
            <Feather name="alert-circle" size={iconSizes.lg} color={colors.mutedForeground} />
            <Text style={styles.geofenceNoLocationText}>
              Add a job address to enable geofence tracking. The address will be geocoded automatically.
            </Text>
          </View>
        )}
      </View>

      {/* Activity Log Link - Full log is now in More tab */}
      {activityLog.length > 0 && (
        <PressableRow
          style={styles.card}
          onPress={() => setActiveTab('manage')}

        >
          <View style={[styles.cardIconContainer, { backgroundColor: `${colors.inProgress}15` }]}>
            <Feather name="activity" size={iconSizes.xl} color={colors.inProgress} />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardLabel}>Activity Log</Text>
            <Text style={styles.cardValue}>{activityLog.length} activit{activityLog.length === 1 ? 'y' : 'ies'} recorded</Text>
          </View>
          <Feather name="chevron-right" size={iconSizes.lg} color={colors.mutedForeground} />
        </PressableRow>
      )}
    </>
  );

  return (
    <>
      <View style={styles.container}>
        <Stack.Screen 
        options={{
          headerShown: Platform.OS !== 'android',
          // The global <Header /> already consumes the status-bar inset, so on
          // Android this nested native header must NOT reserve it again (avoids
          // a phantom gap that pushes the job content too far down).
          // (headerStatusBarHeight is a valid native-stack option that
          // expo-router's option type doesn't surface, hence the cast.)
          ...(Platform.OS === 'android' ? ({ headerStatusBarHeight: 0 } as any) : {}),
          title: '',
          headerBackVisible: false,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.primary,
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ flexDirection: 'row', alignItems: 'center' }}
            >
              <Feather name="chevron-left" size={17} color={colors.primary} />
              <Text style={{ fontSize: typography.subtitle.fontSize, color: colors.primary, marginLeft: -1 }}>Back</Text>
            </Pressable>
          ),
          headerRight: () => {
            const canEditTitle = isOwnerOrManager || isSoloOwner;
            const canOpenActions = isOwnerOrManager || isSoloOwner || canDeleteJobs;
            // Workers have no header actions. We MUST return null (not an empty
            // View) — on iOS 26 any non-null headerRight is wrapped in a circular
            // glass capsule, so an empty View renders as a hollow, non-responsive
            // circle next to the Back button.
            if (!canEditTitle && !canOpenActions) return null;
            return (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {canEditTitle && (
                  <Pressable
                    onPress={() => {
                      setNewJobTitle(job.title);
                      setShowRenameModal(true);
                    }}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    style={{ width: 32, height: 30, alignItems: 'center', justifyContent: 'center' }}
                    testID="button-edit-header"
                  >
                    <Feather name="edit-2" size={18} color={colors.primary} />
                  </Pressable>
                )}
                {canOpenActions && (
                  <Pressable
                    onPress={showJobActionsMenu}
                    disabled={isCloningJob || isDeletingJob}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    style={{ width: 32, height: 30, alignItems: 'center', justifyContent: 'center' }}
                    testID="button-job-actions-menu"
                  >
                    {(isCloningJob || isDeletingJob)
                      ? <ActivityIndicator size="small" color={colors.primary} />
                      : <Feather name="more-horizontal" size={18} color={colors.primary} />
                    }
                  </Pressable>
                )}
              </View>
            );
          },
        }} 
      />

      {/* Fixed Header */}
      <View style={styles.fixedHeader}>
        {Platform.OS === 'android' && (
          <View style={styles.androidNavRow}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ flexDirection: 'row', alignItems: 'center' }}
            >
              <Feather name="chevron-left" size={20} color={colors.primary} />
              <Text style={{ fontSize: typography.subtitle.fontSize, color: colors.primary, marginLeft: -1 }}>Back</Text>
            </Pressable>
            {(() => {
              const canEditTitle = isOwnerOrManager || isSoloOwner;
              const canOpenActions = isOwnerOrManager || isSoloOwner || canDeleteJobs;
              if (!canEditTitle && !canOpenActions) return null;
              return (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  {canEditTitle && (
                    <Pressable
                      onPress={() => { setNewJobTitle(job.title); setShowRenameModal(true); }}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
                      testID="button-edit-header-android"
                    >
                      <Feather name="edit-2" size={18} color={colors.primary} />
                    </Pressable>
                  )}
                  {canOpenActions && (
                    <Pressable
                      onPress={showJobActionsMenu}
                      disabled={isCloningJob || isDeletingJob}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
                      testID="button-job-actions-menu-android"
                    >
                      {(isCloningJob || isDeletingJob)
                        ? <ActivityIndicator size="small" color={colors.primary} />
                        : <Feather name="more-horizontal" size={18} color={colors.primary} />}
                    </Pressable>
                  )}
                </View>
              );
            })()}
          </View>
        )}
        <View style={styles.statusRow}>
          <StatusBadge status={job.status} />
          {(() => {
            const urgency = getJobUrgency(job.scheduledAt, job.status, colors.isDark);
            if (!urgency) return null;
            return (
              <View style={[styles.headerUrgencyBadge, { backgroundColor: urgency.bgColor, borderColor: `${urgency.color}30` }]}>
                {urgency.animate && (
                  <View style={[styles.headerUrgencyDot, { backgroundColor: urgency.color }]} />
                )}
                <Text style={[styles.headerUrgencyText, { color: urgency.color }]}>
                  {urgency.label}
                </Text>
              </View>
            );
          })()}
        </View>
        <TouchableOpacity 
          style={styles.titleRow}
          onPress={() => {
            setNewJobTitle(job.title);
            setShowRenameModal(true);
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">{job.title}</Text>
        </TouchableOpacity>
        {job.description && (
          <Text style={styles.description} numberOfLines={3} ellipsizeMode="tail">{job.description}</Text>
        )}
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {TAB_CONFIG.map((tab) => {
          const badgeCount = tabBadgeCounts[tab.id] || 0;
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab(tab.id);
              }}
              activeOpacity={0.7}
            >
              <View style={{ position: 'relative' }}>
                <Feather 
                  name={tab.icon} 
                  size={iconSizes.lg} 
                  color={isActive ? colors.primaryForeground : colors.mutedForeground} 
                />
                {badgeCount > 0 && !isActive && (
                  <View style={{
                    position: 'absolute',
                    top: -4,
                    right: -8,
                    backgroundColor: tab.id === 'documents' ? colors.warning : colors.primary,
                    minWidth: 16,
                    height: 16,
                    borderRadius: 8,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 3,
                  }}>
                    <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.bold, color: tab.id === 'documents' ? colors.white : colors.primaryForeground }}>
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Tab Content - Scrollable */}
      <ScrollView 
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={preserveOnScroll}
        scrollEventThrottle={scrollEventThrottle}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {isSubcontractor && subbieLocationSharing && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: spacing.md,
            backgroundColor: colors.card,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            paddingHorizontal: spacing.sm + 2,
            paddingVertical: spacing.sm + 2,
            gap: spacing.sm,
          }}>
            <View style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: colorWithOpacity(colors.invoiced, 0.1),
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Feather name="map-pin" size={16} color={colors.invoiced} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.bold, color: colors.foreground, marginBottom: 1 }}>
                Location sharing on
              </Text>
              <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, lineHeight: 16 }}>
                Visible to {businessSettings?.businessName || 'the business'} while this job is active
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success }} />
              <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.bold, color: colors.success }}>LIVE</Text>
            </View>
          </View>
        )}

        {isSubcontractor && subbieLocationStopped && !subbieLocationSharing && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: spacing.md,
            backgroundColor: colors.card,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            paddingHorizontal: spacing.sm + 2,
            paddingVertical: spacing.sm + 2,
            gap: spacing.sm,
          }}>
            <View style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: colors.muted,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Feather name="shield" size={16} color={colors.mutedForeground} />
            </View>
            <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground, fontWeight: fontWeights.semibold, flex: 1 }}>
              Location sharing stopped
            </Text>
          </View>
        )}

        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'documents' && (
          <>
            {renderDocumentsTab()}
            {renderPhotosTab()}
            {renderNotesTab()}
          </>
        )}
        {activeTab === 'chat' && renderChatTab()}
        {activeTab === 'manage' && (
          <>
            {renderMaterialsTab()}
            {renderManageTab()}
          </>
        )}
      </ScrollView>

      </View>

      {/* FAB Voice Recording Modal */}
      <AppBottomSheet
        visible={showFABVoiceModal}
        onDismiss={() => { setShowFABVoiceModal(false); setIsFABRecording(false); }}
        title="Quick Voice Note"
        showCloseButton
      >
        <View>
          <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground, marginBottom: spacing.lg }}>
            Record a voice note. It will be auto-transcribed and added to job notes.
          </Text>
          <VoiceRecorder
            onSave={handleFABVoiceNoteSave}
            onCancel={() => {
              setShowFABVoiceModal(false);
              setIsFABRecording(false);
            }}
            isUploading={isUploadingFABVoice}
          />
        </View>
      </AppBottomSheet>

      {/* Add/Edit Material Modal */}
      <AppBottomSheet
        visible={showAddMaterialModal}
        onDismiss={() => { setShowAddMaterialModal(false); setEditingMaterial(null); }}
        title={editingMaterial ? 'Edit Material' : 'Add Material'}
        showCloseButton
        snapPoints={['85%']}
        footer={(
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <SheetButton variant="outline" label="Cancel" onPress={() => { setShowAddMaterialModal(false); setEditingMaterial(null); }} style={{ flex: 1 }} />
            <SheetButton onPress={handleSaveMaterial} loading={isSavingMaterial} disabled={isSavingMaterial || !materialForm.name.trim()} label={editingMaterial ? 'Update' : 'Add Material'} style={{ flex: 1 }} />
          </View>
        )}>
        <View>
                <Text style={[styles.cardLabel, { marginBottom: spacing.xs }]}>Name *</Text>
                <TextInput
                  style={[styles.singleLineInput, { marginBottom: spacing.lg }]}
                  value={materialForm.name}
                  onChangeText={v => setMaterialForm(f => ({ ...f, name: v }))}
                  placeholder="e.g. Copper pipe 25mm"
                  placeholderTextColor={colors.mutedForeground}
                />

                <View style={{ height: 1, backgroundColor: colors.border, marginBottom: spacing.md }} />
                <Text style={{ ...typography.label, color: colors.mutedForeground, marginBottom: spacing.sm }}>PRICING</Text>

                <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardLabel, { marginBottom: spacing.xs }]}>Quantity</Text>
                    <TextInput
                      style={styles.singleLineInput}
                      value={materialForm.quantity}
                      onChangeText={v => setMaterialForm(f => ({ ...f, quantity: v }))}
                      keyboardType="decimal-pad"
                      placeholder="1"
                      placeholderTextColor={colors.mutedForeground}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardLabel, { marginBottom: spacing.xs }]}>Unit Cost ($)</Text>
                    <TextInput
                      style={styles.singleLineInput}
                      value={materialForm.unitCost}
                      onChangeText={v => setMaterialForm(f => ({ ...f, unitCost: v }))}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={colors.mutedForeground}
                    />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardLabel, { marginBottom: spacing.xs }]}>Sell Price ($)</Text>
                    <TextInput
                      style={styles.singleLineInput}
                      value={materialForm.unitPrice}
                      onChangeText={v => setMaterialForm(f => ({ ...f, unitPrice: v }))}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={colors.mutedForeground}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardLabel, { marginBottom: spacing.xs }]}>Markup %</Text>
                    <TextInput
                      style={styles.singleLineInput}
                      value={materialForm.markupPercent}
                      onChangeText={v => setMaterialForm(f => ({ ...f, markupPercent: v }))}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={colors.mutedForeground}
                    />
                  </View>
                </View>
                {materialForm.unitCost && materialForm.unitPrice && parseFloat(materialForm.unitPrice) > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md, backgroundColor: parseFloat(materialForm.unitPrice) > parseFloat(materialForm.unitCost) ? `${colors.success}10` : `${colors.destructive}10`, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md }}>
                    <Feather name={parseFloat(materialForm.unitPrice) > parseFloat(materialForm.unitCost) ? 'trending-up' : 'trending-down'} size={14} color={parseFloat(materialForm.unitPrice) > parseFloat(materialForm.unitCost) ? colors.success : colors.destructive} />
                    <Text style={{ ...typography.caption, fontWeight: fontWeights.semibold, color: parseFloat(materialForm.unitPrice) > parseFloat(materialForm.unitCost) ? colors.success : colors.destructive }}>
                      Margin: {(((parseFloat(materialForm.unitPrice) - parseFloat(materialForm.unitCost)) / parseFloat(materialForm.unitPrice)) * 100).toFixed(1)}%
                    </Text>
                  </View>
                )}

                <View style={{ height: 1, backgroundColor: colors.border, marginBottom: spacing.md }} />
                <Text style={{ ...typography.label, color: colors.mutedForeground, marginBottom: spacing.sm }}>DETAILS</Text>

                <Text style={[styles.cardLabel, { marginBottom: spacing.xs }]}>Supplier</Text>
                <TextInput
                  style={[styles.singleLineInput, { marginBottom: spacing.md }]}
                  value={materialForm.supplier}
                  onChangeText={v => setMaterialForm(f => ({ ...f, supplier: v }))}
                  placeholder="e.g. Reece Plumbing"
                  placeholderTextColor={colors.mutedForeground}
                />
                <Text style={[styles.cardLabel, { marginBottom: spacing.xs }]}>Notes</Text>
                <TextInput
                  style={[styles.notesInput, { marginBottom: spacing.md }]}
                  value={materialForm.description}
                  onChangeText={v => setMaterialForm(f => ({ ...f, description: v }))}
                  placeholder="Optional notes..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={2}
                />
                {materialForm.quantity && materialForm.unitCost && (
                  <View style={{ backgroundColor: `${colors.primary}10`, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md }}>
                      <View>
                        <Text style={{ ...typography.caption, color: colors.mutedForeground }}>Total Cost</Text>
                        <Text style={{ fontSize: typography.sizes.xl, fontWeight: fontWeights.bold, color: colors.foreground }}>
                          ${(parseFloat(materialForm.quantity || '0') * parseFloat(materialForm.unitCost || '0')).toFixed(2)}
                        </Text>
                      </View>
                      {materialForm.unitPrice && parseFloat(materialForm.unitPrice) > 0 && (
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ ...typography.caption, color: colors.mutedForeground }}>Sell Total</Text>
                          <Text style={{ fontSize: typography.sizes.xl, fontWeight: fontWeights.bold, color: colors.primary }}>
                            ${(parseFloat(materialForm.quantity || '0') * parseFloat(materialForm.unitPrice || '0')).toFixed(2)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}
        </View>
      </AppBottomSheet>

      {/* Cost Prompt Modal */}
      <AppBottomSheet
        visible={showCostPromptModal}
        onDismiss={() => { setShowCostPromptModal(false); setCostPromptMaterial(null); setCostPromptValue(''); }}
        title="Enter Material Cost"
        showCloseButton
        footer={(
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <TouchableOpacity
              onPress={() => { setShowCostPromptModal(false); setCostPromptMaterial(null); setCostPromptValue(''); }}
              style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.md }}
            >
              <Text style={{ color: colors.mutedForeground, fontWeight: fontWeights.semibold, fontSize: typography.button.fontSize }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleCostPromptSkip}
              style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.md }}
            >
              <Text style={{ color: colors.foreground, fontWeight: fontWeights.semibold, fontSize: typography.button.fontSize }}>Skip</Text>
            </TouchableOpacity>
            <Button
              onPress={handleCostPromptSubmit}
              disabled={!costPromptValue || parseFloat(costPromptValue) <= 0}
              style={{ flex: 1 }}
            >
              Save & Mark {costPromptMaterial?.status === 'installed' ? 'Installed' : 'Received'}
            </Button>
          </View>
        )}>
        <View>
          <Text style={{ ...typography.body, color: colors.mutedForeground, marginBottom: spacing.md }}>
            How much did <Text style={{ fontWeight: fontWeights.semibold, color: colors.foreground }}>{costPromptMaterial?.name}</Text> cost you?
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
            <Text style={{ fontSize: typography.sizes.lg, color: colors.mutedForeground }}>$</Text>
            <TextInput
              style={[styles.singleLineInput, { flex: 1 }]}
              value={costPromptValue}
              onChangeText={setCostPromptValue}
              keyboardType="decimal-pad"
              placeholder="Unit cost"
              placeholderTextColor={colors.mutedForeground}
              autoFocus
            />
          </View>
          <Text style={{ ...typography.caption, color: colors.mutedForeground }}>
            Tracking costs helps you see your real profit on each job.
          </Text>
        </View>
      </AppBottomSheet>

      {/* Assign Workers Modal - Multi-select with availability */}
      <AppBottomSheet
        visible={showAssignModal}
        onDismiss={() => { setShowAssignModal(false); setShowMagicLinkInAssign(false); }}
        title="Assign Workers"
        showCloseButton
        snapPoints={['78%']}
        contentPadding={0}
        footer={(
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: spacing.md,
                borderRadius: radius.lg,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: colors.border,
              }}
              onPress={() => { setShowAssignModal(false); setShowMagicLinkInAssign(false); }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: typography.button.fontSize, color: colors.foreground }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: spacing.md,
                borderRadius: radius.lg,
                alignItems: 'center',
                backgroundColor: colors.primary,
                opacity: isAssigning ? 0.6 : 1,
              }}
              onPress={handleMultiAssign}
              disabled={isAssigning || selectedWorkerIds.size === 0}
              activeOpacity={0.8}
            >
              {isAssigning ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.primaryForeground }}>
                  {selectedWorkerIds.size > 0 ? `Assign ${selectedWorkerIds.size} Worker${selectedWorkerIds.size !== 1 ? 's' : ''}` : 'Select Workers'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      >
        <View>
            {selectedWorkerIds.size > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
                <Feather name="check-circle" size={14} color={colors.primary} />
                <Text style={{ ...typography.caption, color: colors.primary, fontWeight: fontWeights.semibold }}>
                  {selectedWorkerIds.size} worker{selectedWorkerIds.size !== 1 ? 's' : ''} selected
                </Text>
              </View>
            )}
            <View>
              {teamMembers.length > 0 && (
                <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.bold, color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs }}>
                  Team Members
                </Text>
              )}
              {teamMembers.map((member) => {
                const memberId = member.memberId || member.userId || member.id;
                const isSelected = selectedWorkerIds.has(memberId);
                const availability = teamAvailability.get(memberId);
                const availStatus = availability?.status || 'available';

                let availLabel = 'Available';
                let availColor = colors.success;
                let availIcon: string = 'check-circle';

                if (availStatus === 'on_job') {
                  const jobName = availability?.activeJobTitle || 'a job';
                  const startTime = availability?.timerStartTime;
                  let elapsed = '';
                  if (startTime) {
                    const mins = Math.floor((Date.now() - new Date(startTime).getTime()) / (1000 * 60));
                    elapsed = mins >= 60 ? ` (${Math.floor(mins / 60)}h ${mins % 60}m in)` : ` (${mins}m in)`;
                  }
                  availLabel = `On: ${jobName}${elapsed}`;
                  availColor = colors.warning;
                  availIcon = 'clock';
                } else if (availStatus === 'upcoming') {
                  const nextJob = availability?.nextScheduledJob;
                  if (nextJob) {
                    const scheduledDate = new Date(nextJob.scheduledDate);
                    const mins = Math.max(0, Math.floor((scheduledDate.getTime() - Date.now()) / (1000 * 60)));
                    const timeStr = scheduledDate.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
                    availLabel = `Next: ${nextJob.title} at ${timeStr}${mins <= 60 ? ` (${mins}m)` : ''}`;
                  } else {
                    availLabel = 'Has upcoming job';
                  }
                  availColor = colors.info;
                  availIcon = 'calendar';
                }

                return (
                  <TouchableOpacity
                    key={member.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: spacing.md,
                      paddingHorizontal: spacing.lg,
                      gap: spacing.sm,
                      backgroundColor: isSelected ? `${colors.primary}08` : 'transparent',
                    }}
                    onPress={() => {
                      const next = new Set(selectedWorkerIds);
                      if (next.has(memberId)) {
                        next.delete(memberId);
                      } else {
                        next.add(memberId);
                      }
                      setSelectedWorkerIds(next);
                    }}
                    activeOpacity={0.7}
                    disabled={isAssigning}
                  >
                    <View style={{
                      width: 22,
                      height: 22,
                      borderRadius: 4,
                      borderWidth: 2,
                      borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: isSelected ? colors.primary : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {isSelected && <Feather name="check" size={14} color={colors.primaryForeground} />}
                    </View>
                    <TeamAvatar
                      name={member.name}
                      email={member.email}
                      userId={member.userId ? String(member.userId) : String(member.id)}
                      themeColor={(member as any).themeColor}
                      size={36}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...typography.body, color: colors.foreground, fontWeight: fontWeights.medium }}>
                        {member.name || member.email || 'Team Member'}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <Feather name={availIcon as any} size={11} color={availColor} />
                        <Text style={{ fontSize: typography.sizes.xs, color: availColor }} numberOfLines={1}>
                          {availLabel}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
              {teamMembers.length === 0 && !showMagicLinkInAssign && (
                <View style={{ alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg }}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: `${colors.primary}10`, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm }}>
                    <Feather name="users" size={24} color={colors.mutedForeground} />
                  </View>
                  <Text style={{ ...typography.body, color: colors.mutedForeground, textAlign: 'center', marginBottom: spacing.xs }}>
                    No team members yet
                  </Text>
                  <Text style={{ ...typography.caption, color: colors.mutedForeground, textAlign: 'center', marginBottom: spacing.lg }}>
                    Invite people to your team so you can assign them to jobs
                  </Text>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: spacing.sm,
                      backgroundColor: colors.primary,
                      paddingVertical: spacing.md,
                      paddingHorizontal: spacing.xl,
                      borderRadius: radius.lg,
                    }}
                    onPress={() => {
                      setShowAssignModal(false);
                      router.push('/more/team-management');
                    }}
                    activeOpacity={0.7}
                  >
                    <Feather name="user-plus" size={16} color={colors.primaryForeground} />
                    <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.primaryForeground }}>
                      Add Team Member
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.md, paddingTop: spacing.md, paddingHorizontal: spacing.lg }}>
                <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.bold, color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm }}>
                  Invite Someone New
                </Text>
                {!showMagicLinkInAssign ? (
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: spacing.sm,
                      backgroundColor: `${colors.invoiced}15`,
                      paddingVertical: spacing.md,
                      borderRadius: radius.lg,
                    }}
                    onPress={() => setShowMagicLinkInAssign(true)}
                    activeOpacity={0.7}
                  >
                    <Feather name="send" size={16} color={colors.invoiced} />
                    <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.invoiced }}>
                      Send Magic Link
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{ gap: spacing.md }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <Feather name="send" size={16} color={colors.invoiced} />
                      <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground }}>
                        Invite by Phone
                      </Text>
                    </View>
                    <Text style={{ ...typography.caption, color: colors.mutedForeground }}>
                      Send an SMS with a link to view and update this job. No app download needed.
                    </Text>
                    <TextInput
                      style={[styles.singleLineInput]}
                      placeholder="Name *"
                      placeholderTextColor={colors.mutedForeground}
                      value={magicLinkName}
                      onChangeText={setMagicLinkName}
                    />
                    <TextInput
                      style={[styles.singleLineInput]}
                      placeholder="Phone number *"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="phone-pad"
                      value={magicLinkPhone}
                      onChangeText={setMagicLinkPhone}
                    />
                    <TextInput
                      style={[styles.singleLineInput]}
                      placeholder="Hourly rate (e.g. 85)"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="decimal-pad"
                      value={magicLinkRate}
                      onChangeText={setMagicLinkRate}
                    />
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                      <TouchableOpacity
                        style={{
                          flex: 1,
                          paddingVertical: spacing.md,
                          borderRadius: radius.lg,
                          alignItems: 'center',
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                        onPress={() => {
                          setShowMagicLinkInAssign(false);
                          setMagicLinkName('');
                          setMagicLinkPhone('');
                          setMagicLinkRate('');
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontSize: typography.button.fontSize, color: colors.foreground }}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{
                          flex: 1,
                          paddingVertical: spacing.md,
                          borderRadius: radius.lg,
                          alignItems: 'center',
                          backgroundColor: colors.invoiced,
                          opacity: isSendingMagicLink ? 0.6 : 1,
                        }}
                        onPress={handleQuickMagicLink}
                        disabled={isSendingMagicLink}
                        activeOpacity={0.8}
                      >
                        {isSendingMagicLink ? (
                          <ActivityIndicator size="small" color={colors.primaryForeground} />
                        ) : (
                          <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.primaryForeground }}>Send SMS</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </View>
        </View>
      </AppBottomSheet>

      {/* Rename Job Modal */}
      <AppBottomSheet
        visible={showRenameModal}
        onDismiss={() => setShowRenameModal(false)}
        title="Rename Job"
        showCloseButton
        footer={(
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <SheetButton variant="outline" label="Cancel" onPress={() => setShowRenameModal(false)} style={{ flex: 1 }} />
            <SheetButton onPress={handleRenameJob} loading={isSavingTitle} disabled={isSavingTitle || !newJobTitle.trim()} label="Save" style={{ flex: 1 }} />
          </View>
        )}>
        <View>
          <TextInput
            style={styles.singleLineInput}
            value={newJobTitle}
            onChangeText={setNewJobTitle}
            placeholder="Enter job title..."
            placeholderTextColor={colors.mutedForeground}
            autoFocus
          />
        </View>
      </AppBottomSheet>

      {/* Notes Modal */}
      <AppBottomSheet
        visible={showNotesModal}
        onDismiss={() => { setShowNotesModal(false); setEditingNote(null); }}
        title={editingNote ? 'Edit Note' : 'Add Note'}
        showCloseButton
        footer={(
          <SheetButton
            fullWidth
            loading={isSavingNotes}
            disabled={isSavingNotes || !editedNotes.trim()}
            onPress={handleSaveNotes}
            label={editingNote ? 'Save Changes' : 'Add Note'}
          />
        )}
      >
        <View>
          <TextInput
            style={styles.notesInput}
            value={editedNotes}
            onChangeText={setEditedNotes}
            placeholder="Add a note about this job..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            autoFocus
          />
        </View>
      </AppBottomSheet>

      <AppBottomSheet
        visible={!!editRateTimer}
        onDismiss={() => setEditRateTimer(null)}
        title="Edit Hourly Rate"
        showCloseButton
        autoHeight
        footer={(
          <SheetButton
            fullWidth
            loading={isSavingRate}
            disabled={isSavingRate}
            onPress={handleSaveRate}
            label="Save Rate"
          />
        )}
      >
        <View>
          <Text style={{ fontSize: typography.button.fontSize, color: colors.mutedForeground, marginBottom: spacing.md }}>
            Set the hourly rate for {editRateTimer?.workerName} on this job. This updates their current time entry.
          </Text>
          <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.mutedForeground, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.3 }}>
            Hourly Rate (AUD)
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, minHeight: 48 }}>
            <Text style={{ fontSize: typography.subtitle.fontSize, color: colors.foreground, marginRight: 4 }}>$</Text>
            <TextInput
              style={{ flex: 1, fontSize: typography.subtitle.fontSize, color: colors.foreground, letterSpacing: 0, textAlign: 'left' }}
              value={rateInput}
              onChangeText={setRateInput}
              placeholder="0.00"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
              autoFocus
            />
            <Text style={{ fontSize: typography.button.fontSize, color: colors.mutedForeground }}>/hr</Text>
          </View>
        </View>
      </AppBottomSheet>

      {/* Site Update Modal */}
      <AppBottomSheet
        visible={showSiteUpdateModal}
        onDismiss={() => setShowSiteUpdateModal(false)}
        title="Post Site Update"
        showCloseButton
        footer={(
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={isSendingSiteUpdate}
            onPress={handleSubmitSiteUpdate}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.primary,
              paddingVertical: spacing.md,
              borderRadius: radius.lg,
              minHeight: 48,
              width: '100%',
              opacity: isSendingSiteUpdate ? 0.6 : 1,
            }}
          >
            {isSendingSiteUpdate ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Text style={{ color: colors.primaryForeground, fontSize: typography.subtitle.fontSize, fontWeight: fontWeights.semibold }}>Post Update</Text>
            )}
          </TouchableOpacity>
        )}>
        <View>
              <View>
                <TextInput
                  style={styles.notesInput}
                  value={siteUpdateNote}
                  onChangeText={setSiteUpdateNote}
                  placeholder="Describe the progress on site..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  autoFocus
                />
                <View style={{ marginTop: spacing.md }}>
                  <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.mutedForeground, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                    Attach Photo (Optional)
                  </Text>
                  {siteUpdatePhotoUri ? (
                    <View style={{ position: 'relative' }}>
                      <Image
                        source={{ uri: siteUpdatePhotoUri }}
                        style={{ width: '100%', height: 200, borderRadius: radius.lg }}
                        resizeMode="cover"
                      />
                      <TouchableOpacity
                        onPress={() => setSiteUpdatePhotoUri(null)}
                        style={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: 'rgba(0,0,0,0.6)',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Feather name="x" size={18} color={colors.white} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                      <TouchableOpacity
                        style={{
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: colors.primary,
                          paddingVertical: spacing.md,
                          borderRadius: radius.lg,
                          gap: spacing.xs,
                          minHeight: 44,
                        }}
                        onPress={handleSiteUpdateTakePhoto}
                      >
                        <Feather name="camera" size={iconSizes.md} color={colors.primaryForeground} />
                        <Text style={{ color: colors.primaryForeground, fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold }}>Take Photo</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: colors.muted,
                          paddingVertical: spacing.md,
                          borderRadius: radius.lg,
                          gap: spacing.xs,
                          minHeight: 44,
                        }}
                        onPress={handleSiteUpdatePickPhoto}
                      >
                        <Feather name="image" size={iconSizes.md} color={colors.foreground} />
                        <Text style={{ color: colors.foreground, fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold }}>Gallery</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
        </View>
      </AppBottomSheet>

      {/* Photos Modal */}
      <AppBottomSheet
        visible={showPhotosModal}
        onDismiss={() => setShowPhotosModal(false)}
        title={`Job Photos (${photos.length})`}
        showCloseButton
        snapPoints={['90%']}
        footer={photos.filter(p => !isVideo(p)).length > 0 && businessSettings?.aiEnabled !== false && businessSettings?.aiPhotoAnalysisEnabled !== false ? (
          <TouchableOpacity
            style={{
              backgroundColor: colors.primary,
              paddingVertical: spacing.md,
              borderRadius: radius.md,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              minHeight: 44,
            }}
            onPress={() => {
              setShowPhotosModal(false);
              setTimeout(() => setShowAIAnalysisModal(true), 300);
            }}
            activeOpacity={0.8}
          >
            <Feather name="zap" size={18} color={colors.primaryForeground} />
            <Text style={{ color: colors.primaryForeground, fontWeight: fontWeights.semibold, fontSize: typography.button.fontSize }}>Analyse with AI</Text>
          </TouchableOpacity>
        ) : undefined}>
        <View>
              {photos.length === 0 ? (
                <View style={styles.photosEmpty}>
                  <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: `${colors.primary}10`, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm }}>
                    <Feather name="image" size={32} color={colors.mutedForeground} />
                  </View>
                  <Text style={styles.photosEmptyText}>No photos or videos yet</Text>
                  <Text style={{ ...typography.caption, color: colors.mutedForeground, textAlign: 'center', paddingHorizontal: spacing.lg }}>
                    Use the Photos tab to capture before, during, and after shots
                  </Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {photos.map((photo) => (
                    <PressableRow 
                      key={photo.id}
                      style={styles.photoItem}
                      onPress={() => {
                        if (isVideo(photo)) {
                          setShowPhotosModal(false);
                          setSelectedVideo(photo);
                          setShowVideoPlayer(true);
                        } else {
                          setSelectedPhoto(photo);
                        }
                      }}
                      onLongPress={() => handleChangePhotoCategory(photo)}
                    >
                      <Image 
                        source={{ uri: photo.signedUrl || photo.url || photo.thumbnailUrl || '' }} 
                        style={styles.photoImage}
                        resizeMode="cover"
                      />
                      {isVideo(photo) && (
                        <View style={styles.videoOverlay}>
                          <View style={styles.videoPlayIcon}>
                            <Feather name="play" size={16} color={colors.foreground} />
                          </View>
                        </View>
                      )}
                      {photo.category && photo.category !== 'general' && (
                        <View style={[styles.photoCategoryBadge, 
                          photo.category === 'before' && { backgroundColor: colors.info },
                          photo.category === 'after' && { backgroundColor: colors.success },
                          photo.category === 'progress' && { backgroundColor: colors.warning },
                          photo.category === 'materials' && { backgroundColor: colors.invoiced }
                        ]}>
                          <Text style={styles.photoCategoryBadgeText}>
                            {photo.category.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </PressableRow>
                  ))}
                </View>
              )}
        </View>
      </AppBottomSheet>

      {/* AI Photo Analysis Modal */}
      {job && (
        <AIPhotoAnalysisModal
          visible={showAIAnalysisModal}
          onClose={() => setShowAIAnalysisModal(false)}
          jobId={job.id}
          photos={photos}
          existingNotes={jobNotes.length > 0 ? jobNotes.map(n => n.content).join('\n') : (job.notes || '')}
          onNotesUpdated={() => { loadJob(); loadJobNotes(); }}
          aiEnabled={businessSettings?.aiEnabled !== false}
          aiPhotoAnalysisEnabled={businessSettings?.aiPhotoAnalysisEnabled !== false}
        />
      )}

      {/* Full Photo Preview Modal */}
      <Modal
      onRequestClose={() => setSelectedPhoto(null)} visible={!!selectedPhoto && !showAnnotationEditor} animationType="fade" transparent>
        <View style={styles.photoPreviewModal}>
          {selectedPhoto && (
            <>
              <Image 
                source={{ uri: selectedPhoto.signedUrl || selectedPhoto.url || '' }} 
                style={styles.fullPhoto}
                resizeMode="contain"
              />
              
              {/* Close button - top right */}
              <TouchableOpacity 
                style={styles.closePhotoButton}
                onPress={() => setSelectedPhoto(null)}
                data-testid="button-close-photo"
              >
                <Feather name="x" size={24} color={colors.white} />
              </TouchableOpacity>
              
              {/* Bottom toolbar with all actions */}
              <View style={styles.photoToolbar}>
                {/* Category badge display */}
                <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 8 }}>
                  <View style={{ 
                    backgroundColor: selectedPhoto.category === 'before' ? colors.info + '30' : 
                                    selectedPhoto.category === 'after' ? colors.success + '30' : 
                                    selectedPhoto.category === 'progress' ? colors.warning + '30' : 
                                    selectedPhoto.category === 'materials' ? colors.invoiced + '30' :
                                    'rgba(255,255,255,0.15)',
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}>
                    <Feather 
                      name="tag" 
                      size={14} 
                      color={selectedPhoto.category === 'before' ? colors.info : 
                             selectedPhoto.category === 'after' ? colors.success : 
                             selectedPhoto.category === 'progress' ? colors.warning : 
                             selectedPhoto.category === 'materials' ? colors.invoiced : '#fff'} 
                    />
                    <Text style={{ 
                      color: selectedPhoto.category === 'before' ? colors.info : 
                             selectedPhoto.category === 'after' ? colors.success : 
                             selectedPhoto.category === 'progress' ? colors.warning : 
                             selectedPhoto.category === 'materials' ? colors.invoiced : '#fff',
                      fontWeight: fontWeights.semibold,
                      fontSize: typography.sizes.sm,
                    }}>
                      {selectedPhoto.category ? selectedPhoto.category.charAt(0).toUpperCase() + selectedPhoto.category.slice(1) : 'General'}
                    </Text>
                  </View>
                </View>
                
                {/* Action buttons row */}
                <View style={styles.photoToolbarRow}>
                  <TouchableOpacity 
                    style={styles.photoToolbarButton}
                    onPress={() => {
                      const photoToAnalyse = selectedPhoto;
                      setSelectedPhoto(null);
                      requestAnimationFrame(() => {
                        setShowAIAnalysisModal(true);
                      });
                    }}
                    data-testid="button-ai-analyse-photo"
                  >
                    <Feather name="zap" size={22} color={colors.warning} />
                    <Text style={[styles.photoToolbarButtonText, { color: colors.warning }]}>AI Analyse</Text>
                  </TouchableOpacity>
                  
                  <View style={styles.photoToolbarDivider} />
                  
                  <TouchableOpacity 
                    style={styles.photoToolbarButton}
                    onPress={() => handleSaveMedia(selectedPhoto)}
                    disabled={isSavingMedia}
                    data-testid="button-share-photo"
                  >
                    <Feather name={isSavingMedia ? "loader" : "share"} size={22} color={colors.white} />
                    <Text style={styles.photoToolbarButtonText}>Share</Text>
                  </TouchableOpacity>
                  
                  <View style={styles.photoToolbarDivider} />
                  
                  <TouchableOpacity 
                    style={styles.photoToolbarButton}
                    onPress={() => setShowAnnotationEditor(true)}
                    data-testid="button-markup-photo"
                  >
                    <Feather name="edit-2" size={22} color={colors.white} />
                    <Text style={styles.photoToolbarButtonText}>Markup</Text>
                  </TouchableOpacity>
                  
                  <View style={styles.photoToolbarDivider} />
                  
                  <TouchableOpacity 
                    style={styles.photoToolbarButton}
                    onPress={() => handleDeletePhoto(selectedPhoto)}
                    data-testid="button-delete-photo"
                  >
                    <Feather name="trash-2" size={22} color={colors.destructive} />
                    <Text style={[styles.photoToolbarButtonText, { color: colors.destructive }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </View>
      </Modal>

      {/* Photo Annotation Editor Modal */}
      {selectedPhoto && showAnnotationEditor && (
        <PhotoAnnotationEditor
          imageUri={selectedPhoto.signedUrl || selectedPhoto.url || ''}
          onSave={handleAnnotatedPhotoSave}
          onCancel={() => setShowAnnotationEditor(false)}
          visible={showAnnotationEditor}
        />
      )}

      {/* Video Player Modal */}
      <Modal
      onRequestClose={() => setShowVideoPlayer(false)} visible={showVideoPlayer && !!selectedVideo} animationType="fade" transparent>
        <View style={styles.videoPlayerModal}>
          {selectedVideo && (
            <>
              <View style={styles.videoPlayerContainer}>
                <WebView
                  source={{
                    html: `
                      <!DOCTYPE html>
                      <html>
                      <head>
                        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
                        <style>
                          * { margin: 0; padding: 0; }
                          html, body { width: 100%; height: 100%; background: #000; }
                          video { width: 100%; height: 100%; object-fit: contain; }
                        </style>
                      </head>
                      <body>
                        <video controls autoplay playsinline>
                          <source src="${selectedVideo.signedUrl || selectedVideo.url || ''}" type="${selectedVideo.mimeType || 'video/mp4'}">
                          Your browser does not support the video tag.
                        </video>
                      </body>
                      </html>
                    `,
                  }}
                  style={{ flex: 1, backgroundColor: '#000' }}
                  allowsInlineMediaPlayback
                  mediaPlaybackRequiresUserAction={false}
                  javaScriptEnabled
                />
              </View>
              <TouchableOpacity 
                style={styles.closeVideoButton}
                onPress={() => {
                  setShowVideoPlayer(false);
                  setSelectedVideo(null);
                }}
                data-testid="button-close-video"
              >
                <Feather name="x" size={24} color={colors.primaryForeground} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.saveVideoButton, isSavingMedia && { opacity: 0.6 }]}
                onPress={() => {
                  if (selectedVideo) {
                    handleSaveMedia(selectedVideo);
                  }
                }}
                disabled={isSavingMedia}
                data-testid="button-share-video"
              >
                <Feather name={isSavingMedia ? "loader" : "share"} size={18} color={colors.primaryForeground} />
                <Text style={styles.savePhotoText}>{isSavingMedia ? 'Preparing...' : 'Share Video'}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.deleteVideoButton}
                onPress={() => {
                  if (selectedVideo) {
                    handleDeletePhoto(selectedVideo);
                    setShowVideoPlayer(false);
                    setSelectedVideo(null);
                  }
                }}
                data-testid="button-delete-video"
              >
                <Feather name="trash-2" size={18} color={colors.primaryForeground} />
                <Text style={styles.deletePhotoText}>Delete Video</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>

      {/* Job Completion Summary Modal */}
      {job && (
        <AppBottomSheet
        visible={showCompletionModal}
        onDismiss={() => setShowCompletionModal(false)}
        title={completionMode === 'worker' ? 'Mark My Part Complete' : 'Complete Job'}
        showCloseButton
        snapPoints={['88%']}
        footer={(
          <View style={{ gap: spacing.sm }}>
            <TouchableOpacity 
              style={[styles.completionButton, styles.completionButtonPrimary]} 
              onPress={completionMode === 'worker' ? handleCompleteMyPart : handleConfirmComplete}
              disabled={isCompletingJob}
            >
              {isCompletingJob ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.completionButtonText} numberOfLines={1}>{completionMode === 'worker' ? 'Mark My Part Complete' : 'Complete Job'}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.completionButton, styles.completionButtonSecondary]} 
              onPress={() => setShowCompletionModal(false)}
            >
              <Text style={[styles.completionButtonText, styles.completionButtonTextSecondary]} numberOfLines={1}>Go Back</Text>
            </TouchableOpacity>
          </View>
        )}>
          <View>
              {/* Job Title */}
              <View style={[styles.completionSection, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
                <Text style={[styles.completionSectionTitle, { color: colors.primary }]}>{job.title}</Text>
                {job.description && (
                  <Text style={[styles.completionSectionDetail, { marginTop: spacing.xs }]}>{job.description}</Text>
                )}
              </View>

              {/* Photos Section */}
              <View style={styles.completionSection}>
                <View style={styles.completionSectionHeader}>
                  <View style={[styles.completionSectionIcon, { backgroundColor: photos.length > 0 ? colors.success + '15' : colors.destructive + '15' }]}>
                    <Feather name="camera" size={18} color={photos.length > 0 ? colors.success : colors.destructive} />
                  </View>
                  <Text style={styles.completionSectionTitle}>Photos</Text>
                  <View style={styles.completionSectionStatus}>
                    <Feather 
                      name={photos.length > 0 ? 'check-circle' : 'x-circle'} 
                      size={18} 
                      color={photos.length > 0 ? colors.success : colors.destructive} 
                    />
                    <Text style={[styles.completionStatusText, { color: photos.length > 0 ? colors.success : colors.destructive }]}>
                      {photos.length > 0 ? `${photos.length} photo${photos.length !== 1 ? 's' : ''}` : 'None'}
                    </Text>
                  </View>
                </View>
                {photos.length > 0 && (
                  <View style={styles.photoThumbnailsRow}>
                    {photos.slice(0, 4).map((photo, idx) => (
                      <Image 
                        key={photo.id || idx} 
                        source={{ uri: photo.signedUrl || photo.url || photo.thumbnailUrl }} 
                        style={styles.photoThumbnail} 
                      />
                    ))}
                    {photos.length > 4 && (
                      <View style={[styles.photoThumbnail, { alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ color: colors.mutedForeground, fontWeight: fontWeights.semibold }}>+{photos.length - 4}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* Notes Section */}
              {(() => {
                const hasAnyNotes = jobNotes.length > 0 || !!(job.notes && job.notes.trim());
                const latestNoteText = jobNotes.length > 0 ? jobNotes[jobNotes.length - 1].content : (job.notes || '');
                return (
                  <View style={styles.completionSection}>
                    <View style={styles.completionSectionHeader}>
                      <View style={[styles.completionSectionIcon, { backgroundColor: hasAnyNotes ? colors.success + '15' : colors.destructive + '15' }]}>
                        <Feather name="file-text" size={18} color={hasAnyNotes ? colors.success : colors.destructive} />
                      </View>
                      <Text style={styles.completionSectionTitle}>Notes</Text>
                      <View style={styles.completionSectionStatus}>
                        <Feather 
                          name={hasAnyNotes ? 'check-circle' : 'x-circle'} 
                          size={18} 
                          color={hasAnyNotes ? colors.success : colors.destructive} 
                        />
                        <Text style={[styles.completionStatusText, { color: hasAnyNotes ? colors.success : colors.destructive }]}>
                          {hasAnyNotes ? 'Added' : 'None'}
                        </Text>
                      </View>
                    </View>
                    {hasAnyNotes && (
                      <Text style={[styles.completionSectionDetail, { marginTop: spacing.xs }]} numberOfLines={3}>
                        {latestNoteText}
                      </Text>
                    )}
                  </View>
                );
              })()}

              {/* Time Tracked Section - per worker breakdown */}
              <View style={styles.completionSection}>
                <View style={styles.completionSectionHeader}>
                  <View style={[styles.completionSectionIcon, { backgroundColor: completionTimeEntries.length > 0 ? colors.success + '15' : colors.destructive + '15' }]}>
                    <Feather name="clock" size={18} color={completionTimeEntries.length > 0 ? colors.success : colors.destructive} />
                  </View>
                  <Text style={styles.completionSectionTitle}>Time Tracked</Text>
                  <View style={styles.completionSectionStatus}>
                    <Feather 
                      name={completionTimeEntries.length > 0 ? 'check-circle' : 'x-circle'} 
                      size={18} 
                      color={completionTimeEntries.length > 0 ? colors.success : colors.destructive} 
                    />
                    <Text style={[styles.completionStatusText, { color: completionTimeEntries.length > 0 ? colors.success : colors.destructive }]}>
                      {completionTimeEntries.length > 0 ? (() => {
                        const totalMs = completionTimeEntries.reduce((sum, entry) => {
                          if (!entry.startTime || !entry.endTime) return sum;
                          return sum + (new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime());
                        }, 0);
                        const hours = Math.floor(totalMs / (1000 * 60 * 60));
                        const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
                        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
                      })() : 'None'}
                    </Text>
                  </View>
                </View>
                {completionTimeEntries.length > 0 && (() => {
                  const byWorker = completionTimeEntries.reduce((acc: Record<string, { name: string; totalMs: number; rate: string; entries: number }>, entry) => {
                    const key = entry.userId || 'unknown';
                    if (!acc[key]) {
                      acc[key] = { name: entry.userName || 'You', totalMs: 0, rate: entry.hourlyRate || '85.00', entries: 0 };
                    }
                    if (entry.startTime && entry.endTime) {
                      acc[key].totalMs += new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime();
                    }
                    acc[key].entries++;
                    return acc;
                  }, {});
                  const workers = Object.values(byWorker);
                  if (workers.length <= 1) return null;
                  return (
                    <View style={{ marginTop: spacing.xs, gap: spacing.xs }}>
                      {workers.map((w, i) => {
                        const hrs = Math.floor(w.totalMs / (1000 * 60 * 60));
                        const mins = Math.floor((w.totalMs % (1000 * 60 * 60)) / (1000 * 60));
                        return (
                          <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, paddingLeft: 36 }}>
                            <Text style={{ flex: 1, fontSize: typography.sizes.sm, color: colors.mutedForeground }} numberOfLines={1} ellipsizeMode="tail">{w.name}</Text>
                            <Text style={{ fontSize: typography.sizes.sm, color: colors.foreground, fontWeight: fontWeights.semibold }} numberOfLines={1}>
                              {hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`} @ ${w.rate}/hr
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  );
                })()}
              </View>

              {/* Team Section - who did what (multi-worker jobs). Owner summary
                  only — a worker completing their own part should not see other
                  workers' progress. */}
              {completionMode === 'owner' && totalWorkerCount > 1 && (
                <View style={styles.completionSection}>
                  <View style={styles.completionSectionHeader}>
                    <View style={[styles.completionSectionIcon, { backgroundColor: allWorkersComplete ? colors.success + '15' : colors.warning + '15' }]}>
                      <Feather name="users" size={18} color={allWorkersComplete ? colors.success : colors.warning} />
                    </View>
                    <Text style={styles.completionSectionTitle}>Team</Text>
                    <View style={styles.completionSectionStatus}>
                      <Feather
                        name={allWorkersComplete ? 'check-circle' : 'clock'}
                        size={18}
                        color={allWorkersComplete ? colors.success : colors.warning}
                      />
                      <Text style={[styles.completionStatusText, { color: allWorkersComplete ? colors.success : colors.warning }]}>
                        {completedWorkerCount}/{totalWorkerCount} done
                      </Text>
                    </View>
                  </View>
                  <View style={{ marginTop: spacing.xs, gap: spacing.xs }}>
                    {jobAssignments.map((a: any) => {
                      const member = teamMembers.find(m =>
                        m.userId === a.userId || m.memberId === a.userId || m.id === a.userId
                      );
                      const name = a.workerDisplayNameSnapshot || member?.name || 'Worker';
                      const done = !!a.completedAt;
                      const ms = timeEntries
                        .filter(e => e.userId === a.userId && e.startTime && e.endTime && !e.isBreak)
                        .reduce((s, e) => s + (new Date(e.endTime!).getTime() - new Date(e.startTime).getTime()), 0);
                      const hrs = Math.floor(ms / (1000 * 60 * 60));
                      const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
                      const timeLabel = ms > 0 ? (hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`) : null;
                      return (
                        <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: 36 }}>
                          <Feather name={done ? 'check-circle' : 'circle'} size={14} color={done ? colors.success : colors.mutedForeground} />
                          <Text style={{ flex: 1, fontSize: typography.sizes.sm, color: colors.foreground }} numberOfLines={1} ellipsizeMode="tail">
                            {name}{a.isPrimary ? ' · Lead' : ''}
                          </Text>
                          <Text style={{ fontSize: typography.captionSmall.fontSize, color: done ? colors.success : colors.mutedForeground }} numberOfLines={1}>
                            {done ? 'Part done' : 'Pending'}{timeLabel ? ` · ${timeLabel}` : ''}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Signatures Section */}
              <View style={styles.completionSection}>
                <View style={styles.completionSectionHeader}>
                  <View style={[styles.completionSectionIcon, { backgroundColor: signatures.length > 0 ? colors.success + '15' : colors.destructive + '15' }]}>
                    <Feather name="edit-3" size={18} color={signatures.length > 0 ? colors.success : colors.destructive} />
                  </View>
                  <Text style={styles.completionSectionTitle}>Signatures</Text>
                  <View style={styles.completionSectionStatus}>
                    <Feather 
                      name={signatures.length > 0 ? 'check-circle' : 'x-circle'} 
                      size={18} 
                      color={signatures.length > 0 ? colors.success : colors.destructive} 
                    />
                    <Text style={[styles.completionStatusText, { color: signatures.length > 0 ? colors.success : colors.destructive }]}>
                      {signatures.length > 0 ? `${signatures.length} signature${signatures.length !== 1 ? 's' : ''}` : 'None'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Voice Notes Section */}
              <View style={styles.completionSection}>
                <View style={styles.completionSectionHeader}>
                  <View style={[styles.completionSectionIcon, { backgroundColor: voiceNotes.length > 0 ? colors.success + '15' : colors.destructive + '15' }]}>
                    <Feather name="mic" size={18} color={voiceNotes.length > 0 ? colors.success : colors.destructive} />
                  </View>
                  <Text style={styles.completionSectionTitle}>Voice Notes</Text>
                  <View style={styles.completionSectionStatus}>
                    <Feather 
                      name={voiceNotes.length > 0 ? 'check-circle' : 'x-circle'} 
                      size={18} 
                      color={voiceNotes.length > 0 ? colors.success : colors.destructive} 
                    />
                    <Text style={[styles.completionStatusText, { color: voiceNotes.length > 0 ? colors.success : colors.destructive }]}>
                      {voiceNotes.length > 0 ? `${voiceNotes.length} recording${voiceNotes.length !== 1 ? 's' : ''}` : 'None'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Site Attendance Section */}
              <View style={styles.completionSection}>
                <View style={styles.completionSectionHeader}>
                  <View style={[styles.completionSectionIcon, { backgroundColor: (siteAttendance && siteAttendance.arrivalCount > 0) ? colors.success + '15' : colors.destructive + '15' }]}>
                    <Feather name="map-pin" size={18} color={(siteAttendance && siteAttendance.arrivalCount > 0) ? colors.success : colors.destructive} />
                  </View>
                  <Text style={styles.completionSectionTitle}>Site Attendance</Text>
                  <View style={styles.completionSectionStatus}>
                    <Feather 
                      name={(siteAttendance && siteAttendance.arrivalCount > 0) ? 'check-circle' : 'x-circle'} 
                      size={18} 
                      color={(siteAttendance && siteAttendance.arrivalCount > 0) ? colors.success : colors.destructive} 
                    />
                    <Text style={[styles.completionStatusText, { color: (siteAttendance && siteAttendance.arrivalCount > 0) ? colors.success : colors.destructive }]}>
                      {(siteAttendance && siteAttendance.arrivalCount > 0) 
                        ? `${siteAttendance.arrivalCount} visit${siteAttendance.arrivalCount !== 1 ? 's' : ''} logged`
                        : 'No GPS data'}
                    </Text>
                  </View>
                </View>
                {siteAttendance && siteAttendance.firstArrival && (
                  <View style={{ marginTop: spacing.xs, gap: 2 }}>
                    <Text style={[styles.completionSectionDetail]}>
                      Arrived: {new Date(siteAttendance.firstArrival).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    {siteAttendance.lastDeparture && (
                      <Text style={[styles.completionSectionDetail]}>
                        Departed: {new Date(siteAttendance.lastDeparture).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    )}
                  </View>
                )}
              </View>

              {/* Empty Job Warning */}
              {photos.length === 0 && (!job.notes || !job.notes.trim()) && timeEntries.length === 0 && signatures.length === 0 && voiceNotes.length === 0 && (
                <View style={styles.completionWarning}>
                  <View style={styles.completionWarningHeader}>
                    <Feather name="alert-triangle" size={20} color={colors.warning} />
                    <Text style={styles.completionWarningTitle}>No Documentation</Text>
                  </View>
                  <Text style={styles.completionWarningText}>
                    This job has no photos, notes, time tracked, signatures, or voice notes. Consider adding documentation before completing to keep accurate records.
                  </Text>
                </View>
              )}
          </View>
        </AppBottomSheet>
      )}

      {/* Next Job Modal */}
      <AppBottomSheet
        visible={showNextJobModal}
        onDismiss={() => setShowNextJobModal(false)}
        title={nextJob ? 'Next Job' : 'All Done!'}
        showCloseButton
        footer={(
          <TouchableOpacity
            style={{ backgroundColor: colors.muted, paddingVertical: spacing.md, borderRadius: 8, alignItems: 'center' }}
            onPress={() => setShowNextJobModal(false)}
          >
            <Text style={{ color: colors.foreground, fontWeight: fontWeights.semibold, fontSize: typography.button.fontSize }}>Dismiss</Text>
          </TouchableOpacity>
        )}>
        <View>
              {nextJob ? (
                <View style={{ gap: spacing.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center' }}>
                      <Feather name="briefcase" size={20} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: typography.subtitle.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground }}>{nextJob.title}</Text>
                      {nextJob.scheduledAt && (
                        <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground, marginTop: 2 }}>
                          {new Date(nextJob.scheduledAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      )}
                    </View>
                  </View>

                  {nextJobDriveInfo && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primary + '10', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: 8 }}>
                      <Feather name="navigation" size={16} color={colors.primary} />
                      <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.primary }}>
                        ~{nextJobDriveInfo.driveMinutes < 60
                          ? `${nextJobDriveInfo.driveMinutes} min`
                          : `${Math.floor(nextJobDriveInfo.driveMinutes / 60)}h ${nextJobDriveInfo.driveMinutes % 60}m`} drive
                        {nextJobDriveInfo.distanceKm < 1
                          ? ` (${Math.round(nextJobDriveInfo.distanceKm * 1000)}m)`
                          : ` (${nextJobDriveInfo.distanceKm} km)`}
                      </Text>
                    </View>
                  )}

                  {nextJob.address && (
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
                      <Feather name="map-pin" size={16} color={colors.mutedForeground} style={{ marginTop: 2 }} />
                      <Text style={{ fontSize: typography.button.fontSize, color: colors.foreground, flex: 1 }}>{nextJob.address}</Text>
                    </View>
                  )}

                  {(nextJob.clientName || nextJobClientPhone) && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <Feather name="user" size={16} color={colors.mutedForeground} />
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        {nextJob.clientName && (
                          <Text style={{ fontSize: typography.button.fontSize, color: colors.foreground }}>{nextJob.clientName}</Text>
                        )}
                        {nextJobClientPhone && (
                          <TouchableOpacity
                            onPress={() => Linking.openURL(`tel:${nextJobClientPhone.replace(/\s/g, '')}`)}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                          >
                            <Feather name="phone" size={13} color={colors.primary} />
                            <Text style={{ fontSize: typography.sizes.sm, color: colors.primary }}>{nextJobClientPhone}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  )}

                  {(nextJob.address || (nextJob.latitude && nextJob.longitude)) && (
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.success, paddingVertical: 14, borderRadius: 8, marginTop: spacing.xs }}
                      onPress={handleHeadToNextJob}
                      disabled={isHeadingToNext}
                    >
                      {isHeadingToNext ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <>
                          <Feather name="navigation" size={18} color={colors.white} />
                          <Text style={{ color: colors.white, fontWeight: fontWeights.bold, fontSize: typography.sizes.md }}>Head There Now</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.card, paddingVertical: spacing.sm, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}
                    onPress={() => {
                      setShowNextJobModal(false);
                      router.push(`/job/${nextJob.id}`);
                    }}
                  >
                    <Feather name="eye" size={16} color={colors.foreground} />
                    <Text style={{ color: colors.foreground, fontWeight: fontWeights.semibold, fontSize: typography.button.fontSize }}>View Job Details</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
                  <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: colors.success + '15', alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="check-circle" size={32} color={colors.success} />
                  </View>
                  <Text style={{ fontSize: typography.sizes.lg, fontWeight: fontWeights.semibold, color: colors.foreground }}>All done for today!</Text>
                  <Text style={{ fontSize: typography.button.fontSize, color: colors.mutedForeground, textAlign: 'center' }}>
                    No more scheduled jobs remaining. Great work!
                  </Text>
                </View>
          )}
        </View>
      </AppBottomSheet>

      {/* Schedule Job Modal */}
      <AppBottomSheet
        visible={showScheduleModal}
        onDismiss={() => setShowScheduleModal(false)}
        title="Schedule Job"
        showCloseButton
        footer={(
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: colors.muted,
                borderRadius: radius.lg,
                paddingVertical: spacing.md,
                alignItems: 'center',
              }}
              onPress={() => setShowScheduleModal(false)}
            >
              <Text style={{ color: colors.foreground, fontWeight: fontWeights.semibold, fontSize: typography.sizes.md }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: colors.primary,
                borderRadius: radius.lg,
                paddingVertical: spacing.md,
                alignItems: 'center',
              }}
              onPress={handleConfirmSchedule}
            >
              <Text style={{ color: colors.primaryForeground, fontWeight: fontWeights.semibold, fontSize: typography.sizes.md }}>Schedule Job</Text>
            </TouchableOpacity>
          </View>
        )}>
        <View>
              <Text style={{ fontSize: typography.button.fontSize, color: colors.foreground, marginBottom: spacing.md }}>
                Select date and time for this job:
              </Text>
              
              {/* Date Picker Button */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.background,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: spacing.md,
                  marginBottom: spacing.md,
                }}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setShowDatePicker(s => !s);
                }}
              >
                <Feather name="calendar" size={20} color={colors.primary} style={{ marginRight: spacing.md }} />
                <Text style={{ color: colors.foreground, flex: 1, fontSize: typography.sizes.md }}>
                  {scheduleDate.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
              
              {/* Time Picker Button */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.background,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: spacing.md,
                  marginBottom: spacing.lg,
                }}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setShowTimePicker(s => !s);
                }}
              >
                <Feather name="clock" size={20} color={colors.primary} style={{ marginRight: spacing.md }} />
                <Text style={{ color: colors.foreground, flex: 1, fontSize: typography.sizes.md }}>
                  {scheduleDate.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
              
              {/* Custom Date Picker */}
              {showDatePicker && (
                <View style={{ backgroundColor: colors.muted, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md }}>
                  <Text style={{ color: colors.foreground, fontWeight: fontWeights.semibold, marginBottom: spacing.sm, textAlign: 'center' }}>Select Date</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 180 }}>
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                      {Array.from({ length: 30 }, (_, i) => {
                        const date = new Date();
                        date.setDate(date.getDate() + i);
                        const isSelected = scheduleDate.toDateString() === date.toDateString();
                        return (
                          <TouchableOpacity
                            key={i}
                            onPress={() => {
                              const newDate = new Date(scheduleDate);
                              newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                              setScheduleDate(newDate);
                            }}
                            style={{
                              padding: spacing.md,
                              backgroundColor: isSelected ? colors.primary : colors.background,
                              borderRadius: radius.md,
                              minWidth: 70,
                              alignItems: 'center',
                            }}
                          >
                            <Text style={{ color: isSelected ? colors.primaryForeground : colors.mutedForeground, fontSize: typography.captionSmall.fontSize }}>
                              {date.toLocaleDateString('en-AU', { weekday: 'short' })}
                            </Text>
                            <Text style={{ color: isSelected ? colors.primaryForeground : colors.foreground, fontSize: typography.sizes.lg, fontWeight: fontWeights.bold }}>
                              {date.getDate()}
                            </Text>
                            <Text style={{ color: isSelected ? colors.primaryForeground : colors.mutedForeground, fontSize: typography.captionSmall.fontSize }}>
                              {date.toLocaleDateString('en-AU', { month: 'short' })}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                  <TouchableOpacity
                    style={{ backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.md, alignItems: 'center' }}
                    onPress={() => {
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setShowDatePicker(false);
                    }}
                  >
                    <Text style={{ color: colors.primaryForeground, fontWeight: fontWeights.semibold }}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}
              
              {/* Time Picker — iOS shows an inline spinner with a Done button;
                  Android shows a native modal dialog that closes itself, so we
                  MUST clear showTimePicker in onChange or it re-opens forever. */}
              {showTimePicker && (
                <View style={{ marginBottom: spacing.md }}>
                  <DateTimePicker
                    value={scheduleDate}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    minuteInterval={5}
                    onChange={(event, selectedDate) => {
                      setShowTimePicker(Platform.OS === 'ios');
                      if (event.type !== 'dismissed' && selectedDate) {
                        setScheduleDate(selectedDate);
                      }
                    }}
                    themeVariant={isDark ? 'dark' : 'light'}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity
                      style={{ backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' }}
                      onPress={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setShowTimePicker(false);
                      }}
                    >
                      <Text style={{ color: colors.primaryForeground, fontWeight: fontWeights.semibold }}>Done</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              
        </View>
      </AppBottomSheet>

      {/* Send Email/SMS Modal */}
      <MobileSendModal
        visible={showSendModal}
        onClose={() => setShowSendModal(false)}
        documentType="job"
        documentId={job?.id || id as string}
        recipientName={client?.name || 'Client'}
        recipientEmail={client?.email}
        recipientPhone={client?.phone}
        documentTitle={job?.title || 'Job Update'}
        defaultTab={sendModalDefaultTab}
        onSendSuccess={() => setShowSendModal(false)}
      />

      {/* Subcontractor Invite Modal */}
      <AppBottomSheet
        visible={showSubcontractorModal}
        onDismiss={() => setShowSubcontractorModal(false)}
        title="Invite Subcontractor"
        showCloseButton
        snapPoints={['90%']}
        footer={(
          <SheetButton
            fullWidth
            label="Send Invite"
            loading={isSavingSubcontractor}
            disabled={isSavingSubcontractor}
            onPress={handleInviteSubcontractor}
          />
        )}>
        <View>
                <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.mutedForeground, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                  Contact Details
                </Text>
                <TextInput
                  style={[styles.singleLineInput, { marginBottom: spacing.md }]}
                  placeholder="Name *"
                  placeholderTextColor={colors.mutedForeground}
                  value={subcontractorForm.contactName}
                  onChangeText={(t) => setSubcontractorForm(prev => ({ ...prev, contactName: t }))}
                />
                <TextInput
                  style={[styles.singleLineInput, { marginBottom: spacing.md }]}
                  placeholder="Phone number"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="phone-pad"
                  value={subcontractorForm.contactPhone}
                  onChangeText={(t) => setSubcontractorForm(prev => ({ ...prev, contactPhone: t }))}
                />
                <TextInput
                  style={[styles.singleLineInput, { marginBottom: spacing.lg }]}
                  placeholder="Email address"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={subcontractorForm.contactEmail}
                  onChangeText={(t) => setSubcontractorForm(prev => ({ ...prev, contactEmail: t }))}
                />

                <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.mutedForeground, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                  Send Via
                </Text>
                <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: colors.muted,
                      padding: spacing.md,
                      borderRadius: radius.lg,
                      gap: spacing.md,
                    }}
                    onPress={() => setSubcontractorForm(prev => ({ ...prev, sendViaSms: !prev.sendViaSms }))}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <Feather name="message-square" size={16} color={colors.foreground} />
                      <Text style={{ fontSize: typography.button.fontSize, color: colors.foreground }}>SMS</Text>
                    </View>
                    <Switch
                      value={subcontractorForm.sendViaSms}
                      onValueChange={(v) => setSubcontractorForm(prev => ({ ...prev, sendViaSms: v }))}
                      trackColor={{ false: colors.muted, true: colors.primary + '60' }}
                      thumbColor={'#FFFFFF'}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: colors.muted,
                      padding: spacing.md,
                      borderRadius: radius.lg,
                      gap: spacing.md,
                    }}
                    onPress={() => setSubcontractorForm(prev => ({ ...prev, sendViaEmail: !prev.sendViaEmail }))}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <Feather name="mail" size={16} color={colors.foreground} />
                      <Text style={{ fontSize: typography.button.fontSize, color: colors.foreground }}>Email</Text>
                    </View>
                    <Switch
                      value={subcontractorForm.sendViaEmail}
                      onValueChange={(v) => setSubcontractorForm(prev => ({ ...prev, sendViaEmail: v }))}
                      trackColor={{ false: colors.muted, true: colors.primary + '60' }}
                      thumbColor={'#FFFFFF'}
                    />
                  </TouchableOpacity>
                </View>

                <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.mutedForeground, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                  Permissions
                </Text>
                <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
                  {[
                    { key: 'view_job', label: 'View Job Details', icon: 'eye' as const },
                    { key: 'add_notes', label: 'Add Notes', icon: 'edit-3' as const },
                    { key: 'add_photos', label: 'Add Photos', icon: 'camera' as const },
                    { key: 'update_status', label: 'Update Status', icon: 'refresh-cw' as const },
                    { key: 'view_client', label: 'View Client Info', icon: 'user' as const },
                  ].map((perm) => (
                    <TouchableOpacity
                      key={perm.key}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: colors.muted,
                        padding: spacing.md,
                        borderRadius: radius.lg,
                        gap: spacing.md,
                      }}
                      onPress={() => toggleSubcontractorPermission(perm.key)}
                      activeOpacity={0.7}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        <Feather name={perm.icon} size={16} color={colors.foreground} />
                        <Text style={{ fontSize: typography.button.fontSize, color: colors.foreground }}>{perm.label}</Text>
                      </View>
                      <Switch
                        value={subcontractorForm.permissions.includes(perm.key)}
                        onValueChange={() => toggleSubcontractorPermission(perm.key)}
                        trackColor={{ false: colors.muted, true: colors.primary + '60' }}
                        thumbColor={'#FFFFFF'}
                      />
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.mutedForeground, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                  Expires After
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl }}>
                  {[
                    { value: '7', label: '7 days' },
                    { value: '30', label: '30 days' },
                    { value: '0', label: 'Never' },
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={{
                        flex: 1,
                        paddingVertical: spacing.md,
                        borderRadius: radius.lg,
                        alignItems: 'center',
                        backgroundColor: subcontractorForm.expiryDays === option.value ? colors.primary : colors.muted,
                        borderWidth: 1,
                        borderColor: subcontractorForm.expiryDays === option.value ? colors.primary : colors.border,
                      }}
                      onPress={() => setSubcontractorForm(prev => ({ ...prev, expiryDays: option.value }))}
                      activeOpacity={0.7}
                    >
                      <Text style={{
                        fontSize: typography.sizes.sm,
                        fontWeight: fontWeights.semibold,
                        color: subcontractorForm.expiryDays === option.value ? colors.primaryForeground : colors.foreground,
                      }}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

        </View>
      </AppBottomSheet>

      {/* Template Picker Modal */}
      <AppBottomSheet
        visible={showTemplatePickerModal}
        onDismiss={() => setShowTemplatePickerModal(false)}
        title="Choose Template"
        showCloseButton
        footer={(
          <TouchableOpacity
            style={{
              paddingVertical: spacing.md,
              borderRadius: radius.lg,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: colors.border,
            }}
            onPress={() => setShowTemplatePickerModal(false)}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: typography.sizes.md, fontWeight: fontWeights.semibold, color: colors.foreground }}>Cancel</Text>
          </TouchableOpacity>
        )}
      >
        <View>
              <PressableRow
                style={[styles.card, { marginBottom: spacing.sm }]}
                onPress={handleStartBlankSwms}

              >
                <View style={[styles.cardIconContainer, { backgroundColor: `${colors.primary}15` }]}>
                  <Feather name="file-plus" size={iconSizes.lg} color={colors.primary} />
                </View>
                <View style={styles.cardContent}>
                  <Text style={[styles.cardValue, { fontWeight: fontWeights.semibold }]}>Blank SWMS</Text>
                  <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground }}>Start from scratch</Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </PressableRow>

              {isLoadingTemplates ? (
                <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : (
                swmsTemplates.map((template) => (
                  <PressableRow
                    key={template.id}
                    style={[styles.card, { marginBottom: spacing.sm }]}
                    onPress={() => handleSelectTemplate(template)}

                  >
                    <View style={[styles.cardIconContainer, { backgroundColor: `${colors.warning}15` }]}>
                      <Feather name="clipboard" size={iconSizes.lg} color={colors.warning} />
                    </View>
                    <View style={styles.cardContent}>
                      <Text style={[styles.cardValue, { fontWeight: fontWeights.semibold }]}>{template.title}</Text>
                      {template.description && (
                        <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground }} numberOfLines={2}>
                          {template.description}
                        </Text>
                      )}
                    </View>
                    <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
                  </PressableRow>
                ))
              )}
        </View>
      </AppBottomSheet>

      {/* Create SWMS Modal */}
      <AppBottomSheet
        visible={showCreateSwmsModal}
        onDismiss={() => setShowCreateSwmsModal(false)}
        title="Create SWMS"
        showCloseButton
        snapPoints={['90%']}
        footer={(
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <SheetButton variant="outline" label="Cancel" onPress={() => setShowCreateSwmsModal(false)} style={{ flex: 1 }} />
            <SheetButton onPress={handleCreateSwms} loading={isSavingSwms} disabled={isSavingSwms || !swmsForm.title.trim()} label="Create SWMS" style={{ flex: 1 }} />
          </View>
        )}>
        <View>
                <Text style={[styles.cardLabel, { marginBottom: spacing.xs }]}>Title *</Text>
                <TextInput
                  style={[styles.singleLineInput, { marginBottom: spacing.md }]}
                  value={swmsForm.title}
                  onChangeText={v => setSwmsForm(f => ({ ...f, title: v }))}
                  placeholder="e.g. Working at Heights - Roof Repair"
                  placeholderTextColor={colors.mutedForeground}
                />

                <Text style={[styles.cardLabel, { marginBottom: spacing.xs }]}>Work Activity Description</Text>
                <TextInput
                  style={[styles.notesInput, { marginBottom: spacing.md, minHeight: 80 }]}
                  value={swmsForm.workActivityDescription}
                  onChangeText={v => setSwmsForm(f => ({ ...f, workActivityDescription: v }))}
                  placeholder="Describe the work activities..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={3}
                />

                <Text style={[styles.cardLabel, { marginBottom: spacing.xs }]}>Site Address</Text>
                <TextInput
                  style={[styles.singleLineInput, { marginBottom: spacing.md }]}
                  value={swmsForm.siteAddress}
                  onChangeText={v => setSwmsForm(f => ({ ...f, siteAddress: v }))}
                  placeholder="Job site address"
                  placeholderTextColor={colors.mutedForeground}
                />

                <Text style={[styles.cardLabel, { marginBottom: spacing.sm }]}>PPE Requirements</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }}>
                  {PPE_OPTIONS.map((ppe) => {
                    const isSelected = swmsForm.ppeRequirements.includes(ppe.key);
                    return (
                      <TouchableOpacity
                        key={ppe.key}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingHorizontal: spacing.md,
                          paddingVertical: spacing.sm,
                          borderRadius: radius.lg,
                          backgroundColor: isSelected ? `${colors.primary}15` : colors.muted,
                          borderWidth: 1,
                          borderColor: isSelected ? colors.primary : colors.border,
                          gap: spacing.xs,
                        }}
                        onPress={() => togglePpe(ppe.key)}
                        activeOpacity={0.7}
                      >
                        <Feather
                          name={isSelected ? 'check-square' : 'square'}
                          size={16}
                          color={isSelected ? colors.primary : colors.mutedForeground}
                        />
                        <Text style={{
                          fontSize: typography.sizes.sm,
                          fontWeight: isSelected ? '600' : '400',
                          color: isSelected ? colors.primary : colors.foreground,
                        }}>
                          {ppe.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardLabel, { marginBottom: spacing.xs }]}>Emergency Contact</Text>
                    <TextInput
                      style={styles.singleLineInput}
                      value={swmsForm.emergencyContact}
                      onChangeText={v => setSwmsForm(f => ({ ...f, emergencyContact: v }))}
                      placeholder="000 or site contact"
                      placeholderTextColor={colors.mutedForeground}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardLabel, { marginBottom: spacing.xs }]}>First Aid Location</Text>
                    <TextInput
                      style={styles.singleLineInput}
                      value={swmsForm.firstAidLocation}
                      onChangeText={v => setSwmsForm(f => ({ ...f, firstAidLocation: v }))}
                      placeholder="e.g. Site office"
                      placeholderTextColor={colors.mutedForeground}
                    />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                  <Text style={[styles.cardLabel, { marginBottom: 0 }]}>Hazards</Text>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 4,
                      borderRadius: radius.md,
                      backgroundColor: `${colors.primary}15`,
                      gap: 4,
                    }}
                    onPress={addHazardRow}
                    activeOpacity={0.7}
                  >
                    <Feather name="plus" size={14} color={colors.primary} />
                    <Text style={{ fontSize: typography.captionSmall.fontSize, fontWeight: fontWeights.semibold, color: colors.primary }}>Add Hazard</Text>
                  </TouchableOpacity>
                </View>

                {swmsForm.hazards.map((hazard, idx) => (
                  <View key={idx} style={{
                    backgroundColor: colors.muted,
                    borderRadius: radius.lg,
                    padding: spacing.md,
                    marginBottom: spacing.sm,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                      <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.foreground }}>Hazard {idx + 1}</Text>
                      <TouchableOpacity onPress={() => removeHazardRow(idx)}>
                        <Feather name="trash-2" size={16} color={colors.destructive} />
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={[styles.singleLineInput, { marginBottom: spacing.sm, backgroundColor: colors.background }]}
                      value={hazard.hazardDescription}
                      onChangeText={v => updateHazardRow(idx, 'hazardDescription', v)}
                      placeholder="Describe the hazard"
                      placeholderTextColor={colors.mutedForeground}
                    />
                    <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground, marginBottom: 4 }}>Likelihood</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                          {['rare', 'unlikely', 'possible', 'likely', 'almost_certain'].map(opt => (
                            <TouchableOpacity
                              key={opt}
                              style={{
                                paddingHorizontal: 6,
                                paddingVertical: 3,
                                borderRadius: radius.sm,
                                backgroundColor: hazard.riskLikelihood === opt ? colors.primary : colors.background,
                                borderWidth: 1,
                                borderColor: hazard.riskLikelihood === opt ? colors.primary : colors.border,
                              }}
                              onPress={() => updateHazardRow(idx, 'riskLikelihood', opt)}
                              activeOpacity={0.7}
                            >
                              <Text style={{
                                fontSize: typography.sizes.xs,
                                fontWeight: hazard.riskLikelihood === opt ? '600' : '400',
                                color: hazard.riskLikelihood === opt ? colors.primaryForeground : colors.foreground,
                                textTransform: 'capitalize',
                              }}>
                                {opt.replace('_', ' ')}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    </View>
                    <View style={{ marginBottom: spacing.sm }}>
                      <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground, marginBottom: 4 }}>Consequence</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                        {['insignificant', 'minor', 'moderate', 'major', 'catastrophic'].map(opt => (
                          <TouchableOpacity
                            key={opt}
                            style={{
                              paddingHorizontal: 6,
                              paddingVertical: 3,
                              borderRadius: radius.sm,
                              backgroundColor: hazard.riskConsequence === opt ? colors.primary : colors.background,
                              borderWidth: 1,
                              borderColor: hazard.riskConsequence === opt ? colors.primary : colors.border,
                            }}
                            onPress={() => updateHazardRow(idx, 'riskConsequence', opt)}
                            activeOpacity={0.7}
                          >
                            <Text style={{
                              fontSize: typography.sizes.xs,
                              fontWeight: hazard.riskConsequence === opt ? '600' : '400',
                              color: hazard.riskConsequence === opt ? colors.primaryForeground : colors.foreground,
                              textTransform: 'capitalize',
                            }}>
                              {opt}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    <TextInput
                      style={[styles.singleLineInput, { marginBottom: spacing.sm, backgroundColor: colors.background }]}
                      value={hazard.controlMeasures}
                      onChangeText={v => updateHazardRow(idx, 'controlMeasures', v)}
                      placeholder="Control measures"
                      placeholderTextColor={colors.mutedForeground}
                    />
                    <TextInput
                      style={[styles.singleLineInput, { backgroundColor: colors.background }]}
                      value={hazard.responsiblePerson}
                      onChangeText={v => updateHazardRow(idx, 'responsiblePerson', v)}
                      placeholder="Responsible person"
                      placeholderTextColor={colors.mutedForeground}
                    />
                  </View>
                ))}

                {swmsForm.hazards.length === 0 && (
                  <View style={{ alignItems: 'center', paddingVertical: spacing.md, marginBottom: spacing.md }}>
                    <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground }}>
                      No hazards added yet. Tap "Add Hazard" above.
                    </Text>
                  </View>
                )}

        </View>
      </AppBottomSheet>

      {/* Sign SWMS Modal */}
      <AppBottomSheet
        visible={showSignSwmsModal}
        onDismiss={() => { setShowSignSwmsModal(false); setSigningSwmsId(null); setSwmsSignatureData(null); }}
        title="Sign SWMS"
        showCloseButton
        snapPoints={['90%']}
        footer={(
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <SheetButton variant="outline" label="Cancel" onPress={() => { setShowSignSwmsModal(false); setSigningSwmsId(null); setSwmsSignatureData(null); }} style={{ flex: 1 }} />
            <SheetButton onPress={handleSignSwms} loading={isSigningSwms} disabled={isSigningSwms || !signWorkerName.trim() || !swmsSignatureData} label="Sign SWMS" style={{ flex: 1 }} />
          </View>
        )}>
        <View>
                <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground, textAlign: 'center', marginBottom: spacing.md }}>
                  By signing, you confirm you have read and understood the Safe Work Method Statement.
                </Text>
                <Text style={[styles.cardLabel, { marginBottom: spacing.xs }]}>Worker Name *</Text>
                <TextInput
                  style={[styles.singleLineInput, { marginBottom: spacing.md }]}
                  value={signWorkerName}
                  onChangeText={setSignWorkerName}
                  placeholder="Enter your full name"
                  placeholderTextColor={colors.mutedForeground}
                />
                <Text style={[styles.cardLabel, { marginBottom: spacing.xs }]}>Signature *</Text>
                <View style={{ borderWidth: 1, borderColor: swmsSignatureData ? colors.primary : colors.border, borderRadius: radius.lg, overflow: 'hidden', height: 160, marginBottom: spacing.sm, backgroundColor: '#ffffff' }}>
                  <WebView
                    ref={swmsSignWebViewRef}
                    style={{ flex: 1, backgroundColor: 'transparent' }}
                    scrollEnabled={false}
                    bounces={false}
                    originWhitelist={['*']}
                    source={{ html: `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>*{margin:0;padding:0}html,body{width:100%;height:100%;overflow:hidden;touch-action:none;background:#fff}canvas{width:100%;height:100%;touch-action:none}</style></head><body><canvas id="c"></canvas><script>const c=document.getElementById('c');const ctx=c.getContext('2d');let drawing=false,hasDrawn=false,lx=0,ly=0;function resize(){c.width=c.offsetWidth*2;c.height=c.offsetHeight*2;ctx.scale(2,2);ctx.lineWidth=2.5;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#1e293b'}resize();window.onresize=resize;function gp(e){const r=c.getBoundingClientRect();const t=e.touches?e.touches[0]:e;return{x:t.clientX-r.left,y:t.clientY-r.top}}c.addEventListener('touchstart',function(e){e.preventDefault();drawing=true;const p=gp(e);lx=p.x;ly=p.y},{passive:false});c.addEventListener('touchmove',function(e){if(!drawing)return;e.preventDefault();const p=gp(e);ctx.beginPath();ctx.moveTo(lx,ly);ctx.lineTo(p.x,p.y);ctx.stroke();lx=p.x;ly=p.y;if(!hasDrawn){hasDrawn=true;window.ReactNativeWebView.postMessage(JSON.stringify({type:'started'}))}},{passive:false});c.addEventListener('touchend',function(){drawing=false;if(hasDrawn){const d=c.toDataURL('image/png');window.ReactNativeWebView.postMessage(JSON.stringify({type:'sig',data:d}))}});c.addEventListener('mousedown',function(e){drawing=true;const p=gp(e);lx=p.x;ly=p.y});c.addEventListener('mousemove',function(e){if(!drawing)return;const p=gp(e);ctx.beginPath();ctx.moveTo(lx,ly);ctx.lineTo(p.x,p.y);ctx.stroke();lx=p.x;ly=p.y;if(!hasDrawn){hasDrawn=true;window.ReactNativeWebView.postMessage(JSON.stringify({type:'started'}))}});c.addEventListener('mouseup',function(){drawing=false;if(hasDrawn){const d=c.toDataURL('image/png');window.ReactNativeWebView.postMessage(JSON.stringify({type:'sig',data:d}))}});function clearSig(){ctx.clearRect(0,0,c.width,c.height);hasDrawn=false;window.ReactNativeWebView.postMessage(JSON.stringify({type:'cleared'}))}</script></body></html>` }}
                    onMessage={(event: any) => {
                      try {
                        const msg = JSON.parse(event.nativeEvent.data);
                        if (msg.type === 'sig') {
                          setSwmsSignatureData(msg.data);
                        } else if (msg.type === 'cleared') {
                          setSwmsSignatureData(null);
                        }
                      } catch (e) {
                        if (__DEV__) console.warn('Failed to parse SWMS signature WebView message:', e);
                      }
                    }}
                  />
                </View>
                <TouchableOpacity
                  onPress={() => {
                    swmsSignWebViewRef.current?.injectJavaScript('clearSig(); true;');
                    setSwmsSignatureData(null);
                  }}
                  style={{ alignSelf: 'flex-end', marginBottom: spacing.md }}
                >
                  <Text style={{ fontSize: typography.sizes.sm, color: colors.primary, fontWeight: fontWeights.medium }}>Clear Signature</Text>
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: `${colors.primary}10`, padding: spacing.md, borderRadius: radius.lg }}>
                  <Feather name="map-pin" size={16} color={colors.primary} />
                  <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground, flex: 1 }}>
                    GPS location will be recorded with your signature
                  </Text>
                </View>
        </View>
      </AppBottomSheet>

      {/* Proof Pack Section Toggle Modal */}
      <AppBottomSheet
        visible={showProofPackModal}
        onDismiss={() => setShowProofPackModal(false)}
        title="Proof Pack"
        showCloseButton
        snapPoints={['90%']}
        footer={(
          <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <TouchableOpacity
              onPress={() => setShowProofPackModal(false)}
              style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.md }}
            >
              <Text style={{ color: colors.mutedForeground, fontWeight: fontWeights.semibold, fontSize: typography.button.fontSize }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.xs,
                paddingVertical: spacing.sm + 2,
                paddingHorizontal: spacing.md,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.primary,
                opacity: isLoadingProofPackPreview || !Object.values(proofPackSections).some(Boolean) ? 0.5 : 1,
                minHeight: 44,
              }}
              onPress={handleLoadProofPackPreview}
              activeOpacity={0.8}
              disabled={isLoadingProofPackPreview || !Object.values(proofPackSections).some(Boolean)}
            >
              {isLoadingProofPackPreview ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Feather name="eye" size={15} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontWeight: fontWeights.semibold, fontSize: typography.sizes.sm }}>Preview</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.sm,
                backgroundColor: colors.primary,
                paddingVertical: spacing.md,
                borderRadius: radius.md,
                opacity: isGeneratingProofPack || !Object.values(proofPackSections).some(Boolean) ? 0.5 : 1,
                minHeight: 44,
              }}
              onPress={handleGenerateProofPack}
              activeOpacity={0.8}
              disabled={isGeneratingProofPack || !Object.values(proofPackSections).some(Boolean)}
            >
              {isGeneratingProofPack ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <>
                  <Feather name="download" size={16} color={colors.primaryForeground} />
                  <Text style={{ color: colors.primaryForeground, fontWeight: fontWeights.semibold, fontSize: typography.button.fontSize }}>
                    Generate PDF
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              paddingVertical: spacing.md,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              opacity: isExportingProofPackTsv || !Object.values(proofPackSections).some(Boolean) ? 0.5 : 1,
              minHeight: 44,
            }}
            onPress={handleExportProofPackTsv}
            activeOpacity={0.8}
            disabled={isExportingProofPackTsv || !Object.values(proofPackSections).some(Boolean)}
          >
            {isExportingProofPackTsv ? (
              <ActivityIndicator size="small" color={colors.foreground} />
            ) : (
              <>
                <Feather name="grid" size={15} color={colors.foreground} />
                <Text style={{ color: colors.foreground, fontWeight: fontWeights.semibold, fontSize: typography.button.fontSize }}>
                  Export for Excel (TSV)
                </Text>
              </>
            )}
          </TouchableOpacity>
          </View>
        )}>
        <View>
              <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground, marginBottom: spacing.md, lineHeight: 19 }}>
                Choose which sections to include in your Proof Pack PDF. Toggle off any sections you don't need.
              </Text>
              {([
                { key: 'timeline' as const, label: 'Job Timeline', icon: 'clock' as const, desc: 'Created, scheduled, started & completed dates' },
                { key: 'attendance' as const, label: 'Worker Hours', icon: 'users' as const, desc: 'Time entries and duration per worker' },
                { key: 'gpsProof' as const, label: 'GPS Verification', icon: 'map-pin' as const, desc: 'Clock-in/out locations and geofence alerts' },
                { key: 'materials' as const, label: 'Materials & Costs', icon: 'package' as const, desc: 'Materials used with quantities and costs' },
                { key: 'photos' as const, label: 'Photos', icon: 'camera' as const, desc: 'Before/after photos with GPS badges' },
                { key: 'invoice' as const, label: 'Invoice Summary', icon: 'file-text' as const, desc: 'Invoice details and payment status' },
                { key: 'compliance' as const, label: 'Compliance & Licensing', icon: 'shield' as const, desc: 'Trade licences, insurance & certifications' },
                { key: 'subcontractors' as const, label: 'Subcontractors', icon: 'hard-hat' as const, desc: 'Subcontractor invites and activity' },
                { key: 'swms' as const, label: 'Safety & SWMS', icon: 'alert-triangle' as const, desc: 'Safe Work Method Statements & safety checklists' },
                { key: 'forms' as const, label: 'Job Cards & Forms', icon: 'clipboard' as const, desc: 'Completed job cards and forms with who filled them in' },
              ]).map(({ key, label, icon, desc }) => (
                <TouchableOpacity
                  key={key}
                  activeOpacity={0.7}
                  onPress={() => setProofPackSections(prev => ({ ...prev, [key]: !prev[key] }))}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: spacing.sm + 2,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: proofPackSections[key] ? `${colors.primary}15` : `${colors.mutedForeground}10`,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: spacing.sm + 2,
                  }}>
                    <Feather
                      name={icon === 'hard-hat' ? 'tool' : icon}
                      size={18}
                      color={proofPackSections[key] ? colors.primary : colors.mutedForeground}
                    />
                  </View>
                  <View style={{ flex: 1, marginRight: spacing.sm }}>
                    <Text style={{
                      fontSize: typography.button.fontSize,
                      fontWeight: fontWeights.semibold,
                      color: proofPackSections[key] ? colors.foreground : colors.mutedForeground,
                    }}>
                      {label}
                    </Text>
                    <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, marginTop: 1 }}>
                      {desc}
                    </Text>
                  </View>
                  <Switch
                    value={proofPackSections[key]}
                    onValueChange={(val) => setProofPackSections(prev => ({ ...prev, [key]: val }))}
                    trackColor={{ false: colors.border, true: `${colors.primary}80` }}
                    thumbColor={'#FFFFFF'}
                  />
                </TouchableOpacity>
              ))}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md, gap: spacing.sm }}>
                <TouchableOpacity
                  onPress={() => setProofPackSections({ timeline: true, attendance: true, gpsProof: true, materials: true, photos: true, invoice: true, compliance: true, subcontractors: true, swms: true, forms: true })}
                  style={{ paddingVertical: spacing.xs, paddingHorizontal: spacing.sm }}
                >
                  <Text style={{ fontSize: typography.sizes.sm, color: colors.primary, fontWeight: fontWeights.semibold }}>Select All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setProofPackSections({ timeline: false, attendance: false, gpsProof: false, materials: false, photos: false, invoice: false, compliance: false, subcontractors: false, swms: false, forms: false })}
                  style={{ paddingVertical: spacing.xs, paddingHorizontal: spacing.sm }}
                >
                  <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground, fontWeight: fontWeights.semibold }}>Deselect All</Text>
                </TouchableOpacity>
              </View>
        </View>
      </AppBottomSheet>

      {/* Proof Pack Preview Modal */}
      <AppBottomSheet
        visible={showProofPackPreview}
        onDismiss={() => setShowProofPackPreview(false)}
        title="Proof Pack Preview"
        showCloseButton
        snapPoints={['90%']}

        scrollable={false}
        contentPadding={0}
        footer={(
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TouchableOpacity
              onPress={() => {
                setShowProofPackPreview(false);
                setTimeout(() => setShowProofPackModal(true), 300);
              }}
              style={{
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.lg,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              activeOpacity={0.7}
            >
              <Text style={{ color: colors.foreground, fontWeight: fontWeights.semibold, fontSize: typography.button.fontSize }}>Edit Sections</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.sm,
                backgroundColor: colors.primary,
                paddingVertical: spacing.md,
                borderRadius: radius.lg,
                opacity: isGeneratingProofPack ? 0.5 : 1,
                minHeight: 44,
              }}
              onPress={() => {
                setShowProofPackPreview(false);
                handleGenerateProofPack();
              }}
              activeOpacity={0.8}
              disabled={isGeneratingProofPack}
            >
              {isGeneratingProofPack ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <>
                  <Feather name="download" size={16} color={colors.primaryForeground} />
                  <Text style={{ color: colors.primaryForeground, fontWeight: fontWeights.semibold, fontSize: typography.button.fontSize }}>
                    Download & Share
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      >
        <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
          {proofPackPreviewHtml ? (
            <WebView
              source={{ html: proofPackPreviewHtml }}
              style={{ flex: 1, backgroundColor: '#ffffff' }}
              scalesPageToFit
              javaScriptEnabled
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}
        </View>
      </AppBottomSheet>

      {/* Job Card Preview Modal */}
      <AppBottomSheet
        visible={showJobCardPreview}
        onDismiss={() => setShowJobCardPreview(false)}
        title="Job Card Preview"
        showCloseButton
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}
        footer={(
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              backgroundColor: colors.primary,
              paddingVertical: spacing.md,
              borderRadius: radius.lg,
              opacity: isExportingJobCard ? 0.5 : 1,
              minHeight: 44,
            }}
            onPress={() => {
              setShowJobCardPreview(false);
              handleDownloadJobCard();
            }}
            activeOpacity={0.8}
            disabled={isExportingJobCard}
          >
            {isExportingJobCard ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <>
                <Feather name="download" size={16} color={colors.primaryForeground} />
                <Text style={{ color: colors.primaryForeground, fontWeight: fontWeights.semibold, fontSize: typography.button.fontSize }}>
                  Download & Share
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      >
        <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
          {jobCardPreviewHtml ? (
            <WebView
              source={{ html: jobCardPreviewHtml }}
              style={{ flex: 1, backgroundColor: '#ffffff' }}
              scalesPageToFit
              javaScriptEnabled={false}
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}
        </View>
      </AppBottomSheet>

      {/* Add Variation Modal */}
      <AppBottomSheet
        visible={showAddVariationModal}
        onDismiss={() => setShowAddVariationModal(false)}
        title="Add Variation"
        showCloseButton
        snapPoints={['85%']}
        footer={(
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <TouchableOpacity
              onPress={() => setShowAddVariationModal(false)}
              style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.md }}
            >
              <Text style={{ color: colors.mutedForeground, fontWeight: fontWeights.semibold, fontSize: typography.button.fontSize }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.primary,
                paddingVertical: spacing.md,
                borderRadius: radius.md,
                opacity: (!variationForm.title.trim() || !variationForm.amount.trim() || isSavingVariation) ? 0.5 : 1,
                minHeight: 44,
              }}
              onPress={handleCreateVariation}
              activeOpacity={0.8}
              disabled={!variationForm.title.trim() || !variationForm.amount.trim() || isSavingVariation}
            >
              {isSavingVariation ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Text style={{ color: colors.primaryForeground, fontWeight: fontWeights.semibold, fontSize: typography.button.fontSize }}>Create Variation</Text>
              )}
            </TouchableOpacity>
          </View>
        )}>
        <View>
                <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground, marginBottom: spacing.xs }}>Title *</Text>
                <TextInput
                  style={styles.singleLineInput}
                  value={variationForm.title}
                  onChangeText={(t) => setVariationForm(prev => ({ ...prev, title: t }))}
                  placeholder="e.g. Additional plumbing work"
                  placeholderTextColor={colors.mutedForeground}
                />
                <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground, marginBottom: spacing.xs, marginTop: spacing.md }}>Description</Text>
                <TextInput
                  style={[styles.notesInput, { minHeight: 80 }]}
                  value={variationForm.description}
                  onChangeText={(t) => setVariationForm(prev => ({ ...prev, description: t }))}
                  placeholder="Describe the scope change..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                />
                <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground, marginBottom: spacing.xs, marginTop: spacing.md }}>Reason</Text>
                <TextInput
                  style={styles.singleLineInput}
                  value={variationForm.reason}
                  onChangeText={(t) => setVariationForm(prev => ({ ...prev, reason: t }))}
                  placeholder="Why is this change needed?"
                  placeholderTextColor={colors.mutedForeground}
                />
                <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground, marginBottom: spacing.xs, marginTop: spacing.md }}>Amount (ex GST) *</Text>
                <TextInput
                  style={styles.singleLineInput}
                  value={variationForm.amount}
                  onChangeText={(t) => setVariationForm(prev => ({ ...prev, amount: t }))}
                  placeholder="0.00"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                />
                {variationForm.amount ? (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm, paddingHorizontal: spacing.xs }}>
                    <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground }}>
                      GST (10%): ${((parseFloat(variationForm.amount) || 0) * 0.1).toFixed(2)}
                    </Text>
                    <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.bold, color: colors.foreground }}>
                      Total: ${((parseFloat(variationForm.amount) || 0) * 1.1).toFixed(2)}
                    </Text>
                  </View>
                ) : null}
        </View>
      </AppBottomSheet>

      {/* Approve Variation Modal */}
      <AppBottomSheet
        visible={!!showApproveVariationModal}
        onDismiss={() => setShowApproveVariationModal(null)}
        title="Approve Variation"
        showCloseButton
        snapPoints={['85%']}
        footer={(
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <TouchableOpacity
              onPress={() => setShowApproveVariationModal(null)}
              style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.md }}
            >
              <Text style={{ color: colors.mutedForeground, fontWeight: fontWeights.semibold, fontSize: typography.button.fontSize }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.success,
                paddingVertical: spacing.md,
                borderRadius: radius.md,
                opacity: (!approveVariationName.trim() || isApprovingVariation) ? 0.5 : 1,
                minHeight: 44,
              }}
              onPress={handleApproveVariation}
              activeOpacity={0.8}
              disabled={!approveVariationName.trim() || isApprovingVariation}
            >
              {isApprovingVariation ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Text style={{ color: colors.primaryForeground, fontWeight: fontWeights.semibold, fontSize: typography.button.fontSize }}>Approve</Text>
              )}
            </TouchableOpacity>
          </View>
        )}>
        <View>
          <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground, marginBottom: spacing.xs }}>Approver Name *</Text>
          <TextInput
            style={styles.singleLineInput}
            value={approveVariationName}
            onChangeText={setApproveVariationName}
            placeholder="Enter name of person approving"
            placeholderTextColor={colors.mutedForeground}
          />
          <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground, marginBottom: spacing.xs, marginTop: spacing.md }}>Signature</Text>
          <View style={{ borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
            <SignaturePad
              onSave={(data) => setApproveVariationSignature(data)}
              height={200}
            />
          </View>
        </View>
      </AppBottomSheet>

      {/* Reject Variation Modal */}
      <AppBottomSheet
        visible={!!showRejectVariationModal}
        onDismiss={() => setShowRejectVariationModal(null)}
        title="Reject Variation"
        showCloseButton
        footer={(
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <TouchableOpacity
              onPress={() => setShowRejectVariationModal(null)}
              style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.md }}
            >
              <Text style={{ color: colors.mutedForeground, fontWeight: fontWeights.semibold, fontSize: typography.button.fontSize }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.destructive,
                paddingVertical: spacing.md,
                borderRadius: radius.md,
                opacity: isRejectingVariation ? 0.5 : 1,
                minHeight: 44,
              }}
              onPress={handleRejectVariation}
              activeOpacity={0.8}
              disabled={isRejectingVariation}
            >
              {isRejectingVariation ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Text style={{ color: colors.primaryForeground, fontWeight: fontWeights.semibold, fontSize: typography.button.fontSize }}>Reject</Text>
              )}
            </TouchableOpacity>
          </View>
        )}>
        <View>
          <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground, marginBottom: spacing.xs }}>Reason for Rejection</Text>
          <TextInput
            style={[styles.notesInput, { minHeight: 100 }]}
            value={rejectVariationReason}
            onChangeText={setRejectVariationReason}
            placeholder="Explain why this variation is rejected..."
            placeholderTextColor={colors.mutedForeground}
            multiline
          />
        </View>
      </AppBottomSheet>
    </>
  );
}
