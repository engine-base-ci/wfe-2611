// 禁止のサービスと銀行を PC の上で止める（D-107・T-B-24）の API 側を本物の Postgres で通す。
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
import { pairForTest } from "./bridge_pair.js";
import { withDevice } from "../src/middleware/tenant.js";
import { bridgeHooks } from "../src/hooks/bridge.js";
import { isMovedBridgePath, oldBridge, type OldBridge } from "./bridge_contract.js";
import { delegateHooks } from "../src/hooks/delegate.js";
/** 生きている知らせ（契約の口 POST /api/v1/bridge/heartbeat・K-57） */
const heartbeat = (body: unknown, h: Record<string, string>) =>
  app.request("http://localhost/api/v1/bridge/heartbeat", {
    method: "POST",
    headers: { "content-type": "application/json", ...h },
    body: JSON.stringify(body),
  });

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
    // 生きている知らせは契約の口（K-57）。PC の印で解き、振る舞いは connect-pc の hooks
    resolve: withDevice(createSessionResolver(auth, appPool), createDeviceResolver(appPool)) as never,
    contract: {
      hooks: { ...delegateHooks(appPool), ...bridgeHooks({ appPool, release: { dir: "", base: "" }, objects }) },
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
  return { H, B, member, sid: bp.sid };
}

describe("禁止の宛先を Bridge に渡す・止めた記録（D-107）", () => {
  it("仕事と一緒に台帳の forbidden／bank のドメインだけが渡り（形を揃える・資格情報は無い）、blocked を送ると仕事の出来事と証跡に残る", async () => {
    const d = `qa-${Date.now().toString(36)}.example.jp`;
    // 台帳は運営の会社の行（他のテストが会社の表を片付けても、運営の会社は migration と同じく在る状態にする）
    await admin.query(
      "insert into tenants (id, tenant_id, name) values (app.ops_tenant_id(), app.ops_tenant_id(), '運営') on conflict do nothing",
    );
    await admin.query(
      "insert into service_registry (tenant_id, name, domain, automation_verdict_id) values (app.ops_tenant_id(), 'QA銀行', $1, 'bank'), (app.ops_tenant_id(), 'QA会計', $2, 'api')",
      [`https://www.${d}/login`, `acct.${d}`],
    );
    try {
      const { H, B, member } = await ready();
      const s = await json<{ job_id: string }>(post("/agent/say", { text: "銀行の入出金" }, H));
      const job = await json<{ job_id: string; blocked: { domain: string; service: string; verdict: string }[] }>(
        post("/bridge/take", { protocol: 5 }, B),
      );
      expect(job.job_id).toBe(s.job_id);
      const mine = job.blocked.filter((x) => x.domain.endsWith(d));
      expect(mine).toEqual([{ domain: d, service: "QA銀行", verdict: "bank" }]);
      expect(JSON.stringify(job.blocked)).not.toMatch(/vault|secret|password|token/i);
      const r = await post(
        "/bridge/progress",
        {
          job_id: s.job_id,
          seq: 1,
          kind: "blocked",
          blocked: { tool: "Bash", domain: d, service: "QA銀行", target: `curl https://www.${d}/login` },
        },
        B,
      );
      expect(r.status).toBe(200);
      const ev = await admin.query("select payload from bridge_job_events where job_id = $1 and kind = 'blocked'", [
        s.job_id,
      ]);
      expect(ev.rows.map((x) => x.payload)).toEqual([
        { tool: "Bash", domain: d, service: "QA銀行", target: `curl https://www.${d}/login` },
      ]);
      const au = await admin.query(
        "select actor_member_id, choke_point_id, payload from audit_events where action = 'agent.blocked' and target_id = $1",
        [s.job_id],
      );
      expect(au.rows).toEqual([
        {
          actor_member_id: member,
          choke_point_id: "C1",
          payload: { tool: "Bash", domain: d, service: "QA銀行", target: `curl https://www.${d}/login` },
        },
      ]);
      expect((await post("/bridge/progress", { job_id: s.job_id, seq: 2, kind: "nope" }, B)).status).toBe(422);
    } finally {
      await admin.query("delete from service_registry where domain like $1", [`%${d}%`]);
    }
  });
});

