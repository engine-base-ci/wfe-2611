// ログインの口（K-301 パスワード・K-302 確認のコード）が共に使う物：依存・答えの組み立て・ログに出す例外の種類・会社の人が無いときの閉じ方
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

/** 入ったのに会社の人が無い・抜けた：その場で閉じて true（ログインの印を渡さない）。止めの 1 か所への移しは K-303 */
export function memberGoneCheck(d: LoginDeps): (token: string, ua: string | undefined) => Promise<boolean> {
  const resolve = createSessionResolver(d.auth, d.appPool);
  return async (token, ua) => {
    const h = new Headers({ authorization: `Bearer ${token}` });
    if (ua) h.set("user-agent", ua);
    if (await resolve(h)) return false;
    await signOut(d.auth, d.appPool, h);
    return true;
  };
}
