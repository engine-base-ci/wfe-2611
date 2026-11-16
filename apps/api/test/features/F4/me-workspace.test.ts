// K-253「ログイン中の人の口に、今いる会社の名前を足す」の単体の試験（口・本物の DB）。名前の頭の行 ID（K253-API-…）は 11_tickets/K-253.md の行の表と 1 対 1。
// 口：GET /api/auth-ext/me（外枠が useMyRoles の鍵 ["me"] で読む口・apps/api/src/auth/ext.ts）
//   → { data: { member_id, tenant_id, display_name, role_id, scope_id, workspace_name } }
//   workspace_name＝セッションの会社（tenants.name）の前後の空白を取った文字。空なら null。長くても切らない（画面が詰める）
// 関門は C2 の読むだけ（tenants を repo で読む。行レベルの制御で今の会社の行しか読めない）。
// 本物のログイン（Better Auth・セッションの見張り app.session_check）を通すので、前からの試験（apps/api/test/draft_credentials.test.ts）と同じ組み方。
// 契約の口 getMe（持ち主 K-70）はまだ作っていない。この口を getMe に移すとき欄が落ちないよう、契約の Me にも欄を書く（K253-API-012）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "@kaname/db/migrate";
import { migrateAuth } from "@kaname/auth/migrate";
import { createAuth } from "@kaname/auth";
import { createSessionResolver } from "@kaname/auth/resolver";
import { createPool } from "@kaname/db/pool";
import { createRepository } from "@kaname/db/repository";
import { MemoryVault, SecretsGateway } from "@kaname/secrets";
import { createApp } from "../../../src/app.js";
import { authExt } from "../../../src/auth/ext.js";
import { keepAuth, verifiedUser } from "../../_pending.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..", "..");
const DB_PKG = join(ROOT, "packages", "db");
const ADMIN = process.env["DATABASE_URL"]!;
const APP_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const AUTH_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@");
const PW = "Str0ng-Passw0rd!";
let app: ReturnType<typeof createApp>;
let admin: pg.Pool;

type Me = {
  member_id: string;
  tenant_id: string;
  display_name: string | null;
  role_id: string | null;
  scope_id: string | null;
  workspace_name: string | null;
};

const getMe = (h: Record<string, string> = {}) =>
  app.request("http://localhost/api/auth-ext/me", {
    method: "GET",
    headers: { "content-type": "application/json", ...h },
  });
