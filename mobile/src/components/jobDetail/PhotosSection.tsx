import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ThemeColors } from '../../lib/theme';
import { PressableRow } from '../ui/PressableRow';
import { VoiceRecorder, VoiceNotePlayer } from '../VoiceRecorder';
import { spacing, iconSizes, typography } from '../../lib/design-tokens';
import api from '../../lib/api';
import offlineStorage, { useOfflineStore } from '../../lib/offline-storage';
import { showToast } from '../../lib/toast';

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

interface JobLite {
  id: string;
  notes?: string;
}

const isVideo = (photo: JobPhoto) => {
  const mimeType = photo.mimeType || '';
  const fileName = photo.fileName?.toLowerCase() || '';
  const ext = fileName.split('.').pop() || '';
  return mimeType.startsWith('video/') || ['mp4', 'mov', 'avi', 'webm', 'm4v', '3gp'].includes(ext);
};

export interface PhotosSectionProps {
  colors: ThemeColors;
  styles: any;
  jobId: string;
  job: JobLite | null;
  setJob: (job: any) => void;
  photos: JobPhoto[];
  isUploadingPhoto: boolean;
  setSelectedPhoto: (p: JobPhoto | null) => void;
  setSelectedVideo: (p: JobPhoto | null) => void;
  setShowVideoPlayer: (v: boolean) => void;
  setShowPhotosModal: (v: boolean) => void;
  handleTakePhoto: () => void;
  handleRecordVideo: () => void;
  handlePickMedia: () => void;
  handleChangePhotoCategory: (p: JobPhoto) => void;
  voiceNotes: VoiceNote[];
  setVoiceNotes: (updater: (prev: VoiceNote[]) => VoiceNote[]) => void;
  showVoiceRecorder: boolean;
  setShowVoiceRecorder: (v: boolean) => void;
  isUploadingVoiceNote: boolean;
  handleUploadVoiceNote: (uri: string, duration: number) => void;
  handleDeleteVoiceNote: (id: string) => void;
}

