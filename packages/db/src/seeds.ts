// access-matrix の種（表ごと）。migration で表を足したら、ここに種を足す（無いと G33 が FAIL）。
import type pg from "pg";
import type { Seeded } from "./matrix.js";
import { seedGenericRows } from "./seed_generic.js";

export async function seedAccessMatrix(c: pg.PoolClient): Promise<Seeded> {
  // 運営の会社の製品の既定（migration が置くプラン 3 つ・ひな形の配るもの 3 つと版・K-958・K-992）は truncate の cascade で消えるので、
  //   写しを取って入れ直す（消えたままだと、同じ DB で後に流れる試験のプランを引く準備・会社の種まきが落ちる・統合の枝の CI）
  //   場合表の種が入れた行（key が seed・k9-…）は写さない（入れ直すと次の種と重なる）。版の行は親が入れ直せたものだけ
  const OPS_KEY = "tenant_id = app.ops_tenant_id() and key <> 'seed' and key not like 'k9-%'";
  const KEEP_OPS: readonly [string, string, string][] = [
    ["plans", OPS_KEY, "true"],
    [
      "plan_versions",
      `plan_id in (select id from plans where ${OPS_KEY})`,
      "exists (select 1 from plans p where p.id = k.plan_id)",
    ],
    ["distributions", OPS_KEY, "true"],
    [
      "distribution_versions",
      `distribution_id in (select id from distributions where ${OPS_KEY})`,
      "exists (select 1 from distributions d where d.id = k.distribution_id)",
    ],
  ];
  for (const [t] of KEEP_OPS)
    await c.query(
      `create temp table if not exists "keep_${t}" on commit preserve rows as select * from "${t}" where false`,
    );
  for (const [t, where] of KEEP_OPS) {
    await c.query(`delete from "keep_${t}"`);
    await c.query(`insert into "keep_${t}" select * from "${t}" where ${where}`);
  }
  // 証跡は行の DELETE を許さないが TRUNCATE は行トリガを通らない（テストの種の入れ替えだけに使う）。運営テナントは入れ直す
  await c.query(
    "truncate audit_events, ops_audit_events, security_events, export_jobs, permissions, support_access_grants, members, scopes, layers, tenants cascade",
  );
  await c.query(
    "insert into tenants (id, tenant_id, name) values (app.ops_tenant_id(), app.ops_tenant_id(), '運営') on conflict do nothing",
  );
  // truncate は terms_versions（運営のテナントに結ぶ）も消す。版が 1 つも無い状態は作らない（D-128.137）ので、種の第 1 版を入れ直す（migration 0088 と同じ関数）
  await c.query("select app.seed_first_terms()");
  for (const m of ["member_kinds", "target_kinds", "abilities"])
    await c.query(`delete from ${m} where key like $1`, ["k9%"]); // 前回の場合表が入れた試し行
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
  // 代表 a に、権限の対象（target_kinds＝表）全部の edit（表を足しても漏れない）
  await c.query(
    "insert into permissions (tenant_id, grantee_member_id, target_kind_id, ability_id) select $1, $2, key, 'edit' from target_kinds",
    [tenantA, bossA],
  );
  const permA = await one("select id from permissions where tenant_id = $1 limit 1", [tenantA]);
  const permB = await one(
    "insert into permissions (tenant_id, grantee_member_id, target_kind_id, ability_id) values ($1, $2, 'layers', 'view') returning id",
    [tenantB, bossB],
  );
  const opsTenant = (await c.query<{ id: string }>("select app.ops_tenant_id() as id")).rows[0]!.id;
  const opsScope = await one("insert into scopes (tenant_id, name) values ($1, '運営') returning id", [opsTenant]);
  const opsId = await one(
    "insert into members (tenant_id, scope_id, kind_id, display_name) values ($1, $2, 'human', '運営') returning id",
    [opsTenant, opsScope],
  );
  // 中を見るの許可は、開いた運営の人に結ぶ（K-10・D-128.68）。会社 a は有効、会社 b は期限切れ
  const opsMemberRow = await one(
    "insert into ops_members (tenant_id, member_id, caps) values ($1, $2, '{peek,inquiry}') returning id",
    [opsTenant, opsId],
  );
  const grantA = await one(
    "insert into support_access_grants (tenant_id, scope, expires_at, reason, ops_member_id) values ($1, 'all', now() + interval '1 hour', '問い合わせの調べ', $2) returning id",
    [tenantA, opsMemberRow],
  );
  const grantB = await one(
    "insert into support_access_grants (tenant_id, scope, expires_at, reason, created_at, ops_member_id) values ($1, 'all', now() - interval '1 hour', '問い合わせの調べ', now() - interval '2 hours', $2) returning id",
    [tenantB, opsMemberRow],
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
  const sesA = await one(
    "insert into sessions (tenant_id, member_id, kind_id, auth_session_id) values ($1, $2, 'web', 'seed-a') returning id",
    [tenantA, staffA],
  );
  const sesB = await one(
    "insert into sessions (tenant_id, member_id, kind_id, auth_session_id) values ($1, $2, 'web', 'seed-b') returning id",
    [tenantB, bossB],
  );
  const invA = await one(
    "insert into invitations (tenant_id, email, token_hash, expires_at) values ($1, 'a@example.test', 'h-a', now() + interval '1 day') returning id",
    [tenantA],
  );
  const invB = await one(
    "insert into invitations (tenant_id, email, token_hash, expires_at) values ($1, 'b@example.test', 'h-b', now() + interval '1 day') returning id",
    [tenantB],
  );
  const expB = await one(
    "insert into export_jobs (tenant_id, requested_by, kind_id) values ($1, $2, 'all') returning id",
    [tenantB, bossB],
  );
  const errA = await one(
    "insert into error_events (tenant_id, error_code, member_id, screen_id) values ($1, 'E-AUTH-001', $2, 'login') returning id",
    [tenantA, bossA],
  );
  const errB = await one(
    "insert into error_events (tenant_id, error_code, member_id, screen_id) values ($1, 'E-AUTH-001', $2, 'login') returning id",
    [tenantB, bossB],
  );
  const explicit: Record<string, Seeded["rows"][string]> = {
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
      insert: (t) => ({
        tenant_id: t,
        scope: "x",
        expires_at: new Date(Date.now() + 3000e3),
        reason: "問い合わせの調べ",
        ops_member_id: opsMemberRow,
      }),
    },
    member_kinds: {
      visible: "human",
      hiddenLayer: null,
      other: "human",
      insert: () => ({ key: `k9-${Math.random().toString(36).slice(2, 8)}`, label: "x" }),
    },
    target_kinds: {
      visible: "goal",
      hiddenLayer: null,
      other: "goal",
      insert: () => ({ key: `k9-${Math.random().toString(36).slice(2, 8)}`, label: "x" }),
    },
    abilities: {
      visible: "view",
      hiddenLayer: null,
      other: "view",
      insert: () => ({ key: `k9-${Math.random().toString(36).slice(2, 8)}`, label: "x" }),
    },
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
    sessions: {
      visible: sesA,
      hiddenLayer: null,
      other: sesB,
      insert: (t) => ({
        tenant_id: t,
        member_id: t === tenantA ? staffA : bossB,
        kind_id: "web",
        auth_session_id: `m-${t.slice(0, 8)}-${Math.random().toString(36).slice(2)}`,
      }),
    },
    invitations: {
      visible: invA,
      hiddenLayer: null,
      other: invB,
      insert: (t) => ({
        tenant_id: t,
        email: "x@example.test",
        token_hash: `h-${t.slice(0, 8)}-${Math.random().toString(36).slice(2)}`,
        expires_at: new Date(Date.now() + 3600e3),
      }),
    },
    session_kinds: {
      visible: "web",
      hiddenLayer: null,
      other: "web",
      insert: () => ({ key: `k9-${Math.random().toString(36).slice(2, 8)}`, label: "x" }),
    },
    revoke_reasons: {
      visible: "logout",
      hiddenLayer: null,
      other: "logout",
      insert: () => ({ key: `k9-${Math.random().toString(36).slice(2, 8)}`, label: "x" }),
    },
    export_jobs: {
      visible: expA,
      hiddenLayer: null,
      other: expB,
      insert: (t) => ({ tenant_id: t, requested_by: t === tenantA ? bossA : bossB, kind_id: "all" }),
    },
    error_events: {
      visible: errA,
      hiddenLayer: null,
      other: errB,
      insert: (t) => ({
        tenant_id: t,
        error_code: "E-AUTH-001",
        member_id: t === tenantA ? bossA : bossB,
        screen_id: "login",
      }),
    },
  };
  const generic = await seedGenericRows(
    c,
    { tenantA, tenantB, bossA, bossB, scopeRootA, scopeRootB, opsTenant, opsMember: opsId, opsScope },
    new Set(Object.keys(explicit)),
  );
  await seedKnowledgeForStaff(c, generic, { tenantA, scopeDeptA, staffA });
  const notices = await withFreshNotices(c, generic);
  // 運営の会社の製品の既定を入れ直す（種の後：種まきが運営の会社の配るものを「在る行」として使うと版 1 が重なる）
  await c.query("update keep_distribution_versions set released_by = null"); // 人は truncate で消えた
  for (const [t, , ok] of KEEP_OPS)
    await c.query(`insert into "${t}" select k.* from "keep_${t}" k where ${ok} on conflict do nothing`);
  return {
    tenantA,
    tenantB,
    bossA,
    staffA,
    scopeRootA,
    scopeDeptA,
    opsId,
    opsTenant,
    rows: { ...generic, ...notices, ...explicit },
  };
}

