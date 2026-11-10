// 預けたらその場で 1 回ログインだけ試す（T-B-38・D-117.1）の Kaname 側を本物の Postgres で通す。
//   預けた直後に Bridge の仕事（login_check）が 1 件積まれ、Bridge が取って結果を 1 回だけ返し、預けたものの行に出る。禁止・銀行は試さない。PC が無ければ積まない
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
type Cred = {
  id: string;
  service_name: string;
  login_check: { state: string; detail: string | null; at: string | null } | null;
};

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
    contract: { hooks: delegateHooks(appPool) },
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

/** 登録 →（bridge なら）Bridge をつなぐ */
async function ready(opts: { bridge?: boolean } = { bridge: true }) {
  const email = `${uniq()}@example.com`;
  // 申し込みは直に置き、確認だけを通す（前の道すじ /sign-up は K-51 で契約の口に移した）
  const ver = await verifiedUser(AUTH_URL, { email, password: PW, companyName: "K" });
  const H = { authorization: `Bearer ${ver.token}` };
  let B: Record<string, string> = {};
  if (opts.bridge) {
    const bp = await pairForTest(admin, email);
    B = { "x-bridge-session": bp.token };
  }
  const store = (service_name = "http://127.0.0.1:3124/dev/fake-login") =>
    post("/vault/credentials", { service_name, login: "me@example.com", password: "S3cret-Plain!" }, H);
  const list = async () => json<Cred[]>(req("GET", "/vault/credentials", undefined, H));
  const take = () =>
    json<{
      job_id: string;
      kind: string;
      credential_id: string | null;
      browser: string;
      tool_token: string | null;
    } | null>(post("/bridge/take", { protocol: 5 }, B));
  const result = (body: unknown, h = B) => post("/bridge/credentials/check-result", body, h);
  return { H, B, store, list, take, result };
}

describe("CHT-38-001 預けたら 1 回ログインし、入れたらそのまま出る：Kaname は仕事を 1 件積み、Bridge の結果を預けたものの行に出す", () => {
  it("CHT-38-001 預けた直後に login_check の仕事が 1 件（専用のブラウザ・会話なし）。行は「順番待ち」→ 取ると「試している」→ 結果 ok で「ログインできました」。証跡は C1", async () => {
    const r = await ready();
    const s = await r.store();
    expect(s.status).toBe(201);
    const stored = ((await s.json()) as { data: { id: string; login_check_job_id: string | null } }).data;
    expect(stored.login_check_job_id).toMatch(/^[0-9a-f-]{36}$/);
    expect((await r.list())[0]!.login_check).toMatchObject({ state: "pending" });
    const job = (
      await admin.query(
        "select kind, credential_id, browser, conversation_id, state_id from bridge_jobs where id = $1",
        [stored.login_check_job_id],
      )
    ).rows[0];
    expect(job).toMatchObject({
      kind: "login_check",
      credential_id: stored.id,
      browser: "dedicated",
      conversation_id: null,
      state_id: "queued",
    });
    // Bridge が取る：種類と資格情報の id が付く。AI の道具の鍵は付かない（会話ではない）
    const took = await r.take();
    expect(took).toMatchObject({
      job_id: stored.login_check_job_id,
      kind: "login_check",
      credential_id: stored.id,
      browser: "dedicated",
      tool_token: null,
    });
    expect((await r.list())[0]!.login_check).toMatchObject({ state: "running" });
    // その仕事で鍵を受け取れる（T-B-05 の口がそのまま使える）。宛先も付く
    const got = await post("/bridge/credentials/resolve", { job_id: took!.job_id, credential_id: stored.id }, r.B);
    expect(got.status).toBe(200);
    expect(((await got.json()) as { data: Record<string, unknown> }).data).toMatchObject({
      login: "me@example.com",
      service_name: "http://127.0.0.1:3124/dev/fake-login",
      service_domain: null,
    }); // IP の宛先は domain を持たない（URL のまま開く）
    // 結果
    expect((await r.result({ job_id: took!.job_id, state: "ok", detail: "ログインできました" })).status).toBe(200);
    const row = (await r.list())[0]!;
    expect(row.login_check).toMatchObject({ state: "ok", detail: "ログインできました" });
    expect(row.login_check!.at).toBeTruthy();
    expect(
      (await admin.query("select state_id, result from bridge_jobs where id = $1", [took!.job_id])).rows[0],
    ).toMatchObject({ state_id: "done", result: "ok" });
    const a = await admin.query(
      "select choke_point_id, payload from audit_events where action = 'credential.login_check' and target_id = $1",
      [stored.id],
    );
    expect(a.rows).toHaveLength(1);
    expect(a.rows[0]).toMatchObject({ choke_point_id: "C1", payload: { state: "ok", job_id: took!.job_id } });
    expect(JSON.stringify(a.rows)).not.toContain("S3cret");
    // 何度も試さない：同じ仕事にもう一度は書けない（404）
    expect((await r.result({ job_id: took!.job_id, state: "bad_password", detail: "x" })).status).toBe(404);
    expect((await r.list())[0]!.login_check).toMatchObject({ state: "ok" });
  });

  it("CHT-38-001 他人の Bridge は結果を書けない（404）。形が違う結果は 422。Bridge の鍵が無ければ 401", async () => {
    const r = await ready();
    const stored = ((await (await r.store()).json()) as { data: { login_check_job_id: string } }).data;
    const took = await r.take();
    const other = await ready();
    expect((await r.result({ job_id: took!.job_id, state: "ok", detail: "" }, other.B)).status).toBe(404);
    expect((await r.result({ job_id: took!.job_id, state: "logged_in", detail: "" })).status).toBe(422);
    expect((await r.result({ job_id: took!.job_id, state: "ok", detail: "" }, {})).status).toBe(401);
    expect((await r.list())[0]!.login_check).toMatchObject({ state: "running" });
    void stored;
  });
});

