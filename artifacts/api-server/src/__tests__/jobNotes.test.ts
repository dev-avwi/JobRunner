/**
 * Tests for Job Notes authorization contract.
 *
 * Verifies that:
 *   1. `canAccessJobMedia` denies unassigned workers (403 via requireJobMediaAccess).
 *   2. Owners bypass the assignment check.
 *   3. True admins (VIEW_ALL + MANAGE_TEAM) bypass the assignment check.
 *   4. Workers with only MANAGE_TEAM are still subject to assignment.
 *   5. Assigned workers with WRITE_JOB_NOTES are granted access.
 *   6. The DELETE author guard allows authors to delete their own notes.
 *   7. The DELETE author guard blocks workers from deleting another worker's note.
 *   8. True admins can delete any note regardless of authorship.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mockStorage = vi.hoisted(() => ({
  getJob: vi.fn(),
  getJobAssignments: vi.fn(),
  getJobNotes: vi.fn(),
  deleteJobNote: vi.fn(),
  createJobNote: vi.fn(),
  createActivityLog: vi.fn(),
  getUser: vi.fn(),
}));

// ── Module mocks ──────────────────────────────────────────────────────────────

// Mock storage so isUserAssignedToJob (which calls storage.getJob / getJobAssignments)
// can be controlled per-test without touching the real permissions logic.
vi.mock("../storage", () => ({ storage: mockStorage }));

vi.mock("../routes/middleware", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    const uid = req.headers["x-user-id"];
    if (!uid) return res.status(401).json({ error: "Unauthorized" });
    req.userId = uid;
    next();
  },
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import {
  canAccessJobMedia,
  requireJobMediaAccess,
  PERMISSIONS,
  type UserContext,
} from "../permissions";
import { requireAuth } from "../routes/middleware";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeContext(overrides: Partial<Record<string, any>> = {}): UserContext {
  return {
    userId: "user-1",
    effectiveUserId: "owner-1",
    isOwner: false,
    permissions: [PERMISSIONS.WRITE_JOB_NOTES],
    teamMemberId: undefined,
    ...overrides,
  } as unknown as UserContext;
}

function authHeader(userId = "user-1") {
  return { "x-user-id": userId };
}

/** Simulate a job record: exists but has no direct assignedTo. */
const FOUND_JOB = { id: "job-1", assignedTo: null };

/** Build an assignment record for the given user. */
function assignment(userId: string) {
  return { userId, teamMemberId: null, isActive: true };
}

/**
 * Tiny express app that exposes a DELETE /api/jobs/:jobId/notes/:noteId route
 * using the real requireJobMediaAccess plus the production author-guard logic.
 */
function buildDeleteApp(userContext: UserContext, existingNote: any) {
  const app = express();
  app.use(express.json());

  // Pre-inject the resolved userContext (mirrors production: requireJobMediaAccess
  // reuses req.userContext when already set rather than calling getUserContext).
  app.use((req: any, _res: any, next: any) => {
    req.userContext = userContext;
    next();
  });

  app.delete(
    "/api/jobs/:jobId/notes/:noteId",
    requireAuth,
    requireJobMediaAccess,
    async (req: any, res: any) => {
      const { noteId } = req.params;
      const ctx: UserContext = req.userContext;

      const note = existingNote?.id === noteId ? existingNote : null;
      if (!note) return res.status(404).json({ error: "Note not found" });

      // Mirror production: owners + true admins (VIEW_ALL + MANAGE_TEAM) bypass author gate.
      const isTrueAdmin =
        ctx.isOwner ||
        (ctx.permissions.includes(PERMISSIONS.VIEW_ALL) &&
          ctx.permissions.includes(PERMISSIONS.MANAGE_TEAM));

      if (!isTrueAdmin && note.createdBy !== ctx.userId) {
        return res.status(403).json({ error: "You can only delete your own notes" });
      }

      return res.json({ success: true });
    },
  );

  return app;
}

// ── canAccessJobMedia unit tests ──────────────────────────────────────────────

