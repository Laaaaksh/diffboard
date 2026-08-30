#!/usr/bin/env node
// Boots the real diffboard stack (fresh Postgres, dashboard, demo-site fixture),
// drives it through the real product loop with Playwright, and records a video.
// Re-running this against a freshly seeded stack produces the same walkthrough.
import { chromium } from "@playwright/test";
import { spawn, execSync, execFileSync } from "node:child_process";
import {
  mkdirSync,
  writeFileSync,
  renameSync,
  readdirSync,
  rmSync,
  existsSync,
  openSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..");
const OUT_DIR = join(HERE, "out");
const TMP_DIR = join(HERE, ".tmp");

const PG_CONTAINER = "diffboard-demo-pg";
const PG_PORT = 5434;
const APP_PORT = 4300;
const DEMO_PORT = 3100;

const ADMIN_EMAIL = "admin@diffboard.dev";
const ADMIN_PASSWORD = "DiffboardDemo123!";
const SESSION_SECRET = "demo-recording-session-secret-not-for-production";
const DATABASE_URL = `postgresql://diffboard:diffboard@localhost:${PG_PORT}/diffboard`;

const children = [];

function log(msg) {
  console.log(`[record-demo] ${msg}`);
}

function sh(cmd, opts = {}) {
  log(`$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: REPO_ROOT, ...opts });
}

function shOut(cmd, opts = {}) {
  return execSync(cmd, { encoding: "utf8", cwd: REPO_ROOT, ...opts });
}

function spawnChild(name, cmd, args, opts = {}) {
  const logPath = join(TMP_DIR, `${name}.log`);
  const fd = openSync(logPath, "a");
  const child = spawn(cmd, args, { stdio: ["ignore", fd, fd], ...opts });
  children.push(child);
  return child;
}

async function waitForHttp(url, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status < 500) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function waitForDown(url, timeoutMs = 10_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await fetch(url, { redirect: "manual" });
    } catch {
      return;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
}

function buildWorkspace() {
  log("building @diffboard/core, the CLI, and the server (production build)");
  sh("pnpm --filter @diffboard/core run build");
  sh("pnpm --filter diffboard run build");
  sh("pnpm --filter @diffboard/server run build", { env: { ...process.env, DATABASE_URL } });
}

function bootPostgres() {
  log("booting fresh Postgres container for the recording");
  try {
    execSync(`docker rm -f ${PG_CONTAINER}`, { stdio: "ignore" });
  } catch {
    // didn't exist
  }
  sh(
    `docker run -d --name ${PG_CONTAINER} -e POSTGRES_USER=diffboard -e POSTGRES_PASSWORD=diffboard -e POSTGRES_DB=diffboard -p ${PG_PORT}:5432 postgres:16-alpine`,
  );
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      execSync(`docker exec ${PG_CONTAINER} pg_isready -U diffboard`, { stdio: "ignore" });
      return;
    } catch {
      // not ready yet
    }
  }
  throw new Error("Postgres never became ready");
}

function migrateAndSeed() {
  log("running prisma migrate deploy + seed");
  const serverDir = join(REPO_ROOT, "packages", "server");
  const env = { ...process.env, DATABASE_URL };
  execSync("npx prisma migrate deploy", { cwd: serverDir, env, stdio: "inherit" });
  execSync("npx tsx prisma/seed.ts", {
    cwd: serverDir,
    env: { ...env, ADMIN_EMAIL, ADMIN_PASSWORD },
    stdio: "inherit",
  });
}

async function startServer() {
  log(`starting dashboard on :${APP_PORT}`);
  const serverDir = join(REPO_ROOT, "packages", "server");
  spawnChild("server", "npx", ["next", "start", "-p", String(APP_PORT)], {
    cwd: serverDir,
    env: {
      ...process.env,
      DATABASE_URL,
      SESSION_SECRET,
      ADMIN_EMAIL,
      ADMIN_PASSWORD,
      STORAGE_DIR: join(TMP_DIR, "storage"),
      PUBLIC_URL: `http://localhost:${APP_PORT}`,
      PORT: String(APP_PORT),
    },
  });
  await waitForHttp(`http://localhost:${APP_PORT}/login`);
}

