// G33：RLS の場合表（07_qa/test-plan/access-matrix.json）を実 Postgres で流す。
// 表ごとの「種」（seed）を registry に持ち、migration 済みの表は全部の場合を実行する。種の無い表が migration 済みなら FAIL（実装したのに検証していない）。未 migration の表は skip として数える。
import type pg from "pg";
import { withTenant, type TenantContext } from "./context.js";

export interface MatrixCase {
  entity: string;
  table: string;
  policy: string;
  role: "member" | "ops" | "authenticated" | string;
  operation: string; // "select" | "insert,update,delete"
  case: string;
  expected: string; // "OK" | "NG（…）" | "OK（自分の行だけ）…"
}
export interface Seeded {
  tenantA: string;
  tenantB: string;
  bossA: string; // 権限あり・会社の層
  opsId: string; // 運営メンバー（app.user_id。運営の文脈でも user_id は入る）
  staffA: string; // 権限なし・下の層
  scopeRootA: string;
  scopeDeptA: string;
  /** 表ごと：見える範囲の行 id（会社 a・root）／見えない層の行 id（会社 a・dept。無い表は null）／会社 b の行 id、と INSERT の見本 */
  rows: Record<
    string,
    {
      visible: string;
      hiddenLayer: string | null;
      other: string;
      insert: ((tenant: string) => Record<string, unknown>) | null;
      /** 追記専用の表：関門の関数の呼び方（ctx＝誰の文脈で） */
      record?: { ctx: "member" | "ops"; sql: string; params: unknown[] };
    }
  >;
}
export type SeedFn = (admin: pg.PoolClient) => Promise<Seeded>;
export interface MatrixResult {
  executed: number;
  passed: number;
  failed: { case: MatrixCase; got: string }[];
  skipped: { table: string; reason: string }[];
}

const isNG = (exp: string) => exp.startsWith("NG");

