import { describe, expect, it } from "vitest";
import {
  allocateExpensesByPhase,
  assertExpensePhaseAssignment,
  ExpensePhaseValidationError,
} from "../phaseExpenseAttribution";

describe("phase expense attribution", () => {
  it("counts a phase-tagged expense once in its matching phase", () => {
    const result = allocateExpensesByPhase(
      [{ phaseId: "phase-a", amount: "37.50" }],
      ["phase-a", "phase-b"],
    );

    expect(result.byPhaseId.get("phase-a")).toBe(37.5);
    expect(result.byPhaseId.get("phase-b")).toBeUndefined();
    expect(result.unallocated).toBe(0);
  });

  it("puts an untagged or unknown-phase expense in Unallocated", () => {
    const result = allocateExpensesByPhase(
      [
        { amount: "19.25" },
        { phaseId: "deleted-phase", amount: "4.75" },
      ],
      ["phase-a"],
    );

    expect(result.byPhaseId.size).toBe(0);
    expect(result.unallocated).toBe(24);
  });

  it("rejects a phase from a different job", async () => {
    const storage = {
      getJob: async () => ({ id: "job-a" }),
      getJobPhases: async () => [{ id: "phase-a" }],
    };

    await expect(
      assertExpensePhaseAssignment(storage, "business-a", "job-a", "phase-b"),
    ).rejects.toMatchObject<Partial<ExpensePhaseValidationError>>({
      status: 400,
      message: "The selected phase does not belong to this job",
    });
  });
});