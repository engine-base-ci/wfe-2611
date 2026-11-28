// 消す口（K-353・契約の口 deleteCredential・DELETE /api/v1/credentials/:id・D-128.57・D-128.84）。本人確認の取り直しは要らない（消すは失う方向・D-125.139）。
//   手順 D1：DB の関数 app.credential_soft_delete で、行に deleted_at と revoked_at を立て、確かめの途中の仕事を cancelled にする。
//            証跡 credential.delete を同じ取引で書く。not_found → 404・forbidden → 403・E-CRED-007・例外 → 503・E-PAGE-003（行も金庫も変わらない）
//   手順 D2：金庫の物を失効させる。行はもう消えて取り出せないので、落ちても 200（ログに参照と「後片付け」・運営が消す）
//   答え 200 { data: { id } }。金庫の参照は答えにも証跡にも出さない
import type pg from "pg";
import { withTenant, type TenantContext } from "@kaname/db/context";
import type { SecretsGateway } from "@kaname/secrets";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { fail } from "./input.js";
import { kindOf, revokeStored, unavailable } from "./vault.js";

/** 口が使う材料 */
export interface DeleteCredentialDeps {
  appPool: pg.Pool;
  secrets: SecretsGateway;
}

type Outcome = { status: "ok"; vaultRef: string | null } | { status: "not_found" | "forbidden" };

const SOFT_DELETE_SQL = "select status, vault_ref from app.credential_soft_delete($1)";
/** 証跡の名前と層（行の守りの中で読む。消した行も持ち主か、ワークスペースの物なら読める） */
const NAME_SQL = "select name, layer from credentials where id = $1";
const AUDIT_SQL = "select app.record_audit('credential.delete', 'credentials', $1, 'C2', $2::jsonb)";
const NOT_FOUND: HookReply = { status: 404, body: { error: "not_found", code: "NOT_FOUND" } };

export function createDeleteCredential(d: DeleteCredentialDeps): (a: HookArgs) => Promise<HookReply> {
  /** 手順 D1：消す関数と証跡を 1 つの取引で */
  const softDelete = (ctx: TenantContext, id: string): Promise<Outcome> =>
    withTenant(d.appPool, ctx, async (cl) => {
      const r = (await cl.query<{ status: string; vault_ref: string | null }>(SOFT_DELETE_SQL, [id])).rows[0];
      if (r?.status === "forbidden") return { status: "forbidden" };
      if (r?.status !== "ok") return { status: "not_found" };
      const n = (await cl.query<{ name: string; layer: string }>(NAME_SQL, [id])).rows[0];
      await cl.query(AUDIT_SQL, [id, JSON.stringify({ name: n?.name ?? null, layer: n?.layer ?? null })]);
      return { status: "ok", vaultRef: r.vault_ref };
    });

  return async (a: HookArgs): Promise<HookReply> => {
    const id = a.id!;
    let out: Outcome;
    try {
      out = await softDelete(a.ctx, id);
    } catch (e) {
      console.error(`[credentials] 消す行を直せなかった（${id}・${kindOf(e)}）`);
      return unavailable();
    }
    if (out.status !== "ok") return out.status === "forbidden" ? fail("E-CRED-007") : NOT_FOUND;
    // 手順 D2：金庫の物を失効させる（落ちてもログに参照を残して 200）
    if (out.vaultRef) await revokeStored(d.secrets, a.ctx, out.vaultRef, "消した");
    return { status: 200, body: { data: { id } } };
  };
}
