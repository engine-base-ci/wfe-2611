// RLS の実表テスト（モックしない）。DATABASE_URL の Postgres に migration を当て、superuser で種を入れ、kaname_app（RLS が効く）で読む。
// FND-02-002 上流を故意に壊す：SET LOCAL を飛ばす／別テナントに向ける／権限を落とす／運営が grant 無しで読む。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "../src/migrate.js";
import { withTenant } from "../src/context.js";
import { noVendorSql, rlsEnabled } from "../src/ci.js";

const URL = process.env["DATABASE_URL"]!;
const APP_URL = URL.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const pkg = join(dirname(fileURLToPath(import.meta.url)), "..");
const admin = new pg.Pool({ connectionString: URL, max: 2 });
let app: pg.Pool;
const T = { a: "", b: "" };
const M = { aBoss: "", aStaff: "", bBoss: "" };
const S = { aRoot: "", aDept: "", bRoot: "" };

beforeAll(async () => {
  await migrate(URL, pkg);
  app = new pg.Pool({ connectionString: APP_URL, max: 2 });
  const c = await admin.connect();
  try {
    await c.query("truncate permissions, support_access_grants, members, scopes, layers, tenants cascade");
    for (const k of ["a", "b"] as const) {
      const t = await c.query<{ id: string }>(
        "insert into tenants (id, tenant_id, name) select u, u, $1 from gen_random_uuid() as u returning id",
        [`会社 ${k}`],
      );
      T[k] = t.rows[0]!.id;
    }
    S.aRoot = (
      await c.query<{ id: string }>("insert into scopes (tenant_id, name) values ($1, '会社') returning id", [T.a])
    ).rows[0]!.id;
    S.aDept = (
      await c.query<{ id: string }>(
        "insert into scopes (tenant_id, parent_id, name) values ($1, $2, '層 1') returning id",
        [T.a, S.aRoot],
      )
    ).rows[0]!.id;
    S.bRoot = (
      await c.query<{ id: string }>("insert into scopes (tenant_id, name) values ($1, '会社') returning id", [T.b])
    ).rows[0]!.id;
    M.aBoss = (
      await c.query<{ id: string }>(
        "insert into members (tenant_id, scope_id, kind_id, display_name) values ($1, $2, 'human', '代表') returning id",
        [T.a, S.aRoot],
      )
    ).rows[0]!.id;
    M.aStaff = (
      await c.query<{ id: string }>(
        "insert into members (tenant_id, scope_id, kind_id, display_name) values ($1, $2, 'human', '担当者') returning id",
        [T.a, S.aDept],
      )
    ).rows[0]!.id;
    M.bBoss = (
      await c.query<{ id: string }>(
        "insert into members (tenant_id, scope_id, kind_id, display_name) values ($1, $2, 'human', '別会社の代表') returning id",
        [T.b, S.bRoot],
      )
    ).rows[0]!.id;
    await c.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'layers', null, 'edit'), ($1, $2, 'permissions', null, 'edit'), ($1, $2, 'members', null, 'edit')",
      [T.a, M.aBoss],
    );
  } finally {
    c.release();
  }
});
afterAll(async () => {
  await app?.end();
  await admin.end();
});

const asA = (userId: string) => ({ tenantId: T.a, userId, role: "member" as const });
const count = (client: pg.PoolClient, sql: string, params: unknown[] = []) =>
  client.query(sql, params).then((r) => r.rowCount ?? 0);

describe("G4/G5 ゲート", () => {
  it("public の全表で RLS が enable＋force", async () => {
    const r = await rlsEnabled(URL);
    expect(r.missing).toEqual([]);
    expect(r.tables).toBeGreaterThanOrEqual(9);
  });
  it("ベンダー固有 SQL が無い", () => {
    expect(noVendorSql(pkg)).toEqual({ ok: true, hits: [] });
  });
});

