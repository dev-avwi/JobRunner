import { useState, useRef, useEffect } from 'react';
import { Button } from './button';
import { Card } from './card';
import { Mic, Square, Play, Pause, Trash2, Save, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Cap voice notes at 5 minutes. Long enough for a tradie to talk through a job,
// and keeps the encoded upload comfortably under the 10MB JSON body limit.
const MAX_RECORDING_SECONDS = 300;

interface VoiceRecorderProps {
  onSave: (audioBlob: Blob, duration: number) => void;
  onCancel?: () => void;
  isUploading?: boolean;
  className?: string;
}

export function VoiceRecorder({ onSave, onCancel, isUploading, className }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [audioUrl]);

  const startDurationTimer = () => {
    timerRef.current = setInterval(() => {
      setDuration(d => {
        const next = d + 1;
        if (next >= MAX_RECORDING_SECONDS) {
          // Auto-stop at the cap so the note always stays uploadable.
          setTimeout(() => {
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            const mr = mediaRecorderRef.current;
            if (mr && mr.state !== 'inactive') mr.stop();
            setIsRecording(false);
            setIsPaused(false);
          }, 0);
          return MAX_RECORDING_SECONDS;
        }
        return next;
      });
    }, 1000);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Detect browser and choose appropriate format
      // WebM works best on Chrome/Firefox, MP4/AAC works on Safari
      const getMimeType = () => {
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        
        if (isSafari) {
          // Safari prefers mp4 (aac)
          if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
        }
        
        // For Chrome/Firefox/Edge, prefer webm with opus (records actual audio)
        // Note: Some browsers report audio/mp4 as supported but produce empty files
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
        if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
        
        // Fallback for Safari if webm didn't work
        if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
        
        // Last resort - let browser pick
        return '';
      };
      
      const mimeType = getMimeType();
      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      
      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start(100);
      setIsRecording(true);
      setDuration(0);
      
      startDurationTimer();
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        startDurationTimer();
      } else {
        mediaRecorderRef.current.pause();
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
      setIsPaused(!isPaused);
    }
  };

  const playRecording = () => {
    if (audioUrl) {
      if (!audioRef.current) {
        audioRef.current = new Audio(audioUrl);
        audioRef.current.onended = () => setIsPlaying(false);
      }
      
      if (isPlaying) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const deleteRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setRecordedBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setIsPlaying(false);
  };

  const handleSave = () => {
    if (recordedBlob) {
      onSave(recordedBlob, duration);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className={cn("p-4", className)}>
      <div className="flex flex-col items-center gap-4">
        {!recordedBlob ? (
          <>
            <div className={cn(
              "w-20 h-20 rounded-full flex items-center justify-center transition-all",
              isRecording 
                ? "bg-destructive/20 animate-pulse" 
                : "bg-primary/10"
            )}>
              <Mic className={cn(
                "w-8 h-8",
                isRecording ? "text-destructive" : "text-primary"
              )} />
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-mono font-semibold">
                {formatDuration(duration)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Up to {formatDuration(MAX_RECORDING_SECONDS)}
              </div>
            </div>
            
            <div className="flex gap-2">
              {!isRecording ? (
                <Button
                  onClick={startRecording}
                  variant="default"
                  size="lg"
                  data-testid="button-start-recording"
                >
                  <Mic className="w-4 h-4 mr-2" />
                  Start Recording
                </Button>
              ) : (
                <>
                  <Button
                    onClick={pauseRecording}
                    variant="outline"
                    size="icon"
                    data-testid="button-pause-recording"
                  >
                    {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  </Button>
                  <Button
                    onClick={stopRecording}
                    variant="destructive"
                    size="lg"
                    data-testid="button-stop-recording"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    Stop
                  </Button>
                </>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="w-full bg-muted rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button
                    onClick={playRecording}
                    variant="ghost"
                    size="icon"
                    data-testid="button-play-recording"
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </Button>
                  <div>
                    <div className="font-medium">Voice Note</div>
                    <div className="text-sm text-muted-foreground">
                      {formatDuration(duration)}
                    </div>
                  </div>
                </div>
                <Button
                  onClick={deleteRecording}
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  data-testid="button-delete-recording"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="flex gap-2 w-full">
              {onCancel && (
                <Button
                  onClick={onCancel}
                  variant="outline"
                  className="flex-1"
                  disabled={isUploading}
                  data-testid="button-cancel-recording"
                >
                  Cancel
                </Button>
              )}
              <Button
                onClick={handleSave}
                className="flex-1"
                disabled={isUploading}
                data-testid="button-save-recording"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Voice Note
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

interface VoiceNotePlayerProps {
  signedUrl: string;
  fallbackUrl?: string;
  title?: string;
  duration?: number;
  createdAt?: string;
  onDelete?: () => void;
  onEdit?: () => void;
  className?: string;
}

export function VoiceNotePlayer({ 
  signedUrl, 
  fallbackUrl,
  title, 
  duration, 
  createdAt,
  onDelete,
  onEdit,
  className 
}: VoiceNotePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string>(signedUrl || fallbackUrl || '');

  useEffect(() => {
    // Reset state when URLs change
    setCurrentUrl(signedUrl || fallbackUrl || '');
    setHasError(false);
  }, [signedUrl, fallbackUrl]);

  useEffect(() => {
    if (!currentUrl) return;
    
    const audio = new Audio(currentUrl);
    audioRef.current = audio;
    
    audio.ontimeupdate = () => setCurrentTime(Math.floor(audio.currentTime));
    audio.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    audio.onerror = () => {
      console.error('[VoiceNotePlayer] Error loading audio from:', currentUrl);
      setIsLoading(false);
      
      if (currentUrl === signedUrl && fallbackUrl) {
        setCurrentUrl(fallbackUrl);
      } else {
        setHasError(true);
      }
    };
    audio.oncanplay = () => {
      setIsLoading(false);
    };
    
    return () => {
      audio.pause();
      audio.src = '';
    };
  }, [currentUrl, signedUrl, fallbackUrl]);

  const togglePlay = async () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (hasError) {
        // Reset and try again
        setHasError(false);
        setIsLoading(true);
        setCurrentUrl(signedUrl || fallbackUrl || '');
        return;
      }
      
      setIsLoading(true);
      try {
        await audioRef.current.play();
        setIsPlaying(true);
        setIsLoading(false);
      } catch (error) {
        console.error('[VoiceNotePlayer] Play failed:', error);
        setIsLoading(false);
        setHasError(true);
      }
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 bg-muted rounded-lg",
      hasError && "opacity-70",
      className
    )}>
      <Button
        onClick={togglePlay}
        variant="ghost"
        size="icon"
        className="shrink-0"
        disabled={isLoading}
        data-testid="button-play-voice-note"
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : hasError ? (
          <Play className="w-5 h-5 text-muted-foreground" />
        ) : isPlaying ? (
          <Pause className="w-5 h-5" />
        ) : (
          <Play className="w-5 h-5" />
        )}
      </Button>
      
      <div className="flex-1 min-w-0">
        <div className={cn("font-medium truncate", hasError && "text-muted-foreground")}>
          {title || 'Voice Note'}
        </div>
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          {hasError ? (
            <span>Tap to retry</span>
          ) : (
            <>
              <span>{formatDuration(isPlaying ? currentTime : 0)} / {formatDuration(duration || 0)}</span>
              {createdAt && (
                <>
                  <span className="text-muted-foreground/50">|</span>
                  <span>{formatDate(createdAt)}</span>
                </>
              )}
            </>
          )}
        </div>
      </div>
      
      {onDelete && (
        <Button
          onClick={onDelete}
          variant="ghost"
          size="icon"
          className="shrink-0 text-destructive hover:text-destructive"
          data-testid="button-delete-voice-note"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
