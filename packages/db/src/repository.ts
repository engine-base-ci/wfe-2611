// 関門 C2：業務ロジックが DB に触る唯一の入口 repository.<table>.<op>(input, ctx)。
// ここで 1 回だけやること：テナント文脈（withTenant）・監査列（created_by/updated_by）・論理削除の強制・識別子の許可リスト（文字列連結の禁止 G10）・UUID v7。
import type pg from "pg";
import { withRequest, withTenant, type TenantContext } from "./context.js";
import { uuidv7 } from "./id.js";

/** 触ってよい表（migration で作った表だけ。無い表は起動時に拒否） */
export const TABLES = [
  "tenants",
  "layers",
  "scopes",
  "members",
  "permissions",
  "support_access_grants",
  "member_kinds",
  "target_kinds",
  "abilities",
  "audit_events",
  "ops_audit_events",
  "security_events",
  "export_jobs",
  "sessions",
  "invitations",
  "session_kinds",
  "revoke_reasons",
  "error_events",
  "clones",
  "ai_employees",
  "goal_kinds",
  "units",
  "rollup_kinds",
  "goals",
  "goal_allocations",
  "goal_contributions",
  "goal_versions",
  "hypotheses",
  "measures",
  "validations",
  "ledger_definitions",
  "ledger_fields",
  "ledger_stages",
  "ledger_views",
  "ledger_records",
  "duties",
  "duty_versions",
  "learned_procedures",
  "procedure_steps",
  "memory_kinds",
  "memories",
  "tasks",
  "task_handovers",
  "daily_plans",
  "triggers",
  "policies",
  "approvals",
  "action_runs",
  "service_registry",
  "credential_kinds",
  "credentials",
  "conversations",
  "messages",
  "artifacts",
  "account_events",
  "account_event_items",
  "retention_holds",
  "erasure_certificates",
  "distributions",
  "distribution_versions",
  "tenant_distributions",
  "service_registry_versions",
  "service_requests",
  "review_requests",
  "ops_members",
  "inquiries",
  "notices",
  "notice_deliveries",
  "status_incidents",
  "notification_preferences",
  "notifications",
  "plans",
  "plan_versions",
  "subscriptions",
  "plan_change_requests",
  "usage_meters",
  "invoices",
  "payments",
  "imports",
  "integrations",
  "attachments",
  "skills",
  "skill_versions",
  "skill_test_runs",
  "skill_attachments",
  "payment_methods",
  "billing_events",
  "llm_routes",
  "llm_capabilities",
  "push_devices",
  "disclosure_versions",
  "subprocessors",
  // チケットの本体（K-3・0071）
  "ticket_kinds",
  "kind_sections",
  "ticket_stages",
  "class_axes",
  "class_values",
  "tickets",
  "ticket_sections",
  "ticket_section_versions",
  "ticket_class_values",
  "handover_rules",
  // チケットのまわり（K-4・0072）
  "test_specs",
  "checks",
  "ticket_decisions",
  "ticket_messages",
  "reference_logs",
  "ticket_links",
  "ticket_handovers",
  "saved_views",
  "ticket_imports",
  // ナレッジ（K-5・0073）
  "knowledge_pages",
  "knowledge_page_versions",
  "knowledge_links",
  // 取引先（K-6・0074）
  "clients",
  "client_groups",
  "client_contacts",
  "client_requests",
  "acceptances",
  // ワークスペースと人（K-7・0075）
  "tenant_memberships",
  "scope_memberships",
  "terms_versions",
  "terms_consents",
  "notification_settings",
  "bridge_pairing_codes",
  // 分身と運営（K-8・0076）
  "learning_candidates",
  "operations",
  "ops_plan_proposals",
  // 既にある表を契約から使う（K-11）。pending_signup とパスキーはログインの部品の側（kaname_auth）なので入れない（D-128.119）
  "bridge_jobs",
  "bridge_job_events",
  "agent_usage_snapshots",
  "artifact_versions",
] as const;
/** 追記専用（関門の関数 app.record_* だけが書く。repository の create/update/softDelete は拒否） */
export const APPEND_ONLY: ReadonlySet<string> = new Set(["audit_events", "ops_audit_events", "security_events"]);
export type TableName = (typeof TABLES)[number];
const IDENT = /^[a-z_][a-z0-9_]{0,62}$/;
const MASTERS: ReadonlySet<string> = new Set([
  "member_kinds",
  "target_kinds",
  "abilities",
  "session_kinds",
  "revoke_reasons",
  "goal_kinds",
  "rollup_kinds",
  "memory_kinds",
  "credential_kinds",
  "llm_capabilities",
]);

export type Row = Record<string, unknown>;
export interface ListOptions {
  where?: Record<string, unknown>;
  limit?: number;
  offset?: number;
  orderBy?: string;
}

