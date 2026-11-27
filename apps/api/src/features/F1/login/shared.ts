// ログインの口（K-301 パスワード・K-302 確認のコード）が共に使う物：依存・答えの組み立て・ログに出す例外の種類・会社の人が無いときの閉じ方
import { createHash } from "node:crypto";
import type { Auth } from "@kaname/auth";
import { createSessionResolver, signOut } from "@kaname/auth/resolver";
import type { signInWithLock } from "@kaname/auth/signup";
import { kanameError } from "@kaname/errors";
import type { HookReply } from "../../../contract/deps.js";

type AppPool = Parameters<typeof signInWithLock>[1];
type AuthPool = NonNullable<Parameters<typeof signInWithLock>[5]>["authPool"];

export interface LoginDeps {
  auth: Auth;
  /** kaname_app の接続（ロック・セッションの写し・記録） */
  appPool: AppPool;
  /** 認証の接続（失敗とロックの記録のとき、メールから本人を引く・待ちの印と 6 けたの止めを見る） */
  authPool: AuthPool;
  config: { opsEmail: string };
}

/** 正本（errors.json）の code と文で答える */
export const reply = (status: number, code: string, extra: Record<string, unknown> = {}): HookReply => ({
  status,
  body: { ...kanameError(code).toJSON(), ...extra },
});

/** 例外の種類だけ（DB の番号か名前）。文や値はログに出さない */
export const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};

/** 入った後の会社の人の様子（K-852）：会社の人として解けた member／会社の人は無いが、体の招待の印が本人宛てで使え止められていない invite／それ以外 gone */
export type MemberState = "member" | "invite" | "gone";

/** 招待の印の長さの上限（招待の口の TOKEN_MAX と同じ） */
const INVITATION_MAX = 512;
const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");
/** 使える形の招待の印（1〜512 文字・空白だけでない）。形が違えば undefined */
export const invitationOf = (v: unknown): string | undefined =>
  typeof v === "string" && v.length >= 1 && v.length <= INVITATION_MAX && /\S/.test(v) ? v : undefined;

/** 入ったのに会社の人が無い・抜けた：体の招待の印が本人宛てで使えれば印を残して invite（招待の下見と参加の口だけが本人と見る）。
 *  そうでなければその場で閉じて gone（ログインの印を渡さない）。会社の人として解ければ member（招待の印は見ない） */
export function memberStateCheck(
  d: LoginDeps,
): (token: string, ua: string | undefined, invitation?: unknown) => Promise<MemberState> {
  const resolve = createSessionResolver(d.auth, d.appPool);
  return async (token, ua, invitation) => {
    const h = new Headers({ authorization: `Bearer ${token}` });
    if (ua) h.set("user-agent", ua);
    if (await resolve(h)) return "member";
    const inv = invitationOf(invitation);
    if (inv !== undefined) {
      const s = await d.auth.api.getSession({ headers: h });
      const userId = s?.user.id;
      if (userId) {
        const r = await d.appPool.query<{ ok: boolean }>("select app.login_invite_only($1, $2) as ok", [
          userId,
          sha256(inv),
        ]);
        if (r.rows[0]?.ok === true) return "invite";
      }
    }
    await signOut(d.auth, d.appPool, h);
    return "gone";
  };
}
