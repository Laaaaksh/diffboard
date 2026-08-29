import type { NextApiRequest, NextApiResponse } from "next";
import { requireSession } from "@/lib/auth";
import { getImage } from "@/lib/storage";

export const config = {
  api: {
    responseLimit: "15mb",
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await requireSession(req, res);
  if (!userId) return;

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { key } = req.query;
  const parts = Array.isArray(key) ? key : [key];
  if (parts.some((p) => typeof p !== "string")) {
    return res.status(400).json({ error: "Invalid image key" });
  }

  try {
    const data = await getImage((parts as string[]).join("/"));
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    return res.status(200).send(data);
  } catch {
    return res.status(404).json({ error: "Image not found" });
  }
}
