import { storage as dbStorage } from './storage';
import { objectStorageClient } from './objectStorage';
import crypto from 'crypto';
import { categorizePhoto } from './ai';
import { getErrorMessage } from "./lib/errors";

const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;

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
  
  // The path is relative (e.g., ".private/jobs/...") - use BUCKET_ID
  return { bucketName: BUCKET_ID, objectName: cleanPath };
}

// Check if object storage is configured
export function isObjectStorageConfigured(): boolean {
  return !!BUCKET_ID;
}

export interface PhotoUploadResult {
  success: boolean;
  photoId?: string;
  objectStorageKey?: string;
  error?: string;
}

export interface PhotoMetadata {
  fileName: string;
  fileSize: number;
  mimeType: string;
  category?: 'before' | 'after' | 'progress' | 'materials' | 'general';
  caption?: string;
  takenAt?: Date;
  latitude?: number;
  longitude?: number;
  address?: string;
}

export async function uploadJobPhoto(
  userId: string,
  jobId: string,
  fileBuffer: Buffer,
  metadata: PhotoMetadata
): Promise<PhotoUploadResult> {
  if (!isObjectStorageConfigured()) {
    return { 
      success: false, 
      error: 'Photo storage is not available. Please contact support to enable this feature.' 
    };
  }
  
  if (!PRIVATE_OBJECT_DIR) {
    return { success: false, error: 'Private object directory not configured' };
  }

  try {
    const fileExtension = metadata.fileName.split('.').pop() || 'jpg';
    const uniqueId = crypto.randomBytes(8).toString('hex');
    // Store the full path including bucket name for later retrieval
    const objectKey = `${PRIVATE_OBJECT_DIR}/jobs/${jobId}/${uniqueId}.${fileExtension}`;

    // Parse the path to get bucket name and object name
    const { bucketName, objectName } = parseObjectPath(objectKey);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    
    await file.save(fileBuffer, {
      contentType: metadata.mimeType,
      metadata: {
        userId,
        jobId,
        originalFileName: metadata.fileName,
        category: metadata.category || 'general',
        caption: metadata.caption,
        takenAt: metadata.takenAt?.toISOString(),
      },
    });

    const photo = await dbStorage.createJobPhoto({
      userId,
      jobId,
      objectStorageKey: objectKey,
      fileName: metadata.fileName,
      fileSize: metadata.fileSize,
      mimeType: metadata.mimeType,
      category: metadata.category || 'general',
      caption: metadata.caption,
      takenAt: metadata.takenAt,
      latitude: metadata.latitude,
      longitude: metadata.longitude,
      address: metadata.address,
    });

    if ((!metadata.category || metadata.category === 'general') && isImageMimeType(metadata.mimeType)) {
      triggerAutoCategorizationAsync(photo.id, userId, jobId, fileBuffer).catch(err => {
        console.error('[PhotoService] Auto-categorization background error:', err);
      });
    }

    return {
      success: true,
      photoId: photo.id,
      objectStorageKey: objectKey,
    };
  } catch (error: unknown) {
    console.error('Error uploading job photo:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

export async function getSignedPhotoUrl(
  objectStorageKey: string,
  expiresInMinutes: number = 60
): Promise<{ url?: string; error?: string }> {
  if (!objectStorageKey) {
    return { error: 'No object storage key provided' };
  }

  try {
    // Parse the full path to get bucket name and object name
    const { bucketName, objectName } = parseObjectPath(objectStorageKey);
    
    // Use Replit's sidecar to generate a signed URL (works in Replit environment)
    const request = {
      bucket_name: bucketName,
      object_name: objectName,
      method: 'GET',
      expires_at: new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString(),
    };
    
    console.log('[PhotoService] Requesting signed URL for:', { bucketName, objectName });
    
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
      console.error('[PhotoService] Sidecar error:', response.status, errorText);
      
      // Fallback: Try using the GCS client directly
      try {
        const bucket = objectStorageClient.bucket(bucketName);
        const file = bucket.file(objectName);
        
        const [signedUrl] = await file.getSignedUrl({
          action: 'read',
          expires: Date.now() + expiresInMinutes * 60 * 1000,
        });
        
        console.log('[PhotoService] GCS fallback successful');
        return { url: signedUrl };
      } catch (gcsError: unknown) {
        console.error('[PhotoService] GCS fallback failed:', getErrorMessage(gcsError));
        return { error: `Sidecar: ${errorText}, GCS: ${getErrorMessage(gcsError)}` };
      }
    }

    const { signed_url: signedURL } = await response.json();
    console.log('[PhotoService] Signed URL generated successfully');
    return { url: signedURL };
  } catch (error: unknown) {
    console.error('[PhotoService] Error getting signed URL:', error);
    return { error: getErrorMessage(error) };
  }
}

export async function deleteJobPhoto(
  photoId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const photo = await dbStorage.getJobPhoto(photoId, userId);
    if (!photo) {
      return { success: false, error: 'Photo not found' };
    }

    // Parse the path to get bucket name and object name
    const { bucketName, objectName } = parseObjectPath(photo.objectStorageKey);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    
    try {
      await file.delete();
    } catch (e) {
      console.warn('File may not exist in storage:', e);
    }

    await dbStorage.deleteJobPhoto(photoId, userId);
    
    return { success: true };
  } catch (error: unknown) {
    console.error('Error deleting job photo:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function getJobPhotos(
  jobId: string,
  userId: string
): Promise<Array<{
  id: string;
  fileName: string;
  category: string;
  caption: string | null;
  takenAt: Date | null;
  fileSize: number | null;
  mimeType: string | null;
  createdAt: Date | null;
  signedUrl?: string;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  aiSuggestedCategory?: string | null;
}>> {
  try {
    const photos = await dbStorage.getJobPhotos(jobId, userId);
    
    console.log(`[PhotoService] Getting signed URLs for ${photos.length} photos`);
    
    const photosWithUrls = await Promise.all(
      photos.map(async (photo) => {
        const { url, error } = await getSignedPhotoUrl(photo.objectStorageKey);
        if (error) {
          console.error(`[PhotoService] Failed to get URL for photo ${photo.id}:`, error);
        }
        return {
          id: photo.id,
          fileName: photo.fileName,
          category: photo.category || 'general',
          caption: photo.caption,
          takenAt: photo.takenAt,
          fileSize: photo.fileSize,
          mimeType: photo.mimeType,
          createdAt: photo.createdAt,
          signedUrl: url,
          latitude: photo.latitude,
          longitude: photo.longitude,
          address: photo.address,
          aiSuggestedCategory: photo.aiSuggestedCategory,
        };
      })
    );
    
    return photosWithUrls;
  } catch (error) {
    console.error('Error getting job photos:', error);
    return [];
  }
}

export async function updatePhotoMetadata(
  photoId: string,
  userId: string,
  updates: {
    category?: string;
    caption?: string;
    sortOrder?: number;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    await dbStorage.updateJobPhoto(photoId, userId, updates);
    return { success: true };
  } catch (error: unknown) {
    console.error('Error updating photo metadata:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

async function triggerAutoCategorizationAsync(
  photoId: string,
  userId: string,
  jobId: string,
  fileBuffer: Buffer
): Promise<void> {
  try {
    const settings = await dbStorage.getBusinessSettings(userId);
    if (settings && (settings.aiPhotoAnalysisEnabled === false || (settings as any).aiAutoCategorizationEnabled === false)) {
      return;
    }

    const job = await dbStorage.getJob(jobId, userId);
    const jobContext = job ? `${job.title || 'Untitled Job'} - ${job.description || ''} - Status: ${job.status || 'unknown'}` : 'Unknown job';

    console.log(`[PhotoService] Starting auto-categorization for photo ${photoId}`);
    const suggestedCategory = await categorizePhoto(fileBuffer, jobContext);

    if (suggestedCategory && suggestedCategory !== 'general') {
      await dbStorage.updateJobPhoto(photoId, userId, {
        category: suggestedCategory,
        aiSuggestedCategory: suggestedCategory,
      });
      console.log(`[PhotoService] Auto-categorized photo ${photoId} as '${suggestedCategory}'`);
    } else {
      await dbStorage.updateJobPhoto(photoId, userId, {
        aiSuggestedCategory: suggestedCategory || 'general',
      });
      console.log(`[PhotoService] Photo ${photoId} categorized as 'general' by AI`);
    }
  } catch (error) {
    console.error(`[PhotoService] Auto-categorization failed for photo ${photoId}:`, error);
  }
}
