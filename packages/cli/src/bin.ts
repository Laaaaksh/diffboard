#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { run } from "./run.js";
import { initConfig } from "./init.js";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  version: string;
};

function parseArgs(argv: string[]) {
  const [command, ...rest] = argv;
  let configPath: string | undefined;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--config" || rest[i] === "-c") {
      configPath = rest[i + 1];
      i++;
    }
  }
  return { command, configPath };
}

async function main() {
  const { command, configPath } = parseArgs(process.argv.slice(2));

  switch (command) {
    case "test":
    case "run":
    case undefined: {
      const exitCode = await run({ configPath });
      process.exitCode = exitCode;
      return;
    }
    case "init":
      initConfig();
      return;
    case "--version":
    case "-v":
      console.log(pkg.version);
      return;
    case "--help":
    case "-h":
    case "help":
      printHelp();
      return;
    default:
      console.error(`Unknown command: ${command}\n`);
      printHelp();
      process.exitCode = 2;
  }
}

function printHelp() {
  console.log(`diffboard - visual regression testing CLI

Usage:
  diffboard test [--config <path>]   Capture screenshots, diff against baseline, upload to the dashboard
  diffboard init                     Write a starter diffboard.config.js
  diffboard help                     Show this message

Exit code is 0 when every screenshot matched the baseline, 1 when any
screenshot is new or changed and needs review on the dashboard.`);
}

main().catch((err) => {
  console.error(`diffboard: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
