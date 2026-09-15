import { defineConfig } from "vitest/config";

// G3 unit test + coverage。閾値は 03_architecture/foundation_gates.json（lines 80 / branches 70）。
export default defineConfig({
  test: {
    include: [
      "packages/*/src/**/*.test.ts",
      "packages/*/test/**/*.test.ts",
      "apps/*/src/**/*.test.ts",
      "apps/*/test/**/*.test.ts",
    ],
    fileParallelism: false, // DB のテストは同じ表を種で入れ替えるので直列（RLS は実表・モックしない）
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts", "apps/*/src/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "**/*.d.ts",
        "**/cli.ts",
        "packages/contracts/src/types.ts",
        "packages/errors/src/catalog.ts",
      ], // 生成物は測らない
      thresholds: { lines: 80, branches: 70, functions: 80, statements: 80 },
      reporter: ["text", "json-summary"],
    },
  },
});