function ident(name: string, allowed?: ReadonlySet<string>): string {
  if (!IDENT.test(name) || (allowed && !allowed.has(name))) throw new Error(`許可されていない識別子: ${name}`);
  return `"${name}"`;
}

export interface TableRepository {
  list(ctx: TenantContext, o?: ListOptions): Promise<Row[]>;
  get(ctx: TenantContext, id: string): Promise<Row | null>;
  create(ctx: TenantContext, data: Row): Promise<Row>;
  update(ctx: TenantContext, id: string, data: Row): Promise<Row | null>;
  softDelete(ctx: TenantContext, id: string): Promise<boolean>;
}

export class Repository {
  private readonly columns = new Map<TableName, Set<string>>();
  constructor(private readonly pool: pg.Pool) {}

  /** 起動時に 1 回：表と列を information_schema から読む（無い表は起動で落ちる＝G-11 の存在確認） */
  async init(): Promise<void> {
    const r = await this.pool.query<{ table_name: string; column_name: string }>(
      "select table_name, column_name from information_schema.columns where table_schema = 'public' and table_name = any($1::text[])",
      [[...TABLES]],
    );
    for (const t of TABLES) this.columns.set(t, new Set());
    for (const row of r.rows) this.columns.get(row.table_name as TableName)?.add(row.column_name);
    const missing = TABLES.filter((t) => (this.columns.get(t)?.size ?? 0) === 0);
    if (missing.length) throw new Error(`表が無い（migration 未適用）: ${missing.join(", ")}`);
  }

  /** 要求の取引（K-234）：fn の中の withTenant（このプール・同じ文脈）を 1 本の接続・1 つの取引にまとめる。最初の withTenant で開く */
  inRequest<T>(ctx: TenantContext, fn: () => Promise<T>): Promise<T> {
    return withRequest(this.pool, ctx, fn);
  }

  /** 表にその列があるか（init 後）。関門の外から列の有無で分岐するとき用 */
  hasColumn(name: TableName, column: string): boolean {
    return this.columns.get(name)?.has(column) ?? false;
  }

  /** 運営が会社の表を読んでよいか（顧客の許可・範囲・期限。RLS の関数と同じ判定を API 層でも先に返す＝403） */
  async opsAllowed(ctx: TenantContext): Promise<boolean> {
    if (ctx.role !== "ops" || !ctx.tenantId) return false;
    // 中を見るの許可は開いた運営の人に結ぶ（K-10）ので、その人の文脈（app.user_id）で確かめる
    return withTenant(this.pool, ctx, async (c) => {
      const r = await c.query<{ ok: boolean }>("select app.ops_grant_ok($1::uuid) as ok", [ctx.tenantId]);
      return r.rows[0]?.ok === true;
    });
  }

  /** 権限の言葉 admin などの確かめ（K-14）：その人が、その表（target）の能力（ability）を、そのグループ（null＝会社全体）で持つか */
  async can(ctx: TenantContext, target: string, scope: string | null, ability: string): Promise<boolean> {
    if (ctx.role !== "member" || !ctx.userId || !ctx.tenantId) return false;
    return withTenant(this.pool, ctx, async (c) => {
      const r = await c.query<{ ok: boolean }>("select has_permission(app.user_id(), $1, $2::uuid, $3) as ok", [
        target,
        scope,
        ability,
      ]);
      return r.rows[0]?.ok === true;
    });
  }

  /** どこかのグループでその能力を持つか（入口の scope: any・口の中でグループに絞る） */
  async canAny(ctx: TenantContext, target: string, ability: string): Promise<boolean> {
    if (ctx.role !== "member" || !ctx.userId || !ctx.tenantId) return false;
    return withTenant(this.pool, ctx, async (c) => {
      const r = await c.query<{ ok: boolean }>("select app.has_any_permission(app.user_id(), $1, $2) as ok", [
        target,
        ability,
      ]);
      return r.rows[0]?.ok === true;
    });
  }

  /** 管理者の役割か（権限を個別に付けた人は含まない） */
  async isAdmin(ctx: TenantContext): Promise<boolean> {
    if (ctx.role !== "member" || !ctx.userId || !ctx.tenantId) return false;
    return withTenant(this.pool, ctx, async (c) => {
      const r = await c.query<{ ok: boolean }>("select app.is_admin(app.user_id()) as ok");
      return r.rows[0]?.ok === true;
    });
  }

  /** 会社から抜けた人か（members.deleted_at・D-131.7 ②・K-166）。行の守りの外で members を引く関数（app.member_left）を 1 回呼ぶ。
   *  口の共通の入口が、行に結ぶ確かめより前に見る（抜けた人は 404 でなく 403）。メンバーでない役（運営・取引先・PC の印）は見ない */
  async memberLeft(ctx: TenantContext): Promise<boolean> {
    if (ctx.role !== "member" || !ctx.userId || !ctx.tenantId) return false;
    return withTenant(this.pool, ctx, async (c) => {
      const r = await c.query<{ gone: boolean }>("select app.member_left() as gone");
      return r.rows[0]?.gone === true;
    });
  }

