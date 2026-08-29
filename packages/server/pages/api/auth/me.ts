import type { NextApiRequest, NextApiResponse } from "next";
import { getSessionUserId } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await getSessionUserId(req);
  return res.status(200).json({ authenticated: Boolean(userId) });
}
