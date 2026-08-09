import { storage as dbStorage } from './storage';
import { objectStorageClient } from './objectStorage';
import crypto from 'crypto';
import OpenAI from 'openai';
import { getErrorMessage } from "./lib/errors";

const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

// Sanitize PRIVATE_OBJECT_DIR - strip bucket name prefix if present
function getPrivateObjectDir(): string {
  let dir = process.env.PRIVATE_OBJECT_DIR || '.private';
  // If the path contains the bucket name, strip it
  if (BUCKET_ID && dir.includes(BUCKET_ID)) {
    // Remove the bucket prefix (e.g., /replit-objstore-xxx/.private -> .private)
    dir = dir.replace(new RegExp(`^/?${BUCKET_ID}/`), '');
  }
  // Remove leading slash if present
  if (dir.startsWith('/')) {
    dir = dir.slice(1);
  }
  return dir;
}

const PRIVATE_OBJECT_DIR = getPrivateObjectDir();

// Parse object path - extract bucket name and object name from the full path
// Path format: /<bucket_name>/<object_name> or just <object_path> (relative to BUCKET_ID)
function parseObjectPath(objectKey: string): { bucketName: string; objectName: string } {
  if (!BUCKET_ID) {
    throw new Error("Object storage bucket not configured");
  }
  
  // Clean the path
  let cleanPath = objectKey.startsWith("/") ? objectKey.slice(1) : objectKey;
  
  // Check if the path starts with the bucket name
  if (cleanPath.startsWith(BUCKET_ID + "/")) {
    // Remove bucket prefix and use as object name
    const objectName = cleanPath.slice(BUCKET_ID.length + 1);
    return { bucketName: BUCKET_ID, objectName };
  }
  
  // Check if the path starts with a replit-objstore bucket pattern
  if (cleanPath.startsWith("replit-objstore-")) {
    const slashIndex = cleanPath.indexOf("/");
    if (slashIndex > 0) {
      const bucketName = cleanPath.slice(0, slashIndex);
      const objectName = cleanPath.slice(slashIndex + 1);
      return { bucketName, objectName };
    }
  }
  
  // The path is relative (e.g., ".private/voice-notes/...") - use BUCKET_ID
  return { bucketName: BUCKET_ID, objectName: cleanPath };
}

export function isObjectStorageConfigured(): boolean {
  return !!BUCKET_ID;
}

export interface VoiceNoteUploadResult {
  success: boolean;
  voiceNoteId?: string;
  objectStorageKey?: string;
  error?: string;
}

export interface VoiceNoteMetadata {
  fileName: string;
  fileSize: number;
  mimeType: string;
  duration?: number;
  title?: string;
}

