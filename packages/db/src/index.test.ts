import { describe, expect, it } from "vitest";
import { MIGRATIONS, TENANT_SETTING, USER_SETTING, checkMigrationOrder } from "./index.js";

describe("migration の並び", () => {
  it("定義済みの一覧は正しい並び", () => {
    expect(checkMigrationOrder(MIGRATIONS)).toEqual({ ok: true });
  });
  it("飛び番は落ちる", () => {
    expect(checkMigrationOrder(["0001_a.sql", "0003_b.sql"])).toMatchObject({
      ok: false,
      reason: expect.stringContaining("飛んで"),
    });
  });
  it("重複は落ちる", () => {
    expect(checkMigrationOrder(["0001_a.sql", "0001_b.sql"])).toMatchObject({ ok: false });
  });
  it("名前の形が違えば落ちる", () => {
    expect(checkMigrationOrder(["1_a.sql"])).toMatchObject({ ok: false, reason: expect.stringContaining("形") });
  });
  it("テナント文脈の設定名は app. で始まる", () => {
    expect(TENANT_SETTING.startsWith("app.")).toBe(true);
    expect(USER_SETTING.startsWith("app.")).toBe(true);
  });
});
