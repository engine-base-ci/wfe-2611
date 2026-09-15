// 関門 C2：業務ロジックが DB に触る唯一の入口 repository.<table>.<op>(input, ctx)。
// ここで 1 回だけやること：テナント文脈（withTenant）・監査列（created_by/updated_by）・論理削除の強制・識別子の許可リスト（文字列連結の禁止 G10）・UUID v7。
import type pg from "pg";
import { withTenant, type TenantContext } from "./context.js";
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
] as const;
export type TableName = (typeof TABLES)[number];
const IDENT = /^[a-z_][a-z0-9_]{0,62}$/;
const MASTERS: ReadonlySet<string> = new Set(["member_kinds", "target_kinds", "abilities"]);

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

  table(name: TableName): TableRepository {
    const cols = this.columns.get(name);
    if (!cols) throw new Error(`init() の前に table() を呼んだ: ${name}`);
    const q = ident(name);
    const col = (c: string) => ident(c, cols);
    const master = MASTERS.has(name);
    const pk = master ? "key" : "id";
    const softDel = cols.has("deleted_at");
    const run = <T>(ctx: TenantContext, fn: (c: pg.PoolClient) => Promise<T>) => withTenant(this.pool, ctx, fn);
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
        run(ctx, async (c) => {
          const d: Row = { ...data };
          if (!master) {
            d["id"] ??= uuidv7();
            if (cols.has("tenant_id") && d["tenant_id"] === undefined) d["tenant_id"] = ctx.tenantId;
            if (cols.has("created_by")) d["created_by"] = ctx.userId;
            if (cols.has("updated_by")) d["updated_by"] = ctx.userId;
          }
          const keys = Object.keys(d);
          const sql = `insert into ${q} (${keys.map(col).join(", ")}) values (${keys.map((_, i) => `$${i + 1}`).join(", ")}) returning *`;
          return (
            await c.query<Row>(
              sql,
              keys.map((k) => d[k]),
            )
          ).rows[0]!;
        }),
      update: (ctx, id, data) =>
        run(ctx, async (c) => {
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
          return (await c.query<Row>(sql, [...keys.map((k) => d[k]), id])).rows[0] ?? null;
        }),
      softDelete: (ctx, id) =>
        run(ctx, async (c) => {
          if (!softDel) throw new Error(`${name} は論理削除の列を持たない（マスタは消さない）`);
          const r = await c.query(
            `update ${q} set ${col("deleted_at")} = now(), ${col("updated_by")} = $2 where ${col("id")} = $1 and ${col("deleted_at")} is null`,
            [id, ctx.userId],
          );
          return (r.rowCount ?? 0) > 0;
        }),
    };
  }
}

export async function createRepository(pool: pg.Pool): Promise<Repository> {
  const r = new Repository(pool);
  await r.init();
  return r;
}
