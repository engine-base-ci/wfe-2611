// T-F-18：実行ロールのパスワードは環境変数から入れる（migration の直書きは開発の既定。staging／本番で同じ平文にしない）
import { describe, expect, it } from "vitest";
import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate, ROLE_PASSWORD_ENV } from "../src/migrate.js";

const ADMIN = process.env["DATABASE_URL"]!;
const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");
const asApp = (pw: string) => ADMIN.replace(/\/\/[^@]*@/, `//kaname_app:${encodeURIComponent(pw)}@`);
async function canConnect(url: string): Promise<boolean> {
  const c = new pg.Client({ connectionString: url });
  try {
    await c.connect();
    await c.query("select 1");
    return true;
  } catch {
    return false;
  } finally {
    await c.end().catch(() => undefined);
  }
}

describe("役割のパスワード（KANAME_*_DB_PASSWORD）", () => {
  it("環境に無ければ触らない（開発の既定 kaname_app のまま）", async () => {
    const r = await migrate(ADMIN, PKG, {
      ...process.env,
      KANAME_APP_DB_PASSWORD: undefined,
      KANAME_AUTH_DB_PASSWORD: undefined,
    });
    expect(r.passwords).toEqual([]);
    expect(await canConnect(asApp("kaname_app"))).toBe(true);
  });

  it("環境にあれば alter role で入れ替わり、古いパスワードでは入れない（終わったら戻す）", async () => {
    const fresh = "st4ging-only-p@ss'word"; // 引用符を含めても壊れない（escapeLiteral）
    try {
      const r = await migrate(ADMIN, PKG, {
        ...process.env,
        KANAME_APP_DB_PASSWORD: fresh,
        KANAME_AUTH_DB_PASSWORD: undefined,
      });
      expect(r.passwords).toEqual(["kaname_app"]);
      expect(await canConnect(asApp(fresh))).toBe(true);
      expect(await canConnect(asApp("kaname_app"))).toBe(false);
    } finally {
      await migrate(ADMIN, PKG, {
        ...process.env,
        KANAME_APP_DB_PASSWORD: "kaname_app",
        KANAME_AUTH_DB_PASSWORD: undefined,
      });
    }
    expect(await canConnect(asApp("kaname_app"))).toBe(true);
  });

  it("名前の対応は 2 役割（kaname_app・kaname_auth）で、.env.example の名前と同じ", () => {
    expect(ROLE_PASSWORD_ENV).toEqual({ kaname_app: "KANAME_APP_DB_PASSWORD", kaname_auth: "KANAME_AUTH_DB_PASSWORD" });
  });
});
