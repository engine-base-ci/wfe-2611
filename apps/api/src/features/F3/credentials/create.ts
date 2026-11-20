// 預ける口（K-352・契約の口 createCredential・POST /api/v1/credentials・D-101・D-128.57）。
//   順：① 入力の整え（422）② ワークスペースに預ける権限（403・E-CRED-007）③ 本人確認の取り直しか、ログインから 15 分の内（403・STEP_UP_REQUIRED）
//       ④ 同じ層に同じ名前（409・E-CRED-006）⑤ staging／本番で消える保管先（503・E-SEC-002）
//       ⑥ 手順 S1：金庫に入れる［残る］（502・E-SEC-001／503・E-SEC-003）
//       ⑦ 手順 S2：行と証跡を 1 つの取引で書く。書けなければ S1 の物を失効させる（同じ名前に負けたら 409・E-CRED-006／ほかは 503・E-PAGE-003）
//       ⑧ 手順 S3：ログイン情報なら、預けた人の PC に 1 回ログインを試す仕事を積む（D-117）。積めなくても預けたことは取り消さない
//       ⑨ 201・一覧と同じ形（値と金庫の参照は返さない）。Cache-Control: private, no-store は入口（app.ts）が全部の答えに付ける。
//   取引：判定の読み 1（権限・同じ名前）・行と証跡 1・確かめを積む 1・積んだ後の読み直し 1（ログイン情報だけ）。金庫への呼び出しは取引の外で 1 回。
//   表に置くのは金庫の参照だけ。値（パスワード・鍵の値・認証アプリの鍵）は行・答え・証跡・ログのどこにも出さない
import type pg from "pg";
import { withTenant, type TenantContext } from "@kaname/db/context";
import type { SecretsGateway } from "@kaname/secrets";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import {
  fail,
  isReply,
  parseContent,
  parseDescription,
  parseDestinations,
  parseExpiresOn,
  parseLayerKind,
  parseName,
  type Layer,
  type SecretContent,
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
export interface CreateCredentialDeps {
  appPool: pg.Pool;
  secrets: SecretsGateway;
  config: { env: string };
}

interface Checked {
  layer: Layer;
  name: string;
  description: string | null;
  destinations: string[];
  expiresAt: string | null;
  content: SecretContent;
  totpSecret: string | null;
}

const STEP_UP_REQUIRED: HookReply = {
  status: 403,
  body: { error: "step_up_required", code: "STEP_UP_REQUIRED", message: "本人確認を取り直してから" },
};

/** 判定の読み（1 つの取引）：ワークスペースの物を直せるか・同じ層に同じ名前があるか（消した物と失効した物は数えない＝一意の索引と同じ） */
const JUDGE_SQL = `
select has_permission(app.user_id(), 'credentials', null, 'edit') as can_edit,
       exists (select 1 from credentials c
                where c.tenant_id = app.tenant_id() and c.name = $2 and c.layer = $1
                  and c.deleted_at is null and c.revoked_at is null
                  and ($1 = 'workspace' or c.owner_member_id = app.user_id())) as taken`;

/** 行を作る。持ち主は本人・層は本人の層。台帳に同じ宛先のサービスがあれば結ぶ（規約の判定に使う・D-108.4） */
const INSERT_SQL = `
insert into credentials (tenant_id, scope_id, owner_member_id, layer, name, description, kind_id, two_factor_id,
                         destinations, expires_at, vault_ref, service_name, service_domain, service_id, created_by, updated_by)
select app.tenant_id(), m.scope_id, m.id, $1, $2, $3, $4, $5, $6::text[], $7::timestamptz, $8, $2, $9,
       app.credential_service(null, $9), m.id, m.id
  from members m where m.id = app.user_id()
returning id`;

const AUDIT_SQL = "select app.record_audit('credential.create', 'credentials', $1, 'C2', $2::jsonb)";
const ENQUEUE_SQL = "select app.credential_login_check_enqueue(app.user_id(), $1)";
const ONE_SQL = `${CREDENTIAL_SELECT} where c.id = $1`;
/** 同じ層に同じ名前を止める一意の索引（K-351） */
const NAME_INDEXES: readonly string[] = ["credentials_workspace_name_uq", "credentials_personal_name_uq"];

const isNameTaken = (e: unknown): boolean => {
  const x = e as { code?: unknown; constraint?: unknown } | null;
  return x?.code === "23505" && typeof x.constraint === "string" && NAME_INDEXES.includes(x.constraint);
};

/** ① 入力の整え。通れば整えた値、通らなければ 422 の答え */
function check(input: Record<string, unknown>, rawBody: Record<string, unknown>): Checked | HookReply {
  const lk = parseLayerKind(input);
  if (isReply(lk)) return lk;
  const name = parseName(input["name"], rawBody["name"]);
  if (isReply(name)) return name;
  const destinations = parseDestinations(input["destinations"], rawBody["destinations"]);
  if (isReply(destinations)) return destinations;
  const expires = parseExpiresOn(input["expires_on"], undefined, rawBody["expires_on"]);
  if (isReply(expires)) return expires;
  const content = parseContent(lk.kind, input, rawBody);
  if (isReply(content)) return content;
  const totpSecret = content.kind === "login" ? parseTotpSecret(content.twoFactor, input["totp_secret"], rawBody["totp_secret"]) : null;
  if (isReply(totpSecret)) return totpSecret;
  return {
    layer: lk.layer,
    name,
    description: parseDescription(input["description"]),
    destinations,
    expiresAt: expires.expiresAt,
    content,
    totpSecret,
  };
}

export function createCreateCredential(d: CreateCredentialDeps): (a: HookArgs) => Promise<HookReply> {
  /** ②④ の判定の材料を 1 つの取引で読む */
  const judge = (ctx: TenantContext, v: Checked): Promise<{ can_edit: boolean; taken: boolean }> =>
    withTenant(
      d.appPool,
      ctx,
      async (cl) => (await cl.query<{ can_edit: boolean; taken: boolean }>(JUDGE_SQL, [v.layer, v.name])).rows[0]!,
    );

  /** 手順 S2：行と証跡を 1 つの取引で書き、作った行を答えの形で読む（片方だけ残さない） */
  const insert = (ctx: TenantContext, v: Checked, ref: string): Promise<CredentialRow> =>
    withTenant(d.appPool, ctx, async (cl) => {
      const made = await cl.query<{ id: string }>(INSERT_SQL, [
        v.layer,
        v.name,
        v.description,
        vaultKind(v.content),
        v.content.kind === "login" ? v.content.twoFactor : "none",
        v.destinations,
        v.expiresAt,
        ref,
        v.destinations[0]!.replace(/^\*\./, ""),
      ]);
      const id = made.rows[0]?.id;
      if (!id) throw new Error("本人の行が無い");
      // 証跡に書くのは層・種類・名前だけ（値と金庫の参照は書かない）
      await cl.query(AUDIT_SQL, [id, JSON.stringify({ layer: v.layer, kind: v.content.kind, name: v.name })]);
      return (await cl.query<CredentialRow>(ONE_SQL, [id])).rows[0]!;
    });

  /** 手順 S3：確かめの仕事を積み、積んだ後の行（確かめの様子）を読み直す。落ちても預けたことは取り消さない（画面の「もう一度確かめる」で積み直せる） */
  const enqueueCheck = async (ctx: TenantContext, row: CredentialRow): Promise<CredentialRow> => {
    try {
      await withTenant(d.appPool, ctx, (cl) => cl.query(ENQUEUE_SQL, [row.id]));
    } catch (e) {
      console.error(`[credentials] 預けたが、ログインの確かめを積めなかった（${row.id}・${kindOf(e)}）`);
      return row;
    }
    try {
      const again = await withTenant(d.appPool, ctx, (cl) => cl.query<CredentialRow>(ONE_SQL, [row.id]));
      return again.rows[0] ?? row;
    } catch (e) {
      console.error(`[credentials] 預けたが、ログインの確かめの様子を読み直せなかった（${row.id}・${kindOf(e)}）`);
      return row;
    }
  };

  return async (a: HookArgs): Promise<HookReply> => {
    // パスワードと鍵の値は、入口が表記ゆらぎを直す前の値（打ったとおり）を預ける
    const raw = (await a.c.req.json().catch(() => ({}))) as unknown;
    const rawBody = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    const v = check(a.input, rawBody);
    if (isReply(v)) return v;

    let judged: { can_edit: boolean; taken: boolean };
    try {
      judged = await judge(a.ctx, v);
    } catch (e) {
      console.error(`[credentials] 預ける前の判定を読めなかった（${kindOf(e)}）`);
      return unavailable();
    }
    if (v.layer === "workspace" && !judged.can_edit) return fail("E-CRED-007");
    // 取り直しの守りはこの口の 1 層（契約の login_or_step_up は入口が見ない）。判定が渡されなければ閉じた側に倒す
    const stale = a.requireStepUpOrFreshLogin ? a.requireStepUpOrFreshLogin() : STEP_UP_REQUIRED;
    if (stale) return stale;
    if (judged.taken) return fail("E-CRED-006", "name");
    const noPlace = notDurable(d.config.env, d.secrets);
    if (noPlace) return noPlace;

    // 手順 S1：金庫に入れる［残る］。ここから先で落ちたら、置いた物を失効させる
    const stored = await storeSecret(d.secrets, a.ctx, vaultKind(v.content), vaultPayload(v.content, v.totpSecret));
    if (isReply(stored)) return stored;

    // 手順 S2：行と証跡を書く
    let row: CredentialRow;
    try {
      row = await insert(a.ctx, v, stored.ref);
    } catch (e) {
      // 同時に同じ名前で預けた負けの方（一意の索引）も、ほかの失敗も、置いた金庫の物を失効させてから答える
      const taken = isNameTaken(e);
      await revokeStored(d.secrets, a.ctx, stored.ref, taken ? "同じ名前が先に入った" : "行を作れなかった");
      if (taken) return fail("E-CRED-006", "name");
      console.error(`[credentials] 預ける行を作れなかった（${kindOf(e)}）`);
      return unavailable();
    }

    // 手順 S3：ログイン情報だけ、預けた人の PC で 1 回ログインを確かめる
    const final = v.content.kind === "login" ? await enqueueCheck(a.ctx, row) : row;
    // 預けた本人は、その層に書けた人（個人は持ち主・ワークスペースは edit を持つ人）
    return { status: 201, body: { data: toCredential(final, true) } };
  };
}
