import type { SnapshotStatus, BuildStatus } from "@diffboard/core";

/** Derives a build's overall status from its snapshots' individual statuses. */
export function computeBuildStatus(snapshots: Array<{ status: SnapshotStatus }>): BuildStatus {
  if (snapshots.length === 0) return "PASSED";

  const unresolved = snapshots.some((s) => s.status === "NEW" || s.status === "CHANGED");
  if (unresolved) return "NEEDS_REVIEW";

  const anyRejected = snapshots.some((s) => s.status === "REJECTED");
  if (anyRejected) return "REJECTED";

  const anyApproved = snapshots.some((s) => s.status === "APPROVED");
  return anyApproved ? "APPROVED" : "PASSED";
}
