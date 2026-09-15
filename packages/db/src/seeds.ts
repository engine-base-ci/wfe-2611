// access-matrix の種（表ごと）。migration で表を足したら、ここに種を足す（無いと G33 が FAIL）。
import type pg from "pg";
import type { Seeded } from "./matrix.js";

export async function seedAccessMatrix(c: pg.PoolClient): Promise<Seeded> {
  // 証跡は行の DELETE を許さないが TRUNCATE は行トリガを通らない（テストの種の入れ替えだけに使う）。運営テナントは入れ直す
  await c.query(
    "truncate audit_events, ops_audit_events, security_events, export_jobs, permissions, support_access_grants, members, scopes, layers, tenants cascade",
  );
  await c.query(
    "insert into tenants (id, tenant_id, name) values (app.ops_tenant_id(), app.ops_tenant_id(), '運営') on conflict do nothing",
  );
  for (const m of ["member_kinds", "target_kinds", "abilities"])
    await c.query(`delete from ${m} where key = $1`, ["k9"]); // 前回の場合表が入れた試し行
  const one = async (sql: string, p: unknown[] = []) => (await c.query<{ id: string }>(sql, p)).rows[0]!.id;
  const tenantA = await one(
    "insert into tenants (id, tenant_id, name) select u, u, '会社 a' from gen_random_uuid() u returning id",
  );
  const tenantB = await one(
    "insert into tenants (id, tenant_id, name) select u, u, '会社 b' from gen_random_uuid() u returning id",
  );
  const scopeRootA = await one("insert into scopes (tenant_id, name) values ($1, '会社') returning id", [tenantA]);
  const scopeDeptA = await one("insert into scopes (tenant_id, parent_id, name) values ($1, $2, '層 1') returning id", [
    tenantA,
    scopeRootA,
  ]);
  const scopeRootB = await one("insert into scopes (tenant_id, name) values ($1, '会社') returning id", [tenantB]);
  const layerA = await one(
    "insert into layers (tenant_id, key, label, order_no) values ($1, 'l1', '層 1', 1) returning id",
    [tenantA],
  );
  const layerB = await one(
    "insert into layers (tenant_id, key, label, order_no) values ($1, 'l1', '層 1', 1) returning id",
    [tenantB],
  );
  const bossA = await one(
    "insert into members (tenant_id, scope_id, kind_id, display_name) values ($1, $2, 'human', '代表') returning id",
    [tenantA, scopeRootA],
  );
  const staffA = await one(
    "insert into members (tenant_id, scope_id, kind_id, display_name) values ($1, $2, 'human', '担当者') returning id",
    [tenantA, scopeDeptA],
  );
  const bossB = await one(
    "insert into members (tenant_id, scope_id, kind_id, display_name) values ($1, $2, 'human', '別会社') returning id",
    [tenantB, scopeRootB],
  );
  for (const k of ["tenants", "layers", "scopes", "members", "permissions", "support_access_grants"])
    await c.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, ability_id) values ($1, $2, $3, 'edit')",
      [tenantA, bossA, k],
    );
  const permA = await one("select id from permissions where tenant_id = $1 limit 1", [tenantA]);
  const permB = await one(
    "insert into permissions (tenant_id, grantee_member_id, target_kind_id, ability_id) values ($1, $2, 'layers', 'view') returning id",
    [tenantB, bossB],
  );
  const grantA = await one(
    "insert into support_access_grants (tenant_id, scope, expires_at) values ($1, 'all', now() + interval '1 hour') returning id",
    [tenantA],
  );
  const opsId = (await c.query<{ id: string }>("select gen_random_uuid() as id")).rows[0]!.id;
  const grantB = await one(
    "insert into support_access_grants (tenant_id, scope, expires_at) values ($1, 'all', now() - interval '1 hour') returning id",
    [tenantB],
  ); // 期限切れ
  // 証跡：関門の関数で作る（直接 INSERT は無い）。会社 a は担当者の文脈、会社 b は別会社の代表の文脈、運営は運営の文脈
  const rec = async (tenant: string, user: string, role: string, sql: string, params: unknown[]) => {
    await c.query("begin");
    await c.query(
      "select set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true), set_config('app.role', $3, true)",
      [tenant, user, role],
    );
    const id = (await c.query<{ id: string }>(sql, params)).rows[0]!.id;
    await c.query("commit");
    return id;
  };
  const auditA = await rec(
    tenantA,
    staffA,
    "member",
    "select app.record_audit('seed', 'layers', 'x', 'C2', '{}'::jsonb) as id",
    [],
  );
  const auditB = await rec(
    tenantB,
    bossB,
    "member",
    "select app.record_audit('seed', 'layers', 'x', 'C2', '{}'::jsonb) as id",
    [],
  );
  const secA = await rec(
    tenantA,
    staffA,
    "member",
    "select app.record_security_event($1, 'login_failed', $2, 'JP', '{}'::jsonb) as id",
    [tenantA, staffA],
  );
  const secB = await rec(
    tenantB,
    bossB,
    "member",
    "select app.record_security_event($1, 'login_failed', $2, 'JP', '{}'::jsonb) as id",
    [tenantB, bossB],
  );
  const opsA = await rec(
    tenantA,
    opsId,
    "ops",
    "select app.record_ops_audit($1::uuid, 'seed', 'tenant', $1::text, null, '{}'::jsonb) as id",
    [tenantA],
  );
  const expA = await one(
    "insert into export_jobs (tenant_id, requested_by, kind_id) values ($1, $2, 'all') returning id",
    [tenantA, staffA],
  );
  const expB = await one(
    "insert into export_jobs (tenant_id, requested_by, kind_id) values ($1, $2, 'all') returning id",
    [tenantB, bossB],
  );
  return {
    tenantA,
    tenantB,
    bossA,
    staffA,
    scopeRootA,
    scopeDeptA,
    opsId,
    rows: {
      tenants: { visible: tenantA, hiddenLayer: null, other: tenantB, insert: null },
      layers: {
        visible: layerA,
        hiddenLayer: null,
        other: layerB,
        insert: (t) => ({ tenant_id: t, key: "new", label: "新", order_no: 9 }),
      },
      scopes: {
        visible: scopeRootA,
        hiddenLayer: null,
        other: scopeRootB,
        insert: (t) => ({ tenant_id: t, name: "新" }),
      },
      members: {
        visible: bossA,
        hiddenLayer: bossA,
        other: bossB,
        insert: (t) => ({
          tenant_id: t,
          scope_id: t === tenantA ? scopeRootA : scopeRootB,
          kind_id: "human",
          display_name: "新",
        }),
      },
      permissions: {
        visible: permA,
        hiddenLayer: null,
        other: permB,
        insert: (t) => ({
          tenant_id: t,
          grantee_member_id: t === tenantA ? staffA : bossB,
          target_kind_id: "goal",
          ability_id: "view",
        }),
      },
      support_access_grants: {
        visible: grantA,
        hiddenLayer: null,
        other: grantB,
        insert: (t) => ({ tenant_id: t, scope: "x", expires_at: new Date(Date.now() + 3600e3) }),
      },
      member_kinds: { visible: "human", hiddenLayer: null, other: "human", insert: () => ({ key: "k9", label: "x" }) },
      target_kinds: { visible: "goal", hiddenLayer: null, other: "goal", insert: () => ({ key: "k9", label: "x" }) },
      abilities: { visible: "view", hiddenLayer: null, other: "view", insert: () => ({ key: "k9", label: "x" }) },
      audit_events: {
        visible: auditA,
        hiddenLayer: null,
        other: auditB,
        insert: null,
        record: {
          ctx: "member",
          sql: "select app.record_audit('matrix', 'layers', 'x', 'C2', '{}'::jsonb) as id",
          params: [],
        },
      },
      security_events: {
        visible: secA,
        hiddenLayer: null,
        other: secB,
        insert: null,
        record: {
          ctx: "member",
          sql: "select app.record_security_event($1, 'login_failed', $2, 'JP', '{}'::jsonb) as id",
          params: [tenantA, staffA],
        },
      },
      ops_audit_events: {
        visible: opsA,
        hiddenLayer: null,
        other: opsA,
        insert: null,
        record: {
          ctx: "ops",
          sql: "select app.record_ops_audit($1::uuid, 'matrix', 'tenant', $1::text, null, '{}'::jsonb) as id",
          params: [tenantA],
        },
      },
      export_jobs: {
        visible: expA,
        hiddenLayer: null,
        other: expB,
        insert: (t) => ({ tenant_id: t, requested_by: t === tenantA ? bossA : bossB, kind_id: "all" }),
      },
    },
  };
}
