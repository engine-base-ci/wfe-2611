// 流れと操作ごとの試験（K-57・K-60）の土台：本物の Postgres（migration を全部当てる）と、本物の口の振る舞い（hooks）と、本物の PC の印の解決。
//   画面のログインだけは偽（Bearer に「どの会社のどの人か・役」を書く）。ログインの部品そのものは packages/auth と K-74 の試験が持つ。
//   PC の印は本物（引き取りで返った印を x-bridge-session に載せる → app.bridge_device_check が引く）。
//   会社・人・グループは試験ごとに新しく作る（ほかの試験の種を消さない）。
//   口の振る舞いは PC をつなぐ（K-57・bridgeHooks）を必ず入れ、ほかの操作の振る舞いは試験のファイルが makeFixture の引数で足す
//   （チケットを作る K-60 は makeFixture([ticketHooks])。土台が他のチケットの src を import しないので、K-57 だけでも動く）。
import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { ObjectStore } from "@kaname/storage";
import { localDriver } from "@kaname/storage/local";
import { migrate } from "@kaname/db/migrate";
import { createPool } from "@kaname/db/pool";
import { createRepository } from "@kaname/db/repository";
import type { TenantContext } from "@kaname/db/context";
import { createDeviceResolver } from "@kaname/auth/resolver";
import { createApp } from "../../src/app.js";
import { withDevice } from "../../src/middleware/tenant.js";
import { bridgeHooks } from "../../src/hooks/bridge.js";
import type { Hook } from "../../src/contract/deps.js";

const DB_URL = process.env["DATABASE_URL"]!;
const APP_URL = DB_URL.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const DB_PKG = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "packages", "db");

export type Role = TenantContext["role"];
export interface Person {
  id: string;
  tenantId: string;
  /** 画面のログインの頭（偽のセッション） */
  auth: Record<string, string>;
}
export interface Fixture {
  admin: pg.Pool;
  pool: pg.Pool;
  /** 契約の口を叩く。path は /api/v1 から */
  req: (
    method: string,
    path: string,
    o?: { body?: unknown; headers?: Record<string, string>; ip?: string },
  ) => Promise<Response>;
  /** 上限の差し替え（operationId → 1 分あたり） */
  limits: Record<string, number>;
  hooks: Record<string, Hook>;
  release: { dir: string; base: string };
  company: (name: string, prefix?: string) => Promise<{ tenantId: string; rootScope: string }>;
  person: (
    tenantId: string,
    scopeId: string,
    o?: { name?: string; ticketAbility?: "edit" | "view" | null; role?: Role; authUserId?: string | null },
  ) => Promise<Person>;
  /** 同じ人を別の会社にも入れる（同じログインの人＝ tenant_memberships.auth_user_id が同じ・D-125.150） */
  alsoIn: (p: Person, tenantId: string, scopeId: string) => Promise<Person>;
  as: (p: Person, role: Role) => Record<string, string>;
  /** 同意し直しが要るセッション（K-53 の印 termsPending が立った画面のログイン）の頭 */
  pending: (p: Person, role?: Role) => Record<string, string>;
  close: () => Promise<void>;
}

let ipSeq = 0;
/** 試験ごとに別の IP（上限の数え方を試験どうしで混ぜない） */
export const nextIp = (): string => `203.0.113.${(ipSeq = (ipSeq % 250) + 1)}`;

/** 足す口の振る舞い（アプリの接続 → operationId ごとの hook）。例：apps/api/src/hooks/tickets.ts の ticketHooks */
export type HookFactory = (appPool: pg.Pool) => Record<string, Hook>;

