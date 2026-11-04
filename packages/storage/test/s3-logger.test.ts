// AWS SDK の中の @smithy/core（3.33〜3.38.0）に、独自のログの出し方を差し込んだときの機密の伏せ方の不具合がある（aws-sdk-js-v3 #8393）。
//   直った版（3.38.1）が出て 21 日を過ぎて上げられるまで（D-128.124）（KN-119・2026-11-20 以降）、S3 の部品にログの出し方を差し込まない。差し込んだら赤
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { s3Client } from "../src/s3.js";

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "src", "s3.ts"), "utf8");

describe("S3 の部品にログの出し方を差し込まない（KN-119）", () => {
  it("s3.ts は logger を渡さない", () => {
    expect(SRC).not.toMatch(/\blogger\s*:/);
  });
  it("作った S3 の部品の設定に、差し込んだログの出し方が無い", async () => {
    const c = s3Client({
      endpoint: "http://127.0.0.1:9",
      region: "auto",
      bucket: "b",
      accessKeyId: "x",
      secretAccessKey: "y",
    });
    const logger = (c.config as { logger?: { constructor?: { name?: string } } }).logger;
    // 既定（何も出さない NoOpLogger）のまま
    expect(logger?.constructor?.name ?? "NoOpLogger").toBe("NoOpLogger");
  });
});
