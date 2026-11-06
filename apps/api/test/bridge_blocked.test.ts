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
import { createSessionResolver } from "@kaname/auth/resolver";
import { createPool } from "@kaname/db/pool";
import { createRepository } from "@kaname/db/repository";
import { MemoryVault, SecretsGateway } from "@kaname/secrets";
import { ObjectStore } from "@kaname/storage";
import { localDriver } from "@kaname/storage/local";
import { createApp } from "../src/app.js";
import { authExt } from "../src/auth/ext.js";
import { keepAuth, verifiedUser } from "./_pending.js";

const DB_PKG = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "packages", "db");
const ADMIN = process.env["DATABASE_URL"]!;
const APP_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const AUTH_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@");
const PW = "Str0ng-Passw0rd!";
const sent: { to: string; url: string; kind: string }[] = [];
let app: ReturnType<typeof createApp>;
let admin: pg.Pool;
const X = "/api/auth-ext";
const req = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  app.request(`http://localhost${X}${path}`, {
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
    resolve: createSessionResolver(auth, appPool),
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
  const pair = await json<{ code: string }>(post("/bridge/pair", {}, H));
  const claim = await json<{ session_id: string }>(
    post("/bridge/claim", { code: pair.code, device_label: "QA の PC" }),
  );
  const B = { "x-bridge-session": claim.session_id };
  const member = (await admin.query("select member_id from sessions where id = $1", [claim.session_id])).rows[0]
    .member_id as string;
  return { H, B, member };
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
        post("/bridge/take", { protocol: 4 }, B),
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
    expect((await post("/bridge/heartbeat", { health: [{ name: "Claude Code", ok: true }] }, B)).status).toBe(200);
    const st = await json<{ health: { name: string; ok: boolean; fix?: string }[] }>(
      req("GET", "/bridge/state", undefined, H),
    );
    expect(st.health).toEqual(expect.arrayContaining([expect.objectContaining({ ok: false, fix: "update" })]));
    // 新しい版なら同じ仕事が渡り、「古い」は消える
    const job = await json<{ job_id: string }>(post("/bridge/take", { protocol: 4 }, B));
    expect(job.job_id).toBe(s.job_id);
    await post("/bridge/heartbeat", { health: [{ name: "Claude Code", ok: true }], protocol: 4 }, B);
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
    await json(post("/bridge/take", { protocol: 4 }, B));
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

describe("AI が使うブラウザを Kaname で選ぶ（D-120）", () => {
  it("CHT-37-009 既定は自分の Chrome。PC の画面で選んだ値が次の仕事に渡り、Bridge の窓でも同じ値を変えられ、心拍の返事で窓に写る。会話の無い仕事には渡らない", async () => {
    const { H, B } = await ready();
    const s1 = await json<{ job_id: string }>(post("/agent/say", { text: "開いて" }, H));
    const j1 = await json<{ job_id: string; browser: string }>(post("/bridge/take", { protocol: 4 }, B));
    expect(j1).toMatchObject({ job_id: s1.job_id, browser: "chrome" });
    await post("/bridge/finish", { job_id: s1.job_id, state: "done", result: "はい" }, B);
    expect(await json(post("/agent/browser", { browser: "off" }, H))).toEqual({ browser: "off" });
    expect((await post("/agent/browser", { browser: "firefox" }, H)).status).toBe(422);
    const st = await json<{ browser: string }>(req("GET", "/bridge/state", undefined, H));
    expect(st.browser).toBe("off");
    expect(await json(post("/bridge/heartbeat", { health: [], protocol: 4 }, B))).toEqual({ ok: true, browser: "off" });
    const s2 = await json<{ job_id: string }>(post("/agent/say", { text: "もう一度" }, H));
    expect(await json(post("/bridge/take", { protocol: 4 }, B))).toMatchObject({ job_id: s2.job_id, browser: "off" });
    await post("/bridge/finish", { job_id: s2.job_id, state: "done", result: "はい" }, B);
    // Bridge の窓から変える
    expect(await json(post("/bridge/browser", { browser: "dedicated" }, B))).toEqual({ browser: "dedicated" });
    expect((await json<{ browser: string }>(req("GET", "/bridge/state", undefined, H))).browser).toBe("dedicated");
    expect((await post("/bridge/browser", { browser: "x" }, B)).status).toBe(422);
  });
  it("CHT-37-011 もう一度確かめるは会話に属さない Chrome の仕事になり、押し重ねても 1 件。PC が閉じていれば断る", async () => {
    const { H, B, member } = await ready();
    await post("/bridge/heartbeat", { health: [], protocol: 4 }, B);
    const a = await post("/agent/browser-check", {}, H);
    expect(a.status).toBe(201);
    const { job_id } = ((await a.json()) as { data: { job_id: string } }).data;
    expect(await json(post("/agent/browser-check", {}, H))).toEqual({ job_id });
    const job = await json<{ job_id: string; browser: string; conversation_id: string | null; prompt: string }>(
      post("/bridge/take", { protocol: 4 }, B),
    );
    expect(job).toMatchObject({ job_id, browser: "chrome", conversation_id: null });
    expect(job.prompt).toContain("tabs_context_mcp");
    await post("/bridge/finish", { job_id, state: "done", result: "つながっています" }, B);
    const msgs = await admin.query("select count(*)::int as n from messages where job_id = $1", [job_id]);
    expect(msgs.rows[0].n, "会話には出さない").toBe(0);
    // PC が閉じている（知らせが 75 秒より前）
    await admin.query(
      "update sessions set last_seen_at = now() - interval '5 minutes', issued_at = now() - interval '5 minutes' where member_id = $1 and kind_id = 'bridge'",
      [member],
    );
    const off = await post("/agent/browser-check", {}, H);
    expect(off.status).toBe(409);
    expect(((await off.json()) as { message: string }).message).toContain("Bridge が動いていない");
  });
});
