// テナント文脈（関門 C2）。要求ごとに 1 トランザクションを開き、SET LOCAL app.tenant_id / app.user_id / app.role を入れてから中を実行する。
// これを通らない読み書きは RLS で 0 行（FND-02-002 上流を故意に壊す）。
import type pg from "pg";

export interface TenantContext {
  tenantId: string | null; // null = 運営（会社をまたぐ）
  userId: string | null; // members.id
  role: "member" | "ops" | "client" | "device" | "anonymous";
  /** 直前の本人確認の時刻（sessions.step_up_at・K-14）。無ければ未確認 */
  stepUpAt?: Date | null;
  /** PC の印で来た要求の、その PC の行（sessions.id・role: device のときだけ・K-57） */
  sessionId?: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertContext(ctx: TenantContext): void {
  if (ctx.tenantId !== null && !UUID.test(ctx.tenantId)) throw new Error("tenantId が uuid でない");
  if (ctx.userId !== null && !UUID.test(ctx.userId)) throw new Error("userId が uuid でない");
  if (ctx.role === "member" && (ctx.tenantId === null || ctx.userId === null))
    throw new Error("member の文脈には tenantId と userId が要る");
}

/** 1 要求 = 1 トランザクション。SET LOCAL は commit/rollback で消える（接続プールに文脈が残らない）。 */
export async function withTenant<T>(
  pool: pg.Pool,
  ctx: TenantContext,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  assertContext(ctx);
  const client = await pool.connect();
  try {
    await client.query("begin");
    // set_config は値をパラメータで渡せる（文字列連結しない・G10）
    await client.query(
      "select set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true), set_config('app.role', $3, true)",
      [ctx.tenantId ?? "", ctx.userId ?? "", ctx.role],
    );
    const out = await fn(client);
    await client.query("commit");
    return out;
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}