describe("古い Bridge には仕事を渡さない（E-CONN-012）", () => {
  it("約束の版を送らない Bridge には、積まれた仕事も渡さず、PC の状態に「古い」と出る。新しい版なら渡る", async () => {
    const { H, B } = await ready();
    const s = await json<{ job_id: string }>(post("/agent/say", { text: "こんにちは" }, H));
    const old = (await (await post("/bridge/take", {}, B)).json()) as { data: unknown; outdated?: boolean };
    expect(old).toMatchObject({ data: null, outdated: true });
    expect((await heartbeat({ health: [{ name: "Claude Code", ok: true }] }, B)).status).toBe(201);
    const st = await json<{ health: { name: string; ok: boolean; fix?: string }[] }>(
      req("GET", "/bridge/state", undefined, H),
    );
    expect(st.health).toEqual(expect.arrayContaining([expect.objectContaining({ ok: false, fix: "update" })]));
    // 新しい版なら同じ仕事が渡り、「古い」は消える
    const job = await json<{ job_id: string }>(post("/bridge/take", { protocol: 5 }, B));
    expect(job.job_id).toBe(s.job_id);
    await heartbeat({ health: [{ name: "Claude Code", ok: true }], protocol: 5 }, B);
    const st2 = await json<{ health: { fix?: string }[] }>(req("GET", "/bridge/state", undefined, H));
    expect(st2.health.some((h) => h.fix === "update")).toBe(false);
  });
});

describe("Bridge からの知らせ（D-119.4）", () => {
  it("CHT-37-006 AI がブラウザを使えなかった知らせは会話に 1 行残り（同じ仕事で同じ文は 1 回だけ）、本人の画面の会話に出る", async () => {
    const { H, B } = await ready();
    const s = await json<{ job_id: string; conversation_id: string }>(
      post("/agent/say", { text: "example.com を開いて" }, H),
    );
    await json(post("/bridge/take", { protocol: 5 }, B));
    const text =
      "AI が Chrome を使えませんでした。Chrome を開き、拡張機能「Claude in Chrome」が入っていてこの Claude と同じアカウントでログインしているか確かめてください。ブラウザを使わない作業はそのまま続けます";
    expect((await post("/bridge/progress", { job_id: s.job_id, seq: 1, kind: "notice", text }, B)).status).toBe(200);
    expect((await post("/bridge/progress", { job_id: s.job_id, seq: 2, kind: "notice", text }, B)).status).toBe(200);
    const m = await admin.query("select body, kind from messages where job_id = $1 and kind = 'note'", [s.job_id]);
    expect(m.rows).toEqual([{ body: text, kind: "note" }]);
    const st = await json<{ messages: { who: string; text: string }[] }>(
      req("GET", `/agent/state?conversation_id=${s.conversation_id}`, undefined, H),
    );
    expect(st.messages.filter((x) => x.who === "note").map((x) => x.text)).toEqual([text]);
    // 空の知らせは残さない
    expect((await post("/bridge/progress", { job_id: s.job_id, seq: 3, kind: "notice", text: "  " }, B)).status).toBe(
      200,
    );
    expect(
      (await admin.query("select count(*)::int as n from messages where job_id = $1 and kind = 'note'", [s.job_id]))
        .rows[0].n,
    ).toBe(1);
  });
});

// K-367：「AI が使うブラウザを Kaname で選ぶ（D-120）」の 2 本（CHT-37-009・CHT-37-011）は、前の道すじ（/agent/browser・/agent/browser-check・/bridge/browser）を消したので外した。
//   選ぶのは契約の口 updateMyDevice（K-364）・確かめは checkMyDeviceBrowser（K-365）・Bridge の窓は setBridgeBrowser（K-366）の試験が持つ
