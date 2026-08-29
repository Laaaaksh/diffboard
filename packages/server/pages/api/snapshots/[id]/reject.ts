import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { computeBuildStatus } from "@/lib/build-status";
import { syncCommitStatusIfConfigured } from "@/lib/github-sync";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await requireSession(req, res);
  if (!userId) return;

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query;
  if (typeof id !== "string") return res.status(400).json({ error: "Invalid snapshot id" });

  const snapshot = await prisma.snapshot.findUnique({ where: { id }, include: { build: true } });
  if (!snapshot) return res.status(404).json({ error: "Snapshot not found" });

  await prisma.snapshot.update({
    where: { id },
    data: { status: "REJECTED", reviewedAt: new Date() },
  });

  const build = await prisma.build.findUniqueOrThrow({
    where: { id: snapshot.buildId },
    include: { snapshots: true, project: true },
  });
  const status = computeBuildStatus(build.snapshots);
  await prisma.build.update({ where: { id: build.id }, data: { status } });

  const baseUrl = process.env.PUBLIC_URL ?? `http://${req.headers.host}`;
  await syncCommitStatusIfConfigured(build.project, {
    sha: build.commitSha,
    state: "failure",
    description: "A visual change was rejected",
    targetUrl: `${baseUrl}/builds/${build.id}`,
  });

  return res.status(200).json({ status });
}
