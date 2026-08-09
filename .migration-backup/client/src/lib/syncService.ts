import {
  getSyncQueue,
  addToSyncQueue,
  removeSyncItem,
  saveItem,
  getAllItems,
  getItem,
  deleteItem,
  getFileAttachment,
  markFileAttachmentSynced,
  type SyncOperation,
} from './offlineStorage';
import { getSessionToken } from './queryClient';
import { queryClient } from './queryClient';
import { syncManager } from './syncManager';
import { withSyncLock } from './syncLock';

const MAX_RETRIES = 3;
const ID_MAPPING_KEY = 'jobrunner_id_mapping';

export interface IdMapping {
  [offlineId: string]: number | string;
}

function getIdMapping(): IdMapping {
  try {
    const stored = localStorage.getItem(ID_MAPPING_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveIdMapping(mapping: IdMapping): void {
  try {
    localStorage.setItem(ID_MAPPING_KEY, JSON.stringify(mapping));
  } catch {
    console.warn('Failed to save ID mapping');
  }
}

export function addIdMapping(offlineId: string, serverId: number | string): void {
  const mapping = getIdMapping();
  mapping[offlineId] = serverId;
  saveIdMapping(mapping);
}

export function getServerId(offlineId: string): number | string | undefined {
  return getIdMapping()[offlineId];
}

export function resolveId(id: string | number): string | number {
  if (typeof id === 'string' && id.startsWith('offline_')) {
    return getServerId(id) ?? id;
  }
  return id;
}

export function clearIdMapping(): void {
  localStorage.removeItem(ID_MAPPING_KEY);
}

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: Array<{ operation: SyncOperation; error: string }>;
}

async function makeApiCall(
  endpoint: string,
  method: string,
  data?: unknown
): Promise<Response> {
  const headers: HeadersInit = {};
  
  if (data) {
    headers['Content-Type'] = 'application/json';
  }
  
  const token = getSessionToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(endpoint, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: 'include',
  });
}

async function updateRelatedReferences(
  storeName: 'clients' | 'jobs' | 'quotes' | 'invoices',
  offlineId: string,
  serverId: number | string
): Promise<void> {
  if (storeName === 'clients') {
    const jobs = await getAllItems<any>('jobs');
    for (const job of jobs) {
      if (job.clientId === offlineId) {
        job.clientId = serverId;
        await saveItem('jobs', job);
      }
    }

    const quotes = await getAllItems<any>('quotes');
    for (const quote of quotes) {
      if (quote.clientId === offlineId) {
        quote.clientId = serverId;
        await saveItem('quotes', quote);
      }
    }

    const invoices = await getAllItems<any>('invoices');
    for (const invoice of invoices) {
      if (invoice.clientId === offlineId) {
        invoice.clientId = serverId;
        await saveItem('invoices', invoice);
      }
    }
  }

  if (storeName === 'jobs') {
    const quotes = await getAllItems<any>('quotes');
    for (const quote of quotes) {
      if (quote.jobId === offlineId) {
        quote.jobId = serverId;
        await saveItem('quotes', quote);
      }
    }

    const invoices = await getAllItems<any>('invoices');
    for (const invoice of invoices) {
      if (invoice.jobId === offlineId) {
        invoice.jobId = serverId;
        await saveItem('invoices', invoice);
      }
    }
  }

  if (storeName === 'quotes') {
    const invoices = await getAllItems<any>('invoices');
    for (const invoice of invoices) {
      if (invoice.quoteId === offlineId) {
        invoice.quoteId = serverId;
        await saveItem('invoices', invoice);
      }
    }
  }
}

function resolveDataReferences(data: any): any {
  if (!data || typeof data !== 'object') return data;
  
  const resolved = { ...data };
  const mapping = getIdMapping();
  
  const refFields = ['clientId', 'jobId', 'quoteId', 'invoiceId'];
  for (const field of refFields) {
    if (resolved[field] && typeof resolved[field] === 'string' && resolved[field].startsWith('offline_')) {
      const serverId = mapping[resolved[field]];
      if (serverId) {
        resolved[field] = serverId;
      }
    }
  }
  
  return resolved;
}

interface UploadedAttachment {
  id: string;
  url: string;
  type: string;
  filename: string;
}

interface AttachmentPhoto {
  url: string;
  uploadedAt: string;
  source: string;
}

interface AttachmentFile {
  url: string;
  filename: string;
  uploadedAt: string;
}

async function uploadAndLinkAttachments(
  operation: SyncOperation,
  entityId: string | number
): Promise<void> {
  if (!operation.fileAttachmentIds?.length) return;

  const uploaded: UploadedAttachment[] = [];

  for (const attachmentId of operation.fileAttachmentIds) {
    const attachment = await getFileAttachment(attachmentId);
    if (!attachment || attachment.synced) continue;

    const formData = new FormData();
    formData.append('file', attachment.blob, attachment.filename);
    formData.append('type', `${attachment.entityType}_${attachment.type}`);

    const response = await fetch('/api/upload', {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Attachment upload failed: ${response.statusText}`);
    }

    const uploadResult = await response.json();
    const url = uploadResult.url || '';
    if (url) {
      uploaded.push({ id: attachmentId, url, type: attachment.type, filename: attachment.filename });
    }
  }

  if (uploaded.length === 0) return;

  const entityEndpoint = `/api/${operation.storeName}/${entityId}`;
  const entityResponse = await makeApiCall(entityEndpoint, 'GET');
  if (!entityResponse.ok) {
    throw new Error(`Failed to fetch entity for attachment linking: ${entityResponse.statusText}`);
  }

  const entity = await entityResponse.json();

  const photos: AttachmentPhoto[] = [];
  const voiceNotes: AttachmentFile[] = [];
  const documents: AttachmentFile[] = [];
  let signatureUrl: string | undefined;

  for (const file of uploaded) {
    const ts = new Date().toISOString();
    if (file.type === 'photo' || file.type === 'image') {
      photos.push({ url: file.url, uploadedAt: ts, source: 'offline_sync' });
    } else if (file.type === 'signature') {
      signatureUrl = file.url;
    } else if (file.type === 'voice_note' || file.type === 'audio') {
      voiceNotes.push({ url: file.url, filename: file.filename, uploadedAt: ts });
    } else {
      documents.push({ url: file.url, filename: file.filename, uploadedAt: ts });
    }
  }

  const patchData: Record<string, AttachmentPhoto[] | AttachmentFile[] | string> = {};

  if (photos.length > 0) {
    const existing: AttachmentPhoto[] = Array.isArray(entity.photos) ? entity.photos : [];
    patchData.photos = [...existing, ...photos];
  }
  if (signatureUrl) {
    patchData.signatureUrl = signatureUrl;
  }
  if (voiceNotes.length > 0) {
    const existing: AttachmentFile[] = Array.isArray(entity.voiceNotes) ? entity.voiceNotes : [];
    patchData.voiceNotes = [...existing, ...voiceNotes];
  }
  if (documents.length > 0) {
    const existing: AttachmentFile[] = Array.isArray(entity.documents) ? entity.documents : [];
    patchData.documents = [...existing, ...documents];
  }

  if (Object.keys(patchData).length > 0) {
    const linkResponse = await makeApiCall(entityEndpoint, 'PATCH', patchData);
    if (!linkResponse.ok) {
      throw new Error(`Failed to link attachments to entity: ${linkResponse.statusText}`);
    }
  }

  for (const file of uploaded) {
    await markFileAttachmentSynced(file.id, file.url);
  }
}

function hasFieldConflict(localData: Record<string, unknown>, serverData: Record<string, unknown>): boolean {
  if (!localData || !serverData) return false;
  const ignoreFields = new Set(['id', 'createdAt', 'updatedAt', 'version']);
  for (const key of Object.keys(localData)) {
    if (ignoreFields.has(key)) continue;
    if (key in serverData && localData[key] !== undefined && serverData[key] !== undefined) {
      const localVal = JSON.stringify(localData[key]);
      const serverVal = JSON.stringify(serverData[key]);
      if (localVal !== serverVal) return true;
    }
  }
  return false;
}

export async function processSyncQueue(): Promise<SyncResult> {
  return withSyncLock(() => processSyncQueueInner());
}

async function processSyncQueueInner(): Promise<SyncResult> {
  const queue = await getSyncQueue();
  
  if (queue.length === 0) {
    return { success: true, synced: 0, failed: 0, errors: [] };
  }

  const STORE_ORDER: Record<string, number> = {
    clients: 0, jobs: 1, quotes: 2, invoices: 3, timeEntries: 4, payments: 5,
  };
  const TYPE_ORDER: Record<string, number> = { create: 0, update: 1, delete: 2 };

  const sortedQueue = [...queue].sort((a, b) => {
    const storeA = STORE_ORDER[a.storeName] ?? 99;
    const storeB = STORE_ORDER[b.storeName] ?? 99;
    if (storeA !== storeB) return storeA - storeB;
    const typeA = TYPE_ORDER[a.type] ?? 1;
    const typeB = TYPE_ORDER[b.type] ?? 1;
    if (typeA !== typeB) return typeA - typeB;
    return a.createdAt - b.createdAt;
  });
  
  const result: SyncResult = {
    success: true,
    synced: 0,
    failed: 0,
    errors: [],
  };

  for (const operation of sortedQueue) {
    if (operation.retries >= MAX_RETRIES) {
      result.failed++;
      result.errors.push({ operation, error: 'Max retries exceeded' });
      await removeSyncItem(operation.id);
      continue;
    }

    try {
      const resolvedData = resolveDataReferences(operation.data);
      let endpoint = operation.endpoint;
      
      if (operation.type === 'update' || operation.type === 'delete') {
        const urlParts = endpoint.split('/');
        const lastPart = urlParts[urlParts.length - 1];
        if (lastPart.startsWith('offline_')) {
          const serverId = getServerId(lastPart);
          if (serverId) {
            urlParts[urlParts.length - 1] = String(serverId);
            endpoint = urlParts.join('/');
          }
        }
      }
      
      if (operation.type === 'update') {
        const serverCheckResponse = await makeApiCall(endpoint, 'GET');
        if (serverCheckResponse.ok) {
          const serverItem = await serverCheckResponse.json();
          if (serverItem && hasFieldConflict(resolvedData, serverItem)) {
            await removeSyncItem(operation.id);
            await syncManager.registerConflict(operation, serverItem);
            continue;
          }
        }
      }

      const response = await makeApiCall(
        endpoint,
        operation.method,
        operation.type !== 'delete' ? resolvedData : undefined
      );

      if (response.ok) {
        if (operation.type === 'create') {
          const serverResponse = await response.json();
          const offlineId = operation.data?.id;
          const serverId = serverResponse.id;
          
          if (offlineId && serverId && String(offlineId).startsWith('offline_')) {
            addIdMapping(offlineId, serverId);
            if (
              operation.storeName === 'clients' ||
              operation.storeName === 'jobs' ||
              operation.storeName === 'quotes' ||
              operation.storeName === 'invoices'
            ) {
              await updateRelatedReferences(operation.storeName, offlineId, serverId);
            }
            
            await deleteItem(operation.storeName, offlineId);
            await saveItem(operation.storeName, serverResponse);
            
            queryClient.removeQueries({ queryKey: [`/api/${operation.storeName}`, offlineId] });
            queryClient.setQueryData([`/api/${operation.storeName}`, String(serverId)], serverResponse);
          } else {
            await saveItem(operation.storeName, serverResponse);
            if (serverId) {
              queryClient.setQueryData([`/api/${operation.storeName}`, String(serverId)], serverResponse);
            }
          }

          await removeSyncItem(operation.id);
          result.synced++;

          if (operation.fileAttachmentIds?.length && serverId) {
            try {
              await uploadAndLinkAttachments(operation, serverId);
            } catch (attachErr) {
              await addToSyncQueue({
                storeName: operation.storeName,
                type: 'update',
                endpoint: `/api/${operation.storeName}/${serverId}`,
                method: 'PATCH',
                data: { id: serverId },
                fileAttachmentIds: operation.fileAttachmentIds,
              });
            }
          }
        } else if (operation.type === 'update') {
          const serverResponse = await response.json();
          await saveItem(operation.storeName, serverResponse);
          if (serverResponse.id) {
            queryClient.setQueryData([`/api/${operation.storeName}`, String(serverResponse.id)], serverResponse);
          }

          await removeSyncItem(operation.id);
          result.synced++;

          if (operation.fileAttachmentIds?.length && serverResponse.id) {
            try {
              await uploadAndLinkAttachments(operation, serverResponse.id);
            } catch (attachErr) {
              await addToSyncQueue({
                storeName: operation.storeName,
                type: 'update',
                endpoint: `/api/${operation.storeName}/${serverResponse.id}`,
                method: 'PATCH',
                data: { id: serverResponse.id },
                fileAttachmentIds: operation.fileAttachmentIds,
              });
            }
          }
        } else if (operation.type === 'delete') {
          const itemId = operation.data?.id;
          if (itemId) {
            await deleteItem(operation.storeName, itemId);
            queryClient.removeQueries({ queryKey: [`/api/${operation.storeName}`, String(itemId)] });
          }
          await removeSyncItem(operation.id);
          result.synced++;
        }
        
        // Invalidate list cache to refresh the list view
        queryClient.invalidateQueries({ queryKey: [`/api/${operation.storeName}`] });
      } else {
        const errorText = await response.text().catch(() => response.statusText);
        
        if (response.status >= 400 && response.status < 500) {
          result.failed++;
          result.errors.push({ operation, error: `${response.status}: ${errorText}` });
          result.success = false;
          await removeSyncItem(operation.id);
        } else {
          operation.retries++;
          await saveItem('syncQueue', operation);
          result.failed++;
          result.errors.push({ operation, error: `${response.status}: ${errorText}` });
          result.success = false;
        }
      }
    } catch (error) {
      if (!navigator.onLine) {
        result.success = false;
        break;
      }

      operation.retries++;
      await saveItem('syncQueue', operation);
      result.failed++;
      result.errors.push({ 
        operation, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      result.success = false;
    }
  }

  return result;
}

let autoSyncHandler: (() => void) | null = null;

export function startAutoSync(): void {
  if (autoSyncHandler) return;
  
  autoSyncHandler = () => {
    if (navigator.onLine) {
      processSyncQueue().catch(console.error);
    }
  };

  window.addEventListener('online', autoSyncHandler);
  
  if (navigator.onLine) {
    processSyncQueue().catch(console.error);
  }
}

export function stopAutoSync(): void {
  if (autoSyncHandler) {
    window.removeEventListener('online', autoSyncHandler);
    autoSyncHandler = null;
  }
}

export async function getPendingSyncCount(): Promise<number> {
  const queue = await getSyncQueue();
  return queue.length;
}

export async function hasPendingSyncs(): Promise<boolean> {
  const count = await getPendingSyncCount();
  return count > 0;
}
