// Vercel の関数の入口（D-097）：組み立ては関数の実体ごとに 1 回・失敗は覚えない・落ちている間は 503（黙って 502 にしない・G-11）。
// 最後に、本物の組み立て（bootApi・関数用の本数）を Node の HTTP で立て、/health と Bridge の口が通ることを見る。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "@kaname/db/migrate";
import { migrateAuth } from "@kaname/auth/migrate";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { getRequestListener } from "@hono/node-server";
import { Hono } from "hono";
import { loadConfig, StartupFailed } from "@kaname/config";
import { bootApi, type Booted } from "../src/server.js";
import { lazyBoot, vercelFetch, VERCEL_POOL } from "../src/vercel.js";

const ADMIN = process.env["DATABASE_URL"]!;
const fake = (): Booted => {
  const app = new Hono().get("/health", (c) => c.json({ ok: true }));
  return { app: app as unknown as Booted["app"], report: {} as Booted["report"], close: async () => undefined };
};

describe("組み立ては 1 回・失敗は覚えない", () => {
  it("同時に来た要求は同じ組み立てを待つ", async () => {
    let n = 0;
    const get = lazyBoot(async () => (n++, await new Promise((r) => setTimeout(r, 50)), fake()));
    await Promise.all([get(), get(), get()]);
    await get();
    expect(n).toBe(1);
  });
  it("落ちたら次の要求でやり直す。落ちている間は 503 と理由", async () => {
    let n = 0;
    const handler = vercelFetch(
      lazyBoot(async () => {
        n++;
        if (n === 1)
          throw new StartupFailed({ ok: false, results: { "storage:bucket": "missing", "db:tables": "ok" } });
        return fake();
      }),
    );
    const r1 = await handler(new Request("http://x/health"));
    expect(r1.status).toBe(503);
    const j1 = (await r1.json()) as { code: string; reason: string[] };
    expect(j1.code).toBe("STARTUP_FAILED");
    expect(j1.reason, "落ちた確認の名前だけ").toEqual(["storage:bucket=missing"]);
    const r2 = await handler(new Request("http://x/health"));
    expect(r2.status, "2 回目は組み立て直して通る").toBe(200);
    expect(n).toBe(2);
  });
});

describe("本物の組み立てを Node の HTTP で", () => {
  let close: (() => Promise<void>) | null = null;
  // 起動時の存在確認（表がそろっているか）を通すため、自分で migration を当てる（ほかの試験が先に当てている前提にしない）
  beforeAll(async () => {
    await migrate(ADMIN, join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "packages", "db"));
    await migrateAuth(ADMIN);
  }, 60_000);
  afterAll(async () => close?.());
  it("/health は 200、死んだ Bridge の鍵は 410", async () => {
    const config = loadConfig({
      NODE_ENV: "test",
      DATABASE_URL: ADMIN.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@"),
      AUTH_DATABASE_URL: ADMIN.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@"),
      AUTH_SECRET: "test-secret-0123456789-abcdefghijklmnop",
      BASE_URL: "http://127.0.0.1:0",
      STORAGE_ENDPOINT: "http://127.0.0.1:9",
      STORAGE_REGION: "us-east-1",
      STORAGE_BUCKET: "unused",
      STORAGE_ACCESS_KEY_ID: "x",
      STORAGE_SECRET_ACCESS_KEY: "x",
      SECRETS_MASTER_KEY: Buffer.alloc(32, 7).toString("base64"),
    });
    const get = lazyBoot(() => bootApi(config, { poolMax: VERCEL_POOL, bucketExists: async () => true }));
    const srv = http.createServer(getRequestListener(vercelFetch(get)));
    await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
    close = async () => {
      await new Promise<void>((r) => srv.close(() => r()));
      await (await get()).close();
    };
    const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
    expect((await fetch(`${base}/health`)).status).toBe(200);
    const t = await fetch(`${base}/api/auth-ext/bridge/take`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-bridge-session": "00000000-0000-4000-8000-000000000000" },
      body: JSON.stringify({ wait_sec: 20 }),
    });
    expect(t.status).toBe(410);
  }, 60_000);
});
