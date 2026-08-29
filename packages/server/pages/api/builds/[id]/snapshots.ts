import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/db";
import { requireProject } from "@/lib/project-auth";
import { buildImageKey, putImage } from "@/lib/storage";
import type { SnapshotStatus } from "@diffboard/core";

export const config = {
  api: {
    bodyParser: { sizeLimit: "15mb" },
  },
};

const VALID_STATUSES: SnapshotStatus[] = ["NEW", "UNCHANGED", "CHANGED"];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const project = await requireProject(req, res);
  if (!project) return;

  const { id: buildId } = req.query;
  if (typeof buildId !== "string") return res.status(400).json({ error: "Invalid build id" });

  const build = await prisma.build.findFirst({ where: { id: buildId, projectId: project.id } });
  if (!build) return res.status(404).json({ error: "Build not found" });

  const { name, viewport, status, imageBase64, diffPercent, diffImageBase64, baselineKey } =
    req.body ?? {};

  if (
    typeof name !== "string" ||
    typeof viewport !== "string" ||
    typeof imageBase64 !== "string" ||
    !VALID_STATUSES.includes(status)
  ) {
    return res
      .status(400)
      .json({ error: "name, viewport, imageBase64 and a valid status are required" });
  }

  const imageKey = buildImageKey({
    projectId: project.id,
    scope: "build",
    scopeId: build.id,
    name,
    viewport,
    kind: "screenshot",
  });
  await putImage(imageKey, Buffer.from(imageBase64, "base64"));

  let diffKey: string | null = null;
  if (typeof diffImageBase64 === "string" && diffImageBase64.length > 0) {
    diffKey = buildImageKey({
      projectId: project.id,
      scope: "build",
      scopeId: build.id,
      name,
      viewport,
      kind: "diff",
    });
    await putImage(diffKey, Buffer.from(diffImageBase64, "base64"));
  }

  const snapshot = await prisma.snapshot.create({
    data: {
      buildId: build.id,
      name,
      viewport,
      imageKey,
      diffKey,
      baselineKey: typeof baselineKey === "string" ? baselineKey : null,
      diffPercent: typeof diffPercent === "number" ? diffPercent : null,
      status,
    },
  });

  return res.status(201).json({ id: snapshot.id });
}
