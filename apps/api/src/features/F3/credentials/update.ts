// 上書きの口（K-353・契約の口 updateCredential・PATCH /api/v1/credentials/:id・D-125.151・D-128.57・D-117）。
//   順：① 入力の整え（422。変える物が無い → E-CRED-008）② 行を読む（行の守りの中・消していない・失効していない。無い → 404）
//       ③ ワークスペースの物で edit が無い（403・E-CRED-007）④ 種類ごとの中身（欠け・混ざり → 422・E-CRED-005／E-VAL-003）
//       ⑤ 本人確認の取り直しか、ログインから 15 分の内（403・STEP_UP_REQUIRED）
//       ⑥ 中身を変えない：列だけを直す（金庫に触らず、確かめも積まない）
//       ⑦ 中身を変える：手順 S1 金庫に入れる［残る］→ S2 行の参照を「前の参照のままなら」替え、前の確かめを止め、証跡（1 つの取引。ぶつかれば 409・E-CRED-009）
//          → S3 前の参照を失効（落ちても 200）→ S4 ログイン情報なら上書きした人の PC に確かめを積む（落ちても 200）
//       ⑧ 200・一覧と同じ形（値と金庫の参照は返さない）。Cache-Control: private, no-store は入口（app.ts）が全部の答えに付ける。
//   名前・層・種類は変えられない（契約の strict な形が 422 にする）。ワークスペースの物を中身ごと上書きした人が、その物の持ち主になる（確かめはその人の PC で）。
//   値（パスワード・鍵の値・認証アプリの鍵）は行・答え・証跡・ログのどこにも出さない
import type pg from "pg";
import { withTenant, type TenantContext } from "@kaname/db/context";
import type { SecretsGateway } from "@kaname/secrets";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import {
  conflict409,
  fail,
  invalid,
  isReply,
  parseContent,
  parseDescription,
  parseDestinations,
  parseExpiresOn,
  TWO_FACTORS,
  type SecretContent,
  type TwoFactor,
} from "./input.js";
import { CREDENTIAL_SELECT, toCredential, type CredentialRow } from "./shape.js";
import {
  kindOf,
  notDurable,
  parseTotpSecret,
  revokeStored,
  storeSecret,
  unavailable,
  vaultKind,
  vaultPayload,
} from "./vault.js";

/** 口が使う材料。env と secrets.durable は要求ごとに読む（作った時に写さない） */
export interface UpdateCredentialDeps {
  appPool: pg.Pool;
  secrets: SecretsGateway;
  config: { env: string };
}

/** 中身の外の欄（列だけを直す物）。undefined は「変えない」 */
interface Fields {
  destinations?: string[];
  expiresAt?: string | null;
  description?: string | null;
  twoFactor?: TwoFactor;
}
/** 上書きの前に読む行（行の守りの中） */
interface Current {
  id: string;
  layer: "workspace" | "personal";
  kind_id: string | null;
  two_factor_id: TwoFactor;
  vault_ref: string | null;
  can_edit: boolean;
}
/** 中身を替えるときの新しい中身 */
interface NewContent {
  content: SecretContent;
  totpSecret: string | null;
}

const STEP_UP_REQUIRED: HookReply = {
  status: 403,
  body: { error: "step_up_required", code: "STEP_UP_REQUIRED", message: "本人確認を取り直してから" },
};
const NOT_FOUND: HookReply = { status: 404, body: { error: "not_found", code: "NOT_FOUND" } };
/** 中身の欄（どれかがあれば金庫の中身を替える候補） */
const CONTENT_KEYS: readonly string[] = ["login", "password", "value", "totp_secret"];
/** ログインの種類（shape.ts の LOGIN_KINDS と同じ）。ほかは鍵 */
const LOGIN_KINDS: readonly string[] = ["basic", "password_totp", "email_otp"];

const READ_SQL = `
select c.id, c.layer, c.kind_id, c.two_factor_id, c.vault_ref,
       has_permission(app.user_id(), 'credentials', null, 'edit') as can_edit
  from credentials c
 where c.id = $1 and c.deleted_at is null and c.revoked_at is null`;