/**
 * 「ログイン済み（会社の人）」で読む表のうち、行の守りが「その人が書けるページ・その人の頼み」で決まる表（K-700・K-687・K-689）。
 * 汎用の種は代表の物なので担当者からは 0 行になる。種の見える行だけ、担当者の自分の棚の下書きのページと担当者の頼みに付け替える。
 */
async function seedKnowledgeForStaff(
  c: pg.PoolClient,
  rows: Record<string, { visible: string }>,
  b: { tenantA: string; scopeDeptA: string; staffA: string },
): Promise<void> {
  const page = (
    await c.query<{ id: string }>(
      "insert into knowledge_pages (tenant_id, scope_id, is_personal, title, owner_member_id, state) values ($1, $2, true, '担当者の下書き', $3, 'draft') returning id",
      [b.tenantA, b.scopeDeptA, b.staffA],
    )
  ).rows[0]!.id;
  for (const t of ["knowledge_breaches", "knowledge_shares"]) {
    const id = rows[t]?.visible;
    if (id) await c.query(`update "${t}" set page_id = $1 where id = $2`, [page, id]);
  }
  const req = rows["knowledge_requests"]?.visible;
  if (req) await c.query("update knowledge_requests set requested_by = $1 where id = $2", [b.staffA, req]);
}

