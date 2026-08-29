import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { serializeCookie } from "./cookie";
import type { NextApiRequest, NextApiResponse } from "next";

export const SESSION_COOKIE = "diffboard_session";

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "SESSION_SECRET must be set to a random string of at least 16 characters (see .env.example).",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionCookie(userId: string): Promise<string> {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey());

  return serializeCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSessionCookie(): string {
  return serializeCookie(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
}

export async function getSessionUserId(req: NextApiRequest): Promise<string | null> {
  const token = req.cookies[SESSION_COOKIE];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

/** Guards an API route with the dashboard's session cookie. */
export async function requireSession(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<string | null> {
  const userId = await getSessionUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return userId;
}

/** Guards a CLI-facing API route with a project's bearer token. */
export function getBearerToken(req: NextApiRequest): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}
