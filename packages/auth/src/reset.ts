// 再設定のメールを送る（K-313・D-042・D-128.62・D-128.141・D-128.146）。
//   部品（Better Auth）の requestPasswordReset は使わない：送れたかを握りつぶして返すので、送れなかったことが分からない（G-15）。
//   手がかりは DB に平文で置かない。identifier は頭を残したハッシュ `reset-password:<sha256(手がかり) の base64url>`（resetKey の 1 か所で作る）。
//   部品にも同じ形を設定する（index.ts の verification.storeIdentifier）ので、新しいパスワードを決める口（K-314）と部品の道の両方が同じ行を引ける。
//   出したリンクの印 `reset-password-seen:<同じハッシュ>`（24 時間）も置く。リンクの行（30 分）が消えても、K-314 が
//   「期限切れ・使った・前のリンク」と「でたらめ」を見分けられる。
//   ログにメールアドレスを出さない。宛先は mailTag の印（D-128.146）
import { createHash, randomBytes } from "node:crypto";
import type pg from "pg";
import { uuidv7 } from "@kaname/db/id";
import { optionalEnv } from "@kaname/config";
import { mailTag, normalizeEmail } from "./signup.js";

/** リンクの行の頭（部品と同じ名前） */
export const RESET_PREFIX = "reset-password:";
/** 出したリンクの印の頭 */
export const RESET_SEEN_PREFIX = "reset-password-seen:";
/** リンクの期限（D-128.62） */
export const RESET_TTL_SEC = 30 * 60;
/** 印の期限（K-314 が見分けに使う） */
export const RESET_SEEN_TTL_SEC = 24 * 60 * 60;
/** 同じ人へ送る間（D-128.141） */
export const RESET_INTERVAL_SEC = 60;
export const RESET_SUBJECT = "Kaname のパスワードを再設定する";

/** 手がかりのハッシュ（sha256 の base64url・余りの = なし） */
export const resetHash = (token: string): string => createHash("sha256").update(token, "utf8").digest("base64url");
/** リンクの行の identifier（DB の形） */
export const resetKey = (token: string): string => RESET_PREFIX + resetHash(token);
/** 出したリンクの印の identifier */
export const resetSeenKey = (token: string): string => RESET_SEEN_PREFIX + resetHash(token);

export interface ResetMail {
  to: string;
  subject: string;
  text: string;
}
/** 送出（関門 C6）。送れなければ投げる */
export type ResetMailer = (m: ResetMail) => Promise<void>;

export interface RequestResetDeps {
  /** 認証の接続（kaname_auth の表） */
  authPool: pg.Pool;
  mailer?: ResetMailer;
  /** 画面の URL（リンクの先） */
  webBaseURL: string;
}
export type RequestResetResult = { result: "sent" | "failed" | "skipped"; userId: string | null };

type Prepared = { userId: string; to: string; token: string } | { skipped: true; userId: string | null };

/** 本人を引き、60 秒の内でなければ前のリンクの行を消して新しい行と印を置く（1 つのトランザクション・同じ人の要求は順番に並べる） */
async function prepare(pool: pg.Pool, email: string): Promise<Prepared> {
  const u = await pool.query<{ id: string; email: string }>(
    'select id, email from kaname_auth."user" where email = $1',
    [email],
  );
  const user = u.rows[0];
  if (!user) return { skipped: true, userId: null }; // 確認していない申し込みだけの人も、まだ本人がいない
  const cl = await pool.connect();
  try {
    await cl.query("begin");
    await cl.query("select pg_advisory_xact_lock(hashtext($1))", [`reset-password:${user.id}`]);
    const recent = await cl.query(
      `select 1 from kaname_auth.verification where value = $1 and identifier like 'reset-password:%' and "createdAt" > now() - make_interval(secs => $2)`,
      [user.id, RESET_INTERVAL_SEC],
    );
    if (recent.rowCount) {
      await cl.query("rollback");
      return { skipped: true, userId: user.id };
    }
    // 前のリンクの行を消す（印は残す＝前のリンクは K-314 で「前のリンク」になる）
    await cl.query("delete from kaname_auth.verification where value = $1 and identifier like 'reset-password:%'", [
      user.id,
    ]);
    const token = randomBytes(32).toString("base64url");
    const put = `insert into kaname_auth.verification (id, identifier, value, "expiresAt", "createdAt", "updatedAt") values ($1, $2, $3, now() + make_interval(secs => $4), now(), now())`;
    await cl.query(put, [uuidv7(), resetKey(token), user.id, RESET_TTL_SEC]);
    await cl.query(put, [uuidv7(), resetSeenKey(token), user.id, RESET_SEEN_TTL_SEC]);
    await cl.query("commit");
    return { userId: user.id, to: user.email, token };
  } catch (e) {
    await cl.query("rollback").catch(() => undefined);
    throw e;
  } finally {
    cl.release();
  }
}

/** 再設定のメールを頼む。登録されていない・60 秒の内は skipped、送れたら sent、送れなかったら failed。DB が落ちたら投げる */
export async function requestReset(d: RequestResetDeps, rawEmail: string): Promise<RequestResetResult> {
  const p = await prepare(d.authPool, normalizeEmail(rawEmail));
  if ("skipped" in p) return { result: "skipped", userId: p.userId };
  const url = `${d.webBaseURL}/password-reset?token=${encodeURIComponent(p.token)}`;
  const tag = mailTag(p.to);
  // 本番以外はリンクを残す（受信箱を開かずに先へ進める・画面の試験の lastMailUrl が拾う）
  if (!d.mailer) {
    console.warn(`[auth] メールの送出先が無い（reset → ${tag}）: ${url}`);
    return { result: "failed", userId: p.userId };
  }
  if (optionalEnv("NODE_ENV") !== "production") console.warn(`[auth] リンク（reset → ${tag}）: ${url}`);
  try {
    await d.mailer({
      to: p.to,
      subject: RESET_SUBJECT,
      text: `次のリンクから新しいパスワードを設定してください（30 分で失効）。\n${url}`,
    });
    return { result: "sent", userId: p.userId };
  } catch {
    return { result: "failed", userId: p.userId }; // 送れなかったことは送出（server.ts の 1 か所）が宛先の印で残す
  }
}
