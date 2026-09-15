// 要求 → テナント文脈。認証（Better Auth）のセッションが生きていても、public.sessions が revoked なら 401（G-14：トークンの期限に頼らない）。
import type pg from "pg";
import type { TenantContext } from "@kaname/db/context";
import type { Auth } from "./index.js";

export interface Resolved {
  ctx: TenantContext;
  sessionId: string;
  authUserId: string;
}

export function createSessionResolver(auth: Auth, appPool: pg.Pool) {
  return async (headers: Headers): Promise<Resolved | null> => {
    const s = await auth.api.getSession({ headers });
    if (!s) return null;
    const alive = await appPool.query<{ session_id: string; member_id: string; tenant_id: string }>(
      "select * from app.session_alive($1)",
      [s.session.id],
    );
    const row = alive.rows[0];
    if (!row) return null; // 失効済み・会社に属していない・人が抜けた
    await appPool.query("select app.touch_session($1)", [s.session.id]);
    return {
      ctx: { tenantId: row.tenant_id, userId: row.member_id, role: "member" },
      sessionId: row.session_id,
      authUserId: s.user.id,
    };
  };
}

/** ログアウト：認証側と public.sessions の両方を閉じる */
export async function signOut(auth: Auth, appPool: pg.Pool, headers: Headers): Promise<void> {
  const s = await auth.api.getSession({ headers });
  if (s) await appPool.query("select app.close_session($1, 'logout')", [s.session.id]);
  await auth.api.signOut({ headers });
}

/** パスワード変更：認証側の他セッションを消し、public.sessions も全部失効（G-14） */
export async function changePassword(
  auth: Auth,
  appPool: pg.Pool,
  headers: Headers,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const s = await auth.api.getSession({ headers });
  if (!s) throw new Error("セッションが無い");
  await auth.api.changePassword({ headers, body: { currentPassword, newPassword, revokeOtherSessions: true } });
  const m = await appPool.query<{ member_id: string }>("select member_id from app.session_alive($1)", [s.session.id]);
  if (m.rows[0]) await appPool.query("select app.revoke_all_sessions($1, 'password_changed')", [m.rows[0].member_id]);
}