describe("読む（テナントと見える層）", () => {
  it("会社 a の代表は a の行だけ見え、b は見えない", async () => {
    const n = await withTenant(app, asA(M.aBoss), (c) => count(c, "select id from members"));
    expect(n).toBe(2);
    const b = await withTenant(app, asA(M.aBoss), (c) =>
      count(c, "select id from members where tenant_id = $1", [T.b]),
    );
    expect(b).toBe(0);
  });
  it("担当者は自分の層とその下だけ（会社の層の代表は見えない）", async () => {
    const names = await withTenant(app, asA(M.aStaff), (c) =>
      c
        .query<{ display_name: string }>("select display_name from members order by 1")
        .then((r) => r.rows.map((x) => x.display_name)),
    );
    expect(names).toEqual(["担当者"]);
  });
  it("上流を壊す：SET LOCAL を飛ばすと 0 行", async () => {
    const c = await app.connect();
    try {
      expect(await count(c, "select id from members")).toBe(0);
      expect(await count(c, "select id from tenants")).toBe(0);
      expect(await count(c, "select id from permissions")).toBe(0);
    } finally {
      c.release();
    }
  });
  it("上流を壊す：別テナントに SET LOCAL を向けても 0 行（メンバーでない会社は読めない）", async () => {
    const n = await withTenant(app, { tenantId: T.b, userId: M.aBoss, role: "member" }, (c) =>
      count(c, "select id from members"),
    );
    expect(n).toBe(0);
    const t = await withTenant(app, { tenantId: T.b, userId: M.aBoss, role: "member" }, (c) =>
      count(c, "select id from tenants"),
    );
    expect(t).toBe(0);
  });
  it("マスタはログイン済みなら誰でも読める。文脈が無ければ読めない", async () => {
    expect(await withTenant(app, asA(M.aStaff), (c) => count(c, "select key from abilities"))).toBeGreaterThan(0);
    const c = await app.connect();
    try {
      expect(await count(c, "select key from abilities")).toBe(0);
    } finally {
      c.release();
    }
  });
});

