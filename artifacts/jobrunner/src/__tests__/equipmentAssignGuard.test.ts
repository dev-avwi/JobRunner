import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeEquipmentAssignHandler } from "../lib/equipmentAssignHandler";

// ---------------------------------------------------------------------------
// Tests for makeEquipmentAssignHandler (AdvancedDispatch.tsx)
//
// handleEquipmentAssignToJob in the component is built via this exported
// factory so that these tests exercise the real production guard, not a
// local duplicate.  Removing or weakening the `if (!selectedJobId) return`
// guard in the factory will fail the tests below.
// ---------------------------------------------------------------------------

describe("makeEquipmentAssignHandler — guard fires when job ID is missing", () => {
  let mutate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mutate = vi.fn();
  });

  it("does NOT call mutate when selectedJobId is null", () => {
    const handler = makeEquipmentAssignHandler(null, mutate);
    handler("equip-abc");
    expect(mutate).not.toHaveBeenCalled();
  });

  it("does NOT call mutate when selectedJobId is undefined", () => {
    const handler = makeEquipmentAssignHandler(undefined, mutate);
    handler("equip-abc");
    expect(mutate).not.toHaveBeenCalled();
  });

  it("does NOT call mutate when selectedJobId is an empty string", () => {
    const handler = makeEquipmentAssignHandler("", mutate);
    handler("equip-abc");
    expect(mutate).not.toHaveBeenCalled();
  });
});

describe("makeEquipmentAssignHandler — mutation called when job ID is present", () => {
  let mutate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mutate = vi.fn();
  });

  it("calls mutate with the correct equipmentId and jobId", () => {
    const handler = makeEquipmentAssignHandler("job-42", mutate);
    handler("equip-xyz");
    expect(mutate).toHaveBeenCalledOnce();
    expect(mutate).toHaveBeenCalledWith({ equipmentId: "equip-xyz", jobId: "job-42" });
  });

  it("calls mutate once per invocation, not multiple times", () => {
    const handler = makeEquipmentAssignHandler("job-99", mutate);
    handler("equip-1");
    handler("equip-2");
    expect(mutate).toHaveBeenCalledTimes(2);
    expect(mutate).toHaveBeenNthCalledWith(1, { equipmentId: "equip-1", jobId: "job-99" });
    expect(mutate).toHaveBeenNthCalledWith(2, { equipmentId: "equip-2", jobId: "job-99" });
  });
});
