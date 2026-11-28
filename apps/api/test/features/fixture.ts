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
import { ObjectStore, type ExternalSigner } from "@kaname/storage";
import { localDriver } from "@kaname/storage/local";
import { migrate } from "@kaname/db/migrate";
import { migrateAuth } from "@kaname/auth/migrate";
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
  /** 外の置き場の期限つき URL を作る口（D-128.160）。試験が偽の S3 の署名の口を差す。null なら URL を作らない（受け取りは 404） */
  signer: { current: ExternalSigner | null };
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

/** close の時に流す後片付け（後に足した物から）。beforeAll の中で呼んだ afterAll は vitest に登録されず流れないので、
 *  試験の土台（*.harness.ts）が beforeAll の中で足す後片付けはここに置く（統合の枝の CI：共用の DB に試験の行が残り、
 *  次の会社の種まき・運営の人の数・プランの一覧が別の試験の行で変わっていた）。1 つが落ちても残りは流し、落ちた物は出す */
const closeHooks: (() => Promise<void>)[] = [];
export function afterClose(fn: () => Promise<void>): void {
  closeHooks.push(fn);
}
async function runCloseHooks(): Promise<void> {
  while (closeHooks.length) {
    const fn = closeHooks.pop()!;
    try {
      await fn();
    } catch (e) {
      console.warn(`[fixture] 後片付けが落ちた（${(e as Error).message}）`);
    }
  }
}

/** 場合表の種（packages/db/src/seeds.ts の seedAccessMatrix）が運営の会社に入れた見本の行（key が seed・k9-…・請求書のひな形の seed）を外す。
 *  同じ DB で後に流れる機能の試験が、運営の会社のプランの一覧・請求書の出し手に見本の行を読んで赤になる（統合の枝の CI・直しの担当 XC）。
 *  見本の行に結んだ行（見本の会社のプラン・申し込み・案）は、運営の既定のプラン free に付け替えるか消す */
async function dropMatrixOpsSeeds(admin: pg.Pool): Promise<void> {
  const OPS = "00000000-0000-4000-8000-000000000001";
  const c = await admin.connect();
  try {
    await c.query("begin");
    const seedPlans = "select id from plans where tenant_id = $1 and (key = 'seed' or key like 'k9-%')";
    const free = (await c.query<{ id: string }>("select id from plans where tenant_id = $1 and key = 'free'", [OPS]))
      .rows[0]?.id;
    // 見本の行に結んだ行は、運営の既定のプラン free に付け替える（請求書などが結ぶので消さない）。版の行は見本のプランの物だけ消す
    //   free が無い DB（tenants を cascade で消して運営の製品を入れ直さない試験 packages/db/test/rls.test.ts の後）では、空にできる列は空にし、
    //   空にできない案（ops_plan_proposals.plan_id）は見本の行なので消す（付け替え先が無いまま消すと外のキーで落ちる・統合の枝の CI の unit-2）
    for (const [t, col] of [
      ["tenants", "plan_id"],
      ["subscriptions", "plan_id"],
      ["plan_change_requests", "from_plan_id"],
      ["plan_change_requests", "to_plan_id"],
      ["ops_plan_proposals", "plan_id"],
    ] as const) {
      if (free) await c.query(`update ${t} set ${col} = $2 where ${col} in (${seedPlans})`, [OPS, free]);
      else if (t === "ops_plan_proposals") await c.query(`delete from ${t} where ${col} in (${seedPlans})`, [OPS]);
      else await c.query(`update ${t} set ${col} = null where ${col} in (${seedPlans})`, [OPS]);
    }
    await c.query(`delete from plan_versions where plan_id in (${seedPlans})`, [OPS]);
    await c.query("delete from plans where tenant_id = $1 and (key = 'seed' or key like 'k9-%')", [OPS]);
    const seedDist = "select id from distributions where tenant_id = $1 and (key = 'seed' or key like 'k9-%')";
    await c.query(`delete from tenant_distributions where distribution_id in (${seedDist})`, [OPS]);
    await c.query(`delete from distribution_versions where distribution_id in (${seedDist})`, [OPS]);
    await c.query("delete from distributions where tenant_id = $1 and (key = 'seed' or key like 'k9-%')", [OPS]);
    await c.query("delete from ops_invoice_templates where tenant_id = $1 and company = 'seed'", [OPS]);
    await c.query("commit");
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}

export async function makeFixture(extra: HookFactory[] = []): Promise<Fixture> {
  await migrate(DB_URL, DB_PKG);
  // 認証の表（kaname_auth.user）は別の道の migration。土台を使う試験が自分の足し込みで書くので、ほかの試験が先に流れた DB でだけ在る状態にしない（K-644・K-433）
  await migrateAuth(DB_URL);
  const admin = new pg.Pool({ connectionString: DB_URL, max: 3 });
  await dropMatrixOpsSeeds(admin);
  const pool = createPool({ databaseUrl: APP_URL, max: 6 });
  const repo = await createRepository(pool);
  const release = { dir: "", base: "" };
  // 外の置き場の署名 URL を出す関門 C4（D-128.153）。試験の鍵は試験だけのもの
  const signer: { current: ExternalSigner | null } = { current: null };
  const objects = new ObjectStore(repo, localDriver(mkdtempSync(join(tmpdir(), "k57-obj-"))), {
    signingSecret: "k57-test-files",
    externalSigner: { presignGet: async (u, ttl) => (signer.current ? signer.current.presignGet(u, ttl) : null) },
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
    signer,
    company,
    person,
    alsoIn,
    as,
    pending,
    close: async () => {
      await runCloseHooks();
      await pool.end();
      await admin.end();
    },
  };
}

/** 引き金を通さずに 1 文を書く（session_replication_role = replica）。役割の束の引き金（0080）が権限の行を作り直さないようにする。
 *  試験が権限を person の ticketAbility で決めているときに使う（束が付くと「見るだけの人」「マネージャー」が直せる人になる） */
export async function quietWrite(f: Pick<Fixture, "admin">, sql: string, args: unknown[]): Promise<void> {
  const c = await f.admin.connect();
  try {
    await c.query("begin");
    await c.query("set local session_replication_role = replica");
    await c.query(sql, args);
    await c.query("commit");
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}

/** 作る人を会社にも入れる（tenant_memberships が active・役割の束の引き金は通さない）。
 *   任せる口は段10 の K-699 から、任せる人の「必ず守る」（app.knowledge_context）を読み、読めるのは会社に入っている人だけ。
 *   本物の人は必ず会社に入っているので、任せる口を叩く土台の人も入れる。権限は試験が person の ticketAbility で決めたままにしたいので、
 *   束の引き金（0080・役割から権限の行を作る）は通さない（通すと「見るだけの人」が member の束で直せる人になる）。
 *   後から試験が自分で会社に入れる行（役割・状態を決める）は on conflict で上書きしてよい。
 *   後から scope_memberships を足すと束の引き金がこの行の役割で権限を作るので、権限を足したくない所属は quietWrite で足す */
export function joinOnCreate(f: Fixture): void {
  const base = f.person;
  f.person = async (tenantId, scopeId, o = {}) => {
    const p = await base(tenantId, scopeId, o);
    await quietWrite(
      f,
      "insert into tenant_memberships (tenant_id, member_id, auth_user_id, role, status) values ($1, $2, $3, 'member', 'active') on conflict (tenant_id, member_id) do nothing",
      [tenantId, p.id, o.authUserId ?? null],
    );
    return p;
  };
}
