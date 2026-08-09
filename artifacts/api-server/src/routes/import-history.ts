// Task 300: Import traceability, history and undo.
//
// Every data import (legacy CSV import + smart import) now creates an
// import_runs row, retains the original uploaded file in object storage, and
// tags every created record with (import_run_id, import_row_number). These
// routes expose the history, the original file download, and one-tap undo
// with edit protection.
import type { Express } from "express";
import { randomUUID } from "crypto";
import { db, storage } from "../storage";
import { and, desc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import {
  importRuns,
  clients,
  jobs,
  quotes,
  invoices,
  lineItemCatalog,
  users,
} from "@workspace/db";
import { requireAuth } from "./middleware";
import { ObjectStorageService } from "../objectStorage";
import { logger } from "../logger";

export type ImportRecordType = 'clients' | 'catalog' | 'jobs' | 'quotes' | 'invoices';

const TYPE_TABLE = {
  clients,
  catalog: lineItemCatalog,
  jobs,
  quotes,
  invoices,
} as const;

const TYPE_LABEL: Record<ImportRecordType, string> = {
  clients: 'clients',
  catalog: 'price list items',
  jobs: 'jobs',
  quotes: 'quotes',
  invoices: 'invoices',
};

// A record counts as "edited since import" when its updated_at moved more
// than this grace window past its created_at (imports set both together).
const EDIT_GRACE_MS = 10_000;

// ---------- helpers used by the import routes ----------

// Uploads the original import file to object storage under imports/ and
// returns its /objects/ path. Best-effort: returns null on failure so an
// import never fails because file retention failed.
export async function persistImportFile(
  fileName: string,
  buffer: Buffer,
  contentType?: string,
): Promise<string | null> {
  try {
    const objectStorage = new ObjectStorageService();
    const safeName = (fileName || 'import.csv').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120);
    return await objectStorage.uploadFile(
      `imports/${randomUUID()}-${safeName}`,
      buffer,
      contentType || 'application/octet-stream',
    );
  } catch (err) {
    logger.warn?.('background', 'Failed to retain import file in object storage', { error: err } as any);
    return null;
  }
}

export async function createPendingImportRun(params: {
  userId: string;
  fileName: string;
  filePath?: string | null;
  fileSize?: number | null;
  source: 'csv' | 'smart';
  platform?: string | null;
  type?: string;
}): Promise<string> {
  const [run] = await db.insert(importRuns).values({
    userId: params.userId,
    fileName: params.fileName,
    filePath: params.filePath ?? null,
    fileSize: params.fileSize ?? null,
    source: params.source,
    platform: params.platform ?? null,
    type: params.type || 'unknown',
    status: 'pending',
  }).returning({ id: importRuns.id });
  return run.id;
}

// Resolves a client-supplied importRunId to a safe, owned, pending run id.
// Returns null when it isn't usable (wrong owner / already completed).
export async function resolvePendingImportRun(userId: string, importRunId: unknown): Promise<string | null> {
  if (typeof importRunId !== 'string' || !importRunId) return null;
  const [run] = await db.select({ id: importRuns.id })
    .from(importRuns)
    .where(and(eq(importRuns.id, importRunId), eq(importRuns.userId, userId), eq(importRuns.status, 'pending')))
    .limit(1);
  return run?.id ?? null;
}

