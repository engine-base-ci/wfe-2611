// 保留の申し込み（D-088）：「はじめる」では何も作らない。メールを確認した時点で利用者と会社を作る。
// パスワードは確認のときに要るので預かるが、平文では置かない（master key から導いた鍵で包む・30 分で失効）。
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";
import type pg from "pg";
import { normalizeEmail } from "./signup.js";

export const PENDING_TTL_MIN = 30;

function key(masterKeyB64: string): Buffer {
  // 用途ごとに鍵を分ける（同じ master key を別の用途と共有しない）
  return Buffer.from(hkdfSync("sha256", Buffer.from(masterKeyB64, "base64"), Buffer.alloc(0), "pending-signup", 32));
}
export function seal(masterKeyB64: string, plain: string): { iv: string; tag: string; data: string } {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(masterKeyB64), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return { iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), data: data.toString("base64") };
}
export function open_(masterKeyB64: string, s: { iv: string; tag: string; data: string }): string {
  const d = createDecipheriv("aes-256-gcm", key(masterKeyB64), Buffer.from(s.iv, "base64"));
  d.setAuthTag(Buffer.from(s.tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(s.data, "base64")), d.final()]).toString("utf8");
}
export const hashPendingToken = (t: string) => createHash("sha256").update(t).digest("hex");

export interface Pending {
  email: string;
  name: string;
  companyName: string;
  password: string;
  expiresAt: Date;
}

/** 同意した規約の版（利用規約・プライバシーポリシー）と時刻。確定のときに本人の同意に移す（K-52・D-128.137） */
export interface PendingConsent {
  termsVersionId: string | null;
  privacyVersionId: string | null;
  consentedAt: Date;
}

/** 申し込みを預ける。同じメールで再度来たら上書きし、前のリンクは使えなくする（再訪で詰まらせない・D-088.3）。
 *  申し込みの印（signupToken）も新しく作る。登録を送ったブラウザにだけ返し、DB にはハッシュだけを置く（D-128.142）。
 *  上書きされた前の印は、もう今の申し込みを引けない */
export async function putPending(
  pool: pg.Pool,
  masterKeyB64: string,
  input: { email: string; name: string; companyName: string; password: string; consent?: PendingConsent },
): Promise<{ token: string; expiresAt: Date; signupToken: string }> {
  const email = normalizeEmail(input.email);
  const token = randomBytes(24).toString("base64url");
  const signupToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + PENDING_TTL_MIN * 60_000);
  const pw = seal(masterKeyB64, input.password);
  const c = input.consent;
  await pool.query(
    `insert into kaname_auth.pending_signup
       (email, name, company_name, pw_iv, pw_tag, pw_data, token_hash, expires_at, updated_at, sent_at, send_error,
        signup_token_hash, terms_version_id, privacy_version_id, consented_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8, now(), null, null, $9, $10, $11, $12)
     on conflict (email) do update set
       name = excluded.name, company_name = excluded.company_name,
       pw_iv = excluded.pw_iv, pw_tag = excluded.pw_tag, pw_data = excluded.pw_data,
       token_hash = excluded.token_hash, expires_at = excluded.expires_at,
       updated_at = now(), sent_at = null, send_error = null, consumed_at = null,
       signup_token_hash = excluded.signup_token_hash,
       terms_version_id = excluded.terms_version_id, privacy_version_id = excluded.privacy_version_id,
       consented_at = excluded.consented_at`,
    [
      email,
      input.name,
      input.companyName,
      pw.iv,
      pw.tag,
      pw.data,
      hashPendingToken(token),
      expiresAt,
      hashPendingToken(signupToken),
      c?.termsVersionId ?? null,
      c?.privacyVersionId ?? null,
      c?.consentedAt ?? null,
    ],
  );
  return { token, expiresAt, signupToken };
}

/** 登録の画面が同意させる今の版（利用規約・プライバシーポリシー）。版が出ていなければ null（migration 0085） */
export async function currentSignupTerms(
  pool: pg.Pool,
): Promise<{ termsVersionId: string | null; privacyVersionId: string | null }> {
  const r = await pool.query<{ terms_version_id: string | null; privacy_version_id: string | null }>(
    "select terms_version_id, privacy_version_id from kaname_auth.signup_current_terms()",
  );
  return {
    termsVersionId: r.rows[0]?.terms_version_id ?? null,
    privacyVersionId: r.rows[0]?.privacy_version_id ?? null,
  };
}

