// 契約テストの土台：実 Postgres（migration＋場合表の種）＋偽のセッション解決（Bearer <who>）。認証そのものは packages/auth のテストが持つ
import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "@kaname/db/migrate";
import { seedAccessMatrix } from "@kaname/db/seeds";
import { createPool } from "@kaname/db/pool";
import { createRepository, type Repository } from "@kaname/db/repository";
import type { TenantContext } from "@kaname/db/context";
import { ENDPOINTS, type EndpointDef } from "@kaname/contracts";
import { SCHEMAS } from "@kaname/contracts/schemas";
import { createApp } from "../src/app.js";
import type { ContractDeps, Hook } from "../src/contract/deps.js";

export type Who = "boss" | "staff" | "ops" | "opsB" | "anon";
const DB_URL = process.env["DATABASE_URL"] ?? "postgres://postgres:postgres@127.0.0.1:55433/kaname_test";
const APP_URL = DB_URL.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const dbPkg = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "packages", "db");
type CallOpts = { body?: unknown; id?: string; query?: Record<string, string>; headers?: Record<string, string> };

export interface Harness {
  S: Awaited<ReturnType<typeof seedAccessMatrix>>;
  repo: Repository;
  hooks: Record<string, Hook>;
  limits: Record<string, number>;
  call: (e: EndpointDef, who: Who, o?: CallOpts) => Promise<Response>;
  bodyFor: (e: EndpointDef, tenant?: string) => Record<string, unknown>;
  /** 表に 1 行足す（管理者接続・種の作り方で）。作成 endpoint の無い表の更新・削除の的に */
  freshRow: (table: string, tenant?: string) => Promise<string>;
  /** 運営がその表を扱うときの対象会社（運営の表なら運営テナント・それ以外は会社 a） */
  opsTenantFor: (e: EndpointDef) => string;
  count: (table: string) => Promise<number>;
  close: () => Promise<void>;
}
export const endpointOf = (operationId: string): EndpointDef => {
  const e = ENDPOINTS.find((x) => x.operationId === operationId);
  if (!e) throw new Error(`契約に無い: ${operationId}`);
  return e;
};

export async function makeHarness(): Promise<Harness> {
  await migrate(DB_URL, dbPkg);
  const admin = new pg.Pool({ connectionString: DB_URL, max: 2 });
  const c = await admin.connect();
  let S: Harness["S"];
  try {
    S = await seedAccessMatrix(c);
  } finally {
    c.release();
  }
  const app = createPool({ databaseUrl: APP_URL, max: 3 });
  const repo = await createRepository(app);
  const who: Record<Exclude<Who, "anon">, TenantContext> = {
    boss: { tenantId: S.tenantA, userId: S.bossA, role: "member" },
    staff: { tenantId: S.tenantA, userId: S.staffA, role: "member" },
    ops: { tenantId: S.opsTenant, userId: S.opsId, role: "ops" }, // 対象の会社は x-tenant-id（call が表に合わせて入れる）。会社 a は許可あり
    opsB: { tenantId: S.tenantB, userId: S.opsId, role: "ops" }, // 会社 b は許可が期限切れ
  };
  const hooks: Record<string, Hook> = {};
  const limits: Record<string, number> = {};
  const deps: Partial<ContractDeps> = { hooks, limits };
  const hono = createApp({
    version: "test",
    repo,
    resolveSession: async (c) => {
      const t = c.req.header("authorization")?.replace(/^Bearer\s+/i, "") as Exclude<Who, "anon"> | undefined;
      return t && who[t] ? who[t] : null;
    },
    contract: deps,
  });
  const isOpsTable = (table: string) => {
    const r = S.rows[table];
    return !!r && r.visible === r.other; // 運営の表は種が 1 行（会社 a／b で分かれない）
  };
  const opsTenantFor: Harness["opsTenantFor"] = (e) => (isOpsTable(e.table) ? S.opsTenant : S.tenantA);
  const bodyFor: Harness["bodyFor"] = (e, tenant = S.tenantA) => {
    const seed = S.rows[e.table];
    const raw = seed?.insert ? seed.insert(tenant) : {};
    const schema = e.input ? SCHEMAS[e.input] : null;
    const keys = schema ? Object.keys((schema as unknown as { shape: Record<string, unknown> }).shape) : [];
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      if (raw[k] === undefined || raw[k] === null || ["id", "tenant_id", "created_at", "updated_at"].includes(k))
        continue;
      out[k] = raw[k] instanceof Date ? (raw[k] as Date).toISOString() : raw[k];
    }
    return out;
  };
  const call: Harness["call"] = (e, w, o = {}) => {
    const path = e.path.replace(":id", o.id ?? "00000000-0000-4000-8000-000000000000");
    const qs = o.query ? "?" + new URLSearchParams(o.query).toString() : "";
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...(w === "anon" ? {} : { authorization: `Bearer ${w}` }),
      ...(w === "ops" ? { "x-tenant-id": opsTenantFor(e) } : {}),
      ...(o.headers ?? {}),
    };
    const body = o.body === undefined ? {} : { body: typeof o.body === "string" ? o.body : JSON.stringify(o.body) };
    return hono.request(`http://localhost${path}${qs}`, { method: e.method, headers, ...body });
  };
  const freshRow: Harness["freshRow"] = async (table, tenant) => {
    const seed = S.rows[table];
    if (!seed?.insert) throw new Error(`種の作り方が無い: ${table}`);
    const row = seed.insert(tenant ?? (isOpsTable(table) ? S.opsTenant : S.tenantA));
    const keys = Object.keys(row).filter((k) => row[k] !== null && row[k] !== undefined);
    const r = await admin.query<{ id: string }>(
      `insert into "${table}" (${keys.map((k) => `"${k}"`).join(", ")}) values (${keys.map((_, i) => `$${i + 1}`).join(", ")}) returning id`,
      keys.map((k) => row[k]),
    );
    return r.rows[0]!.id;
  };
  const count = async (table: string) =>
    Number((await admin.query<{ n: string }>(`select count(*) as n from "${table}"`)).rows[0]!.n);
  return {
    S,
    repo,
    hooks,
    limits,
    call,
    bodyFor,
    freshRow,
    opsTenantFor,
    count,
    close: async () => {
      await app.end();
      await admin.end();
    },
  };
}
