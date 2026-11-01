// 2 段階認証（T-B-39・D-117.2〜D-117.5）の Kaname 側を本物の Postgres で通す。
//   種類を選んで預ける／Bridge が頼む（asking）→ 本人がコードを入れる → Bridge が 1 回だけ取る（取ったら消える）／もう一度試すは本人が押したときだけ
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

const DB_PKG = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "packages", "db");
const ADMIN = process.env["DATABASE_URL"] ?? "postgres://postgres:postgres@127.0.0.1:55433/kaname_test";
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
type Cred = {
  id: string;
  two_factor: string;
  login_check: { state: string; detail: string | null } | null;
  asking: { request_id: string; kind: string; text: string } | null;
};

beforeAll(async () => {
  await migrate(ADMIN, DB_PKG);
  await migrateAuth(ADMIN);
  admin = new pg.Pool({ connectionString: ADMIN, max: 2 });
  const appPool = createPool({ databaseUrl: APP_URL, max: 3 });
  const repo = await createRepository(appPool);
  const { auth } = createAuth({
    authDatabaseUrl: AUTH_URL,
    appPool,
    secret: "test-secret-0123456789-abcdefghijklmnop",
    baseURL: "http://localhost:3001",
    webBaseURL: "http://localhost:3123",
    mailer: async () => undefined,
  });
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

async function ready() {
  const email = `${uniq()}@example.com`;
  expect((await post("/sign-up", { email, password: PW, company_name: "K" })).status).toBe(201);
  const mail = sent.filter((m) => m.to === email && m.kind === "verify").at(-1)!;
  const ver = await json<{ token: string }>(
    post("/verify-signup", { token: new URL(mail.url).searchParams.get("token") }),
  );
  const H = { authorization: `Bearer ${ver.token}` };
  const pair = await json<{ code: string }>(post("/bridge/pair", {}, H));
  const claim = await json<{ session_id: string }>(
    post("/bridge/claim", { code: pair.code, device_label: "QA の PC" }),
  );
  const B = { "x-bridge-session": claim.session_id };
  const store = (extra: Record<string, unknown> = {}) =>
    post(
      "/vault/credentials",
      {
        service_name: "http://127.0.0.1:3124/dev/fake-login?mode=sms",
        login: "me@example.com",
        password: "S3cret-Plain!",
        ...extra,
      },
      H,
    );
  const list = async () => json<Cred[]>(req("GET", "/vault/credentials", undefined, H));
  const take = () =>
    json<{ job_id: string; kind: string; credential_id: string | null } | null>(
      post("/bridge/take", { protocol: 4 }, B),
    );
  return { H, B, store, list, take, member: claim, email };
}

describe("CHT-39-001 預けるときに 2 段階の種類を選べる（D-117.2）", () => {
  it("CHT-39-001 なし／認証アプリ／SMS／メール／スマホで承認 が保存され、一覧に出る。認証アプリは鍵が要る（無ければ 422）。鍵だけ入れたら認証アプリ", async () => {
    const r = await ready();
    for (const tf of ["none", "sms", "email", "push"]) expect((await r.store({ two_factor: tf })).status, tf).toBe(201);
    expect((await r.store({ two_factor: "totp", totp_secret: "JBSWY3DPEHPK3PXP" })).status).toBe(201);
    expect((await r.store({ totp_secret: "JBSWY3DPEHPK3PXP" })).status).toBe(201);
    const no = await r.store({ two_factor: "totp" });
    expect(no.status).toBe(422);
    expect(await no.json()).toMatchObject({ code: "E-VAL-003", field: "totp_secret" });
    expect((await r.store({ two_factor: "fax" })).status).toBe(201); // 知らない種類は「なし」
    const rows = await r.list();
    expect(rows.map((x) => x.two_factor)).toEqual(["none", "sms", "email", "push", "totp", "totp", "none"]);
    const kinds = await admin.query(
      "select two_factor_id, kind_id from credentials where id = any($1::uuid[]) order by created_at",
      [rows.map((x) => x.id)],
    );
    expect(kinds.rows.map((x: { kind_id: string }) => x.kind_id)).toEqual([
      "basic",
      "basic",
      "basic",
      "basic",
      "password_totp",
      "password_totp",
      "basic",
    ]);
  });
});

describe("CHT-39-002 Bridge がコードの画面で止まって本人に頼む。入れたコードは Bridge だけに渡る（D-117.3）", () => {
  it("CHT-39-002 Bridge が頼む（asking）→ 一覧に「コードを入れてください」→ 本人が入れる → Bridge が 1 回だけ取る（取ったら行から消える・証跡に無い）→ 結果 ok", async () => {
    const r = await ready();
    const stored = ((await (await r.store({ two_factor: "sms" })).json()) as { data: { id: string } }).data;
    const took = await r.take();
    expect(took).toMatchObject({ kind: "login_check", credential_id: stored.id });
    const jobId = took!.job_id;
    // Bridge が頼む
    const ask = await post(
      "/bridge/ask",
      {
        job_id: jobId,
        request_id: "req-1",
        tool: "TwoFactorCode",
        summary: "発注ナビ から届いたSMSのコードを入れてください",
      },
      r.B,
    );
    expect(ask.status).toBe(201);
    let row = (await r.list())[0]!;
    expect(row.asking).toEqual({
      request_id: "req-1",
      kind: "code",
      text: "発注ナビ から届いたSMSのコードを入れてください",
    });
    // メールでも知らせる（D-117.3 の通知・C6）。本文に値は無い（試験では宛先・種類・行き先だけ記録している）
    const mail = sent.filter((m) => m.to === r.email && m.kind === "code");
    expect(mail).toHaveLength(1);
    expect(mail[0]!.url).toContain("/settings/credentials");
    expect(row.login_check).toMatchObject({ state: "running" });
    // まだ答えが無い
    expect(
      await json<{ code: string | null }>(post("/bridge/code", { job_id: jobId, request_id: "req-1" }, r.B)),
    ).toEqual({ code: null });
    // 本人が入れる（全角・空白は直して通す）
    expect(
      (await post(`/vault/credentials/${stored.id}/answer`, { request_id: "req-1", code: "２４６ ８１０" }, r.H))
        .status,
    ).toBe(201);
    row = (await r.list())[0]!;
    expect(row.asking).toBeNull(); // 答えたので頼みは消える
    // Bridge が取る：1 回だけ。2 回目は null
    expect(
      await json<{ code: string | null }>(post("/bridge/code", { job_id: jobId, request_id: "req-1" }, r.B)),
    ).toEqual({ code: "246810" });
    expect(
      await json<{ code: string | null }>(post("/bridge/code", { job_id: jobId, request_id: "req-1" }, r.B)),
    ).toEqual({ code: null });
    // 記録のどこにも無い
    const ev = await admin.query("select kind, payload from bridge_job_events where job_id = $1 order by created_at", [
      jobId,
    ]);
    expect(JSON.stringify(ev.rows)).not.toContain("246810");
    expect(ev.rows.find((x: { kind: string }) => x.kind === "answer")!.payload).toMatchObject({
      taken: true,
      allow: true,
    });
    const a = await admin.query(
      "select action, choke_point_id, payload from audit_events where action = 'credential.two_factor_answered' and target_id = $1",
      [stored.id],
    );
    expect(a.rows).toHaveLength(1);
    expect(a.rows[0]).toMatchObject({ choke_point_id: "C6", payload: { request_id: "req-1", kind: "TwoFactorCode" } });
    expect(JSON.stringify(a.rows)).not.toContain("246810");
    // 結果
    expect(
      (
        await post(
          "/bridge/credentials/check-result",
          { job_id: jobId, state: "ok", detail: "ログインできました（入れてもらったコードで通りました）" },
          r.B,
        )
      ).status,
    ).toBe(200);
    expect((await r.list())[0]!.login_check).toMatchObject({ state: "ok" });
  });

  it("CHT-39-002 スマホで承認：「承認した」は approved として Bridge に渡る。他人の資格情報には答えられない（404）。空のコードは 422", async () => {
    const r = await ready();
    const stored = ((await (await r.store({ two_factor: "push" })).json()) as { data: { id: string } }).data;
    const took = await r.take();
    await post(
      "/bridge/ask",
      { job_id: took!.job_id, request_id: "req-p", tool: "TwoFactorApprove", summary: "スマホで承認してください" },
      r.B,
    );
    expect((await r.list())[0]!.asking).toMatchObject({ kind: "approve" });
    const other = await ready();
    expect(
      (await post(`/vault/credentials/${stored.id}/answer`, { request_id: "req-p", approved: true }, other.H)).status,
    ).toBe(404);
    expect((await post(`/vault/credentials/${stored.id}/answer`, { request_id: "req-p", code: "" }, r.H)).status).toBe(
      422,
    );
    expect(
      (await post(`/vault/credentials/${stored.id}/answer`, { request_id: "req-p", approved: true }, r.H)).status,
    ).toBe(201);
    // 他人の Bridge は取れない（本人が取る前に試す：取った後は誰にも null なので、順番を逆にすると何も確かめない）
    expect(
      await json<{ code: string | null }>(post("/bridge/code", { job_id: took!.job_id, request_id: "req-p" }, other.B)),
    ).toEqual({ code: null });
    expect(
      await json<{ code: string | null }>(post("/bridge/code", { job_id: took!.job_id, request_id: "req-p" }, r.B)),
    ).toEqual({ code: "approved" });
  });
});

describe("CHT-39-004 10 分返事が無ければ止め、本人が「もう一度試す」を押したときだけ回す（D-117.5）", () => {
  it("CHT-39-004 no_answer で止まる → 行に理由 → もう一度試す（201・新しい仕事）。試している最中・頼んでいる最中は 409", async () => {
    const r = await ready();
    const stored = ((await (await r.store({ two_factor: "sms" })).json()) as { data: { id: string } }).data;
    const took = await r.take();
    // 試している最中は積めない
    expect((await post(`/vault/credentials/${stored.id}/login-check`, {}, r.H)).status).toBe(409);
    await post("/bridge/ask", { job_id: took!.job_id, request_id: "req-1", tool: "TwoFactorCode", summary: "x" }, r.B);
    expect((await post(`/vault/credentials/${stored.id}/login-check`, {}, r.H)).status).toBe(409);
    // Bridge が 10 分待って諦めた
    expect(
      (
        await post(
          "/bridge/credentials/check-result",
          {
            job_id: took!.job_id,
            state: "no_answer",
            detail:
              "10 分返事が無かったので止めました。いるときに「もう一度試す」を押してください（勝手には試しません）",
          },
          r.B,
        )
      ).status,
    ).toBe(200);
    const row = (await r.list())[0]!;
    expect(row.login_check).toMatchObject({ state: "no_answer", detail: expect.stringContaining("もう一度試す") });
    expect(row.asking).toBeNull();
    expect((await admin.query("select state_id from bridge_jobs where id = $1", [took!.job_id])).rows[0]).toMatchObject(
      { state_id: "stopped" },
    );
    // 勝手には積まれていない
    expect(await r.take()).toBeNull();
    // 本人が押す → 新しい仕事が 1 件
    const again = await post(`/vault/credentials/${stored.id}/login-check`, {}, r.H);
    expect(again.status).toBe(201);
    expect((await r.list())[0]!.login_check).toMatchObject({ state: "pending" });
    const n = await admin.query("select count(*) as n from bridge_jobs where credential_id = $1", [stored.id]);
    expect(Number(n.rows[0].n)).toBe(2);
    // 他人は押せない
    const other = await ready();
    expect((await post(`/vault/credentials/${stored.id}/login-check`, {}, other.H)).status).toBe(409);
  });
});