  /** 行に結ぶ言葉の確かめ（K-15）。:id の行を行の守り（RLS）の中で読む。見えなければ missing、条件（契約の perm.row.sql）が偽なら denied。
   *  条件は契約の生成（scripts/ci/row_rules.mjs）が出した式だけ（利用者の入力は $1 の id だけ） */
  async rowAllowed(
    ctx: TenantContext,
    table: string,
    id: string,
    sql: string,
  ): Promise<"ok" | "missing" | "denied" | "gone"> {
    if (!this.columns.has(table as TableName)) return "missing";
    return withTenant(this.pool, ctx, async (c) => {
      const r = await c.query<{ ok: boolean | null }>(
        `select (${sql}) as ok from ${ident(table)} where id = $1 limit 1`,
        [id],
      );
      if (r.rows[0]?.ok === true) return "ok";
      // 会社から抜けた・止められた人は、無い（404）でなく権限なし（403）と答える（D-131.7・全部の口・K-162）
      if (ctx.role === "member") {
        const g = await c.query<{ gone: boolean }>("select app.member_gone() as gone");
        if (g.rows[0]?.gone === true) return "gone";
      }
      return r.rows[0] ? "denied" : "missing";
    });
  }

  /** 運営の人のできること（ops_members.caps・K-14）。運営の文脈でだけ。運営の人の行が無ければ null */
  async opsCaps(ctx: TenantContext): Promise<string[] | null> {
    if (ctx.role !== "ops" || !ctx.userId) return null;
    return withTenant(this.pool, ctx, async (c) => {
      const r = await c.query<{ caps: string[] }>(
        "select caps from ops_members where member_id = app.user_id() and revoked_at is null and deleted_at is null limit 1",
      );
      return r.rows[0] ? (r.rows[0].caps ?? []) : null;
    });
  }

  table(name: TableName): TableRepository {
    const cols = this.columns.get(name);
    if (!cols) throw new Error(`init() の前に table() を呼んだ: ${name}`);
    const q = ident(name);
    const col = (c: string) => ident(c, cols);
    const master = MASTERS.has(name);
    const pk = master ? "key" : "id";
    const softDel = cols.has("deleted_at");
    const run = <T>(ctx: TenantContext, fn: (c: pg.PoolClient) => Promise<T>) => withTenant(this.pool, ctx, fn);
    const appendOnly = APPEND_ONLY.has(name);
    const deny = () =>
      Promise.reject(new Error(`${name} は追記専用。書き込みは repository.audit()／securityEvent()／opsAudit() から`));
    // 証跡：関門の中で 1 回だけ。書き込みと同じトランザクションに残る（失敗すれば両方戻る）
    const audit = (c: pg.PoolClient, action: string, id: unknown, payload: Row = {}) =>
      c.query("select app.record_audit($1, $2, $3, 'C2', $4::jsonb)", [
        `${name}.${action}`,
        name,
        String(id),
        JSON.stringify(payload),
      ]);
    return {
      list: (ctx, o = {}) =>
        run(ctx, async (c) => {
          const where: string[] = softDel ? [`${col("deleted_at")} is null`] : [];
          const params: unknown[] = [];
          for (const [k, v] of Object.entries(o.where ?? {})) {
            params.push(v);
            where.push(`${col(k)} = $${params.length}`);
          }
          const limit = Math.min(Math.max(o.limit ?? 100, 1), 1000);
          params.push(limit, o.offset ?? 0);
          const order = o.orderBy ? col(o.orderBy) : col(pk);
          const sql = `select * from ${q}${where.length ? " where " + where.join(" and ") : ""} order by ${order} limit $${params.length - 1} offset $${params.length}`;
          return (await c.query<Row>(sql, params)).rows;
        }),
      get: (ctx, id) =>
        run(
          ctx,
          async (c) =>
            (
              await c.query<Row>(
                `select * from ${q} where ${col(pk)} = $1${softDel ? ` and ${col("deleted_at")} is null` : ""}`,
                [id],
              )
            ).rows[0] ?? null,
        ),
      create: (ctx, data) =>
        appendOnly
          ? deny()
          : run(ctx, async (c) => {
              const d: Row = { ...data };
              if (!master) {
                d["id"] ??= uuidv7();
                if (cols.has("tenant_id") && d["tenant_id"] === undefined) d["tenant_id"] = ctx.tenantId;
                if (cols.has("created_by")) d["created_by"] = ctx.userId;
                if (cols.has("updated_by")) d["updated_by"] = ctx.userId;
              }
              const keys = Object.keys(d);
              const sql = `insert into ${q} (${keys.map(col).join(", ")}) values (${keys.map((_, i) => `$${i + 1}`).join(", ")}) returning *`;
              const row = (
                await c.query<Row>(
                  sql,
                  keys.map((k) => d[k]),
                )
              ).rows[0]!;
              if (!master) await audit(c, "create", row[pk]);
              return row;
            }),
      update: (ctx, id, data) =>
        appendOnly
          ? deny()
          : run(ctx, async (c) => {
              const d: Row = { ...data };
              delete d[pk];
              delete d["tenant_id"];
              delete d["created_by"];
              delete d["created_at"];
              if (cols.has("updated_by")) d["updated_by"] = ctx.userId;
              const keys = Object.keys(d);
              if (!keys.length) throw new Error("更新する列が無い");
              const sets = keys.map((k, i) => `${col(k)} = $${i + 1}`).join(", ");
              const sql = `update ${q} set ${sets} where ${col(pk)} = $${keys.length + 1}${softDel ? ` and ${col("deleted_at")} is null` : ""} returning *`;
              const row = (await c.query<Row>(sql, [...keys.map((k) => d[k]), id])).rows[0] ?? null;
              if (row && !master) await audit(c, "update", id, { columns: keys });
              return row;
            }),
      softDelete: (ctx, id) =>
        appendOnly
          ? deny()
          : run(ctx, async (c) => {
              if (!softDel) throw new Error(`${name} は論理削除の列を持たない（マスタは消さない）`);
              const r = await c.query(
                `update ${q} set ${col("deleted_at")} = now(), ${col("updated_by")} = $2 where ${col("id")} = $1 and ${col("deleted_at")} is null`,
                [id, ctx.userId],
              );
              const ok = (r.rowCount ?? 0) > 0;
              if (ok) await audit(c, "delete", id);
              return ok;
            }),
    };
  }

