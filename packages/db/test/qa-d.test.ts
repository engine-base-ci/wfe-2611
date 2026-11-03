// QA 担当 D：テスト仕様書 rls-matrix.md の「RLS 越境」の行を、実 Postgres（kaname_test）で確かめる。
// 期待は仕様の行：「他テナントの行を SELECT / UPDATE できない（SET LOCAL を正しく／飛ばして両方）→ 0 行・副作用なし」。
// テスト名の先頭は行 ID。種は場合表と同じ seedAccessMatrix（会社 a・会社 b・運営）。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "../src/migrate.js";
import { seedAccessMatrix } from "../src/seeds.js";
import { withTenant, type TenantContext } from "../src/context.js";

const DB_URL = process.env["DATABASE_URL"] ?? "postgres://postgres:postgres@127.0.0.1:55433/kaname_test";
const APP_URL = DB_URL.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const here = dirname(fileURLToPath(import.meta.url));
const admin = new pg.Pool({ connectionString: DB_URL, max: 2 });
let app: pg.Pool;
let S: Awaited<ReturnType<typeof seedAccessMatrix>>;

beforeAll(async () => {
  await migrate(DB_URL, join(here, ".."));
  const c = await admin.connect();
  try {
    S = await seedAccessMatrix(c);
  } finally {
    c.release();
  }
  app = new pg.Pool({ connectionString: APP_URL, max: 2 });
}, 120_000);
afterAll(async () => {
  await app?.end();
  await admin.end();
});

type Res = "rows" | "denied";
/** 文脈つき（ctx）か、文脈なし（null＝SET LOCAL を飛ばす）で 1 文を流し、行数か「弾かれた」を返す */
async function run(ctx: TenantContext | null, sql: string, p: unknown[]): Promise<number | Res> {
  try {
    if (ctx) return await withTenant(app, ctx, async (c) => (await c.query(sql, p)).rowCount ?? 0);
    const c = await app.connect();
    try {
      return (await c.query(sql, p)).rowCount ?? 0;
    } finally {
      c.release();
    }
  } catch (e) {
    if (/row-level security|permission denied/.test(String(e))) return "denied";
    throw e;
  }
}
const rowJson = async (table: string, key: string, id: string) =>
  (await admin.query(`select to_jsonb(t) as j from ${table} t where ${key}::text = $1`, [id])).rows[0]?.j ?? null;

// 会社の行を持つ表（tenant_id あり）：会社 a の代表として、会社 b の行を読む・直す
const TENANT_TABLES: [string, string][] = [
  ["RLS-D04-016", "memory_digests"],
  ["RLS-D04-018", "memory_proposals"],
  ["RLS-D06-012", "bridge_jobs"],
  ["RLS-D06-015", "bridge_job_events"],
  ["RLS-D06-017", "permission_rules"],
  ["RLS-D06-019", "agent_usage_snapshots"],
  ["RLS-D06-022", "artifact_versions"],
];
describe("RLS 越境：会社の行を持つ表", () => {
  for (const [rowId, table] of TENANT_TABLES) {
    it(`${rowId} ${table}：他テナントの行は SELECT 0 行・UPDATE 0 行（SET LOCAL を正しく／別テナントに向ける／飛ばす）。副作用なし`, async () => {
      const seed = S.rows[table];
      expect(seed, `${table} の種`).toBeTruthy();
      const mine = seed!.visible;
      const other = seed!.other;
      expect(other).not.toBe(mine);
      // 種が本当に 2 社に分かれている（会社 b の行は会社 b のもの）
      expect((await rowJson(table, "id", other))["tenant_id"]).toBe(S.tenantB);
      expect((await rowJson(table, "id", mine))["tenant_id"]).toBe(S.tenantA);
      const before = await rowJson(table, "id", other);
      const boss: TenantContext = { tenantId: S.tenantA, userId: S.bossA, role: "member" };
      const wrong: TenantContext = { tenantId: S.tenantB, userId: S.bossA, role: "member" }; // 別テナントに SET LOCAL を向ける
      for (const [label, ctx] of [
        ["正しい文脈", boss],
        ["別テナントに向けた文脈", wrong],
        ["文脈なし", null],
      ] as const) {
        expect(await run(ctx, `select id from ${table} where id = $1`, [other]), `${label} SELECT`).toBe(0);
        const u = await run(ctx, `update ${table} set updated_at = now() where id = $1`, [other]);
        expect([0, "denied"], `${label} UPDATE`).toContain(u);
      }
      expect(await run(null, `select id from ${table}`, []), "文脈なしは自社の行も 0 行").toBe(0);
      expect(await rowJson(table, "id", other)).toEqual(before); // 副作用なし
    });
  }
});

