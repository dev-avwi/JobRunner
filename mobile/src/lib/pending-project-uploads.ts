/**
 * Durable recovery for initial project document uploads.
 *
 * When a project is created, its selected documents are uploaded one by one.
 * If the app is killed, loses connection, or a single upload fails, the
 * pending upload metadata is persisted in AsyncStorage (keyed by job ID) and
 * the underlying file copies are kept under FileSystem.documentDirectory so
 * they survive cache eviction. The user can later retry or discard them from
 * a banner on the job detail screen.
 */
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

const STORAGE_PREFIX = 'pending_project_uploads:';
const REQUEST_STORAGE_PREFIX = 'pending_project_upload_request:';
const UPLOAD_DIR = `${FileSystem.documentDirectory}pending-project-uploads/`;

export interface PendingProjectUpload {
  clientId: string;
  uri: string; // durable file:// uri under documentDirectory
  name: string;
  mimeType: string;
  title: string;
  category: string;
}

interface SourceDocument {
  clientId: string;
  uri: string;
  name: string;
  mimeType: string;
  title: string;
  category: string;
}

function storageKey(jobId: string): string {
  return `${STORAGE_PREFIX}${jobId}`;
}

function requestStorageKey(requestId: string): string {
  return `${REQUEST_STORAGE_PREFIX}${requestId}`;
}

async function ensureUploadDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(UPLOAD_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(UPLOAD_DIR, { intermediates: true });
  }
}

function extensionFromName(name: string): string {
  const match = /\.([A-Za-z0-9]+)$/.exec(name || '');
  return match ? `.${match[1]}` : '';
}

/**
 * Copy a picked file (usually in the cache directory) into a durable location
 * under documentDirectory. Throws if a durable copy cannot be guaranteed so
 * project creation can stop before the project is saved.
 */
export async function copyToDurableLocation<T extends SourceDocument>(doc: T): Promise<T> {
  await ensureUploadDir();
  const ext = extensionFromName(doc.name);
  const destUri = `${UPLOAD_DIR}${doc.clientId}${ext}`;
  const sourceInfo = await FileSystem.getInfoAsync(doc.uri);
  if (!sourceInfo.exists) {
    throw new Error(`The selected file "${doc.name}" is no longer available`);
  }
  if (doc.uri === destUri) return doc;
  // Remove any stale copy first so overwrite is clean.
  await FileSystem.deleteAsync(destUri, { idempotent: true }).catch(() => {});
  await FileSystem.copyAsync({ from: doc.uri, to: destUri });
  return { ...doc, uri: destUri };
}

/** Persist the pending uploads for a job, replacing any existing list. */
export async function persistPendingUploads(jobId: string, docs: PendingProjectUpload[]): Promise<void> {
  if (!docs.length) {
    await AsyncStorage.removeItem(storageKey(jobId));
    return;
  }
  await AsyncStorage.setItem(storageKey(jobId), JSON.stringify(docs));
}

export async function persistPendingUploadsForRequest(
  requestId: string,
  docs: PendingProjectUpload[],
): Promise<void> {
  if (!docs.length) {
    await AsyncStorage.removeItem(requestStorageKey(requestId));
    return;
  }
  await AsyncStorage.setItem(requestStorageKey(requestId), JSON.stringify(docs));
}

export async function discardPendingUploadsForRequest(requestId: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(requestStorageKey(requestId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const doc of parsed as PendingProjectUpload[]) {
          await removeFileCopy(doc.uri);
        }
      }
    }
  } catch (err) {
    if (__DEV__) console.log('[pendingUploads] discardPendingUploadsForRequest error:', err);
  } finally {
    await AsyncStorage.removeItem(requestStorageKey(requestId)).catch(() => {});
  }
}

