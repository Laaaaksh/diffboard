import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { generateProjectToken, slugify } from "@/lib/tokens";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await requireSession(req, res);
  if (!userId) return;

  if (req.method === "GET") {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { builds: true } } },
    });
    return res.status(200).json({
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        repoSlug: p.repoSlug,
        hasGithubSync: Boolean(p.repoSlug && p.githubToken),
        buildCount: p._count.builds,
        createdAt: p.createdAt,
      })),
    });
  }

  if (req.method === "POST") {
    const { name, repoSlug, githubToken, threshold } = req.body ?? {};
    if (typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ error: "name is required" });
    }

    const slug = slugify(name);
    const existing = await prisma.project.findUnique({ where: { slug } });
    if (existing) {
      return res.status(409).json({ error: `A project named "${name}" already exists` });
    }

    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        slug,
        token: generateProjectToken(),
        repoSlug: typeof repoSlug === "string" && repoSlug.trim() ? repoSlug.trim() : null,
        githubToken:
          typeof githubToken === "string" && githubToken.trim() ? githubToken.trim() : null,
        threshold: typeof threshold === "number" ? threshold : 0.1,
      },
    });

    // The bearer token is returned once, on creation, and never again -
    // it is not retrievable from any later GET.
    return res.status(201).json({
      id: project.id,
      name: project.name,
      slug: project.slug,
      token: project.token,
    });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
