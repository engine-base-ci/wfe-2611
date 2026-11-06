// /api/auth-ext（T-U-01〜05／09／10 の裏側）：登録で会社ができる・メールの正規化・既存メールは 409・5 回失敗で 15 分ロック・招待の下見と受諾・Bridge の接続コード・資格情報は参照だけ
import { beforeAll, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "@kaname/db/migrate";
import { migrateAuth } from "@kaname/auth/migrate";
import { createAuth, type Mail } from "@kaname/auth";
import { createInvitation } from "@kaname/auth/invitations";
import { createSessionResolver } from "@kaname/auth/resolver";
import { createPool } from "@kaname/db/pool";
import { createRepository } from "@kaname/db/repository";
import { MemoryVault, SecretsGateway } from "@kaname/secrets";
import { createApp } from "../src/app.js";
import { authExt } from "../src/auth/ext.js";
import { keepAuth, verifiedUser } from "./_pending.js";

const DB_PKG = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "packages", "db");
const ADMIN = process.env["DATABASE_URL"]!;
const APP_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const AUTH_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@");
const mails: Mail[] = [];
let app: ReturnType<typeof createApp>;
let admin: pg.Pool;
let appPool: pg.Pool;
const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  app.request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
const uniq = () => `u${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
const PW = "correct-horse-battery-1";
/** 登録は 2 段（D-088）：申し込み（201・まだ会社は無い）→ 確認メールのリンクを押す（契約の口 verifySignup・K-52。ここで会社と本人ができ、そのまま入る） */
//   申し込みは K-51 で契約の口（POST /api/v1/auth/sign-up）に移した。ここでは申し込みを直に置いて確認だけ通す（申し込みの振る舞いは features/F1/sign-up.test.ts）
async function register(email: string, company: string, password = PW): Promise<{ token: string; userId: string }> {
  const v = await verifiedUser(AUTH_URL, { email, password, companyName: company });
  return { token: v.token, userId: v.userId };
}

beforeAll(async () => {
  await migrate(ADMIN, DB_PKG);
  await migrateAuth(ADMIN);
  admin = new pg.Pool({ connectionString: ADMIN, max: 2 });
  appPool = createPool({ databaseUrl: APP_URL, max: 3 });
  const repo = await createRepository(appPool);
  const { auth } = keepAuth(
    createAuth({
      authDatabaseUrl: AUTH_URL,
      appPool,
      secret: "test-secret-0123456789-abcdefghijklmnop",
      baseURL: "http://localhost:3001",
      webBaseURL: "http://localhost:3123",
      mailer: async (m) => void mails.push(m),
    }),
  );
  const secrets = new SecretsGateway(repo, new MemoryVault(), Buffer.alloc(32, 9));
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
      mailer: async (m) => void mails.push(m),
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

describe("登録（T-U-01）", () => {
  it("確認のリンクを押すと会社・根の層・代表・権限・自分のAI ができて入れる", async () => {
    const email = `${uniq()}@example.com`;
    const before = await admin.query('select count(*)::int as n from kaname_auth."user" where email = $1', [email]);
    expect(before.rows[0].n).toBe(0);
    const j = await register(email, "株式会社テスト");
    const t = await admin.query(
      'select t.name from members m join tenants t on t.id = m.tenant_id where m.auth_user_id = (select id from kaname_auth."user" where email = $1)',
      [email],
    );
    expect(t.rows[0]?.name).toBe("株式会社テスト");
    const n = await admin.query(
      'select (select count(*) from permissions p join members m on m.id = p.grantee_member_id join kaname_auth."user" u on u.id = m.auth_user_id where u.email = $1) as perms, (select count(*) from clones c join members m on m.id = c.owner_member_id join kaname_auth."user" u on u.id = m.auth_user_id where u.email = $1) as clones',
      [email],
    );
    expect(Number(n.rows[0].perms)).toBeGreaterThan(10);
    expect(Number(n.rows[0].clones)).toBe(1);
    // 別 GET：発行された token で自分の会社が読める（別 GET 再取得）
    const me = await app.request("http://localhost/api/v1/members?limit=5", {
      headers: { authorization: `Bearer ${j.token}` },
    });
    expect(me.status).toBe(200);
  });
});

describe("ログイン（T-U-05）", () => {
  it("正しい組み合わせは 200 で token。大文字・空白の違いだけなら通る", async () => {
    const email = `${uniq()}@example.com`;
    await register(email, "C");
    const r = await post("/api/auth-ext/sign-in", { email: ` ${email.toUpperCase()} `, password: PW });
    expect(r.status).toBe(200);
    expect(((await r.json()) as { data: { token: string } }).data.token).toBeTruthy();
  });
  it("間違えると 401 で残り回数が減り、5 回でロック（429・retry_after_sec）。正しいパスワードでも入れない", async () => {
    const email = `${uniq()}@example.com`;
    await register(email, "D");
    const rems: number[] = [];
    for (let i = 0; i < 4; i++) {
      const r = await post("/api/auth-ext/sign-in", { email, password: "wrong-password-000" });
      expect(r.status).toBe(401);
      const j = (await r.json()) as { code: string; remaining: number; message: string };
      expect(j.code).toBe("E-AUTH-001");
      rems.push(j.remaining);
      expect(j.message).toContain(`あと ${j.remaining} 回`);
    }
    expect(rems).toEqual([4, 3, 2, 1]);
    const five = await post("/api/auth-ext/sign-in", { email, password: "wrong-password-000" });
    expect(five.status).toBe(429);
    const j = (await five.json()) as { code: string; retry_after_sec: number };
    expect(j.code).toBe("E-AUTH-002");
    expect(j.retry_after_sec).toBeGreaterThan(0);
    expect((await post("/api/auth-ext/sign-in", { email, password: PW })).status).toBe(429);
  });
});

describe("2 段階（T-U-04／05）", () => {
  const totp = (secretBase32: string, at = Date.now()): string => {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = "";
    for (const ch of secretBase32.toUpperCase().replace(/[^A-Z2-7]/g, ""))
      bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
    const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(Math.floor(at / 30000)));
    const h = createHmac("sha1", key).update(counter).digest();
    const off = h[h.length - 1]! & 0xf;
    const code =
      ((h[off]! & 0x7f) << 24) | ((h[off + 1]! & 0xff) << 16) | ((h[off + 2]! & 0xff) << 8) | (h[off + 3]! & 0xff);
    return String(code % 1_000_000).padStart(6, "0");
  };
  it("有効化 → ログインは two_factor=true と待ちの cookie → /two-factor/verify（6 桁）で token。違う 6 桁は 401 E-AUTH-004。回復コードでも入れる", async () => {
    const email = `${uniq()}@example.com`;
    const { token } = await register(email, "G");
    const en = await post("/api/auth/two-factor/enable", { password: PW }, { authorization: `Bearer ${token}` });
    expect(en.status).toBe(200);
    const { totpURI, backupCodes } = (await en.json()) as { totpURI: string; backupCodes: string[] };
    const secret = new URL(totpURI).searchParams.get("secret")!;
    const ok = await post(
      "/api/auth/two-factor/verify-totp",
      { code: totp(secret) },
      { authorization: `Bearer ${token}` },
    );
    expect(ok.status).toBe(200);
    const si = await post("/api/auth-ext/sign-in", { email, password: PW });
    expect(si.status).toBe(200);
    const j = (await si.json()) as {
      data: { token: string | null; two_factor: boolean; two_factor_cookie: string | null };
    };
    expect(j.data.two_factor).toBe(true);
    expect(j.data.token).toBeNull();
    expect(j.data.two_factor_cookie).toBeTruthy();
    const bad1 = await post("/api/auth-ext/two-factor/verify", {
      two_factor_cookie: j.data.two_factor_cookie,
      code: "000000",
    });
    expect(bad1.status).toBe(401);
    expect(((await bad1.json()) as { code: string }).code).toBe("E-AUTH-004");
    const good = await post("/api/auth-ext/two-factor/verify", {
      two_factor_cookie: j.data.two_factor_cookie,
      code: totp(secret),
    });
    expect(good.status).toBe(200);
    expect(((await good.json()) as { data: { token: string } }).data.token).toBeTruthy();
    const si2 = (await (await post("/api/auth-ext/sign-in", { email, password: PW })).json()) as {
      data: { two_factor_cookie: string };
    };
    const bc = await post("/api/auth-ext/two-factor/verify", {
      two_factor_cookie: si2.data.two_factor_cookie,
      backup_code: backupCodes[0],
    });
    expect(bc.status).toBe(200);
  });
});

describe("招待（T-U-03）", () => {
  it("下見で会社名・役割・期限が見え、名前とパスワードで受けると会社の一員になる。取り消し済みは 410", async () => {
    const boss = `${uniq()}@example.com`;
    const { token } = await register(boss, "招く会社");
    const ctx = await admin.query(
      'select m.id, m.tenant_id from members m join kaname_auth."user" u on u.id = m.auth_user_id where u.email = $1',
      [boss],
    );
    const repo = await createRepository(appPool);
    const inv = await createInvitation(
      repo,
      { tenantId: ctx.rows[0].tenant_id, userId: ctx.rows[0].id, role: "member" },
      { email: `${uniq()}@example.com`, roleId: "staff" },
    );
    const pv = await app.request(`http://localhost/api/auth-ext/invitations/${inv.token}`);
    expect(pv.status).toBe(200);
    const p = (await pv.json()) as { data: { tenant_name: string; role_id: string; valid: boolean } };
    expect(p.data).toMatchObject({ tenant_name: "招く会社", role_id: "staff", valid: true });
    const ac = await post(`/api/auth-ext/invitations/${inv.token}/accept`, { name: "佐藤 健", password: PW });
    expect(ac.status).toBe(201);
    const m = await admin.query("select display_name, tenant_id from members where id = $1", [
      ((await ac.json()) as { data: { member_id: string } }).data.member_id,
    ]);
    expect(m.rows[0]).toMatchObject({ display_name: "佐藤 健", tenant_id: ctx.rows[0].tenant_id });
    const again = await post(`/api/auth-ext/invitations/${inv.token}/accept`, { name: "x", password: PW });
    expect(again.status).toBe(410);
    expect((await app.request("http://localhost/api/auth-ext/invitations/no-such-token")).status).toBe(404);
    void token;
  });
});

