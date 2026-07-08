import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Modal,
  Image,
  Dimensions,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from './ui/PressableRow';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import api from '../lib/api';
import { useTheme, ThemeColors } from '../lib/theme';
import { AppBottomSheet } from './ui/AppBottomSheet';
import { spacing, radius, typography } from '../lib/design-tokens';

interface Photo {
  id: string;
  url?: string;
  signedUrl?: string;
  thumbnailUrl?: string;
  mimeType?: string;
  fileName?: string;
}

// Helper to detect videos by mimeType or filename extension
const isVideo = (photo: Photo): boolean => {
  if (photo.mimeType?.startsWith('video/')) return true;
  const ext = photo.fileName?.split('.').pop()?.toLowerCase() || '';
  return ['mp4', 'mov', 'avi', 'webm', 'm4v', '3gp'].includes(ext);
};

interface AIPhotoAnalysisModalProps {
  visible: boolean;
  onClose: () => void;
  jobId: string;
  photos: Photo[];
  existingNotes?: string;
  onNotesUpdated?: () => void;
  aiEnabled?: boolean;
  aiPhotoAnalysisEnabled?: boolean;
}

const { width: screenWidth } = Dimensions.get('window');
const photoSize = (screenWidth - spacing.lg * 2 - spacing.sm * 2) / 3;

