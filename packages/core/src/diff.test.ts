import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import { diffImages } from "./diff.js";

function solidPng(width: number, height: number, [r, g, b]: [number, number, number]): Buffer {
  const png = new PNG({ width, height });
  for (let i = 0; i < width * height; i++) {
    png.data[i * 4] = r;
    png.data[i * 4 + 1] = g;
    png.data[i * 4 + 2] = b;
    png.data[i * 4 + 3] = 255;
  }
  return PNG.sync.write(png);
}

function halfChangedPng(width: number, height: number): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const changed = x >= width / 2;
      png.data[i] = changed ? 0 : 255;
      png.data[i + 1] = 255;
      png.data[i + 2] = 255;
      png.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

describe("diffImages", () => {
  it("reports zero diff for identical images", () => {
    const image = solidPng(20, 20, [10, 20, 30]);
    const result = diffImages(image, image);

    expect(result.dimensionsMatch).toBe(true);
    expect(result.diffPixels).toBe(0);
    expect(result.diffPercent).toBe(0);
    expect(result.diffImage).toBeNull();
  });

  it("flags a fully different image as ~100% changed", () => {
    const before = solidPng(20, 20, [255, 255, 255]);
    const after = solidPng(20, 20, [0, 0, 0]);
    const result = diffImages(before, after);

    expect(result.diffPercent).toBeGreaterThan(95);
    expect(result.diffImage).not.toBeNull();
  });

  it("measures a partial change proportionally", () => {
    const before = solidPng(40, 40, [255, 255, 255]);
    const after = halfChangedPng(40, 40);
    const result = diffImages(before, after);

    expect(result.diffPercent).toBeGreaterThan(40);
    expect(result.diffPercent).toBeLessThan(60);
  });

  it("ignores tiny antialiasing-style single pixel noise below the pixel threshold", () => {
    const before = solidPng(10, 10, [128, 128, 128]);
    const after = PNG.sync.read(before);
    // Nudge every channel by 1 - within pixelmatch's default color threshold.
    for (let i = 0; i < after.data.length; i += 4) {
      after.data[i] = 129;
    }
    const result = diffImages(before, PNG.sync.write(after));
    expect(result.diffPixels).toBe(0);
  });

  it("flags a dimension mismatch without attempting a pixel diff", () => {
    const before = solidPng(20, 20, [1, 2, 3]);
    const after = solidPng(30, 20, [1, 2, 3]);
    const result = diffImages(before, after);

    expect(result.dimensionsMatch).toBe(false);
    expect(result.diffPercent).toBe(100);
    expect(result.diffImage).toBeNull();
  });
});