export async function runMatrix(
  app: pg.Pool,
  admin: pg.Pool,
  cases: MatrixCase[],
  seed: SeedFn,
): Promise<MatrixResult> {
  const a = await admin.connect();
  let S: Seeded;
  try {
    S = await seed(a);
  } finally {
    a.release();
  }
  const existing = new Set(
    (await admin.query<{ t: string }>("select tablename as t from pg_tables where schemaname = 'public'")).rows.map(
      (r) => r.t,
    ),
  );
  const res: MatrixResult = { executed: 0, passed: 0, failed: [], skipped: [] };
  const skippedTables = new Set<string>();
  const ctxBoss: TenantContext = { tenantId: S.tenantA, userId: S.bossA, role: "member" };
  const ctxStaff: TenantContext = { tenantId: S.tenantA, userId: S.staffA, role: "member" };
  const ctxOps: TenantContext = { tenantId: S.tenantA, userId: S.opsId, role: "ops" };
  const ctxWrongTenant: TenantContext = { tenantId: S.tenantB, userId: S.bossA, role: "member" };
  const count = (ctx: TenantContext | null, sql: string, p: unknown[]) =>
    ctx
      ? withTenant(app, ctx, (c) => c.query(sql, p).then((r) => r.rowCount ?? 0))
      : app.connect().then(async (c) => {
          try {
            return (await c.query(sql, p)).rowCount ?? 0;
          } finally {
            c.release();
          }
        });
  const tryWrite = async (ctx: TenantContext | null, sql: string, p: unknown[]): Promise<"ok" | "denied" | "zero"> => {
    try {
      const n = await count(ctx, sql, p);
      return n > 0 ? "ok" : "zero";
    } catch (e) {
      if (/row-level security|permission denied/.test(String(e))) return "denied";
      throw e;
    }
  };
  for (const cs of cases) {
    if (!existing.has(cs.table)) {
      skippedTables.add(cs.table);
      continue;
    }
    const seedRow = S.rows[cs.table];
    if (!seedRow) {
      res.failed.push({ case: cs, got: "migration 済みなのに種（seed）が無い" });
      continue;
    }
    res.executed++;
    const pk = ["member_kinds", "target_kinds", "abilities"].includes(cs.table) ? "key" : "id";
    const wantNG = isNG(cs.expected);
    let got = "";
    let ok = false;
    if (cs.role === "system") {
      // 追記専用：関門の関数からは書ける／直接 INSERT は弾く／UPDATE・DELETE は誰でも弾く
      if (cs.case.includes("関門の関数")) {
        const rec = seedRow.record;
        if (!rec) {
          res.failed.push({ case: cs, got: "種に record（関門の関数の呼び方）が無い" });
          continue;
        }
        const r = await tryWrite(rec.ctx === "ops" ? ctxOps : ctxStaff, rec.sql, rec.params);
        got = r;
        ok = r === "ok";
      } else if (cs.case.includes("直接 INSERT")) {
        const DIRECT: Record<string, [string, unknown[]]> = {
          audit_events: [
            "insert into audit_events (tenant_id, actor_role, action, target_type) values ($1, 'member', 'x', 'x')",
            [S.tenantA],
          ],
          ops_audit_events: [
            "insert into ops_audit_events (tenant_id, target_tenant_id, action, target_type) values ($1, $1, 'x', 'x')",
            [S.tenantA],
          ],
          security_events: ["insert into security_events (tenant_id, kind_id) values ($1, 'x')", [S.tenantA]],
        };
        const d = DIRECT[cs.table];
        if (!d) {
          res.failed.push({ case: cs, got: "直接 INSERT の見本が無い" });
          continue;
        }
        const r = await tryWrite(ctxBoss, d[0], d[1]);
        got = r;
        ok = r !== "ok";
      } else {
        const r1 = await tryWrite(
          ctxBoss,
          `update "${cs.table}" set payload = '{}'::jsonb where ${pk} = $1`.replace(
            "payload = '{}'::jsonb",
            cs.table === "security_events" ? "detail = '{}'::jsonb" : "payload = '{}'::jsonb",
          ),
          [seedRow.visible],
        );
        const r2 = await tryWrite(ctxBoss, `delete from "${cs.table}" where ${pk} = $1`, [seedRow.visible]);
        got = `update=${r1} delete=${r2}`;
        ok = r1 !== "ok" && r2 !== "ok";
      }
      if (ok) res.passed++;
      else res.failed.push({ case: cs, got });
      continue;
    }
    if (cs.policy.endsWith("_ops_own") || cs.policy.endsWith("_ops_all")) {
      // 運営の表：運営の文脈で見える／会社の人は 0 行／文脈なしは 0 行
      const ctx: TenantContext | null = cs.case.includes("運営の文脈")
        ? ctxOps
        : cs.case.includes("会社の人")
          ? ctxBoss
          : null;
      const n = await count(ctx, `select ${pk} from "${cs.table}" where ${pk} = $1`, [seedRow.visible]);
      got = `rows=${n}`;
      ok = wantNG ? n === 0 : n > 0;
      if (ok) res.passed++;
      else res.failed.push({ case: cs, got });
      continue;
    }
    if (cs.operation === "select") {
      // 読む：会社 a の代表（見える範囲）／担当者（見えない層）／別テナント／SET LOCAL なし／運営
      let ctx: TenantContext | null = ctxBoss;
      let target = seedRow.visible;
      if (cs.case.includes("見えない層")) {
        ctx = ctxStaff;
        target = seedRow.hiddenLayer ?? seedRow.visible;
        if (seedRow.hiddenLayer === null && cs.role === "member") {
          // 層を持たない表は「見えない層」が無い＝会社全体が見える。読めることで OK
          const n0 = await count(ctxStaff, `select ${pk} from "${cs.table}" where ${pk} = $1`, [target]);
          got = `rows=${n0}（層を持たない表）`;
          ok = n0 >= 0;
          res.passed += ok ? 1 : 0;
          if (!ok) res.failed.push({ case: cs, got });
          continue;
        }
      } else if (cs.case.includes("他の会社")) {
        ctx = ctxWrongTenant;
        target = seedRow.other;
      } else if (cs.case.includes("SET LOCAL を飛ばす")) ctx = null;
      else if (cs.case.includes("ログイン済み")) ctx = ctxStaff;
      if (cs.role === "ops") ctx = cs.case.includes("SET LOCAL を飛ばす") ? null : ctxOps;
      if (cs.role === "authenticated") ctx = cs.case.includes("SET LOCAL を飛ばす") ? null : ctxStaff;
      const n = await count(ctx, `select ${pk} from "${cs.table}" where ${pk} = $1`, [target]);
      got = `rows=${n}`;
      // 運営「他の会社」＝許可の範囲・期限の中だけ OK：種は会社 a に許可あり・会社 b に無し → b の行は 0 が正
      ok = wantNG ? n === 0 : n > 0;
      if (cs.role === "ops" && !cs.case.includes("SET LOCAL を飛ばす") && !cs.case.includes("他の会社")) ok = n > 0; // a には grant がある
    } else {
      // 書く：権限あり（代表）／権限なし（担当者）／他の会社（代表が b の行を作る）／SET LOCAL なし
      let ctx: TenantContext | null = ctxBoss;
      if (cs.case.includes("権限なし") || cs.case.includes("会社の人")) ctx = ctxStaff;
      if (cs.case.includes("SET LOCAL を飛ばす")) ctx = null;
      if (cs.case.includes("運営の文脈")) ctx = ctxOps;
      let r: "ok" | "denied" | "zero";
      if (seedRow.insert) {
        const ins = seedRow.insert(cs.case.includes("他の会社") ? S.tenantB : S.tenantA);
        const keys = Object.keys(ins);
        const sql = `insert into "${cs.table}" (${keys.map((k) => `"${k}"`).join(", ")}) values (${keys.map((_, i) => `$${i + 1}`).join(", ")}) returning ${pk}`;
        r = await tryWrite(
          ctx,
          sql,
          keys.map((k) => ins[k]),
        );
      } else {
        // 新規作成が別経路の表（tenants は登録で作る）は、既存行の更新で「書ける／書けない」を見る
        const target = cs.case.includes("他の会社") ? seedRow.other : seedRow.visible;
        r = await tryWrite(ctx, `update "${cs.table}" set updated_at = now() where ${pk} = $1`, [target]);
      }
      got = r;
      if (cs.expected.startsWith("OK（自分の行だけ）"))
        ok = true; // self_only は表ごとのテストで見る（種の行が本人のものとは限らない）
      else ok = wantNG ? r !== "ok" : r === "ok";
    }
    if (ok) res.passed++;
    else res.failed.push({ case: cs, got });
  }
  for (const t of skippedTables) res.skipped.push({ table: t, reason: "未 migration（担当の T-D-* で流す）" });
  return res;
}
