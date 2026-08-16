const DB_NAME = 'jobrunner-offline';
const DB_VERSION = 3;

const STORE_NAMES = [
  'clients',
  'jobs',
  'quotes',
  'invoices',
  'receipts',
  'timeEntries',
  'payments',
  'templates',
  'subscriptionCache',
  'syncMetadata',
  'syncQueue',
  'fileAttachments'
] as const;
type StoreName = typeof STORE_NAMES[number];

export type OfflineStoreName = 'clients' | 'jobs' | 'quotes' | 'invoices' | 'timeEntries' | 'payments' | 'templates';

export interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  storeName: OfflineStoreName;
  data: any;
  endpoint: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  createdAt: number;
  retries: number;
  fileAttachmentIds?: string[];
}

export interface OfflineFileAttachment {
  id: string;
  entityType: 'job' | 'quote' | 'invoice' | 'client';
  entityId: string | number;
  type: 'photo' | 'signature' | 'voice_note' | 'document';
  filename: string;
  mimeType: string;
  blob: Blob;
  fileSize: number;
  description?: string;
  createdAt: number;
  synced: boolean;
  remoteUrl?: string;
}

export interface SubscriptionCacheEntry {
  id: string;
  data: any;
  cachedAt: number;
  ttlMs: number;
}

export interface SyncMetadataEntry {
  id: string;
  entityType: string;
  lastSyncedAt: number;
  lastModifiedAt?: number;
}

let dbInstance: IDBDatabase | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      STORE_NAMES.forEach((storeName) => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' });
        }
      });
    };
  });
}

export async function saveItem<T extends { id: string | number }>(
  storeName: StoreName,
  item: T
): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(item);

    request.onsuccess = () => resolve(item);
    request.onerror = () => reject(new Error(`Failed to save item to ${storeName}`));
  });
}

export async function getItem<T>(
  storeName: StoreName,
  id: string | number
): Promise<T | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(new Error(`Failed to get item from ${storeName}`));
  });
}

export async function getAllItems<T>(storeName: StoreName): Promise<T[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(new Error(`Failed to get all items from ${storeName}`));
  });
}

export async function deleteItem(
  storeName: StoreName,
  id: string | number
): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`Failed to delete item from ${storeName}`));
  });
}

export async function clearStore(storeName: StoreName): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`Failed to clear ${storeName}`));
  });
}

export async function addToSyncQueue(
  operation: Omit<SyncOperation, 'id' | 'createdAt' | 'retries'>
): Promise<SyncOperation> {
  const syncOperation: SyncOperation = {
    ...operation,
    id: generateOfflineId(),
    createdAt: Date.now(),
    retries: 0,
  };

  await saveItem('syncQueue', syncOperation);
  return syncOperation;
}

export async function getSyncQueue(): Promise<SyncOperation[]> {
  return getAllItems<SyncOperation>('syncQueue');
}

export async function removeSyncItem(id: string): Promise<void> {
  return deleteItem('syncQueue', id);
}

export async function clearSyncQueue(): Promise<void> {
  return clearStore('syncQueue');
}

export function isOnline(): boolean {
  return navigator.onLine;
}

