// /api/auth-ext（T-U-01・03／09／10 の裏側）：登録で会社ができる・メールの正規化・既存メールは 409・招待の下見と受諾・Bridge の接続コード・資格情報は参照だけ
//   ログインと 2 段階（前の道すじ /sign-in・/two-factor/verify）は K-316 で消した。同じ振る舞いは契約の口の試験（features/F1/sign-in・sign-in-code）が持つ
import { beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "@kaname/db/migrate";
import { migrateAuth } from "@kaname/auth/migrate";
import { createAuth, type Mail } from "@kaname/auth";
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

describe("Bridge の接続コードと資格情報（T-U-09／10）", () => {
  it("BRG-02-001 前の道すじ（/api/auth-ext/bridge/pair・平文の KNM-#### のコード）は無い。接続コードは契約の口（K-57・connect-pc.test.ts）", async () => {
    const email = `${uniq()}@example.com`;
    const { token } = await register(email, "E");
    const r = await post("/api/auth-ext/bridge/pair", {}, { authorization: `Bearer ${token}` });
    expect(r.status).toBe(404);
  });
  // K-358：資格情報を預ける前の道すじ（/vault/credentials）の試験は消した（契約の口 createCredential の K352-API-001 が見る）
});
