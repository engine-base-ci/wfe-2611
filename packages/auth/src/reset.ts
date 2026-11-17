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
import { emailHash, mailTag, normalizeEmail } from "./signup.js";

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
  const prod = optionalEnv("NODE_ENV") === "production";
  if (!d.mailer) {
    // 本番では手がかり入りのリンクをログに残さない（本番は起動時の確かめが送出先を要る）
    console.warn(`[auth] メールの送出先が無い（reset → ${tag}）${prod ? "" : `: ${url}`}`);
    return { result: "failed", userId: p.userId };
  }
  if (!prod) console.warn(`[auth] リンク（reset → ${tag}）: ${url}`);
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

// ── 新しいパスワードを決める（K-314・D-125.137・D-125.140・D-128.62・D-128.121・D-128.141） ──────────────────────────
//   部品（Better Auth）の resetPassword は通さない：部品は行を先に取り、期限を JS の時計でもう一度見るので、
//   同時に 2 つ・途中で落ちたときに「リンクを使えるまま残す」ができない。行は 1 文で取り（DB が 1 回だけ書き替える）、
//   端末を切ってからパスワードを変え、どちらかで落ちたら取った行を戻す。
//   期限は DB の now() で見る（D-128.130）。手がかり・パスワード・メールはログにも記録にも出さない

/** 取った行の頭（済むまでの間だけ。落ちたら reset-password: に戻す） */
export const RESET_TAKEN_PREFIX = "reset-password-taken:";
/** 新しいパスワードの下限（D-125.137・E-VAL-005）と上限（部品の上限・E-VAL-026） */
export const NEW_PASSWORD_MIN = 12;
export const NEW_PASSWORD_MAX = 128;

export type LeakCheck = "ok" | "leaked" | "unavailable";
export interface ResetWithLinkDeps {
  /** 認証の接続（kaname_auth の表） */
  authPool: pg.Pool;
  /** 業務の接続（app.revoke_sessions_for_auth_user・app.login_ok・app.record_security_event_for_auth_user） */
  appPool: pg.Pool;
  /** 部品と同じ形でハッシュを作る（`(await auth.$context).password.hash`）。自分で作ると部品のログインで入れなくなる */
  hashPassword: (password: string) => Promise<string>;
  /** 漏れたパスワードの照合（関門 C1）。照合が落ちている間は unavailable（通す・D-128.134） */
  checkLeaked: (password: string) => Promise<LeakCheck>;
}
export type ResetWithLinkResult =
  | { result: "done"; userId: string; pwned: LeakCheck; followUpError: unknown }
  | { result: "expired" | "invalid" | "short" | "long" | "leaked" }
  | { result: "down"; error: unknown; restoreError: unknown };

const chars = (s: string): number => [...s].length;

/** リンクの状態を見るだけ（取らない）。期限内の行 → ok、行が無いか期限切れでも印がある → expired、どちらも無い → invalid */
async function linkState(pool: pg.Pool, hash: string): Promise<"ok" | "expired" | "invalid"> {
  const r = await pool.query<{ live: boolean; seen: boolean }>(
    `select exists (select 1 from kaname_auth.verification where identifier = $1 and "expiresAt" > now()) as live,
            exists (select 1 from kaname_auth.verification where identifier = $2) as seen`,
    [RESET_PREFIX + hash, RESET_SEEN_PREFIX + hash],
  );
  const row = r.rows[0];
  if (row?.live) return "ok";
  return row?.seen ? "expired" : "invalid";
}

/** 取った行を消す（済んだ）／戻す（落ちた・リンクは使えるまま） */
const finishTaken = (pool: pg.Pool, hash: string) =>
  pool.query("delete from kaname_auth.verification where identifier = $1", [RESET_TAKEN_PREFIX + hash]);
const restoreTaken = (pool: pg.Pool, hash: string) =>
  pool.query("update kaname_auth.verification set identifier = $2 where identifier = $1", [
    RESET_TAKEN_PREFIX + hash,
    RESET_PREFIX + hash,
  ]);

