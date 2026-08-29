/** Minimal Set-Cookie serializer - avoids pulling in a dependency for one header. */
export function serializeCookie(
  name: string,
  value: string,
  options: {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "strict" | "lax" | "none";
    path?: string;
    maxAge?: number;
  } = {},
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite[0].toUpperCase()}${options.sameSite.slice(1)}`);
  }
  return parts.join("; ");
}
