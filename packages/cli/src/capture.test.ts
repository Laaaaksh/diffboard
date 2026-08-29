import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { diffImages } from "@diffboard/core";
import { captureAll } from "./capture.js";

const PAGE_A = `<!doctype html><html><body style="margin:0">
  <div style="width:300px;height:200px;background:#3355ff"></div>
</body></html>`;

const PAGE_B = `<!doctype html><html><body style="margin:0">
  <div style="width:300px;height:200px;background:#ff5533"></div>
</body></html>`;

const SPINNER_PAGE = `<!doctype html><html><body style="margin:0;background:#fff">
  <style>
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .spinner { width: 40px; height: 40px; margin: 80px; border: 4px solid #333; border-top-color: transparent; border-radius: 50%; animation: spin 0.3s linear infinite; }
  </style>
  <div class="spinner"></div>
</body></html>`;

let server: Server;
let baseUrl: string;
let currentPage = PAGE_A;

beforeAll(async () => {
  server = createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(currentPage);
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (address && typeof address === "object") {
    baseUrl = `http://localhost:${address.port}`;
  } else {
    throw new Error("failed to start fixture server");
  }
}, 30000);

afterAll(() => {
  server.close();
});

const viewport = { name: "desktop", width: 400, height: 300 };

describe("captureAll", () => {
  it("captures pixel-identical screenshots of the same page on repeat runs", async () => {
    currentPage = PAGE_A;
    const [first] = await captureAll([{ name: "home", url: baseUrl }], [viewport]);
    const [second] = await captureAll([{ name: "home", url: baseUrl }], [viewport]);

    const diff = diffImages(first.png, second.png);
    expect(diff.diffPercent).toBe(0);
  }, 30000);

  it("detects a real visual change between two page versions", async () => {
    currentPage = PAGE_A;
    const [before] = await captureAll([{ name: "home", url: baseUrl }], [viewport]);
    currentPage = PAGE_B;
    const [after] = await captureAll([{ name: "home", url: baseUrl }], [viewport]);

    const diff = diffImages(before.png, after.png);
    expect(diff.diffPercent).toBeGreaterThan(10);
  }, 30000);

  it("freezes CSS animations so a spinner doesn't produce false-positive diffs", async () => {
    currentPage = SPINNER_PAGE;
    const [first] = await captureAll([{ name: "home", url: baseUrl }], [viewport]);
    const [second] = await captureAll([{ name: "home", url: baseUrl }], [viewport]);

    const diff = diffImages(first.png, second.png);
    expect(diff.diffPercent).toBe(0);
  }, 30000);

  it("paints over masked selectors identically regardless of underlying content", async () => {
    currentPage = `<!doctype html><html><body style="margin:0">
      <div id="clock" style="width:200px;height:40px;background:#eee">${Date.now()}</div>
    </body></html>`;
    const target = { name: "home", url: baseUrl, mask: ["#clock"] };
    const [first] = await captureAll([target], [viewport]);

    currentPage = `<!doctype html><html><body style="margin:0">
      <div id="clock" style="width:200px;height:40px;background:#eee">${Date.now() + 999999}</div>
    </body></html>`;
    const [second] = await captureAll([target], [viewport]);

    const diff = diffImages(first.png, second.png);
    expect(diff.diffPercent).toBe(0);
  }, 30000);
});
