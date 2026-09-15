// access-matrix の種（表ごと）。migration で表を足したら、ここに種を足す（無いと G33 が FAIL）。
import type pg from "pg";
import type { Seeded } from "./matrix.js";

export async function seedAccessMatrix(c: pg.PoolClient): Promise<Seeded> {
  await c.query("truncate permissions, support_access_grants, members, scopes, layers, tenants cascade");
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
    },
  };
}
