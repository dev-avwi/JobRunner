/**
 * Offline Storage Module using SQLite
 * 
 * Provides local caching of jobs, clients, quotes, invoices, and time entries
 * for offline access. Automatically syncs with the server when connectivity is restored.
 * 
 * Enhanced features:
 * - Delta sync: Only transfers items changed since last sync
 * - Conflict resolution: Server wins with local backup for review
 * - Background sync: Periodic sync using expo-background-fetch
 * - Attachment caching: Downloads remote files for offline access
 * 
 * Uses expo-sqlite for local database storage.
 */

import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import api from './api';

// Background task name
const BACKGROUND_SYNC_TASK = 'background-sync-task';

// Max retry attempts before giving up on a sync item
const MAX_RETRY_ATTEMPTS = 10;

// ============ TYPES ============

export interface CachedJob {
  id: string;
  title: string;
  description?: string;
  address?: string;
  status: string;
  scheduledAt?: string;
  clientId?: string;
  clientName?: string;
  assignedTo?: string;
  notes?: string;
  // Optional/extended fields mirrored from Job for offline updates
  latitude?: number | null;
  longitude?: number | null;
  estimatedDuration?: number;
  estimatedCost?: number | string;
  workerStatus?: string | null;
  geofenceEnabled?: boolean;
  geofenceRadius?: number;
  geofenceAutoClockIn?: boolean;
  geofenceAutoClockOut?: boolean;
  isRecurring?: boolean;
  recurrencePattern?: string | null;
  nextRecurrenceDate?: string | null;
  recurrenceEndDate?: string | null;
  cachedAt: number;
  pendingSync: boolean;
  syncAction?: 'create' | 'update' | 'delete';
  localId?: string; // For locally created items
}

export interface CachedClient {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  cachedAt: number;
  pendingSync: boolean;
  syncAction?: 'create' | 'update' | 'delete';
  localId?: string;
}

export interface CachedQuote {
  id: string;
  quoteNumber: string;
  clientId: string;
  clientName?: string;
  jobId?: string;
  status: string;
  subtotal: number;
  gstAmount: number;
  total: number;
  validUntil?: string;
  notes?: string;
  createdAt: string;
  cachedAt: number;
  pendingSync: boolean;
  syncAction?: 'create' | 'update' | 'delete';
  localId?: string;
}

export interface CachedInvoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName?: string;
  jobId?: string;
  quoteId?: string;
  status: string;
  subtotal: number;
  gstAmount: number;
  total: number;
  amountPaid: number;
  dueDate?: string;
  paidAt?: string;
  notes?: string;
  createdAt: string;
  cachedAt: number;
  pendingSync: boolean;
  syncAction?: 'create' | 'update' | 'delete';
  localId?: string;
}

export interface CachedTimeEntry {
  id: string;
  userId: string;
  jobId?: string;
  description?: string;
  startTime: string;
  endTime?: string;
  notes?: string;
  cachedAt: number;
  pendingSync: boolean;
  syncAction?: 'create' | 'update' | 'delete';
  localId?: string;
}

export interface CachedQuoteLineItem {
  id: string;
  quoteId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  cachedAt: number;
}

export interface CachedInvoiceLineItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  cachedAt: number;
}

export interface CachedAttachment {
  id: string;
  jobId?: string;
  quoteId?: string;
  invoiceId?: string;
  clientId?: string;
  type: 'photo' | 'signature' | 'document' | 'voice_note';
  filename: string;
  mimeType: string;
  localUri?: string; // Local file path on device (nullable for server-fetched attachments)
  remoteUrl?: string; // Server URL once synced
  fileSize?: number;
  description?: string;
  cachedAt: number;
  pendingSync: boolean;
  syncAction?: 'create' | 'delete';
  localId?: string;
}

export interface CachedSubscription {
  key: string;
  data: any; // The subscription data (plan, features, etc.)
  cachedAt: number;
  ttlMs: number;
}

export interface PendingSyncItem {
  id: string;
  type: 'job' | 'client' | 'quote' | 'invoice' | 'timeEntry' | 'attachment';
  action: 'create' | 'update' | 'delete';
  data: string; // JSON stringified
  createdAt: number;
  retryCount: number;
  lastError?: string;
  lastAttemptedAt?: number; // For exponential backoff
}

export interface ConflictRecord {
  id: string;
  entityType: 'job' | 'client' | 'quote' | 'invoice' | 'timeEntry';
  entityId: string;
  localData: string; // JSON stringified local version
  serverData: string; // JSON stringified server version
  conflictedAt: number;
  resolved: boolean;
  resolution?: 'kept_server' | 'kept_local' | 'merged';
  resolvedAt?: number;
}

// ============ OFFLINE STATE STORE ============

interface OfflineState {
  isOnline: boolean;
  isInitialized: boolean;
  isSyncing: boolean;
  lastSyncTime: number | null;
  pendingSyncCount: number;
  syncError: string | null;
  unresolvedConflictCount: number;
  backgroundSyncEnabled: boolean;
  backgroundSyncRegistered: boolean;
  backgroundSyncError: string | null;
  
  setOnline: (online: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setLastSyncTime: (time: number | null) => void;
  setPendingSyncCount: (count: number) => void;
  setSyncError: (error: string | null) => void;
  setUnresolvedConflictCount: (count: number) => void;
  setBackgroundSyncEnabled: (enabled: boolean) => void;
  setBackgroundSyncRegistered: (registered: boolean) => void;
  setBackgroundSyncError: (error: string | null) => void;
}

export const useOfflineStore = create<OfflineState>((set) => ({
  isOnline: true,
  isInitialized: false,
  isSyncing: false,
  lastSyncTime: null,
  pendingSyncCount: 0,
  syncError: null,
  unresolvedConflictCount: 0,
  backgroundSyncEnabled: false,
  backgroundSyncRegistered: false,
  backgroundSyncError: null,
  
  setOnline: (online) => set({ isOnline: online }),
  setInitialized: (initialized) => set({ isInitialized: initialized }),
  setSyncing: (syncing) => set({ isSyncing: syncing }),
  setLastSyncTime: (time) => {
    set({ lastSyncTime: time });
    if (time !== null) {
      offlineStorage.setMetadata('last_sync_time', time.toString()).catch(() => {});
    }
  },
  setPendingSyncCount: (count) => set({ pendingSyncCount: count }),
  setSyncError: (error) => set({ syncError: error }),
  setUnresolvedConflictCount: (count) => set({ unresolvedConflictCount: count }),
  setBackgroundSyncEnabled: (enabled) => set({ backgroundSyncEnabled: enabled }),
  setBackgroundSyncRegistered: (registered) => set({ backgroundSyncRegistered: registered }),
  setBackgroundSyncError: (error) => set({ backgroundSyncError: error }),
}));

// ============ OFFLINE STORAGE SERVICE ============

class OfflineStorageService {
  private db: SQLite.SQLiteDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private networkUnsubscribe: (() => void) | null = null;
  private syncInProgress = false;
  // Serializes write transactions so overlapping callers (e.g. two
  // fullSync() invocations triggered by auth + tab focus) can't race
  // each other's BEGIN/COMMIT/ROLLBACK. See runInTransaction().
  private transactionMutex: Promise<void> = Promise.resolve();

  /**
   * Run `fn` inside a serialized SQLite transaction. Each call awaits the
   * previously-queued transaction before starting, so the underlying
   * `withTransactionAsync` (which manages BEGIN/COMMIT/ROLLBACK safely)
   * never sees a nested-transaction collision.
   *
   * Any expo-sqlite write that previously hand-rolled
   * `BEGIN TRANSACTION` / `COMMIT` / `ROLLBACK` should use this helper.
   */
  private async runInTransaction(fn: () => Promise<void>): Promise<void> {
    if (!this.db) return;
    const db = this.db;
    const previous = this.transactionMutex;
    let release: () => void = () => {};
    this.transactionMutex = new Promise<void>((resolve) => {
      release = resolve;
    });
    try {
      await previous;
    } catch {
      // Previous transaction's failure must not prevent this one from running.
    }
    try {
      await db.withTransactionAsync(fn);
    } finally {
      release();
    }
  }

  /**
   * Initialize the SQLite database and create tables
   */
  async initialize(): Promise<void> {
    // De-dupe concurrent init calls. React strict-mode / screen re-mounts can
    // fire initialize() twice; two parallel openDatabaseAsync calls race and
    // one ends up with a null native handle, which then throws
    // "NativeDatabase.prepareAsync/execAsync has been rejected → NullPointerException"
    // on Android. A single shared in-flight promise prevents that race.
    if (this.db) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._initialize();
    try {
      await this.initPromise;
    } catch (err) {
      this.initPromise = null; // allow a later retry
      throw err;
    }
  }

  private async _initialize(): Promise<void> {
    try {
      // Open database. Android's expo-sqlite occasionally rejects the very
      // first open with a transient NullPointerException right after a cold
      // start; retry once before giving up.
      try {
        this.db = await SQLite.openDatabaseAsync('jobrunner_offline.db');
      } catch (openErr) {
        await new Promise((r) => setTimeout(r, 300));
        this.db = await SQLite.openDatabaseAsync('jobrunner_offline.db');
      }
      
      // Create all tables
      await this.db.execAsync(`
        -- Jobs table
        CREATE TABLE IF NOT EXISTS jobs (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          address TEXT,
          status TEXT NOT NULL,
          scheduled_at TEXT,
          client_id TEXT,
          client_name TEXT,
          assigned_to TEXT,
          notes TEXT,
          cached_at INTEGER NOT NULL,
          pending_sync INTEGER DEFAULT 0,
          sync_action TEXT,
          local_id TEXT
        );
        
        -- Clients table
        CREATE TABLE IF NOT EXISTS clients (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT,
          phone TEXT,
          address TEXT,
          notes TEXT,
          cached_at INTEGER NOT NULL,
          pending_sync INTEGER DEFAULT 0,
          sync_action TEXT,
          local_id TEXT
        );
        
        -- Quotes table
        CREATE TABLE IF NOT EXISTS quotes (
          id TEXT PRIMARY KEY,
          quote_number TEXT,
          client_id TEXT,
          client_name TEXT,
          job_id TEXT,
          status TEXT NOT NULL,
          subtotal REAL DEFAULT 0,
          gst_amount REAL DEFAULT 0,
          total REAL DEFAULT 0,
          valid_until TEXT,
          notes TEXT,
          created_at TEXT,
          cached_at INTEGER NOT NULL,
          pending_sync INTEGER DEFAULT 0,
          sync_action TEXT,
          local_id TEXT
        );
        
        -- Invoices table
        CREATE TABLE IF NOT EXISTS invoices (
          id TEXT PRIMARY KEY,
          invoice_number TEXT,
          client_id TEXT,
          client_name TEXT,
          job_id TEXT,
          quote_id TEXT,
          status TEXT NOT NULL,
          subtotal REAL DEFAULT 0,
          gst_amount REAL DEFAULT 0,
          total REAL DEFAULT 0,
          amount_paid REAL DEFAULT 0,
          due_date TEXT,
          paid_at TEXT,
          notes TEXT,
          created_at TEXT,
          cached_at INTEGER NOT NULL,
          pending_sync INTEGER DEFAULT 0,
          sync_action TEXT,
          local_id TEXT
        );
        
        -- Time entries table
        CREATE TABLE IF NOT EXISTS time_entries (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          job_id TEXT,
          description TEXT,
          start_time TEXT NOT NULL,
          end_time TEXT,
          notes TEXT,
          cached_at INTEGER NOT NULL,
          pending_sync INTEGER DEFAULT 0,
          sync_action TEXT,
          local_id TEXT
        );
        
        -- Sync queue for pending changes with exponential backoff support
        CREATE TABLE IF NOT EXISTS sync_queue (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          action TEXT NOT NULL,
          data TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          retry_count INTEGER DEFAULT 0,
          last_error TEXT,
          last_attempted_at INTEGER
        );
        
        -- Metadata for sync timestamps
        CREATE TABLE IF NOT EXISTS metadata (
          key TEXT PRIMARY KEY,
          value TEXT
        );
        
        -- Cached auth data for offline access
        CREATE TABLE IF NOT EXISTS cached_auth (
          id TEXT PRIMARY KEY DEFAULT 'current_user',
          user_data TEXT,
          business_settings TEXT,
          role_info TEXT,
          cached_at INTEGER NOT NULL
        );
        
        -- Attachments table for photos, signatures, documents
        -- local_uri is nullable for server-fetched attachments that don't have local copies yet
        CREATE TABLE IF NOT EXISTS attachments (
          id TEXT PRIMARY KEY,
          job_id TEXT,
          quote_id TEXT,
          invoice_id TEXT,
          client_id TEXT,
          type TEXT NOT NULL,
          filename TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          local_uri TEXT,
          remote_url TEXT,
          file_size INTEGER,
          description TEXT,
          cached_at INTEGER NOT NULL,
          pending_sync INTEGER DEFAULT 0,
          sync_action TEXT,
          local_id TEXT
        );
        
        -- Conflicts table for tracking sync conflicts
        CREATE TABLE IF NOT EXISTS conflicts (
          id TEXT PRIMARY KEY,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          local_data TEXT NOT NULL,
          server_data TEXT NOT NULL,
          conflicted_at INTEGER NOT NULL,
          resolved INTEGER DEFAULT 0,
          resolution TEXT,
          resolved_at INTEGER
        );
        
        -- Delta sync timestamps per entity type
        CREATE TABLE IF NOT EXISTS delta_sync (
          entity_type TEXT PRIMARY KEY,
          last_synced_at INTEGER NOT NULL,
          last_server_timestamp TEXT
        );
        
        -- Quote line items table for offline access
        CREATE TABLE IF NOT EXISTS quote_line_items (
          id TEXT PRIMARY KEY,
          quote_id TEXT NOT NULL,
          description TEXT NOT NULL,
          quantity REAL DEFAULT 1,
          unit_price REAL DEFAULT 0,
          total REAL DEFAULT 0,
          cached_at INTEGER NOT NULL
        );
        
        -- Invoice line items table for offline access
        CREATE TABLE IF NOT EXISTS invoice_line_items (
          id TEXT PRIMARY KEY,
          invoice_id TEXT NOT NULL,
          description TEXT NOT NULL,
          quantity REAL DEFAULT 1,
          unit_price REAL DEFAULT 0,
          total REAL DEFAULT 0,
          cached_at INTEGER NOT NULL
        );
        
        -- Create indexes for line items
        CREATE INDEX IF NOT EXISTS idx_quote_line_items_quote_id ON quote_line_items(quote_id);
        CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice_id ON invoice_line_items(invoice_id);
        
        -- Subscription cache table for offline entitlement/plan access
        CREATE TABLE IF NOT EXISTS subscription_cache (
          key TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          cached_at INTEGER NOT NULL,
          ttl_ms INTEGER NOT NULL
        );

        -- T005: Safety form templates (SWMS / JSA / custom_forms) cached for offline
        CREATE TABLE IF NOT EXISTS safety_form_templates (
          id TEXT PRIMARY KEY,
          name TEXT,
          form_type TEXT,
          fields_json TEXT,
          template_data TEXT,
          cached_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_safety_form_templates_type ON safety_form_templates(form_type);

        -- T005: Form submissions captured (possibly offline) and queued for sync
        CREATE TABLE IF NOT EXISTS form_submissions_local (
          id TEXT PRIMARY KEY,
          local_id TEXT,
          form_id TEXT,
          job_id TEXT,
          submission_data TEXT,
          signatures TEXT,
          status TEXT,
          cached_at INTEGER NOT NULL,
          pending_sync INTEGER DEFAULT 0,
          sync_action TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_form_submissions_local_job ON form_submissions_local(job_id);
        CREATE INDEX IF NOT EXISTS idx_form_submissions_local_pending ON form_submissions_local(pending_sync);

        -- T006: Cached chat messages across team / job / direct conversations
        CREATE TABLE IF NOT EXISTS chat_messages (
          id TEXT PRIMARY KEY,
          local_id TEXT,
          channel_type TEXT NOT NULL,
          channel_id TEXT NOT NULL,
          sender_id TEXT,
          sender_name TEXT,
          message TEXT,
          message_type TEXT DEFAULT 'text',
          attachment_url TEXT,
          created_at TEXT,
          read_locally INTEGER DEFAULT 0,
          pending_sync INTEGER DEFAULT 0,
          sync_action TEXT,
          cached_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON chat_messages(channel_type, channel_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_chat_messages_pending ON chat_messages(pending_sync);

        CREATE TABLE IF NOT EXISTS chat_unread (
          channel_type TEXT NOT NULL,
          channel_id TEXT NOT NULL,
          count INTEGER DEFAULT 0,
          updated_at INTEGER,
          PRIMARY KEY (channel_type, channel_id)
        );

        -- G1: Geofence enter/exit events captured offline (retried with idempotency)
        CREATE TABLE IF NOT EXISTS geofence_events_local (
          id TEXT PRIMARY KEY,
          job_id TEXT NOT NULL,
          identifier TEXT,
          action TEXT NOT NULL,
          latitude REAL,
          longitude REAL,
          accuracy REAL,
          event_timestamp INTEGER NOT NULL,
          idempotency_key TEXT NOT NULL UNIQUE,
          pending_sync INTEGER DEFAULT 1,
          synced_at INTEGER,
          cached_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_geofence_events_pending ON geofence_events_local(pending_sync);
      `);
      
      // Run migrations to fix old schemas with NOT NULL constraints
      await this.runMigrations();
      
      // Set up network listener
      this.networkUnsubscribe = NetInfo.addEventListener(this.handleNetworkChange);
      
      // Check initial network state
      const netState = await NetInfo.fetch();
      useOfflineStore.getState().setOnline(netState.isConnected ?? false);
      useOfflineStore.getState().setInitialized(true);
      
      // Update pending count and conflict count
      await this.updatePendingSyncCount();
      await this.updateUnresolvedConflictCount();
      
      // Load last sync time from metadata
      const lastSyncStr = await this.getMetadata('last_sync_time');
      if (lastSyncStr) {
        useOfflineStore.getState().setLastSyncTime(parseInt(lastSyncStr, 10));
      }
      
      // Clean up permanently failed sync items (exceeded max retries)
      await this.cleanupFailedSyncItems();
      
      // Register background sync (non-blocking)
      this.registerBackgroundSync().catch(err => {
        if (__DEV__) console.warn('[OfflineStorage] Background sync registration failed:', err);
      });
      
      if (__DEV__) console.log('[OfflineStorage] Initialized successfully');
    } catch (error) {
      this.db = null;
      // Gracefully handled: callers fall back to live server data when the
      // local SQLite cache can't open. Warn (not error) so it doesn't pop the
      // red LogBox overlay during development.
      if (__DEV__) console.warn('[OfflineStorage] Initialization failed, using server data:', error);
      throw error;
    }
  }