/** 列だけを直す（中身を変えない・中身を替える の両方で使う）。$2〜$9 は「変えるか」と値の組。持ち主と参照は呼ぶ側が足す */
const SET_FIELDS = `
       destinations = case when $2 then $3::text[] else destinations end,
       expires_at = case when $4 then $5::timestamptz else expires_at end,
       description = case when $6 then $7 else description end,
       two_factor_id = case when $8 then $9 else two_factor_id end,
       updated_by = app.user_id()`;
const UPDATE_FIELDS_SQL = `
update credentials set ${SET_FIELDS}
 where id = $1 and deleted_at is null and revoked_at is null
returning id`;
/** 中身を替える：前の参照のままのときだけ（ほかが先に替えていたら 0 行）。ワークスペースの物は持ち主を上書きした人に */
const UPDATE_CONTENT_SQL = `
update credentials set ${SET_FIELDS},
       vault_ref = $10, kind_id = coalesce($12, kind_id),
       owner_member_id = case when layer = 'workspace' then app.user_id() else owner_member_id end
 where id = $1 and vault_ref is not distinct from $11 and deleted_at is null and revoked_at is null
returning id`;
const CANCEL_SQL = "select app.credential_cancel_checks($1)";
const AUDIT_SQL = "select app.record_audit('credential.update', 'credentials', $1, 'C2', $2::jsonb)";
const ENQUEUE_SQL = "select app.credential_login_check_enqueue(app.user_id(), $1)";
const ONE_SQL = `${CREDENTIAL_SELECT} where c.id = $1`;

/** ほかの画面が先に中身を替えた（行の参照が前の参照でない） */
class Conflict extends Error {}
/** 行が消えた・失効した（読んだ後に） */
class Gone extends Error {}

const has = (input: Record<string, unknown>, k: string): boolean => input[k] !== undefined;

/** ① 中身の外の欄を整える。通れば欄、通らなければ 422 の答え */
function checkFields(input: Record<string, unknown>, rawBody: Record<string, unknown>): Fields | HookReply {
  let out: Fields = {};
  if (has(input, "destinations")) {
    const d = parseDestinations(input["destinations"], rawBody["destinations"]);
    if (isReply(d)) return d;
    out = { ...out, destinations: d };
  }
  if (has(input, "expires_on")) {
    const e = parseExpiresOn(input["expires_on"], undefined, rawBody["expires_on"]);
    if (isReply(e)) return e;
    out = { ...out, expiresAt: e.expiresAt };
  }
  if (has(input, "description")) out = { ...out, description: parseDescription(input["description"]) };
  if (has(input, "two_factor")) {
    const t = input["two_factor"];
    if (typeof t !== "string" || !(TWO_FACTORS as readonly string[]).includes(t))
      return invalid("two_factor", TWO_FACTORS.join("／"));
    out = { ...out, twoFactor: t as TwoFactor };
  }
  return out;
}

/** 預けた物の種類・2 段階の状態と合わない中身の混ざり（DB の中身で決まるので 409・欄なし） */
const mixed = (): HookReply => conflict409("E-CRED-015");