describe("CHT-38-002 入れなければ理由を出す（パスワードが違う／2 段階が要る／CAPTCHA／規約で禁止なので試さない）。何度も試さない", () => {
  it("CHT-38-002 Bridge が返した理由がそのまま行に出る（値は無い）", async () => {
    for (const [state, detail] of [
      ["bad_password", "ログイン名かパスワードが違うようです。確かめて預け直してください"],
      ["needs_2fa", "2 段階認証のコードを求められました"],
      ["captcha", "CAPTCHA が出るサービスです"],
      ["unreachable", "サービスのページを開けませんでした"],
      ["no_form", "ログインの欄が見つかりませんでした"],
    ] as const) {
      const r = await ready();
      await r.store();
      const took = await r.take();
      expect((await r.result({ job_id: took!.job_id, state, detail })).status).toBe(200);
      const row = (await r.list())[0]!;
      expect(row.login_check, state).toMatchObject({ state, detail });
      // 仕事は 1 回で閉じる（積み直さない）
      expect(await r.take()).toBeNull();
    }
  });

  it("CHT-38-002 規約で禁止のサービスは試さない：仕事を積まず、行に理由が出る", async () => {
    const r = await ready();
    const name = `禁止サービス-${uniq()}`;
    await admin.query(
      "insert into service_registry (tenant_id, name, domain, automation_verdict_id) values (app.ops_tenant_id(), $1, $2, 'forbidden')",
      [name, `${uniq()}.example`],
    );
    try {
      const s = ((await (await r.store(name)).json()) as { data: { login_check_job_id: string | null } }).data;
      expect(s.login_check_job_id).toBeNull();
      expect((await r.list())[0]!.login_check).toMatchObject({
        state: "forbidden",
        detail: expect.stringContaining("禁止"),
      });
      expect(await r.take()).toBeNull();
    } finally {
      await admin.query(
        "update credentials set service_id = null where service_id in (select id from service_registry where name = $1)",
        [name],
      );
      await admin.query("delete from service_registry where name = $1", [name]);
    }
  });

  it("CHT-38-002 PC（Bridge）を 1 台もつないでいなければ積まない：行は「PC をつなぐと試します」", async () => {
    const r = await ready({ bridge: false });
    const s = ((await (await r.store()).json()) as { data: { login_check_job_id: string | null } }).data;
    expect(s.login_check_job_id).toBeNull();
    expect((await r.list())[0]!.login_check).toMatchObject({ state: "no_bridge" });
  });

  it("CHT-38-002 Bridge が途中で止まった（残りの後始末）→ 行は「途中で止まりました」。黙って「試しています」のままにしない（G-15）", async () => {
    const r = await ready();
    await r.store();
    const took = await r.take();
    expect((await r.list())[0]!.login_check).toMatchObject({ state: "running" });
    // Bridge が「いま何も動かしていない」と言って来た＝途中で死んでいた
    await post("/bridge/take", { protocol: 5, idle: true }, r.B);
    expect((await admin.query("select state_id from bridge_jobs where id = $1", [took!.job_id])).rows[0]).toMatchObject(
      { state_id: "stopped" },
    );
    expect((await r.list())[0]!.login_check).toMatchObject({
      state: "stopped",
      detail: expect.stringContaining("途中で止まった"),
    });
  });
});

describe("CHT-38-003 鍵は実行の間だけ受け取り、ディスクにも AI にも渡らない", () => {
  it("CHT-38-003 Kaname 側：仕事の行・証跡・一覧のどこにも値が無い。仕事が閉じた後は鍵を受け取れない（403）", async () => {
    const r = await ready();
    const stored = ((await (await r.store()).json()) as { data: { id: string; login_check_job_id: string } }).data;
    const took = await r.take();
    await r.result({ job_id: took!.job_id, state: "ok", detail: "ログインできました" });
    const dump = JSON.stringify([
      (await admin.query("select * from bridge_jobs where id = $1", [took!.job_id])).rows,
      (await admin.query("select * from credentials where id = $1", [stored.id])).rows,
      (await admin.query("select * from audit_events where target_id = $1", [stored.id])).rows,
      await r.list(),
    ]);
    expect(dump).not.toContain("S3cret-Plain!");
    expect(
      (await post("/bridge/credentials/resolve", { job_id: took!.job_id, credential_id: stored.id }, r.B)).status,
    ).toBe(403);
  });
});