  /**
   * Run schema migrations to fix old databases with NOT NULL constraints
   * SQLite doesn't support ALTER COLUMN, so we need to recreate tables
   */
  private async runMigrations(): Promise<void> {
    if (!this.db) return;
    
    try {
      // Check if we need to migrate quotes table (check for NOT NULL on quote_number)
      const quotesInfo = await this.db.getAllAsync("PRAGMA table_info(quotes)");
      const quoteNumberCol = (quotesInfo as any[]).find((c: any) => c.name === 'quote_number');
      
      if (quoteNumberCol && quoteNumberCol.notnull === 1) {
        if (__DEV__) console.log('[OfflineStorage] Migrating quotes table to allow NULL quote_number...');
        // Schema migration runs once during initialize() before any other caller
        // can race the DB, so hand-rolled BEGIN/COMMIT inside this multi-statement
        // execAsync is safe and does not need runInTransaction().
        await this.db.execAsync(`
          BEGIN TRANSACTION;
          
          -- Create new quotes table with correct schema
          CREATE TABLE IF NOT EXISTS quotes_new (
            id TEXT PRIMARY KEY,
            quote_number TEXT,
            client_id TEXT,
            client_name TEXT,
            job_id TEXT,
            status TEXT NOT NULL,
            subtotal REAL DEFAULT 0,
            gst_amount REAL DEFAULT 0,
            total REAL DEFAULT 0,
            valid_until TEXT,
            notes TEXT,
            created_at TEXT,
            cached_at INTEGER NOT NULL,
            pending_sync INTEGER DEFAULT 0,
            sync_action TEXT,
            local_id TEXT
          );
          
          -- Copy data from old table
          INSERT INTO quotes_new SELECT * FROM quotes;
          
          -- Drop old table and rename new one
          DROP TABLE quotes;
          ALTER TABLE quotes_new RENAME TO quotes;
          
          -- Recreate indexes
          CREATE INDEX IF NOT EXISTS idx_quotes_client_id ON quotes(client_id);
          CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
          
          COMMIT;
        `);
        if (__DEV__) console.log('[OfflineStorage] Quotes table migrated successfully');
      }
      
      // Check if we need to migrate invoices table
      const invoicesInfo = await this.db.getAllAsync("PRAGMA table_info(invoices)");
      const invoiceNumberCol = (invoicesInfo as any[]).find((c: any) => c.name === 'invoice_number');
      
      if (invoiceNumberCol && invoiceNumberCol.notnull === 1) {
        if (__DEV__) console.log('[OfflineStorage] Migrating invoices table to allow NULL invoice_number...');
        // Schema migration runs once during initialize() before any other caller
        // can race the DB — safe to keep hand-rolled BEGIN/COMMIT here.
        await this.db.execAsync(`
          BEGIN TRANSACTION;
          
          -- Create new invoices table with correct schema
          CREATE TABLE IF NOT EXISTS invoices_new (
            id TEXT PRIMARY KEY,
            invoice_number TEXT,
            client_id TEXT,
            client_name TEXT,
            job_id TEXT,
            quote_id TEXT,
            status TEXT NOT NULL,
            subtotal REAL DEFAULT 0,
            gst_amount REAL DEFAULT 0,
            total REAL DEFAULT 0,
            amount_paid REAL DEFAULT 0,
            due_date TEXT,
            paid_at TEXT,
            notes TEXT,
            created_at TEXT,
            cached_at INTEGER NOT NULL,
            pending_sync INTEGER DEFAULT 0,
            sync_action TEXT,
            local_id TEXT
          );
          
          -- Copy data from old table
          INSERT INTO invoices_new SELECT * FROM invoices;
          
          -- Drop old table and rename new one
          DROP TABLE invoices;
          ALTER TABLE invoices_new RENAME TO invoices;
          
          -- Recreate indexes
          CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
          CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
          
          COMMIT;
        `);
        if (__DEV__) console.log('[OfflineStorage] Invoices table migrated successfully');
      }
      
      // Check if we need to migrate attachments table (local_uri should be nullable)
      const attachmentsInfo = await this.db.getAllAsync("PRAGMA table_info(attachments)");
      const localUriCol = (attachmentsInfo as any[]).find((c: any) => c.name === 'local_uri');
      
      if (localUriCol && localUriCol.notnull === 1) {
        if (__DEV__) console.log('[OfflineStorage] Migrating attachments table to allow NULL local_uri...');
        // Schema migration runs once during initialize() before any other caller
        // can race the DB — safe to keep hand-rolled BEGIN/COMMIT here.
        await this.db.execAsync(`
          BEGIN TRANSACTION;
          
          -- Create new attachments table with correct schema (local_uri nullable)
          CREATE TABLE IF NOT EXISTS attachments_new (
            id TEXT PRIMARY KEY,
            job_id TEXT,
            quote_id TEXT,
            invoice_id TEXT,
            client_id TEXT,
            type TEXT NOT NULL,
            filename TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            local_uri TEXT,
            remote_url TEXT,
            file_size INTEGER,
            description TEXT,
            cached_at INTEGER NOT NULL,
            pending_sync INTEGER DEFAULT 0,
            sync_action TEXT,
            local_id TEXT
          );
          
          -- Copy data from old table
          INSERT INTO attachments_new SELECT * FROM attachments;
          
          -- Drop old table and rename new one
          DROP TABLE attachments;
          ALTER TABLE attachments_new RENAME TO attachments;
          
          COMMIT;
        `);
        if (__DEV__) console.log('[OfflineStorage] Attachments table migrated successfully');
      }
      
      // Check if clients table is missing the "notes" column (added in a later version)
      const clientsInfo = await this.db.getAllAsync("PRAGMA table_info(clients)");
      const clientsNotesCol = (clientsInfo as any[]).find((c: any) => c.name === 'notes');
      
      if (!clientsNotesCol) {
        if (__DEV__) console.log('[OfflineStorage] Adding missing "notes" column to clients table...');
        await this.db.execAsync(`ALTER TABLE clients ADD COLUMN notes TEXT`);
        if (__DEV__) console.log('[OfflineStorage] Clients table "notes" column added successfully');
      }
      
      // Check if jobs table is missing the "client_name" column (added in a later version)
      const jobsInfo = await this.db.getAllAsync("PRAGMA table_info(jobs)");
      const jobsClientNameCol = (jobsInfo as any[]).find((c: any) => c.name === 'client_name');
      
      if (!jobsClientNameCol) {
        if (__DEV__) console.log('[OfflineStorage] Adding missing "client_name" column to jobs table...');
        await this.db.execAsync(`ALTER TABLE jobs ADD COLUMN client_name TEXT`);
        if (__DEV__) console.log('[OfflineStorage] Jobs table "client_name" column added successfully');
      }

      // F5: GPS columns on time_entries (best-effort; ignore if already present)
      try {
        const teInfo = await this.db.getAllAsync("PRAGMA table_info(time_entries)");
        const cols = new Set((teInfo as any[]).map((c: any) => c.name));
        const gpsCols: Array<[string, string]> = [
          ['start_lat', 'REAL'], ['start_lng', 'REAL'],
          ['end_lat', 'REAL'], ['end_lng', 'REAL'],
        ];
        for (const [name, type] of gpsCols) {
          if (!cols.has(name)) {
            try { await this.db.execAsync(`ALTER TABLE time_entries ADD COLUMN ${name} ${type}`); } catch {}
          }
        }
      } catch {}

      // C1: send_status on chat_messages (pending|failed|synced) for failed-send retry UI
      try {
        const cmInfo = await this.db.getAllAsync("PRAGMA table_info(chat_messages)");
        const cmCols = new Set((cmInfo as any[]).map((c: any) => c.name));
        if (!cmCols.has('send_status')) {
          try { await this.db.execAsync(`ALTER TABLE chat_messages ADD COLUMN send_status TEXT DEFAULT 'pending'`); } catch {}
        }
      } catch {}
      
    } catch (error) {
      if (__DEV__) console.warn('[OfflineStorage] Migration warning:', error);
      // Don't throw - we don't want to block initialization
    }
  }

  private handleNetworkChange = async (state: NetInfoState) => {
    const wasOffline = !useOfflineStore.getState().isOnline;
    const isNowOnline = state.isConnected ?? false;
    
    useOfflineStore.getState().setOnline(isNowOnline);
    
    // If we just came online, trigger sync
    if (wasOffline && isNowOnline) {
      if (__DEV__) console.log('[OfflineStorage] Network restored, triggering sync...');
      await this.syncPendingChanges();
    }
  };

  // ============ JOBS ============

  async cacheJobs(jobs: any[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    
    for (const job of jobs) {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO jobs 
         (id, title, description, address, status, scheduled_at, client_id, client_name, assigned_to, notes, cached_at, pending_sync, sync_action)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
           COALESCE((SELECT pending_sync FROM jobs WHERE id = ?), 0),
           (SELECT sync_action FROM jobs WHERE id = ?))`,
        [job.id, job.title, job.description, job.address, job.status, 
         job.scheduledAt, job.clientId, job.clientName, job.assignedTo, job.notes, now,
         job.id, job.id]
      );
    }
    
    await this.setMetadata('last_jobs_sync', now.toString());
    if (__DEV__) console.log(`[OfflineStorage] Cached ${jobs.length} jobs`);
  }

  async getCachedJobs(status?: string): Promise<CachedJob[]> {
    if (!this.db) return [];
    
    let query = 'SELECT * FROM jobs WHERE sync_action != "delete" OR sync_action IS NULL';
    const params: any[] = [];
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY scheduled_at ASC NULLS LAST';
    
    const rows = await this.db.getAllAsync(query, params);
    
    return rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      address: row.address,
      status: row.status,
      scheduledAt: row.scheduled_at,
      clientId: row.client_id,
      clientName: row.client_name,
      assignedTo: row.assigned_to,
      notes: row.notes,
      cachedAt: row.cached_at,
      pendingSync: row.pending_sync === 1,
      syncAction: row.sync_action,
      localId: row.local_id,
    }));
  }

  async getCachedJob(id: string): Promise<CachedJob | null> {
    if (!this.db) return null;
    
    const row = await this.db.getFirstAsync(
      'SELECT * FROM jobs WHERE id = ?',
      [id]
    ) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      address: row.address,
      status: row.status,
      scheduledAt: row.scheduled_at,
      clientId: row.client_id,
      clientName: row.client_name,
      assignedTo: row.assigned_to,
      notes: row.notes,
      cachedAt: row.cached_at,
      pendingSync: row.pending_sync === 1,
      syncAction: row.sync_action,
      localId: row.local_id,
    };
  }

  async saveJobOffline(job: Partial<CachedJob>, action: 'create' | 'update'): Promise<CachedJob> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    const localId = action === 'create' ? `local_${now}_${Math.random().toString(36).substr(2, 9)}` : undefined;
    const id = job.id || localId!;
    
    await this.db.runAsync(
      `INSERT OR REPLACE INTO jobs 
       (id, title, description, address, status, scheduled_at, client_id, client_name, assigned_to, notes, cached_at, pending_sync, sync_action, local_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [id, job.title || '', job.description ?? null, job.address ?? null, job.status || 'pending', 
       job.scheduledAt ?? null, job.clientId ?? null, job.clientName ?? null, job.assignedTo ?? null, job.notes ?? null, now, action, localId ?? null]
    );
    
    await this.addToSyncQueue('job', action, { ...job, id, localId });
    await this.updatePendingSyncCount();
    
    return { ...job, id, cachedAt: now, pendingSync: true, syncAction: action, localId } as CachedJob;
  }

  async updateJobOffline(jobId: string, updates: Partial<CachedJob>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    const existing = await this.getCachedJob(jobId);
    
    if (existing) {
      // Only apply fields that are explicitly provided (not undefined)
      // This prevents null overwriting of existing values
      const updated = { ...existing };
      const changedFields: Record<string, any> = {};
      
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined && key !== 'cachedAt' && key !== 'pendingSync' && key !== 'syncAction' && key !== 'localId') {
          (updated as any)[key] = value;
          changedFields[key] = value;
        }
      }
      
      updated.cachedAt = now;
      updated.pendingSync = true;
      updated.syncAction = 'update';
      
      await this.db.runAsync(
        `UPDATE jobs SET 
          title = ?, description = ?, address = ?, status = ?, scheduled_at = ?,
          client_id = ?, client_name = ?, assigned_to = ?, notes = ?,
          cached_at = ?, pending_sync = 1, sync_action = ?
         WHERE id = ?`,
        [updated.title, updated.description ?? null, updated.address ?? null, updated.status, updated.scheduledAt ?? null,
         updated.clientId ?? null, updated.clientName ?? null, updated.assignedTo ?? null, updated.notes ?? null,
         now, 'update', jobId]
      );
      
      // Only include changed fields in sync queue payload (not null/undefined fields)
      // This ensures PATCH only updates what was explicitly changed
      await this.addToSyncQueue('job', 'update', { 
        id: jobId, 
        ...changedFields
      });
      await this.updatePendingSyncCount();
    }
  }

  /**
   * Update job status offline with status progression tracking
   * Specialized method for status changes that tracks the previous status
   */
  async updateJobStatusOffline(jobId: string, newStatus: string, previousStatus: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    const existing = await this.getCachedJob(jobId);
    
    if (existing) {
      await this.db.runAsync(
        `UPDATE jobs SET 
          status = ?, cached_at = ?, pending_sync = 1, sync_action = ?
         WHERE id = ?`,
        [newStatus, now, 'update', jobId]
      );
      
      await this.addToSyncQueue('job', 'update', { 
        id: jobId, 
        status: newStatus,
        _previousValues: {
          status: previousStatus
        },
        _statusChange: {
          from: previousStatus,
          to: newStatus,
          changedAt: new Date().toISOString()
        }
      });
      await this.updatePendingSyncCount();
      
      if (__DEV__) console.log(`[OfflineStorage] Updated job ${jobId} status: ${previousStatus} -> ${newStatus}`);
    }
  }

  // ============ CLIENTS ============

  async cacheClients(clients: any[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    
    for (const client of clients) {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO clients 
         (id, name, email, phone, address, notes, cached_at, pending_sync, sync_action)
         VALUES (?, ?, ?, ?, ?, ?, ?,
           COALESCE((SELECT pending_sync FROM clients WHERE id = ?), 0),
           (SELECT sync_action FROM clients WHERE id = ?))`,
        [client.id, client.name, client.email, client.phone, client.address, client.notes, now, client.id, client.id]
      );
    }
    
    await this.setMetadata('last_clients_sync', now.toString());
    if (__DEV__) console.log(`[OfflineStorage] Cached ${clients.length} clients`);
  }

  async getCachedClients(): Promise<CachedClient[]> {
    if (!this.db) return [];
    
    const rows = await this.db.getAllAsync(
      'SELECT * FROM clients WHERE sync_action != "delete" OR sync_action IS NULL ORDER BY name ASC'
    );
    
    return rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      address: row.address,
      notes: row.notes,
      cachedAt: row.cached_at,
      pendingSync: row.pending_sync === 1,
      syncAction: row.sync_action,
      localId: row.local_id,
    }));
  }

  async getCachedClient(id: string): Promise<CachedClient | null> {
    if (!this.db) return null;
    
    const row = await this.db.getFirstAsync(
      'SELECT * FROM clients WHERE id = ?',
      [id]
    ) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      address: row.address,
      notes: row.notes,
      cachedAt: row.cached_at,
      pendingSync: row.pending_sync === 1,
      syncAction: row.sync_action,
      localId: row.local_id,
    };
  }

  async saveClientOffline(client: Partial<CachedClient>, action: 'create' | 'update'): Promise<CachedClient> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    const localId = action === 'create' ? `local_${now}_${Math.random().toString(36).substr(2, 9)}` : undefined;
    const id = client.id || localId!;
    
    await this.db.runAsync(
      `INSERT OR REPLACE INTO clients 
       (id, name, email, phone, address, notes, cached_at, pending_sync, sync_action, local_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [id, client.name || '', client.email ?? null, client.phone ?? null, client.address ?? null, client.notes ?? null, now, action, localId ?? null]
    );
    
    await this.addToSyncQueue('client', action, { ...client, id, localId });
    await this.updatePendingSyncCount();
    
    return { ...client, id, cachedAt: now, pendingSync: true, syncAction: action, localId } as CachedClient;
  }

  async updateClientOffline(clientId: string, updates: Partial<CachedClient>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    const existing = await this.getCachedClient(clientId);
    
    if (existing) {
      // Only apply fields that are explicitly provided (not undefined)
      // This prevents null overwriting of existing values
      const updated = { ...existing };
      const changedFields: Record<string, any> = {};
      
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined && key !== 'cachedAt' && key !== 'pendingSync' && key !== 'syncAction' && key !== 'localId') {
          (updated as any)[key] = value;
          changedFields[key] = value;
        }
      }
      
      updated.cachedAt = now;
      updated.pendingSync = true;
      updated.syncAction = 'update';
      
      await this.db.runAsync(
        `UPDATE clients SET 
          name = ?, email = ?, phone = ?, address = ?, notes = ?,
          cached_at = ?, pending_sync = 1, sync_action = ?
         WHERE id = ?`,
        [updated.name, updated.email ?? null, updated.phone ?? null, updated.address ?? null, updated.notes ?? null,
         now, 'update', clientId]
      );
      
      // Only include changed fields in sync queue payload
      await this.addToSyncQueue('client', 'update', { 
        id: clientId, 
        ...changedFields
      });
      await this.updatePendingSyncCount();
    }
  }

  // ============ QUOTES ============