function startDemoSite(variant) {
  log(`starting demo-site (${variant}) on :${DEMO_PORT}`);
  const demoDir = join(REPO_ROOT, "examples", "demo-site");
  return spawnChild(`demo-site-${variant}`, "node", ["server.js"], {
    cwd: demoDir,
    env: { ...process.env, DEMO_VARIANT: variant, PORT: String(DEMO_PORT) },
  });
}

function stopChild(child) {
  if (!child || child.killed) return;
  try {
    child.kill("SIGTERM");
  } catch {
    // already gone
  }
}

function writeCliConfig(token) {
  const configPath = join(TMP_DIR, "diffboard.config.mjs");
  writeFileSync(
    configPath,
    `export default ${JSON.stringify(
      {
        serverUrl: `http://localhost:${APP_PORT}`,
        token,
        baseBranch: "main",
        threshold: 0.1,
        viewports: [
          { name: "desktop", width: 1280, height: 800 },
          { name: "mobile", width: 390, height: 844 },
        ],
        targets: [{ name: "home", url: `http://localhost:${DEMO_PORT}/` }],
      },
      null,
      2,
    )};\n`,
  );
  return configPath;
}

function runCli(configPath) {
  const cliBin = join(REPO_ROOT, "packages", "cli", "dist", "bin.js");
  log("running `diffboard test` against the running demo-site");
  try {
    return shOut(`node ${JSON.stringify(cliBin)} test --config ${JSON.stringify(configPath)}`);
  } catch (err) {
    // Exit code 1 just means "new or changed screenshots need review" - expected.
    return err.stdout?.toString() ?? "";
  }
}

function buildUrlFromCliOutput(output) {
  const match = output.match(/http:\/\/localhost:\d+\/builds\/[^\s]+/);
  if (!match) throw new Error(`Could not find build URL in CLI output:\n${output}`);
  return match[0];
}

async function dragSlider(page) {
  const frame = page.locator(".slider-wrap");
  const box = await frame.boundingBox();
  if (!box) return;
  await page.mouse.move(box.x + box.width * 0.15, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height / 2, { steps: 24 });
  await page.waitForTimeout(1100);
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height / 2, { steps: 16 });
  await page.waitForTimeout(900);
  await page.mouse.up();
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(TMP_DIR, { recursive: true });

  buildWorkspace();
  bootPostgres();
  migrateAndSeed();
  await startServer();
  startDemoSite("v1");
  await waitForHttp(`http://localhost:${DEMO_PORT}/`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    recordVideo: { dir: OUT_DIR, size: { width: 1280, height: 800 } },
  });
  const page = await context.newPage();

  try {
    // --- Sign in ---
    await page.goto(`http://localhost:${APP_PORT}/login`);
    await page.waitForTimeout(2650);
    await page.locator("#email").fill(ADMIN_EMAIL);
    await page.waitForTimeout(650);
    await page.locator("#password").fill(ADMIN_PASSWORD);
    await page.waitForTimeout(650);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(`http://localhost:${APP_PORT}/`);
    await page.waitForTimeout(1750);

    // --- Create the project (first-run form is shown automatically) ---
    await page.locator("#name").fill("demo-site");
    await page.waitForTimeout(1100);
    await page.locator('button:has-text("Create project")').click();
    await page.waitForSelector(".token-box");
    await page.waitForTimeout(3950);

    const tokenText = (await page.locator(".token-box").textContent())?.trim();
    if (!tokenText) throw new Error("Could not read project token from dashboard");

    await page.locator('button:has-text("Done")').click();
    await page.waitForURL(`http://localhost:${APP_PORT}/`);
    await page.waitForTimeout(1750);

    await page.locator('a:has-text("demo-site")').click();
    await page.waitForURL(/\/projects\/demo-site/);
    await page.waitForTimeout(2200);

    // --- Baseline run: capture the demo-site as it stands today ---
    const configPath = writeCliConfig(tokenText);
    const baselineOutput = runCli(configPath);
    const baselineBuildUrl = buildUrlFromCliOutput(baselineOutput);

    await page.goto(baselineBuildUrl);
    await page.waitForSelector(".snapshot-row");
    await page.waitForTimeout(2650);

    // First run has no baseline yet - approve both to establish one.
    for (const viewport of ["desktop", "mobile"]) {
      await page.locator(`.snapshot-row:has-text("${viewport}")`).click();
      await page.waitForTimeout(1300);
      await Promise.all([
        page.waitForResponse((r) => r.url().includes("/approve")),
        page.locator('button:has-text("Approve")').click(),
      ]);
      await page.waitForTimeout(2000);
    }

    await page.goto(`http://localhost:${APP_PORT}/projects/demo-site`);
    await page.waitForTimeout(2200);

    // --- Make a real visual change to the demo site and check again ---
    const v1 = children.pop();
    stopChild(v1);
    await waitForDown(`http://localhost:${DEMO_PORT}/`);
    startDemoSite("v2");
    await waitForHttp(`http://localhost:${DEMO_PORT}/`);

    const changedOutput = runCli(configPath);
    const changedBuildUrl = buildUrlFromCliOutput(changedOutput);

    await page.goto(changedBuildUrl);
    await page.waitForSelector(".snapshot-row");
    await page.waitForTimeout(2650);

    // Desktop: review the diff, then approve as the intended rebrand.
    await page.locator('.snapshot-row:has-text("desktop")').click();
    await page.waitForTimeout(1750);
    await dragSlider(page);
    await page.locator('.diff-toggle button:has-text("Side by side")').click();
    await page.waitForTimeout(3100);
    await page.locator('.diff-toggle button:has-text("Diff overlay")').click();
    await page.waitForTimeout(3500);
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/approve")),
      page.locator('button:has-text("Approve")').click(),
    ]);
    await page.waitForTimeout(2000);

    // Mobile: the same CSS change shrinks the CTA below a usable tap target -
    // flag it as a genuine regression instead of rubber-stamping it.
    await page.locator('.snapshot-row:has-text("mobile")').click();
    await page.waitForTimeout(1750);
    await page.locator('.diff-toggle button:has-text("Slider")').click();
    await page.waitForTimeout(650);
    await dragSlider(page);
    await page.locator('.diff-toggle button:has-text("Diff overlay")').click();
    await page.waitForTimeout(3100);
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/reject")),
      page.locator('button:has-text("Reject")').click(),
    ]);
    await page.waitForTimeout(2200);

    await page.goto(`http://localhost:${APP_PORT}/projects/demo-site`);
    await page.waitForTimeout(3950);
  } finally {
    await context.close();
    await browser.close();
  }

  const rawPath = join(OUT_DIR, "demo.raw.webm");
  if (existsSync(rawPath)) rmSync(rawPath);
  const videoFiles = readdirSync(OUT_DIR).filter((f) => f.endsWith(".webm"));
  if (videoFiles.length === 0) throw new Error("Playwright did not produce a video file");
  renameSync(join(OUT_DIR, videoFiles[0]), rawPath);
  for (const f of videoFiles.slice(1)) rmSync(join(OUT_DIR, f));
  log(`raw recording saved to ${rawPath}`);

  for (const child of children) stopChild(child);
  try {
    execSync(`docker rm -f ${PG_CONTAINER}`, { stdio: "ignore" });
  } catch {
    // already gone
  }
}

main().catch((err) => {
  console.error(err);
  for (const child of children) stopChild(child);
  try {
    execFileSync("docker", ["rm", "-f", PG_CONTAINER], { stdio: "ignore" });
  } catch {
    // already gone
  }
  process.exitCode = 1;
});
