// 招待の下見と参加の口が「ログイン中の本人」を見る 1 か所（K-331・K-333・K-852）。
//   入口が会社の人として解けたら、部品のセッションの本人。
//   会社の人として解けなくても（使える会社が無く、招待の印でログインの印を受けた人・D-154.87〜89）、部品のセッションが在り、
//   その利用者で道の招待が本人宛てで使え、本人が止められていなければ本人と見る（印はどの招待で開けたかを覚えない）。
//   それ以外はログインしていない人（null）。会社の口はこの印で開かない（入口の resolver が 401）
import { createHash } from "node:crypto";
import type { HookArgs } from "../../../contract/deps.js";
import type { InvitationDeps } from "./deps.js";

export interface SignedInUser {
  userId: string;
  sessionId: string;
  token: string;
}

const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");

/** ログイン中の本人。無ければ null。読めなければ例外（呼ぶ側が 503 にする） */
export async function signedInFor(
  d: Pick<InvitationDeps, "auth" | "appPool">,
  a: HookArgs,
  inviteToken: string,
): Promise<SignedInUser | null> {
  const s = await d.auth.api.getSession({ headers: a.c.req.raw.headers });
  if (!s) return null;
  const me = { userId: s.user.id, sessionId: s.session.id, token: s.session.token };
  if (a.ctx.role === "member") return me;
  const r = await d.appPool.query<{ ok: boolean }>("select app.login_invite_only($1, $2) as ok", [
    me.userId,
    sha256(inviteToken),
  ]);
  return r.rows[0]?.ok === true ? me : null;
}