  async cacheQuotes(quotes: any[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    
    for (const quote of quotes) {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO quotes 
         (id, quote_number, client_id, client_name, job_id, status, subtotal, gst_amount, total, valid_until, notes, created_at, cached_at, pending_sync, sync_action)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
           COALESCE((SELECT pending_sync FROM quotes WHERE id = ?), 0),
           (SELECT sync_action FROM quotes WHERE id = ?))`,
        [quote.id, quote.quoteNumber, quote.clientId, quote.clientName, quote.jobId, quote.status,
         quote.subtotal, quote.gstAmount, quote.total, quote.validUntil, quote.notes, quote.createdAt, now,
         quote.id, quote.id]
      );
    }
    
    await this.setMetadata('last_quotes_sync', now.toString());
    if (__DEV__) console.log(`[OfflineStorage] Cached ${quotes.length} quotes`);
  }

  async getCachedQuotes(): Promise<CachedQuote[]> {
    if (!this.db) return [];
    
    const rows = await this.db.getAllAsync(
      'SELECT * FROM quotes WHERE sync_action != "delete" OR sync_action IS NULL ORDER BY created_at DESC'
    );
    
    return rows.map((row: any) => ({
      id: row.id,
      quoteNumber: row.quote_number,
      clientId: row.client_id,
      clientName: row.client_name,
      jobId: row.job_id,
      status: row.status,
      subtotal: row.subtotal,
      gstAmount: row.gst_amount,
      total: row.total,
      validUntil: row.valid_until,
      notes: row.notes,
      createdAt: row.created_at,
      cachedAt: row.cached_at,
      pendingSync: row.pending_sync === 1,
      syncAction: row.sync_action,
      localId: row.local_id,
    }));
  }

  async getCachedQuote(id: string): Promise<CachedQuote | null> {
    if (!this.db) return null;
    
    const row = await this.db.getFirstAsync(
      'SELECT * FROM quotes WHERE id = ?',
      [id]
    ) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      quoteNumber: row.quote_number,
      clientId: row.client_id,
      clientName: row.client_name,
      jobId: row.job_id,
      status: row.status,
      subtotal: row.subtotal,
      gstAmount: row.gst_amount,
      total: row.total,
      validUntil: row.valid_until,
      notes: row.notes,
      createdAt: row.created_at,
      cachedAt: row.cached_at,
      pendingSync: row.pending_sync === 1,
      syncAction: row.sync_action,
      localId: row.local_id,
    };
  }

  async updateQuoteOffline(quoteId: string, updates: Partial<CachedQuote>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    const existing = await this.getCachedQuote(quoteId);
    
    if (existing) {
      const updated = { ...existing, ...updates, cachedAt: now, pendingSync: true, syncAction: 'update' as const };
      
      await this.db.runAsync(
        `UPDATE quotes SET 
          status = ?, subtotal = ?, gst_amount = ?, total = ?, valid_until = ?, notes = ?,
          cached_at = ?, pending_sync = 1, sync_action = ?
         WHERE id = ?`,
        [updated.status, updated.subtotal, updated.gstAmount, updated.total, updated.validUntil ?? null, updated.notes ?? null,
         now, 'update', quoteId]
      );
      
      // Only include changed fields in sync queue payload
      const changedFields: Record<string, any> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined && key !== 'cachedAt' && key !== 'pendingSync' && key !== 'syncAction' && key !== 'localId') {
          changedFields[key] = value;
        }
      }
      await this.addToSyncQueue('quote', 'update', { id: quoteId, ...changedFields });
      await this.updatePendingSyncCount();
    }
  }

  /**
   * Save a quote offline for later sync
   * Includes line items which will be sent along with the quote
   */
  async saveQuoteOffline(quote: {
    clientId: string;
    clientName?: string;
    jobId?: string;
    title?: string;
    description?: string;
    notes?: string;
    validUntil?: string;
    subtotal: number;
    gstAmount: number;
    total: number;
    depositRequired?: boolean;
    depositPercent?: number;
    depositAmount?: number;
    lineItems: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
    }>;
  }): Promise<CachedQuote> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    const localId = `local_${now}_${Math.random().toString(36).substr(2, 9)}`;
    const id = localId;
    
    // Insert quote record
    await this.db.runAsync(
      `INSERT INTO quotes 
       (id, quote_number, client_id, client_name, job_id, status, subtotal, gst_amount, total, valid_until, notes, created_at, cached_at, pending_sync, sync_action, local_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'create', ?)`,
      [id, null, quote.clientId, quote.clientName ?? null, quote.jobId ?? null, 'draft', 
       quote.subtotal, quote.gstAmount, quote.total, quote.validUntil ?? null, quote.notes ?? null,
       new Date().toISOString(), now, localId]
    );
    
    // Cache line items locally
    const lineItemsWithIds = quote.lineItems.map((item, index) => ({
      id: `${localId}_item_${index}`,
      quoteId: id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.quantity * item.unitPrice,
    }));
    
    await this.cacheQuoteLineItems(id, lineItemsWithIds);
    
    // Add to sync queue with all data including line items
    await this.addToSyncQueue('quote', 'create', { 
      ...quote, 
      id, 
      localId,
      lineItems: quote.lineItems 
    });
    await this.updatePendingSyncCount();
    
    if (__DEV__) console.log(`[OfflineStorage] Saved quote offline: ${id}`);
    return { 
      id, 
      quoteNumber: '', 
      clientId: quote.clientId,
      clientName: quote.clientName,
      jobId: quote.jobId,
      status: 'draft',
      subtotal: quote.subtotal,
      gstAmount: quote.gstAmount,
      total: quote.total,
      validUntil: quote.validUntil,
      notes: quote.notes,
      createdAt: new Date().toISOString(),
      cachedAt: now, 
      pendingSync: true, 
      syncAction: 'create', 
      localId 
    };
  }

  // ============ QUOTE LINE ITEMS ============

  async cacheQuoteLineItems(quoteId: string, lineItems: any[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    
    // Clear existing line items for this quote
    await this.db.runAsync('DELETE FROM quote_line_items WHERE quote_id = ?', [quoteId]);
    
    for (const item of lineItems) {
      await this.db.runAsync(
        `INSERT INTO quote_line_items 
         (id, quote_id, description, quantity, unit_price, total, cached_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [item.id, quoteId, item.description, item.quantity || 1, item.unitPrice || 0, item.total || 0, now]
      );
    }
    
    if (__DEV__) console.log(`[OfflineStorage] Cached ${lineItems.length} line items for quote ${quoteId}`);
  }

  async getCachedQuoteLineItems(quoteId: string): Promise<CachedQuoteLineItem[]> {
    if (!this.db) return [];
    
    const rows = await this.db.getAllAsync(
      'SELECT * FROM quote_line_items WHERE quote_id = ?',
      [quoteId]
    );
    
    return rows.map((row: any) => ({
      id: row.id,
      quoteId: row.quote_id,
      description: row.description,
      quantity: row.quantity,
      unitPrice: row.unit_price,
      total: row.total,
      cachedAt: row.cached_at,
    }));
  }

  // ============ INVOICES ============

  async cacheInvoices(invoices: any[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    
    for (const invoice of invoices) {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO invoices 
         (id, invoice_number, client_id, client_name, job_id, quote_id, status, subtotal, gst_amount, total, amount_paid, due_date, paid_at, notes, created_at, cached_at, pending_sync, sync_action)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
           COALESCE((SELECT pending_sync FROM invoices WHERE id = ?), 0),
           (SELECT sync_action FROM invoices WHERE id = ?))`,
        [invoice.id, invoice.invoiceNumber, invoice.clientId, invoice.clientName, invoice.jobId, invoice.quoteId, invoice.status,
         invoice.subtotal, invoice.gstAmount, invoice.total, invoice.amountPaid, invoice.dueDate, invoice.paidAt, invoice.notes, invoice.createdAt, now,
         invoice.id, invoice.id]
      );
    }
    
    await this.setMetadata('last_invoices_sync', now.toString());
    if (__DEV__) console.log(`[OfflineStorage] Cached ${invoices.length} invoices`);
  }

  async getCachedInvoices(): Promise<CachedInvoice[]> {
    if (!this.db) return [];
    
    const rows = await this.db.getAllAsync(
      'SELECT * FROM invoices WHERE sync_action != "delete" OR sync_action IS NULL ORDER BY created_at DESC'
    );
    
    return rows.map((row: any) => ({
      id: row.id,
      invoiceNumber: row.invoice_number,
      clientId: row.client_id,
      clientName: row.client_name,
      jobId: row.job_id,
      quoteId: row.quote_id,
      status: row.status,
      subtotal: row.subtotal,
      gstAmount: row.gst_amount,
      total: row.total,
      amountPaid: row.amount_paid,
      dueDate: row.due_date,
      paidAt: row.paid_at,
      notes: row.notes,
      createdAt: row.created_at,
      cachedAt: row.cached_at,
      pendingSync: row.pending_sync === 1,
      syncAction: row.sync_action,
      localId: row.local_id,
    }));
  }

  async getCachedInvoice(id: string): Promise<CachedInvoice | null> {
    if (!this.db) return null;
    
    const row = await this.db.getFirstAsync(
      'SELECT * FROM invoices WHERE id = ?',
      [id]
    ) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      invoiceNumber: row.invoice_number,
      clientId: row.client_id,
      clientName: row.client_name,
      jobId: row.job_id,
      quoteId: row.quote_id,
      status: row.status,
      subtotal: row.subtotal,
      gstAmount: row.gst_amount,
      total: row.total,
      amountPaid: row.amount_paid,
      dueDate: row.due_date,
      paidAt: row.paid_at,
      notes: row.notes,
      createdAt: row.created_at,
      cachedAt: row.cached_at,
      pendingSync: row.pending_sync === 1,
      syncAction: row.sync_action,
      localId: row.local_id,
    };
  }

  async updateInvoiceOffline(invoiceId: string, updates: Partial<CachedInvoice>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    const existing = await this.getCachedInvoice(invoiceId);
    
    if (existing) {
      const updated = { ...existing, ...updates, cachedAt: now, pendingSync: true, syncAction: 'update' as const };
      
      await this.db.runAsync(
        `UPDATE invoices SET 
          status = ?, subtotal = ?, gst_amount = ?, total = ?, amount_paid = ?, due_date = ?, paid_at = ?, notes = ?,
          cached_at = ?, pending_sync = 1, sync_action = ?
         WHERE id = ?`,
        [updated.status, updated.subtotal, updated.gstAmount, updated.total, updated.amountPaid, updated.dueDate ?? null, updated.paidAt ?? null, updated.notes ?? null,
         now, 'update', invoiceId]
      );
      
      await this.addToSyncQueue('invoice', 'update', { 
        id: invoiceId, 
        ...updates,
        _previousValues: {
          status: existing.status,
          subtotal: existing.subtotal,
          gstAmount: existing.gstAmount,
          total: existing.total,
          amountPaid: existing.amountPaid,
          dueDate: existing.dueDate,
          paidAt: existing.paidAt,
          notes: existing.notes,
        }
      });
      await this.updatePendingSyncCount();
    }
  }

  /**
   * Save an invoice offline for later sync
   * Includes line items which will be sent along with the invoice
   */
  async saveInvoiceOffline(invoice: {
    clientId: string;
    clientName?: string;
    jobId?: string;
    quoteId?: string;
    title?: string;
    description?: string;
    notes?: string;
    dueDate?: string;
    subtotal: number;
    gstAmount: number;
    total: number;
    isRecurring?: boolean;
    recurrencePattern?: string;
    recurrenceEndDate?: string;
    lineItems: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
    }>;
  }): Promise<CachedInvoice> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    const localId = `local_${now}_${Math.random().toString(36).substr(2, 9)}`;
    const id = localId;
    
    // Insert invoice record
    await this.db.runAsync(
      `INSERT INTO invoices 
       (id, invoice_number, client_id, client_name, job_id, quote_id, status, subtotal, gst_amount, total, amount_paid, due_date, paid_at, notes, created_at, cached_at, pending_sync, sync_action, local_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'create', ?)`,
      [id, null, invoice.clientId, invoice.clientName ?? null, invoice.jobId ?? null, invoice.quoteId ?? null, 'draft', 
       invoice.subtotal, invoice.gstAmount, invoice.total, 0, invoice.dueDate ?? null, null, invoice.notes ?? null,
       new Date().toISOString(), now, localId]
    );
    
    // Cache line items locally
    const lineItemsWithIds = invoice.lineItems.map((item, index) => ({
      id: `${localId}_item_${index}`,
      invoiceId: id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.quantity * item.unitPrice,
    }));
    
    await this.cacheInvoiceLineItems(id, lineItemsWithIds);
    
    // Add to sync queue with all data including line items
    await this.addToSyncQueue('invoice', 'create', { 
      ...invoice, 
      id, 
      localId,
      lineItems: invoice.lineItems 
    });
    await this.updatePendingSyncCount();
    
    if (__DEV__) console.log(`[OfflineStorage] Saved invoice offline: ${id}`);
    return { 
      id, 
      invoiceNumber: '', 
      clientId: invoice.clientId,
      clientName: invoice.clientName,
      jobId: invoice.jobId,
      quoteId: invoice.quoteId,
      status: 'draft',
      subtotal: invoice.subtotal,
      gstAmount: invoice.gstAmount,
      total: invoice.total,
      amountPaid: 0,
      dueDate: invoice.dueDate,
      paidAt: undefined,
      notes: invoice.notes,
      createdAt: new Date().toISOString(),
      cachedAt: now, 
      pendingSync: true, 
      syncAction: 'create', 
      localId 
    };
  }

  // ============ INVOICE LINE ITEMS ============

  async cacheInvoiceLineItems(invoiceId: string, lineItems: any[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    
    // Clear existing line items for this invoice
    await this.db.runAsync('DELETE FROM invoice_line_items WHERE invoice_id = ?', [invoiceId]);
    
    for (const item of lineItems) {
      await this.db.runAsync(
        `INSERT INTO invoice_line_items 
         (id, invoice_id, description, quantity, unit_price, total, cached_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [item.id, invoiceId, item.description, item.quantity || 1, item.unitPrice || 0, item.total || 0, now]
      );
    }
    
    if (__DEV__) console.log(`[OfflineStorage] Cached ${lineItems.length} line items for invoice ${invoiceId}`);
  }

  async getCachedInvoiceLineItems(invoiceId: string): Promise<CachedInvoiceLineItem[]> {
    if (!this.db) return [];
    
    const rows = await this.db.getAllAsync(
      'SELECT * FROM invoice_line_items WHERE invoice_id = ?',
      [invoiceId]
    );
    
    return rows.map((row: any) => ({
      id: row.id,
      invoiceId: row.invoice_id,
      description: row.description,
      quantity: row.quantity,
      unitPrice: row.unit_price,
      total: row.total,
      cachedAt: row.cached_at,
    }));
  }

  // ============ TIME ENTRIES ============

