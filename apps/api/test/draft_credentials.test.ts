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
import { keepAuth, verifiedUser } from "./_pending.js";
import { hostOf } from "../src/auth/ext.js";

const DB_PKG = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "packages", "db");
const ADMIN = process.env["DATABASE_URL"]!;
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
  // 申し込みは直に置き、確認だけを通す（前の道すじ /sign-up は K-51 で契約の口に移した）
  const ver = await verifiedUser(AUTH_URL, { email, password: PW, companyName: "K" });
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

  // K-358：預けたログイン情報の前の道すじ（/vault/credentials）の行は消した（一覧は契約の口 listCredentials の K-351、預けるは K-352 が見る）
});
