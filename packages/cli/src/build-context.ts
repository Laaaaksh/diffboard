import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

export interface BuildContext {
  branch: string;
  commitSha: string;
  prNumber: number | null;
  /** "owner/repo", present only inside GitHub Actions. */
  repoSlug: string | null;
  /** The ephemeral Actions token, present only inside GitHub Actions. */
  githubToken: string | null;
}

function git(cmd: string): string | null {
  try {
    return execSync(`git ${cmd}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Resolves branch/commit/PR from the GitHub Actions environment when
 * present, falling back to local `git` for a developer running the CLI on
 * their own machine.
 */
export function resolveBuildContext(): BuildContext {
  if (process.env.GITHUB_ACTIONS === "true") {
    return resolveFromGithubActions();
  }

  return {
    branch: git("rev-parse --abbrev-ref HEAD") ?? "unknown",
    commitSha: git("rev-parse HEAD") ?? "unknown",
    prNumber: null,
    repoSlug: null,
    githubToken: null,
  };
}

function resolveFromGithubActions(): BuildContext {
  const repoSlug = process.env.GITHUB_REPOSITORY ?? null;
  const githubToken = process.env.GITHUB_TOKEN ?? null;
  const eventName = process.env.GITHUB_EVENT_NAME;

  if (eventName === "pull_request" || eventName === "pull_request_target") {
    const event = readEvent();
    const pr = event?.pull_request as
      | { number: number; head: { ref: string; sha: string } }
      | undefined;

    return {
      branch: pr?.head.ref ?? process.env.GITHUB_HEAD_REF ?? "unknown",
      commitSha: pr?.head.sha ?? process.env.GITHUB_SHA ?? "unknown",
      prNumber: pr?.number ?? null,
      repoSlug,
      githubToken,
    };
  }

  return {
    branch: process.env.GITHUB_REF_NAME ?? "unknown",
    commitSha: process.env.GITHUB_SHA ?? "unknown",
    prNumber: null,
    repoSlug,
    githubToken,
  };
}

function readEvent(): Record<string, unknown> | null {
  const path = process.env.GITHUB_EVENT_PATH;
  if (!path) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}
