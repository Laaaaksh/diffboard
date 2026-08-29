import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import type { GetServerSideProps } from "next";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Topbar } from "@/components/Topbar";
import { DiffViewer } from "@/components/DiffViewer";

interface SnapshotDTO {
  id: string;
  name: string;
  viewport: string;
  status: string;
  diffPercent: number | null;
  imageKey: string;
  baselineKey: string | null;
  diffKey: string | null;
}

interface Props {
  build: {
    id: string;
    branch: string;
    baseBranch: string;
    commitSha: string;
    prNumber: number | null;
    status: string;
    createdAt: string;
  };
  project: { name: string; slug: string; repoSlug: string | null };
  snapshots: SnapshotDTO[];
}

export const getServerSideProps: GetServerSideProps<Props> = async ({ req, params }) => {
  const userId = await getSessionUserId(req as never);
  if (!userId) return { redirect: { destination: "/login", permanent: false } };

  const build = await prisma.build.findUnique({
    where: { id: params?.id as string },
    include: { project: true, snapshots: { orderBy: { name: "asc" } } },
  });
  if (!build) return { notFound: true };

  return {
    props: {
      build: {
        id: build.id,
        branch: build.branch,
        baseBranch: build.baseBranch,
        commitSha: build.commitSha,
        prNumber: build.prNumber,
        status: build.status,
        createdAt: build.createdAt.toISOString(),
      },
      project: {
        name: build.project.name,
        slug: build.project.slug,
        repoSlug: build.project.repoSlug,
      },
      snapshots: build.snapshots.map((s) => ({
        id: s.id,
        name: s.name,
        viewport: s.viewport,
        status: s.status,
        diffPercent: s.diffPercent,
        imageKey: s.imageKey,
        baselineKey: s.baselineKey,
        diffKey: s.diffKey,
      })),
    },
  };
};

const SHORT_STATUS: Record<string, string> = {
  NEW: "new",
  CHANGED: "diff",
  UNCHANGED: "ok",
  APPROVED: "✓",
  REJECTED: "✕",
};

function imgUrl(key: string) {
  return `/api/images/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export default function BuildPage({ build, project, snapshots: initial }: Props) {
  const router = useRouter();
  const [snapshots, setSnapshots] = useState(initial);
  const [selectedId, setSelectedId] = useState(
    initial.find((s) => s.status === "NEW" || s.status === "CHANGED")?.id ?? initial[0]?.id,
  );
  const [busy, setBusy] = useState(false);

  const selected = useMemo(
    () => snapshots.find((s) => s.id === selectedId) ?? null,
    [snapshots, selectedId],
  );

  const changed = snapshots.filter((s) => s.status === "NEW" || s.status === "CHANGED").length;
  const approved = snapshots.filter((s) => s.status === "APPROVED").length;
  const rejected = snapshots.filter((s) => s.status === "REJECTED").length;

  async function review(id: string, action: "approve" | "reject") {
    setBusy(true);
    const res = await fetch(`/api/snapshots/${id}/${action}`, { method: "POST" });
    setBusy(false);
    if (!res.ok) return;
    setSnapshots((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: action === "approve" ? "APPROVED" : "REJECTED" } : s,
      ),
    );
    router.replace(router.asPath, undefined, { scroll: false });
  }

  return (
    <>
      <Topbar />
      <div className="container">
        <div style={{ marginBottom: 20 }}>
          <p className="muted">
            <Link href="/">Projects</Link> / <Link href={`/projects/${project.slug}`}>{project.name}</Link>
          </p>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <h1>
                {build.branch} <span className="muted">→ {build.baseBranch}</span>
              </h1>
              <p className="muted">
                {build.commitSha.slice(0, 7)}
                {build.prNumber ? ` · PR #${build.prNumber}` : ""} ·{" "}
                {new Date(build.createdAt).toLocaleString()}
                {project.repoSlug && (
                  <>
                    {" · "}
                    <a
                      href={`https://github.com/${project.repoSlug}/commit/${build.commitSha}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      view commit
                    </a>
                  </>
                )}
              </p>
            </div>
            <span className={`badge ${build.status}`}>{build.status.replace("_", " ")}</span>
          </div>
          <p className="muted" style={{ marginTop: 8 }}>
            {snapshots.length} screenshots · {changed} awaiting review · {approved} approved ·{" "}
            {rejected} rejected
          </p>
        </div>

        <div className="grid" style={{ gridTemplateColumns: "280px 1fr" }}>
          <div className="stack snapshot-list">
            {snapshots.map((s) => (
              <div
                key={s.id}
                className={`snapshot-row ${s.id === selectedId ? "active" : ""}`}
                onClick={() => setSelectedId(s.id)}
              >
                <div className="row">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="thumb" src={imgUrl(s.imageKey)} alt="" />
                  <div>
                    <div>{s.name}</div>
                    <div className="muted">{s.viewport}</div>
                  </div>
                </div>
                <span className={`badge ${s.status}`}>{SHORT_STATUS[s.status] ?? s.status}</span>
              </div>
            ))}
          </div>

          <div className="card">
            {selected ? (
              <div className="stack">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div>
                    <h2 style={{ margin: 0 }}>{selected.name}</h2>
                    <p className="muted">
                      {selected.viewport}
                      {selected.diffPercent !== null &&
                        ` · ${selected.diffPercent.toFixed(2)}% pixels changed`}
                    </p>
                  </div>
                  <div className="row">
                    <span className={`badge ${selected.status}`}>{selected.status}</span>
                  </div>
                </div>

                <DiffViewer
                  beforeSrc={selected.baselineKey ? imgUrl(selected.baselineKey) : null}
                  afterSrc={imgUrl(selected.imageKey)}
                  diffSrc={selected.diffKey ? imgUrl(selected.diffKey) : null}
                />

                <div className="row">
                  <button
                    className="btn success"
                    disabled={busy || selected.status === "APPROVED"}
                    onClick={() => review(selected.id, "approve")}
                  >
                    Approve
                  </button>
                  <button
                    className="btn danger"
                    disabled={busy || selected.status === "REJECTED"}
                    onClick={() => review(selected.id, "reject")}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ) : (
              <p className="muted">No screenshots in this build.</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