/** 端末を全部切ってから（業務のセッション・Bridge・認証のセッション）、部品の形のハッシュでパスワードを変える */
async function revokeThenChange(d: ResetWithLinkDeps, userId: string, password: string): Promise<void> {
  await d.appPool.query("select app.revoke_sessions_for_auth_user($1, 'password_changed')", [userId]);
  await d.authPool.query('delete from kaname_auth.session where "userId" = $1', [userId]);
  const hashed = await d.hashPassword(password);
  const up = await d.authPool.query(
    `update kaname_auth.account set password = $2, "updatedAt" = now() where "userId" = $1 and "providerId" = 'credential'`,
    [userId, hashed],
  );
  if (up.rowCount) return;
  // パスワードを持たない人（パスキーだけ）も、再設定でパスワードを決められる（代表の答え ②）
  await d.authPool.query(
    `insert into kaname_auth.account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
     values ($1, $2, 'credential', $2, $3, now(), now())`,
    [uuidv7(), userId, hashed],
  );
}

/** 済んだ後：ロックを消し（K-76）、今いる会社に記録を残す（関門 C2） */
async function afterDone(d: ResetWithLinkDeps, userId: string): Promise<void> {
  const u = await d.authPool.query<{ email: string }>('select email from kaname_auth."user" where id = $1', [userId]);
  const email = u.rows[0]?.email;
  if (email) await d.appPool.query("select app.login_ok($1)", [emailHash(email)]);
  await d.appPool.query("select app.record_security_event_for_auth_user($1, 'password_reset_done', '{}'::jsonb)", [
    userId,
  ]);
}

/** 新しいパスワードを決める。判定の順：リンクを見る → 長さ → 漏れ → 取る → 切る → 変える（変えない値は変えない） */
export async function resetWithLink(
  d: ResetWithLinkDeps,
  input: { token: string; newPassword: string },
): Promise<ResetWithLinkResult> {
  const token = input.token.trim(); // メールソフトが付ける前後の空白・改行
  if (!token) return { result: "invalid" };
  const hash = resetHash(token);
  const state = await linkState(d.authPool, hash);
  if (state !== "ok") return { result: state };
  // リンクが使えるときだけパスワードの中身を見る（使えないリンクで照合のために外へ出ない）
  const n = chars(input.newPassword);
  if (n < NEW_PASSWORD_MIN) return { result: "short" };
  if (n > NEW_PASSWORD_MAX) return { result: "long" }; // 切る前に断る（切った後に断ると全部ログアウトして変わらないまま）
  const pwned = await d.checkLeaked(input.newPassword);
  if (pwned === "leaked") return { result: "leaked" };
  // 取る：1 文だけ。同時に来た方・ちょうど期限を過ぎた方は 0 行（印があるので expired）
  const took = await d.authPool.query<{ value: string }>(
    `update kaname_auth.verification set identifier = $2 where identifier = $1 and "expiresAt" > now() returning value`,
    [RESET_PREFIX + hash, RESET_TAKEN_PREFIX + hash],
  );
  const userId = took.rows[0]?.value;
  if (!userId) return { result: "expired" };
  try {
    await revokeThenChange(d, userId, input.newPassword);
  } catch (error) {
    // 戻せなければ、リンクは期限切れと同じ扱いになる（安全な側）。戻せなかったことも呼ぶ側がログに残す
    const restoreError = await restoreTaken(d.authPool, hash).then(
      () => null,
      (e: unknown) => e,
    );
    return { result: "down", error, restoreError };
  }
  // 済んだ後の片付け・ロック・記録で落ちても、パスワードはもう変わっている（done を返し、落ちたことは呼ぶ側がログに残す）。
  //   取った行が残っても 30 分で切れ、頭が違うので二度と使えない
  let followUpError: unknown = null;
  try {
    await finishTaken(d.authPool, hash);
    await afterDone(d, userId);
  } catch (e) {
    followUpError = e;
  }
  return { result: "done", userId, pwned, followUpError };
}
