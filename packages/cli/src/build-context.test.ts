import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveBuildContext } from "./build-context.js";

const ENV_KEYS = [
  "GITHUB_ACTIONS",
  "GITHUB_EVENT_NAME",
  "GITHUB_EVENT_PATH",
  "GITHUB_REPOSITORY",
  "GITHUB_TOKEN",
  "GITHUB_REF_NAME",
  "GITHUB_HEAD_REF",
  "GITHUB_SHA",
] as const;

const saved: Record<string, string | undefined> = {};
const dirs: string[] = [];

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function setEnv(vars: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  for (const key of ENV_KEYS) {
    if (!(key in saved)) saved[key] = process.env[key];
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(vars)) {
    process.env[key] = value;
  }
}

describe("resolveBuildContext", () => {
  it("falls back to local git outside of GitHub Actions", () => {
    setEnv({});
    const ctx = resolveBuildContext();
    expect(ctx.repoSlug).toBeNull();
    expect(ctx.githubToken).toBeNull();
    expect(ctx.prNumber).toBeNull();
    // We're running inside the diffboard git repo, so these resolve for real.
    expect(ctx.branch).not.toBe("unknown");
    expect(ctx.commitSha).toMatch(/^[0-9a-f]{40}$/);
  });

  it("reads branch/sha/repo from a push-event Actions environment", () => {
    setEnv({
      GITHUB_ACTIONS: "true",
      GITHUB_EVENT_NAME: "push",
      GITHUB_REPOSITORY: "acme/site",
      GITHUB_TOKEN: "ghs_token",
      GITHUB_REF_NAME: "main",
      GITHUB_SHA: "deadbeef",
    });
    const ctx = resolveBuildContext();
    expect(ctx).toEqual({
      branch: "main",
      commitSha: "deadbeef",
      prNumber: null,
      repoSlug: "acme/site",
      githubToken: "ghs_token",
    });
  });

  it("reads the PR's head branch/sha/number from a pull_request event payload", () => {
    const dir = mkdtempSync(join(tmpdir(), "diffboard-event-test-"));
    dirs.push(dir);
    const eventPath = join(dir, "event.json");
    writeFileSync(
      eventPath,
      JSON.stringify({
        number: 42,
        pull_request: { number: 42, head: { ref: "feature-x", sha: "cafef00d" } },
      }),
    );

    setEnv({
      GITHUB_ACTIONS: "true",
      GITHUB_EVENT_NAME: "pull_request",
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_REPOSITORY: "acme/site",
      GITHUB_TOKEN: "ghs_token",
    });

    const ctx = resolveBuildContext();
    expect(ctx).toEqual({
      branch: "feature-x",
      commitSha: "cafef00d",
      prNumber: 42,
      repoSlug: "acme/site",
      githubToken: "ghs_token",
    });
  });
});