export async function claimPendingUploadsForJob(
  requestId: string,
  jobId: string,
): Promise<PendingProjectUpload[]> {
  const existing = await getPendingUploads(jobId);
  if (existing.length > 0) return existing;
  const raw = await AsyncStorage.getItem(requestStorageKey(requestId));
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    await AsyncStorage.removeItem(requestStorageKey(requestId));
    return [];
  }
  const docs = parsed as PendingProjectUpload[];
  await persistPendingUploads(jobId, docs);
  await AsyncStorage.removeItem(requestStorageKey(requestId));
  return docs;
}

/** Load the pending uploads for a job (empty array when none). */
export async function getPendingUploads(
  jobId: string,
  creationRequestId?: string | null,
): Promise<PendingProjectUpload[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(jobId));
    if (!raw) {
      return creationRequestId
        ? await claimPendingUploadsForJob(creationRequestId, jobId)
        : [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as PendingProjectUpload[];
  } catch (err) {
    if (__DEV__) console.log('[pendingUploads] getPendingUploads error:', err);
    return [];
  }
}

/** Delete a single durable file copy (best effort). */
async function removeFileCopy(uri: string): Promise<void> {
  if (typeof uri !== 'string' || !uri.startsWith(UPLOAD_DIR)) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch (err) {
    if (__DEV__) console.log('[pendingUploads] removeFileCopy error:', err);
  }
}

export async function removeDurableFileCopy(uri: string): Promise<void> {
  await removeFileCopy(uri);
}

/**
 * Discard all pending uploads for a job: removes the metadata entry and the
 * durable file copies.
 */
export async function discardPendingUploads(jobId: string): Promise<void> {
  const docs = await getPendingUploads(jobId);
  for (const doc of docs) {
    await removeFileCopy(doc.uri);
  }
  try {
    await AsyncStorage.removeItem(storageKey(jobId));
  } catch (err) {
    if (__DEV__) console.log('[pendingUploads] discardPendingUploads error:', err);
  }
}

/**
 * Upload the given documents to the project. Each document includes its
 * clientId as the clientGeneratedId form field so the server can dedupe
 * retries. Returns the list of documents that failed to upload.
 */
export async function uploadPendingDocuments(
  jobId: string,
  docs: PendingProjectUpload[],
): Promise<PendingProjectUpload[]> {
  const failed: PendingProjectUpload[] = [];
  for (const [index, doc] of docs.entries()) {
    try {
      const fd = new FormData();
      fd.append('file', {
        uri: doc.uri,
        name: doc.name,
        type: doc.mimeType,
      } as any);
      fd.append('title', doc.title || doc.name);
      fd.append('category', doc.category || 'Other');
      fd.append('clientGeneratedId', doc.clientId);
      const result = await api.uploadFile(`/api/jobs/${jobId}/project-documents`, fd);
      if (result.error) {
        failed.push(doc);
        if (__DEV__) console.log('[pendingUploads] upload failed:', result.error);
      } else {
        // Remove this item from durable metadata before deleting its local file.
        // If the app stops before this point, the idempotent server upload can
        // safely be retried. If it stops after this point, the upload is known
        // to be complete and no recovery prompt is needed.
        await persistPendingUploads(jobId, [...failed, ...docs.slice(index + 1)]);
        await removeFileCopy(doc.uri);
      }
    } catch (err) {
      failed.push(doc);
      if (__DEV__) console.log('[pendingUploads] upload error:', err);
    }
  }
  await persistPendingUploads(jobId, failed);
  return failed;
}

/**
 * Retry the persisted pending uploads for a job. Successful uploads are
 * removed from storage and their file copies cleaned up; failures are retained.
 * Returns the remaining pending uploads (empty when all succeeded).
 */
export async function retryPendingUploads(jobId: string): Promise<PendingProjectUpload[]> {
  const docs = await getPendingUploads(jobId);
  if (!docs.length) return [];
  const failed = await uploadPendingDocuments(jobId, docs);
  await persistPendingUploads(jobId, failed);
  return failed;
}
