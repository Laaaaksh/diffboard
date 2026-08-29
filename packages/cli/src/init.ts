import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const TEMPLATE = `// diffboard.config.js
// See https://github.com/Laaaaksh/diffboard#configuration for every option.
export default {
  // Where your self-hosted Diffboard dashboard runs.
  serverUrl: process.env.DIFFBOARD_SERVER_URL ?? "http://localhost:4300",

  // Project token from the dashboard's "New project" screen. Prefer the
  // DIFFBOARD_TOKEN environment variable (set as a CI secret) over hardcoding
  // it here.
  // token: process.env.DIFFBOARD_TOKEN,

  // The branch whose approved screenshots every other branch is diffed
  // against.
  baseBranch: "main",

  // Percentage of changed pixels (0-100) above which a screenshot is
  // flagged as CHANGED rather than ignored as noise.
  threshold: 0.1,

  viewports: [
    { name: "desktop", width: 1280, height: 800 },
    { name: "mobile", width: 390, height: 844 },
  ],

  targets: [
    { name: "home", url: "http://localhost:3000/" },
    // { name: "pricing", url: "http://localhost:3000/pricing", mask: [".timestamp"] },
  ],
};
`;

export function initConfig(): void {
  const path = resolve(process.cwd(), "diffboard.config.js");
  if (existsSync(path)) {
    console.error(`diffboard.config.js already exists at ${path}`);
    process.exitCode = 1;
    return;
  }
  writeFileSync(path, TEMPLATE);
  console.log(`Wrote ${path}`);
  console.log("Edit it to point at your app, then run: diffboard test");
}
