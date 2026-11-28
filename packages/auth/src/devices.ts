// 端末の一覧と失効（自分の端末は本人が。他人の端末は権限のある人が sessions を更新）
import type pg from "pg";
import type { TenantContext } from "@kaname/db/context";
import type { Repository, Row } from "@kaname/db/repository";
import { withTenant } from "@kaname/db/context";

export async function listOwnDevices(repo: Repository, ctx: TenantContext): Promise<Row[]> {
  if (!ctx.userId) return [];
  return repo.table("sessions").list(ctx, { where: { member_id: ctx.userId }, orderBy: "last_seen_at" });
}

export async function revokeOwnDevice(appPool: pg.Pool, ctx: TenantContext, sessionId: string): Promise<boolean> {
  const n = await withTenant(
    appPool,
    ctx,
    async (c) =>
      (await c.query<{ n: number }>("select app.revoke_own_session($1, 'logout') as n", [sessionId])).rows[0]!.n,
  );
  return n > 0;
}