/** ④ 種類ごとの中身。中身を替えないなら null、替えるなら新しい中身、欠け・混ざりなら 422 の答え */
function checkContent(
  cur: Current,
  input: Record<string, unknown>,
  rawBody: Record<string, unknown>,
  fields: Fields,
): NewContent | null | HookReply {
  const isLogin = cur.kind_id !== null && LOGIN_KINDS.includes(cur.kind_id);
  if (!isLogin) {
    // 鍵：値だけを替えられる。ログインの欄と 2 段階の種類は付けない（E-CRED-005）
    for (const k of ["login", "password", "two_factor", "totp_secret"]) if (has(input, k)) return mixed();
    if (!has(input, "value")) return null;
    const content = parseContent("key", input, rawBody, mixed);
    return isReply(content) ? content : { content, totpSecret: null };
  }
  const twoFactor = fields.twoFactor ?? cur.two_factor_id;
  const totpMoved = (twoFactor === "totp") !== (cur.two_factor_id === "totp");
  if (!CONTENT_KEYS.some((k) => has(input, k)) && !totpMoved) return null;
  // ログイン情報の値を変えるときは ID とパスワードを両方（代表の答え answer=e34268dbfbac）。認証アプリなら鍵も
  // 認証アプリに替える・外すのに中身（login と password）が無い：預けた物の 2 段階の状態で決まるので 409
  if (totpMoved && !has(input, "login") && !has(input, "password")) return mixed();
  const content = parseContent("login", { ...input, two_factor: twoFactor }, rawBody, mixed);
  if (isReply(content)) return content;
  const totpSecret = parseTotpSecret(twoFactor, input["totp_secret"], rawBody["totp_secret"], mixed);
  return isReply(totpSecret) ? totpSecret : { content, totpSecret };
}

/** 証跡に書く「変えた欄の名前」（値は書かない） */
function changedNames(input: Record<string, unknown>): string[] {
  return [
    "login",
    "password",
    "value",
    "two_factor",
    "totp_secret",
    "destinations",
    "expires_on",
    "description",
  ].filter((k) => has(input, k));
}

/** SET_FIELDS の $2〜$9 */
function fieldParams(f: Fields): unknown[] {
  return [
    f.destinations !== undefined,
    f.destinations ?? null,
    f.expiresAt !== undefined,
    f.expiresAt ?? null,
    f.description !== undefined,
    f.description ?? null,
    f.twoFactor !== undefined,
    f.twoFactor ?? null,
  ];
}