export async function uploadVoiceNote(
  userId: string,
  jobId: string,
  fileBuffer: Buffer,
  metadata: VoiceNoteMetadata
): Promise<VoiceNoteUploadResult> {
  if (!isObjectStorageConfigured()) {
    return { 
      success: false, 
      error: 'Voice note storage is not available. Please contact support to enable this feature.' 
    };
  }
  
  if (!BUCKET_ID) {
    return { success: false, error: 'Object storage bucket not configured' };
  }

  try {
    const fileExtension = metadata.fileName.split('.').pop() || 'webm';
    const uniqueId = crypto.randomBytes(8).toString('hex');
    const objectKey = `${PRIVATE_OBJECT_DIR}/voice-notes/${jobId}/${uniqueId}.${fileExtension}`;

    // Use Replit's object storage client
    console.log('[VoiceNoteService] Uploading voice note:', {
      bucketId: BUCKET_ID,
      objectKey,
      fileSize: fileBuffer.length,
      mimeType: metadata.mimeType,
    });
    
    const bucket = objectStorageClient.bucket(BUCKET_ID);
    const file = bucket.file(objectKey);
    
    await file.save(fileBuffer, {
      contentType: metadata.mimeType,
      metadata: {
        userId,
        jobId,
        originalFileName: metadata.fileName,
        duration: metadata.duration?.toString(),
        title: metadata.title,
      },
    });
    
    // Verify the file was uploaded
    const [exists] = await file.exists();
    console.log('[VoiceNoteService] Upload complete, file exists:', exists);

    const voiceNote = await dbStorage.createVoiceNote({
      userId,
      jobId,
      objectStorageKey: objectKey,
      fileName: metadata.fileName,
      fileSize: metadata.fileSize,
      mimeType: metadata.mimeType,
      duration: metadata.duration,
      title: metadata.title,
      recordedBy: userId,
    });

    return {
      success: true,
      voiceNoteId: voiceNote.id,
      objectStorageKey: objectKey,
    };
  } catch (error: unknown) {
    console.error('Error uploading voice note:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function getSignedVoiceNoteUrl(
  objectStorageKey: string,
  expiresInMinutes: number = 60
): Promise<{ url?: string; error?: string }> {
  if (!objectStorageKey) {
    return { error: 'No object storage key provided' };
  }

  try {
    // Parse the full path to get bucket name and object name
    const { bucketName, objectName } = parseObjectPath(objectStorageKey);
    
    console.log('[VoiceNoteService] Requesting signed URL for:', { bucketName, objectName });
    
    // Use Replit's sidecar to generate a signed URL (works in Replit environment)
    const request = {
      bucket_name: bucketName,
      object_name: objectName,
      method: 'GET',
      expires_at: new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString(),
    };
    
    const response = await fetch(
      `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[VoiceNoteService] Sidecar error:', response.status, errorText);
      
      // Fallback: Try using Replit's object storage client directly
      try {
        const bucket = objectStorageClient.bucket(bucketName);
        const file = bucket.file(objectName);
        
        const [signedUrl] = await file.getSignedUrl({
          action: 'read',
          expires: Date.now() + expiresInMinutes * 60 * 1000,
        });
        
        console.log('[VoiceNoteService] GCS fallback successful');
        return { url: signedUrl };
      } catch (gcsError: unknown) {
        console.error('[VoiceNoteService] GCS fallback failed:', getErrorMessage(gcsError));
        return { error: `Sidecar: ${errorText}, GCS: ${getErrorMessage(gcsError)}` };
      }
    }

    const { signed_url: signedURL } = await response.json();
    console.log('[VoiceNoteService] Signed URL generated successfully');
    return { url: signedURL };
  } catch (error: unknown) {
    console.error('[VoiceNoteService] Error getting signed URL:', error);
    return { error: getErrorMessage(error) };
  }
}

export async function deleteVoiceNote(
  voiceNoteId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const voiceNote = await dbStorage.getVoiceNote(voiceNoteId, userId);
    if (!voiceNote) {
      return { success: false, error: 'Voice note not found' };
    }

    // Parse the path to get bucket name and object name
    const { bucketName, objectName } = parseObjectPath(voiceNote.objectStorageKey);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    
    try {
      await file.delete();
    } catch (e) {
      console.warn('File may not exist in storage:', e);
    }

    await dbStorage.deleteVoiceNote(voiceNoteId, userId);
    
    return { success: true };
  } catch (error: unknown) {
    console.error('Error deleting voice note:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function getJobVoiceNotes(
  jobId: string,
  userId: string
): Promise<Array<{
  id: string;
  fileName: string;
  duration: number | null;
  title: string | null;
  transcription: string | null;
  detectedActions: DetectedAction[] | null;
  createdAt: Date | null;
  signedUrl?: string;
}>> {
  try {
    const voiceNotes = await dbStorage.getJobVoiceNotes(jobId, userId);
    
    const notesWithUrls = await Promise.all(
      voiceNotes.map(async (note) => {
        const { url } = await getSignedVoiceNoteUrl(note.objectStorageKey);
        return {
          id: note.id,
          fileName: note.fileName,
          duration: note.duration,
          title: note.title,
          transcription: note.transcription,
          detectedActions: (note.detectedActions as DetectedAction[] | null) || null,
          createdAt: note.createdAt,
          signedUrl: url,
        };
      })
    );
    
    return notesWithUrls;
  } catch (error) {
    console.error('Error getting job voice notes:', error);
    return [];
  }
}

export async function updateVoiceNoteTitle(
  voiceNoteId: string,
  userId: string,
  title: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await dbStorage.updateVoiceNote(voiceNoteId, userId, { title });
    return { success: true };
  } catch (error: unknown) {
    console.error('Error updating voice note title:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

// AI Transcription using OpenAI Whisper
// Note: Whisper API requires direct OpenAI API key (not supported by Replit AI Integration)
export async function transcribeVoiceNote(
  voiceNoteId: string,
  userId: string
): Promise<{ success: boolean; transcription?: string; error?: string }> {
  try {
    const { default: OpenAI } = await import('openai');
    
    // Check for direct OpenAI API key first (required for Whisper audio transcription)
    // Replit AI Integration doesn't support audio endpoints
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { 
        success: false, 
        error: 'Voice transcription requires an OpenAI API key. Please add OPENAI_API_KEY in Settings > Secrets to enable this feature.' 
      };
    }
    
    const openai = new OpenAI({
      apiKey: apiKey
    });
    
    // Get the voice note from database
    const voiceNote = await dbStorage.getVoiceNote(voiceNoteId, userId);
    if (!voiceNote) {
      return { success: false, error: 'Voice note not found' };
    }
    
    // Download the audio file from object storage
    const audioBuffer = await downloadVoiceNoteFile(voiceNote.objectStorageKey);
    if (!audioBuffer) {
      return { success: false, error: 'Failed to download audio file' };
    }
    
    // Create a File object for OpenAI
    const file = new File([audioBuffer], voiceNote.fileName || 'audio.webm', {
      type: voiceNote.mimeType || 'audio/webm'
    });
    
    console.log('[VoiceNoteService] Transcribing audio file:', {
      voiceNoteId,
      fileName: voiceNote.fileName,
      mimeType: voiceNote.mimeType,
      size: audioBuffer.length
    });
    
    // Call OpenAI Whisper for transcription (queued for backpressure)
    const { aiQueue } = await import('./concurrency');
    const transcription = await aiQueue.run(() => openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'en',
      response_format: 'text'
    }));
    
    console.log('[VoiceNoteService] Transcription complete:', transcription.substring(0, 100) + '...');
    
    const transcriptionText = transcription.toString();
    
    await dbStorage.updateVoiceNote(voiceNoteId, userId, { 
      transcription: transcriptionText 
    });
    
    detectActionsFromTranscription(transcriptionText, voiceNoteId, userId).catch(err => {
      console.error('[VoiceNoteService] Background action detection failed:', err.message);
    });
    
    return { success: true, transcription: transcriptionText };
  } catch (error: unknown) {
    console.error('Error transcribing voice note:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export interface DetectedAction {
  type: 'reminder' | 'follow_up' | 'material_need' | 'quote_request';
  description: string;
  date?: string;
  confirmed?: boolean;
  dismissed?: boolean;
}

export async function detectActionsFromTranscription(
  transcription: string,
  voiceNoteId: string,
  userId: string
): Promise<DetectedAction[]> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.log('[VoiceNoteService] No OpenAI API key, skipping action detection');
      return [];
    }

    const openai = new OpenAI({ apiKey });

    const response = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'system',
          content: 'Analyse this voice note from an Australian tradesperson. Extract any action items: reminders (with dates), follow-up tasks, material needs, quote requests. Return JSON array of actions with type, description, and date (if detected). Types: reminder, follow_up, material_need, quote_request. Be conservative — only extract clear actions.'
        },
        {
          role: 'user',
          content: transcription
        }
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 2500,
    });

    const content = response.choices[0]?.message?.content || '{"actions": []}';
    const parsed = JSON.parse(content);
    const actions: DetectedAction[] = Array.isArray(parsed) ? parsed : (parsed.actions || []);

    const validActions = actions
      .filter((a: any) => a && a.type && a.description)
      .map((a: any) => ({
        type: a.type as DetectedAction['type'],
        description: a.description,
        date: a.date || undefined,
        confirmed: false,
        dismissed: false,
      }));

    if (validActions.length > 0) {
      await dbStorage.updateVoiceNote(voiceNoteId, userId, {
        detectedActions: validActions as any,
      });
      console.log(`[VoiceNoteService] Detected ${validActions.length} actions from transcription`);
    }

    return validActions;
  } catch (error: unknown) {
    console.error('[VoiceNoteService] Error detecting actions:', getErrorMessage(error));
    return [];
  }
}

// Summarise free text (voice note transcript or job notes) into concise key points
export async function summarizeTextForOwner(
  text: string,
  context: 'voice_note' | 'job_notes'
): Promise<{ success: boolean; summary?: string; error?: string }> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { success: false, error: 'AI summarisation is not configured' };
    }
    const trimmed = (text || '').trim();
    if (!trimmed) {
      return { success: false, error: 'Nothing to summarise' };
    }
    if (trimmed.length < 40) {
      // Too short to be worth an AI call — just return it as-is
      return { success: true, summary: trimmed };
    }

    const openai = new OpenAI({ apiKey });
    const contextLine = context === 'voice_note'
      ? 'This is a transcribed voice note recorded on-site by a worker for an Australian trade business.'
      : 'These are the running job notes for an Australian trade business job.';

    const response = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'system',
          content: `${contextLine} Summarise it for the business owner as short bullet points covering ALL key information: work done, problems found, materials needed, client requests, follow-ups, times/dates, and anything affecting cost or safety. Use plain Australian English, one bullet per point, each starting with "- ". No preamble, no headings — just the bullets. If there is genuinely nothing meaningful, reply with a single bullet stating that.`
        },
        { role: 'user', content: trimmed.slice(0, 24000) }
      ],
      max_completion_tokens: 2000,
    });

    const summary = response.choices[0]?.message?.content?.trim();
    if (!summary) {
      return { success: false, error: 'AI returned an empty summary' };
    }
    return { success: true, summary };
  } catch (error: unknown) {
    console.error('[VoiceNoteService] Error summarising text:', getErrorMessage(error));
    return { success: false, error: 'Failed to generate summary' };
  }
}

// Summarise a voice note's transcription and persist the summary on the record
export async function summarizeVoiceNote(
  voiceNoteId: string,
  userId: string,
  expectedJobId?: string
): Promise<{ success: boolean; summary?: string; error?: string }> {
  const voiceNote = await dbStorage.getVoiceNote(voiceNoteId, userId);
  if (!voiceNote) {
    return { success: false, error: 'Voice note not found' };
  }
  if (expectedJobId && voiceNote.jobId !== expectedJobId) {
    return { success: false, error: 'Voice note not found' };
  }
  if (!voiceNote.transcription) {
    return { success: false, error: 'Transcribe the voice note first' };
  }
  const result = await summarizeTextForOwner(voiceNote.transcription, 'voice_note');
  if (result.success && result.summary) {
    try {
      await dbStorage.updateVoiceNote(voiceNoteId, userId, { summary: result.summary } as any);
    } catch (e) {
      console.error('[VoiceNoteService] Failed to persist summary:', getErrorMessage(e));
      return { success: false, error: 'Failed to save the summary — try again' };
    }
  }
  return result;
}

// Download voice note file from object storage
async function downloadVoiceNoteFile(objectStorageKey: string): Promise<Buffer | null> {
  if (!objectStorageKey || !BUCKET_ID) {
    return null;
  }
  
  try {
    const { bucketName, objectName } = parseObjectPath(objectStorageKey);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    
    const [contents] = await file.download();
    return contents;
  } catch (error) {
    console.error('Error downloading voice note file:', error);
    return null;
  }
}
