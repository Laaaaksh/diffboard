import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import type { DiffResult } from "./types.js";

export interface DiffOptions {
  /** pixelmatch's own per-pixel color-difference sensitivity, 0-1. */
  pixelThreshold?: number;
}

/**
 * Perceptual diff between two PNG buffers (antialiasing-aware via pixelmatch,
 * so font rendering noise doesn't register as a regression).
 */
export function diffImages(
  baseline: Buffer,
  current: Buffer,
  options: DiffOptions = {},
): DiffResult {
  const before = PNG.sync.read(baseline);
  const after = PNG.sync.read(current);

  if (before.width !== after.width || before.height !== after.height) {
    return {
      diffPercent: 100,
      diffPixels: 0,
      totalPixels: 0,
      width: after.width,
      height: after.height,
      diffImage: null,
      dimensionsMatch: false,
    };
  }

  const { width, height } = before;
  const diff = new PNG({ width, height });

  const diffPixels = pixelmatch(
    before.data,
    after.data,
    diff.data,
    width,
    height,
    {
      threshold: options.pixelThreshold ?? 0.1,
      includeAA: false,
      alpha: 0.5,
      diffColor: [255, 0, 0],
      diffColorAlt: [255, 0, 0],
    },
  );

  const totalPixels = width * height;

  return {
    diffPercent: totalPixels === 0 ? 0 : (diffPixels / totalPixels) * 100,
    diffPixels,
    totalPixels,
    width,
    height,
    diffImage: diffPixels > 0 ? PNG.sync.write(diff) : null,
    dimensionsMatch: true,
  };
}
