// 返事を送って詳しく聞く口（K-893）：replyToClientRequest（POST /api/v1/client_requests/:id/reply・D-155.10・D-128.103）。
//   入口（op.ts）が先に確かめる：ログイン・社内の人か（ゲストの文脈は 403）・上限・冪等・体の形（body だけ・strict・NFKC と前後の空白）。順：
//   ① 本文が空なら 422（入口の minLength の 2 重）
//   ② 1 つの取引（app.client_request_reply）：返事の行・状態 asking・出し手の受け箱・証跡。断りは route.ts と同じ写し、落ちたら 503
//   ③ 取引の後、出し手の宛先が分かれば 1 通（関門 C6）。送れなくても 201（手順 2 [残る]）
//   ④ 送った結果を app.client_request_mail_record で受け箱の email の行に残す。書けなければログに 1 行（宛ては出さない）で 201
//   ⑤ 201 { data: { state: "asking" } }
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import type { HookDeps } from "../../../hooks/registry.js";
import { requestRepliedMail } from "./mail.js";
import { invalid, kindOf, refusal } from "./route.js";

const KIND = "client_request.replied";

interface Notice {
  member_id?: unknown;
  email?: unknown;
}
interface Replied {
  state?: unknown;
  notice?: Notice | null;
}

export function createReplyToClientRequest(d: Pick<HookDeps, "appPool" | "mailer"> & { config?: HookDeps["config"] }) {
  /** ④ 送った結果を残す。書けなければログに 1 行（宛て・人の id は出さない） */
  const record = async (a: HookArgs, member: string, ok: boolean): Promise<void> => {
    try {
      await withTenant(d.appPool, a.ctx, async (cl) => {
        await cl.query("select app.client_request_mail_record($1::uuid, $2::uuid, $3, $4)", [a.id, member, KIND, ok]);
      });
    } catch (e) {
      console.error(`[client-requests] 返事のメールの結果を書けなかった（${kindOf(e)}）`);
    }
  };

  /** ③ 出し手に 1 通。宛てが無ければ送らず記録もしない */
  const notify = async (a: HookArgs, notice: Notice | null | undefined): Promise<void> => {
    const email = typeof notice?.email === "string" && notice.email !== "" ? notice.email : null;
    const member = typeof notice?.member_id === "string" ? notice.member_id : null;
    if (!email || !member) return;
    let ok = true;
    try {
      if (!d.mailer) throw new Error("メールの送出先が無い");
      await d.mailer({ to: email, ...requestRepliedMail(String(a.id), d.config?.webBaseUrl ?? "") });
    } catch (e) {
      console.error(`[client-requests] 返事のメールを送れなかった（${kindOf(e)}）`);
      ok = false;
    }
    await record(a, member, ok);
  };

  return async (a: HookArgs): Promise<HookReply> => {
    const raw = a.input["body"];
    const body = typeof raw === "string" ? raw.trim() : "";
    if (body === "") return invalid("body", "返事を入れてください");
    let v: Replied | null;
    try {
      v = await withTenant(d.appPool, a.ctx, async (cl) => {
        const r = await cl.query<{ v: Replied | null }>("select app.client_request_reply($1::uuid, $2) as v", [
          a.id,
          body,
        ]);
        return r.rows[0]?.v ?? null;
      });
    } catch (e) {
      const x = (e ?? {}) as { code?: unknown; hint?: unknown };
      if (x.code === "22023" && x.hint === "empty") return invalid("body", "返事を入れてください");
      return refusal("返事を送る", e);
    }
    await notify(a, v?.notice);
    return { status: 201, body: { data: { state: "asking" } } };
  };
}
