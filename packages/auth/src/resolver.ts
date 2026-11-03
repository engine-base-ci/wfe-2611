// 要求 → テナント文脈。認証（Better Auth）のセッションが生きていても、public.sessions が revoked なら 401（G-14：トークンの期限に頼らない）。
import type pg from "pg";
import type { TenantContext } from "@kaname/db/context";
import type { Auth } from "./index.js";
import { countryOf, deviceOf, ipOf } from "./device.js";

export interface Resolved {
  ctx: TenantContext;
  sessionId: string;
  authUserId: string;
}

export function createSessionResolver(auth: Auth, appPool: pg.Pool) {
  return async (headers: Headers): Promise<Resolved | null> => {
    const s = await auth.api.getSession({ headers });
    if (!s) return null;
    // セッションの見張り（KN-57・D-125.140・D-128.120）：操作が無い 12 時間・最長 7 日・国か端末が変わったら閉じて 401。
    //   同じ国の中で IP だけ変わったら記録だけ（security_events）。生きていれば最後に見た時刻を進める
    const alive = await appPool.query<{ session_id: string; member_id: string; tenant_id: string }>(
      "select * from app.session_check($1, $2, $3, $4)",
      [s.session.id, countryOf(headers), deviceOf(headers.get("user-agent")), ipOf(headers)],
    );
    const row = alive.rows[0];
    if (!row) return null; // 失効済み・会社に属していない・人が抜けた・見張りで閉じた
    // 直前の本人確認の時刻（KN-51）。入口が 15 分以内かを見る
    const su = await appPool.query<{ at: Date | null }>("select app.session_step_up_at($1) as at", [s.session.id]);
    return {
      ctx: { tenantId: row.tenant_id, userId: row.member_id, role: "member", stepUpAt: su.rows[0]?.at ?? null },
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
