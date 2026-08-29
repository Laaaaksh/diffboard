import { diffImages, setCommitStatus, upsertPrComment } from "@diffboard/core";
import type { SnapshotStatus, DiffboardConfig } from "@diffboard/core";
import { captureAll } from "./capture.js";
import { DiffboardClient } from "./client.js";
import { resolveBuildContext } from "./build-context.js";
import { loadConfig, resolveToken } from "./config.js";

export interface RunOptions {
  configPath?: string;
}

export async function run(options: RunOptions): Promise<number> {
  const config = await loadConfig(options.configPath);
  const token = resolveToken(config.token);
  const client = new DiffboardClient(config.serverUrl, token);
  const ctx = resolveBuildContext();

  console.log(`diffboard: capturing ${config.targets.length} target(s) × ${config.viewports.length} viewport(s)`);
  const captures = await captureAll(config.targets, config.viewports);

  const build = await client.createBuild({
    branch: ctx.branch,
    baseBranch: config.baseBranch ?? "main",
    commitSha: ctx.commitSha,
    prNumber: ctx.prNumber,
  });
  console.log(`diffboard: created build ${build.id} (${ctx.branch} → ${config.baseBranch ?? "main"})`);

  let newCount = 0;
  let changedCount = 0;
  let unchangedCount = 0;

  for (const capture of captures) {
    const viewportName = capture.viewport.name;
    const baseline = await client.getBaseline({
      branch: config.baseBranch ?? "main",
      name: capture.target.name,
      viewport: viewportName,
    });

    let status: SnapshotStatus;
    let diffPercent: number | undefined;
    let diffImageBase64: string | undefined;

    if (!baseline) {
      status = "NEW";
      newCount++;
    } else {
      const diff = diffImages(Buffer.from(baseline.imageBase64, "base64"), capture.png, {
        pixelThreshold: 0.1,
      });
      diffPercent = diff.diffPercent;
      if (diff.diffPercent > (config.threshold ?? 0.1)) {
        status = "CHANGED";
        changedCount++;
        if (diff.diffImage) diffImageBase64 = diff.diffImage.toString("base64");
      } else {
        status = "UNCHANGED";
        unchangedCount++;
      }
    }

    await client.uploadSnapshot(build.id, {
      name: capture.target.name,
      viewport: viewportName,
      status,
      imageBase64: capture.png.toString("base64"),
      diffPercent,
      diffImageBase64,
      baselineKey: baseline?.imageKey,
    });

    const icon = status === "NEW" ? "＋" : status === "CHANGED" ? "≠" : "＝";
    console.log(`  ${icon} ${capture.target.name} @ ${viewportName}: ${status}`);
  }

  const result = await client.finalizeBuild(build.id);
  console.log(
    `diffboard: ${result.summary.new} new, ${result.summary.changed} changed, ${result.summary.unchanged} unchanged`,
  );
  console.log(`diffboard: ${result.buildUrl}`);

  await reportToGithub(ctx, result, config);

  // NEW screenshots also block, same as CHANGED - there's no baseline to have
  // silently approved yet, so a stranger's first run always needs a look.
  const needsReview = result.summary.new + result.summary.changed > 0;
  return needsReview ? 1 : 0;
}

async function reportToGithub(
  ctx: ReturnType<typeof resolveBuildContext>,
  result: { status: string; buildUrl: string; summary: { total: number; new: number; changed: number; unchanged: number } },
  config: DiffboardConfig,
): Promise<void> {
  if (!ctx.repoSlug || !ctx.githubToken) return;

  const auth = { repoSlug: ctx.repoSlug, token: ctx.githubToken };
  const changed = result.summary.new + result.summary.changed;

  await setCommitStatus(auth, {
    sha: ctx.commitSha,
    state: changed > 0 ? "failure" : "success",
    description:
      changed > 0
        ? `${changed} of ${result.summary.total} screenshots changed - review required`
        : `All ${result.summary.total} screenshots match the baseline`,
    targetUrl: result.buildUrl,
  });

  if (ctx.prNumber) {
    const rows = [
      `| | count |`,
      `|---|---|`,
      `| 🆕 new | ${result.summary.new} |`,
      `| 🔀 changed | ${result.summary.changed} |`,
      `| ✅ unchanged | ${result.summary.unchanged} |`,
    ].join("\n");

    await upsertPrComment(auth, {
      prNumber: ctx.prNumber,
      body:
        changed > 0
          ? `## 🔍 Diffboard: ${changed} screenshot${changed === 1 ? "" : "s"} changed\n\n${rows}\n\n[Review the diff](${result.buildUrl}) - the commit status will turn green once every change is approved or rejected.`
          : `## ✅ Diffboard: no visual changes\n\n${rows}\n\nAll screenshots match \`${config.baseBranch ?? "main"}\`'s approved baseline.`,
    });
  }
}
