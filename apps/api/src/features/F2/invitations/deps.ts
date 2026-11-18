// 段 3（F2 招かれて参加する）の招待の口が共に使う依存（K-331 下見。K-332・K-333 参加・K-334 送り直しも同じ形に足す）
import type { Auth } from "@kaname/auth";
import type pg from "pg";

/** メールの送出（関門 C6・server.ts の 1 か所）。送り直し（K-334）だけが使う。無ければ送れない扱い */
export type InvitationMailer = (m: { to: string; subject: string; text: string }) => Promise<void>;

export interface InvitationDeps {
  /** 認証の部品（ログイン中の本人を引く） */
  auth: Auth;
  /** kaname_app の接続（関門 C2・招待の関数） */
  appPool: pg.Pool;
  /** 認証の接続（kaname_auth の表） */
  authPool: pg.Pool;
  mailer?: InvitationMailer;
  config: { opsEmail: string; webBaseUrl: string };
}
