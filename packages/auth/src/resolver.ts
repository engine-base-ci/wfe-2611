// 要求 → テナント文脈。認証（Better Auth）のセッションが生きていても、public.sessions が revoked なら 401（G-14：トークンの期限に頼らない）。
import type pg from "pg";
import type { TenantContext } from "@kaname/db/context";
import type { Auth } from "./index.js";
import { countryOf, deviceOf, ipOf } from "./device.js";
import { hashToken } from "./invitations.js";

/** PC の印を運ぶ頭（Bridge が送る・K-57。K-62 の口もこの頭を前提にする） */
export const DEVICE_TOKEN_HEADER = "x-bridge-session";
/** PC の印の形（"kpc_" ＋ 乱数 32 バイトの base64url）。形が違えば DB を引かない */
export const DEVICE_TOKEN_RE = /^kpc_[A-Za-z0-9_-]{43}$/;

/** PC の印 → PC の文脈（role: device）。印のハッシュで生きている Bridge の行を引く。国か端末が変わったら切って null（D-128.120）。
 *  時間では切らない（D-128.121）。印そのものは DB に無い（ハッシュだけ・D-128.137） */
export function createDeviceResolver(appPool: pg.Pool) {
  return async (headers: Headers): Promise<Resolved | null> => {
    const token = headers.get(DEVICE_TOKEN_HEADER) ?? "";
    if (!DEVICE_TOKEN_RE.test(token)) return null;
    const r = await appPool.query<{ session_id: string; member_id: string; tenant_id: string }>(
      "select * from app.bridge_device_check($1, $2, $3, $4)",
      [hashToken(token), countryOf(headers), deviceOf(headers.get("user-agent")), ipOf(headers)],
    );
    const row = r.rows[0];
    if (!row) return null;
    return {
      ctx: { tenantId: row.tenant_id, userId: row.member_id, role: "device", sessionId: row.session_id },
      sessionId: row.session_id,
      authUserId: "",
      // PC のセッションには同意し直しの印を立てず止めない（K-53・D-128.137。Bridge は時間で切らないので、止めると PC 側の仕事が全部止まる）
      termsPending: false,
    };
  };
}

export interface Resolved {
  ctx: TenantContext;
  sessionId: string;
  authUserId: string;
  /** 同意し直しの印（K-53）。立っている間は、規約の口・ログアウト・自分の取得のほかを止める。PC のセッションは常に false。
   *  ctx（DB に渡すテナントの文脈）には入れない */
  termsPending: boolean;
}

export function createSessionResolver(auth: Auth, appPool: pg.Pool) {
  return async (headers: Headers): Promise<Resolved | null> => {
    const s = await auth.api.getSession({ headers });
    if (!s) return null;
    // セッションの見張り（K-20・D-125.140・D-128.120）：操作が無い 12 時間・最長 7 日・国か端末が変わったら閉じて 401。
    //   同じ国の中で IP だけ変わったら記録だけ（security_events）。生きていれば最後に見た時刻を進める
    const alive = await appPool.query<{ session_id: string; member_id: string; tenant_id: string }>(
      "select * from app.session_check($1, $2, $3, $4)",
      [s.session.id, countryOf(headers), deviceOf(headers.get("user-agent")), ipOf(headers)],
    );
    const row = alive.rows[0];
    if (!row) return null; // 失効済み・会社に属していない・人が抜けた・見張りで閉じた
    // 直前の本人確認の時刻（K-14）。入口が 15 分以内かを見る
    const su = await appPool.query<{ at: Date | null; terms: boolean }>(
      "select app.session_step_up_at($1) as at, app.session_terms_pending($2) as terms",
      [s.session.id, row.session_id],
    );
    return {
      ctx: { tenantId: row.tenant_id, userId: row.member_id, role: "member", stepUpAt: su.rows[0]?.at ?? null },
      sessionId: row.session_id,
      authUserId: s.user.id,
      termsPending: su.rows[0]?.terms === true,
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
