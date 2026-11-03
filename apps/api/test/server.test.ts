// T-F-18：API の起動口。設定 → 存在確認（G-11）→ HTTP。落ちるものは起動しない（黙って 502 を返さない）
// バケットの実在（S3 の HEAD）は packages/storage のテストが MinIO で持つ。ここは差し込みで「有る／無い」の両方を通す（CI に MinIO は無い）
import { beforeAll, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "@kaname/db/migrate";
import { migrateAuth } from "@kaname/auth/migrate";
import type { Config } from "@kaname/config";
import { MemoryVault } from "@kaname/secrets";
import { bootApi, startServer } from "../src/server.js";
import { lazyBoot, vercelFetch } from "../src/vercel.js";

const DB_PKG = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "packages", "db");
const ADMIN = process.env["DATABASE_URL"] ?? "postgres://postgres:postgres@127.0.0.1:55433/kaname_test";
const config: Config = {
  env: "test",
  databaseUrl: ADMIN.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@"),
  authDatabaseUrl: ADMIN.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@"),
  authSecret: "test-secret-0123456789-abcdefghijklmnop",
  baseUrl: "http://127.0.0.1:0",
  storage: {
    endpoint: process.env["STORAGE_ENDPOINT"] ?? "http://127.0.0.1:9000",
    region: "ap-northeast-1",
    bucket: "kaname-dev",
    accessKeyId: process.env["STORAGE_ACCESS_KEY_ID"] ?? "minioadmin",
    secretAccessKey: process.env["STORAGE_SECRET_ACCESS_KEY"] ?? "minioadmin",
    forcePathStyle: true,
  },
  secretsMasterKey: Buffer.alloc(32, 7).toString("base64"),
  resendApiKey: null,
  webBaseUrl: null,
  webOrigins: [],
  port: 0,
} as Config;

describe("apps/api の起動口（server.ts）", () => {
  beforeAll(async () => {
    await migrate(ADMIN, DB_PKG); // 他のテストの順序に依存しない
    await migrateAuth(ADMIN);
  }, 60_000); // まっさらな DB では migration 19 本で 10 秒を超える

  it("起動時の存在確認が全部 OK なら HTTP で待ち受け、GET /health が 200 で版を返す", async () => {
    const s = await startServer(config, { bucketExists: async () => true });
    try {
      expect(s.port).toBeGreaterThan(0);
      const r = await fetch(`http://127.0.0.1:${s.port}/health`);
      expect(r.status).toBe(200);
      const body = (await r.json()) as { ok: boolean; version: string };
      expect(body.ok).toBe(true);
      expect(body.version).toBe("0.1.0");
    } finally {
      await s.close();
    }
  });

  it("文脈の無い要求は 401（本物の認証の resolver が配線されている）・認証の口は 200", async () => {
    const s = await startServer(config, { bucketExists: async () => true });
    try {
      const r = await fetch(`http://127.0.0.1:${s.port}/api/v1/tickets`); // 契約にある社内の口（どれでもよい：文脈の無い要求は 401）
      expect(r.status).toBe(401);
      const ok = await fetch(`http://127.0.0.1:${s.port}/api/auth/ok`);
      expect(ok.status).toBe(200);
    } finally {
      await s.close();
    }
  });

  it("バケットが無ければ起動しない（storage:bucket=missing を名指しで）", async () => {
    await expect(bootApi(config, { bucketExists: async () => false })).rejects.toThrow(/storage:bucket=missing/);
  });

  it("BRG-14-003 staging／本番で Infisical に入れない設定なら起動しない（メモリのまま＝secrets:vault=missing・入れない＝secrets:vault=error）。Vercel の口は 503 と理由（D-101.4）", async () => {
    const ok = { bucketExists: async () => true };
    await expect(bootApi({ ...config, env: "staging" }, ok), "設定が無くメモリの預かり先のまま").rejects.toThrow(
      /secrets:vault=missing/,
    );
    const cannotLogin = Object.assign(new MemoryVault(), {
      durable: true,
      ping: async (): Promise<true> => {
        throw new Error("Infisical で入ることができない（401）");
      },
    });
    await expect(
      bootApi({ ...config, env: "production" }, { ...ok, vault: cannotLogin }),
      "Infisical に入れない",
    ).rejects.toThrow(/secrets:vault=error/);
    // 落ちている間、Vercel の口は 503 と「どの確認が落ちたか」。値や接続先は出さない
    const handler = vercelFetch(lazyBoot(() => bootApi({ ...config, env: "staging" }, { ...ok, vault: cannotLogin })));
    const r = await handler(new Request("http://x/health"));
    expect(r.status).toBe(503);
    const j = (await r.json()) as { code: string; reason: string[]; message: string };
    expect(j.code).toBe("STARTUP_FAILED");
    expect(j.reason).toEqual(["secrets:vault=error"]);
    expect(JSON.stringify(j)).not.toContain("401"); // 中の例外の文言は外に出さない
  });

  it("存在確認の報告は 5 項目（db:tables・storage:bucket・secrets:master-key・notify:resend・secrets:vault〔D-101.4〕）", async () => {
    const b = await bootApi(config, { bucketExists: async () => true });
    try {
      expect(Object.keys(b.report.results).sort()).toEqual(
        ["db:tables", "notify:resend", "secrets:master-key", "secrets:vault", "storage:bucket"].sort(),
      );
      expect(b.report.ok).toBe(true);
    } finally {
      await b.close();
    }
  });
});
