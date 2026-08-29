const API = "https://api.github.com";

export interface GithubAuth {
  /** "owner/repo" */
  repoSlug: string;
  token: string;
}

export type CommitState = "pending" | "success" | "failure" | "error";

async function githubFetch(auth: GithubAuth, path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${auth.token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...init.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub API ${init.method ?? "GET"} ${path} failed: ${res.status} ${body}`);
  }
  return res;
}

export async function setCommitStatus(
  auth: GithubAuth,
  params: {
    sha: string;
    state: CommitState;
    description: string;
    targetUrl?: string;
    context?: string;
  },
): Promise<void> {
  await githubFetch(auth, `/repos/${auth.repoSlug}/statuses/${params.sha}`, {
    method: "POST",
    body: JSON.stringify({
      state: params.state,
      description: params.description.slice(0, 140),
      target_url: params.targetUrl,
      context: params.context ?? "diffboard",
    }),
  });
}

const COMMENT_MARKER = "<!-- diffboard:build-comment -->";

/**
 * Creates or updates the single diffboard comment on a PR, keyed by a hidden
 * marker, so repeated CI runs on the same PR edit one comment instead of
 * spamming a new one per push.
 */
export async function upsertPrComment(
  auth: GithubAuth,
  params: { prNumber: number; body: string },
): Promise<void> {
  const body = `${COMMENT_MARKER}\n${params.body}`;

  const listRes = await githubFetch(
    auth,
    `/repos/${auth.repoSlug}/issues/${params.prNumber}/comments?per_page=100`,
  );
  const comments = (await listRes.json()) as Array<{ id: number; body: string }>;
  const existing = comments.find((c) => c.body?.includes(COMMENT_MARKER));

  if (existing) {
    await githubFetch(auth, `/repos/${auth.repoSlug}/issues/comments/${existing.id}`, {
      method: "PATCH",
      body: JSON.stringify({ body }),
    });
  } else {
    await githubFetch(auth, `/repos/${auth.repoSlug}/issues/${params.prNumber}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
  }
}
