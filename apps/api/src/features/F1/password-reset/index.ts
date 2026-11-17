// K-313 再設定のメールを頼む（契約の口 requestPasswordReset・POST /api/v1/auth/password/forgot・誰でも呼べる）。
//   答えはいつも 201 { data: { accepted: true } }。登録の有無・確認していない申し込みだけ・60 秒の内・送れなかった・背景で DB が落ちた の
//   どれでも同じ（D-042）。違うのは形の違うメール（422・E-VAL-004）と送りすぎ（429・契約の入口）だけ。
//   送るのは答えの後（afterReply）。待つと登録されている人だけ遅くなり、時間で有無が分かる。
//   送れた／送れなかったときは、本人が今いる会社ごとに security_events（password_reset_requested・detail は sent だけ）を残す（関門 C2）。
//   ログにメールアドレス・手がかりを出さない。宛先は mailTag の印（D-128.146）
import { EMAIL_RE, mailTag, normalizeEmail } from "@kaname/auth/signup";
import { requestReset, type ResetMailer } from "@kaname/auth/reset";
import type pg from "pg";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { afterReply } from "./after-reply.js";

export { resetWorkIdle } from "./after-reply.js";

/** 頼んだ出来事（security_events.kind_id） */
export const RESET_REQUESTED = "password_reset_requested";

export interface PasswordResetDeps {
  /** 認証の接続（kaname_auth の表） */
  authPool: pg.Pool;
  /** 業務の接続（記録の関数 app.record_security_event_for_auth_user） */
  appPool: pg.Pool;
  /** メールの送出（関門 C6・server.ts の 1 か所） */
  mailer?: ResetMailer;
  config: { baseUrl: string; webBaseUrl: string | null };
}

const accepted = (): HookReply => ({ status: 201, body: { data: { accepted: true } } });
const invalidEmail = (): HookReply => {
  const e = kanameError("E-VAL-004", { field: "email" });
  return { status: e.status, body: e.toJSON() };
};
/** 失敗の名前と番号だけ（中身の文に値が入ることがあるので出さない） */
const errSummary = (e: unknown): string => {
  const x = e as { name?: string; code?: string } | null;
  return `${x?.name ?? "Error"}${x?.code ? `（${x.code}）` : ""}`;
};

export function passwordResetFeature(d: PasswordResetDeps) {
  const web = d.config.webBaseUrl ?? d.config.baseUrl;

  /** 答えの後の仕事：送って、送った／送れなかったを記録する。失敗は宛先の印つきで残し、投げない */
  const work = async (email: string): Promise<void> => {
    const tag = mailTag(email);
    let r: Awaited<ReturnType<typeof requestReset>>;
    try {
      r = await requestReset(
        { authPool: d.authPool, ...(d.mailer ? { mailer: d.mailer } : {}), webBaseURL: web },
        email,
      );
    } catch (e) {
      console.error(`[reset] 再設定のリンクを作れなかった → ${tag}: ${errSummary(e)}`);
      return;
    }
    if (r.result === "skipped" || !r.userId) return;
    try {
      await d.appPool.query("select app.record_security_event_for_auth_user($1, $2, $3::jsonb)", [
        r.userId,
        RESET_REQUESTED,
        JSON.stringify({ sent: r.result === "sent" }),
      ]);
    } catch (e) {
      console.error(`[reset] 頼んだ記録を残せなかった → ${tag}: ${errSummary(e)}`);
    }
  };

  /** requestPasswordReset：形を確かめ、仕事を答えの後に回して、すぐ同じ答えを返す */
  const request = async (a: HookArgs): Promise<HookReply> => {
    const raw = a.input["email"];
    const email = typeof raw === "string" ? normalizeEmail(raw) : "";
    if (!EMAIL_RE.test(email)) return invalidEmail();
    afterReply(work(email));
    return accepted();
  };

  return { request };
}