describe("書く（権限＝誰に×何に×どの層で×できること）", () => {
  it("権限のある代表は層を作れる", async () => {
    const n = await withTenant(app, asA(M.aBoss), (c) =>
      count(c, "insert into layers (tenant_id, key, label, order_no) values ($1, 'dept', '部門', 1) returning id", [
        T.a,
      ]),
    );
    expect(n).toBe(1);
  });
  it("上流を壊す：権限の無い担当者は層を作れない（副作用なし）", async () => {
    await expect(
      withTenant(app, asA(M.aStaff), (c) =>
        c.query("insert into layers (tenant_id, key, label, order_no) values ($1, 'x', 'x', 9)", [T.a]),
      ),
    ).rejects.toThrow(/row-level security/);
    expect(await withTenant(app, asA(M.aBoss), (c) => count(c, "select id from layers where key = 'x'"))).toBe(0);
  });
  it("上流を壊す：担当者は自分に権限を付与できない", async () => {
    await expect(
      withTenant(app, asA(M.aStaff), (c) =>
        c.query(
          "insert into permissions (tenant_id, grantee_member_id, target_kind_id, ability_id) values ($1, $2, 'layers', 'edit')",
          [T.a, M.aStaff],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });
  it("代表は別会社の行を作れない（tenant_id を偽っても弾く）", async () => {
    await expect(
      withTenant(app, asA(M.aBoss), (c) =>
        c.query("insert into layers (tenant_id, key, label, order_no) values ($1, 'y', 'y', 2)", [T.b]),
      ),
    ).rejects.toThrow(/row-level security/);
  });
  it("edit は view を含む（has_permission）", async () => {
    const r = await withTenant(app, asA(M.aBoss), (c) =>
      c.query<{ ok: boolean }>("select has_permission($1, 'layers', null, 'view') as ok", [M.aBoss]),
    );
    expect(r.rows[0]!.ok).toBe(true);
    const s = await withTenant(app, asA(M.aStaff), (c) =>
      c.query<{ ok: boolean }>("select has_permission($1, 'layers', null, 'view') as ok", [M.aStaff]),
    );
    expect(s.rows[0]!.ok).toBe(false);
  });
});

describe("運営（既定で読めない）", () => {
  // 中を見るの許可は、開いた運営の人に結ぶ（K-10・D-128.68）。運営の人の行を用意する
  const ops = { tenantId: T.a, userId: null as string | null, role: "ops" as const };
  let opsMember = "";
  const grant = (tenant: string, extra = "") =>
    admin.query<{ id: string }>(
      `insert into support_access_grants (tenant_id, scope, expires_at, reason, ops_member_id${extra ? ", " + extra.split("=")[0] : ""}) values ($1, 'members', now() + interval '1 hour', '問い合わせの調べ', $2${extra ? ", " + extra.split("=")[1] : ""}) returning id`,
      [tenant, opsMember],
    );
  beforeAll(async () => {
    const opsT = (
      await admin.query<{ id: string }>(
        "insert into tenants (id, tenant_id, name) values (app.ops_tenant_id(), app.ops_tenant_id(), '運営') on conflict (id) do update set name = excluded.name returning id",
      )
    ).rows[0]!.id;
    const sc = (
      await admin.query<{ id: string }>("insert into scopes (tenant_id, name) values ($1, '運営') returning id", [opsT])
    ).rows[0]!.id;
    ops.userId = (
      await admin.query<{ id: string }>(
        "insert into members (tenant_id, scope_id, kind_id, display_name) values ($1, $2, 'human', '運営の人') returning id",
        [opsT, sc],
      )
    ).rows[0]!.id;
    opsMember = (
      await admin.query<{ id: string }>(
        "insert into ops_members (tenant_id, member_id, caps) values ($1, $2, '{peek}') returning id",
        [opsT, ops.userId],
      )
    ).rows[0]!.id;
  });
  it("grant が無ければ 0 行", async () => {
    expect(await withTenant(app, { ...ops, tenantId: T.a }, (c) => count(c, "select id from members"))).toBe(0);
  });
  it("範囲・期限つきの grant があるときだけ読める。期限切れ・取り消しは 0 行", async () => {
    const g = (await grant(T.a)).rows[0]!.id;
    expect(await withTenant(app, { ...ops, tenantId: T.a }, (c) => count(c, "select id from members"))).toBe(2);
    await admin.query("update support_access_grants set revoked_at = now() where id = $1", [g]);
    expect(await withTenant(app, { ...ops, tenantId: T.a }, (c) => count(c, "select id from members"))).toBe(0);
  });
  it("運営は grant があっても書けない", async () => {
    await grant(T.a);
    // UPDATE は policy に合わない行を黙って 0 行にする（Postgres の RLS の仕様）。件数 0 と値が変わっていないことで確かめる。INSERT は弾かれる
    const n = await withTenant(app, { ...ops, tenantId: T.a }, (c) =>
      count(c, "update members set display_name = 'x' where id = $1", [M.aStaff]),
    );
    expect(n).toBe(0);
    const name = await admin.query<{ display_name: string }>("select display_name from members where id = $1", [
      M.aStaff,
    ]);
    expect(name.rows[0]!.display_name).toBe("担当者");
    await expect(
      withTenant(app, { ...ops, tenantId: T.a }, (c) =>
        c.query("insert into layers (tenant_id, key, label, order_no) values ($1, 'ops', 'x', 3)", [T.a]),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("文脈の検査", () => {
  it("member の文脈に tenantId／userId が無ければ投げる", async () => {
    await expect(withTenant(app, { tenantId: null, userId: null, role: "member" }, async () => 1)).rejects.toThrow(
      /要る/,
    );
    await expect(withTenant(app, { tenantId: "x", userId: null, role: "ops" }, async () => 1)).rejects.toThrow(/uuid/);
  });
});