export function PhotosSection(props: PhotosSectionProps) {
  const {
    colors,
    styles,
    jobId,
    job,
    setJob,
    photos,
    isUploadingPhoto,
    setSelectedPhoto,
    setSelectedVideo,
    setShowVideoPlayer,
    setShowPhotosModal,
    handleTakePhoto,
    handleRecordVideo,
    handlePickMedia,
    handleChangePhotoCategory,
    voiceNotes,
    setVoiceNotes,
    showVoiceRecorder,
    setShowVoiceRecorder,
    isUploadingVoiceNote,
    handleUploadVoiceNote,
    handleDeleteVoiceNote,
  } = props;

  return (
    <>
      {/* Photos Section */}
      <View style={styles.photosCard}>
        <View style={styles.photosHeader}>
          <View style={styles.photosIconContainer}>
            <Feather name="camera" size={iconSizes.lg} color={colors.primary} />
          </View>
          <Text style={styles.photosHeaderLabel}>Photos</Text>
          {photos.length > 0 && (
            <View style={styles.photosCountBadge}>
              <Text style={styles.photosCountText}>{photos.length}</Text>
            </View>
          )}
        </View>

        {photos.length > 0 ? (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.photosScrollView}
              contentContainerStyle={styles.photosScrollContent}
            >
              {photos.map((photo) => (
                <PressableRow
                  key={photo.id}
                  style={styles.inlinePhotoItem}
                  onPress={() => {
                    if (isVideo(photo)) {
                      setSelectedVideo(photo);
                      setShowVideoPlayer(true);
                    } else {
                      setSelectedPhoto(photo);
                    }
                  }}
                  onLongPress={() => handleChangePhotoCategory(photo)}
                >
                  <Image
                    source={{ uri: photo.signedUrl || photo.thumbnailUrl || photo.url || '' }}
                    style={styles.inlinePhotoImage}
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
                      photo.category === 'before' && { backgroundColor: colors.info || '#3b82f6' },
                      photo.category === 'after' && { backgroundColor: colors.success || '#22c55e' },
                      photo.category === 'progress' && { backgroundColor: colors.warning || '#f59e0b' },
                      photo.category === 'materials' && { backgroundColor: '#8b5cf6' }
                    ]}>
                      <Text style={styles.photoCategoryBadgeText}>
                        {photo.category.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </PressableRow>
              ))}
              {/* Tap any photo to view full gallery */}
              <TouchableOpacity
                style={styles.viewAllPhotosButton}
                onPress={() => setShowPhotosModal(true)}
                activeOpacity={0.7}
              >
                <Feather name="grid" size={20} color={colors.primary} />
                <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>View All</Text>
              </TouchableOpacity>
            </ScrollView>
            <View style={[styles.emptyPhotosContainer, { marginTop: spacing.md, flexWrap: 'wrap', gap: spacing.sm }]}>
              <TouchableOpacity
                style={[styles.takePhotoInlineButton, { flex: 0, minWidth: '30%', paddingHorizontal: spacing.md }]}
                onPress={handleTakePhoto}
                disabled={isUploadingPhoto}
                activeOpacity={0.7}
              >
                {isUploadingPhoto ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <>
                    <Feather name="camera" size={18} color={colors.primaryForeground} style={{ marginRight: spacing.xs }} />
                    <Text style={styles.takePhotoInlineText}>Photo</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.recordVideoButton}
                onPress={handleRecordVideo}
                disabled={isUploadingPhoto}
                activeOpacity={0.7}
                data-testid="button-record-video"
              >
                <Feather name="video" size={18} color={colors.primaryForeground} style={styles.recordVideoButtonIcon} />
                <Text style={styles.recordVideoText}>Video</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.galleryInlineButton, { flex: 1, marginRight: 0 }]}
                onPress={handlePickMedia}
                disabled={isUploadingPhoto}
                activeOpacity={0.7}
              >
                <Feather name="image" size={18} color={colors.foreground} style={{ marginRight: spacing.xs }} />
                <Text style={styles.galleryInlineText}>Gallery</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: `${colors.primary}10`, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }}>
              <Feather name="camera" size={28} color={colors.mutedForeground} />
            </View>
            <Text style={{ ...typography.body, color: colors.mutedForeground, textAlign: 'center', marginBottom: spacing.xs }}>
              No photos yet
            </Text>
            <Text style={{ ...typography.caption, color: colors.mutedForeground, textAlign: 'center', marginBottom: spacing.lg, paddingHorizontal: spacing.md }}>
              Document the job with before, during, and after photos
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, width: '100%' }}>
              <TouchableOpacity
                style={[styles.takePhotoInlineButton, { flex: 0, minWidth: '30%', paddingHorizontal: spacing.md }]}
                onPress={handleTakePhoto}
                disabled={isUploadingPhoto}
                activeOpacity={0.7}
              >
                {isUploadingPhoto ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <>
                    <Feather name="camera" size={18} color={colors.primaryForeground} style={{ marginRight: spacing.xs }} />
                    <Text style={styles.takePhotoInlineText}>Photo</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.recordVideoButton}
                onPress={handleRecordVideo}
                disabled={isUploadingPhoto}
                activeOpacity={0.7}
                data-testid="button-record-video"
              >
                <Feather name="video" size={18} color={colors.primaryForeground} style={styles.recordVideoButtonIcon} />
                <Text style={styles.recordVideoText}>Video</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.galleryInlineButton, { flex: 1, marginRight: 0 }]}
                onPress={handlePickMedia}
                disabled={isUploadingPhoto}
                activeOpacity={0.7}
              >
                <Feather name="image" size={18} color={colors.foreground} style={{ marginRight: spacing.xs }} />
                <Text style={styles.galleryInlineText}>Gallery</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Voice Notes Section */}
      <View style={styles.photosCard}>
        <View style={styles.photosHeader}>
          <View style={[styles.photosIconContainer, { backgroundColor: `${colors.primary}15` }]}>
            <Feather name="mic" size={iconSizes.lg} color={colors.primary} />
          </View>
          <Text style={styles.photosHeaderLabel}>Voice Notes</Text>
          {voiceNotes.length > 0 && (
            <View style={styles.photosCountBadge}>
              <Text style={styles.photosCountText}>{voiceNotes.length}</Text>
            </View>
          )}
        </View>

        {showVoiceRecorder ? (
          <VoiceRecorder
            onSave={handleUploadVoiceNote}
            onCancel={() => setShowVoiceRecorder(false)}
            isUploading={isUploadingVoiceNote}
          />
        ) : voiceNotes.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            {voiceNotes.map((note: VoiceNote) => (
              <VoiceNotePlayer
                key={note.id}
                noteId={note.id}
                jobId={jobId}
                uri={`${api.getBaseUrl()}/api/jobs/${jobId}/voice-notes/${note.id}/stream`}
                fallbackUri={note.signedUrl || ''}
                title={note.title || undefined}
                duration={note.duration || undefined}
                createdAt={note.createdAt || undefined}
                transcription={note.transcription}
                summary={note.summary}
                onDelete={() => handleDeleteVoiceNote(note.id)}
                onTranscriptionUpdate={(text) => {
                  setVoiceNotes(prev => prev.map(v =>
                    v.id === note.id ? { ...v, transcription: text } : v
                  ));
                }}
                onSummaryUpdate={(text) => {
                  setVoiceNotes(prev => prev.map(v =>
                    v.id === note.id ? { ...v, summary: text } : v
                  ));
                }}
                onAddToNotes={async (text) => {
                  const currentNotes = job?.notes || '';
                  const newNotes = currentNotes
                    ? `${currentNotes}\n\n[Voice Note Transcription]\n${text}`
                    : `[Voice Note Transcription]\n${text}`;

                  const { isOnline } = useOfflineStore.getState();
                  const previousNotes = job?.notes;

                  if (job) {
                    setJob({ ...job, notes: newNotes });
                  }

                  try {
                    if (!isOnline) {
                      await offlineStorage.updateJobOffline(job!.id, { notes: newNotes });
                      showToast({ type: 'info', message: 'Saved Offline', description: 'Transcription added to notes - will sync when online' });
                    } else {
                      const res = await api.post(`/api/jobs/${job?.id}/notes`, { content: `[Voice Note Transcription]\n${text}` });
                      if (res.error) {
                        if (job) {
                          setJob({ ...job, notes: previousNotes || '' });
                        }
                        showToast({ type: 'error', message: 'Failed to add transcription to notes' });
                      } else {
                        showToast({ type: 'success', message: 'Transcription added to job notes' });
                      }
                    }
                  } catch (error: any) {
                    if (job) {
                      setJob({ ...job, notes: previousNotes || '' });
                    }
                    if (error.message?.includes('Network')) {
                      await offlineStorage.updateJobOffline(job!.id, { notes: newNotes });
                      showToast({ type: 'info', message: 'Saved Offline', description: 'Will sync when connection is restored' });
                    } else {
                      showToast({ type: 'error', message: 'Failed to add transcription to notes' });
                    }
                  }
                }}
              />
            ))}
            <TouchableOpacity
              style={styles.takePhotoInlineButton}
              onPress={() => setShowVoiceRecorder(true)}
              activeOpacity={0.7}
            >
              <Feather name="mic" size={18} color={colors.primaryForeground} />
              <Text style={styles.takePhotoInlineText}>Record Voice Note</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: `${colors.primary}10`, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }}>
              <Feather name="mic" size={28} color={colors.mutedForeground} />
            </View>
            <Text style={{ ...typography.body, color: colors.mutedForeground, textAlign: 'center', marginBottom: spacing.xs }}>
              No voice notes yet
            </Text>
            <Text style={{ ...typography.caption, color: colors.mutedForeground, textAlign: 'center', marginBottom: spacing.lg, paddingHorizontal: spacing.md }}>
              Record audio notes hands-free while on the job
            </Text>
            <TouchableOpacity
              style={[styles.takePhotoInlineButton, { width: '100%' }]}
              onPress={() => setShowVoiceRecorder(true)}
              activeOpacity={0.7}
            >
              <Feather name="mic" size={18} color={colors.primaryForeground} />
              <Text style={styles.takePhotoInlineText}>Record Voice Note</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </>
  );
}
