// 依頼のやり取りに書く口（K-908）：postPortalRequestMessage（POST /api/v1/portal/requests/:id/messages・D-155.10・D-155.25・D-155.33・D-155.37・関門 C2・C6）。
//   入口が契約の形（body・知らない欄は 422・道の :id は uuid）を確かめた後、口が値を確かめる：本文は 1〜10000 字（前後の空白を取って空なら 422）・NUL は 422。
//   DB の関数 app.portal_request_post が 1 つの取引で、やり取りの行・asking を new に戻す・証跡・届け先の人の受け箱の行を書く（どれかが落ちれば何も残らない）。
//   30 秒以内の同じ人・同じ依頼・同じ本文は前の行の id を返す（関数が決める。何も増やさず、メールも送らない）。
//   自分のゲストのグループの依頼でない（関数が null）→ 404・NOT_FOUND／もう書けない依頼（P0001・E-GST-170）→ 409・E-GST-170（欄・details なし）／
//   ゲストでない（42501）→ 403・FORBIDDEN／ほか → 503・E-PAGE-003（ログには例外の種類だけ）。
//   取引が済んだ後、受け箱に入れた人へ「リンクだけ」のメールを送る（ゲストの書いた字を載せない）。送れなくても 201 のまま（受け箱の行がその代わり）。
//   Cache-Control: private, no-store は入口の app.ts が全部の答えに付ける
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import type { HookMailer } from "../../../hooks/registry.js";

export const MESSAGE_MAX = 10_000;

const FORBIDDEN: HookReply = { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };
const NOT_FOUND: HookReply = { status: 404, body: { error: "not_found", code: "NOT_FOUND" } };
const CLOSED: HookReply = { status: 409, body: { error: "conflict", code: "E-GST-170" } };

const unavailable = (): HookReply => {
  const e = kanameError("E-PAGE-003").toJSON();
  return { status: 503, body: { error: "unavailable", code: "E-PAGE-003", message: e.message, action: e.action } };
};
/** 例外の種類だけ（DB の番号か名前）。文や値はログに出さない */
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};
const invalid = (message: string): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details: [{ field: "body", message }] },
});

/** 値の確かめ（形は入口が確かめた後）。何も書かずに断る分だけ */
export function checkMessage(
  input: Record<string, unknown>,
): { ok: true; body: string } | { ok: false; reply: HookReply } {
  const body = input["body"];
  if (typeof body !== "string" || body.trim() === "") return { ok: false, reply: invalid("返事を書いてください") };
  if ([...body].length > MESSAGE_MAX) return { ok: false, reply: invalid(`返事は ${MESSAGE_MAX} 字までです`) };
  if (body.includes("\u0000")) return { ok: false, reply: invalid("使えない文字が入っています") };
  return { ok: true, body };
}

/** リンクだけのメール（ゲストの書いた字を載せない・D-155.33） */
export function replyMail(base: string, requestId: string): { subject: string; text: string } {
  return {
    subject: "依頼に返事が届きました",
    text: `依頼に返事が届きました。下のリンクから開いてください。\n\n${base}/requests/${requestId}\n`,
  };
}

export function createPostPortalRequestMessage(
  appPool: pg.Pool,
  mailer?: HookMailer,
  webBaseUrl = "",
): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs) => {
    if (!a.id) return NOT_FOUND;
    const c = checkMessage(a.input);
    if (!c.ok) return c.reply;
    let v: { id: string; emails: string[] } | null;
    try {
      v = await withTenant(appPool, a.ctx, async (cl) => {
        const r = await cl.query<{ v: { id: string; emails: string[] } | null }>(
          "select app.portal_request_post($1::uuid, $2) as v",
          [a.id, c.body],
        );
        return r.rows[0]?.v ?? null;
      });
    } catch (e) {
      const k = kindOf(e);
      if (k === "42501") return FORBIDDEN;
      if (k === "P0001" && (e as { hint?: unknown }).hint === "E-GST-170") return CLOSED;
      console.error(`[portal] 依頼に返事を書く取引が落ちた（${k}）`);
      return unavailable();
    }
    if (v === null) return NOT_FOUND;
    if (!v.id) return unavailable();
    // 取引の後：受け箱に入れた人へリンクだけを送る。送れなくても返事と受け箱の行は残る（関門 C6・[残る]）
    if (mailer) {
      const mail = replyMail(webBaseUrl, a.id);
      for (const to of v.emails ?? []) {
        try {
          await mailer({ to, ...mail });
        } catch (e) {
          console.error(`[portal] 返事の知らせのメールが送れなかった（${kindOf(e)}）`);
        }
      }
    }
    return { status: 201, body: { data: { id: v.id } } };
  };
}
