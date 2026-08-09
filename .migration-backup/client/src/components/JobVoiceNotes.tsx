import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { VoiceRecorder, VoiceNotePlayer } from '@/components/ui/voice-recorder';
import { Mic, Plus, Loader2, Sparkles, FileText, Copy, Edit, X, Calendar, ClipboardList, ShoppingCart, FileQuestion } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface DetectedAction {
  type: 'reminder' | 'follow_up' | 'material_need' | 'quote_request';
  description: string;
  date?: string;
  confirmed?: boolean;
  dismissed?: boolean;
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
  detectedActions?: DetectedAction[] | null;
}

interface JobVoiceNotesProps {
  jobId: string;
  canUpload?: boolean;
  existingNotes?: string;
  onNotesUpdated?: () => void;
}

export function JobVoiceNotes({ jobId, canUpload = true, existingNotes, onNotesUpdated }: JobVoiceNotesProps) {
  const [showRecorder, setShowRecorder] = useState(false);
  // Scope editing state per note using a Map
  const [editingStates, setEditingStates] = useState<Record<string, string>>({});
  const [addingNoteId, setAddingNoteId] = useState<string | null>(null);
  const { toast } = useToast();

  const isEditingNote = (noteId: string) => noteId in editingStates;
  const getEditedText = (noteId: string) => editingStates[noteId] || '';
  
  const startEditing = (noteId: string, transcription: string) => {
    setEditingStates(prev => ({ ...prev, [noteId]: transcription }));
  };
  
  const updateEditedText = (noteId: string, text: string) => {
    setEditingStates(prev => ({ ...prev, [noteId]: text }));
  };
  
  const cancelEditing = (noteId: string) => {
    setEditingStates(prev => {
      const next = { ...prev };
      delete next[noteId];
      return next;
    });
  };

  const { data: voiceNotes = [], isLoading } = useQuery<VoiceNote[]>({
    queryKey: ['/api/jobs', jobId, 'voice-notes'],
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ audioBlob, duration }: { audioBlob: Blob; duration: number }) => {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(audioBlob);
      });
      const audioData = await base64Promise;
      
      return apiRequest('POST', `/api/jobs/${jobId}/voice-notes`, {
        audioData,
        fileName: `voice-note-${Date.now()}.webm`,
        mimeType: audioBlob.type || 'audio/webm',
        duration,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'voice-notes'] });
      setShowRecorder(false);
      toast({
        title: 'Voice note saved',
        description: 'Your voice note has been uploaded successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload voice note.',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (voiceNoteId: string) => {
      return apiRequest('DELETE', `/api/jobs/${jobId}/voice-notes/${voiceNoteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'voice-notes'] });
      toast({
        title: 'Voice note deleted',
        description: 'The voice note has been removed.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Delete failed',
        description: error.message || 'Failed to delete voice note.',
        variant: 'destructive',
      });
    },
  });

  const transcribeMutation = useMutation({
    mutationFn: async (voiceNoteId: string) => {
      return apiRequest('POST', `/api/jobs/${jobId}/voice-notes/${voiceNoteId}/transcribe`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'voice-notes'] });
      toast({
        title: 'Transcription complete',
        description: 'Your voice note has been transcribed using AI.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Transcription failed',
        description: error.message || 'Failed to transcribe voice note.',
        variant: 'destructive',
      });
    },
  });

  const summarizeMutation = useMutation({
    mutationFn: async (voiceNoteId: string) => {
      return apiRequest('POST', `/api/jobs/${jobId}/voice-notes/${voiceNoteId}/summarize`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'voice-notes'] });
      toast({
        title: 'Summary ready',
        description: 'Key points extracted from the voice note.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Summary failed',
        description: error.message || 'Failed to summarise voice note.',
        variant: 'destructive',
      });
    },
  });

  const confirmActionMutation = useMutation({
    mutationFn: async ({ voiceNoteId, actionIndex }: { voiceNoteId: string; actionIndex: number }) => {
      return apiRequest('POST', `/api/jobs/${jobId}/voice-notes/${voiceNoteId}/confirm-action`, {
        actionIndex,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'voice-notes'] });
      toast({
        title: 'Action created',
        description: 'The suggested action has been created.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to create action',
        description: error.message || 'Could not create the action.',
        variant: 'destructive',
      });
    },
  });

  const dismissActionMutation = useMutation({
    mutationFn: async ({ voiceNoteId, actionIndex }: { voiceNoteId: string; actionIndex: number }) => {
      return apiRequest('POST', `/api/jobs/${jobId}/voice-notes/${voiceNoteId}/dismiss-action`, {
        actionIndex,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'voice-notes'] });
    },
  });

  const handleSave = (audioBlob: Blob, duration: number) => {
    uploadMutation.mutate({ audioBlob, duration });
  };

  const handleCopyTranscription = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: 'Copied',
        description: 'Transcription copied to clipboard.',
      });
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Could not copy to clipboard.',
        variant: 'destructive',
      });
    }
  };

  const handleAddToNotes = async (noteId: string, transcription: string) => {
    if (!transcription.trim()) return;
    
    setAddingNoteId(noteId);
    try {
      await apiRequest("POST", `/api/jobs/${jobId}/notes`, { 
        content: transcription.trim() 
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'notes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId] });
      
      toast({
        title: 'Added to Notes',
        description: 'Transcription has been added to job notes.',
      });
      
      cancelEditing(noteId);
      onNotesUpdated?.();
    } catch (error: any) {
      toast({
        title: 'Failed to Add',
        description: error.message || 'Could not add transcription to notes.',
        variant: 'destructive',
      });
    } finally {
      setAddingNoteId(null);
    }
  };

  const getActionIcon = (type: DetectedAction['type']) => {
    switch (type) {
      case 'reminder': return Calendar;
      case 'follow_up': return ClipboardList;
      case 'material_need': return ShoppingCart;
      case 'quote_request': return FileQuestion;
    }
  };

  const renderSuggestedActions = (note: VoiceNote) => {
    const actions = note.detectedActions;
    if (!actions || actions.length === 0) return null;

    const visibleActions = actions.filter(a => !a.confirmed && !a.dismissed);
    if (visibleActions.length === 0) return null;

    return (
      <div className="ml-2 mt-2 rounded-md border border-dashed border-muted-foreground/30 p-2.5">
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Suggested Actions</span>
        </div>
        <div className="space-y-1.5">
          {actions.map((action, index) => {
            if (action.confirmed || action.dismissed) return null;
            const Icon = getActionIcon(action.type);
            const isPending = confirmActionMutation.isPending || dismissActionMutation.isPending;
            return (
              <div
                key={index}
                className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-1.5"
              >
                <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs">{action.description}</span>
                  {action.date && (
                    <span className="text-xs text-muted-foreground ml-1.5">({action.date})</span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    disabled={isPending}
                    onClick={() => confirmActionMutation.mutate({ voiceNoteId: note.id, actionIndex: index })}
                    data-testid={`button-confirm-action-${note.id}-${index}`}
                  >
                    {confirmActionMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <Plus className="h-3 w-3 mr-0.5" />
                        Create
                      </>
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    disabled={isPending}
                    onClick={() => dismissActionMutation.mutate({ voiceNoteId: note.id, actionIndex: index })}
                    data-testid={`button-dismiss-action-${note.id}-${index}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mic className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
            Voice Notes
          </CardTitle>
          {canUpload && !showRecorder && (
            <Button
              onClick={() => setShowRecorder(true)}
              size="sm"
              variant="outline"
              data-testid="button-add-voice-note"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {showRecorder && (
          <VoiceRecorder
            onSave={handleSave}
            onCancel={() => setShowRecorder(false)}
            isUploading={uploadMutation.isPending}
          />
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : voiceNotes.length > 0 ? (
          <div className="space-y-3">
            {voiceNotes.map((note) => (
              <div key={note.id} className="space-y-2">
                <VoiceNotePlayer
                  signedUrl={note.signedUrl || ''}
                  fallbackUrl={`/api/jobs/${jobId}/voice-notes/${note.id}/stream`}
                  title={note.title || undefined}
                  duration={note.duration || undefined}
                  createdAt={note.createdAt || undefined}
                  onDelete={canUpload ? () => deleteMutation.mutate(note.id) : undefined}
                />
                {note.transcription ? (
                  <>
                    <div className="bg-muted/50 rounded-md p-3 ml-2 border-l-2 border-primary/30">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <FileText className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">AI Transcription</span>
                      </div>
                      {isEditingNote(note.id) ? (
                        <div className="space-y-2">
                          <Textarea
                            value={getEditedText(note.id)}
                            onChange={(e) => updateEditedText(note.id, e.target.value)}
                            className="min-h-[100px] text-sm"
                            data-testid={`textarea-edit-transcription-${note.id}`}
                          />
                          <div className="flex gap-2 flex-wrap">
                            <Button
                              size="sm"
                              onClick={() => handleAddToNotes(note.id, getEditedText(note.id))}
                              disabled={addingNoteId === note.id || !getEditedText(note.id).trim()}
                              data-testid={`button-save-to-notes-${note.id}`}
                            >
                              {addingNoteId === note.id ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <Plus className="h-3 w-3 mr-1" />
                              )}
                              Add to Notes
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => cancelEditing(note.id)}
                              disabled={addingNoteId === note.id}
                              data-testid={`button-cancel-edit-${note.id}`}
                            >
                              <X className="h-3 w-3 mr-1" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm leading-relaxed mb-2" data-testid={`transcription-${note.id}`}>
                            {note.transcription}
                          </p>
                          <div className="flex gap-2 flex-wrap">
                            <Button
                              size="sm"
                              onClick={() => handleAddToNotes(note.id, note.transcription!)}
                              disabled={addingNoteId === note.id}
                              data-testid={`button-add-to-notes-${note.id}`}
                            >
                              {addingNoteId === note.id ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <Plus className="h-3 w-3 mr-1" />
                              )}
                              Add to Notes
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCopyTranscription(note.transcription!)}
                              data-testid={`button-copy-transcription-${note.id}`}
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Copy
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEditing(note.id, note.transcription!)}
                              data-testid={`button-edit-transcription-${note.id}`}
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            {!note.summary && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => summarizeMutation.mutate(note.id)}
                                disabled={summarizeMutation.isPending}
                                data-testid={`button-summarize-${note.id}`}
                              >
                                {summarizeMutation.isPending && summarizeMutation.variables === note.id ? (
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                ) : (
                                  <Sparkles className="h-3 w-3 mr-1" />
                                )}
                                Summarise
                              </Button>
                            )}
                          </div>
                          {note.summary && (
                            <div className="mt-3 pt-3 border-t">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <Sparkles className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs font-medium text-muted-foreground">AI Summary</span>
                              </div>
                              <p className="text-sm leading-relaxed whitespace-pre-line" data-testid={`summary-${note.id}`}>
                                {note.summary}
                              </p>
                              <div className="flex gap-2 flex-wrap mt-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleAddToNotes(note.id, note.summary!)}
                                  disabled={addingNoteId === note.id}
                                  data-testid={`button-add-summary-to-notes-${note.id}`}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add to Notes
                                </Button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    {renderSuggestedActions(note)}
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-2 text-xs"
                    onClick={() => transcribeMutation.mutate(note.id)}
                    disabled={transcribeMutation.isPending}
                    data-testid={`button-transcribe-${note.id}`}
                  >
                    {transcribeMutation.isPending ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3 mr-1" />
                    )}
                    {transcribeMutation.isPending ? 'Transcribing...' : 'AI Transcribe'}
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : !showRecorder ? (
          <div className="text-center py-4 text-muted-foreground">
            <Mic className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No voice notes yet</p>
            {canUpload && (
              <p className="text-xs mt-1">Record audio notes for this job</p>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
