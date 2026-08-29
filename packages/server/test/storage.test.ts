import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let putImage: typeof import("../src/lib/storage").putImage;
let getImage: typeof import("../src/lib/storage").getImage;
let dir: string;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "diffboard-storage-test-"));
  process.env.STORAGE_DIR = dir;
  // storage.ts resolves STORAGE_DIR once at module-load time, so the env var
  // must be set before this, the file's only import of it.
  ({ putImage, getImage } = await import("../src/lib/storage"));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("storage key safety", () => {
  it("rejects path traversal and absolute-path keys", async () => {
    await expect(putImage("../../etc/passwd", Buffer.from("x"))).rejects.toThrow(/unsafe/i);
    await expect(putImage("/etc/passwd", Buffer.from("x"))).rejects.toThrow(/unsafe/i);
    await expect(getImage("../../etc/passwd")).rejects.toThrow(/unsafe/i);
  });

  it("round-trips a real key under the storage dir", async () => {
    await putImage("proj1/build2/home-desktop.png", Buffer.from("hello"));
    const data = await getImage("proj1/build2/home-desktop.png");
    expect(data.toString()).toBe("hello");
  });
});