async function meOk(h: Record<string, string>): Promise<Me> {
  const r = await getMe(h);
  expect(r.status, await r.clone().text()).toBe(200);
  return ((await r.json()) as { data: Me }).data;
}
const uniq = () => `k253-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

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
  app = createApp({
    repo,
    auth,
    resolve: createSessionResolver(auth, appPool),
    authExt: authExt({
      auth,
      appPool,
      authPool: new pg.Pool({ connectionString: AUTH_URL, max: 2 }),
      repo,
      secrets: new SecretsGateway(repo, new MemoryVault(), Buffer.alloc(32, 9)),
      mailer: async () => undefined,
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

/** 本物の登録で会社と代表を作り、ログインの頭と会社・人の id を返す */
async function owner(
  company: string,
): Promise<{ H: Record<string, string>; member: string; tenant: string; scope: string }> {
  const email = `${uniq()}@example.com`;
  const ver = await verifiedUser(AUTH_URL, { email, password: PW, companyName: company, name: "高本" });
  const H = { authorization: `Bearer ${ver.token}` };
  const row = (
    await admin.query<{ id: string; tenant_id: string; scope_id: string }>(
      "select m.id, m.tenant_id, m.scope_id from members m join auth_users u on u.id = m.auth_user_id where u.email = $1",
      [email],
    )
  ).rows[0]!;
  return { H, member: row.id, tenant: row.tenant_id, scope: row.scope_id };
}
const setName = (tenant: string, name: string) =>
  admin.query("update tenants set name = $2 where id = $1", [tenant, name]);

/** 同じログインの人を別の会社にも入れ、セッションをその会社に向ける（今いる会社を替える） */
async function moveToOtherCompany(
  o: { member: string },
  otherName: string,
): Promise<{ tenant: string; member: string }> {
  const t = (
    await admin.query<{ id: string }>(
      "insert into tenants (id, tenant_id, name) select u, u, $1 from gen_random_uuid() u returning id",
      [otherName],
    )
  ).rows[0]!.id;
  const s = (
    await admin.query<{ id: string }>("insert into scopes (tenant_id, name) values ($1, '全体') returning id", [t])
  ).rows[0]!.id;
  const au = (await admin.query<{ a: string }>("select auth_user_id as a from members where id = $1", [o.member]))
    .rows[0]!.a;
  const m = (
    await admin.query<{ id: string }>(
      "insert into members (tenant_id, scope_id, kind_id, display_name, auth_user_id, role_id) values ($1, $2, 'human', '高本', $3, 'staff') returning id",
      [t, s, au],
    )
  ).rows[0]!.id;
  await admin.query(
    "insert into tenant_memberships (tenant_id, member_id, auth_user_id, role, status) values ($1, $2, $3, 'member', 'active')",
    [t, m, au],
  );
  await admin.query("update sessions set tenant_id = $1, member_id = $2 where member_id = $3", [t, m, o.member]);
  return { tenant: t, member: m };
}

describe("K-253 ログイン中の人の口に今いる会社の名前（GET /api/auth-ext/me）", () => {
  it("K253-API-001 登録した代表：workspace_name が登録した会社名で、前からの欄（member_id・tenant_id・display_name・role_id・scope_id）はそのまま", async () => {
    const o = await owner("株式会社ENGINE BASE");
    const me = await meOk(o.H);
    expect(me.workspace_name).toBe("株式会社ENGINE BASE");
    expect(me.member_id).toBe(o.member);
    expect(me.tenant_id).toBe(o.tenant);
    expect(me.display_name).toBe("高本");
    expect(me.role_id).toBe("owner");
    expect(me.scope_id).toBe(o.scope);
    expect(Object.keys(me).sort()).toEqual(
      ["display_name", "member_id", "role_id", "scope_id", "tenant_id", "workspace_name"].sort(),
    );
  });

  it("K253-API-002 役に依らない：担当（staff）・閲覧（viewer）の人も自分の会社の名前を受け取る", async () => {
    const o = await owner(`役の会社 ${uniq()}`);
    for (const role of ["staff", "viewer"]) {
      await admin.query("update members set role_id = $2 where id = $1", [o.member, role]);
      const me = await meOk(o.H);
      expect(me.role_id, role).toBe(role);
      expect(me.workspace_name, role).toMatch(/^役の会社 /);
    }
  });

  it("K253-API-003 会社が 2 つある人：セッションが別の会社に向くと、その会社の名前になり、前の会社の名前は答えのどこにも無い", async () => {
    const o = await owner("前の会社 ALPHA");
    expect((await meOk(o.H)).workspace_name).toBe("前の会社 ALPHA");
    const b = await moveToOtherCompany(o, "後の会社 BRAVO");
    const r = await getMe(o.H);
    const text = await r.clone().text();
    expect(r.status, text).toBe(200);
    const me = ((await r.json()) as { data: Me }).data;
    expect(me.workspace_name).toBe("後の会社 BRAVO");
    expect(me.tenant_id).toBe(b.tenant);
    expect(me.member_id).toBe(b.member);
    expect(text).not.toContain("ALPHA");
  });

  it("K253-API-004 別の会社の人：同じ時に別の会社の人が読んでも、互いの会社名が混ざらない", async () => {
    const a = await owner("会社 CHARLIE");
    const b = await owner("会社 DELTA");
    const [ra, rb] = await Promise.all([getMe(a.H), getMe(b.H)]);
    const ta = await ra.text();
    const tb = await rb.text();
    expect(JSON.parse(ta).data.workspace_name).toBe("会社 CHARLIE");
    expect(JSON.parse(tb).data.workspace_name).toBe("会社 DELTA");
    expect(ta).not.toContain("DELTA");
    expect(tb).not.toContain("CHARLIE");
  });

  it("K253-API-005 前後に空白のある名前：前後の空白（全角を含む）を取った文字を返す", async () => {
    const o = await owner(`空白の会社 ${uniq()}`);
    await setName(o.tenant, "　 株式会社 空白 \t");
    expect((await meOk(o.H)).workspace_name).toBe("株式会社 空白");
  });

  it("K253-API-006 空の名前：空の文字・空白だけの名前は null（空の文字を返さない）", async () => {
    const o = await owner(`空の会社 ${uniq()}`);
    for (const name of ["", "   ", "　"]) {
      await setName(o.tenant, name);
      expect((await meOk(o.H)).workspace_name, JSON.stringify(name)).toBeNull();
    }
  });

  it("K253-API-007 長い名前：登録の上限の 120 文字と、それより長い 200 文字も切らずにそのまま返す", async () => {
    const o = await owner(`長い会社 ${uniq()}`);
    for (const n of [120, 200]) {
      const name = "株".repeat(n);
      await setName(o.tenant, name);
      const me = await meOk(o.H);
      expect(me.workspace_name, String(n)).toBe(name);
      expect([...(me.workspace_name ?? "")].length).toBe(n);
    }
  });

  it("K253-API-008 名前を変えた直後：次の読みで新しい名前（前の名前を覚えていない）", async () => {
    const o = await owner("変える前の会社");
    expect((await meOk(o.H)).workspace_name).toBe("変える前の会社");
    await setName(o.tenant, "変えた後の会社");
    expect((await meOk(o.H)).workspace_name).toBe("変えた後の会社");
  });

  it("K253-API-009 会社の行が消えた印つき（deleted_at）：200 で workspace_name は null・前からの欄はそのまま", async () => {
    const o = await owner(`消した会社 ${uniq()}`);
    await admin.query("update tenants set deleted_at = now() where id = $1", [o.tenant]);
    try {
      const me = await meOk(o.H);
      expect(me.workspace_name).toBeNull();
      expect(me.member_id).toBe(o.member);
      expect(me.tenant_id).toBe(o.tenant);
    } finally {
      await admin.query("update tenants set deleted_at = null where id = $1", [o.tenant]);
    }
  });

  it("K253-API-010 ログインしていない：401 UNAUTHENTICATED で、会社名を返さない", async () => {
    const r = await getMe();
    expect(r.status).toBe(401);
    const text = await r.text();
    expect(text).toContain("UNAUTHENTICATED");
    expect(text).not.toContain("workspace_name");
  });

  it("K253-API-011 抜けた人：その会社の人の行が消えた後は 401 で、会社名を返さない", async () => {
    const o = await owner("抜ける会社 ECHO");
    await admin.query("update members set deleted_at = now() where id = $1", [o.member]);
    const r = await getMe(o.H);
    expect(r.status).toBe(401);
    expect(await r.text()).not.toContain("ECHO");
  });

  it("K253-API-012 契約：移す先の契約の口 getMe の Me に workspace_name（文字か null）が在り、作り直した型にも在る", () => {
    const src = readFileSync(join(ROOT, "05_flow", "screen_api.py"), "utf8");
    const line = src.split("\n").find((l) => /^\s*"getMe":\s*\("Me",/.test(l));
    expect(line, "screen_api.py に getMe の答えの形が無い").toBeDefined();
    expect(line!).toMatch(/"workspace_name"\s*:/);
    const types = readFileSync(join(ROOT, "packages", "contracts", "src", "types.ts"), "utf8");
    const me = types.split("\n").find((l) => /^export type Me = /.test(l));
    expect(me, "packages/contracts の Me が無い").toBeDefined();
    expect(me!).toMatch(/workspace_name\??:\s*string \| null/);
    const yaml = readFileSync(join(ROOT, "08_api", "openapi.yaml"), "utf8");
    const block = yaml.slice(yaml.indexOf("\n    Me:\n"), yaml.indexOf("x-operation: getMe"));
    expect(block).toMatch(/workspace_name:/);
  });

  it("K253-API-014 欄の使い道：08_api/api-field-consumption.json の tenants.name を読む画面に外枠の画面（tickets）が載る", () => {
    const doc = JSON.parse(readFileSync(join(ROOT, "08_api", "api-field-consumption.json"), "utf8")) as {
      fields: { entity: string; field: string; consumed_by_screens: string[] }[];
    };
    const row = doc.fields.find((f) => f.entity === "tenants" && f.field === "name");
    expect(row, "tenants.name の行が無い").toBeDefined();
    expect(row!.consumed_by_screens).toContain("tickets");
  });

  it("K253-API-013 読むだけ：読む前後で会社と人の行（名前・更新の時刻）が変わらない", async () => {
    const o = await owner(`読むだけの会社 ${uniq()}`);
    const snap = async () =>
      (
        await admin.query(
          "select t.name, t.updated_at as tu, m.display_name, m.updated_at as mu from tenants t join members m on m.tenant_id = t.id where m.id = $1",
          [o.member],
        )
      ).rows[0];
    const before = await snap();
    await meOk(o.H);
    await meOk(o.H);
    expect(await snap()).toEqual(before);
  });
});