export async function finalizeImportRun(id: string, params: {
  type: string;
  imported: number;
  merged?: number;
  skipped?: number;
  platform?: string | null;
}): Promise<void> {
  await db.update(importRuns).set({
    type: params.type,
    status: 'completed',
    recordsImported: params.imported,
    recordsMerged: params.merged ?? 0,
    recordsSkipped: params.skipped ?? 0,
    ...(params.platform ? { platform: params.platform } : {}),
    completedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(importRuns.id, id));
}

function isValidType(type: string): type is ImportRecordType {
  return type in TYPE_TABLE;
}

async function getRunStats(run: { id: string; userId: string; type: string; completedAt: Date | null; createdAt: Date | null }) {
  if (!isValidType(run.type)) return { remaining: 0, edited: 0, clientsCreated: 0 };
  const table: any = TYPE_TABLE[run.type];
  const [row] = await db.select({
    remaining: sql<number>`count(*)::int`,
    edited: sql<number>`count(*) FILTER (WHERE ${table.updatedAt} > ${table.createdAt} + interval '${sql.raw(String(EDIT_GRACE_MS / 1000))} seconds')::int`,
  }).from(table).where(and(eq(table.importRunId, run.id), eq(table.userId, run.userId)));
  let clientsCreated = 0;
  if (run.type !== 'clients' && run.type !== 'catalog') {
    // Side-created clients (find-or-create during job/quote/invoice imports)
    const [c] = await db.select({ n: sql<number>`count(*)::int` })
      .from(clients)
      .where(and(eq(clients.importRunId, run.id), eq(clients.userId, run.userId)));
    clientsCreated = c?.n ?? 0;
  }
  return { remaining: row?.remaining ?? 0, edited: row?.edited ?? 0, clientsCreated };
}

// ---------- routes ----------

export function registerImportHistoryRoutes(app: Express): void {

  // List this user's imports (most recent first).
  app.get('/api/import/history', requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;

      // Housekeeping: drop abandoned pending runs (previewed but never imported).
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      db.delete(importRuns)
        .where(and(eq(importRuns.userId, userId), eq(importRuns.status, 'pending'), lt(importRuns.createdAt, cutoff)))
        .catch(() => {});

      const runs = await db.select({
        run: importRuns,
        ranByFirstName: users.firstName,
        ranByLastName: users.lastName,
        ranByEmail: users.email,
      })
        .from(importRuns)
        .leftJoin(users, eq(users.id, importRuns.userId))
        .where(and(eq(importRuns.userId, userId), inArray(importRuns.status, ['completed', 'undone'])))
        .orderBy(desc(importRuns.createdAt))
        .limit(100);

      const items = await Promise.all(runs.map(async ({ run, ranByFirstName, ranByLastName, ranByEmail }) => {
        const stats = run.status === 'completed'
          ? await getRunStats(run as any)
          : { remaining: 0, edited: 0, clientsCreated: 0 };
        return {
          id: run.id,
          fileName: run.fileName,
          hasFile: !!run.filePath,
          fileSize: run.fileSize,
          source: run.source,
          platform: run.platform,
          type: run.type,
          typeLabel: isValidType(run.type) ? TYPE_LABEL[run.type] : run.type,
          status: run.status,
          recordsImported: run.recordsImported,
          recordsMerged: run.recordsMerged,
          recordsSkipped: run.recordsSkipped,
          recordsRemoved: run.recordsRemoved,
          remaining: stats.remaining,
          editedSinceImport: stats.edited,
          clientsCreated: stats.clientsCreated,
          ranBy: [ranByFirstName, ranByLastName].filter(Boolean).join(' ') || ranByEmail || 'Unknown',
          importedAt: run.completedAt || run.createdAt,
          undoneAt: run.undoneAt,
        };
      }));

      res.json({ imports: items });
    } catch (error: any) {
      logger.error?.('api', 'Import history list failed', { error });
      res.status(500).json({ error: 'Failed to load import history' });
    }
  });

  // Details for one import (used by the origin badge on record detail views).
  app.get('/api/import/history/:id', requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const [run] = await db.select().from(importRuns)
        .where(and(eq(importRuns.id, req.params.id), eq(importRuns.userId, userId)))
        .limit(1);
      if (!run) return res.status(404).json({ error: 'Import not found' });
      const stats = run.status === 'completed' ? await getRunStats(run as any) : { remaining: 0, edited: 0, clientsCreated: 0 };
      res.json({
        id: run.id,
        fileName: run.fileName,
        hasFile: !!run.filePath,
        source: run.source,
        platform: run.platform,
        type: run.type,
        typeLabel: isValidType(run.type) ? TYPE_LABEL[run.type] : run.type,
        status: run.status,
        recordsImported: run.recordsImported,
        recordsMerged: run.recordsMerged,
        recordsSkipped: run.recordsSkipped,
        recordsRemoved: run.recordsRemoved,
        remaining: stats.remaining,
        editedSinceImport: stats.edited,
        clientsCreated: stats.clientsCreated,
        importedAt: run.completedAt || run.createdAt,
        undoneAt: run.undoneAt,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to load import details' });
    }
  });

  // Signed URL to re-download the original uploaded file. POST (not a plain
  // link) because the web app authenticates with Bearer tokens.
  app.post('/api/import/history/:id/file-url', requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const [run] = await db.select().from(importRuns)
        .where(and(eq(importRuns.id, req.params.id), eq(importRuns.userId, userId)))
        .limit(1);
      if (!run) return res.status(404).json({ error: 'Import not found' });
      if (!run.filePath) return res.status(404).json({ error: 'The original file for this import was not retained' });
      const objectStorage = new ObjectStorageService();
      const url = await objectStorage.getSignedDownloadURL(run.filePath, 300);
      res.json({ url, fileName: run.fileName });
    } catch (error: any) {
      logger.error?.('api', 'Import file download failed', { error });
      res.status(500).json({ error: 'Failed to prepare file download' });
    }
  });

  // Undo an import: removes every record it created. Records edited since the
  // import require explicit confirmation — the caller either keeps them
  // (keepEdited) or removes them too (confirmEdited).
  app.post('/api/import/history/:id/undo', requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const keepEdited = req.body?.keepEdited === true;
      const confirmEdited = req.body?.confirmEdited === true;

      const [run] = await db.select().from(importRuns)
        .where(and(eq(importRuns.id, req.params.id), eq(importRuns.userId, userId)))
        .limit(1);
      if (!run) return res.status(404).json({ error: 'Import not found' });
      if (run.status !== 'completed') {
        return res.status(400).json({ error: run.status === 'undone' ? 'This import was already undone' : 'This import cannot be undone' });
      }
      if (!isValidType(run.type)) {
        return res.status(400).json({ error: 'This import type cannot be undone' });
      }

      const table: any = TYPE_TABLE[run.type];
      const stats = await getRunStats(run as any);

      // Edit protection: surface a clear warning before touching edited records.
      if (stats.edited > 0 && !keepEdited && !confirmEdited) {
        return res.status(409).json({
          requiresConfirmation: true,
          editedCount: stats.edited,
          totalCount: stats.remaining,
          typeLabel: TYPE_LABEL[run.type],
          message: `${stats.edited} of the ${stats.remaining} imported ${TYPE_LABEL[run.type]} ${stats.edited === 1 ? 'has' : 'have'} been edited since the import.`,
        });
      }

      const editedCondition = sql`${table.updatedAt} > ${table.createdAt} + interval '${sql.raw(String(EDIT_GRACE_MS / 1000))} seconds'`;
      const baseWhere = and(eq(table.importRunId, run.id), eq(table.userId, userId));

      let removed = 0;
      let keptEdited = 0;

      if (keepEdited && stats.edited > 0) {
        const result = await db.delete(table)
          .where(and(baseWhere, sql`NOT (${editedCondition})`));
        removed = result.rowCount ?? 0;
        keptEdited = stats.edited;
      } else {
        const result = await db.delete(table).where(baseWhere);
        removed = result.rowCount ?? 0;
      }

      // Also remove clients that were side-created by this job/quote/invoice
      // import — but only when nothing else references them anymore.
      let clientsRemoved = 0;
      if (run.type !== 'clients' && run.type !== 'catalog') {
        const sideClients = await db.select({ id: clients.id })
          .from(clients)
          .where(and(eq(clients.importRunId, run.id), eq(clients.userId, userId)));
        for (const c of sideClients) {
          const [refs] = await db.select({
            n: sql<number>`(
              (SELECT count(*) FROM jobs WHERE client_id = ${c.id}) +
              (SELECT count(*) FROM quotes WHERE client_id = ${c.id}) +
              (SELECT count(*) FROM invoices WHERE client_id = ${c.id})
            )::int`,
          }).from(sql`(SELECT 1) AS one`);
          if ((refs?.n ?? 1) === 0) {
            const del = await db.delete(clients).where(and(eq(clients.id, c.id), eq(clients.userId, userId)));
            clientsRemoved += del.rowCount ?? 0;
          }
        }
      }

      await db.update(importRuns).set({
        status: 'undone',
        recordsRemoved: removed + clientsRemoved,
        undoneAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(importRuns.id, run.id));

      try {
        const { invalidateAggregateDashboard } = await import('../cache');
        invalidateAggregateDashboard(userId);
      } catch { /* best-effort */ }

      res.json({
        removed,
        clientsRemoved,
        keptEdited,
        typeLabel: TYPE_LABEL[run.type],
      });
    } catch (error: any) {
      logger.error?.('api', 'Import undo failed', { error });
      res.status(500).json({ error: 'Failed to undo import' });
    }
  });
}
