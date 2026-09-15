import { defineConfig } from "vitest/config";

// G3 unit test + coverage。閾値は 03_architecture/foundation_gates.json（lines 80 / branches 70）。
export default defineConfig({
  test: {
    fileParallelism: false, // DB のテストは同じ表を種で入れ替えるので直列（RLS は実表・モックしない）
    include: ["packages/*/src/**/*.test.ts", "packages/*/test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/*.d.ts", "**/cli.ts"],
      thresholds: { lines: 80, branches: 70, functions: 80, statements: 80 },
      reporter: ["text", "json-summary"],
    },
  },
});
