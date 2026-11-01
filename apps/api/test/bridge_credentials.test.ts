// 鍵を受け取る（T-B-05・D-102.2・D-017.1）の Kaname 側を本物の Postgres と関門 C8 で通す。
//   本人の Bridge・本人の動いている仕事・本人の資格情報、の 3 つがそろったときだけ値が出る。AI・画面・他社・失効・止まった仕事には出ない
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
import { MemoryVault, SecretsGateway, type StoredSecret } from "@kaname/secrets";
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
let secrets: SecretsGateway;
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

/** 届かなくなる預かり先（G-11）：down の間は読めない */
class FlakyVault extends MemoryVault {
  down = false;
  override async get(ref: string, tenantId?: string): Promise<StoredSecret | null> {
    if (this.down) throw new Error("ECONNREFUSED");
    return super.get(ref, tenantId);
  }
}
const vault = new FlakyVault();

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
  secrets = new SecretsGateway(repo, vault, Buffer.alloc(32, 9));
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

/** 登録 → Bridge をつなぐ → 資格情報を 1 件預ける → 会話の仕事を 1 件渡して running にする */
async function ready(opts: { job?: boolean } = { job: true }) {
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
  const member = (await admin.query("select member_id, tenant_id from sessions where id = $1", [claim.session_id]))
    .rows[0] as { member_id: string; tenant_id: string };
  const stored = await json<{ vault_ref: string }>(
    post(
      "/vault/credentials",
      { service_name: "発注ナビ", login: "me@example.com", password: "S3cret-Plain!", totp_secret: "JBSWY3DPEHPK3PXP" },
      H,
    ),
  );
  const credId = (await admin.query("select id from credentials where vault_ref = $1", [stored.vault_ref])).rows[0]
    .id as string;
  let jobId: string | null = null;
  if (opts.job) {
    // 預けた直後に積まれる「1 回だけログインを試す」仕事（T-B-38）が、この人の動いている仕事になる。Bridge が取る
    const job = await json<{ job_id: string; kind: string; credential_id: string }>(
      post("/bridge/take", { protocol: 4 }, B),
    );
    expect(job).toMatchObject({ kind: "login_check", credential_id: credId });
    jobId = job.job_id;
  }
  const resolve = (body: unknown, h: Record<string, string> = B) => post("/bridge/credentials/resolve", body, h);
  return { H, B, member, credId, jobId: jobId!, vaultRef: stored.vault_ref, resolve };
}
/** Bridge の受け取りに関する証跡だけ（預けたときの credentials.create は別） */
const auditsOf = async (tenant: string, cred: string) =>
  (
    await admin.query(
      "select action, choke_point_id, payload from audit_events where tenant_id = $1 and target_type = 'credentials' and target_id = $2 and action like 'credential.bridge_%' order by created_at",
      [tenant, cred],
    )
  ).rows as {
    action: string;
    choke_point_id: string;
    payload: Record<string, unknown>;
  }[];

