// 招待を取り消す口（K-807）：revokeInvitation（DELETE /api/v1/invitations/:id・D-154.21・D-154.25）。
//   入口（op.ts）が先に確かめる：ログイン・権限（members の invite）・上限・道の id（uuid）。
//   1 つの取引（app.invitation_revoke）：錠 → 権限 → 招待（同じ会社・消していない）→ 使われた・もう取り消した →
//   revoked_at を今に（並びから消え、リンクは使えなくなる）→ 頼みの印と受け箱の行を片付ける → 証跡 invitation.revoke。
//   断りは replyOf（404・E-INV-016／409・E-INV-017・018）。DB が落ちた → 503・E-PAGE-003（何も残らない）。メールは出さない
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import { replyOf } from "../gate.js";
import type { AdminOp } from "../op.js";
import { dataReply } from "../shape.js";

/** 答えの鍵（契約 InvitationRevoked・この順で返す） */
export const REVOKED_KEYS = ["id", "revoked_at"] as const;

interface Revoked {
  ok?: boolean;
  error?: string;
  invitation?: { id: string; revoked_at: string };
  [k: string]: unknown;
}

/** 例外の種類だけ（DB の番号か名前）。文や値はログに出さない */
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};

export const ready = true as boolean;

export const run: AdminOp = async ({ d, a }) => {
  if (!a.id) return replyOf({ error: "inv_gone" });
  let v: Revoked;
  try {
    v = await withTenant(d.appPool, a.ctx, async (cl) => {
      const r = await cl.query<{ v: Revoked }>("select app.invitation_revoke($1::uuid) as v", [a.id]);
      return r.rows[0]!.v;
    });
  } catch (e) {
    console.error(`[invite] 招待を取り消す取引が落ちた（${kindOf(e)}）`);
    const x = kanameError("E-PAGE-003").toJSON();
    return { status: 503, body: { error: "unavailable", code: "E-PAGE-003", message: x.message, action: x.action } };
  }
  if (v.error || !v.invitation) return replyOf({ ...v, error: v.error ?? "unknown" });
  return dataReply(200, v.invitation, REVOKED_KEYS);
};
