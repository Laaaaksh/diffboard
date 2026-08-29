import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    setupFiles: ["./vitest.setup.ts"],
    fileParallelism: false,
    testTimeout: 15000,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
