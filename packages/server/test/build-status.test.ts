import { describe, expect, it } from "vitest";
import { computeBuildStatus } from "../src/lib/build-status";

describe("computeBuildStatus", () => {
  it("passes an empty build", () => {
    expect(computeBuildStatus([])).toBe("PASSED");
  });

  it("passes when every snapshot is unchanged", () => {
    expect(computeBuildStatus([{ status: "UNCHANGED" }, { status: "UNCHANGED" }])).toBe("PASSED");
  });

  it("needs review while any snapshot is NEW or CHANGED, regardless of other outcomes", () => {
    expect(computeBuildStatus([{ status: "NEW" }, { status: "APPROVED" }])).toBe("NEEDS_REVIEW");
    expect(computeBuildStatus([{ status: "CHANGED" }, { status: "REJECTED" }])).toBe(
      "NEEDS_REVIEW",
    );
  });

  it("is approved once every changed snapshot has been approved", () => {
    expect(computeBuildStatus([{ status: "APPROVED" }, { status: "UNCHANGED" }])).toBe("APPROVED");
  });

  it("is rejected if nothing is pending but at least one snapshot was rejected", () => {
    expect(computeBuildStatus([{ status: "REJECTED" }, { status: "UNCHANGED" }])).toBe("REJECTED");
  });
});