describe("BRG-05-004 鍵を受け取る：本人の Bridge・動いている仕事・本人の資格情報がそろったときだけ、関門 C8 が解いた値が 1 回出る", () => {
  it("BRG-05-004 そろっている → 200 で login・password・totp が出る。証跡は C8 で 1 行（値は書かない）。一覧には値が出ない", async () => {
    const r = await ready();
    const res = await r.resolve({ job_id: r.jobId, credential_id: r.credId });
    expect(res.status).toBe(200);
    const d = ((await res.json()) as { data: Record<string, unknown> }).data;
    expect(d).toEqual({
      login: "me@example.com",
      password: "S3cret-Plain!",
      totp_secret: "JBSWY3DPEHPK3PXP",
      service_name: "発注ナビ",
      service_domain: null, // 名前だけで預けた（URL ではない）
      two_factor: "totp", // 鍵（totp_secret）を入れて預けたので認証アプリ
    });
    const a = await auditsOf(r.member.tenant_id, r.credId);
    expect(a.map((x) => [x.action, x.choke_point_id])).toEqual([["credential.bridge_resolve", "C8"]]);
    expect(a[0]!.payload).toMatchObject({ job_id: r.jobId, service_name: "発注ナビ" });
    expect(JSON.stringify(a)).not.toContain("S3cret-Plain!");
    // 関門 C8 の秘密の側にも「解いた」証跡が残る（SecretsGateway.finish）。値は無い
    const sec = await admin.query(
      "select action, payload from audit_events where tenant_id = $1 and target_type = 'secret' and target_id = $2 order by created_at",
      [r.member.tenant_id, r.vaultRef],
    );
    expect(sec.rows.map((x: { action: string }) => x.action)).toContain("secret.resolve");
    expect(JSON.stringify(sec.rows)).not.toContain("S3cret-Plain!");
    // 画面の一覧（D-108.3）は中身を返さない
    const list = await req("GET", "/vault/credentials", undefined, r.H);
    expect(JSON.stringify(await list.json())).not.toContain("S3cret-Plain!");
  });

  it("BRG-05-004 Bridge の鍵が無い／ログインの鍵を Bridge の鍵として出す → 401。何も解かれない", async () => {
    const r = await ready();
    expect((await r.resolve({ job_id: r.jobId, credential_id: r.credId }, {})).status).toBe(401);
    expect(
      (
        await r.resolve(
          { job_id: r.jobId, credential_id: r.credId },
          { "x-bridge-session": r.H.authorization.slice(7) },
        )
      ).status,
    ).toBe(401);
    expect(await auditsOf(r.member.tenant_id, r.credId)).toEqual([]);
  });

  it("BRG-05-004 仕事が動いていない（渡していない・他人の仕事・終わった仕事）→ 403 と理由。証跡に拒んだことが残る", async () => {
    const r = await ready({ job: false });
    const other = await ready(); // 他人の動いている仕事
    for (const job of [other.jobId, "00000000-0000-4000-8000-000000000000"]) {
      const res = await r.resolve({ job_id: job, credential_id: r.credId });
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({
        code: "JOB_NOT_RUNNING",
        message: expect.stringContaining("動いている仕事"),
        handoff: expect.any(String),
      });
    }
    // 自分の仕事でも、終わっていれば出ない
    const s = await json<{ job_id: string }>(post("/agent/say", { text: "x" }, r.H));
    await json(post("/bridge/take", { protocol: 4 }, r.B));
    await admin.query("update bridge_jobs set state_id = 'done', finished_at = now() where id = $1", [s.job_id]);
    expect((await r.resolve({ job_id: s.job_id, credential_id: r.credId })).status).toBe(403);
    const a = await auditsOf(r.member.tenant_id, r.credId);
    expect(a.map((x) => x.action)).toEqual([
      "credential.bridge_denied",
      "credential.bridge_denied",
      "credential.bridge_denied",
    ]);
    expect(a.every((x) => x.payload["reason"] === "job_not_running" && x.choke_point_id === "C8")).toBe(true);
  });

  it("BRG-05-004 BRG-14-002 他社・他人の資格情報 → 404（あることも教えない）。消したもの → 404。失効したもの → 403 と預け直しの一手", async () => {
    const me = await ready();
    const other = await ready();
    const x = await me.resolve({ job_id: me.jobId, credential_id: other.credId });
    expect(x.status).toBe(404);
    expect(await auditsOf(other.member.tenant_id, other.credId)).toEqual([]);
    // 失効（D-017.1：アカウントの状態が変わった等）
    await admin.query("update credentials set revoked_at = now() where id = $1", [me.credId]);
    const rv = await me.resolve({ job_id: me.jobId, credential_id: me.credId });
    expect(rv.status).toBe(403);
    expect(await rv.json()).toMatchObject({ code: "CREDENTIAL_REVOKED", handoff: "預け直す" });
    // 消した
    await admin.query("update credentials set deleted_at = now() where id = $1", [me.credId]);
    expect((await me.resolve({ job_id: me.jobId, credential_id: me.credId })).status).toBe(404);
    // 形が違う → 422
    expect((await me.resolve({ job_id: me.jobId, credential_id: "sec_x" })).status).toBe(422);
    expect((await me.resolve({})).status).toBe(422);
  });

  it("BRG-05-004 AI の文脈・画面の文脈では関門 C8 が解かない（Bridge の口以外に値の出口が無い）", async () => {
    const r = await ready();
    const ctx = { tenantId: r.member.tenant_id, userId: r.member.member_id, role: "member" as const };
    for (const caller of ["ai", "screen"] as const) {
      const o = await secrets.resolve(r.vaultRef, { ...ctx, caller });
      expect(o.status).toBe("denied");
      expect(JSON.stringify(o)).not.toContain("S3cret-Plain!");
    }
    // 道具（AI が呼ぶ口）の一覧に、資格情報を解く道具が無い
    const job = await json<{ tool_token: string | null }>(post("/bridge/take", { protocol: 4 }, r.B)).catch(() => null);
    void job;
    const src = await import("node:fs/promises").then((fs) =>
      fs.readFile(join(dirname(fileURLToPath(import.meta.url)), "..", "src", "auth", "agent-tools.ts"), "utf8"),
    );
    expect(src).not.toMatch(/credentials\/resolve|secrets\.resolve/);
  });
});

describe("BRG-05-005 外部リソースの実在（G-11）：預かり先に届かないとき、成功にしない・理由が返る・値は漏れない", () => {
  it("BRG-05-005 預かり先が落ちている → 502 と「届きません」の理由。復帰したら同じ要求が通る", async () => {
    const r = await ready();
    vault.down = true;
    try {
      const res = await r.resolve({ job_id: r.jobId, credential_id: r.credId });
      expect(res.status).toBe(502);
      const body = await res.json();
      expect(body).toMatchObject({
        code: "E-SEC-001",
        message: expect.stringContaining("届きません"),
        handoff: expect.any(String),
      });
      expect(JSON.stringify(body)).not.toContain("S3cret-Plain!");
    } finally {
      vault.down = false;
    }
    expect((await r.resolve({ job_id: r.jobId, credential_id: r.credId })).status).toBe(200);
  });
});

describe("BRG-05-006 信号なし終了（G-15）：預かったものが読めない・欠けているときに成功にしない", () => {
  it("BRG-05-006 預かり先の中身が壊れている（JSON でない）→ 502 と預け直しの一手。値は出ない", async () => {
    const r = await ready();
    // 預かり先の中身を、関門が解けるが JSON でない文に差し替える（SecretsGateway.store を使って同じ鍵で暗号化）
    const ctx = { tenantId: r.member.tenant_id, userId: r.member.member_id, role: "member" as const };
    const broken = await secrets.store(ctx, "password", "これは JSON ではない");
    expect(broken.status).toBe("done");
    await admin.query("update credentials set vault_ref = $2 where id = $1", [
      r.credId,
      (broken as { value: { ref: string } }).value.ref,
    ]);
    const res = await r.resolve({ job_id: r.jobId, credential_id: r.credId });
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ code: "E-SEC-001", handoff: "預け直す" });
  });
});
