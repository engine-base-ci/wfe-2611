// 記憶（D-105・T-B-21）を本物の Postgres（RLS あり）で通す。
//   「覚えて」はその場で個人の記憶に入り、会話に「覚えました」が出る（記憶に残さない会話では入れない）
//   K-712：毎朝のまとめ・上の層へ上げる候補・記憶を直す／消す旧い道は代表の決め 8（記憶は物として無くす）で外したので、
//   この試験のその部分（describe 2 つ）も外した。「覚えて」の印が記憶に入る所は K-712 の範囲の外（別の葉）なのでそのまま残す
import { beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "@kaname/db/migrate";
import { migrateAuth } from "@kaname/auth/migrate";
import { createAuth } from "@kaname/auth";
import { createDeviceResolver, createSessionResolver } from "@kaname/auth/resolver";
import { createPool } from "@kaname/db/pool";
import { createRepository } from "@kaname/db/repository";
import { MemoryVault, SecretsGateway } from "@kaname/secrets";
import { ObjectStore } from "@kaname/storage";
import { localDriver } from "@kaname/storage/local";
import { createApp } from "../src/app.js";
import { authExt } from "../src/auth/ext.js";
import { keepAuth, verifiedUser } from "./_pending.js";
import { ActionGateway, RateLimiter } from "@kaname/actions";
import { invitationHooks } from "../src/hooks/invitations.js";
import { pairForTest } from "./bridge_pair.js";
import { isMovedBridgePath, oldBridge, type OldBridge } from "./bridge_contract.js";
import { withDevice } from "../src/middleware/tenant.js";
import { delegateHooks } from "../src/hooks/delegate.js";

const DB_PKG = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "packages", "db");
const ADMIN = process.env["DATABASE_URL"]!;
const APP_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const AUTH_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@");
const PW = "Str0ng-Passw0rd!";
const sent: { to: string; url: string; kind: string }[] = [];
let app: ReturnType<typeof createApp>;
let admin: pg.Pool;
const X = "/api/auth-ext";
// 前の道すじ 5 本（take・progress・finish・control・tool）は契約の口へ向け直す（K-62・apps/api/test/bridge_contract.ts）
let ob: OldBridge | undefined;
const viaContract = (): OldBridge => (ob ??= oldBridge(app));
const req = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  isMovedBridgePath(path)
    ? viaContract().call(path, body, headers)
    : app.request(`http://localhost${X}${path}`, {
        method,
        headers: { "content-type": "application/json", ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
const post = (path: string, body: unknown, h: Record<string, string> = {}) => req("POST", path, body, h);
const json = async <T>(r: Response | Promise<Response>) => ((await (await r).json()) as { data: T }).data;
const uniq = () => `qa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

beforeAll(async () => {
  await migrate(ADMIN, DB_PKG);
  await migrateAuth(ADMIN);
  admin = new pg.Pool({ connectionString: ADMIN, max: 2 });
  const appPool = createPool({ databaseUrl: APP_URL, max: 3 });
  const repo = await createRepository(appPool);
  const { auth } = keepAuth(
    createAuth({
      authDatabaseUrl: AUTH_URL,
      appPool,
      secret: "test-secret-0123456789-abcdefghijklmnop",
      baseURL: "http://localhost:3001",
      webBaseURL: "http://localhost:3123",
      mailer: async () => undefined,
    }),
  );
  const secrets = new SecretsGateway(repo, new MemoryVault(), Buffer.alloc(32, 9));
  const objects = new ObjectStore(repo, localDriver(mkdtempSync(join(tmpdir(), "kaname-obj-"))), {
    signingSecret: "test-files",
    maxBytes: 1024 * 1024,
  });
  app = createApp({
    repo,
    auth,
    // PC の口は契約の口（K-57・K-62）。PC の印で解き、振る舞いは delegate の hooks
    resolve: withDevice(createSessionResolver(auth, appPool), createDeviceResolver(appPool)) as never,
    contract: {
      hooks: {
        ...delegateHooks(appPool),
        // 招待は契約の口で受ける（K-337 で前の道すじから移した）。参加の口の hook（K-331〜K-333 の invitationHooks）を差す
        ...invitationHooks({
          auth,
          appPool,
          authPool: new pg.Pool({ connectionString: AUTH_URL, max: 2 }),
          // 参加の口の漏れたパスワードの照合（関門 C1）。試験は外に出ない（照合が落ちている間は照合せずに通す・D-128.134）
          actions: new ActionGateway(repo, {}, new RateLimiter(600), 1_000, async () => {
            throw new Error("試験は外に出ない");
          }),
          config: { opsEmail: "ops@example.com", webBaseUrl: "http://127.0.0.1:3123" },
        }),
      },
    },
    authExt: authExt({
      auth,
      appPool,
      authPool: new pg.Pool({ connectionString: AUTH_URL, max: 2 }),
      repo,
      secrets,
      objects,
      mailer: async (m) => void sent.push({ to: m.to, url: m.url, kind: m.kind }),
      config: {
        secretsMasterKey: "test-master",
        baseUrl: "http://localhost:3001",
        webBaseUrl: "http://localhost:3123",
        opsEmail: "ops@example.com",
        env: "test" as const,
      },
    }),
  });
}, 60_000);

/** 登録（確認メールを通す）→ Bridge をつなぐ */
async function ready() {
  const email = `${uniq()}@example.com`;
  // 申し込みは直に置き、確認だけを通す（前の道すじ /sign-up は K-51 で契約の口に移した）
  const ver = await verifiedUser(AUTH_URL, { email, password: PW, companyName: "K" });
  const H = { authorization: `Bearer ${ver.token}` };
  const bp = await pairForTest(admin, email);
  const B = { "x-bridge-session": bp.token };
  const member = (await admin.query("select member_id from sessions where id = $1", [bp.sid])).rows[0]
    .member_id as string;
  return { H, B, member };
}
describe("「覚えて」はその場で（D-105.1）", () => {
  it("印は返事から消え、個人の記憶に入り、会話に「覚えました」が出る。記憶に残さない会話では入れない", async () => {
    const { H, B, member } = await ready();
    const s = await json<{ conversation_id: string; job_id: string }>(
      post("/agent/say", { text: "請求書は税込を先に書くって覚えて" }, H),
    );
    await post("/bridge/take", { protocol: 5 }, B);
    await post(
      "/bridge/finish",
      { job_id: s.job_id, state: "done", result: "わかりました。\n\n[[覚える: 請求書は税込を先に書く]]" },
      B,
    );
    const st = await json<{ messages: { who: string; text: string; memory_id?: string }[] }>(
      req("GET", `/agent/state?conversation_id=${s.conversation_id}`, undefined, H),
    );
    expect(st.messages.map((m) => [m.who, m.text])).toEqual([
      ["me", "請求書は税込を先に書くって覚えて"],
      ["ai", "わかりました。"],
      ["memo", "請求書は税込を先に書く"],
    ]);
    expect(st.messages.at(-1)!.memory_id).toMatch(/^[0-9a-f-]{36}$/);
    const mem = await admin.query("select owner_member_id, body from memories where id = $1", [
      st.messages.at(-1)!.memory_id,
    ]);
    expect(mem.rows[0]).toEqual({ owner_member_id: member, body: "請求書は税込を先に書く" });
    const inc = await json<{ conversation_id: string }>(post("/agent/conversations", { incognito: true }, H));
    const s2 = await json<{ job_id: string }>(
      post("/agent/say", { text: "これは覚えないで", conversation_id: inc.conversation_id }, H),
    );
    await post("/bridge/take", { protocol: 5 }, B);
    await post("/bridge/finish", { job_id: s2.job_id, state: "done", result: "はい。[[覚える: 残さない会話の話]]" }, B);
    expect(
      (await admin.query("select count(*)::int as n from memories where body = '残さない会話の話'")).rows[0].n,
    ).toBe(0);
  });
});
