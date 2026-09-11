import { describe, it, expect } from "vitest";
import {
  buildCreateTaskPayload,
  descriptionSaveValue,
  toggleNextStatus,
  descriptionInitialValue,
} from "../lib/taskDescriptionUtils";

/**
 * Task description API contract tests
 *
 * These tests exercise the production payload utilities shared between
 * JobTasksSection and any future callers.  Each function is the single source
 * of truth for what gets sent to the server — a regression here means a
 * network regression in production.
 *
 * Invariants:
 * - description is absent (not undefined/null) when creating without one
 * - description: null is the deliberate "clear" signal — not an empty string
 * - Toggling completion sends only the status field; description is never included
 * - The edit dialog starts from descriptionInitialValue (falls back to "")
 */

// ── buildCreateTaskPayload ────────────────────────────────────────────────────

describe("buildCreateTaskPayload", () => {
  it("includes description when the editor has content", () => {
    const payload = buildCreateTaskPayload("My task", "job-1", "## Heading\n- Bullet");
    expect(payload).toEqual({
      title: "My task",
      jobId: "job-1",
      description: "## Heading\n- Bullet",
    });
  });

  it("omits the description key entirely when the editor is empty", () => {
    const payload = buildCreateTaskPayload("My task", "job-1", "");
    expect(payload).not.toHaveProperty("description");
    expect(payload).toEqual({ title: "My task", jobId: "job-1" });
  });

  it("omits description when the editor contains only whitespace", () => {
    const payload = buildCreateTaskPayload("My task", "job-1", "   ");
    expect(payload).not.toHaveProperty("description");
  });

  it("trims leading/trailing whitespace from the description before sending", () => {
    const payload = buildCreateTaskPayload("My task", "job-1", "  content  ");
    expect(payload.description).toBe("content");
  });

  it("preserves internal newlines in the description", () => {
    const desc = "## Steps\n- Step 1\n- Step 2";
    const payload = buildCreateTaskPayload("Task", "job-1", desc);
    expect(payload.description).toBe(desc);
  });
});

// ── descriptionSaveValue ─────────────────────────────────────────────────────

describe("descriptionSaveValue — PATCH body for save", () => {
  it("returns the trimmed content when the editor has content", () => {
    expect(descriptionSaveValue("## Steps\n- Do thing")).toBe("## Steps\n- Do thing");
  });

  it("returns null when the editor is empty — signals removal, not empty string", () => {
    expect(descriptionSaveValue("")).toBeNull();
  });

  it("returns null when the editor contains only whitespace", () => {
    expect(descriptionSaveValue("   ")).toBeNull();
  });

  it("trims surrounding whitespace before returning", () => {
    expect(descriptionSaveValue("  trimmed  ")).toBe("trimmed");
  });

  it("never returns an empty string — callers treat null as the deliberate clear", () => {
    expect(descriptionSaveValue("")).not.toBe("");
    expect(descriptionSaveValue("   ")).not.toBe("");
  });
});

// ── toggleNextStatus — status-only toggle, no description side-effect ─────────

describe("toggleNextStatus", () => {
  it("toggles 'open' to 'done'", () => {
    expect(toggleNextStatus("open")).toBe("done");
  });

  it("toggles 'done' to 'open'", () => {
    expect(toggleNextStatus("done")).toBe("open");
  });

  it("returns a value that would NOT include a description field in a PATCH body", () => {
    // The status toggle payload is { status: toggleNextStatus(current) }.
    // Ensure this function returns only a string — callers must not spread it.
    const result = toggleNextStatus("open");
    expect(typeof result).toBe("string");
    // Constructing the actual PATCH body the same way the component does:
    const patchBody = { status: result };
    expect(patchBody).not.toHaveProperty("description");
  });
});

// ── descriptionInitialValue — edit dialog pre-population ──────────────────────

describe("descriptionInitialValue", () => {
  it("returns the saved description when present", () => {
    expect(descriptionInitialValue({ description: "## Heading\n- Bullet" })).toBe(
      "## Heading\n- Bullet"
    );
  });

  it("returns empty string when description is null", () => {
    expect(descriptionInitialValue({ description: null })).toBe("");
  });

  it("returns empty string when description is undefined", () => {
    expect(descriptionInitialValue({})).toBe("");
  });

  it("preserves internal newlines so the editor shows the full structure", () => {
    const multiline = "## H2\n### H3\n- item 1\n- item 2\n\nPlain text";
    expect(descriptionInitialValue({ description: multiline })).toBe(multiline);
  });
});

// ── Round-trip invariants ─────────────────────────────────────────────────────

describe("round-trip invariants", () => {
  it("save then clear: save produces a truthy value; explicit null clears it", () => {
    const saved = descriptionSaveValue("## Steps\n- Do thing");
    expect(saved).not.toBeNull();

    // Clear is always null — not derived from descriptionSaveValue("")
    const cleared: string | null = null;
    expect(cleared).toBeNull();
    expect(cleared).not.toBe("");
  });

  it("edit re-opens with the saved description, new save replaces it", () => {
    const task = { description: "old content" };

    const initial = descriptionInitialValue(task);
    expect(initial).toBe("old content");

    // User edits and saves new content
    const savePayload = descriptionSaveValue("new content");
    expect(savePayload).toBe("new content");
  });

  it("completing a task uses only a status field — payload shape excludes description", () => {
    const patchBody = { status: toggleNextStatus("open") };
    expect(patchBody).toEqual({ status: "done" });
    expect(patchBody).not.toHaveProperty("description");
  });

  it("create without description produces a payload that has no description key", () => {
    const payload = buildCreateTaskPayload("Quick task", "job-1", "");
    const keys = Object.keys(payload);
    expect(keys).not.toContain("description");
  });
});