export function createUpdateCredential(d: UpdateCredentialDeps): (a: HookArgs) => Promise<HookReply> {
  const readOne = (cl: pg.PoolClient, id: string): Promise<CredentialRow> =>
    cl.query<CredentialRow>(ONE_SQL, [id]).then((r) => r.rows[0]!);
  const writeAudit = (
    cl: pg.PoolClient,
    id: string,
    input: Record<string, unknown>,
    replaced: boolean,
  ): Promise<unknown> =>
    cl.query(AUDIT_SQL, [
      id,
      JSON.stringify({
        fields: changedNames(input),
        value_replaced: replaced,
        reason: typeof input["reason"] === "string" ? input["reason"] : null,
      }),
    ]);

  /** ⑥ 中身を変えない：列だけを直し、証跡と答えの行を同じ取引で */
  const updateFields = (ctx: TenantContext, id: string, f: Fields, input: Record<string, unknown>) =>
    withTenant(d.appPool, ctx, async (cl) => {
      const r = await cl.query(UPDATE_FIELDS_SQL, [id, ...fieldParams(f)]);
      if (!r.rows[0]) throw new Gone();
      await writeAudit(cl, id, input, false);
      return readOne(cl, id);
    });

  /** 手順 S2：行の参照を替え、前の値で動いている確かめを止め、証跡を書く（1 つの取引） */
  const replaceRow = (
    ctx: TenantContext,
    cur: Current,
    f: Fields,
    n: NewContent,
    ref: string,
    input: Record<string, unknown>,
  ) =>
    withTenant(d.appPool, ctx, async (cl) => {
      const loginKind = n.content.kind === "login" ? vaultKind(n.content) : null;
      const cols: Fields = n.content.kind === "login" ? { ...f, twoFactor: n.content.twoFactor } : f;
      const r = await cl.query(UPDATE_CONTENT_SQL, [cur.id, ...fieldParams(cols), ref, cur.vault_ref, loginKind]);
      if (!r.rows[0]) throw new Conflict();
      await cl.query(CANCEL_SQL, [cur.id]);
      await writeAudit(cl, cur.id, input, true);
      return readOne(cl, cur.id);
    });

  /** 手順 S4：確かめの仕事を積み、積んだ後の行を読み直す。落ちても上書きは取り消さない */
  const enqueueCheck = async (ctx: TenantContext, row: CredentialRow): Promise<CredentialRow> => {
    try {
      await withTenant(d.appPool, ctx, (cl) => cl.query(ENQUEUE_SQL, [row.id]));
    } catch (e) {
      console.error(`[credentials] 上書きしたが、ログインの確かめを積めなかった（${row.id}・${kindOf(e)}）`);
      return row;
    }
    try {
      return (await withTenant(d.appPool, ctx, (cl) => readOne(cl, row.id))) ?? row;
    } catch (e) {
      console.error(`[credentials] 上書きしたが、ログインの確かめの様子を読み直せなかった（${row.id}・${kindOf(e)}）`);
      return row;
    }
  };

  /** ⑦ 中身を替える：S1〜S4 */
  const replaceContent = async (a: HookArgs, cur: Current, f: Fields, n: NewContent): Promise<HookReply> => {
    const noPlace = notDurable(d.config.env, d.secrets);
    if (noPlace) return noPlace;
    const stored = await storeSecret(d.secrets, a.ctx, vaultKind(n.content), vaultPayload(n.content, n.totpSecret));
    if (isReply(stored)) return stored;
    let row: CredentialRow;
    try {
      row = await replaceRow(a.ctx, cur, f, n, stored.ref, a.input);
    } catch (e) {
      const conflict = e instanceof Conflict;
      await revokeStored(
        d.secrets,
        a.ctx,
        stored.ref,
        conflict ? "ほかの画面が先に上書きした" : "行を上書きできなかった",
      );
      if (conflict) return fail("E-CRED-009");
      console.error(`[credentials] 上書きの行を直せなかった（${cur.id}・${kindOf(e)}）`);
      return unavailable();
    }
    // 手順 S3：前の参照を失効させる。行はもう新しい参照なので、落ちても前の値は使われない（ログに参照を残し、運営が消す）
    if (cur.vault_ref) await revokeStored(d.secrets, a.ctx, cur.vault_ref, "上書き");
    const final = n.content.kind === "login" ? await enqueueCheck(a.ctx, row) : row;
    return { status: 200, body: { data: toCredential(final, cur.can_edit) } };
  };

  return async (a: HookArgs): Promise<HookReply> => {
    // パスワードと鍵の値は、入口が表記ゆらぎを直す前の値（打ったとおり）を預ける
    const raw = (await a.c.req.json().catch(() => ({}))) as unknown;
    const rawBody = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    if (changedNames(a.input).length === 0) return fail("E-CRED-008");
    const fields = checkFields(a.input, rawBody);
    if (isReply(fields)) return fields;

    let cur: Current | undefined;
    try {
      cur = await withTenant(d.appPool, a.ctx, async (cl) => (await cl.query<Current>(READ_SQL, [a.id])).rows[0]);
    } catch (e) {
      console.error(`[credentials] 上書きの前に行を読めなかった（${kindOf(e)}）`);
      return unavailable();
    }
    if (!cur) return NOT_FOUND;
    if (cur.layer === "workspace" && !cur.can_edit) return fail("E-CRED-007");
    const next = checkContent(cur, a.input, rawBody, fields);
    if (isReply(next)) return next;
    // 取り直しの守りはこの口の 1 層。判定が渡されなければ閉じた側に倒す
    const stale = a.requireStepUpOrFreshLogin ? a.requireStepUpOrFreshLogin() : STEP_UP_REQUIRED;
    if (stale) return stale;
    if (next) return replaceContent(a, cur, fields, next);

    try {
      const row = await updateFields(a.ctx, cur.id, fields, a.input);
      return { status: 200, body: { data: toCredential(row, cur.can_edit) } };
    } catch (e) {
      if (e instanceof Gone) return NOT_FOUND;
      console.error(`[credentials] 上書きの行を直せなかった（${cur.id}・${kindOf(e)}）`);
      return unavailable();
    }
  };
}