export function AIPhotoAnalysisModal({
  visible,
  onClose,
  jobId,
  photos,
  existingNotes,
  onNotesUpdated,
  aiEnabled = true,
  aiPhotoAnalysisEnabled = true,
}: AIPhotoAnalysisModalProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  
  // Filter to only image photos (not videos)
  const imagePhotos = photos.filter(p => !isVideo(p));
  
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [analysisText, setAnalysisText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [isAddingToNotes, setIsAddingToNotes] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isAbortedRef = useRef(false);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedPhotoIds(new Set());
      setAnalysisText('');
      setIsComplete(false);
      setIsAnalysing(false);
    }
  }, [visible]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const togglePhotoSelection = (photoId: string) => {
    setSelectedPhotoIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else if (newSet.size < 10) {
        newSet.add(photoId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    const allIds = imagePhotos.slice(0, 10).map(p => p.id);
    setSelectedPhotoIds(new Set(allIds));
  };

  const deselectAll = () => {
    setSelectedPhotoIds(new Set());
  };

  const startAnalysis = useCallback(async () => {
    if (isAnalysing || selectedPhotoIds.size === 0) return;
    
    setIsAnalysing(true);
    setAnalysisText('');
    setIsComplete(false);
    isAbortedRef.current = false;
    
    abortControllerRef.current = new AbortController();
    
    try {
      const token = await api.getToken();
      const baseUrl = api.getBaseUrl();
      
      // Include selected photo IDs in the request
      // Use noStream=true for React Native (no ReadableStream support)
      const photoIdsParam = Array.from(selectedPhotoIds).join(',');
      const url = `${baseUrl}/api/jobs/${jobId}/photos/analyze?photoIds=${encodeURIComponent(photoIdsParam)}&noStream=true`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to analyse photos');
      }

      // Non-streaming response: get JSON directly
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      if (data.text) {
        setAnalysisText(data.text);
      }
      
      if (data.done) {
        setIsComplete(true);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return;
      }
      if (__DEV__) console.error('Photo analysis error:', error);
      Alert.alert('Analysis Failed', error.message || 'Failed to analyse photos. Please try again.');
    } finally {
      if (!isAbortedRef.current) {
        setIsAnalysing(false);
      }
    }
  }, [jobId, selectedPhotoIds, isAnalysing]);

  const cancelAnalysis = useCallback(() => {
    isAbortedRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsAnalysing(false);
    setAnalysisText('');
  }, []);

  const addToNotes = useCallback(async () => {
    if (!analysisText || isAddingToNotes) return;
    
    setIsAddingToNotes(true);
    try {
      // Notes live in the structured job_notes table — the legacy jobs.notes
      // field is ignored by the server on PATCH.
      const res = await api.post(`/api/jobs/${jobId}/notes`, {
        content: `--- AI Photo Analysis ---\n${analysisText}`,
      });

      if (res.error) {
        throw new Error('Failed to update notes');
      }

      Alert.alert('Success', 'AI analysis added to job notes');
      onNotesUpdated?.();
      onClose();
    } catch (error: any) {
      if (__DEV__) console.error('Error adding to notes:', error);
      Alert.alert('Error', 'Failed to add analysis to notes. Please try again.');
    } finally {
      setIsAddingToNotes(false);
    }
  }, [analysisText, existingNotes, jobId, onNotesUpdated, onClose, isAddingToNotes]);

  const discardAnalysis = useCallback(() => {
    setAnalysisText('');
    setIsComplete(false);
    setSelectedPhotoIds(new Set());
  }, []);

  if (!aiEnabled || !aiPhotoAnalysisEnabled) {
    return (
      <AppBottomSheet
        visible={visible}
        onDismiss={onClose}
        snapPoints={['60%']}
        scrollable={false}
        contentPadding={0}
      >
        <View>
            <View style={styles.modalHeader}>
              <View style={styles.headerLeft}>
                <Feather name="zap" size={20} color={colors.mutedForeground} />
                <Text style={[styles.modalTitle, { color: colors.mutedForeground }]}>AI Photo Analysis</Text>
              </View>
              <PressableRow onPress={onClose}>
                <Feather name="x" size={24} color={colors.foreground} />
              </PressableRow>
            </View>
            <View style={styles.disabledContent}>
              <Feather name="alert-circle" size={48} color={colors.mutedForeground} />
              <Text style={styles.disabledText}>
                AI photo analysis is disabled. Enable it in Settings to use this feature.
              </Text>
            </View>
        </View>
      </AppBottomSheet>
    );
  }

  return (
    <AppBottomSheet
        visible={visible}
        onDismiss={onClose}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
      <View>
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <Feather name="zap" size={20} color={colors.primary} />
              <Text style={styles.modalTitle}>Analyse with AI</Text>
            </View>
            <PressableRow onPress={onClose} disabled={isAnalysing}>
              <Feather name="x" size={24} color={colors.foreground} />
            </PressableRow>
          </View>

          {!isAnalysing && !analysisText && (
            <>
              <View style={styles.selectionHeader}>
                <Text style={styles.selectionInfo}>
                  Select photos to analyse ({selectedPhotoIds.size}/10)
                </Text>
                <View style={styles.selectionActions}>
                  <PressableRow onPress={selectAll} style={styles.selectionButton}>
                    <Text style={styles.selectionButtonText}>Select All</Text>
                  </PressableRow>
                  <PressableRow onPress={deselectAll} style={styles.selectionButton}>
                    <Text style={styles.selectionButtonText}>Clear</Text>
                  </PressableRow>
                </View>
              </View>
              
              <ScrollView style={styles.photosGrid} contentContainerStyle={styles.photosGridContent}>
                {imagePhotos.map((photo) => {
                  const isSelected = selectedPhotoIds.has(photo.id);
                  return (
                    <PressableRow key={photo.id} style={[styles.photoItem, isSelected && styles.photoItemSelected]} onPress={() => togglePhotoSelection(photo.id)} >
                      <Image
                        source={{ uri: photo.signedUrl || photo.thumbnailUrl || photo.url || '' }}
                        style={styles.photoImage}
                        resizeMode="cover"
                      />
                      <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                        {isSelected && <Feather name="check" size={14} color={colors.white} />}
                      </View>
                    </PressableRow>
                  );
                })}
              </ScrollView>

              <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
                <PressableRow style={[styles.analyseButton, selectedPhotoIds.size === 0 && styles.buttonDisabled]} onPress={startAnalysis} disabled={selectedPhotoIds.size === 0} >
                  <Feather name="zap" size={18} color={colors.primaryForeground} />
                  <Text style={styles.analyseButtonText}>
                    Analyse {selectedPhotoIds.size} Photo{selectedPhotoIds.size !== 1 ? 's' : ''} with AI
                  </Text>
                </PressableRow>
              </View>
            </>
          )}

          {isAnalysing && (
            <View style={styles.streamingContent}>
              <View style={styles.analysingHeader}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.analysingText}>Analysing {selectedPhotoIds.size} photos...</Text>
              </View>
              {analysisText ? (
                <ScrollView style={styles.streamingScroll} showsVerticalScrollIndicator>
                  <Text style={styles.streamingText}>
                    {analysisText}
                    <Text style={styles.cursor}>|</Text>
                  </Text>
                </ScrollView>
              ) : (
                <Text style={styles.waitingText}>AI is examining your photos...</Text>
              )}
              <PressableRow style={styles.cancelButton} onPress={cancelAnalysis} >
                <Feather name="x" size={16} color={colors.foreground} />
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </PressableRow>
            </View>
          )}

          {isComplete && analysisText && (
            <View style={styles.resultContent}>
              <View style={styles.completeHeader}>
                <Feather name="check-circle" size={18} color={colors.success || '#22c55e'} />
                <Text style={[styles.completeText, { color: colors.success || '#22c55e' }]}>
                  Analysis complete
                </Text>
              </View>
              <ScrollView style={styles.resultScroll} showsVerticalScrollIndicator>
                <Text style={styles.resultText}>{analysisText}</Text>
              </ScrollView>
              <View style={styles.resultActions}>
                <PressableRow style={[styles.addButton, isAddingToNotes && styles.buttonDisabled]} onPress={addToNotes} disabled={isAddingToNotes} >
                  {isAddingToNotes ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <Feather name="plus" size={16} color={colors.primaryForeground} />
                  )}
                  <Text style={styles.addButtonText}>Add to Notes</Text>
                </PressableRow>
                <PressableRow style={[styles.discardButton, isAddingToNotes && styles.buttonDisabled]} onPress={discardAnalysis} disabled={isAddingToNotes} >
                  <Feather name="x" size={16} color={colors.foreground} />
                  <Text style={styles.discardButtonText}>Start Over</Text>
                </PressableRow>
              </View>
            </View>
          )}
      </View>
    </AppBottomSheet>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '85%',
    minHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modalTitle: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: '600', fontFamily: 'Inter_600SemiBold',
    color: colors.foreground,
  },
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.muted,
  },
  selectionInfo: {
    fontSize: typography.body.fontSize,
    color: colors.foreground,
    fontWeight: '500', fontFamily: 'Inter_500Medium',
  },
  selectionActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  selectionButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  selectionButtonText: {
    fontSize: typography.caption.fontSize,
    color: colors.primary,
    fontWeight: '500', fontFamily: 'Inter_500Medium',
  },
  photosGrid: {
    flex: 1,
  },
  photosGridContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.md,
    gap: spacing.sm,
  },
  photoItem: {
    width: photoSize,
    height: photoSize,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  photoItemSelected: {
    borderColor: colors.primary,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  checkbox: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  analyseButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  analyseButtonText: {
    fontSize: typography.button.fontSize,
    fontWeight: '600', fontFamily: 'Inter_600SemiBold',
    color: colors.primaryForeground,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  streamingContent: {
    flex: 1,
    padding: spacing.md,
  },
  analysingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  analysingText: {
    fontSize: typography.body.fontSize,
    color: colors.mutedForeground,
  },
  waitingText: {
    fontSize: typography.body.fontSize,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  streamingScroll: {
    flex: 1,
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  streamingText: {
    fontSize: typography.body.fontSize,
    color: colors.foreground,
    lineHeight: 22,
  },
  cursor: {
    color: colors.primary,
    fontWeight: 'bold', fontFamily: 'Inter_700Bold',
  },
  cancelButton: {
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    alignSelf: 'center',
  },
  cancelButtonText: {
    fontSize: typography.button.fontSize,
    fontWeight: '500', fontFamily: 'Inter_500Medium',
    color: colors.foreground,
  },
  resultContent: {
    flex: 1,
    padding: spacing.md,
  },
  completeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  completeText: {
    fontSize: typography.body.fontSize,
    fontWeight: '600', fontFamily: 'Inter_600SemiBold',
  },
  resultScroll: {
    flex: 1,
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  resultText: {
    fontSize: typography.body.fontSize,
    color: colors.foreground,
    lineHeight: 22,
  },
  resultActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  addButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  addButtonText: {
    fontSize: typography.button.fontSize,
    fontWeight: '600', fontFamily: 'Inter_600SemiBold',
    color: colors.primaryForeground,
  },
  discardButton: {
    flex: 1,
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  discardButtonText: {
    fontSize: typography.button.fontSize,
    fontWeight: '500', fontFamily: 'Inter_500Medium',
    color: colors.foreground,
  },
  disabledContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  disabledText: {
    fontSize: typography.body.fontSize,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 22,
  },
});