/** 1 つのお知らせに 1 人 1 行（一意 notice_deliveries_member_uq・K-954）。見本の行を足すたびに、種のお知らせの写しを 1 つずつ使う */
const FRESH_NOTICES = 8;
async function withFreshNotices(
  c: pg.PoolClient,
  rows: Record<string, Seeded["rows"][string]>,
): Promise<Record<string, Seeded["rows"][string]>> {
  const nd = rows["notice_deliveries"];
  const seedNotice = rows["notices"]?.visible;
  if (!nd?.insert || !seedNotice) return {};
  const cols = (
    await c.query<{ col: string }>(
      "select column_name as col from information_schema.columns where table_schema = 'public' and table_name = 'notices' and column_name <> 'id' and is_generated <> 'ALWAYS'",
    )
  ).rows
    .map((r) => `"${r.col}"`)
    .join(", ");
  const pool: string[] = [];
  for (let i = 0; i < FRESH_NOTICES; i++)
    pool.push(
      (
        await c.query<{ id: string }>(
          `insert into notices (${cols}) select ${cols} from notices where id = $1 returning id`,
          [seedNotice],
        )
      ).rows[0]!.id,
    );
  const base = nd.insert;
  return {
    notice_deliveries: {
      ...nd,
      insert: (tenant: string) => ({ ...base(tenant), ...(pool.length ? { notice_id: pool.shift() } : {}) }),
    },
  };
}