// 全社共通のマスタ（tenant_id を持たない）：他テナントの行という区別が無い。会社の人は読めるが直せない／文脈なしは 0 行
const MASTER_TABLES: [string, string, string][] = [
  ["RLS-D01-015", "setup_steps", "n"],
  ["RLS-D06-014", "bridge_job_states", "key"],
];
describe("RLS 越境：全社共通のマスタ", () => {
  for (const [rowId, table, key] of MASTER_TABLES) {
    it(`${rowId} ${table}：tenant_id を持たない（他社の行が存在しない）。会社の人の UPDATE は弾かれ、文脈なしは SELECT 0 行・UPDATE も弾く。副作用なし`, async () => {
      const cols = (
        await admin.query(
          "select column_name from information_schema.columns where table_schema='public' and table_name=$1",
          [table],
        )
      ).rows.map((r) => r.column_name);
      expect(cols).not.toContain("tenant_id");
      const first = String((await admin.query(`select ${key} as k from ${table} order by 1 limit 1`)).rows[0].k);
      const before = await rowJson(table, key, first);
      const boss: TenantContext = { tenantId: S.tenantA, userId: S.bossA, role: "member" };
      expect((await run(boss, `select ${key} from ${table}`, [])) as number).toBeGreaterThan(0); // 会社の人は読める（全社共通）
      expect([0, "denied"]).toContain(
        await run(boss, `update ${table} set label = label || 'x' where ${key}::text = $1`, [first]),
      );
      expect(await run(null, `select ${key} from ${table}`, [])).toBe(0);
      expect([0, "denied"]).toContain(
        await run(null, `update ${table} set label = label || 'x' where ${key}::text = $1`, [first]),
      );
      expect(await rowJson(table, key, first)).toEqual(before);
    });
  }
});

describe("RLS 越境：認証の側にしか無い表", () => {
  it("RLS-D12-013 pending_signup：kaname_auth にあり、アプリの接続（kaname_app）からは文脈の有無にかかわらず読めない・直せない。副作用なし", async () => {
    const email = `qa-d-${Date.now()}@example.test`;
    await admin.query(
      "insert into kaname_auth.pending_signup (email, name, company_name, pw_iv, pw_tag, pw_data, token_hash, expires_at) values ($1, 'x', '会社', 'iv', 'tag', 'data', 'h', now() + interval '30 minutes')",
      [email],
    );
    const before = await rowJson("kaname_auth.pending_signup", "email", email);
    const boss: TenantContext = { tenantId: S.tenantA, userId: S.bossA, role: "member" };
    for (const ctx of [boss, null]) {
      expect(await run(ctx, "select email from kaname_auth.pending_signup where email = $1", [email])).toBe("denied");
      expect(await run(ctx, "update kaname_auth.pending_signup set name = 'y' where email = $1", [email])).toBe(
        "denied",
      );
    }
    expect(await rowJson("kaname_auth.pending_signup", "email", email)).toEqual(before);
    await admin.query("delete from kaname_auth.pending_signup where email = $1", [email]);
  });
});
