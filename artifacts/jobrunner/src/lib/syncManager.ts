import {
  getSyncQueue,
  addToSyncQueue,
  removeSyncItem,
  saveItem,
  getItem,
  getAllItems,
  deleteItem,
  updateSyncMetadata,
  isOnline,
  markPaymentAsSynced,
  getFileAttachment,
  markFileAttachmentSynced,
  deleteFileAttachment,
  type SyncOperation,
  type OfflineStoreName,
} from './offlineStorage';
import { apiRequest, queryClient, getStoreNameFromEndpoint, getAuthHeaders } from './queryClient';
import { withSyncLock } from './syncLock';

const STORE_PRIORITY: Record<string, number> = {
  clients: 0,
  jobs: 1,
  quotes: 2,
  invoices: 3,
  timeEntries: 4,
  payments: 5,
  templates: 6,
};

export interface SyncConflict {
  id: string;
  operationId: string;
  storeName: OfflineStoreName;
  localVersion: any;
  serverVersion: any;
  fileAttachmentIds?: string[];
  resolvedAt?: number;
  createdAt: number;
}

export interface SyncProgress {
  total: number;
  completed: number;
  failed: number;
  inProgress: boolean;
  currentOperation?: string;
}

export interface SyncError {
  operationId: string;
  error: string;
  retries: number;
  lastAttempt: number;
}

type SyncEventType = 'syncStart' | 'syncComplete' | 'syncError' | 'syncProgress' | 'online' | 'offline' | 'conflict';
type SyncEventCallback = (data?: any) => void;

const CONFLICT_STORE_KEY = 'syncConflicts';
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;

class SyncManager {
  private isSyncing = false;
  private isInitialized = false;
  private eventListeners: Map<SyncEventType, Set<SyncEventCallback>> = new Map();
  private progress: SyncProgress = {
    total: 0,
    completed: 0,
    failed: 0,
    inProgress: false,
  };
  private errors: SyncError[] = [];
  private conflicts: SyncConflict[] = [];
  private idMappings: Map<string, string | number> = new Map();

  constructor() {
    this.loadConflicts();
  }

  initialize(): void {
    if (this.isInitialized) return;

    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);

    this.isInitialized = true;

