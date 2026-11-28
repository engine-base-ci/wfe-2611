// 招待を送り直す口（K-807）：resendInvitation（POST /api/v1/invitations/:id/resend・D-154.12・D-154.21・D-154.25・D-154.35）。
//   入口（op.ts）が先に確かめる：ログイン・権限（members の invite・管理者の束と個別に付けた人。マネージャーは呼べない）・上限・冪等・道の id（uuid）。
//   ① トークン（32 バイトの乱数・base64url）を作り、DB には sha256 だけを渡す（K-419 と同じ形）
//   ② 1 つの取引（app.invitation_resend）：錠 → 権限 → 招待（同じ会社・消していない）→ 使われた・取り消した・1 日 1 回 → リンクと期限（7 日）を新しく →
//      頼みの印と受け箱の行を片付ける → 証跡 invitation.resend。断りは replyOf（404・E-INV-016／409・E-INV-017〜019）。DB が落ちた → 503・E-PAGE-003
//   ③ 取引が終わってから 1 通（関門 C6・文面は K-419 の inviteMail）。送れなければ app.invitation_mail_failed で送り直しの回を戻し、
//      証跡 invitation.mail_failed。証跡も書けなければログに招待の id だけ（宛ては出さない）
//   ④ 200 { id, email, expires_at, mail }
import { createHash, randomBytes } from "node:crypto";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../../contract/deps.js";
import { inviteMail } from "../../invite/mail.js";
import type { AdminDeps } from "../deps.js";
import { replyOf } from "../gate.js";
import type { AdminOp } from "../op.js";
import { dataReply } from "../shape.js";

/** トークンの長さ（バイト）。DB には sha256 だけを置く（packages/auth/src/invitations.ts と同じ形） */
const TOKEN_BYTES = 32;
/** 答えの鍵（契約 InvitationResent・この順で返す） */
export const RESENT_KEYS = ["id", "email", "expires_at", "mail"] as const;

interface Resent {
  ok?: boolean;
  error?: string;
  invitation?: { id: string; email: string; expires_at: string };
  mail?: {
    workspace_name: string | null;
    inviter_name: string | null;
    group_name: string | null;
    role: string | null;
    message: string | null;
  };
  [k: string]: unknown;
}

const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");
/** 例外の種類だけ（DB の番号か名前）。文や値はログに出さない */
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};
const unavailable = (): HookReply => {
  const e = kanameError("E-PAGE-003").toJSON();
  return { status: 503, body: { error: "unavailable", code: "E-PAGE-003", message: e.message, action: e.action } };
};

/** 送れなかった後片付け：送り直しの回を戻し、証跡を書く。書けなければログに招待の id だけ */
async function markFailed(d: AdminDeps, a: HookArgs, id: string): Promise<void> {
  try {
    await withTenant(d.appPool, a.ctx, async (cl) => {
      await cl.query("select app.invitation_mail_failed($1::uuid)", [id]);
    });
  } catch (e) {
    console.error(`[invite] 招待のメールの結果を書けなかった ${id}（${kindOf(e)}）`);
  }
}

/** 取引の後に 1 通送る。送れたら sent・送れなければ後片付けをして failed */
async function send(d: AdminDeps, a: HookArgs, v: Resent, token: string): Promise<"sent" | "failed"> {
  const inv = v.invitation!;
  const facts = v.mail;
  try {
    if (!d.mailer) throw new Error("メールの送出先が無い");
    const mail = inviteMail({
      workspaceName: facts?.workspace_name ?? "ワークスペース",
      inviterName: facts?.inviter_name ?? "ワークスペースの人",
      groupName: facts?.group_name ?? "",
      role: facts?.role ?? "member",
      message: facts?.message ?? null,
      link: `${d.config.webBaseUrl}/invite/${token}`,
      expiresAt: new Date(inv.expires_at),
    });
    await d.mailer({ to: inv.email, ...mail });
    return "sent";
  } catch (e) {
    console.error(`[invite] 送り直しの招待のメールを送れなかった ${inv.id}（${kindOf(e)}）`);
    await markFailed(d, a, inv.id);
    return "failed";
  }
}

export const ready = true as boolean;

export const run: AdminOp = async ({ d, a }) => {
  if (!a.id) return replyOf({ error: "inv_gone" });
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  let v: Resent;
  try {
    v = await withTenant(d.appPool, a.ctx, async (cl) => {
      const r = await cl.query<{ v: Resent }>("select app.invitation_resend($1::uuid, $2) as v", [a.id, sha256(token)]);
      return r.rows[0]!.v;
    });
  } catch (e) {
    console.error(`[invite] 招待を送り直す取引が落ちた（${kindOf(e)}）`);
    return unavailable();
  }
  if (v.error || !v.invitation) return replyOf({ ...v, error: v.error ?? "unknown" });
  const mail = await send(d, a, v, token);
  return dataReply(200, { ...v.invitation, mail }, RESENT_KEYS);
};