/** 申し込みの印で引いた、今の申し込み（D-128.142）。上書きされた前の印・知らない印は null */
export interface PendingBySignupToken {
  email: string;
  expiresAt: Date;
  consumedAt: Date | null;
  expired: boolean;
}
export async function pendingBySignupToken(pool: pg.Pool, signupToken: string): Promise<PendingBySignupToken | null> {
  const r = await pool.query<{ email: string; expires_at: Date; consumed_at: Date | null; expired: boolean }>(
    "select email, expires_at, consumed_at, expires_at <= now() as expired from kaname_auth.pending_signup where signup_token_hash = $1",
    [hashPendingToken(signupToken)],
  );
  const x = r.rows[0];
  return x ? { email: x.email, expiresAt: x.expires_at, consumedAt: x.consumed_at, expired: x.expired } : null;
}

/** 送り直し：印の申し込みが期限内で確定していなければ、確認のリンクの手がかりを新しくする（前のリンクは使えなくなる）。
 *  印はそのまま（待つ画面は同じ印で引き続ける）。期限も 30 分に戻す。引けなければ null */
export async function renewPendingLink(
  pool: pg.Pool,
  signupToken: string,
): Promise<{ email: string; token: string; expiresAt: Date } | null> {
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + PENDING_TTL_MIN * 60_000);
  const r = await pool.query<{ email: string }>(
    `update kaname_auth.pending_signup set token_hash = $2, expires_at = $3, updated_at = now(), sent_at = null, send_error = null
      where signup_token_hash = $1 and consumed_at is null and expires_at > now() returning email`,
    [hashPendingToken(signupToken), hashPendingToken(token), expiresAt],
  );
  const email = r.rows[0]?.email;
  return email ? { email, token, expiresAt } : null;
}

/** このメールで登録が確定しているか（本人がいる） */
export async function isRegistered(pool: pg.Pool, email: string): Promise<boolean> {
  const r = await pool.query('select 1 from kaname_auth."user" where email = $1', [normalizeEmail(email)]);
  return (r.rowCount ?? 0) > 0;
}

/** 送れたか／送れなかったかを残す。画面が「送りました」と嘘をつかないため（D-088.5・G-15） */
export async function markPendingSent(pool: pg.Pool, email: string, error: string | null): Promise<void> {
  await pool.query(
    "update kaname_auth.pending_signup set sent_at = case when $2::text is null then now() else null end, send_error = $2 where email = $1",
    [normalizeEmail(email), error],
  );
}

export async function getPendingByEmail(pool: pg.Pool, email: string, masterKeyB64 = ""): Promise<Pending | null> {
  const r = await pool.query(
    "select email, name, company_name, pw_iv, pw_tag, pw_data, expires_at from kaname_auth.pending_signup where email = $1 and consumed_at is null and expires_at > now()",
    [normalizeEmail(email)],
  );
  return r.rows[0] ? row(r.rows[0], masterKeyB64) : null;
}

/** リンクの手がかりから引く。期限切れは null（画面は「新しいリンクを送る」へ） */
export type ByToken =
  | { kind: "ok"; pending: Pending }
  | { kind: "done" } // もう確認した（二度押し・リロード）→ 入る画面へ
  | { kind: "gone" }; // 期限切れか、そんなリンクは無い → はじめから
export async function takePendingByToken(pool: pg.Pool, masterKeyB64: string, token: string): Promise<ByToken> {
  const r = await pool.query(
    "select email, name, company_name, pw_iv, pw_tag, pw_data, expires_at, consumed_at from kaname_auth.pending_signup where token_hash = $1",
    [hashPendingToken(token)],
  );
  const x = r.rows[0];
  if (!x) return { kind: "gone" };
  if (x.consumed_at) return { kind: "done" };
  if (new Date(x.expires_at).getTime() <= Date.now()) return { kind: "gone" };
  return { kind: "ok", pending: row(x, masterKeyB64) };
}
/** 確認が済んだ印。行は消さない（消すと「もう済んでいる」と「期限切れ」が同じ見た目になる） */
export async function consumePending(pool: pg.Pool, email: string): Promise<void> {
  await pool.query("update kaname_auth.pending_signup set consumed_at = now() where email = $1", [
    normalizeEmail(email),
  ]);
}
export async function dropPending(pool: pg.Pool, email: string): Promise<void> {
  await pool.query("delete from kaname_auth.pending_signup where email = $1", [normalizeEmail(email)]);
}
/** 期限の切れた申し込みは残さない（掃除。個人の情報を必要以上に置かない） */
export async function sweepPending(pool: pg.Pool): Promise<number> {
  const r = await pool.query("delete from kaname_auth.pending_signup where expires_at < now() - interval '1 day'");
  return r.rowCount ?? 0;
}
interface Row {
  email: string;
  name: string;
  company_name: string;
  pw_iv: string;
  pw_tag: string;
  pw_data: string;
  expires_at: Date;
}
function row(x: Row, masterKeyB64: string): Pending {
  return {
    email: x.email,
    name: x.name,
    companyName: x.company_name,
    password: masterKeyB64 ? open_(masterKeyB64, { iv: x.pw_iv, tag: x.pw_tag, data: x.pw_data }) : "",
    expiresAt: x.expires_at,
  };
}
