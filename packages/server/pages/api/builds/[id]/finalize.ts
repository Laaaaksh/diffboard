import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/db";
import { requireProject } from "@/lib/project-auth";
import { computeBuildStatus } from "@/lib/build-status";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const project = await requireProject(req, res);
  if (!project) return;

  const { id: buildId } = req.query;
  if (typeof buildId !== "string") return res.status(400).json({ error: "Invalid build id" });

  const build = await prisma.build.findFirst({
    where: { id: buildId, projectId: project.id },
    include: { snapshots: true },
  });
  if (!build) return res.status(404).json({ error: "Build not found" });

  const status = computeBuildStatus(build.snapshots);
  await prisma.build.update({ where: { id: build.id }, data: { status } });

  const baseUrl = process.env.PUBLIC_URL ?? `http://${req.headers.host}`;

  return res.status(200).json({
    status,
    buildUrl: `${baseUrl}/builds/${build.id}`,
    summary: {
      total: build.snapshots.length,
      new: build.snapshots.filter((s) => s.status === "NEW").length,
      changed: build.snapshots.filter((s) => s.status === "CHANGED").length,
      unchanged: build.snapshots.filter((s) => s.status === "UNCHANGED").length,
    },
  });
}
