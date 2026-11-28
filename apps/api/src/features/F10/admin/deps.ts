// 段 11（F10 人とアカウントを管理する）の口が共に使う依存（K-800 が置き場を作る。K-802〜K-815・K-848 は同じ形を使う）
import type pg from "pg";

/** メールの送出（関門 C6・server.ts の 1 か所）。無ければ送れない扱い */
export type AdminMailer = (m: { to: string; subject: string; text: string }) => Promise<void>;

export interface AdminDeps {
  /** kaname_app の接続（関門 C2・段 11 の書く DB の関数） */
  appPool: pg.Pool;
  mailer?: AdminMailer;
  /** メールの Kaname を開くリンクの頭 */
  config: { webBaseUrl: string };
}