export function generateOfflineId(): string {
  return `offline_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

const DEFAULT_SUBSCRIPTION_TTL_MS = 24 * 60 * 60 * 1000;

export async function cacheSubscriptionData(
  key: string,
  data: any,
  ttlMs: number = DEFAULT_SUBSCRIPTION_TTL_MS
): Promise<SubscriptionCacheEntry> {
  const entry: SubscriptionCacheEntry = {
    id: key,
    data,
    cachedAt: Date.now(),
    ttlMs,
  };
  await saveItem('subscriptionCache', entry);
  return entry;
}

export async function getCachedSubscriptionData<T>(key: string): Promise<T | null> {
  try {
    const entry = await getItem<SubscriptionCacheEntry>('subscriptionCache', key);
    if (!entry) return null;
    
    const now = Date.now();
    const isExpired = now - entry.cachedAt > entry.ttlMs;
    
    if (isExpired) {
      await deleteItem('subscriptionCache', key);
      return null;
    }
    
    return entry.data as T;
  } catch {
    return null;
  }
}

export async function isSubscriptionCacheValid(key: string): Promise<boolean> {
  try {
    const entry = await getItem<SubscriptionCacheEntry>('subscriptionCache', key);
    if (!entry) return false;
    
    const now = Date.now();
    return now - entry.cachedAt <= entry.ttlMs;
  } catch {
    return false;
  }
}

export async function invalidateSubscriptionCache(key: string): Promise<void> {
  await deleteItem('subscriptionCache', key);
}

export async function clearAllSubscriptionCache(): Promise<void> {
  await clearStore('subscriptionCache');
}

export interface TimeEntry {
  id: string | number;
  jobId?: number;
  userId?: number;
  startTime: string;
  endTime?: string;
  duration?: number;
  description?: string;
  billable?: boolean;
  hourlyRate?: number;
  phaseId?: string;
  createdAt?: string;
  updatedAt?: string;
  pendingSync?: boolean;
  syncStatus?: 'pending' | 'synced' | 'failed';
  isBreak?: boolean;
  breakTime?: number;
}

export async function saveTimeEntry(entry: TimeEntry): Promise<TimeEntry> {
  const timeEntry = {
    ...entry,
    id: entry.id || generateOfflineId(),
  };
  await saveItem('timeEntries', timeEntry);
  return timeEntry;
}

export async function getTimeEntry(id: string | number): Promise<TimeEntry | undefined> {
  return getItem<TimeEntry>('timeEntries', id);
}

export async function getAllTimeEntries(): Promise<TimeEntry[]> {
  return getAllItems<TimeEntry>('timeEntries');
}

export async function deleteTimeEntry(id: string | number): Promise<void> {
  await deleteItem('timeEntries', id);
}

export async function getTimeEntriesForJob(jobId: number): Promise<TimeEntry[]> {
  const allEntries = await getAllTimeEntries();
  return allEntries.filter(entry => entry.jobId === jobId);
}

export interface DraftPayment {
  id: string | number;
  invoiceId?: number;
  clientId?: number;
  amount: number;
  paymentMethod?: string;
  paymentDate?: string;
  reference?: string;
  notes?: string;
  status: 'draft' | 'pending' | 'synced';
  createdAt?: string;
}

export async function saveDraftPayment(payment: DraftPayment): Promise<DraftPayment> {
  const draftPayment = {
    ...payment,
    id: payment.id || generateOfflineId(),
    status: payment.status || 'draft',
    createdAt: payment.createdAt || new Date().toISOString(),
  };
  await saveItem('payments', draftPayment);
  return draftPayment;
}

export async function getDraftPayment(id: string | number): Promise<DraftPayment | undefined> {
  return getItem<DraftPayment>('payments', id);
}

export async function getAllDraftPayments(): Promise<DraftPayment[]> {
  return getAllItems<DraftPayment>('payments');
}

export async function getPendingDraftPayments(): Promise<DraftPayment[]> {
  const allPayments = await getAllDraftPayments();
  return allPayments.filter(p => p.status === 'draft' || p.status === 'pending');
}

export async function deleteDraftPayment(id: string | number): Promise<void> {
  await deleteItem('payments', id);
}

export async function markPaymentAsSynced(id: string | number): Promise<void> {
  const payment = await getDraftPayment(id);
  if (payment) {
    payment.status = 'synced';
    await saveItem('payments', payment);
  }
}

export async function updateSyncMetadata(entityType: string, lastSyncedAt: number): Promise<void> {
  const entry: SyncMetadataEntry = {
    id: entityType,
    entityType,
    lastSyncedAt,
    lastModifiedAt: Date.now(),
  };
  await saveItem('syncMetadata', entry);
}

export async function getSyncMetadata(entityType: string): Promise<SyncMetadataEntry | undefined> {
  return getItem<SyncMetadataEntry>('syncMetadata', entityType);
}

export async function getAllSyncMetadata(): Promise<SyncMetadataEntry[]> {
  return getAllItems<SyncMetadataEntry>('syncMetadata');
}

export async function getLastSyncTimestamp(entityType: string): Promise<number | null> {
  const metadata = await getSyncMetadata(entityType);
  return metadata?.lastSyncedAt ?? null;
}

export async function saveTemplate(template: { id: string | number; [key: string]: any }): Promise<any> {
  await saveItem('templates', template);
  return template;
}

export async function getTemplate(id: string | number): Promise<any | undefined> {
  return getItem('templates', id);
}

export async function getAllTemplates(): Promise<any[]> {
  return getAllItems('templates');
}

export async function saveFileAttachment(attachment: OfflineFileAttachment): Promise<OfflineFileAttachment> {
  await saveItem('fileAttachments', attachment);
  return attachment;
}

export async function getFileAttachment(id: string): Promise<OfflineFileAttachment | undefined> {
  return getItem<OfflineFileAttachment>('fileAttachments', id);
}

export async function getAllFileAttachments(): Promise<OfflineFileAttachment[]> {
  return getAllItems<OfflineFileAttachment>('fileAttachments');
}

export async function getPendingFileAttachments(): Promise<OfflineFileAttachment[]> {
  const all = await getAllFileAttachments();
  return all.filter(a => !a.synced);
}

export async function getFileAttachmentsForEntity(
  entityType: string,
  entityId: string | number
): Promise<OfflineFileAttachment[]> {
  const all = await getAllFileAttachments();
  return all.filter(a => a.entityType === entityType && String(a.entityId) === String(entityId));
}

export async function markFileAttachmentSynced(id: string, remoteUrl: string): Promise<void> {
  const attachment = await getFileAttachment(id);
  if (attachment) {
    attachment.synced = true;
    attachment.remoteUrl = remoteUrl;
    const { blob, ...withoutBlob } = attachment;
    await saveItem('fileAttachments', { ...withoutBlob, blob: new Blob([]) });
  }
}

export async function deleteFileAttachment(id: string): Promise<void> {
  await deleteItem('fileAttachments', id);
}

export async function getOfflineSyncStats(): Promise<{
  pendingCount: number;
  failedCount: number;
  fileAttachmentCount: number;
  lastSyncedAt: number | null;
}> {
  const queue = await getSyncQueue();
  const files = await getPendingFileAttachments();
  const metadata = await getAllSyncMetadata();
  const latestSync = metadata.reduce((latest, m) => 
    m.lastSyncedAt > (latest || 0) ? m.lastSyncedAt : latest, 
    null as number | null
  );
  return {
    pendingCount: queue.length,
    failedCount: queue.filter(op => op.retries >= 3).length,
    fileAttachmentCount: files.length,
    lastSyncedAt: latestSync,
  };
}