describe("canAccessJobMedia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: job exists, no assignments.
    mockStorage.getJob.mockResolvedValue(FOUND_JOB);
    mockStorage.getJobAssignments.mockResolvedValue([]);
  });

  it("grants owners unconditional access without a job lookup", async () => {
    const ctx = makeContext({ isOwner: true });
    expect(await canAccessJobMedia(ctx, "job-1")).toBe(true);
    // isOwner short-circuits before any DB call
    expect(mockStorage.getJob).not.toHaveBeenCalled();
  });

  it("grants true admins (VIEW_ALL + MANAGE_TEAM) without an assignment check", async () => {
    const ctx = makeContext({
      permissions: [PERMISSIONS.VIEW_ALL, PERMISSIONS.MANAGE_TEAM, PERMISSIONS.WRITE_JOB_NOTES],
    });
    expect(await canAccessJobMedia(ctx, "job-1")).toBe(true);
    expect(mockStorage.getJob).not.toHaveBeenCalled();
  });

  it("subjects a worker with only MANAGE_TEAM to the assignment check", async () => {
    // MANAGE_TEAM alone is not the true-admin threshold — VIEW_ALL is also required.
    const ctx = makeContext({ permissions: [PERMISSIONS.MANAGE_TEAM, PERMISSIONS.WRITE_JOB_NOTES] });
    mockStorage.getJobAssignments.mockResolvedValue([]); // not assigned
    expect(await canAccessJobMedia(ctx, "job-1")).toBe(false);
    expect(mockStorage.getJob).toHaveBeenCalled();
  });

  it("denies an unassigned worker who has WRITE_JOB_NOTES permission", async () => {
    const ctx = makeContext({ permissions: [PERMISSIONS.WRITE_JOB_NOTES] });
    // getJob returns the job (job found), but getJobAssignments returns [] (not assigned).
    expect(await canAccessJobMedia(ctx, "job-1")).toBe(false);
  });

  it("grants an assigned worker with WRITE_JOB_NOTES permission", async () => {
    const ctx = makeContext({ userId: "worker-1", permissions: [PERMISSIONS.WRITE_JOB_NOTES] });
    mockStorage.getJobAssignments.mockResolvedValue([assignment("worker-1")]);
    expect(await canAccessJobMedia(ctx, "job-1")).toBe(true);
  });

  it("denies a user with no media permission even if assigned", async () => {
    const ctx = makeContext({ permissions: [] }); // empty — no WRITE_JOB_NOTES or WRITE_JOB_MEDIA
    // Short-circuits before hitting DB.
    expect(await canAccessJobMedia(ctx, "job-1")).toBe(false);
    expect(mockStorage.getJob).not.toHaveBeenCalled();
  });
});

// ── PATCH route authorization ─────────────────────────────────────────────────

function buildPatchApp(userContext: UserContext, existingNote: any) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.userContext = userContext;
    next();
  });
  app.patch(
    "/api/jobs/:jobId/notes/:noteId",
    requireAuth,
    requireJobMediaAccess,
    async (req: any, res: any) => {
      const { noteId } = req.params;
      const ctx: UserContext = req.userContext;
      const note = existingNote?.id === noteId ? existingNote : null;
      if (!note) return res.status(404).json({ error: "Note not found" });
      const isTrueAdmin =
        ctx.isOwner ||
        (ctx.permissions.includes(PERMISSIONS.VIEW_ALL) &&
          ctx.permissions.includes(PERMISSIONS.MANAGE_TEAM));
      if (!isTrueAdmin && note.createdBy !== ctx.userId) {
        return res.status(403).json({ error: "You can only edit your own notes" });
      }
      return res.json({ ...note, content: req.body.content ?? note.content });
    },
  );
  return app;
}

