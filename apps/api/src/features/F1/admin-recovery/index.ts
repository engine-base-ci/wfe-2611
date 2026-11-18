// K-305 端末をなくした：ワークスペースの管理者に戻してもらうよう頼む（契約の口 requestAdminRecovery・POST /api/v1/auth/recovery/admin-request）。
//   パスワードを通った直後の待ちの印（pending・5 分）で頼む。待ちの印は使い終わりにしない（頼んだ後にバックアップコードが見つかれば同じ印で入れる）。
//   上限（1 分に 10 回・IP ごと）と入力の形（strict・ほかの欄は 422）は契約の入口（op.ts）が先に確かめる。
//   ① 待ちの印から本人を引く（K-302 と同じ pendingUser）。切れた・でたらめ → 401・E-AUTH-013
//   ② app.request_admin_recovery（関門 C2）が記録と受け箱を書き、宛先（本人が入っている全部の会社の、本人でない管理者）を返す
//   ③ 宛先ごとに関門 C6 の送出の口でメールを送る。送り終えたら app.admin_recovery_send_failed で届いた・届かないを残す
//   ④ 201 { data: { result } }（sent・already・failed・no_admin）。送れなかったときも 201 の failed（記録は残す・決め 12）
//   ⑤ 予期しない例外は 500・E-PAGE-003（中身を返さない）。ログにメール・待ちの印・IP を出さない（宛先は mailTag の印）
import { countryOf } from "@kaname/auth/device";
import { mailTag } from "@kaname/auth/signup";
import { pendingUser } from "@kaname/auth/two_factor";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { kindOf, reply, type LoginDeps } from "../login/shared.js";
import { adminRecoveryMail } from "./mail.js";

/** メールの送出（関門 C6・server.ts の 1 か所）。送れなければ投げる */
export type AdminRecoveryMailer = (m: { to: string; subject: string; text: string }) => Promise<void>;

export interface AdminRecoveryDeps {
  /** 業務の接続（app.request_admin_recovery・app.admin_recovery_send_failed） */
  appPool: LoginDeps["appPool"];
  /** 認証の接続（待ちの印から本人を引く） */
  authPool: LoginDeps["authPool"];
  mailer?: AdminRecoveryMailer;
  /** 運営の連絡先（メールの本文に書く・config.opsEmail。ログインの口の ops_email と同じ値） */
  config: { opsEmail: string };
}

type Result = "sent" | "already" | "failed" | "no_admin";
interface Recipient {
  member_id: string;
  tenant_id: string;
  email: string;
  requester_name: string;
}
interface Requested {
  result: Exclude<Result, "failed">;
  recipients: Recipient[];
}

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const done = (result: Result): HookReply => ({ status: 201, body: { data: { result } } });

export function adminRecoveryFeature(d: AdminRecoveryDeps) {
  /** 前処理（入口の strict な形の確かめより前）：待ちの印が無い・文字でない・空は 422（K-302 の verifySignInCode と同じ） */
  const input = (raw: unknown): { input: Record<string, unknown> } | { reply: HookReply } => {
    const b = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    const p = str(b["pending"]);
    if (p === undefined || p.trim() === "")
      return {
        reply: {
          status: 422,
          body: {
            error: "validation_failed",
            code: "VALIDATION_ERROR",
            details: [{ field: "pending", message: "待ちの印が要る" }],
          },
        },
      };
    return { input: b };
  };

  /** 宛先ごとに送る。送れなかった管理者の member_id を返す（失敗は宛先の印つきでログに残し、投げない） */
  const sendAll = async (recipients: Recipient[]): Promise<string[]> => {
    const failed: string[] = [];
    for (const r of recipients) {
      try {
        if (!d.mailer) throw new Error("メールの送出先が無い");
        await d.mailer({ to: r.email, ...adminRecoveryMail(r.requester_name, d.config.opsEmail) });
      } catch (e) {
        console.error(`[admin-recovery] 管理者に送れなかった → ${mailTag(r.email)}: ${kindOf(e)}`);
        failed.push(r.member_id);
      }
    }
    return failed;
  };

  const request = async (a: HookArgs): Promise<HookReply> => {
    try {
      const userId = await pendingUser(d.authPool, String(a.input["pending"]));
      if (!userId) return reply(401, "E-AUTH-013");
      const r = await d.appPool.query<{ v: Requested }>("select app.request_admin_recovery($1, $2) as v", [
        userId,
        countryOf(a.c.req.raw.headers),
      ]);
      const req = r.rows[0]!.v;
      if (req.result !== "sent") return done(req.result);
      const failed = await sendAll(req.recipients);
      await d.appPool.query("select app.admin_recovery_send_failed($1, $2::uuid[])", [userId, failed]);
      return done(failed.length > 0 ? "failed" : "sent");
    } catch (e) {
      console.error(`[admin-recovery] 管理者に頼む途中で落ちた（${kindOf(e)}）`);
      return reply(500, "E-PAGE-003");
    }
  };

  return { input, request };
}
