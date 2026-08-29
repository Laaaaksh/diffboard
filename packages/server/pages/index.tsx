import { useState } from "react";
import Link from "next/link";
import type { GetServerSideProps } from "next";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Topbar } from "@/components/Topbar";

interface ProjectRow {
  id: string;
  name: string;
  slug: string;
  repoSlug: string | null;
  buildCount: number;
}

export const getServerSideProps: GetServerSideProps<{ projects: ProjectRow[] }> = async ({
  req,
}) => {
  const userId = await getSessionUserId(req as never);
  if (!userId) return { redirect: { destination: "/login", permanent: false } };

  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { builds: true } } },
  });

  return {
    props: {
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        repoSlug: p.repoSlug,
        buildCount: p._count.builds,
      })),
    },
  };
};

export default function HomePage({ projects }: { projects: ProjectRow[] }) {
  const [showForm, setShowForm] = useState(projects.length === 0);
  const [name, setName] = useState("");
  const [repoSlug, setRepoSlug] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ name: string; token: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        repoSlug: repoSlug || undefined,
        githubToken: githubToken || undefined,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not create project");
      return;
    }
    const body = await res.json();
    setCreated({ name: body.name, token: body.token });
  }

  return (
    <>
      <Topbar />
      <div className="container">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1>Projects</h1>
            <p className="muted">Every project the CLI can push builds to.</p>
          </div>
          <button className="btn" onClick={() => setShowForm((s) => !s)}>
            + New project
          </button>
        </div>

        {showForm && (
          <div className="card" style={{ marginBottom: 24 }}>
            {created ? (
              <div className="stack">
                <h2>{created.name} created</h2>
                <p className="muted">
                  This is the only time the CLI token is shown. Store it as a secret (e.g.{" "}
                  <code>DIFFBOARD_TOKEN</code> in your CI) - it cannot be retrieved again.
                </p>
                <div className="token-box">{created.token}</div>
                <button
                  className="btn secondary"
                  onClick={() => {
                    setCreated(null);
                    setShowForm(false);
                    setName("");
                    setRepoSlug("");
                    setGithubToken("");
                    window.location.reload();
                  }}
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={createProject} className="stack">
                <h2>New project</h2>
                <div>
                  <label htmlFor="name">Name</label>
                  <input
                    id="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="marketing-site"
                  />
                </div>
                <div>
                  <label htmlFor="repoSlug">GitHub repo (optional)</label>
                  <input
                    id="repoSlug"
                    value={repoSlug}
                    onChange={(e) => setRepoSlug(e.target.value)}
                    placeholder="my-org/marketing-site"
                  />
                </div>
                <div>
                  <label htmlFor="githubToken">
                    GitHub PAT for approve-time status sync (optional)
                  </label>
                  <input
                    id="githubToken"
                    type="password"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    placeholder="github_pat_… with repo:status scope"
                  />
                  <p className="muted" style={{ marginTop: 4 }}>
                    Not required for CI to post the initial check - that uses your workflow&apos;s
                    own <code>GITHUB_TOKEN</code>. This PAT is only needed so approving a diff
                    from this dashboard (outside of CI) can flip the check back to green.
                  </p>
                </div>
                {error && <p className="error">{error}</p>}
                <div className="row">
                  <button className="btn" type="submit" disabled={loading}>
                    {loading ? "Creating…" : "Create project"}
                  </button>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {projects.length === 0 ? (
          <div className="card muted">No projects yet - create one to get a CLI token.</div>
        ) : (
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>GitHub repo</th>
                  <th>Builds</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr
                    key={p.id}
                    className="clickable"
                    onClick={() => (window.location.href = `/projects/${p.slug}`)}
                  >
                    <td>
                      <Link href={`/projects/${p.slug}`}>{p.name}</Link>
                    </td>
                    <td className="muted">{p.repoSlug ?? "—"}</td>
                    <td className="muted">{p.buildCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