describe("PATCH /api/jobs/:jobId/notes/:noteId", () => {
  const JOB_ID = "job-1";
  const NOTE_ID = "note-1";
  const AUTHOR = "worker-author";
  const OTHER = "worker-other";
  const existingNote = {
    id: NOTE_ID, jobId: JOB_ID, userId: "owner-1",
    createdBy: AUTHOR, content: "Original", createdAt: new Date().toISOString(),
  };

  beforeEach(() => { vi.clearAllMocks(); mockStorage.getJob.mockResolvedValue(FOUND_JOB); });

  it("returns 403 for unassigned worker trying to patch", async () => {
    const ctx = makeContext({ userId: AUTHOR, permissions: [PERMISSIONS.WRITE_JOB_NOTES] });
    mockStorage.getJobAssignments.mockResolvedValue([]);
    const res = await request(buildPatchApp(ctx, existingNote))
      .patch(`/api/jobs/${JOB_ID}/notes/${NOTE_ID}`)
      .set(authHeader(AUTHOR)).send({ content: "New" });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not assigned/i);
  });

  it("allows the author to edit their own note", async () => {
    const ctx = makeContext({ userId: AUTHOR, permissions: [PERMISSIONS.WRITE_JOB_NOTES] });
    mockStorage.getJobAssignments.mockResolvedValue([assignment(AUTHOR)]);
    const res = await request(buildPatchApp(ctx, existingNote))
      .patch(`/api/jobs/${JOB_ID}/notes/${NOTE_ID}`)
      .set(authHeader(AUTHOR)).send({ content: "Updated" });
    expect(res.status).toBe(200);
    expect(res.body.content).toBe("Updated");
  });

  it("returns 403 when assigned worker tries to edit another worker's note", async () => {
    const ctx = makeContext({ userId: OTHER, permissions: [PERMISSIONS.WRITE_JOB_NOTES] });
    mockStorage.getJobAssignments.mockResolvedValue([assignment(OTHER)]);
    const res = await request(buildPatchApp(ctx, existingNote))
      .patch(`/api/jobs/${JOB_ID}/notes/${NOTE_ID}`)
      .set(authHeader(OTHER)).send({ content: "Hijacked" });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/your own/i);
  });

  it("allows a true admin to edit any note", async () => {
    const ctx = makeContext({
      userId: "admin-1",
      permissions: [PERMISSIONS.VIEW_ALL, PERMISSIONS.MANAGE_TEAM, PERMISSIONS.WRITE_JOB_NOTES],
    });
    mockStorage.getJobAssignments.mockResolvedValue([]);
    const res = await request(buildPatchApp(ctx, existingNote))
      .patch(`/api/jobs/${JOB_ID}/notes/${NOTE_ID}`)
      .set(authHeader("admin-1")).send({ content: "Admin edit" });
    expect(res.status).toBe(200);
  });
});

// ── DELETE route authorization ────────────────────────────────────────────────

describe("DELETE /api/jobs/:jobId/notes/:noteId", () => {
  const JOB_ID = "job-1";
  const NOTE_ID = "note-1";
  const AUTHOR = "worker-author";
  const OTHER = "worker-other";

  const existingNote = {
    id: NOTE_ID,
    jobId: JOB_ID,
    userId: "owner-1",
    createdBy: AUTHOR,
    content: "Gate code is 1234",
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getJob.mockResolvedValue(FOUND_JOB);
  });

  it("returns 403 when an unassigned worker accesses the route", async () => {
    const ctx = makeContext({ userId: OTHER, permissions: [PERMISSIONS.WRITE_JOB_NOTES] });
    mockStorage.getJobAssignments.mockResolvedValue([]); // not assigned

    const res = await request(buildDeleteApp(ctx, existingNote))
      .delete(`/api/jobs/${JOB_ID}/notes/${NOTE_ID}`)
      .set(authHeader(OTHER));

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not assigned/i);
  });

  it("allows the note's author to delete their own note when assigned", async () => {
    const ctx = makeContext({ userId: AUTHOR, permissions: [PERMISSIONS.WRITE_JOB_NOTES] });
    mockStorage.getJobAssignments.mockResolvedValue([assignment(AUTHOR)]);

    const res = await request(buildDeleteApp(ctx, existingNote))
      .delete(`/api/jobs/${JOB_ID}/notes/${NOTE_ID}`)
      .set(authHeader(AUTHOR));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("returns 403 when an assigned worker tries to delete another worker's note", async () => {
    const ctx = makeContext({ userId: OTHER, permissions: [PERMISSIONS.WRITE_JOB_NOTES] });
    mockStorage.getJobAssignments.mockResolvedValue([assignment(OTHER)]); // assigned but not author

    const res = await request(buildDeleteApp(ctx, existingNote))
      .delete(`/api/jobs/${JOB_ID}/notes/${NOTE_ID}`)
      .set(authHeader(OTHER));

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/your own/i);
  });

  it("allows a true admin (VIEW_ALL + MANAGE_TEAM) to delete any note", async () => {
    const ctx = makeContext({
      userId: "admin-1",
      permissions: [PERMISSIONS.VIEW_ALL, PERMISSIONS.MANAGE_TEAM, PERMISSIONS.WRITE_JOB_NOTES],
    });
    // Not assigned — true-admin bypass skips the assignment check entirely.
    mockStorage.getJobAssignments.mockResolvedValue([]);

    const res = await request(buildDeleteApp(ctx, existingNote))
      .delete(`/api/jobs/${JOB_ID}/notes/${NOTE_ID}`)
      .set(authHeader("admin-1"));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("allows an owner to delete any note", async () => {
    const ctx = makeContext({ userId: "owner-1", isOwner: true, permissions: [] });

    const res = await request(buildDeleteApp(ctx, existingNote))
      .delete(`/api/jobs/${JOB_ID}/notes/${NOTE_ID}`)
      .set(authHeader("owner-1"));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
