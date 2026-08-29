import type { NextApiRequest, NextApiResponse } from "next";
import type { Project } from "@prisma/client";
import { prisma } from "./db";
import { getBearerToken } from "./auth";

/** Guards a CLI-facing API route with a project's bearer token. */
export async function requireProject(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<Project | null> {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Missing Authorization: Bearer <project token> header" });
    return null;
  }
  const project = await prisma.project.findUnique({ where: { token } });
  if (!project) {
    res.status(401).json({ error: "Invalid project token" });
    return null;
  }
  return project;
}
