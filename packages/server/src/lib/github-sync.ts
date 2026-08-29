import type { Project } from "@prisma/client";
import { setCommitStatus, type CommitState } from "@diffboard/core";

/**
 * Flips the GitHub commit status when a human approves/rejects from the
 * dashboard, outside of CI. Requires the project to have its own persistent
 * PAT configured (repoSlug + githubToken) - the Actions-provided GITHUB_TOKEN
 * the CLI used for the *initial* status is ephemeral and gone by the time a
 * reviewer clicks Approve. No-ops silently when not configured, since GitHub
 * sync is optional.
 */
export async function syncCommitStatusIfConfigured(
  project: Project,
  params: { sha: string; state: CommitState; description: string; targetUrl: string },
): Promise<void> {
  if (!project.repoSlug || !project.githubToken) return;

  await setCommitStatus(
    { repoSlug: project.repoSlug, token: project.githubToken },
    { ...params, context: "diffboard" },
  );
}