export async function makeFixture(extra: HookFactory[] = []): Promise<Fixture> {
  await migrate(DB_URL, DB_PKG);
  const admin = new pg.Pool({ connectionString: DB_URL, max: 3 });
  const pool = createPool({ databaseUrl: APP_URL, max: 6 });
  const repo = await createRepository(pool);
  const release = { dir: "", base: "" };
  // 外の置き場の署名 URL を出す関門 C4（D-128.153）。試験の鍵は試験だけのもの
  const objects = new ObjectStore(repo, localDriver(mkdtempSync(join(tmpdir(), "k57-obj-"))), {
    signingSecret: "k57-test-files",
  });
  const limits: Record<string, number> = {};
  const hooks: Record<string, Hook> = {};
  const rebuild = () => {
    for (const k of Object.keys(hooks)) delete hooks[k];
    Object.assign(hooks, bridgeHooks({ appPool: pool, release, objects }), ...extra.map((make) => make(pool)));
  };
  rebuild();
  // 偽の画面のログイン：authorization: Bearer fake:<role>:<tenant>:<member>（同意し直しが要るセッションは fake-pending:…）
  const web = async (h: Headers) => {
    const m = /^Bearer fake(-pending)?:(member|ops|client):([0-9a-f-]{36}):([0-9a-f-]{36})$/.exec(
      h.get("authorization") ?? "",
    );
    if (!m) return null;
    const ctx: TenantContext = { tenantId: m[3]!, userId: m[4]!, role: m[2] as Role, stepUpAt: null };
    return { ctx, sessionId: "", authUserId: "", termsPending: m[1] === "-pending" };
  };
  const app = createApp({
    version: "test",
    repo,
    resolve: withDevice(web, createDeviceResolver(pool)) as never,
    contract: { hooks, limits },
  });
  const req: Fixture["req"] = (method, path, o = {}) =>
    Promise.resolve(
      app.request(`http://localhost/api/v1${path}`, {
        method,
        headers: { "content-type": "application/json", "x-forwarded-for": o.ip ?? nextIp(), ...(o.headers ?? {}) },
        ...(o.body === undefined ? {} : { body: typeof o.body === "string" ? o.body : JSON.stringify(o.body) }),
      }),
    );
  const one = async (sql: string, p: unknown[]) => (await admin.query<{ id: string }>(sql, p)).rows[0]!.id;
  const company: Fixture["company"] = async (name, prefix = "") => {
    const tenantId = await one(
      "insert into tenants (id, tenant_id, name) select u, u, $1 from gen_random_uuid() u returning id",
      [name],
    );
    const rootScope = await one(
      "insert into scopes (tenant_id, name, ticket_prefix) values ($1, $2, $3) returning id",
      [tenantId, `${name} の全体`, prefix],
    );
    return { tenantId, rootScope };
  };
  const as: Fixture["as"] = (p, role) => ({ authorization: `Bearer fake:${role}:${p.tenantId}:${p.id}` });
  const pending: Fixture["pending"] = (p, role = "member") => ({
    authorization: `Bearer fake-pending:${role}:${p.tenantId}:${p.id}`,
  });
  const person: Fixture["person"] = async (tenantId, scopeId, o = {}) => {
    const id = await one(
      "insert into members (tenant_id, scope_id, kind_id, display_name, auth_user_id) values ($1, $2, 'human', $3, $4) returning id",
      [tenantId, scopeId, o.name ?? "人", o.authUserId ?? null],
    );
    if (o.ticketAbility)
      await admin.query(
        "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'tickets', $3, $4)",
        [tenantId, id, scopeId, o.ticketAbility],
      );
    const p = { id, tenantId, auth: {} as Record<string, string> };
    p.auth = as(p, o.role ?? "member");
    return p;
  };
  const alsoIn: Fixture["alsoIn"] = async (p, tenantId, scopeId) => {
    const au = (await admin.query<{ a: string | null }>("select auth_user_id as a from members where id = $1", [p.id]))
      .rows[0]!.a;
    const other = await person(tenantId, scopeId, { name: "同じ人（別の会社）" });
    await admin.query(
      "insert into tenant_memberships (tenant_id, member_id, auth_user_id, role, status) values ($1, $2, $3, 'member', 'active')",
      [tenantId, other.id, au],
    );
    return other;
  };
  return {
    admin,
    pool,
    req,
    limits,
    hooks,
    release,
    company,
    person,
    alsoIn,
    as,
    pending,
    close: async () => {
      await pool.end();
      await admin.end();
    },
  };
}
