import { chromium, type Browser } from "playwright";
import type { CaptureTarget, Viewport } from "@diffboard/core";

/**
 * Kills CSS animations/transitions and infinite-loop-prone content
 * (blinking cursors, spinners) so repeated captures of the same page are
 * pixel-stable - the single biggest source of false-positive diffs in this
 * product category.
 */
const FREEZE_MOTION_CSS = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: -0.0001s !important;
    animation-play-state: paused !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    scroll-behavior: auto !important;
    caret-color: transparent !important;
  }
`;

export interface CaptureResult {
  target: CaptureTarget;
  viewport: Viewport;
  png: Buffer;
}

export async function captureAll(
  targets: CaptureTarget[],
  viewports: Viewport[],
): Promise<CaptureResult[]> {
  const browser = await chromium.launch();
  try {
    const results: CaptureResult[] = [];
    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        reducedMotion: "reduce",
      });
      try {
        for (const target of targets) {
          results.push({
            target,
            viewport,
            png: await captureOne(context, target),
          });
        }
      } finally {
        await context.close();
      }
    }
    return results;
  } finally {
    await browser.close();
  }
}

async function captureOne(
  context: Awaited<ReturnType<Browser["newContext"]>>,
  target: CaptureTarget,
): Promise<Buffer> {
  const page = await context.newPage();
  try {
    await page.goto(target.url, { waitUntil: "networkidle" });
    await page.addStyleTag({ content: FREEZE_MOTION_CSS });
    if (target.waitFor) {
      await page.waitForSelector(target.waitFor, { state: "visible" });
    }

    const mask = target.mask?.map((selector) => page.locator(selector)) ?? [];

    return await page.screenshot({
      fullPage: target.fullPage ?? true,
      mask,
      animations: "disabled",
    });
  } finally {
    await page.close();
  }
}
