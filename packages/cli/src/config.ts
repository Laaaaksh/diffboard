import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import type { DiffboardConfig, DiffboardUserConfig } from "@diffboard/core";

const CANDIDATE_FILES = [
  "diffboard.config.js",
  "diffboard.config.mjs",
  "diffboard.config.cjs",
];

export async function loadConfig(explicitPath?: string): Promise<DiffboardConfig> {
  const path = explicitPath
    ? resolve(process.cwd(), explicitPath)
    : CANDIDATE_FILES.map((f) => resolve(process.cwd(), f)).find((f) => existsSync(f));

  if (!path || !existsSync(path)) {
    throw new Error(
      `No config file found. Expected one of: ${CANDIDATE_FILES.join(", ")} (or pass --config <path>). Run "diffboard init" to create one.`,
    );
  }

  const mod = await import(pathToFileURL(path).href);
  const config: DiffboardUserConfig = mod.default ?? mod;

  return validate(config);
}

function validate(config: DiffboardUserConfig): DiffboardConfig {
  if (!config || typeof config !== "object") {
    throw new Error("Config file must export a default object.");
  }
  if (!config.serverUrl) {
    throw new Error('Config is missing "serverUrl" (your Diffboard dashboard URL).');
  }
  if (!Array.isArray(config.targets) || config.targets.length === 0) {
    throw new Error('Config must define a non-empty "targets" array.');
  }
  if (!Array.isArray(config.viewports) || config.viewports.length === 0) {
    throw new Error('Config must define a non-empty "viewports" array.');
  }
  for (const target of config.targets) {
    if (!target.name || !target.url) {
      throw new Error(`Every target needs a "name" and "url": ${JSON.stringify(target)}`);
    }
  }

  return {
    ...config,
    baseBranch: config.baseBranch ?? "main",
    threshold: config.threshold ?? 0.1,
    outDir: config.outDir ?? ".diffboard",
  };
}

export function resolveToken(configToken: string | undefined): string {
  const token = configToken ?? process.env.DIFFBOARD_TOKEN;
  if (!token) {
    throw new Error(
      'No project token found. Set it in your config ("token") or via the DIFFBOARD_TOKEN environment variable.',
    );
  }
  return token;
}
