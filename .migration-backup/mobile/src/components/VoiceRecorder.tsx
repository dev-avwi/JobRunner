import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { useTheme } from '../lib/theme';
import { colors as staticColors } from '../lib/colors';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { api } from '../lib/api';

let Audio: any = null;
let isAudioAvailable = false;

// Module-level handle to the most recently created Recording. expo-av only
// allows ONE prepared Recording per process; if the component unmounts
// mid-record (or a prior stop failed) the native recording is orphaned and the
// next createAsync throws "Only one Recording object can be prepared at a given
// time". Tracking it here lets us force-unload it even without a live ref.
let globalRecording: any = null;

// Cap voice notes at 5 minutes. Long enough for a tradie to talk through a job,
// and keeps the encoded upload comfortably under the 10MB JSON body limit.
const MAX_RECORDING_SECONDS = 300;

try {
  const expoAv = require('expo-av');
  Audio = expoAv.Audio;
  isAudioAvailable = true;
} catch (e) {
  if (__DEV__) console.warn('[VoiceRecorder] expo-av not available - voice recording disabled');
  isAudioAvailable = false;
}

interface VoiceRecorderProps {
  onSave: (uri: string, duration: number) => void;
  onCancel?: () => void;
  isUploading?: boolean;
}

export function VoiceRecorder({ onSave, onCancel, isUploading }: VoiceRecorderProps) {
  const theme = useTheme();
  const [recording, setRecording] = useState<any>(null);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sound, setSound] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const durationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const recordingRef = useRef<any>(null);
  const soundRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
      if (soundRef.current && isAudioAvailable) {
        soundRef.current.unloadAsync().catch((e: any) => {
          if (__DEV__) console.warn('[VoiceRecorder] Error unloading sound on cleanup:', e);
        });
      }
      if (recordingRef.current && isAudioAvailable) {
        recordingRef.current.stopAndUnloadAsync().catch((e: any) => {
          if (__DEV__) console.warn('[VoiceRecorder] Error stopping recording on cleanup:', e);
        });
      }
      // Only drop the module-level handle once the native recording has actually
      // been unloaded. If the unload fails, KEEP the handle so the next mount can
      // still force-unload the orphan (otherwise we hit the expo-av single-
      // recording limit again with no way to recover).
      if (globalRecording && isAudioAvailable) {
        const orphan = globalRecording;
        orphan.stopAndUnloadAsync()
          .then(() => { if (globalRecording === orphan) globalRecording = null; })
          .catch((e: any) => {
            if (__DEV__) console.warn('[VoiceRecorder] Orphan recording unload failed on cleanup (handle retained):', e);
          });
      } else {
        globalRecording = null;
      }
      if (isAudioAvailable && Audio) {
        Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        }).catch((e: any) => { if (__DEV__) console.warn('[VoiceRecorder] Error resetting audio mode on cleanup:', e); });
      }
    };
  }, []);

  const styles = createStyles(theme);

  if (!isAudioAvailable || !Audio) {
    return (
      <View style={styles.container}>
        <View style={styles.unavailableContainer}>
          <Ionicons name="mic-off-outline" size={48} color={theme.colors.mutedForeground} />
          <Text style={styles.unavailableTitle}>Voice Recording Unavailable</Text>
          <Text style={styles.unavailableText}>
            Voice recording requires a development build. It's not available in Expo Go.
          </Text>
          {onCancel && (
            <TouchableOpacity 
              style={[styles.button, styles.outlineButton, { marginTop: 16 }]}
              onPress={onCancel}
            >
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  const requestPermissions = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant microphone permission to record voice notes.',
          [{ text: 'OK' }]
        );
        return false;
      }
      return true;
    } catch (error) {
      if (__DEV__) console.error('Error requesting permissions:', error);
      Alert.alert(
        'Permission Error',
        'Could not check microphone permissions. Please try again.',
        [{ text: 'OK' }]
      );
      return false;
    }
  };

  const cleanupExistingSession = async () => {
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
      durationInterval.current = null;
    }

    if (soundRef.current) {
      try {
        await soundRef.current.unloadAsync();
      } catch (e) {
        if (__DEV__) console.warn('[VoiceRecorder] Error unloading sound during cleanup:', e);
      }
      soundRef.current = null;
      setSound(null);
      setIsPlaying(false);
    }

    if (recordingRef.current) {
      try {
        const status = await recordingRef.current.getStatusAsync();
        if (status.isRecording || status.isDoneRecording) {
          await recordingRef.current.stopAndUnloadAsync();
        }
      } catch (e) {
        try {
          await recordingRef.current.stopAndUnloadAsync();
        } catch (e2) {
          if (__DEV__) console.warn('[VoiceRecorder] Force cleanup of stale recording:', e2);
        }
      }
      recordingRef.current = null;
      setRecording(null);
    }

    // Force-unload any orphaned recording left over from a previous mount/session
    // that recordingRef can no longer reach. Without this, expo-av still considers
    // a Recording "prepared" and the next createAsync throws "Only one Recording...".
    if (globalRecording) {
      try {
        await globalRecording.stopAndUnloadAsync();
      } catch (e) {
        if (__DEV__) console.warn('[VoiceRecorder] Error unloading orphaned recording:', e);
      }
      globalRecording = null;
    }

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
    } catch (e) {
      if (__DEV__) console.warn('[VoiceRecorder] Error resetting audio mode during cleanup:', e);
    }

    await new Promise(resolve => setTimeout(resolve, Platform.OS === 'ios' ? 150 : 50));
  };

  const startDurationTimer = () => {
    durationInterval.current = setInterval(() => {
      setRecordingDuration(prev => {
        const next = prev + 1;
        if (next >= MAX_RECORDING_SECONDS) {
          // Auto-stop at the cap so the note always stays uploadable.
          setTimeout(() => { stopRecording(); }, 0);
          return MAX_RECORDING_SECONDS;
        }
        return next;
      });
    }, 1000);
  };

  const startRecording = async () => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return;

      if (__DEV__) console.log('[VoiceRecorder] Cleaning up existing audio session before recording...');
      await cleanupExistingSession();

      if (__DEV__) console.log('[VoiceRecorder] Setting audio mode for recording...');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      if (__DEV__) console.log('[VoiceRecorder] Audio mode configured with allowsRecordingIOS: true');

      if (__DEV__) console.log('[VoiceRecorder] Creating recording instance...');
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(newRecording);
      recordingRef.current = newRecording;
      globalRecording = newRecording;
      setIsRecording(true);
      setIsPaused(false);
      setRecordingDuration(0);

      startDurationTimer();

      if (__DEV__) console.log('[VoiceRecorder] Recording started successfully');
      
    } catch (error: any) {
      if (__DEV__) console.error('[VoiceRecorder] Error starting recording:', error, JSON.stringify(error));
      
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });
      } catch (resetError) {
        if (__DEV__) console.warn('[VoiceRecorder] Could not reset audio mode:', resetError);
      }
      
      const msg = error?.message || error?.toString?.() || '';
      const code = error?.code || '';
      
      if (msg.includes('permission') || msg.includes('Permission') || code === 'E_AUDIO_NOPERMISSION') {
        Alert.alert(
          'Microphone Permission Required',
          'Please enable microphone access in your device settings to record voice notes.',
          [{ text: 'OK' }]
        );
      } else if (
        msg.includes('already recording') ||
        msg.includes('Cannot record') ||
        msg.includes('another recording') ||
        msg.toLowerCase().includes('only one recording') ||
        msg.includes('prepared at a given time')
      ) {
        if (__DEV__) console.log('[VoiceRecorder] Stale recording detected, performing deep cleanup and retry...');
        try {
          if (recordingRef.current) {
            await recordingRef.current.stopAndUnloadAsync().catch(() => {});
            recordingRef.current = null;
            setRecording(null);
          }
          if (globalRecording) {
            await globalRecording.stopAndUnloadAsync().catch(() => {});
            globalRecording = null;
          }
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
          });
          await new Promise(resolve => setTimeout(resolve, 300));
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
          });
          const { recording: retryRecording } = await Audio.Recording.createAsync(
            Audio.RecordingOptionsPresets.HIGH_QUALITY
          );
          setRecording(retryRecording);
          recordingRef.current = retryRecording;
          globalRecording = retryRecording;
          setIsRecording(true);
          setIsPaused(false);
          setRecordingDuration(0);
          startDurationTimer();
          if (__DEV__) console.log('[VoiceRecorder] Retry recording started successfully');
          return;
        } catch (retryError) {
          if (__DEV__) console.error('[VoiceRecorder] Retry also failed:', retryError);
          Alert.alert(
            'Recording Busy',
            'The microphone is still in use. Please wait a moment and try again, or restart the app.',
            [{ text: 'OK' }]
          );
        }
      } else if (msg.includes('not found') || msg.includes('not installed') || msg.includes('native module')) {
        Alert.alert(
          'Recording Not Available',
          'Voice recording requires a development build with native audio support. It is not available in Expo Go.',
          [{ text: 'OK' }]
        );
      } else if (msg.includes('interrupted') || msg.includes('deactivated') || msg.includes('session')) {
        Alert.alert(
          'Audio Session Error',
          'The audio session was interrupted (possibly by a call or another app). Please try again.',
          [{ text: 'Try Again', onPress: () => setTimeout(startRecording, 500) },
           { text: 'Cancel', style: 'cancel' }]
        );
      } else {
        Alert.alert(
          'Recording Error',
          `Could not start recording. ${Platform.OS === 'ios' ? 'Make sure no other app is using the microphone and Silent Mode is not blocking audio.' : 'Make sure no other app is using the microphone.'}\n\nDetails: ${msg || 'Unknown error'}`,
          [{ text: 'Try Again', onPress: () => setTimeout(startRecording, 500) },
           { text: 'Cancel', style: 'cancel' }]
        );
      }
    }
  };

  const stopRecording = async () => {
    if (!recording && !recordingRef.current) return;

    const activeRecording = recording || recordingRef.current;

    try {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
        durationInterval.current = null;
      }

      let uri: string | null = null;
      try {
        await activeRecording.stopAndUnloadAsync();
        uri = activeRecording.getURI();
      } catch (stopError: any) {
        if (__DEV__) console.warn('[VoiceRecorder] Error during stopAndUnload:', stopError);
        try {
          uri = activeRecording.getURI();
        } catch (e) {
          if (__DEV__) console.warn('[VoiceRecorder] Could not get URI after stop error');
        }
      }
      
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });
      } catch (e) {
        if (__DEV__) console.warn('[VoiceRecorder] Error resetting audio mode after stop:', e);
      }

      if (__DEV__) console.log('[VoiceRecorder] Recording stopped, URI:', uri);
      
      if (uri) {
        setRecordedUri(uri);
      }
      
      setRecording(null);
      recordingRef.current = null;
      globalRecording = null;
      setIsRecording(false);
      setIsPaused(false);
      
    } catch (error) {
      if (__DEV__) console.error('[VoiceRecorder] Error stopping recording:', error);
      setRecording(null);
      recordingRef.current = null;
      globalRecording = null;
      setIsRecording(false);
      setIsPaused(false);
    }
  };

  const pauseRecording = async () => {
    if (!recording) return;

    try {
      if (isPaused) {
        await recording.startAsync();
        setIsPaused(false);
        startDurationTimer();
      } else {
        await recording.pauseAsync();
        setIsPaused(true);
        if (durationInterval.current) {
          clearInterval(durationInterval.current);
          durationInterval.current = null;
        }
      }
    } catch (error) {
      if (__DEV__) console.error('Error pausing recording:', error);
    }
  };

  const playRecording = async () => {
    if (!recordedUri) return;

    try {
      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
          return;
        } else {
          await sound.setPositionAsync(0);
          await sound.playAsync();
          setIsPlaying(true);
          return;
        }
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: recordedUri },
        { shouldPlay: true }
      );
      
      setSound(newSound);
      soundRef.current = newSound;
      setIsPlaying(true);

      newSound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
        }
      });
      
    } catch (error) {
      if (__DEV__) console.error('Error playing recording:', error);
    }
  };

  const deleteRecording = async () => {
    if (sound) {
      await sound.unloadAsync();
      setSound(null);
      soundRef.current = null;
    }
    setRecordedUri(null);
    setRecordingDuration(0);
    setIsPlaying(false);
  };

  const handleSave = () => {
    if (recordedUri) {
      onSave(recordedUri, recordingDuration);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      {!recordedUri ? (
        <>
          <View style={[styles.micContainer, isRecording && styles.micRecording]}>
            <Ionicons 
              name="mic" 
              size={32} 
              color={isRecording ? theme.colors.destructive : theme.colors.primary} 
            />
          </View>
          
          <Text style={styles.duration}>{formatDuration(recordingDuration)}</Text>
          <Text style={styles.maxHint}>Up to {formatDuration(MAX_RECORDING_SECONDS)}</Text>
          
          <View style={styles.buttonRow}>
            {!isRecording ? (
              <TouchableOpacity 
                style={[styles.button, styles.primaryButton]}
                onPress={startRecording}
              >
                <Ionicons name="mic" size={20} color={staticColors.white} />
                <Text style={styles.buttonTextWhite}>Start Recording</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity 
                  style={[styles.button, styles.outlineButton]}
                  onPress={pauseRecording}
                >
                  <Ionicons 
                    name={isPaused ? "play" : "pause"} 
                    size={20} 
                    color={theme.colors.primary} 
                  />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.button, styles.stopButton]}
                  onPress={stopRecording}
                >
                  <Ionicons name="stop" size={20} color={staticColors.white} />
                  <Text style={styles.buttonTextWhite}>Stop</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </>
      ) : (
        <>
          <View style={styles.playbackContainer}>
            <TouchableOpacity 
              style={styles.playButton}
              onPress={playRecording}
            >
              <Ionicons 
                name={isPlaying ? "pause" : "play"} 
                size={24} 
                color={theme.colors.primary} 
              />
            </TouchableOpacity>
            <View style={styles.playbackInfo}>
              <Text style={styles.playbackTitle}>Voice Note</Text>
              <Text style={styles.playbackDuration}>{formatDuration(recordingDuration)}</Text>
            </View>
            <TouchableOpacity 
              style={styles.deleteButton}
              onPress={deleteRecording}
            >
              <Ionicons name="trash-outline" size={20} color={theme.colors.destructive} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.actionRow}>
            {onCancel && (
              <TouchableOpacity 
                style={[styles.button, styles.outlineButton, styles.flex1]}
                onPress={onCancel}
                disabled={isUploading}
              >
                <Text style={[styles.buttonText, isUploading && styles.disabledText]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={[
                styles.button, 
                styles.primaryButton, 
                styles.flex1,
                isUploading && styles.disabledButton
              ]}
              onPress={handleSave}
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <ActivityIndicator size="small" color={staticColors.white} />
                  <Text style={styles.buttonTextWhite}>Saving...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="save" size={20} color={staticColors.white} />
                  <Text style={styles.buttonTextWhite}>Save</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

interface VoiceNotePlayerProps {
  noteId?: string;
  uri: string;
  fallbackUri?: string;
  title?: string;
  duration?: number;
  createdAt?: string;
  transcription?: string | null;
  summary?: string | null;
  onDelete?: () => void;
  onTranscriptionUpdate?: (transcription: string) => void;
  onSummaryUpdate?: (summary: string) => void;
  onAddToNotes?: (text: string) => void;
  jobId?: string;
}

export function VoiceNotePlayer({ 
  noteId,
  uri, 
  fallbackUri,
  title, 
  duration, 
  createdAt,
  transcription: initialTranscription,
  summary: initialSummary,
  onDelete,
  onTranscriptionUpdate,
  onSummaryUpdate,
  onAddToNotes,
  jobId,
}: VoiceNotePlayerProps) {
  const theme = useTheme();
  const soundRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState<string | null>(initialTranscription || null);
  const [showTranscription, setShowTranscription] = useState(!!initialTranscription);
  const [summary, setSummary] = useState<string | null>(initialSummary || null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  // Cleanup sound on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, []);

  // Cleanup helper function
  const cleanupSound = async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (e) {
        // Ignore cleanup errors
      }
      soundRef.current = null;
    }
    setIsLoaded(false);
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const loadAndPlayAudio = async (audioUri: string, forceDownload: boolean = false): Promise<boolean> => {
    try {
      if (__DEV__) console.log('[VoiceNotePlayer] Attempting to load:', audioUri);
      
      // Always clean up before loading new audio
      await cleanupSound();
      
      let playUri = audioUri;
      
      // If this is a /stream endpoint URL, download with auth headers first
      if (audioUri.includes('/stream') || audioUri.includes('/api/')) {
        try {
          const token = await api.getToken();
          // Use noteId for consistent caching if available
          const cacheFileName = noteId ? `voice_note_${noteId}.m4a` : `voice_note_${Date.now()}.m4a`;
          const localPath = `${FileSystem.cacheDirectory}${cacheFileName}`;
          
          // Check if cached file exists and is valid (skip if forceDownload)
          if (!forceDownload && noteId) {
            const fileInfo = await FileSystem.getInfoAsync(localPath);
            if (fileInfo.exists && fileInfo.size && fileInfo.size > 500) {
              // Cached file is valid (>500 bytes for audio)
              if (__DEV__) console.log('[VoiceNotePlayer] Using cached file:', localPath, 'size:', fileInfo.size);
              playUri = localPath;
            } else if (fileInfo.exists && (!fileInfo.size || fileInfo.size <= 500)) {
              // Cached file is too small/invalid - delete and redownload
              if (__DEV__) console.log('[VoiceNotePlayer] Cached file invalid, deleting:', localPath);
              await FileSystem.deleteAsync(localPath, { idempotent: true });
              // Fall through to download fresh
            }
            
            // Only download if playUri hasn't been set to cache
            if (playUri === audioUri) {
              // Download fresh
              if (__DEV__) console.log('[VoiceNotePlayer] Downloading audio with auth to:', localPath);
              
              const downloadResult = await FileSystem.downloadAsync(audioUri, localPath, {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
              });
              
              if (downloadResult.status === 200) {
                // Verify downloaded file is not empty
                const downloadedInfo = await FileSystem.getInfoAsync(downloadResult.uri);
                if (downloadedInfo.exists && downloadedInfo.size && downloadedInfo.size > 100) {
                  playUri = downloadResult.uri;
                  if (__DEV__) console.log('[VoiceNotePlayer] Downloaded to:', playUri, 'size:', downloadedInfo.size);
                } else {
                  if (__DEV__) console.error('[VoiceNotePlayer] Downloaded file is empty or too small');
                  // Delete the bad cached file
                  await FileSystem.deleteAsync(localPath, { idempotent: true });
                  return false;
                }
              } else {
                if (__DEV__) console.error('[VoiceNotePlayer] Download failed with status:', downloadResult.status);
                return false;
              }
            }
          } else {
            // No noteId or forceDownload - always download fresh
            if (__DEV__) console.log('[VoiceNotePlayer] Downloading audio with auth to:', localPath);
            
            const downloadResult = await FileSystem.downloadAsync(audioUri, localPath, {
              headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            });
            
            if (downloadResult.status === 200) {
              playUri = downloadResult.uri;
              if (__DEV__) console.log('[VoiceNotePlayer] Downloaded to:', playUri);
            } else {
              if (__DEV__) console.error('[VoiceNotePlayer] Download failed with status:', downloadResult.status);
              return false;
            }
          }
        } catch (downloadError) {
          if (__DEV__) console.error('[VoiceNotePlayer] Download error:', downloadError);
          return false;
        }
      }
      
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: playUri },
        { shouldPlay: true }
      );
      
      soundRef.current = newSound;
      setIsLoaded(true);
      setIsPlaying(true);
      setHasError(false);

      newSound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.isLoaded) {
          setCurrentTime(Math.floor((status.positionMillis || 0) / 1000));
          if (status.didJustFinish) {
            setIsPlaying(false);
            setCurrentTime(0);
          }
        }
        if (status.error) {
          if (__DEV__) console.error('[VoiceNotePlayer] Playback error:', status.error);
          setHasError(true);
          setIsPlaying(false);
          // Clear cached file on playback error
          if (noteId) {
            const localPath = `${FileSystem.cacheDirectory}voice_note_${noteId}.m4a`;
            FileSystem.deleteAsync(localPath, { idempotent: true }).catch(() => {});
          }
        }
      });
      
      return true;
    } catch (error) {
      if (__DEV__) console.error('[VoiceNotePlayer] Error loading audio:', error);
      // Clear cached file on error
      if (noteId) {
        const localPath = `${FileSystem.cacheDirectory}voice_note_${noteId}.m4a`;
        FileSystem.deleteAsync(localPath, { idempotent: true }).catch(() => {});
      }
      return false;
    }
  };

  const togglePlay = async () => {
    if (!isAudioAvailable || !Audio) {
      Alert.alert('Unavailable', 'Audio playback requires a development build.');
      return;
    }

    try {
      // If sound is loaded and not in error state, just toggle play/pause
      if (soundRef.current && isLoaded && !hasError) {
        if (isPlaying) {
          await soundRef.current.pauseAsync();
          setIsPlaying(false);
          return;
        } else {
          await soundRef.current.setPositionAsync(0);
          await soundRef.current.playAsync();
          setIsPlaying(true);
          return;
        }
      }

      // If there was an error, reset and force fresh download
      const shouldForceDownload = hasError;
      if (hasError) {
        await cleanupSound();
        setHasError(false);
        // Also clear cache on retry
        if (noteId) {
          const localPath = `${FileSystem.cacheDirectory}voice_note_${noteId}.m4a`;
          await FileSystem.deleteAsync(localPath, { idempotent: true }).catch(() => {});
        }
      }

      setIsLoading(true);
      
      // Try primary URL first
      if (uri && uri.length > 0) {
        const success = await loadAndPlayAudio(uri, shouldForceDownload);
        if (success) {
          setIsLoading(false);
          return;
        }
      }
      
      // Try fallback URL if primary fails
      if (fallbackUri && fallbackUri.length > 0) {
        if (__DEV__) console.log('[VoiceNotePlayer] Primary URL failed, trying fallback:', fallbackUri);
        const success = await loadAndPlayAudio(fallbackUri, true); // Always force download for fallback
        if (success) {
          setIsLoading(false);
          return;
        }
      }
      
      // Both failed
      setIsLoading(false);
      setHasError(true);
      Alert.alert('Playback Error', 'Unable to play this voice note. Please try again later.');
      
    } catch (error) {
      if (__DEV__) console.error('Error playing audio:', error);
      setIsLoading(false);
      setHasError(true);
      Alert.alert('Error', 'Failed to play voice note.');
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // AI Transcription
  const handleTranscribe = async () => {
    if (!noteId || !jobId) {
      Alert.alert('Error', 'Cannot transcribe - voice note or job ID missing');
      return;
    }
    
    setIsTranscribing(true);
    try {
      const response = await api.post<{ transcription: string }>(`/api/jobs/${jobId}/voice-notes/${noteId}/transcribe`);
      if (response.error) {
        Alert.alert('Transcription Failed', response.error || 'Could not transcribe voice note');
        return;
      }
      if (response.data?.transcription) {
        setTranscription(response.data.transcription);
        setShowTranscription(true);
        onTranscriptionUpdate?.(response.data.transcription);
      }
    } catch (error) {
      if (__DEV__) console.error('Transcription error:', error);
      Alert.alert('Error', 'Failed to transcribe voice note');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleSummarize = async () => {
    if (!noteId || !jobId) {
      Alert.alert('Error', 'Cannot summarise - voice note or job ID missing');
      return;
    }
    setIsSummarizing(true);
    try {
      const response = await api.post<{ summary: string }>(`/api/jobs/${jobId}/voice-notes/${noteId}/summarize`);
      if (response.error) {
        Alert.alert('Summary Failed', response.error || 'Could not summarise voice note');
        return;
      }
      if (response.data?.summary) {
        setSummary(response.data.summary);
        onSummaryUpdate?.(response.data.summary);
      }
    } catch (error) {
      if (__DEV__) console.error('Summarise error:', error);
      Alert.alert('Error', 'Failed to summarise voice note');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleAddSummaryToNotes = () => {
    if (!summary) return;
    if (onAddToNotes) {
      onAddToNotes(summary);
    }
  };

  const handleCopyTranscription = async () => {
    if (!transcription) return;
    try {
      const Clipboard = require('expo-clipboard');
      await Clipboard.setStringAsync(transcription);
      Alert.alert('Copied', 'Transcription copied to clipboard');
    } catch (e) {
      Alert.alert('Error', 'Could not copy to clipboard');
    }
  };

  const handleAddToNotes = () => {
    if (!transcription) return;
    if (onAddToNotes) {
      onAddToNotes(transcription);
    } else {
      Alert.alert('Note', 'Add to Notes callback not provided');
    }
  };

  const styles = createStyles(theme);

  return (
    <View style={styles.playerWrapper}>
      <View style={[styles.playerContainer, hasError && styles.playerContainerError]}>
        <TouchableOpacity 
          style={[styles.playButton, isLoading && styles.playButtonDisabled]} 
          onPress={togglePlay}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <Ionicons 
              name={hasError ? "reload" : (isPlaying ? "pause" : "play")} 
              size={24} 
              color={hasError ? theme.colors.mutedForeground : theme.colors.primary} 
            />
          )}
        </TouchableOpacity>
        
        <View style={styles.playerInfo}>
          <Text style={[styles.playerTitle, hasError && styles.playerTitleError]} numberOfLines={1}>
            {title || 'Voice Note'}
          </Text>
          <Text style={styles.playerMeta}>
            {hasError ? 'Tap to retry' : (
              `${formatDuration(isPlaying ? currentTime : 0)} / ${formatDuration(duration || 0)}${createdAt ? ` | ${formatDate(createdAt)}` : ''}`
            )}
          </Text>
        </View>
        
        {/* Transcribe button - requires both noteId and jobId */}
        {noteId && jobId && !transcription && (
          <TouchableOpacity 
            style={styles.transcribeButton} 
            onPress={handleTranscribe}
            disabled={isTranscribing}
          >
            {isTranscribing ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Ionicons name="text" size={18} color={theme.colors.primary} />
            )}
          </TouchableOpacity>
        )}
        
        {onDelete && (
          <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
            <Ionicons name="trash-outline" size={20} color={theme.colors.destructive} />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Transcription section */}
      {transcription && (
        <View style={styles.transcriptionContainer}>
          <TouchableOpacity 
            style={styles.transcriptionHeader}
            onPress={() => setShowTranscription(!showTranscription)}
          >
            <Ionicons name="text" size={14} color={theme.colors.mutedForeground} />
            <Text style={styles.transcriptionLabel}>AI Transcription</Text>
            <Ionicons 
              name={showTranscription ? "chevron-up" : "chevron-down"} 
              size={14} 
              color={theme.colors.mutedForeground} 
            />
          </TouchableOpacity>
          
          {showTranscription && (
            <>
              <Text style={styles.transcriptionText}>{transcription}</Text>
              <View style={styles.transcriptionActions}>
                {onAddToNotes && (
                  <TouchableOpacity style={styles.actionButton} onPress={handleAddToNotes}>
                    <Ionicons name="add-circle-outline" size={16} color={theme.colors.primary} />
                    <Text style={styles.actionButtonText}>Add to Notes</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.actionButton} onPress={handleCopyTranscription}>
                  <Ionicons name="copy-outline" size={16} color={theme.colors.primary} />
                  <Text style={styles.actionButtonText}>Copy</Text>
                </TouchableOpacity>
                {noteId && jobId && !summary && (
                  <TouchableOpacity style={styles.actionButton} onPress={handleSummarize} disabled={isSummarizing}>
                    {isSummarizing ? (
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                    ) : (
                      <Ionicons name="sparkles-outline" size={16} color={theme.colors.primary} />
                    )}
                    <Text style={styles.actionButtonText}>{isSummarizing ? 'Summarising...' : 'Summarise'}</Text>
                  </TouchableOpacity>
                )}
              </View>
              {summary && (
                <View style={styles.summaryContainer}>
                  <View style={styles.transcriptionHeader}>
                    <Ionicons name="sparkles-outline" size={14} color={theme.colors.mutedForeground} />
                    <Text style={styles.transcriptionLabel}>AI Summary</Text>
                  </View>
                  <Text style={styles.transcriptionText}>{summary}</Text>
                  {onAddToNotes && (
                    <View style={styles.transcriptionActions}>
                      <TouchableOpacity style={styles.actionButton} onPress={handleAddSummaryToNotes}>
                        <Ionicons name="add-circle-outline" size={16} color={theme.colors.primary} />
                        <Text style={styles.actionButtonText}>Add to Notes</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) => StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    alignItems: 'center',
  },
  unavailableContainer: {
    alignItems: 'center',
    padding: 20,
  },
  unavailableTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.foreground,
    marginTop: 12,
    marginBottom: 8,
  },
  unavailableText: {
    fontSize: 14,
    color: theme.colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 20,
  },
  micContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  micRecording: {
    backgroundColor: theme.colors.destructive + '20',
  },
  duration: {
    fontSize: 32,
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    color: theme.colors.foreground,
    marginBottom: 4,
  },
  maxHint: {
    fontSize: 12,
    color: theme.colors.mutedForeground,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  stopButton: {
    backgroundColor: theme.colors.destructive,
  },
  disabledButton: {
    opacity: 0.6,
  },
  flex1: {
    flex: 1,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.foreground,
  },
  buttonTextWhite: {
    fontSize: 16,
    fontWeight: '500',
    color: staticColors.white,
  },
  disabledText: {
    opacity: 0.6,
  },
  playbackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    padding: 12,
    width: '100%',
    marginBottom: 16,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playbackInfo: {
    flex: 1,
    marginLeft: 12,
  },
  playbackTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.foreground,
  },
  playbackDuration: {
    fontSize: 14,
    color: theme.colors.mutedForeground,
    marginTop: 2,
  },
  deleteButton: {
    padding: 8,
  },
  playerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    padding: 12,
  },
  playerContainerError: {
    opacity: 0.7,
  },
  playButtonDisabled: {
    opacity: 0.5,
  },
  playerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  playerTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.foreground,
  },
  playerTitleError: {
    color: theme.colors.mutedForeground,
  },
  playerMeta: {
    fontSize: 13,
    color: theme.colors.mutedForeground,
    marginTop: 2,
  },
  playerWrapper: {
    width: '100%',
  },
  transcribeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  transcriptionContainer: {
    marginTop: 8,
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  transcriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  transcriptionLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.mutedForeground,
  },
  transcriptionText: {
    fontSize: 14,
    color: theme.colors.foreground,
    lineHeight: 20,
    marginTop: 8,
  },
  transcriptionActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  summaryContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: theme.colors.primary + '10',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.primary,
  },
});