describe("Bridge の接続コードと資格情報（T-U-09／10）", () => {
  it("BRG-02-001 ログイン済みなら KNM-#### の接続コード。未ログインは 401", async () => {
    const email = `${uniq()}@example.com`;
    const { token } = await register(email, "E");
    const r = await post("/api/auth-ext/bridge/pair", {}, { authorization: `Bearer ${token}` });
    expect(r.status).toBe(201);
    expect(((await r.json()) as { data: { code: string } }).data.code).toMatch(/^KNM-\d{4}$/);
    expect((await post("/api/auth-ext/bridge/pair", {})).status).toBe(401);
  });
  it("資格情報を預けると表には vault_ref だけ。平文はどこにも無い", async () => {
    const email = `${uniq()}@example.com`;
    const { token } = await register(email, "F");
    const r = await post(
      "/api/auth-ext/vault/credentials",
      {
        service_name: "発注ナビ",
        login: "me@example.com",
        password: "S3cret-Plain!",
        totp_secret: "JBSW Y3DP EHPK 3PXP",
      },
      { authorization: `Bearer ${token}` },
    );
    expect(r.status).toBe(201);
    const j = (await r.json()) as { data: { id: string; vault_ref: string } };
    expect(j.data.vault_ref).toMatch(/^sec_/);
    const row = await admin.query("select vault_ref, kind_id from credentials where id = $1", [j.data.id]);
    expect(row.rows[0]).toMatchObject({ vault_ref: j.data.vault_ref, kind_id: "password_totp" });
    const leak = await admin.query(
      "select count(*) as n from credentials where vault_ref like '%S3cret%' or kind_id like '%S3cret%'",
    );
    expect(Number(leak.rows[0].n)).toBe(0);
    expect(
      (await post("/api/auth-ext/vault/credentials", { login: "x" }, { authorization: `Bearer ${token}` })).status,
    ).toBe(422);
  });
});
