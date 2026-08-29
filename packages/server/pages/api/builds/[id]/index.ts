import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await requireSession(req, res);
  if (!userId) return;

  const { id } = req.query;
  if (typeof id !== "string") return res.status(400).json({ error: "Invalid build id" });

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const build = await prisma.build.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, name: true, slug: true, repoSlug: true } },
      snapshots: { orderBy: { name: "asc" } },
    },
  });

  if (!build) return res.status(404).json({ error: "Build not found" });

  return res.status(200).json({ build });
}
