import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

/**
 * Where screenshot/diff PNGs live. Local disk by default (zero paid
 * infrastructure to self-host); point STORAGE_DIR at a mounted volume in
 * production so images survive container restarts.
 */
const STORAGE_DIR = resolve(process.env.STORAGE_DIR ?? "./data/storage");

function safeKey(key: string): string {
  if (key.includes("..") || key.startsWith("/")) {
    throw new Error(`Unsafe storage key: ${key}`);
  }
  return key;
}

export async function putImage(key: string, data: Buffer): Promise<void> {
  const path = join(STORAGE_DIR, safeKey(key));
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
}

export async function getImage(key: string): Promise<Buffer> {
  return readFile(join(STORAGE_DIR, safeKey(key)));
}

export function buildImageKey(params: {
  projectId: string;
  scope: "build" | "baseline";
  scopeId: string;
  name: string;
  viewport: string;
  kind: "screenshot" | "diff";
}): string {
  const safeName = params.name.replace(/[^a-zA-Z0-9_-]/g, "_");
  const suffix = params.kind === "diff" ? ".diff.png" : ".png";
  return `${params.projectId}/${params.scope}/${params.scopeId}/${safeName}-${params.viewport}${suffix}`;
}
