// 目標の名前・たたき台・預けたログイン情報の一覧（D-108）を本物の Postgres（RLS あり）で通す。
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
import { hostOf } from "../src/auth/ext.js";

const DB_PKG = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "packages", "db");
const ADMIN = process.env["DATABASE_URL"] ?? "postgres://postgres:postgres@127.0.0.1:55433/kaname_test";
const APP_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const AUTH_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@");
const PW = "Str0ng-Passw0rd!";
const sent: { to: string; url: string; kind: string }[] = [];
let app: ReturnType<typeof createApp>;
let admin: pg.Pool;
let store = "";
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
  const { auth } = createAuth({
    authDatabaseUrl: AUTH_URL,
    appPool,
    secret: "test-secret-0123456789-abcdefghijklmnop",
    baseURL: "http://localhost:3001",
    webBaseURL: "http://localhost:3123",
    mailer: async () => undefined,
  });
  const secrets = new SecretsGateway(repo, new MemoryVault(), Buffer.alloc(32, 9));
  store = mkdtempSync(join(tmpdir(), "kaname-art-"));
  const objects = new ObjectStore(repo, localDriver(store), { signingSecret: "test-files", maxBytes: 4 * 1024 * 1024 });
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

async function signUp() {
  const email = `${uniq()}@example.com`;
  expect((await post("/sign-up", { email, password: PW, company_name: "K" })).status).toBe(201);
  const mail = sent.filter((m) => m.to === email && m.kind === "verify").at(-1)!;
  const ver = await json<{ token: string; member_id?: string }>(
    post("/verify-signup", { token: new URL(mail.url).searchParams.get("token") }),
  );
  const H = { authorization: `Bearer ${ver.token}` };
  const member = (
    await admin
      .query("select m.id from members m join auth_users u on u.id = m.auth_user_id where u.email = $1", [email])
      .catch(() => ({ rows: [] }))
  ).rows[0]?.id as string | undefined;
  return { H, member };
}

async function memberOf(H: Record<string, string>) {
  const me = await json<{ member_id: string; tenant_id: string }>(req("GET", "/me", undefined, H));
  const scope = (await admin.query("select scope_id from members where id = $1", [me.member_id])).rows[0]
    .scope_id as string;
  return { member: me.member_id, tenant: me.tenant_id, scope };
}

describe("たたき台と預けたログイン情報（D-108）", () => {
  it("入れた文字から宛先のドメインを取る", () => {
    expect(hostOf("https://www.hacchu-navi.com/login")).toBe("hacchu-navi.com");
    expect(hostOf("freee.co.jp")).toBe("freee.co.jp");
    expect(hostOf("発注ナビ")).toBeNull();
  });

  it("たたき台：目標は今の版の名前で出る（無ければ種類の名前・内部の鍵は出さない）。台帳は段階つき。他の会社のものは出ない", async () => {
    const { H } = await signUp();
    const { tenant, scope, member } = await memberOf(H);
    await admin.query("insert into goal_kinds (key, label) values ('qa_revenue', '売上') on conflict (key) do nothing");
    const g1 = (
      await admin.query(
        "insert into goals (tenant_id, scope_id, kind_id, period_start, period_end, target_value, version, created_by) values ($1, $2, 'qa_revenue', '2026-10-01', '2026-12-31', 12000000, 2, $3) returning id",
        [tenant, scope, member],
      )
    ).rows[0].id as string;
    await admin.query(
      "insert into goal_versions (tenant_id, goal_id, version, name, snapshot, changed_at, changed_by) values ($1, $2, 1, '前の名前', '{}', now(), $3), ($1, $2, 2, '今期の売上', '{}', now(), $3)",
      [tenant, g1, member],
    );
    await admin.query(
      "insert into goals (tenant_id, scope_id, kind_id, period_start, period_end, target_value, created_by) values ($1, $2, 'qa_revenue', '2026-10-01', '2026-12-31', 8, $3)",
      [tenant, scope, member],
    );
    await admin.query(
      "insert into ledger_definitions (tenant_id, scope_id, kind_id, name, json_schema, created_by) values ($1, $2, 'deal', '案件', $3, $4)",
      [tenant, scope, JSON.stringify({ stages: ["引合", "提案", "受注"] }), member],
    );
    const d = await json<{
      goals: { name: string; target_value: number }[];
      ledgers: { name: string; stages: string[] }[];
      duties: unknown[];
    }>(req("GET", "/onboard/draft", undefined, H));
    expect(d.goals.map((g) => [g.name, Number(g.target_value)])).toEqual([
      ["今期の売上", 12000000],
      ["売上", 8],
    ]);
    expect(d.ledgers).toEqual([expect.objectContaining({ name: "案件", stages: ["引合", "提案", "受注"] })]);
    const other = await signUp();
    const od = await json<{ goals: unknown[] }>(req("GET", "/onboard/draft", undefined, other.H));
    expect(od.goals).toEqual([]);
    expect((await req("GET", "/onboard/draft")).status).toBe(401);
  });

  it("ログイン情報：入れたサービス名と宛先が残り、台帳の可否つきで一覧に出る。中身は返らず、他の人には見えない", async () => {
    const { H } = await signUp();
    const d = `qa-${Date.now().toString(36)}.example.jp`;
    await admin.query(
      "insert into tenants (id, tenant_id, name) values (app.ops_tenant_id(), app.ops_tenant_id(), '運営') on conflict do nothing",
    );
    await admin.query(
      "insert into service_registry (tenant_id, name, domain, automation_verdict_id) values (app.ops_tenant_id(), 'QA会計', $1, 'api')",
      [d],
    );
    try {
      expect(
        (
          await post(
            "/vault/credentials",
            { service_name: `https://www.${d}/login`, login: "a@example.com", password: "Pass-word-1234" },
            H,
          )
        ).status,
      ).toBe(201);
      expect(
        (
          await post(
            "/vault/credentials",
            { service_name: "発注ナビ", login: "b@example.com", password: "Pass-word-1234" },
            H,
          )
        ).status,
      ).toBe(201);
      const list = await json<
        { service_name: string; service_domain: string; verdict: string; state: string; ref_tail: string }[]
      >(req("GET", "/vault/credentials", undefined, H));
      expect(list.map((x) => [x.service_name, x.service_domain, x.verdict, x.state])).toEqual([
        [`https://www.${d}/login`, d, "api", "stored"],
        ["発注ナビ", "", "unspecified", "stored"],
      ]);
      expect(list[0]!.ref_tail).toHaveLength(6);
      expect(JSON.stringify(list)).not.toMatch(/Pass-word|a@example\.com|b@example\.com/);
      const other = await signUp();
      expect(await json<unknown[]>(req("GET", "/vault/credentials", undefined, other.H))).toEqual([]);
    } finally {
      await admin.query(
        "update credentials set service_id = null where service_id in (select id from service_registry where domain = $1)",
        [d],
      );
      await admin.query("delete from service_registry where domain = $1", [d]);
    }
  });
});
