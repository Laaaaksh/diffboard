import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { requireProject } from "@/lib/project-auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const userId = await requireSession(req, res);
    if (!userId) return;

    const { projectId } = req.query;
    if (typeof projectId !== "string") {
      return res.status(400).json({ error: "projectId query param is required" });
    }

    const builds = await prisma.build.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { _count: { select: { snapshots: true } } },
    });

    return res.status(200).json({ builds });
  }

  if (req.method === "POST") {
    const project = await requireProject(req, res);
    if (!project) return;

    const { branch, baseBranch, commitSha, prNumber } = req.body ?? {};
    if (
      typeof branch !== "string" ||
      typeof baseBranch !== "string" ||
      typeof commitSha !== "string"
    ) {
      return res.status(400).json({ error: "branch, baseBranch and commitSha are required" });
    }

    const build = await prisma.build.create({
      data: {
        projectId: project.id,
        branch,
        baseBranch,
        commitSha,
        prNumber: typeof prNumber === "number" ? prNumber : null,
      },
    });

    return res.status(201).json({ id: build.id });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
