import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db";
import { mockApi, createTestUser, resetDb, jsonBody, TINY_PNG_BASE64 } from "./helpers";

import projectsHandler from "../pages/api/projects/index";
import buildsHandler from "../pages/api/builds/index";
import buildDetailHandler from "../pages/api/builds/[id]/index";
import snapshotsHandler from "../pages/api/builds/[id]/snapshots";
import finalizeHandler from "../pages/api/builds/[id]/finalize";
import baselineHandler from "../pages/api/baseline";
import approveHandler from "../pages/api/snapshots/[id]/approve";
import rejectHandler from "../pages/api/snapshots/[id]/reject";

beforeEach(resetDb);
afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

async function createProject(sessionCookie: string, name = "acme-site") {
  const { req, res } = mockApi({ method: "POST", body: { name }, sessionCookie });
  await projectsHandler(req, res);
  expect(res._getStatusCode()).toBe(201);
  return res._getJSONData() as { id: string; token: string; slug: string };
}

async function createBuild(token: string, overrides: Partial<Record<string, unknown>> = {}) {
  const { req, res } = mockApi({
    method: "POST",
    token,
    body: {
      branch: "feature-x",
      baseBranch: "main",
      commitSha: "abc1234",
      prNumber: 7,
      ...overrides,
    },
  });
  await buildsHandler(req, res);
  expect(res._getStatusCode()).toBe(201);
  return res._getJSONData() as { id: string };
}

describe("full build → review → baseline lifecycle", () => {
  it("rejects requests without a project token", async () => {
    const { req, res } = mockApi({
      method: "POST",
      body: { branch: "x", baseBranch: "main", commitSha: "a" },
    });
    await buildsHandler(req, res);
    expect(res._getStatusCode()).toBe(401);
  });

  it("rejects requests with an invalid project token", async () => {
    const { req, res } = mockApi({
      method: "POST",
      token: "dbrd_not_a_real_token",
      body: { branch: "x", baseBranch: "main", commitSha: "a" },
    });
    await buildsHandler(req, res);
    expect(res._getStatusCode()).toBe(401);
  });

  it("rejects dashboard routes without a session", async () => {
    const { req, res } = mockApi({ method: "GET", query: { projectId: "whatever" } });
    await buildsHandler(req, res);
    expect(res._getStatusCode()).toBe(401);
  });

  it("takes a new project's first build through NEW → review → approved baseline", async () => {
    const { sessionCookie } = await createTestUser();
    const project = await createProject(sessionCookie);
    const build = await createBuild(project.token);

    // No baseline exists yet for a brand-new project.
    const baselineMiss = mockApi({
      method: "GET",
      token: project.token,
      query: { branch: "main", name: "home", viewport: "desktop" },
    });
    await baselineHandler(baselineMiss.req, baselineMiss.res);
    expect(baselineMiss.res._getStatusCode()).toBe(404);

    // Upload a NEW snapshot (as the CLI would after finding no baseline).
    const upload = mockApi({
      method: "POST",
      token: project.token,
      query: { id: build.id },
      body: {
        name: "home",
        viewport: "desktop",
        status: "NEW",
        imageBase64: TINY_PNG_BASE64,
      },
    });
    await snapshotsHandler(upload.req, upload.res);
    expect(upload.res._getStatusCode()).toBe(201);
    const snapshotId = (upload.res._getJSONData() as { id: string }).id;

    // Finalizing a build with only a NEW snapshot must block on review, not
    // silently pass - there's no baseline yet to have approved anything against.
    const finalize = mockApi({ method: "POST", token: project.token, query: { id: build.id } });
    await finalizeHandler(finalize.req, finalize.res);
    expect(finalize.res._getStatusCode()).toBe(200);
    const finalizeBody = jsonBody<{
      status: string;
      summary: { total: number; new: number; changed: number; unchanged: number };
    }>(finalize.res);
    expect(finalizeBody.status).toBe("NEEDS_REVIEW");
    expect(finalizeBody.summary).toEqual({ total: 1, new: 1, changed: 0, unchanged: 0 });

    // A reviewer approves it from the dashboard.
    const approve = mockApi({ method: "POST", sessionCookie, query: { id: snapshotId } });
    await approveHandler(approve.req, approve.res);
    expect(approve.res._getStatusCode()).toBe(200);
    expect(jsonBody<{ status: string }>(approve.res).status).toBe("APPROVED");

    // The build's overall status follows the snapshot to APPROVED.
    const detail = mockApi({ method: "GET", sessionCookie, query: { id: build.id } });
    await buildDetailHandler(detail.req, detail.res);
    expect(jsonBody<{ build: { status: string } }>(detail.res).build.status).toBe("APPROVED");

    // Approving created a baseline for the build's baseBranch, not its own branch.
    const baselineHit = mockApi({
      method: "GET",
      token: project.token,
      query: { branch: "main", name: "home", viewport: "desktop" },
    });
    await baselineHandler(baselineHit.req, baselineHit.res);
    expect(baselineHit.res._getStatusCode()).toBe(200);
    expect(jsonBody<{ imageBase64: string }>(baselineHit.res).imageBase64).toBe(TINY_PNG_BASE64);

    const baselineOnFeatureBranch = mockApi({
      method: "GET",
      token: project.token,
      query: { branch: "feature-x", name: "home", viewport: "desktop" },
    });
    await baselineHandler(baselineOnFeatureBranch.req, baselineOnFeatureBranch.res);
    expect(baselineOnFeatureBranch.res._getStatusCode()).toBe(404);
  });

  it("blocks a build on a rejected snapshot and never touches the baseline", async () => {
    const { sessionCookie } = await createTestUser();
    const project = await createProject(sessionCookie, "rejects-site");
    const build = await createBuild(project.token);

    const upload = mockApi({
      method: "POST",
      token: project.token,
      query: { id: build.id },
      body: { name: "home", viewport: "desktop", status: "CHANGED", imageBase64: TINY_PNG_BASE64, diffPercent: 5.2 },
    });
    await snapshotsHandler(upload.req, upload.res);
    const snapshotId = (upload.res._getJSONData() as { id: string }).id;

    const reject = mockApi({ method: "POST", sessionCookie, query: { id: snapshotId } });
    await rejectHandler(reject.req, reject.res);
    expect(jsonBody<{ status: string }>(reject.res).status).toBe("REJECTED");

    const detail = mockApi({ method: "GET", sessionCookie, query: { id: build.id } });
    await buildDetailHandler(detail.req, detail.res);
    expect(jsonBody<{ build: { status: string } }>(detail.res).build.status).toBe("REJECTED");

    const baseline = mockApi({
      method: "GET",
      token: project.token,
      query: { branch: "main", name: "home", viewport: "desktop" },
    });
    await baselineHandler(baseline.req, baseline.res);
    expect(baseline.res._getStatusCode()).toBe(404);
  });

  it("keeps two projects' baselines and tokens fully isolated", async () => {
    const { sessionCookie } = await createTestUser();
    const projectA = await createProject(sessionCookie, "site-a");
    const projectB = await createProject(sessionCookie, "site-b");

    expect(projectA.token).not.toBe(projectB.token);

    // Project B's token cannot see or act on project A's build.
    const buildA = await createBuild(projectA.token);
    const crossAccess = mockApi({
      method: "POST",
      token: projectB.token,
      query: { id: buildA.id },
      body: { name: "home", viewport: "desktop", status: "NEW", imageBase64: TINY_PNG_BASE64 },
    });
    await snapshotsHandler(crossAccess.req, crossAccess.res);
    expect(crossAccess.res._getStatusCode()).toBe(404);
  });
});
