import { randomBytes } from "node:crypto";

export function generateProjectToken(): string {
  return `dbrd_${randomBytes(24).toString("hex")}`;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