  /** 会社の証跡（任意の行為。関門 C1/C3/C4… も同じ関数で残す） */
  audit(
    ctx: TenantContext,
    action: string,
    targetType: string,
    targetId: string | null,
    choke: string | null,
    payload: Row = {},
  ): Promise<string> {
    return withTenant(
      this.pool,
      ctx,
      async (c) =>
        (
          await c.query<{ id: string }>("select app.record_audit($1, $2, $3, $4, $5::jsonb) as id", [
            action,
            targetType,
            targetId,
            choke,
            JSON.stringify(payload),
          ])
        ).rows[0]!.id,
    );
  }
  /** セキュリティの出来事（ログイン失敗など、文脈が無い前に起きるもの。tenant を引数で） */
  securityEvent(
    tenantId: string,
    kind: string,
    memberId: string | null,
    ipRegion: string | null,
    detail: Row = {},
  ): Promise<string> {
    return withTenant(
      this.pool,
      { tenantId, userId: memberId, role: "anonymous" },
      async (c) =>
        (
          await c.query<{ id: string }>("select app.record_security_event($1, $2, $3, $4, $5::jsonb) as id", [
            tenantId,
            kind,
            memberId,
            ipRegion,
            JSON.stringify(detail),
          ])
        ).rows[0]!.id,
    );
  }
  /** セキュリティの出来事を残し、「落ち始め」かを返す（migration 0086・K-51）。
   *  true＝最後の「確かめた」（ackKind の出来事）より後で最初の 1 件。呼んだ側はこのときだけ運営に知らせる */
  securityEventOpening(tenantId: string, kind: string, ackKind: string, detail: Row = {}): Promise<boolean> {
    return withTenant(
      this.pool,
      { tenantId, userId: null, role: "anonymous" },
      async (c) =>
        (
          await c.query<{ first: boolean }>(
            "select app.record_security_event_opening($1, $2, $3, $4::jsonb) as first",
            [tenantId, kind, ackKind, JSON.stringify(detail)],
          )
        ).rows[0]!.first === true,
    );
  }
  /** 運営の証跡（運営テナントに書き、対象の会社の audit_events にも写す） */
  opsAudit(
    ctx: TenantContext,
    targetTenantId: string,
    action: string,
    targetType: string,
    targetId: string | null,
    grantId: string | null,
    payload: Row = {},
  ): Promise<string> {
    return withTenant(
      this.pool,
      ctx,
      async (c) =>
        (
          await c.query<{ id: string }>("select app.record_ops_audit($1, $2, $3, $4, $5, $6::jsonb) as id", [
            targetTenantId,
            action,
            targetType,
            targetId,
            grantId,
            JSON.stringify(payload),
          ])
        ).rows[0]!.id,
    );
  }
}

export async function createRepository(pool: pg.Pool): Promise<Repository> {
  const r = new Repository(pool);
  await r.init();
  return r;
}