    if (isOnline()) {
      this.triggerSync();
    }
  }

  destroy(): void {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    this.isInitialized = false;
  }

  private handleOnline = (): void => {
    this.emit('online');
    this.triggerSync();
  };

  private handleOffline = (): void => {
    this.emit('offline');
  };

  on(event: SyncEventType, callback: SyncEventCallback): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);

    return () => {
      this.eventListeners.get(event)?.delete(callback);
    };
  }

  private emit(event: SyncEventType, data?: any): void {
    this.eventListeners.get(event)?.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in sync event listener for ${event}:`, error);
      }
    });
  }

  async triggerSync(): Promise<void> {
    if (!isOnline()) return;
    return withSyncLock(() => this.runSyncQueue());
  }

  private async runSyncQueue(): Promise<void> {
    if (this.isSyncing || !isOnline()) {
      return;
    }

    this.isSyncing = true;
    this.emit('syncStart');

    try {
      const queue = await getSyncQueue();
      
      const sortedQueue = queue.sort((a, b) => {
        const priorityA = STORE_PRIORITY[a.storeName] ?? 99;
        const priorityB = STORE_PRIORITY[b.storeName] ?? 99;
        if (priorityA !== priorityB) return priorityA - priorityB;
        if (a.type === 'create' && b.type !== 'create') return -1;
        if (a.type !== 'create' && b.type === 'create') return 1;
        return a.createdAt - b.createdAt;
      });

      this.progress = {
        total: sortedQueue.length,
        completed: 0,
        failed: 0,
        inProgress: true,
      };
      this.emit('syncProgress', this.progress);

      for (const operation of sortedQueue) {
        if (!isOnline()) {
          break;
        }

        this.progress.currentOperation = `${operation.type} ${operation.storeName}`;
        this.emit('syncProgress', this.progress);

        const success = await this.processOperation(operation);

        if (success) {
          this.progress.completed++;
        } else {
          this.progress.failed++;
        }

        this.emit('syncProgress', this.progress);
      }

      await this.updateAllSyncMetadata();

      if (this.progress.completed > 0) {
        await this.refreshQueryCache();
      }

      this.progress.inProgress = false;
      this.progress.currentOperation = undefined;
      this.emit('syncComplete', {
        completed: this.progress.completed,
        failed: this.progress.failed,
        total: this.progress.total,
      });
    } catch (error) {
      console.error('Sync error:', error);
      this.emit('syncError', { error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      this.isSyncing = false;
    }
  }

  private async uploadFileAttachments(operation: SyncOperation, resolvedEntityId?: string | number): Promise<string[]> {
    interface UploadResult { id: string; url: string; type: string; filename: string }
    const uploaded: UploadResult[] = [];
    if (!operation.fileAttachmentIds?.length) return [];

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

    if (uploaded.length > 0 && resolvedEntityId) {
      const entityEndpoint = `/api/${operation.storeName}/${resolvedEntityId}`;
      const entityResponse = await fetch(entityEndpoint, { credentials: 'include', headers: getAuthHeaders() });
      if (!entityResponse.ok) {
        throw new Error(`Failed to fetch entity for attachment linking: ${entityResponse.status} ${entityResponse.statusText}`);
      }

      const entity = await entityResponse.json();

      interface PhotoEntry { url: string; uploadedAt: string; source: string }
      interface FileEntry { url: string; filename: string; uploadedAt: string }
      const photos: PhotoEntry[] = Array.isArray(entity.photos) ? [...entity.photos] : [];
      const voiceNotes: FileEntry[] = Array.isArray(entity.voiceNotes) ? [...entity.voiceNotes] : [];
      const documents: FileEntry[] = Array.isArray(entity.documents) ? [...entity.documents] : [];
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

      const patchData: Record<string, PhotoEntry[] | FileEntry[] | string> = {};
      if (photos.length > (Array.isArray(entity.photos) ? entity.photos.length : 0)) {
        patchData.photos = photos;
      }
      if (signatureUrl) patchData.signatureUrl = signatureUrl;
      if (voiceNotes.length > (Array.isArray(entity.voiceNotes) ? entity.voiceNotes.length : 0)) {
        patchData.voiceNotes = voiceNotes;
      }
      if (documents.length > (Array.isArray(entity.documents) ? entity.documents.length : 0)) {
        patchData.documents = documents;
      }

      if (Object.keys(patchData).length > 0) {
        await apiRequest('PATCH', entityEndpoint, patchData);
      }

      for (const file of uploaded) {
        await markFileAttachmentSynced(file.id, file.url);
      }
    }

    return uploaded.map(u => u.url);
  }

  private async processOperation(operation: SyncOperation): Promise<boolean> {
    const delay = this.calculateBackoffDelay(operation.retries);

    if (operation.retries > 0) {
      await this.sleep(delay);
    }

    try {
      let response: Response;
      let result: any;

      if (operation.type === 'create') {
        const dataWithoutOfflineId = { ...operation.data };
        const originalOfflineId = operation.data.id;
        delete dataWithoutOfflineId.id;

        response = await apiRequest('POST', operation.endpoint, dataWithoutOfflineId);
        result = await response.json();

        if (operation.storeName === 'payments' && originalOfflineId) {
          await markPaymentAsSynced(originalOfflineId);
        }
        
        if (result && result.id) {
          await this.reconcileId(operation.storeName, originalOfflineId, result.id);
        }
      } else if (operation.type === 'update') {
        const serverItem = await this.fetchServerItem(operation.endpoint);

        if (serverItem && this.hasConflict(operation.data, serverItem)) {
          await this.handleConflict(operation, serverItem);
          result = serverItem;
        } else {
          response = await apiRequest('PATCH', operation.endpoint, operation.data);
          result = await response.json();
        }
      } else if (operation.type === 'delete') {
        try {
          response = await apiRequest('DELETE', operation.endpoint);
          result = { success: true };
        } catch (error) {
          if (error instanceof Error && error.message.includes('404')) {
            result = { success: true };
          } else {
            throw error;
          }
        }
      }

      if (operation.fileAttachmentIds?.length) {
        const resolvedEntityId = result?.id || operation.data?.id;
        await this.uploadFileAttachments(operation, resolvedEntityId);
      }

      await removeSyncItem(operation.id);
      this.removeError(operation.id);

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.includes('session_expired') || errorMessage.includes('401')) {
        await removeSyncItem(operation.id);
        return false;
      }

      if (operation.retries < MAX_RETRIES) {
        await this.incrementRetry(operation);
        this.addError({
          operationId: operation.id,
          error: errorMessage,
          retries: operation.retries + 1,
          lastAttempt: Date.now(),
        });
        return false;
      }

      console.error(`Max retries reached for operation ${operation.id}:`, errorMessage);
      await removeSyncItem(operation.id);
      this.removeError(operation.id);

      return false;
    }
  }

  private async fetchServerItem(endpoint: string): Promise<Record<string, unknown> | null> {
    const response = await fetch(endpoint, {
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch server item for conflict check: ${response.status}`);
    }

    return await response.json();
  }

  private hasConflict(localData: any, serverData: any): boolean {
    if (!serverData) return false;

    const localUpdated = localData.updatedAt ? new Date(localData.updatedAt).getTime() : 0;
    const serverUpdated = serverData.updatedAt ? new Date(serverData.updatedAt).getTime() : 0;

    return serverUpdated > localUpdated;
  }

  private async handleConflict(operation: SyncOperation, serverVersion: any): Promise<void> {
    const conflict: SyncConflict = {
      id: `conflict_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      operationId: operation.id,
      storeName: operation.storeName,
      localVersion: operation.data,
      serverVersion,
      fileAttachmentIds: operation.fileAttachmentIds,
      createdAt: Date.now(),
    };

    this.conflicts.push(conflict);
    await this.saveConflicts();

    await saveItem(operation.storeName, serverVersion);

    this.emit('conflict', conflict);
  }

  private async reconcileId(
    storeName: OfflineStoreName,
    offlineId: string,
    serverId: string | number
  ): Promise<void> {
    this.idMappings.set(offlineId, serverId);

    const existingItem = await getItem(storeName, offlineId);
    if (existingItem) {
      await deleteItem(storeName, offlineId);
      await saveItem(storeName, { ...existingItem, id: serverId });
    }

    await this.updateRelatedRecords(storeName, offlineId, serverId);
  }

  private async updateRelatedRecords(
    storeName: OfflineStoreName,
    offlineId: string,
    serverId: string | number
  ): Promise<void> {
    const relationshipMap: Record<OfflineStoreName, { store: OfflineStoreName; field: string }[]> = {
      clients: [
        { store: 'jobs', field: 'clientId' },
        { store: 'quotes', field: 'clientId' },
        { store: 'invoices', field: 'clientId' },
      ],
      jobs: [
        { store: 'quotes', field: 'jobId' },
        { store: 'invoices', field: 'jobId' },
        { store: 'timeEntries', field: 'jobId' },
      ],
      quotes: [
        { store: 'jobs', field: 'quoteId' },
        { store: 'invoices', field: 'quoteId' },
      ],
      invoices: [
        { store: 'payments', field: 'invoiceId' },
      ],
      timeEntries: [],
      payments: [],
      templates: [],
    };

    const relations = relationshipMap[storeName] || [];

    for (const relation of relations) {
      try {
        const items = await getAllItems<any>(relation.store);
        
        for (const item of items) {
          if (item[relation.field] === offlineId) {
            const updatedItem = { ...item, [relation.field]: serverId };
            await saveItem(relation.store, updatedItem);
          }
        }
      } catch (error) {
        console.warn(`Failed to update related records in ${relation.store}:`, error);
      }
    }

    const pendingQueue = await getSyncQueue();
    for (const op of pendingQueue) {
      let updated = false;
      const updatedOp = { ...op };

      if (op.data && op.data[`${storeName.slice(0, -1)}Id`] === offlineId) {
        updatedOp.data = {
          ...op.data,
          [`${storeName.slice(0, -1)}Id`]: serverId,
        };
        updated = true;
      }

      if (op.endpoint.includes(String(offlineId))) {
        updatedOp.endpoint = op.endpoint.replace(String(offlineId), String(serverId));
        updated = true;
      }

      if (updated) {
        await saveItem('syncQueue', updatedOp);
      }
    }
  }

  private calculateBackoffDelay(retries: number): number {
    const delay = Math.min(BASE_DELAY_MS * Math.pow(2, retries), MAX_DELAY_MS);
    const jitter = delay * 0.1 * Math.random();
    return delay + jitter;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async incrementRetry(operation: SyncOperation): Promise<void> {
    const updated = { ...operation, retries: operation.retries + 1 };
    await saveItem('syncQueue', updated);
  }

  private addError(error: SyncError): void {
    const existingIndex = this.errors.findIndex((e) => e.operationId === error.operationId);
    if (existingIndex >= 0) {
      this.errors[existingIndex] = error;
    } else {
      this.errors.push(error);
    }
  }

  private removeError(operationId: string): void {
    this.errors = this.errors.filter((e) => e.operationId !== operationId);
  }

  private async updateAllSyncMetadata(): Promise<void> {
    const now = Date.now();
    const stores: OfflineStoreName[] = ['clients', 'jobs', 'quotes', 'invoices', 'timeEntries', 'payments', 'templates'];

    for (const store of stores) {
      await updateSyncMetadata(store, now);
    }
  }

  private async refreshQueryCache(): Promise<void> {
    const queryKeys = [
      '/api/clients',
      '/api/jobs',
      '/api/quotes',
      '/api/invoices',
      '/api/time-entries',
      '/api/payments',
      '/api/templates',
    ];

    for (const key of queryKeys) {
      await queryClient.invalidateQueries({ queryKey: [key] });
    }
  }

  private async loadConflicts(): Promise<void> {
    try {
      const stored = localStorage.getItem(CONFLICT_STORE_KEY);
      if (stored) {
        this.conflicts = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load conflicts from localStorage:', error);
    }
  }

  private async saveConflicts(): Promise<void> {
    try {
      localStorage.setItem(CONFLICT_STORE_KEY, JSON.stringify(this.conflicts));
    } catch (error) {
      console.warn('Failed to save conflicts to localStorage:', error);
    }
  }

  async getPendingCount(): Promise<number> {
    const queue = await getSyncQueue();
    return queue.length;
  }

  getProgress(): SyncProgress {
    return { ...this.progress };
  }

  getErrors(): SyncError[] {
    return [...this.errors];
  }

  getConflicts(): SyncConflict[] {
    return [...this.conflicts];
  }

  async registerConflict(operation: SyncOperation, serverVersion: Record<string, unknown>): Promise<void> {
    await this.handleConflict(operation, serverVersion);
  }

  async resolveConflict(conflictId: string, useLocal: boolean, mergedData?: Record<string, unknown>): Promise<void> {
    const conflict = this.conflicts.find((c) => c.id === conflictId);
    if (!conflict) return;

    let entityId = conflict.localVersion.id;
    if (typeof entityId === 'string' && entityId.startsWith('offline_')) {
      let serverId = this.idMappings.get(entityId);
      if (!serverId) {
        try {
          const stored = localStorage.getItem('jobrunner_id_mapping');
          if (stored) {
            const mapping = JSON.parse(stored);
            serverId = mapping[entityId];
          }
        } catch { /* ignore parse errors */ }
      }
      if (serverId) entityId = serverId;
    }

    const resolvedVersion = mergedData
      ? { ...conflict.serverVersion, ...mergedData, id: entityId }
      : useLocal
        ? { ...conflict.localVersion, id: entityId }
        : conflict.serverVersion;

    await saveItem(conflict.storeName, resolvedVersion);

    await removeSyncItem(conflict.operationId);

    const requeueResolution = async () => {
      await addToSyncQueue({
        storeName: conflict.storeName,
        type: 'update',
        endpoint: `/api/${conflict.storeName}/${entityId}`,
        method: 'PATCH',
        data: resolvedVersion,
        fileAttachmentIds: conflict.fileAttachmentIds,
      });
    };

    if (isOnline()) {
      try {
        const endpoint = `/api/${conflict.storeName}/${entityId}`;
        await apiRequest('PATCH', endpoint, resolvedVersion);
      } catch (error) {
        console.error('Failed to sync resolved conflict:', error);
        await requeueResolution();
      }
    } else {
      await requeueResolution();
    }

    conflict.resolvedAt = Date.now();
    this.conflicts = this.conflicts.filter((c) => c.id !== conflictId);
    await this.saveConflicts();

    this.emit('syncComplete');
  }

  async clearResolvedConflicts(): Promise<void> {
    this.conflicts = this.conflicts.filter((c) => !c.resolvedAt);
    await this.saveConflicts();
  }

  isSyncInProgress(): boolean {
    return this.isSyncing;
  }

  isNetworkOnline(): boolean {
    return isOnline();
  }

  getIdMapping(offlineId: string): string | number | undefined {
    return this.idMappings.get(offlineId);
  }

  async retryFailedOperations(): Promise<void> {
    await this.triggerSync();
  }

  async clearSyncErrors(): Promise<void> {
    this.errors = [];
  }
}

export const syncManager = new SyncManager();
export default syncManager;
