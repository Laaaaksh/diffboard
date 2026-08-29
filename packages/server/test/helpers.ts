import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../src/lib/db";
import { hashPassword, createSessionCookie, SESSION_COOKIE } from "../src/lib/auth";

export function mockApi(opts: {
  method: string;
  body?: Record<string, unknown>;
  query?: Record<string, string | string[]>;
  token?: string;
  sessionCookie?: string;
}) {
  const headers: Record<string, string> = {};
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;

  const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
    method: opts.method as never,
    body: opts.body,
    query: opts.query,
    headers,
    cookies: opts.sessionCookie ? { [SESSION_COOKIE]: opts.sessionCookie } : {},
  });

  return { req, res };
}

/**
 * node-mocks-http's `_getJSONData()` typing resolves to `any` only through a
 * conditional type that doesn't fire for our usage - this sidesteps that
 * rather than fighting its generics from every call site.
 */
export function jsonBody<T = Record<string, unknown>>(res: { _getJSONData(): unknown }): T {
  return res._getJSONData() as T;
}

export async function createTestUser(email = "test@example.com", password = "password123") {
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({ data: { email, passwordHash } });
  const cookieHeader = await createSessionCookie(user.id);
  // The cookie header is "name=value; Path=/; ..." - tests need just the value.
  const sessionCookie = cookieHeader.split(";")[0].split("=").slice(1).join("=");
  return { user, sessionCookie };
}

export async function resetDb() {
  await prisma.snapshot.deleteMany();
  await prisma.baseline.deleteMany();
  await prisma.build.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
}

/** 1x1 magenta PNG, base64-encoded - a minimal valid image for upload tests. */
export const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
