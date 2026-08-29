import Link from "next/link";
import type { GetServerSideProps } from "next";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Topbar } from "@/components/Topbar";

interface BuildRow {
  id: string;
  branch: string;
  baseBranch: string;
  commitSha: string;
  prNumber: number | null;
  status: string;
  createdAt: string;
  snapshotCount: number;
}

interface Props {
  project: { id: string; name: string; slug: string; repoSlug: string | null };
  builds: BuildRow[];
}

export const getServerSideProps: GetServerSideProps<Props> = async ({ req, params }) => {
  const userId = await getSessionUserId(req as never);
  if (!userId) return { redirect: { destination: "/login", permanent: false } };

  const slug = params?.slug as string;
  const project = await prisma.project.findUnique({ where: { slug } });
  if (!project) return { notFound: true };

  const builds = await prisma.build.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { _count: { select: { snapshots: true } } },
  });

  return {
    props: {
      project: {
        id: project.id,
        name: project.name,
        slug: project.slug,
        repoSlug: project.repoSlug,
      },
      builds: builds.map((b) => ({
        id: b.id,
        branch: b.branch,
        baseBranch: b.baseBranch,
        commitSha: b.commitSha,
        prNumber: b.prNumber,
        status: b.status,
        createdAt: b.createdAt.toISOString(),
        snapshotCount: b._count.snapshots,
      })),
    },
  };
};

export default function ProjectPage({ project, builds }: Props) {
  return (
    <>
      <Topbar />
      <div className="container">
        <div style={{ marginBottom: 24 }}>
          <p className="muted">
            <Link href="/">Projects</Link> / {project.name}
          </p>
          <h1>{project.name}</h1>
          {project.repoSlug && <p className="muted">{project.repoSlug}</p>}
        </div>

        {builds.length === 0 ? (
          <div className="card muted">
            No builds yet. Run <code>diffboard test</code> in CI against this project&apos;s
            token to see them here.
          </div>
        ) : (
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Branch</th>
                  <th>Commit</th>
                  <th>PR</th>
                  <th>Screenshots</th>
                  <th>Status</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {builds.map((b) => (
                  <tr
                    key={b.id}
                    className="clickable"
                    onClick={() => (window.location.href = `/builds/${b.id}`)}
                  >
                    <td>{b.branch}</td>
                    <td className="muted">{b.commitSha.slice(0, 7)}</td>
                    <td className="muted">{b.prNumber ? `#${b.prNumber}` : "—"}</td>
                    <td className="muted">{b.snapshotCount}</td>
                    <td>
                      <span className={`badge ${b.status}`}>{b.status.replace("_", " ")}</span>
                    </td>
                    <td className="muted">{new Date(b.createdAt).toLocaleString()}</td>
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
