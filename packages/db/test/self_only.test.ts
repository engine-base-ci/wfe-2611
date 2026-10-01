// 「本人のもの」（D-073.1）：self_only_write を持つ全表について、担当者が自分の行を作れて直せる・他人の行は触れない。表の一覧は場合表（access-matrix.json）から機械的に取る
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "../src/migrate.js";
import { seedAccessMatrix } from "../src/seeds.js";
import { withTenant, type TenantContext } from "../src/context.js";

const DB_URL = process.env["DATABASE_URL"] ?? "postgres://postgres:postgres@127.0.0.1:55433/kaname_test";
const APP_URL = DB_URL.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const here = dirname(fileURLToPath(import.meta.url));
const matrix = JSON.parse(
  readFileSync(join(here, "..", "..", "..", "07_qa", "test-plan", "access-matrix.json"), "utf8"),
) as {
  cases: { table: string; policy: string; predicate: string }[];
};
const admin = new pg.Pool({ connectionString: DB_URL, max: 2 });
let app: pg.Pool;
let S: Awaited<ReturnType<typeof seedAccessMatrix>>;
let existing: Set<string>;
beforeAll(async () => {
  await migrate(DB_URL, join(here, ".."));
  const c = await admin.connect();
  try {
    S = await seedAccessMatrix(c);
    existing = new Set(
      (await c.query<{ t: string }>("select tablename as t from pg_tables where schemaname = 'public'")).rows.map(
        (r) => r.t,
      ),
    );
  } finally {
    c.release();
  }
  app = new pg.Pool({ connectionString: APP_URL, max: 2 });
});
afterAll(async () => {
  await app.end();
  await admin.end();
});

// テスト仕様書の「本人のもの」の行（rls-matrix.md・「もう無い行」の節は除く）。テスト名の先頭に行 ID を付け、結果は報告から機械で書く
const specIds = new Map<string, string[]>(); // table → 行 ID
{
  let gone = false;
  for (const line of readFileSync(join(here, "..", "..", "..", "07_qa", "test-specs", "rls-matrix.md"), "utf8").split("\n")) {
    if (line.startsWith("#")) gone = line.includes("もう無い行");
    const m = /^\|\s*(RLS-[A-Z0-9]+-\d+)\s*\|\s*(\w+)\s*\|\s*本人のもの\s*\|/.exec(line);
    if (m && !gone) specIds.set(m[2]!, [...(specIds.get(m[2]!) ?? []), m[1]!]);
  }
}
const selfOnly = new Map<string, string>(); // table → 本人の列
for (const cs of matrix.cases) {
  const m = /AND (\w+) = current_setting\('app\.user_id'/.exec(cs.predicate);
  if (cs.policy.endsWith("_self_only_write") && m) selfOnly.set(cs.table, m[1]!);
}

describe("本人のもの（self_only_write）", () => {
  it("場合表に self_only の表がある", () => {
    expect(selfOnly.size).toBeGreaterThan(0);
  });
  it("テスト仕様書の「本人のもの」の行は、全部 self_only の表を指している（試験の無い行を作らない）", () => {
    expect([...specIds.keys()].filter((t) => !selfOnly.has(t))).toEqual([]);
  });
  for (const [table, ownerCol] of selfOnly) {
    it(`${(specIds.get(table) ?? []).join(" ")} ${table}: 担当者は自分の行を作れて直せる。他人（代表）の行は 0 行`.trim(), async () => {
      if (!existing.has(table)) return; // 未 migration は担当の T-D-* で
      const seed = S.rows[table];
      expect(seed?.insert, `${table} の種が無い`).toBeTruthy();
      const staff: TenantContext = { tenantId: S.tenantA, userId: S.staffA, role: "member" };
      const boss: TenantContext = { tenantId: S.tenantA, userId: S.bossA, role: "member" };
      const ins = async (ctx: TenantContext, row: Record<string, unknown>) => {
        const keys = Object.keys(row).filter((k) => row[k] !== null && row[k] !== undefined);
        return withTenant(app, ctx, async (c) => {
          const r = await c.query<{ id: string }>(
            `insert into "${table}" (${keys.map((k) => `"${k}"`).join(", ")}) values (${keys.map((_, i) => `$${i + 1}`).join(", ")}) returning id`,
            keys.map((k) => row[k]),
          );
          return r.rows[0]!.id;
        });
      };
      const base = seed!.insert!(S.tenantA);
      const scoped = "scope_id" in base; // 層を持つ表：自分の行は自分の層（RETURNING は読める行だけ）
      const mine = await ins(staff, { ...base, [ownerCol]: S.staffA, ...(scoped ? { scope_id: S.scopeDeptA } : {}) });
      const others = await ins(boss, { ...seed!.insert!(S.tenantA), [ownerCol]: S.bossA });
      const upd = (ctx: TenantContext, id: string) =>
        withTenant(app, ctx, (c) =>
          c.query(`update "${table}" set updated_at = now() where id = $1`, [id]).then((r) => r.rowCount ?? 0),
        );
      const updMine = await upd(staff, mine);
      const updOther = await upd(staff, others);
      expect(updMine).toBe(1);
      expect(updOther).toBe(0);
    });
  }
});