  async cacheTimeEntries(entries: any[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    
    for (const entry of entries) {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO time_entries 
         (id, user_id, job_id, description, start_time, end_time, notes, cached_at, pending_sync, sync_action)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?,
           COALESCE((SELECT pending_sync FROM time_entries WHERE id = ?), 0),
           (SELECT sync_action FROM time_entries WHERE id = ?))`,
        [entry.id, entry.userId, entry.jobId, entry.description, entry.startTime, entry.endTime, entry.notes, now,
         entry.id, entry.id]
      );
    }
    
    await this.setMetadata('last_time_entries_sync', now.toString());
    if (__DEV__) console.log(`[OfflineStorage] Cached ${entries.length} time entries`);
  }

  async getCachedTimeEntries(): Promise<CachedTimeEntry[]> {
    if (!this.db) return [];
    
    const rows = await this.db.getAllAsync(
      'SELECT * FROM time_entries WHERE sync_action != "delete" OR sync_action IS NULL ORDER BY start_time DESC'
    );
    
    return rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      jobId: row.job_id,
      description: row.description,
      startTime: row.start_time,
      endTime: row.end_time,
      notes: row.notes,
      cachedAt: row.cached_at,
      pendingSync: row.pending_sync === 1,
      syncAction: row.sync_action,
      localId: row.local_id,
    }));
  }

  async saveTimeEntryOffline(entry: Partial<CachedTimeEntry>, action: 'create' | 'update'): Promise<CachedTimeEntry> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    const localId = action === 'create' ? `local_${now}_${Math.random().toString(36).substr(2, 9)}` : undefined;
    const id = entry.id || localId!;
    
    await this.db.runAsync(
      `INSERT OR REPLACE INTO time_entries 
       (id, user_id, job_id, description, start_time, end_time, notes, cached_at, pending_sync, sync_action, local_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [id, entry.userId || '', entry.jobId ?? null, entry.description ?? null, entry.startTime || new Date().toISOString(), entry.endTime ?? null, entry.notes ?? null, now, action, localId ?? null]
    );
    
    await this.addToSyncQueue('timeEntry', action, { ...entry, id, localId });
    await this.updatePendingSyncCount();
    
    return { ...entry, id, cachedAt: now, pendingSync: true, syncAction: action, localId } as CachedTimeEntry;
  }

  /**
   * Start a time entry offline with local timestamp
   * Creates a new time entry with the current time as start time
   */
  async startTimeEntryOffline(userId: string, jobId?: string, description?: string): Promise<CachedTimeEntry> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    const localId = `local_${now}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = new Date().toISOString();

    // F5: Best-effort GPS capture (5s timeout)
    let startLat: number | null = null;
    let startLng: number | null = null;
    try {
      const Location = await import('expo-location');
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status === 'granted') {
        const loc = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
        ]);
        if (loc && (loc as any).coords) {
          startLat = (loc as any).coords.latitude;
          startLng = (loc as any).coords.longitude;
        }
      }
    } catch {}

    await this.db.runAsync(
      `INSERT INTO time_entries 
       (id, user_id, job_id, description, start_time, end_time, notes, cached_at, pending_sync, sync_action, local_id, start_lat, start_lng)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'create', ?, ?, ?)`,
      [localId, userId, jobId ?? null, description ?? null, startTime, null, null, now, localId, startLat, startLng]
    );
    
    const entry: CachedTimeEntry = {
      id: localId,
      userId,
      jobId,
      description,
      startTime,
      endTime: undefined,
      notes: undefined,
      cachedAt: now,
      pendingSync: true,
      syncAction: 'create',
      localId,
    };
    
    await this.addToSyncQueue('timeEntry', 'create', {
      ...entry,
      clockInLatitude: startLat,
      clockInLongitude: startLng,
    });
    await this.updatePendingSyncCount();
    
    if (__DEV__) console.log(`[OfflineStorage] Started time entry offline: ${localId} gps=${startLat},${startLng}`);
    return entry;
  }

  /**
   * Stop a time entry offline and queue for sync
   * Updates the end time of an existing time entry
   */
  async stopTimeEntryOffline(entryId: string): Promise<CachedTimeEntry | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    const endTime = new Date().toISOString();
    
    // Get existing entry
    const row = await this.db.getFirstAsync(
      'SELECT * FROM time_entries WHERE id = ?',
      [entryId]
    ) as any;
    
    if (!row) {
      if (__DEV__) console.warn(`[OfflineStorage] Time entry ${entryId} not found`);
      return null;
    }

    // F5: Best-effort GPS capture for clock-out
    let endLat: number | null = null;
    let endLng: number | null = null;
    try {
      const Location = await import('expo-location');
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status === 'granted') {
        const loc = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
        ]);
        if (loc && (loc as any).coords) {
          endLat = (loc as any).coords.latitude;
          endLng = (loc as any).coords.longitude;
        }
      }
    } catch {}

    // Update the entry with end time + GPS
    await this.db.runAsync(
      `UPDATE time_entries SET 
        end_time = ?, cached_at = ?, pending_sync = 1, sync_action = ?,
        end_lat = ?, end_lng = ?
       WHERE id = ?`,
      [endTime, now, 'update', endLat, endLng, entryId]
    );
    
    const entry: CachedTimeEntry = {
      id: row.id,
      userId: row.user_id,
      jobId: row.job_id,
      description: row.description,
      startTime: row.start_time,
      endTime,
      notes: row.notes,
      cachedAt: now,
      pendingSync: true,
      syncAction: 'update',
      localId: row.local_id,
    };
    
    await this.addToSyncQueue('timeEntry', 'update', { 
      id: entryId, 
      endTime,
      clockOutLatitude: endLat,
      clockOutLongitude: endLng,
      _previousValues: {
        endTime: row.end_time
      }
    });
    await this.updatePendingSyncCount();
    
    if (__DEV__) console.log(`[OfflineStorage] Stopped time entry offline: ${entryId}`);
    return entry;
  }

  /**
   * Discard a local-only time entry that has never reached the server.
   * Removes the row from SQLite AND any pending sync_queue items for it.
   * Safe to call only with ids starting with "local_".
   */
  async discardLocalTimeEntry(entryId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    if (!entryId.startsWith('local_')) {
      if (__DEV__) console.warn(`[OfflineStorage] discardLocalTimeEntry called with non-local id: ${entryId}`);
      return;
    }
    await this.db.runAsync('DELETE FROM time_entries WHERE id = ?', [entryId]);
    // Remove any queued sync ops for this entry (create/update). Match by JSON id field.
    await this.db.runAsync(
      `DELETE FROM sync_queue WHERE entity_type = 'timeEntry' AND (payload LIKE ? OR payload LIKE ?)`,
      [`%"id":"${entryId}"%`, `%"localId":"${entryId}"%`]
    );
    await this.updatePendingSyncCount();
    if (__DEV__) console.log(`[OfflineStorage] Discarded local time entry: ${entryId}`);
  }

  // ============ ATTACHMENTS ============

  async cacheAttachments(attachments: any[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    
    for (const attachment of attachments) {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO attachments 
         (id, job_id, quote_id, invoice_id, client_id, type, filename, mime_type, local_uri, remote_url, file_size, description, cached_at, pending_sync, sync_action)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
           COALESCE((SELECT pending_sync FROM attachments WHERE id = ?), 0),
           (SELECT sync_action FROM attachments WHERE id = ?))`,
        [attachment.id, attachment.jobId, attachment.quoteId, attachment.invoiceId, attachment.clientId,
         attachment.type, attachment.filename, attachment.mimeType, attachment.localUri,
         attachment.remoteUrl, attachment.fileSize, attachment.description, now,
         attachment.id, attachment.id]
      );
    }
    
    await this.setMetadata('last_attachments_sync', now.toString());
    if (__DEV__) console.log(`[OfflineStorage] Cached ${attachments.length} attachments`);
  }

  async getCachedAttachments(filter?: { jobId?: string; quoteId?: string; invoiceId?: string; clientId?: string; type?: string }): Promise<CachedAttachment[]> {
    if (!this.db) return [];
    
    let query = 'SELECT * FROM attachments WHERE (sync_action != "delete" OR sync_action IS NULL)';
    const params: any[] = [];
    
    if (filter?.jobId) {
      query += ' AND job_id = ?';
      params.push(filter.jobId);
    }
    if (filter?.quoteId) {
      query += ' AND quote_id = ?';
      params.push(filter.quoteId);
    }
    if (filter?.invoiceId) {
      query += ' AND invoice_id = ?';
      params.push(filter.invoiceId);
    }
    if (filter?.clientId) {
      query += ' AND client_id = ?';
      params.push(filter.clientId);
    }
    if (filter?.type) {
      query += ' AND type = ?';
      params.push(filter.type);
    }
    
    query += ' ORDER BY cached_at DESC';
    
    const rows = await this.db.getAllAsync(query, params);
    
    return rows.map((row: any) => ({
      id: row.id,
      jobId: row.job_id,
      quoteId: row.quote_id,
      invoiceId: row.invoice_id,
      clientId: row.client_id,
      type: row.type,
      filename: row.filename,
      mimeType: row.mime_type,
      localUri: row.local_uri,
      remoteUrl: row.remote_url,
      fileSize: row.file_size,
      description: row.description,
      cachedAt: row.cached_at,
      pendingSync: row.pending_sync === 1,
      syncAction: row.sync_action,
      localId: row.local_id,
    }));
  }

  async getCachedAttachment(id: string): Promise<CachedAttachment | null> {
    if (!this.db) return null;
    
    const row = await this.db.getFirstAsync(
      'SELECT * FROM attachments WHERE id = ?',
      [id]
    ) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      jobId: row.job_id,
      quoteId: row.quote_id,
      invoiceId: row.invoice_id,
      clientId: row.client_id,
      type: row.type,
      filename: row.filename,
      mimeType: row.mime_type,
      localUri: row.local_uri,
      remoteUrl: row.remote_url,
      fileSize: row.file_size,
      description: row.description,
      cachedAt: row.cached_at,
      pendingSync: row.pending_sync === 1,
      syncAction: row.sync_action,
      localId: row.local_id,
    };
  }

  /**
   * Save an attachment offline for later sync
   * The attachment file is stored locally and will be uploaded when online
   */
  async saveAttachmentOffline(attachment: Partial<CachedAttachment>): Promise<CachedAttachment> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    const localId = `local_${now}_${Math.random().toString(36).substr(2, 9)}`;
    const id = attachment.id || localId;
    
    await this.db.runAsync(
      `INSERT OR REPLACE INTO attachments 
       (id, job_id, quote_id, invoice_id, client_id, type, filename, mime_type, local_uri, remote_url, file_size, description, cached_at, pending_sync, sync_action, local_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'create', ?)`,
      [id, attachment.jobId ?? null, attachment.quoteId ?? null, attachment.invoiceId ?? null, attachment.clientId ?? null,
       attachment.type ?? 'photo', attachment.filename ?? 'unknown', attachment.mimeType ?? 'application/octet-stream', attachment.localUri ?? null,
       attachment.remoteUrl ?? null, attachment.fileSize ?? null, attachment.description ?? null, now, localId]
    );
    
    // Add to sync queue - attachment upload handled specially
    await this.addToSyncQueue('attachment', 'create', { ...attachment, id, localId });
    await this.updatePendingSyncCount();
    
    if (__DEV__) console.log(`[OfflineStorage] Saved attachment offline: ${attachment.filename}`);
    return { ...attachment, id, cachedAt: now, pendingSync: true, syncAction: 'create', localId } as CachedAttachment;
  }

  /**
   * Delete an attachment (mark for deletion on sync)
   */
  async deleteAttachmentOffline(attachmentId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const existing = await this.getCachedAttachment(attachmentId);
    if (!existing) return;
    
    // If it's a local-only attachment, just delete it
    if (existing.localId && !existing.remoteUrl) {
      await this.db.runAsync('DELETE FROM attachments WHERE id = ?', [attachmentId]);
      await this.db.runAsync('DELETE FROM sync_queue WHERE data LIKE ?', [`%"id":"${attachmentId}"%`]);
    } else {
      // Mark for deletion on next sync
      await this.db.runAsync(
        'UPDATE attachments SET pending_sync = 1, sync_action = ? WHERE id = ?',
        ['delete', attachmentId]
      );
      await this.addToSyncQueue('attachment', 'delete', { id: attachmentId });
    }
    
    await this.updatePendingSyncCount();
  }

  // ============ SYNC QUEUE ============

  /**
   * Queue an "on my way" notification for offline sync
   * This is a special action that calls the job's on-my-way endpoint
   */
  async queueOnMyWayNotification(jobId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const id = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const idempotencyKey = `omw_${jobId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    
    await this.db.runAsync(
      `INSERT INTO sync_queue (id, type, action, data, created_at, retry_count)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [id, 'job', 'on_my_way', JSON.stringify({ id: jobId, idempotencyKey, queuedAt: now }), now]
    );
    
    await this.updatePendingSyncCount();
    if (__DEV__) console.log(`[OfflineStorage] Queued on_my_way notification for job ${jobId}`);
  }

  private async addToSyncQueue(
    type: 'job' | 'client' | 'quote' | 'invoice' | 'timeEntry' | 'attachment',
    action: 'create' | 'update' | 'delete',
    data: any
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const id = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    
    if (action === 'create' && !data.clientGeneratedId) {
      data.clientGeneratedId = `cg_${now}_${Math.random().toString(36).substr(2, 9)}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Check for existing sync item for the same entity
    const existing = await this.db.getFirstAsync(
      `SELECT * FROM sync_queue WHERE type = ? AND json_extract(data, '$.id') = ?`,
      [type, data.id]
    );
    
    if (existing) {
      const existingAction = (existing as any).action;
      let mergedData = data;
      let finalAction = action;

      if (existingAction === 'create' && action === 'update') {
        const existingData = JSON.parse((existing as any).data);
        mergedData = { ...existingData, ...data };
        finalAction = 'create';
      } else if (existingAction === 'update' && action === 'update') {
        const existingData = JSON.parse((existing as any).data);
        mergedData = { ...existingData, ...data };
      } else if (existingAction === 'create' && action === 'delete') {
        await this.db.runAsync(
          `DELETE FROM sync_queue WHERE id = ?`,
          [(existing as any).id]
        );
        await this.updatePendingSyncCount();
        return;
      }

      await this.db.runAsync(
        `UPDATE sync_queue SET action = ?, data = ?, created_at = ? WHERE id = ?`,
        [finalAction, JSON.stringify(mergedData), now, (existing as any).id]
      );
    } else {
      // Insert new sync item
      await this.db.runAsync(
        `INSERT INTO sync_queue (id, type, action, data, created_at, retry_count)
         VALUES (?, ?, ?, ?, ?, 0)`,
        [id, type, action, JSON.stringify(data), now]
      );
    }
    
    if (__DEV__) console.log(`[OfflineStorage] Added to sync queue: ${type} ${action}`);
  }

  /**
   * Calculate backoff delay in milliseconds based on retry count
   * Product spec: 30s → 2m → 5m → 15m → 30m (then capped at 30m)
   */
  private getBackoffDelay(retryCount: number): number {
    if (retryCount === 0) return 0;
    
    const delays = [
      30 * 1000,
      2 * 60 * 1000,
      5 * 60 * 1000,
      15 * 60 * 1000,
      30 * 60 * 1000,
    ];
    
    const index = Math.min(retryCount - 1, delays.length - 1);
    const baseDelay = delays[index];
    const jitter = Math.random() * baseDelay * 0.3;
    return baseDelay + jitter;
  }

  async getPendingSyncItems(): Promise<PendingSyncItem[]> {
    if (!this.db) return [];
    
    const rows = await this.db.getAllAsync(
      'SELECT * FROM sync_queue ORDER BY created_at ASC'
    );
    
    const now = Date.now();
    
    // Filter items that are ready for retry based on exponential backoff
    return rows
      .map((row: any) => ({
        id: row.id,
        type: row.type,
        action: row.action,
        data: row.data,
        createdAt: row.created_at,
        retryCount: row.retry_count,
        lastError: row.last_error,
        lastAttemptedAt: row.last_attempted_at,
      }))
      .filter((item) => {
        // Skip items that have exceeded max retries
        if (item.retryCount >= MAX_RETRY_ATTEMPTS) return false;
        
        // First attempt - always ready
        if (!item.lastAttemptedAt || item.retryCount === 0) return true;
        
        // Calculate backoff delay
        const delay = this.getBackoffDelay(item.retryCount);
        const nextRetryTime = item.lastAttemptedAt + delay;
        
        // Check if enough time has passed
        return now >= nextRetryTime;
      });
  }

  /**
   * Get pending sync counts grouped by category for adaptive warning messages
   * Returns counts for jobs, clients, quotes, invoices, time entries, and attachments by type
   */
  async getPendingSyncCountsByCategory(): Promise<{
    jobs: number;
    clients: number;
    quotes: number;
    invoices: number;
    timeEntries: number;
    photos: number;
    signatures: number;
    documents: number;
    voiceNotes: number;
    total: number;
  }> {
    if (!this.db) {
      return { jobs: 0, clients: 0, quotes: 0, invoices: 0, timeEntries: 0, photos: 0, signatures: 0, documents: 0, voiceNotes: 0, total: 0 };
    }
    
    const counts = {
      jobs: 0,
      clients: 0,
      quotes: 0,
      invoices: 0,
      timeEntries: 0,
      photos: 0,
      signatures: 0,
      documents: 0,
      voiceNotes: 0,
      total: 0,
    };
    
    try {
      // Get all pending sync items from the queue
      const rows = await this.db.getAllAsync(
        'SELECT type, data FROM sync_queue WHERE retry_count < ?',
        [MAX_RETRY_ATTEMPTS]
      ) as { type: string; data: string }[];
      
      for (const row of rows) {
        counts.total++;
        
        switch (row.type) {
          case 'job':
            counts.jobs++;
            break;
          case 'client':
            counts.clients++;
            break;
          case 'quote':
            counts.quotes++;
            break;
          case 'invoice':
            counts.invoices++;
            break;
          case 'timeEntry':
            counts.timeEntries++;
            break;
          case 'attachment':
            // Parse data to get attachment type (photo, signature, document, voice_note)
            // Also check mimeType for audio files which are voice notes
            try {
              const data = JSON.parse(row.data);
              const isAudioMimeType = data.mimeType?.startsWith('audio/');
              
              if (data.type === 'voice_note' || isAudioMimeType) {
                counts.voiceNotes++;
              } else if (data.type === 'photo') {
                counts.photos++;
              } else if (data.type === 'signature') {
                counts.signatures++;
              } else if (data.type === 'document') {
                counts.documents++;
              } else {
                // Unknown attachment type, count as document
                counts.documents++;
              }
            } catch {
              counts.documents++;
            }
            break;
        }
      }
    } catch (error) {
      if (__DEV__) console.warn('[OfflineStorage] Failed to get pending sync counts:', error);
    }
    
    return counts;
  }

  /**
   * Generate human-readable message for pending uploads
   * Returns a string like "2 photos, 1 voice note" or null if nothing pending
   */
  async getPendingUploadsMessage(): Promise<string | null> {
    const counts = await this.getPendingSyncCountsByCategory();
    
    if (counts.total === 0) return null;
    
    const parts: string[] = [];
    
    // Attachments first (most visible to users)
    if (counts.photos > 0) {
      parts.push(`${counts.photos} photo${counts.photos !== 1 ? 's' : ''}`);
    }
    if (counts.voiceNotes > 0) {
      parts.push(`${counts.voiceNotes} voice note${counts.voiceNotes !== 1 ? 's' : ''}`);
    }
    if (counts.signatures > 0) {
      parts.push(`${counts.signatures} signature${counts.signatures !== 1 ? 's' : ''}`);
    }
    if (counts.documents > 0) {
      parts.push(`${counts.documents} document${counts.documents !== 1 ? 's' : ''}`);
    }
    
    // Core data types
    if (counts.jobs > 0) {
      parts.push(`${counts.jobs} job update${counts.jobs !== 1 ? 's' : ''}`);
    }
    if (counts.clients > 0) {
      parts.push(`${counts.clients} client update${counts.clients !== 1 ? 's' : ''}`);
    }
    if (counts.quotes > 0) {
      parts.push(`${counts.quotes} quote${counts.quotes !== 1 ? 's' : ''}`);
    }
    if (counts.invoices > 0) {
      parts.push(`${counts.invoices} invoice${counts.invoices !== 1 ? 's' : ''}`);
    }
    if (counts.timeEntries > 0) {
      parts.push(`${counts.timeEntries} time ${counts.timeEntries !== 1 ? 'entries' : 'entry'}`);
    }
    
    if (parts.length === 0) return null;
    
    // Format: "2 photos, 1 voice note, 3 job updates"
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
    return parts.slice(0, -1).join(', ') + ', and ' + parts[parts.length - 1];
  }

  /**
   * Clean up sync items that have permanently failed (exceeded max retries)
   * Moves them to a failed state and notifies the user
   */
  private async cleanupFailedSyncItems(): Promise<void> {
    if (!this.db) return;
    
    try {
      const failedItems = await this.db.getAllAsync(
        `SELECT * FROM sync_queue WHERE retry_count >= ?`,
        [MAX_RETRY_ATTEMPTS]
      ) as any[];
      
      if (failedItems.length === 0) return;
      
      if (__DEV__) console.log(`[OfflineStorage] Marking ${failedItems.length} permanently failed sync items`);
      
      for (const item of failedItems) {
        if (__DEV__) console.warn(`[OfflineStorage] Permanently failed: ${item.type} ${item.action} - ${item.last_error}`);
        
        const data = JSON.parse(item.data);
        const tableMap: Record<string, string> = {
          job: 'jobs', client: 'clients', quote: 'quotes',
          invoice: 'invoices', timeEntry: 'time_entries', attachment: 'attachments'
        };
        const table = tableMap[item.type];
        
        if (table && data.id) {
          await this.db.runAsync(
            `UPDATE ${table} SET pending_sync = 0, sync_action = 'failed' WHERE id = ?`,
            [data.id]
          );
        }

        await this.db.runAsync(
          `UPDATE sync_queue SET last_error = ? WHERE id = ?`,
          [`PERMANENTLY_FAILED: ${item.last_error || 'Max retries exceeded'}`, item.id]
        );
      }
      
      await this.updatePendingSyncCount();
    } catch (error) {
      if (__DEV__) console.warn('[OfflineStorage] Failed to cleanup failed sync items:', error);
    }
  }

  async retryFailedSyncItems(): Promise<number> {
    if (!this.db) return 0;
    
    try {
      const result = await this.db.runAsync(
        `UPDATE sync_queue SET retry_count = 0, last_error = NULL, last_attempted_at = NULL 
         WHERE retry_count >= ? OR last_error LIKE 'PERMANENTLY_FAILED:%'`,
        [MAX_RETRY_ATTEMPTS]
      );
      
      const count = result.changes ?? 0;
      if (count > 0) {
        await this.updatePendingSyncCount();
        if (__DEV__) console.log(`[OfflineStorage] Reset ${count} failed sync items for retry`);
      }
      return count;
    } catch (error) {
      if (__DEV__) console.warn('[OfflineStorage] Failed to retry failed sync items:', error);
      return 0;
    }
  }

  private async updatePendingSyncCount(): Promise<void> {
    if (!this.db) return;
    
    const result = await this.db.getFirstAsync(
      `SELECT COUNT(*) as count FROM sync_queue WHERE retry_count < ? AND (last_error IS NULL OR last_error NOT LIKE 'PERMANENTLY_FAILED:%')`,
      [MAX_RETRY_ATTEMPTS]
    ) as any;
    
    useOfflineStore.getState().setPendingSyncCount(result?.count ?? 0);
  }

  async getFailedSyncCount(): Promise<number> {
    if (!this.db) return 0;
    const result = await this.db.getFirstAsync(
      `SELECT COUNT(*) as count FROM sync_queue WHERE retry_count >= ? OR last_error LIKE 'PERMANENTLY_FAILED:%'`,
      [MAX_RETRY_ATTEMPTS]
    ) as any;
    return result?.count ?? 0;
  }

  /**
   * Sync pending changes with the server
   */
  async syncPendingChanges(): Promise<{ success: boolean; synced: number; failed: number }> {
    if (!this.db) return { success: false, synced: 0, failed: 0 };
    if (this.syncInProgress) {
      if (__DEV__) console.log('[OfflineStorage] Sync already in progress');
      return { success: false, synced: 0, failed: 0 };
    }
    if (!useOfflineStore.getState().isOnline) {
      if (__DEV__) console.log('[OfflineStorage] Cannot sync - offline');
      return { success: false, synced: 0, failed: 0 };
    }
    
    this.syncInProgress = true;
    useOfflineStore.getState().setSyncing(true);
    useOfflineStore.getState().setSyncError(null);
    
    let synced = 0;
    let failed = 0;
    
    try {
      const items = await this.getPendingSyncItems();
      
      if (items.length === 0) {
        if (__DEV__) console.log('[OfflineStorage] No pending changes to sync');
        this.syncInProgress = false;
        useOfflineStore.getState().setSyncing(false);
        return { success: true, synced: 0, failed: 0 };
      }
      
      if (__DEV__) console.log(`[OfflineStorage] Syncing ${items.length} pending changes...`);
      
      for (const item of items) {
        try {
          const data = JSON.parse(item.data);
          
          // Attempt the actual sync (API call)
          const success = await this.syncItem(item.type, item.action, data);
          
          // Only record attempt time AFTER actual network attempt
          const attemptTime = Date.now();
          
          if (success) {
            // Remove from queue on success
            await this.db!.runAsync('DELETE FROM sync_queue WHERE id = ?', [item.id]);
            
            // Update the cached item to mark as synced
            // Skip for attachments since syncAttachment handles its own pending_sync updates
            // (via updateLocalIdWithServerId for ID changes or direct UPDATE for same ID)
            if (item.type !== 'attachment') {
              await this.markItemSynced(item.type, data.id);
            }
            synced++;
          } else {
            // Increment retry count and record attempt time (backoff applies on next attempt)
            await this.db!.runAsync(
              'UPDATE sync_queue SET retry_count = retry_count + 1, last_attempted_at = ? WHERE id = ?',
              [attemptTime, item.id]
            );
            failed++;
            
            // Log backoff info
            const nextDelay = this.getBackoffDelay(item.retryCount + 1);
            if (__DEV__) console.log(`[OfflineStorage] Sync failed, retry #${item.retryCount + 1} in ${nextDelay / 1000}s`);
          }
        } catch (error: any) {
          if (__DEV__) console.warn(`[OfflineStorage] Failed to sync item ${item.id}:`, error);
          
          // Update with error, increment retry count, and record attempt time
          await this.db!.runAsync(
            'UPDATE sync_queue SET retry_count = retry_count + 1, last_error = ?, last_attempted_at = ? WHERE id = ?',
            [error.message || 'Unknown error', Date.now(), item.id]
          );
          failed++;
          
          // Log backoff info
          const nextDelay = this.getBackoffDelay(item.retryCount + 1);
          if (__DEV__) console.log(`[OfflineStorage] Sync error, retry #${item.retryCount + 1} in ${nextDelay / 1000}s`);
        }
      }
      
      await this.updatePendingSyncCount();
      useOfflineStore.getState().setLastSyncTime(Date.now());

      // Periodically purge old synced offline rows (chat messages, form submissions,
      // geofence events) to keep the local SQLite file from growing forever.
      // Throttled so it only runs at most once per hour.
      try {
        const lastPurgeStr = await AsyncStorage.getItem('jobrunner_last_purge_at');
        const lastPurge = lastPurgeStr ? parseInt(lastPurgeStr, 10) : 0;
        if (Date.now() - lastPurge > 60 * 60 * 1000) {
          await this.purgeSyncedOfflineRows();
          await AsyncStorage.setItem('jobrunner_last_purge_at', String(Date.now()));
        }
      } catch (purgeErr) {
        if (__DEV__) console.warn('[OfflineStorage] Purge skipped:', purgeErr);
      }

      if (__DEV__) console.log(`[OfflineStorage] Sync complete: ${synced} synced, ${failed} failed`);
      return { success: failed === 0, synced, failed };
    } catch (error: any) {
      if (__DEV__) console.warn('[OfflineStorage] Sync failed:', error);
      useOfflineStore.getState().setSyncError(error.message || 'Sync failed');
      return { success: false, synced, failed };
    } finally {
      this.syncInProgress = false;
      useOfflineStore.getState().setSyncing(false);
    }
  }

  private async syncItem(
    type: string,
    action: string,
    data: any
  ): Promise<boolean> {
    // Handle attachments separately (they require file upload)
    if (type === 'attachment') {
      return this.syncAttachment(action, data);
    }
    
    // T005: Form submissions sync (with F3 SWMS-sign special-case routing)
    if (type === 'formSubmission' && action === 'create') {
      try {
        // F3: Offline SWMS signatures are stored as form_submissions with formId="swms:<id>"
        // Route them to the dedicated SWMS sign endpoint instead of /api/form-submissions.
        if (typeof data.formId === 'string' && data.formId.startsWith('swms:')) {
          const swmsId = data.formId.slice(5);
          const sub = data.submissionData || {};
          const signaturePayload = {
            workerName: sub.workerName,
            signatureData: data.signatures?.worker || sub.signatureData || 'mobile-text-signature',
            latitude: sub.latitude ?? null,
            longitude: sub.longitude ?? null,
            address: sub.address ?? null,
          };
          const response = await api.post(`/api/swms/${swmsId}/sign`, signaturePayload);
          if (response.error) {
            if (__DEV__) console.warn('[OfflineStorage] SWMS sign sync error:', response.error);
            return false;
          }
          // Mark local row as synced (no server id swap needed for signature row)
          if (data.localId && this.db) {
            await this.db.runAsync(
              `UPDATE form_submissions_local SET pending_sync = 0, status = 'synced' WHERE local_id = ?`,
              [data.localId]
            );
          }
          return true;
        }

        const payload: any = {
          formId: data.formId,
          jobId: data.jobId,
          submissionData: data.submissionData,
          signatures: data.signatures,
          status: data.status || 'submitted',
        };
        const response = await api.post('/api/form-submissions', payload);
        if (response.error) {
          if (__DEV__) console.warn('[OfflineStorage] formSubmission sync error:', response.error);
          return false;
        }
        const serverId = (response.data as any)?.id;
        if (serverId && data.localId) {
          await this.updateLocalIdWithServerId('formSubmission', data.localId, serverId);
        }
        return true;
      } catch (err) {
        if (__DEV__) console.warn('[OfflineStorage] formSubmission sync failed:', err);
        return false;
      }
    }

    // Job-card edits made offline against an already-synced submission
    if (type === 'formSubmission' && action === 'update') {
      try {
        const response = await api.patch(`/api/form-submissions/${data.id}`, {
          submissionData: data.submissionData,
        });
        if (response.error) {
          // Submission deleted on server, or edit not permitted (e.g. a team
          // member editing someone else's card) — retrying can never succeed.
          // Drop the local override so the server's version shows again.
          if (/not found/i.test(response.error) || /only edit your own/i.test(response.error)) {
            if (this.db) {
              await this.db.runAsync('DELETE FROM form_submissions_local WHERE id = ? OR local_id = ?', [data.id, data.id]);
            }
            return true;
          }
          if (__DEV__) console.warn('[OfflineStorage] formSubmission update sync error:', response.error);
          return false;
        }
        if (this.db) {
          await this.db.runAsync(
            `UPDATE form_submissions_local SET pending_sync = 0, sync_action = NULL WHERE id = ?`,
            [data.id]
          );
        }
        return true;
      } catch (err) {
        if (__DEV__) console.warn('[OfflineStorage] formSubmission update sync failed:', err);
        return false;
      }
    }

    if (type === 'formSubmission' && action === 'delete') {
      try {
        const response = await api.delete(`/api/form-submissions/${data.id}`);
        if (response.error && /only delete your own/i.test(response.error)) {
          // Not permitted (team member deleting someone else's card) — drop the
          // tombstone so the card reappears from the server on next load.
          if (this.db) {
            await this.db.runAsync('DELETE FROM form_submissions_local WHERE id = ? OR local_id = ?', [data.id, data.id]);
          }
          return true;
        }
        if (response.error && !/not found/i.test(response.error)) {
          if (__DEV__) console.warn('[OfflineStorage] formSubmission delete sync error:', response.error);
          return false;
        }
        // Clear the tombstone now that the server delete is confirmed (404 = already gone)
        if (this.db) {
          await this.db.runAsync('DELETE FROM form_submissions_local WHERE id = ? OR local_id = ?', [data.id, data.id]);
        }
        return true;
      } catch (err) {
        if (__DEV__) console.warn('[OfflineStorage] formSubmission delete sync failed:', err);
        return false;
      }
    }

    // T006: Chat message sync — endpoint depends on channel type
    if (type === 'chatMessage' && action === 'create') {
      try {
        let endpoint: string;
        let body: any;
        if (data.channelType === 'team') {
          endpoint = '/api/team-chat';
          body = { message: data.message, messageType: data.messageType || 'text' };
          if (data.attachmentUrl) body.attachmentUrl = data.attachmentUrl;
        } else if (data.channelType === 'job') {
          endpoint = `/api/jobs/${data.channelId}/chat`;
          body = { message: data.message, messageType: data.messageType || 'text' };
          if (data.attachmentUrl) body.attachmentUrl = data.attachmentUrl;
        } else if (data.channelType === 'dm') {
          endpoint = `/api/direct-messages/${data.channelId}`;
          body = { content: data.message };
          if (data.attachmentUrl) body.attachmentUrl = data.attachmentUrl;
        } else {
          if (__DEV__) console.warn('[OfflineStorage] Unknown chat channelType:', data.channelType);
          return false;
        }
        const response = await api.post(endpoint, body);
        if (response.error) {
          // C1: server reachable but rejected the message → mark as 'failed' so UI can offer retry.
          // Transport/timeout errors throw and are caught below — those stay 'pending' for auto-retry.
          if (__DEV__) console.warn('[OfflineStorage] chatMessage sync error:', response.error);
          if (data.localId && this.db) {
            try {
              await this.db.runAsync(
                `UPDATE chat_messages SET send_status = 'failed' WHERE local_id = ? OR id = ?`,
                [data.localId, data.localId]
              );
            } catch {}
          }
          return false;
        }
        const serverId = (response.data as any)?.id;
        if (serverId && data.localId) {
          await this.updateLocalIdWithServerId('chatMessage', data.localId, serverId);
        }
        if (data.localId && this.db) {
          try {
            await this.db.runAsync(
              `UPDATE chat_messages SET send_status = 'synced', pending_sync = 0 WHERE local_id = ?`,
              [data.localId]
            );
          } catch {}
        }
        return true;
      } catch (err) {
        // Transport error — leave send_status as 'pending' for automatic backoff retry
        if (__DEV__) console.warn('[OfflineStorage] chatMessage sync failed (transport):', err);
        return false;
      }
    }

    // G1: Geofence event sync (with idempotency to prevent duplicate SMS / clock-ins)
    if (type === 'geofenceEvent' && action === 'create') {
      try {
        const response = await api.post('/api/geofence-events', {
          identifier: data.identifier,
          action: data.action,
          timestamp: data.timestamp,
          latitude: data.latitude,
          longitude: data.longitude,
          accuracy: data.accuracy,
          idempotencyKey: data.idempotencyKey,
        });
        if (response.error) {
          if (__DEV__) console.warn('[OfflineStorage] geofenceEvent sync error:', response.error);
          return false;
        }
        if (data.localId && this.db) {
          try {
            await this.db.runAsync(
              `UPDATE geofence_events_local SET pending_sync = 0, synced_at = ? WHERE id = ?`,
              [Date.now(), data.localId]
            );
          } catch {}
        }
        return true;
      } catch (err) {
        if (__DEV__) console.warn('[OfflineStorage] geofenceEvent sync failed:', err);
        return false;
      }
    }

    // Handle special actions
    if (action === 'on_my_way') {
      try {
        const response = await api.post(`/api/jobs/${data.id}/on-my-way`, {
          idempotencyKey: data.idempotencyKey,
        });
        if (response.error) {
          if (__DEV__) console.warn(`[OfflineStorage] API error for on_my_way:`, response.error);
          return false;
        }
        if (__DEV__) console.log(`[OfflineStorage] Successfully synced on_my_way notification`);
        return true;
      } catch (error) {
        if (__DEV__) console.warn(`[OfflineStorage] Failed to sync on_my_way:`, error);
        return false;
      }
    }
    
    const endpoints: Record<string, string> = {
      job: '/api/jobs',
      client: '/api/clients',
      quote: '/api/quotes',
      invoice: '/api/invoices',
      timeEntry: '/api/time-entries',
    };
    
    const endpoint = endpoints[type];
    if (!endpoint) {
      if (__DEV__) console.warn(`[OfflineStorage] Unknown type: ${type}`);
      return false;
    }
    
    try {
      let response;
      
      switch (action) {
        case 'create':
          // Remove local id and metadata before sending
          const createData = { ...data };
          delete createData.id;
          delete createData.localId;
          delete createData.cachedAt;
          delete createData.pendingSync;
          delete createData.syncAction;
          
          response = await api.post(endpoint, createData);
          
          if (response.data && data.localId) {
            // Update local record with server ID
            await this.updateLocalIdWithServerId(type, data.localId, (response.data as any).id);
          }
          break;
          
        case 'update':
          // Only send the changed fields - clean up any metadata
          const updateData = { ...data };
          delete updateData.localId;
          delete updateData.cachedAt;
          delete updateData.pendingSync;
          delete updateData.syncAction;
          delete updateData.id;
          delete updateData._previousValues;
          delete updateData._statusChange;
          
          response = await api.patch(`${endpoint}/${data.id}`, updateData);
          break;
          
        case 'delete':
          response = await api.delete(`${endpoint}/${data.id}`);
          break;
          
        default:
          if (__DEV__) console.warn(`[OfflineStorage] Unknown action: ${action}`);
          return false;
      }
      
      if (response.error) {
        // Permanent permission rejections won't succeed on retry (e.g. a
        // secondary worker queued a job "Complete" that only the lead/owner may
        // do). Drop these from the queue instead of retrying + spamming errors;
        // the next job fetch reconciles local state with the server.
        const code = (response.data as any)?.code;
        // A 404 "Job not found" is permanent for this client: the job either no
        // longer exists or isn't reachable under this user's business scope
        // (e.g. a subcontractor queued a generic update for another business's
        // job). Retrying just re-404s forever and the "tap to sync" badge never
        // clears. Drop it; the next job fetch reconciles local state.
        const isMissingRecord =
          (type === 'job' && (action === 'update' || action === 'delete')) &&
          /job not found/i.test(response.error);
        const isPermanentReject =
          (type === 'job' && action === 'update' &&
            (code === 'NOT_LEAD_WORKER' ||
              // WHS start gates + permission rejections won't succeed on
              // retry either (e.g. Take 5 required, expired compliance, or a
              // queued update synced under an account without write access).
              code === 'TAKE5_REQUIRED' ||
              code === 'COMPLIANCE_EXPIRED' ||
              /lead worker or owner|use clock off|access denied/i.test(response.error))) ||
          isMissingRecord;
        if (isPermanentReject) {
          if (__DEV__) console.warn(`[OfflineStorage] Dropping non-retryable ${type} ${action}: ${response.error}`);
          return true;
        }
        if (__DEV__) console.warn(`[OfflineStorage] API error for ${type} ${action}:`, response.error);
        return false;
      }
      
      if (__DEV__) console.log(`[OfflineStorage] Successfully synced ${type} ${action}`);
      return true;
    } catch (error) {
      if (__DEV__) console.warn(`[OfflineStorage] Failed to sync ${type} ${action}:`, error);
      return false;
    }
  }

  /**
   * Sync an attachment - handles file upload via multipart form data
   * Returns true on success - processSyncQueue handles queue cleanup for all cases
   */
  private async syncAttachment(action: string, data: any): Promise<boolean> {
    try {
      if (action === 'delete') {
        // Delete attachment from server
        const response = await api.delete(`/api/attachments/${data.id}`);
        if (response.error) {
          if (__DEV__) console.warn('[OfflineStorage] Failed to delete attachment:', response.error);
          return false;
        }
        // Remove from local cache - processSyncQueue will handle sync_queue cleanup
        await this.db?.runAsync('DELETE FROM attachments WHERE id = ?', [data.id]);
        return true;
      }
      
      if (action === 'create') {
        // For photo uploads, we need to use FormData
        // The localUri is the file path on device
        const formData = new FormData();
        
        // Build the file object for upload
        const file = {
          uri: data.localUri,
          type: data.mimeType || 'application/octet-stream',
          name: data.filename || 'attachment',
        };
        
        formData.append('file', file as any);
        
        if (data.jobId) formData.append('jobId', data.jobId);
        if (data.quoteId) formData.append('quoteId', data.quoteId);
        if (data.invoiceId) formData.append('invoiceId', data.invoiceId);
        if (data.clientId) formData.append('clientId', data.clientId);
        if (data.type) formData.append('type', data.type);
        if (data.description) formData.append('description', data.description);
        
        // Determine upload endpoint based on attachment type
        let endpoint = '/api/attachments';
        if (data.jobId) {
          endpoint = `/api/jobs/${data.jobId}/photos`;
        }
        
        const response = await api.uploadFile(endpoint, formData);
        
        if (response.error || !response.data) {
          if (__DEV__) console.warn('[OfflineStorage] Failed to upload attachment:', response.error);
          return false;
        }
        
        // Update local record with server data and proper ID reconciliation
        const serverData = response.data as any;
        const serverId = serverData.id || data.id;
        const remoteUrl = serverData.url || serverData.signedUrl;
        
        if (serverId !== data.id && data.localId) {
          // Server returned a different ID - update the local record
          // updateLocalIdWithServerId sets id, clears local_id, and sets pending_sync=0
          const idUpdated = await this.updateLocalIdWithServerId('attachment', data.localId, serverId);
          if (!idUpdated) {
            if (__DEV__) console.warn('[OfflineStorage] Failed to reconcile attachment ID');
            return false;
          }
          
          // Also update the remote URL on the new record
          const urlResult = await this.db?.runAsync(
            'UPDATE attachments SET remote_url = ? WHERE id = ?',
            [remoteUrl, serverId]
          );
          
          // Verify the URL update succeeded
          if ((urlResult as any)?.changes === 0) {
            if (__DEV__) console.warn('[OfflineStorage] Failed to update remote_url after ID reconciliation');
            return false;
          }
        } else {
          // Same ID or no local ID - just update the record
          const result = await this.db?.runAsync(
            `UPDATE attachments SET 
              remote_url = ?,
              pending_sync = 0,
              sync_action = NULL
             WHERE id = ?`,
            [remoteUrl, data.id]
          );
          
          // Verify the update succeeded
          if ((result as any)?.changes === 0) {
            if (__DEV__) console.warn('[OfflineStorage] Failed to update attachment record');
            return false;
          }
        }
        
        // processSyncQueue will handle sync_queue cleanup
        if (__DEV__) console.log('[OfflineStorage] Successfully uploaded attachment:', data.filename);
        return true;
      }
      
      if (__DEV__) console.warn('[OfflineStorage] Unknown attachment action:', action);
      return false;
    } catch (error) {
      if (__DEV__) console.warn('[OfflineStorage] Failed to sync attachment:', error);
      return false;
    }
  }

  private async markItemSynced(type: string, id: string): Promise<void> {
    if (!this.db) return;
    
    const tableMap: Record<string, string> = {
      job: 'jobs',
      client: 'clients',
      quote: 'quotes',
      invoice: 'invoices',
      timeEntry: 'time_entries',
      attachment: 'attachments',
    };
    
    const table = tableMap[type];
    if (table) {
      await this.db.runAsync(
        `UPDATE ${table} SET pending_sync = 0, sync_action = NULL WHERE id = ?`,
        [id]
      );
    }
  }

  private async updateLocalIdWithServerId(type: string, localId: string, serverId: string): Promise<boolean> {
    if (!this.db) return false;
    
    const tableMap: Record<string, string> = {
      job: 'jobs',
      client: 'clients',
      quote: 'quotes',
      invoice: 'invoices',
      timeEntry: 'time_entries',
      attachment: 'attachments',
      formSubmission: 'form_submissions_local',
      chatMessage: 'chat_messages',
    };
    
    const table = tableMap[type];
    if (!table) return false;
    
    // Find row by local_id (more reliable than id since id might already be the server id)
    const result = await this.db.runAsync(
      `UPDATE ${table} SET id = ?, local_id = NULL, pending_sync = 0, sync_action = NULL WHERE local_id = ?`,
      [serverId, localId]
    );

    let updated = (result as any).changes > 0;

    if (!updated) {
      // Fall back to id if local_id match fails (for backwards compatibility)
      const fallbackResult = await this.db.runAsync(
        `UPDATE ${table} SET id = ?, local_id = NULL, pending_sync = 0, sync_action = NULL WHERE id = ?`,
        [serverId, localId]
      );
      updated = (fallbackResult as any).changes > 0;
      if (updated && __DEV__) console.log(`[OfflineStorage] Updated ${type} ID from ${localId} to ${serverId} (fallback)`);
    } else if (__DEV__) {
      console.log(`[OfflineStorage] Updated ${type} ID from ${localId} to ${serverId}`);
    }

    if (!updated) {
      if (__DEV__) console.warn(`[OfflineStorage] Failed to update ${type} ID: row not found for localId=${localId}`);
      return false;
    }

    // CASCADE: rewrite foreign-key references in dependent tables AND in any pending sync_queue payloads.
    // Without this, a time_entry created offline that references local_<jobId> would fail to sync after the
    // job's id was rewritten to the server id.
    try {
      const fkUpdates: Array<{ table: string; column: string }> = [];
      if (type === 'job') {
        fkUpdates.push({ table: 'time_entries', column: 'job_id' });
        fkUpdates.push({ table: 'attachments', column: 'job_id' });
        fkUpdates.push({ table: 'invoices', column: 'job_id' });
        fkUpdates.push({ table: 'quotes', column: 'job_id' });
      } else if (type === 'client') {
        fkUpdates.push({ table: 'jobs', column: 'client_id' });
        fkUpdates.push({ table: 'invoices', column: 'client_id' });
        fkUpdates.push({ table: 'quotes', column: 'client_id' });
      } else if (type === 'quote') {
        fkUpdates.push({ table: 'invoices', column: 'quote_id' });
      }

      for (const fk of fkUpdates) {
        try {
          await this.db.runAsync(
            `UPDATE ${fk.table} SET ${fk.column} = ? WHERE ${fk.column} = ?`,
            [serverId, localId]
          );
        } catch (e) {
          // Column may not exist in some schema versions — ignore.
          if (__DEV__) console.warn(`[OfflineStorage] FK cascade skipped for ${fk.table}.${fk.column}:`, (e as any)?.message);
        }
      }

      // Rewrite still-pending sync_queue payloads that embed the localId (e.g. POST /time-entries with jobId).
      // Use a JSON LIKE replace via SQLite's REPLACE() — payloads are JSON strings.
      try {
        await this.db.runAsync(
          `UPDATE sync_queue SET payload = REPLACE(payload, ?, ?) WHERE payload LIKE ?`,
          [`"${localId}"`, `"${serverId}"`, `%"${localId}"%`]
        );
      } catch (e) {
        if (__DEV__) console.warn(`[OfflineStorage] sync_queue payload rewrite failed:`, (e as any)?.message);
      }
    } catch (cascadeErr) {
      if (__DEV__) console.warn('[OfflineStorage] FK cascade error:', cascadeErr);
      // Don't fail the overall id swap if cascade has issues.
    }

    return true;
  }

  // ============ METADATA & UTILITIES ============

  async setMetadata(key: string, value: string): Promise<void> {
    if (!this.db) return;
    
    await this.db.runAsync(
      'INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)',
      [key, value]
    );
  }

  async getMetadata(key: string): Promise<string | null> {
    if (!this.db) return null;
    
    const result = await this.db.getFirstAsync(
      'SELECT value FROM metadata WHERE key = ?',
      [key]
    ) as any;
    
    return result?.value ?? null;
  }

  async getLastSyncTime(type?: string): Promise<number | null> {
    const key = type ? `last_${type}_sync` : 'last_jobs_sync';
    const value = await this.getMetadata(key);
    return value ? parseInt(value, 10) : null;
  }

  async clearCache(): Promise<void> {
    if (!this.db) return;
    
    await this.db.execAsync(`
      DELETE FROM jobs;
      DELETE FROM clients;
      DELETE FROM quotes;
      DELETE FROM invoices;
      DELETE FROM time_entries;
      DELETE FROM attachments;
      DELETE FROM sync_queue;
      DELETE FROM metadata;
    `);

    // Account-scoped side tables — cleared separately so a missing table in an
    // older on-device schema can't abort the whole logout wipe above.
    for (const table of ['subscription_cache', 'chat_messages', 'form_submissions_local', 'geofence_events_local']) {
      try {
        await this.db.execAsync(`DELETE FROM ${table};`);
      } catch (e) {
        if (__DEV__) console.warn(`[OfflineStorage] clearCache skipped ${table}:`, (e as any)?.message);
      }
    }

    await this.updatePendingSyncCount();
    useOfflineStore.getState().setLastSyncTime(null);
    
    if (__DEV__) console.log('[OfflineStorage] Cache cleared');
  }

  // ============ DELTA SYNC ============

  /**
   * Get the last sync timestamp for an entity type
   */
  async getDeltaSyncTimestamp(entityType: string): Promise<number | null> {
    if (!this.db) return null;
    
    const result = await this.db.getFirstAsync(
      'SELECT last_synced_at FROM delta_sync WHERE entity_type = ?',
      [entityType]
    ) as any;
    
    return result?.last_synced_at ?? null;
  }

  /**
   * Set the last sync timestamp for an entity type
   */
  async setDeltaSyncTimestamp(entityType: string, timestamp: number, serverTimestamp?: string): Promise<void> {
    if (!this.db) return;
    
    await this.db.runAsync(
      `INSERT OR REPLACE INTO delta_sync (entity_type, last_synced_at, last_server_timestamp)
       VALUES (?, ?, ?)`,
      [entityType, timestamp, serverTimestamp || null]
    );
  }

  /**
   * Delta sync jobs - fetch only jobs updated since last sync
   */
  async deltaSyncJobs(): Promise<void> {
    if (!this.db || !useOfflineStore.getState().isOnline) return;
    
    try {
      const lastSync = await this.getDeltaSyncTimestamp('jobs');
      const params = lastSync ? `?since=${new Date(lastSync).toISOString()}` : '';
      
      const response = await api.get<any[]>(`/api/jobs${params}`);
      
      if (response.data && response.data.length > 0) {
        // Check for conflicts before caching
        for (const job of response.data) {
          await this.detectAndSaveConflict('job', job.id, job);
        }
        await this.cacheJobs(response.data);
      }
      
      await this.setDeltaSyncTimestamp('jobs', Date.now());
      if (__DEV__) console.log(`[OfflineStorage] Delta synced ${response.data?.length || 0} jobs`);
    } catch (error) {
      if (__DEV__) console.warn('[OfflineStorage] Delta sync jobs failed:', error);
    }
  }

  /**
   * Delta sync clients - fetch only clients updated since last sync
   */
  async deltaSyncClients(): Promise<void> {
    if (!this.db || !useOfflineStore.getState().isOnline) return;
    
    try {
      const lastSync = await this.getDeltaSyncTimestamp('clients');
      const params = lastSync ? `?since=${new Date(lastSync).toISOString()}` : '';
      
      const response = await api.get<any[]>(`/api/clients${params}`);
      
      if (response.data && response.data.length > 0) {
        for (const client of response.data) {
          await this.detectAndSaveConflict('client', client.id, client);
        }
        await this.cacheClients(response.data);
      }
      
      await this.setDeltaSyncTimestamp('clients', Date.now());
      if (__DEV__) console.log(`[OfflineStorage] Delta synced ${response.data?.length || 0} clients`);
    } catch (error) {
      if (__DEV__) console.warn('[OfflineStorage] Delta sync clients failed:', error);
    }
  }

  /**
   * Delta sync quotes - fetch only quotes updated since last sync
   */
  async deltaSyncQuotes(): Promise<void> {
    if (!this.db || !useOfflineStore.getState().isOnline) return;
    
    try {
      const lastSync = await this.getDeltaSyncTimestamp('quotes');
      const params = lastSync ? `?since=${new Date(lastSync).toISOString()}` : '';
      
      const response = await api.get<any[]>(`/api/quotes${params}`);
      
      if (response.data && response.data.length > 0) {
        for (const quote of response.data) {
          await this.detectAndSaveConflict('quote', quote.id, quote);
        }
        await this.cacheQuotes(response.data);
      }
      
      await this.setDeltaSyncTimestamp('quotes', Date.now());
      if (__DEV__) console.log(`[OfflineStorage] Delta synced ${response.data?.length || 0} quotes`);
    } catch (error) {
      if (__DEV__) console.warn('[OfflineStorage] Delta sync quotes failed:', error);
    }
  }

  /**
   * Delta sync invoices - fetch only invoices updated since last sync
   */
  async deltaSyncInvoices(): Promise<void> {
    if (!this.db || !useOfflineStore.getState().isOnline) return;
    
    try {
      const lastSync = await this.getDeltaSyncTimestamp('invoices');
      const params = lastSync ? `?since=${new Date(lastSync).toISOString()}` : '';
      
      const response = await api.get<any[]>(`/api/invoices${params}`);
      
      if (response.data && response.data.length > 0) {
        for (const invoice of response.data) {
          await this.detectAndSaveConflict('invoice', invoice.id, invoice);
        }
        await this.cacheInvoices(response.data);
      }
      
      await this.setDeltaSyncTimestamp('invoices', Date.now());
      if (__DEV__) console.log(`[OfflineStorage] Delta synced ${response.data?.length || 0} invoices`);
    } catch (error) {
      if (__DEV__) console.warn('[OfflineStorage] Delta sync invoices failed:', error);
    }
  }

  // ============ CONFLICT RESOLUTION ============

  /**
   * Detect if there's a pending local change that conflicts with server data
   */
  private async detectAndSaveConflict(
    entityType: 'job' | 'client' | 'quote' | 'invoice' | 'timeEntry',
    entityId: string,
    serverData: any
  ): Promise<boolean> {
    if (!this.db) return false;
    
    const tableMap = {
      job: 'jobs',
      client: 'clients', 
      quote: 'quotes',
      invoice: 'invoices',
      timeEntry: 'time_entries'
    };
    
    const table = tableMap[entityType];
    
    // Check if we have pending sync for this entity
    const localRow = await this.db.getFirstAsync(
      `SELECT * FROM ${table} WHERE id = ? AND pending_sync = 1`,
      [entityId]
    ) as any;
    
    if (!localRow) return false;
    
    // If this is a pending create with a local_id, the server returned the same record
    // This means our create was successful - update local ID mapping instead of conflict
    if (localRow.sync_action === 'create' && localRow.local_id) {
      if (__DEV__) console.log(`[OfflineStorage] Pending create matched server record, updating ID mapping`);
      await this.updateLocalIdWithServerId(entityType, localRow.local_id, entityId);
      return false; // Not a conflict
    }
    
    // For updates/deletes, we have a local pending change - save as conflict
    await this.saveConflict(entityType, entityId, localRow, serverData);
    return true;
  }

  /**
   * Save a conflict for later review
   */
  async saveConflict(
    entityType: 'job' | 'client' | 'quote' | 'invoice' | 'timeEntry',
    entityId: string,
    localData: any,
    serverData: any
  ): Promise<void> {
    if (!this.db) return;
    
    const conflictId = `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await this.db.runAsync(
      `INSERT INTO conflicts (id, entity_type, entity_id, local_data, server_data, conflicted_at, resolved)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [conflictId, entityType, entityId, JSON.stringify(localData), JSON.stringify(serverData), Date.now()]
    );
    
    await this.updateUnresolvedConflictCount();
    if (__DEV__) console.log(`[OfflineStorage] Saved conflict for ${entityType} ${entityId}`);
  }

  /**
   * Get list of conflicts
   */
  async getConflicts(resolved?: boolean): Promise<ConflictRecord[]> {
    if (!this.db) return [];
    
    let query = 'SELECT * FROM conflicts';
    const params: any[] = [];
    
    if (resolved !== undefined) {
      query += ' WHERE resolved = ?';
      params.push(resolved ? 1 : 0);
    }
    
    query += ' ORDER BY conflicted_at DESC';
    
    const rows = await this.db.getAllAsync(query, params);
    
    return rows.map((row: any) => ({
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      localData: row.local_data,
      serverData: row.server_data,
      conflictedAt: row.conflicted_at,
      resolved: row.resolved === 1,
      resolution: row.resolution,
      resolvedAt: row.resolved_at,
    }));
  }

  /**
   * Resolve a conflict
   */
  async resolveConflict(
    conflictId: string,
    resolution: 'kept_server' | 'kept_local' | 'merged',
    mergedData?: any
  ): Promise<void> {
    if (!this.db) return;
    
    const conflict = await this.db.getFirstAsync(
      'SELECT * FROM conflicts WHERE id = ?',
      [conflictId]
    ) as any;
    
    if (!conflict) return;
    
    const entityType = conflict.entity_type;
    const entityId = conflict.entity_id;
    
    // Apply the resolution
    if (resolution === 'kept_server') {
      // Server data already applied, just clear pending sync
      const tableMap: Record<string, string> = {
        job: 'jobs', client: 'clients', quote: 'quotes', 
        invoice: 'invoices', timeEntry: 'time_entries'
      };
      await this.db.runAsync(
        `UPDATE ${tableMap[entityType]} SET pending_sync = 0, sync_action = NULL WHERE id = ?`,
        [entityId]
      );
      // Remove from sync queue
      await this.db.runAsync(
        'DELETE FROM sync_queue WHERE id LIKE ? AND type = ?',
        [`%${entityId}%`, entityType]
      );
    } else if (resolution === 'kept_local') {
      // Keep local and retry sync
      if (__DEV__) console.log(`[OfflineStorage] Keeping local version for ${entityType} ${entityId}`);
    } else if (resolution === 'merged' && mergedData) {
      const tableMap: Record<string, string> = {
        job: 'jobs', client: 'clients', quote: 'quotes',
        invoice: 'invoices', timeEntry: 'time_entries'
      };
      const table = tableMap[entityType];

      if (entityType === 'job') {
        await this.db.runAsync(
          `UPDATE ${table} SET title = ?, description = ?, address = ?, status = ?, scheduled_at = ?, client_id = ?, client_name = ?, assigned_to = ?, notes = ?, cached_at = ?, pending_sync = 1, sync_action = 'update' WHERE id = ?`,
          [mergedData.title, mergedData.description, mergedData.address, mergedData.status,
           mergedData.scheduledAt, mergedData.clientId, mergedData.clientName, mergedData.assignedTo,
           mergedData.notes, Date.now(), entityId]
        );
      } else if (entityType === 'client') {
        await this.db.runAsync(
          `UPDATE ${table} SET name = ?, email = ?, phone = ?, address = ?, notes = ?, cached_at = ?, pending_sync = 1, sync_action = 'update' WHERE id = ?`,
          [mergedData.name, mergedData.email, mergedData.phone, mergedData.address,
           mergedData.notes, Date.now(), entityId]
        );
      } else if (entityType === 'quote') {
        await this.db.runAsync(
          `UPDATE ${table} SET quote_number = ?, client_id = ?, client_name = ?, job_id = ?, status = ?, subtotal = ?, gst_amount = ?, total = ?, valid_until = ?, notes = ?, cached_at = ?, pending_sync = 1, sync_action = 'update' WHERE id = ?`,
          [mergedData.quoteNumber, mergedData.clientId, mergedData.clientName, mergedData.jobId,
           mergedData.status, mergedData.subtotal, mergedData.gstAmount, mergedData.total,
           mergedData.validUntil, mergedData.notes, Date.now(), entityId]
        );
      } else if (entityType === 'invoice') {
        await this.db.runAsync(
          `UPDATE ${table} SET invoice_number = ?, client_id = ?, client_name = ?, job_id = ?, quote_id = ?, status = ?, subtotal = ?, gst_amount = ?, total = ?, amount_paid = ?, due_date = ?, paid_at = ?, notes = ?, cached_at = ?, pending_sync = 1, sync_action = 'update' WHERE id = ?`,
          [mergedData.invoiceNumber, mergedData.clientId, mergedData.clientName, mergedData.jobId,
           mergedData.quoteId, mergedData.status, mergedData.subtotal, mergedData.gstAmount,
           mergedData.total, mergedData.amountPaid, mergedData.dueDate, mergedData.paidAt,
           mergedData.notes, Date.now(), entityId]
        );
      } else if (entityType === 'timeEntry') {
        await this.db.runAsync(
          `UPDATE ${table} SET user_id = ?, job_id = ?, description = ?, start_time = ?, end_time = ?, notes = ?, cached_at = ?, pending_sync = 1, sync_action = 'update' WHERE id = ?`,
          [mergedData.userId, mergedData.jobId, mergedData.description, mergedData.startTime,
           mergedData.endTime, mergedData.notes, Date.now(), entityId]
        );
      }

      const mergedPayload = { ...mergedData, id: entityId };
      await this.db.runAsync(
        `UPDATE sync_queue SET data = ?, retry_count = 0, last_error = NULL WHERE type = ? AND data LIKE ?`,
        [JSON.stringify(mergedPayload), entityType, `%"id":"${entityId}"%`]
      );

      const existingQueueItem = await this.db.getFirstAsync(
        `SELECT id FROM sync_queue WHERE type = ? AND data LIKE ?`,
        [entityType, `%"id":"${entityId}"%`]
      ) as any;

      if (!existingQueueItem) {
        const queueId = `merged_${entityType}_${entityId}_${Date.now()}`;
        await this.db.runAsync(
          `INSERT INTO sync_queue (id, type, action, data, created_at, retry_count) VALUES (?, ?, 'update', ?, ?, 0)`,
          [queueId, entityType, JSON.stringify({ ...mergedData, id: entityId }), Date.now()]
        );
      }

      if (__DEV__) console.log(`[OfflineStorage] Applied merged data for ${entityType} ${entityId}`);
    }
    
    // Mark conflict as resolved
    await this.db.runAsync(
      'UPDATE conflicts SET resolved = 1, resolution = ?, resolved_at = ? WHERE id = ?',
      [resolution, Date.now(), conflictId]
    );
    
    await this.updateUnresolvedConflictCount();
    await this.updatePendingSyncCount();
  }

  /**
   * Update the unresolved conflict count in the store
   */
  async updateUnresolvedConflictCount(): Promise<void> {
    if (!this.db) return;
    
    const result = await this.db.getFirstAsync(
      'SELECT COUNT(*) as count FROM conflicts WHERE resolved = 0'
    ) as any;
    
    useOfflineStore.getState().setUnresolvedConflictCount(result?.count || 0);
  }

  // ============ BACKGROUND SYNC ============

  /**
   * Register background sync task
   */
  async registerBackgroundSync(): Promise<boolean> {
    try {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
        minimumInterval: 15 * 60, // 15 minutes
        stopOnTerminate: false,
        startOnBoot: true,
      });
      
      useOfflineStore.getState().setBackgroundSyncEnabled(true);
      useOfflineStore.getState().setBackgroundSyncRegistered(true);
      useOfflineStore.getState().setBackgroundSyncError(null);
      if (__DEV__) console.log('[OfflineStorage] Background sync registered');
      return true;
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      useOfflineStore.getState().setBackgroundSyncRegistered(false);
      
      if (errorMessage.includes('Background Fetch has not been configured')) {
        useOfflineStore.getState().setBackgroundSyncError('Background sync not available (requires standalone build)');
        if (__DEV__) console.log('[OfflineStorage] Background sync not available (requires standalone build)');
      } else {
        useOfflineStore.getState().setBackgroundSyncError(`Background sync registration failed: ${errorMessage}`);
        if (__DEV__) console.log('[OfflineStorage] Background sync registration skipped:', errorMessage);
      }
      return false;
    }
  }

  /**
   * Unregister background sync task
   */
  async unregisterBackgroundSync(): Promise<void> {
    try {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
      useOfflineStore.getState().setBackgroundSyncEnabled(false);
      if (__DEV__) console.log('[OfflineStorage] Background sync unregistered');
    } catch (error) {
      if (__DEV__) console.warn('[OfflineStorage] Failed to unregister background sync:', error);
    }
  }

  /**
   * Execute background sync (called by task manager)
   * Returns true if sync completed successfully, false if skipped/failed
   */
  async executeBackgroundSync(): Promise<boolean> {
    if (__DEV__) console.log('[OfflineStorage] Executing background sync...');
    
    if (!useOfflineStore.getState().isOnline) {
      if (__DEV__) console.log('[OfflineStorage] Background sync skipped - offline');
      return false; // NoData - offline
    }
    
    try {
      // Sync pending changes first
      await this.syncPendingChanges();
      
      // Then do delta sync
      await Promise.all([
        this.deltaSyncJobs(),
        this.deltaSyncClients(),
        this.deltaSyncQuotes(),
        this.deltaSyncInvoices(),
      ]);
      
      useOfflineStore.getState().setLastSyncTime(Date.now());
      if (__DEV__) console.log('[OfflineStorage] Background sync complete');
      return true; // NewData
    } catch (error) {
      if (__DEV__) console.warn('[OfflineStorage] Background sync failed:', error);
      throw error; // Rethrow so task handler can catch it
    }
  }

  // ============ ATTACHMENT FILE CACHING ============

  private readonly ATTACHMENTS_DIR = `${FileSystem.documentDirectory}attachments/`;

  /**
   * Ensure the attachments directory exists
   */
  private async ensureAttachmentsDir(): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(this.ATTACHMENTS_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(this.ATTACHMENTS_DIR, { intermediates: true });
    }
  }

  /**
   * Download a remote attachment file to local filesystem
   */
  async downloadAttachmentFile(attachment: CachedAttachment): Promise<string | null> {
    if (!attachment.remoteUrl) return null;
    
    try {
      await this.ensureAttachmentsDir();
      
      // Sanitize filename to avoid path issues
      const safeFilename = attachment.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const localPath = `${this.ATTACHMENTS_DIR}${attachment.id}_${safeFilename}`;
      
      // Check if already downloaded and valid
      const existingFile = await FileSystem.getInfoAsync(localPath);
      if (existingFile.exists && 'size' in existingFile && existingFile.size > 0) {
        return localPath;
      }
      
      // Download the file
      const downloadResult = await FileSystem.downloadAsync(
        attachment.remoteUrl,
        localPath
      );
      
      if (downloadResult.status === 200) {
        // Verify file was actually written
        const newFileInfo = await FileSystem.getInfoAsync(localPath);
        if (!newFileInfo.exists) {
          if (__DEV__) console.warn('[OfflineStorage] Download reported success but file not found');
          return null;
        }
        
        // Update the local cache with local_uri - with compensating cleanup on failure
        if (this.db) {
          try {
            await this.db.runAsync(
              'UPDATE attachments SET local_uri = ? WHERE id = ?',
              [localPath, attachment.id]
            );
          } catch (dbError) {
            // DB update failed - remove downloaded file to stay consistent
            if (__DEV__) console.warn('[OfflineStorage] DB update failed, cleaning up file:', dbError);
            await FileSystem.deleteAsync(localPath, { idempotent: true });
            return null;
          }
        }
        
        if (__DEV__) console.log(`[OfflineStorage] Downloaded attachment: ${attachment.filename}`);
        return localPath;
      }
      
      if (__DEV__) console.warn(`[OfflineStorage] Download failed with status: ${downloadResult.status}`);
      return null;
    } catch (error) {
      if (__DEV__) console.warn('[OfflineStorage] Failed to download attachment:', error);
      return null;
    }
  }

  /**
   * Get local URI for an attachment if cached
   */
  async getLocalAttachmentUri(attachmentId: string): Promise<string | null> {
    if (!this.db) return null;
    
    const result = await this.db.getFirstAsync(
      'SELECT local_uri FROM attachments WHERE id = ?',
      [attachmentId]
    ) as any;
    
    if (!result?.local_uri) return null;
    
    // Verify file still exists
    const fileInfo = await FileSystem.getInfoAsync(result.local_uri);
    if (!fileInfo.exists) {
      // Clear the stale local_uri
      await this.db.runAsync(
        'UPDATE attachments SET local_uri = NULL WHERE id = ?',
        [attachmentId]
      );
      return null;
    }
    
    return result.local_uri;
  }

  /**
   * Cache all remote attachments for a job
   */
  async cacheRemoteAttachments(jobId: string): Promise<void> {
    if (!this.db) return;
    
    const attachments = await this.db.getAllAsync(
      'SELECT * FROM attachments WHERE job_id = ? AND remote_url IS NOT NULL AND local_uri IS NULL',
      [jobId]
    ) as any[];
    
    if (__DEV__) console.log(`[OfflineStorage] Caching ${attachments.length} attachments for job ${jobId}`);
    
    for (const row of attachments) {
      const attachment: CachedAttachment = {
        id: row.id,
        jobId: row.job_id,
        quoteId: row.quote_id,
        invoiceId: row.invoice_id,
        clientId: row.client_id,
        type: row.type,
        filename: row.filename,
        mimeType: row.mime_type,
        localUri: row.local_uri,
        remoteUrl: row.remote_url,
        fileSize: row.file_size,
        description: row.description,
        cachedAt: row.cached_at,
        pendingSync: row.pending_sync === 1,
        syncAction: row.sync_action,
        localId: row.local_id,
      };
      
      await this.downloadAttachmentFile(attachment);
    }
  }

  /**
   * Clear cached attachment files to free up space
   */
  async clearAttachmentCache(): Promise<void> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.ATTACHMENTS_DIR);
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(this.ATTACHMENTS_DIR, { idempotent: true });
        if (__DEV__) console.log('[OfflineStorage] Cleared attachment cache');
      }
      
      // Clear local_uri from database
      if (this.db) {
        await this.db.runAsync('UPDATE attachments SET local_uri = NULL WHERE remote_url IS NOT NULL');
      }
    } catch (error) {
      if (__DEV__) console.warn('[OfflineStorage] Failed to clear attachment cache:', error);
    }
  }

  /**
   * Get total size of cached attachments
   */
  async getAttachmentCacheSize(): Promise<number> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.ATTACHMENTS_DIR);
      if (!dirInfo.exists) return 0;
      
      const files = await FileSystem.readDirectoryAsync(this.ATTACHMENTS_DIR);
      let totalSize = 0;
      
      for (const file of files) {
        const fileInfo = await FileSystem.getInfoAsync(`${this.ATTACHMENTS_DIR}${file}`);
        if (fileInfo.exists && 'size' in fileInfo) {
          totalSize += fileInfo.size || 0;
        }
      }
      
      return totalSize;
    } catch (error) {
      if (__DEV__) console.warn('[OfflineStorage] Failed to get cache size:', error);
      return 0;
    }
  }

  /**
   * Full sync - download all data from server and cache locally
   */
  async fullSync(): Promise<void> {
    if (!useOfflineStore.getState().isOnline) {
      if (__DEV__) console.log('[OfflineStorage] Cannot full sync - offline');
      return;
    }
    
    useOfflineStore.getState().setSyncing(true);
    
    try {
      // First sync any pending changes
      await this.syncPendingChanges();
      
      // Then download fresh data
      const [jobsRes, clientsRes, quotesRes, invoicesRes, formsRes] = await Promise.all([
        api.get<any[]>('/api/jobs'),
        api.get<any[]>('/api/clients'),
        api.get<any[]>('/api/quotes'),
        api.get<any[]>('/api/invoices'),
        api.get<any[]>('/api/custom-forms').catch(() => ({ data: null, error: null } as any)),
      ]);
      
      if (jobsRes.data) await this.cacheJobs(jobsRes.data);
      if (clientsRes.data) await this.cacheClients(clientsRes.data);
      if (quotesRes.data) await this.cacheQuotes(quotesRes.data);
      if (invoicesRes.data) await this.cacheInvoices(invoicesRes.data);
      if (formsRes.data) await this.cacheSafetyFormTemplates(formsRes.data);
      
      useOfflineStore.getState().setLastSyncTime(Date.now());
      if (__DEV__) console.log('[OfflineStorage] Full sync complete');
    } catch (error) {
      if (__DEV__) console.warn('[OfflineStorage] Full sync skipped (offline DB unavailable, using server data):', error);
    } finally {
      useOfflineStore.getState().setSyncing(false);
    }
  }

  /**
   * Remove an item from cache by entity type and id
   */
  async removeFromCache(entityType: 'jobs' | 'clients' | 'quotes' | 'invoices', id: string): Promise<void> {
    if (!this.db) return;
    
    try {
      await this.db.runAsync(
        `DELETE FROM ${entityType} WHERE id = ?`,
        [id]
      );
      if (__DEV__) console.log(`[OfflineStorage] Removed ${entityType} ${id} from cache`);
    } catch (error) {
      if (__DEV__) console.warn(`[OfflineStorage] Failed to remove ${entityType} from cache:`, error);
    }
  }

  /**
   * Cleanup - remove network listener
   */
  cleanup(): void {
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }
  }

  // ============ CACHED AUTH DATA ============
  // Note: NO passwords or credentials are stored - only user profile data and settings
  // Session tokens are handled separately by SecureStore in api.ts

  /**
   * Cache user and business settings for offline access
   * This enables the app to work offline with cached user data
   */
  async cacheAuthData(userData: any, businessSettings: any, roleInfo?: any): Promise<void> {
    if (!this.db) return;
    
    try {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO cached_auth (id, user_data, business_settings, role_info, cached_at)
         VALUES ('current_user', ?, ?, ?, ?)`,
        [
          JSON.stringify(userData),
          JSON.stringify(businessSettings),
          roleInfo ? JSON.stringify(roleInfo) : null,
          Date.now()
        ]
      );
      if (__DEV__) console.log('[OfflineStorage] Cached auth data for offline access');
    } catch (error) {
      if (__DEV__) console.warn('[OfflineStorage] Failed to cache auth data:', error);
    }
  }

  /**
   * Get cached auth data for offline login
   * Returns null if no cached data or cache is too old (7 days)
   */
  async getCachedAuthData(): Promise<{
    userData: any;
    businessSettings: any;
    roleInfo: any;
    cachedAt: number;
  } | null> {
    if (!this.db) return null;
    
    try {
      const result = await this.db.getFirstAsync(
        'SELECT user_data, business_settings, role_info, cached_at FROM cached_auth WHERE id = ?',
        ['current_user']
      ) as any;
      
      if (!result) return null;
      
      // Check if cache is too old (7 days)
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - result.cached_at > sevenDaysMs) {
        if (__DEV__) console.log('[OfflineStorage] Cached auth data expired (>7 days old)');
        return null;
      }
      
      return {
        userData: result.user_data ? JSON.parse(result.user_data) : null,
        businessSettings: result.business_settings ? JSON.parse(result.business_settings) : null,
        roleInfo: result.role_info ? JSON.parse(result.role_info) : null,
        cachedAt: result.cached_at,
      };
    } catch (error) {
      if (__DEV__) console.warn('[OfflineStorage] Failed to get cached auth data:', error);
      return null;
    }
  }

  /**
   * Clear cached auth data (on logout)
   */
  async clearCachedAuthData(): Promise<void> {
    if (!this.db) return;
    
    try {
      await this.db.runAsync('DELETE FROM cached_auth');
      if (__DEV__) console.log('[OfflineStorage] Cleared cached auth data');
    } catch (error) {
      if (__DEV__) console.warn('[OfflineStorage] Failed to clear cached auth data:', error);
    }
  }

  /**
   * Check if we have valid cached auth data for offline use
   */
  async hasCachedAuth(): Promise<boolean> {
    const cached = await this.getCachedAuthData();
    return cached !== null && cached.userData !== null;
  }

  // ============ SUBSCRIPTION CACHE ============
  // Cache subscription/entitlement data for offline feature gating

  private static DEFAULT_SUBSCRIPTION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Cache subscription data with TTL for offline access
   * @param key - Unique key for the subscription data (e.g., 'user_plan', 'feature_flags')
   * @param data - The subscription data to cache (plan, features, etc.)
   * @param ttlMs - Time-to-live in milliseconds (default 24 hours)
   */
  async cacheSubscriptionData(key: string, data: any, ttlMs?: number): Promise<void> {
    if (!this.db) return;
    
    const now = Date.now();
    const ttl = ttlMs ?? OfflineStorageService.DEFAULT_SUBSCRIPTION_TTL_MS;
    
    try {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO subscription_cache (key, data, cached_at, ttl_ms)
         VALUES (?, ?, ?, ?)`,
        [key, JSON.stringify(data), now, ttl]
      );
      if (__DEV__) console.log(`[OfflineStorage] Cached subscription data for key: ${key}`);
    } catch (error) {
      if (__DEV__) console.warn('[OfflineStorage] Failed to cache subscription data:', error);
    }
  }

  /**
   * Get cached subscription data if not expired
   * @param key - The key to retrieve
   * @returns The cached data or null if expired/not found
   */
  async getCachedSubscriptionData<T>(key: string): Promise<T | null> {
    if (!this.db) return null;
    
    try {
      const result = await this.db.getFirstAsync(
        'SELECT data, cached_at, ttl_ms FROM subscription_cache WHERE key = ?',
        [key]
      ) as any;
      
      if (!result) return null;
      
      const now = Date.now();
      const expiresAt = result.cached_at + result.ttl_ms;
      
      if (now > expiresAt) {
        if (__DEV__) console.log(`[OfflineStorage] Subscription cache expired for key: ${key}`);
        return null;
      }
      
      return JSON.parse(result.data) as T;
    } catch (error) {
      if (__DEV__) console.warn('[OfflineStorage] Failed to get cached subscription data:', error);
      return null;
    }
  }

  /**
   * Check if subscription cache is still valid (not expired)
   * @param key - The key to check
   * @returns true if cache exists and is not expired
   */
  async isSubscriptionCacheValid(key: string): Promise<boolean> {
    if (!this.db) return false;
    
    try {
      const result = await this.db.getFirstAsync(
        'SELECT cached_at, ttl_ms FROM subscription_cache WHERE key = ?',
        [key]
      ) as any;
      
      if (!result) return false;
      
      const now = Date.now();
      const expiresAt = result.cached_at + result.ttl_ms;
      
      return now <= expiresAt;
    } catch (error) {
      if (__DEV__) console.warn('[OfflineStorage] Failed to check subscription cache validity:', error);
      return false;
    }
  }

  /**
   * Invalidate subscription cache
   * @param key - Optional key to invalidate. If not provided, clears all subscription caches.
   */
  async invalidateSubscriptionCache(key?: string): Promise<void> {
    if (!this.db) return;
    
    try {
      if (key) {
        await this.db.runAsync('DELETE FROM subscription_cache WHERE key = ?', [key]);
        if (__DEV__) console.log(`[OfflineStorage] Invalidated subscription cache for key: ${key}`);
      } else {
        await this.db.runAsync('DELETE FROM subscription_cache');
        if (__DEV__) console.log('[OfflineStorage] Invalidated all subscription caches');
      }
    } catch (error) {
      if (__DEV__) console.warn('[OfflineStorage] Failed to invalidate subscription cache:', error);
    }
  }

  // ============ T005: SAFETY FORMS OFFLINE ============

  async cacheSafetyFormTemplates(templates: any[]): Promise<void> {
    if (!this.db || !Array.isArray(templates)) return;
    const db = this.db;
    const now = Date.now();
    try {
      await this.runInTransaction(async () => {
        await db.runAsync('DELETE FROM safety_form_templates');
        for (const t of templates) {
          await db.runAsync(
            `INSERT OR REPLACE INTO safety_form_templates (id, name, form_type, fields_json, template_data, cached_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              t.id,
              t.name || t.title || null,
              t.formType || t.type || 'custom',
              JSON.stringify(t.fields || t.formFields || []),
              JSON.stringify(t),
              now,
            ]
          );
        }
      });
      if (__DEV__) console.log(`[OfflineStorage] Cached ${templates.length} safety form templates`);
    } catch (err) {
      if (__DEV__) console.warn('[OfflineStorage] cacheSafetyFormTemplates failed:', err);
    }
  }

  async getSafetyFormTemplatesOffline(formType?: string): Promise<any[]> {
    if (!this.db) return [];
    try {
      const rows = formType
        ? await this.db.getAllAsync(
            'SELECT template_data FROM safety_form_templates WHERE form_type = ? ORDER BY name',
            [formType]
          )
        : await this.db.getAllAsync('SELECT template_data FROM safety_form_templates ORDER BY name');
      return (rows as any[]).map(r => {
        try { return JSON.parse(r.template_data); } catch { return null; }
      }).filter(Boolean);
    } catch (err) {
      if (__DEV__) console.warn('[OfflineStorage] getSafetyFormTemplatesOffline failed:', err);
      return [];
    }
  }

  /**
   * Save a form submission locally and queue it for sync. Used both online (write-through)
   * and offline. Returns the local id (`local_<random>`) so the caller can update UI state.
   */
  async saveFormSubmissionOffline(submission: {
    formId: string;
    jobId?: string | null;
    submissionData: any;
    signatures?: any;
    status?: string;
  }): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');
    const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const now = Date.now();
    await this.db.runAsync(
      `INSERT INTO form_submissions_local (id, local_id, form_id, job_id, submission_data, signatures, status, cached_at, pending_sync, sync_action)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'create')`,
      [
        localId,
        localId,
        submission.formId,
        submission.jobId || null,
        JSON.stringify(submission.submissionData || {}),
        submission.signatures ? JSON.stringify(submission.signatures) : null,
        submission.status || 'submitted',
        now,
      ]
    );
    // Queue for sync
    const syncId = `sync_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    await this.db.runAsync(
      `INSERT INTO sync_queue (id, type, action, data, created_at, retry_count) VALUES (?, ?, ?, ?, ?, 0)`,
      [syncId, 'formSubmission', 'create', JSON.stringify({
        localId,
        formId: submission.formId,
        jobId: submission.jobId || null,
        submissionData: submission.submissionData || {},
        signatures: submission.signatures || null,
        status: submission.status || 'submitted',
      }), now]
    );
    await this.updatePendingSyncCount();
    if (__DEV__) console.log(`[OfflineStorage] Queued form submission ${localId}`);
    return localId;
  }

  /**
   * Queue an offline edit of a job-card submission.
   * - Local (unsynced `local_`) rows: update the row + rewrite the queued create payload.
   * - Server rows: upsert a local snapshot and queue an 'update' action.
   */
  async updateFormSubmissionOffline(
    id: string,
    submissionData: any,
    meta?: { formId?: string; jobId?: string | null }
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    const now = Date.now();
    if (id.startsWith('local_')) {
      await this.db.runAsync(
        `UPDATE form_submissions_local SET submission_data = ? WHERE local_id = ? OR id = ?`,
        [JSON.stringify(submissionData || {}), id, id]
      );
      // Rewrite the pending create payload so the eventual sync carries the edit
      const rows = await this.db.getAllAsync(
        `SELECT id, data FROM sync_queue WHERE type = 'formSubmission' AND action = 'create' AND data LIKE ?`,
        [`%${id}%`]
      ) as { id: string; data: string }[];
      for (const row of rows) {
        try {
          const payload = JSON.parse(row.data);
          if (payload.localId === id) {
            payload.submissionData = submissionData || {};
            await this.db.runAsync(`UPDATE sync_queue SET data = ? WHERE id = ?`, [JSON.stringify(payload), row.id]);
          }
        } catch {}
      }
    } else {
      await this.db.runAsync(
        `INSERT INTO form_submissions_local (id, local_id, form_id, job_id, submission_data, status, cached_at, pending_sync, sync_action)
         VALUES (?, ?, ?, ?, ?, 'submitted', ?, 1, 'update')
         ON CONFLICT(id) DO UPDATE SET submission_data = excluded.submission_data, pending_sync = 1, sync_action = 'update'`,
        [id, id, meta?.formId || null, meta?.jobId || null, JSON.stringify(submissionData || {}), now]
      );
      // Collapse any earlier queued update for the same submission (last write wins)
      const rows = await this.db.getAllAsync(
        `SELECT id, data FROM sync_queue WHERE type = 'formSubmission' AND action = 'update' AND data LIKE ?`,
        [`%${id}%`]
      ) as { id: string; data: string }[];
      for (const row of rows) {
        try {
          if (JSON.parse(row.data).id === id) {
            await this.db.runAsync('DELETE FROM sync_queue WHERE id = ?', [row.id]);
          }
        } catch {}
      }
      const syncId = `sync_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      await this.db.runAsync(
        `INSERT INTO sync_queue (id, type, action, data, created_at, retry_count) VALUES (?, 'formSubmission', 'update', ?, ?, 0)`,
        [syncId, JSON.stringify({ id, submissionData: submissionData || {} }), now]
      );
    }
    await this.updatePendingSyncCount();
  }

  /**
   * Queue an offline delete of a job-card submission.
   * - Local (unsynced) rows: drop the row and its queued create — nothing ever reaches the server.
   * - Server rows: drop the local snapshot (+ any queued edits) and queue a 'delete'.
   */
  async deleteFormSubmissionOffline(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    const now = Date.now();
    // Remove any queued create/update for this submission
    const rows = await this.db.getAllAsync(
      `SELECT id, data, action FROM sync_queue WHERE type = 'formSubmission' AND data LIKE ?`,
      [`%${id}%`]
    ) as { id: string; data: string; action: string }[];
    for (const row of rows) {
      try {
        const payload = JSON.parse(row.data);
        if (payload.localId === id || payload.id === id) {
          await this.db.runAsync('DELETE FROM sync_queue WHERE id = ?', [row.id]);
        }
      } catch {}
    }
    if (id.startsWith('local_')) {
      // Never reached the server — hard-delete, nothing to reconcile
      await this.db.runAsync('DELETE FROM form_submissions_local WHERE id = ? OR local_id = ?', [id, id]);
    } else {
      // Server row: keep a tombstone (pending_sync=1, sync_action='delete') so the
      // write-through cache can't resurrect it before the queued delete syncs.
      await this.db.runAsync(
        `INSERT INTO form_submissions_local (id, local_id, form_id, job_id, submission_data, status, cached_at, pending_sync, sync_action)
         VALUES (?, ?, NULL, NULL, '{}', 'deleted', ?, 1, 'delete')
         ON CONFLICT(id) DO UPDATE SET pending_sync = 1, sync_action = 'delete', status = 'deleted'`,
        [id, id, now]
      );
      const syncId = `sync_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      await this.db.runAsync(
        `INSERT INTO sync_queue (id, type, action, data, created_at, retry_count) VALUES (?, 'formSubmission', 'delete', ?, ?, 0)`,
        [syncId, JSON.stringify({ id }), now]
      );
    }
    await this.updatePendingSyncCount();
  }

  /**
   * Write-through cache of server job-card submissions for a job so the job
   * view still shows them offline. Never touches rows with pending_sync=1
   * (queued offline work) — only refreshes the synced snapshot.
   */
  async cacheServerFormSubmissions(jobId: string, submissions: any[]): Promise<void> {
    if (!this.db) return;
    try {
      await this.db.runAsync(
        `DELETE FROM form_submissions_local WHERE job_id = ? AND pending_sync = 0`,
        [jobId]
      );
      const now = Date.now();
      for (const s of submissions) {
        if (!s?.id) continue;
        // Skip ids that still have a pending edit queued locally
        const pending = await this.db.getFirstAsync(
          `SELECT id FROM form_submissions_local WHERE id = ? AND pending_sync = 1`,
          [s.id]
        );
        if (pending) continue;
        await this.db.runAsync(
          `INSERT OR REPLACE INTO form_submissions_local (id, local_id, form_id, job_id, submission_data, signatures, status, cached_at, pending_sync, sync_action)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
          [
            s.id,
            s.id,
            s.formId || null,
            jobId,
            JSON.stringify(s.submissionData ?? s.data ?? {}),
            s.signatures ? JSON.stringify(s.signatures) : null,
            s.status || 'submitted',
            s.submittedAt ? new Date(s.submittedAt).getTime() || now : now,
          ]
        );
      }
    } catch (err) {
      if (__DEV__) console.warn('[OfflineStorage] cacheServerFormSubmissions failed:', err);
    }
  }

  async getOfflineFormSubmissions(jobId?: string): Promise<any[]> {
    if (!this.db) return [];
    try {
      const rows = jobId
        ? await this.db.getAllAsync(
            'SELECT * FROM form_submissions_local WHERE job_id = ? ORDER BY cached_at DESC',
            [jobId]
          )
        : await this.db.getAllAsync('SELECT * FROM form_submissions_local ORDER BY cached_at DESC');
      return (rows as any[]).map(r => ({
        ...r,
        submissionData: r.submission_data ? JSON.parse(r.submission_data) : {},
        signatures: r.signatures ? JSON.parse(r.signatures) : null,
        pendingSync: r.pending_sync === 1,
      }));
    } catch (err) {
      if (__DEV__) console.warn('[OfflineStorage] getOfflineFormSubmissions failed:', err);
      return [];
    }
  }

  // ============ T006: CHAT OFFLINE ============

  async cacheChatMessages(channelType: string, channelId: string, messages: any[]): Promise<void> {
    if (!this.db || !Array.isArray(messages)) return;
    const db = this.db;
    const now = Date.now();
    try {
      await this.runInTransaction(async () => {
        for (const m of messages) {
          // Don't overwrite an in-flight pending_sync row by id collision.
          await db.runAsync(
            `INSERT OR REPLACE INTO chat_messages
              (id, local_id, channel_type, channel_id, sender_id, sender_name, message,
               message_type, attachment_url, created_at, read_locally, pending_sync, sync_action, cached_at)
             VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NULL, ?)`,
            [
              m.id,
              channelType,
              channelId,
              m.senderId || m.userId || null,
              m.senderName || m.userName || null,
              m.message || m.body || m.content || '',
              m.messageType || m.type || 'text',
              m.attachmentUrl || null,
              m.createdAt || new Date().toISOString(),
              now,
            ]
          );
        }
      });
    } catch (err) {
      if (__DEV__) console.warn('[OfflineStorage] cacheChatMessages failed:', err);
    }
  }

  /**
   * Returns the count of pending-sync messages for every (channelType, channelId).
   * UI uses this to add badge counts when messages are queued offline.
   */
  async getAllPendingChatCounts(): Promise<Record<string, number>> {
    if (!this.db) return {};
    try {
      const rows = await this.db.getAllAsync(
        `SELECT channel_type, channel_id, COUNT(*) as cnt FROM chat_messages
         WHERE pending_sync = 1 GROUP BY channel_type, channel_id`
      );
      const map: Record<string, number> = {};
      (rows as any[]).forEach(r => {
        map[`${r.channel_type}:${r.channel_id}`] = Number(r.cnt) || 0;
      });
      return map;
    } catch (err) {
      if (__DEV__) console.warn('[OfflineStorage] getAllPendingChatCounts failed:', err);
      return {};
    }
  }

  /**
   * G1: Queue a geofence enter/exit event captured offline (or after a failed POST).
   * Server uses idempotencyKey to ensure each physical event fires SMS / clock-in once.
   */
  async queueGeofenceEvent(opts: {
    jobId: string;
    identifier?: string;
    action: 'enter' | 'exit';
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    timestamp?: number;
  }): Promise<void> {
    if (!this.db) return;
    try {
      const ts = opts.timestamp || Date.now();
      const idempotencyKey = `geo_${opts.jobId}_${opts.action}_${Math.floor(ts / 1000)}`;
      const id = `local_geo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const now = Date.now();
      await this.db.runAsync(
        `INSERT OR IGNORE INTO geofence_events_local
         (id, job_id, identifier, action, latitude, longitude, accuracy, event_timestamp, idempotency_key, pending_sync, cached_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [
          id,
          opts.jobId,
          opts.identifier || `job_${opts.jobId}`,
          opts.action,
          opts.latitude ?? null,
          opts.longitude ?? null,
          opts.accuracy ?? null,
          ts,
          idempotencyKey,
          now,
        ]
      );
      const queueItemId = `gq_${id}`;
      await this.db.runAsync(
        `INSERT INTO sync_queue (id, type, action, data, created_at, retry_count) VALUES (?, ?, ?, ?, ?, 0)`,
        [
          queueItemId,
          'geofenceEvent',
          'create',
          JSON.stringify({
            localId: id,
            jobId: opts.jobId,
            identifier: opts.identifier || `job_${opts.jobId}`,
            action: opts.action,
            latitude: opts.latitude ?? null,
            longitude: opts.longitude ?? null,
            accuracy: opts.accuracy ?? null,
            timestamp: new Date(ts).toISOString(),
            idempotencyKey,
          }),
          now,
        ]
      );
      await this.updatePendingSyncCount();
      if (__DEV__) console.log('[OfflineStorage] Geofence event queued:', opts.action, opts.jobId);
    } catch (err) {
      if (__DEV__) console.warn('[OfflineStorage] queueGeofenceEvent failed:', err);
    }
  }

  /**
   * Purge old, fully-synced offline rows so the local SQLite file doesn't grow forever.
   * Touches: chat_messages, form_submissions_local, geofence_events_local, time_entries.
   * Only deletes rows where pending_sync = 0 AND older than the retention window.
   */
  async purgeSyncedOfflineRows(retentionDays: number = 30): Promise<{ chat: number; forms: number; geofence: number; timeEntries: number }> {
    const result = { chat: 0, forms: 0, geofence: 0, timeEntries: 0 };
    if (!this.db) return result;
    const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const cutoffIso = new Date(cutoffMs).toISOString();
    const exec = async (sqlText: string, params: any[], key: keyof typeof result) => {
      try {
        const res: any = await this.db!.runAsync(sqlText, params);
        result[key] = res?.changes ?? 0;
      } catch (e) {
        if (__DEV__) console.warn('[OfflineStorage] purge step failed', key, e);
      }
    };
    await exec(
      `DELETE FROM chat_messages WHERE pending_sync = 0 AND created_at < ?`,
      [cutoffIso],
      'chat'
    );
    // form_submissions_local stores submissions; only purge synced ones
    await exec(
      `DELETE FROM form_submissions_local WHERE pending_sync = 0 AND submitted_at < ?`,
      [cutoffIso],
      'forms'
    );
    await exec(
      `DELETE FROM geofence_events_local WHERE pending_sync = 0 AND timestamp < ?`,
      [cutoffMs],
      'geofence'
    );
    // Synced & ended time entries with a server-assigned id (no 'local_' prefix)
    await exec(
      `DELETE FROM time_entries WHERE pending_sync = 0 AND end_time IS NOT NULL AND end_time < ? AND id NOT LIKE 'local_%'`,
      [cutoffIso],
      'timeEntries'
    );
    if (__DEV__) console.log('[OfflineStorage] Purged synced rows older than', retentionDays, 'days:', result);
    return result;
  }

  /**
   * T1: Returns the most recent locally-started time entry that hasn't been stopped.
   * Used by store.fetchActiveTimer to avoid clobbering a pending offline timer with
   * a (stale or absent) server response when the device reconnects.
   */
  async getActiveLocalTimeEntry(): Promise<any | null> {
    if (!this.db) return null;
    try {
      const row = await this.db.getFirstAsync(
        `SELECT * FROM time_entries
         WHERE end_time IS NULL AND id LIKE 'local_%' AND pending_sync = 1
         ORDER BY start_time DESC LIMIT 1`
      );
      if (!row) return null;
      const r: any = row;
      return {
        id: r.id,
        userId: r.user_id,
        jobId: r.job_id,
        description: r.description,
        startTime: r.start_time,
        endTime: r.end_time,
        notes: r.notes,
        clockInLatitude: r.start_lat,
        clockInLongitude: r.start_lng,
        pendingSync: true,
      };
    } catch (err) {
      if (__DEV__) console.warn('[OfflineStorage] getActiveLocalTimeEntry unavailable (using server state):', err);
      return null;
    }
  }

  /**
   * C1: Failed-chat-send helpers. A message becomes 'failed' when the server
   * rejected it (4xx) — transport errors keep it 'pending' for automatic retry.
   */
  async getFailedChatMessages(channelType: string, channelId: string): Promise<any[]> {
    if (!this.db) return [];
    try {
      const rows = await this.db.getAllAsync(
        `SELECT * FROM chat_messages
         WHERE channel_type = ? AND channel_id = ? AND send_status = 'failed'
         ORDER BY created_at ASC`,
        [channelType, channelId]
      );
      return (rows as any[]).map(r => ({
        id: r.id,
        localId: r.local_id,
        channelType: r.channel_type,
        channelId: r.channel_id,
        senderId: r.sender_id,
        senderName: r.sender_name,
        message: r.message,
        messageType: r.message_type,
        attachmentUrl: r.attachment_url,
        createdAt: r.created_at,
        sendStatus: 'failed' as const,
      }));
    } catch (err) {
      if (__DEV__) console.warn('[OfflineStorage] getFailedChatMessages failed:', err);
      return [];
    }
  }

  async retryFailedChatMessage(localId: string): Promise<boolean> {
    if (!this.db) return false;
    try {
      const row: any = await this.db.getFirstAsync(
        `SELECT * FROM chat_messages WHERE local_id = ? OR id = ? LIMIT 1`,
        [localId, localId]
      );
      if (!row) return false;

      // Reset status, re-queue
      await this.db.runAsync(
        `UPDATE chat_messages SET send_status = 'pending', pending_sync = 1 WHERE id = ?`,
        [row.id]
      );
      const queueItemId = `cm_retry_${row.id}_${Date.now()}`;
      await this.db.runAsync(
        `INSERT INTO sync_queue (id, type, action, data, created_at, retry_count) VALUES (?, ?, ?, ?, ?, 0)`,
        [
          queueItemId,
          'chatMessage',
          'create',
          JSON.stringify({
            localId: row.local_id || row.id,
            channelType: row.channel_type,
            channelId: row.channel_id,
            message: row.message,
            messageType: row.message_type,
            attachmentUrl: row.attachment_url,
          }),
          Date.now(),
        ]
      );
      await this.updatePendingSyncCount();
      // Trigger immediate sync attempt if online
      const online = useOfflineStore.getState().isOnline;
      if (online) this.syncPendingChanges().catch(() => {});
      return true;
    } catch (err) {
      if (__DEV__) console.warn('[OfflineStorage] retryFailedChatMessage failed:', err);
      return false;
    }
  }

  /**
   * Cache and retrieve WHS JSA documents (read-only list snapshot).
   */
  async cacheJsaDocs(docs: any[]): Promise<void> {
    try {
      await this.setMetadata('whs_jsa_docs', JSON.stringify(docs || []));
      await this.setMetadata('whs_jsa_docs_cached_at', String(Date.now()));
    } catch (err) {
      if (__DEV__) console.warn('[OfflineStorage] cacheJsaDocs failed:', err);
    }
  }

  async getJsaDocsOffline(): Promise<any[]> {
    try {
      const raw = await this.getMetadata('whs_jsa_docs');
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  /**
   * Returns only locally-created messages still pending sync for a channel.
   * UI can append these to the server-fetched list to avoid optimistic-message loss
   * during 3-5s polling overwrites.
   */
  async getPendingChatMessages(channelType: string, channelId: string): Promise<any[]> {
    if (!this.db) return [];
    try {
      const rows = await this.db.getAllAsync(
        `SELECT * FROM chat_messages WHERE channel_type = ? AND channel_id = ? AND pending_sync = 1
         ORDER BY created_at ASC`,
        [channelType, channelId]
      );
      return (rows as any[]).map(r => ({
        id: r.id,
        localId: r.local_id,
        channelType: r.channel_type,
        channelId: r.channel_id,
        senderId: r.sender_id,
        senderName: r.sender_name,
        message: r.message,
        content: r.message, // alias for direct-messages UI which uses .content
        messageType: r.message_type,
        attachmentUrl: r.attachment_url,
        createdAt: r.created_at,
        pendingSync: true,
        sendStatus: (r.send_status as 'pending' | 'failed' | 'synced') || 'pending',
      }));
    } catch (err) {
      if (__DEV__) console.warn('[OfflineStorage] getPendingChatMessages failed:', err);
      return [];
    }
  }

  async getChatMessagesOffline(channelType: string, channelId: string, limit = 100): Promise<any[]> {
    if (!this.db) return [];
    try {
      const rows = await this.db.getAllAsync(
        `SELECT * FROM chat_messages WHERE channel_type = ? AND channel_id = ?
         ORDER BY created_at ASC LIMIT ?`,
        [channelType, channelId, limit]
      );
      return (rows as any[]).map(r => ({
        id: r.id,
        localId: r.local_id,
        channelType: r.channel_type,
        channelId: r.channel_id,
        senderId: r.sender_id,
        senderName: r.sender_name,
        message: r.message,
        messageType: r.message_type,
        attachmentUrl: r.attachment_url,
        createdAt: r.created_at,
        pendingSync: r.pending_sync === 1,
      }));
    } catch (err) {
      if (__DEV__) console.warn('[OfflineStorage] getChatMessagesOffline failed:', err);
      return [];
    }
  }

  /**
   * Optimistically save a chat message locally and queue it for sync.
   * Returns the local message row (with `local_<random>` id) so the UI can render immediately.
   */
  async sendChatMessageOffline(
    channelType: 'team' | 'job' | 'dm',
    channelId: string,
    message: string,
    extras: { senderId?: string; senderName?: string; messageType?: string; attachmentUrl?: string } = {}
  ): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');
    const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const now = Date.now();
    const createdAt = new Date(now).toISOString();
    await this.db.runAsync(
      `INSERT INTO chat_messages
        (id, local_id, channel_type, channel_id, sender_id, sender_name, message,
         message_type, attachment_url, created_at, read_locally, pending_sync, sync_action, cached_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 'create', ?)`,
      [
        localId, localId, channelType, channelId,
        extras.senderId || null, extras.senderName || null,
        message, extras.messageType || 'text', extras.attachmentUrl || null,
        createdAt, now,
      ]
    );
    const syncId = `sync_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    await this.db.runAsync(
      `INSERT INTO sync_queue (id, type, action, data, created_at, retry_count) VALUES (?, ?, ?, ?, ?, 0)`,
      [syncId, 'chatMessage', 'create', JSON.stringify({
        localId,
        channelType,
        channelId,
        message,
        messageType: extras.messageType || 'text',
        attachmentUrl: extras.attachmentUrl || null,
      }), now]
    );
    await this.updatePendingSyncCount();
    return {
      id: localId, localId, channelType, channelId,
      senderId: extras.senderId, senderName: extras.senderName,
      message, messageType: extras.messageType || 'text',
      attachmentUrl: extras.attachmentUrl || null,
      createdAt, pendingSync: true,
    };
  }
}

export const offlineStorage = new OfflineStorageService();
export default offlineStorage;

// ============ BACKGROUND TASK DEFINITION ============
// Define the background sync task handler
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    if (__DEV__) console.log('[BackgroundSync] Task started');
    const hasNewData = await offlineStorage.executeBackgroundSync();
    if (hasNewData) {
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }
    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    if (__DEV__) console.warn('[BackgroundSync] Task failed:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});
