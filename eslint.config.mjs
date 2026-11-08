// 記法の関門（G1）。関門の迂回検出（G16〜G25）は別スクリプト（T-F-07）。
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/.next-prod/**",
      "**/pw-reports/**",
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      "06_mockup/**",
      "0[0-9]_*/**",
      "10_skills/**",
      "scripts/**",
      "**/.next/**",
      "**/next-env.d.ts",
      "**/playwright-report/**",
      "**/test-results/**",
      ".claude/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
);
