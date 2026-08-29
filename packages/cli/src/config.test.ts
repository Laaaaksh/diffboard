import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, resolveToken } from "./config.js";

const dirs: string[] = [];
function tempConfig(contents: string): string {
  const dir = mkdtempSync(join(tmpdir(), "diffboard-config-test-"));
  dirs.push(dir);
  const path = join(dir, "diffboard.config.js");
  writeFileSync(path, contents);
  return path;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("loadConfig", () => {
  it("loads a valid config and fills in defaults", async () => {
    const path = tempConfig(`
      export default {
        serverUrl: "http://localhost:4300",
        targets: [{ name: "home", url: "http://localhost:3000" }],
        viewports: [{ name: "desktop", width: 1280, height: 800 }],
      };
    `);
    const config = await loadConfig(path);
    expect(config.baseBranch).toBe("main");
    expect(config.threshold).toBe(0.1);
    expect(config.outDir).toBe(".diffboard");
  });

  it("throws when serverUrl is missing", async () => {
    const path = tempConfig(`
      export default {
        targets: [{ name: "home", url: "http://localhost:3000" }],
        viewports: [{ name: "desktop", width: 1280, height: 800 }],
      };
    `);
    await expect(loadConfig(path)).rejects.toThrow(/serverUrl/);
  });

  it("throws when targets is empty", async () => {
    const path = tempConfig(`
      export default {
        serverUrl: "http://localhost:4300",
        targets: [],
        viewports: [{ name: "desktop", width: 1280, height: 800 }],
      };
    `);
    await expect(loadConfig(path)).rejects.toThrow(/targets/);
  });

  it("throws when a target is missing a url", async () => {
    const path = tempConfig(`
      export default {
        serverUrl: "http://localhost:4300",
        targets: [{ name: "home" }],
        viewports: [{ name: "desktop", width: 1280, height: 800 }],
      };
    `);
    await expect(loadConfig(path)).rejects.toThrow(/name.*url/);
  });

  it("throws a helpful error when no config file exists", async () => {
    const dir = mkdtempSync(join(tmpdir(), "diffboard-config-test-"));
    dirs.push(dir);
    await expect(loadConfig(join(dir, "diffboard.config.js"))).rejects.toThrow(/No config file/);
  });
});

describe("resolveToken", () => {
  it("prefers an explicit config token", () => {
    expect(resolveToken("from-config")).toBe("from-config");
  });

  it("falls back to DIFFBOARD_TOKEN", () => {
    const prev = process.env.DIFFBOARD_TOKEN;
    process.env.DIFFBOARD_TOKEN = "from-env";
    expect(resolveToken(undefined)).toBe("from-env");
    if (prev === undefined) delete process.env.DIFFBOARD_TOKEN;
    else process.env.DIFFBOARD_TOKEN = prev;
  });

  it("throws when no token is available anywhere", () => {
    const prev = process.env.DIFFBOARD_TOKEN;
    delete process.env.DIFFBOARD_TOKEN;
    expect(() => resolveToken(undefined)).toThrow(/token/);
    if (prev !== undefined) process.env.DIFFBOARD_TOKEN = prev;
  });
});
