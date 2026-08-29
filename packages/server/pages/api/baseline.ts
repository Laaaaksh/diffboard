import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/db";
import { requireProject } from "@/lib/project-auth";
import { getImage } from "@/lib/storage";

export const config = {
  api: {
    responseLimit: "15mb",
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const project = await requireProject(req, res);
  if (!project) return;

  const { branch, name, viewport } = req.query;
  if (typeof branch !== "string" || typeof name !== "string" || typeof viewport !== "string") {
    return res.status(400).json({ error: "branch, name and viewport query params are required" });
  }

  const baseline = await prisma.baseline.findUnique({
    where: {
      projectId_branch_name_viewport: { projectId: project.id, branch, name, viewport },
    },
  });

  if (!baseline) {
    return res.status(404).json({ error: "No baseline yet" });
  }

  const imageBase64 = (await getImage(baseline.imageKey)).toString("base64");
  return res.status(200).json({ imageBase64, imageKey: baseline.imageKey });
}
