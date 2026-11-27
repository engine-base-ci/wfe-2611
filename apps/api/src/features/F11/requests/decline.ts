// 依頼を断る口（K-895）：declineClientRequest（POST /api/v1/client_requests/:id/decline・D-155.9・D-128.103）。
//   入口（op.ts）が先に確かめる：ログイン・社内の人か（ゲストの文脈は 403）・上限・冪等・体の形（reason だけ・strict・NFKC と前後の空白・1〜2000 字）。順：
//   ① 理由が空なら 422（入口の minLength の 2 重）
//   ② 1 つの取引（app.client_request_decline）：依頼を declined・理由・出し手の受け箱・証跡。どれかが落ちたら 503・何も残らない
//   ③ 取引の後、出し手の宛先が分かれば 1 通（関門 C6・リンクだけ）。送れなくても 200（手順 2 [残る]）
//   ④ 送った結果を app.client_request_mail_record で受け箱の email の行に残す。書けなければログに 1 行（宛ては出さない）で 200
//   ⑤ 200 { data: { state: "done" } }。理由は答えにもログにも出さない
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import type { HookDeps } from "../../../hooks/registry.js";
import { requestDeclinedMail } from "./mail.js";
import { bare, invalid, kindOf, unavailable } from "./route.js";

const KIND = "client_request.declined";
const EMPTY = "断る理由を入れてください";

interface Notice {
  member_id?: unknown;
  email?: unknown;
}
interface Declined {
  state?: unknown;
  notice?: Notice | null;
}

/** DB の関数が断った例外 → 答え。知らない例外は 503 */
function declineRefusal(e: unknown): HookReply {
  const x = (e ?? {}) as { code?: unknown; hint?: unknown };
  const code = typeof x.code === "string" ? x.code : "";
  const hint = typeof x.hint === "string" ? x.hint : "";
  if (code === "42501" && hint === "E-GST-100") return bare(404, "E-GST-100");
  if (code === "22023" && hint === "E-GST-130") return bare(409, "E-GST-130");
  if (code === "22023" && hint === "empty") return invalid("reason", EMPTY);
  if (code === "42501" && hint === "") return { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };
  return unavailable("依頼を断る", e);
}

export function createDeclineClientRequest(d: Pick<HookDeps, "appPool" | "mailer"> & { config?: HookDeps["config"] }) {
  /** ④ 送った結果を残す。書けなければログに 1 行（宛て・人の id は出さない） */
  const record = async (a: HookArgs, member: string, ok: boolean): Promise<void> => {
    try {
      await withTenant(d.appPool, a.ctx, async (cl) => {
        await cl.query("select app.client_request_mail_record($1::uuid, $2::uuid, $3, $4)", [a.id, member, KIND, ok]);
      });
    } catch (e) {
      console.error(`[client-requests] 断りのメールの結果を書けなかった（${kindOf(e)}）`);
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
      await d.mailer({ to: email, ...requestDeclinedMail(String(a.id), d.config?.webBaseUrl ?? "") });
    } catch (e) {
      console.error(`[client-requests] 断りのメールを送れなかった（${kindOf(e)}）`);
      ok = false;
    }
    await record(a, member, ok);
  };

  return async (a: HookArgs): Promise<HookReply> => {
    const raw = a.input["reason"];
    const reason = typeof raw === "string" ? raw.trim() : "";
    if (reason === "") return invalid("reason", EMPTY);
    let v: Declined | null;
    try {
      v = await withTenant(d.appPool, a.ctx, async (cl) => {
        const r = await cl.query<{ v: Declined | null }>("select app.client_request_decline($1::uuid, $2) as v", [
          a.id,
          reason,
        ]);
        return r.rows[0]?.v ?? null;
      });
    } catch (e) {
      return declineRefusal(e);
    }
    await notify(a, v?.notice);
    return { status: 200, body: { data: { state: "done" } } };
  };
}
