// 依頼を出す口（K-907）：createPortalRequest（POST /api/v1/portal/requests・D-155.37・D-155.25・D-155.33・D-155.40・関門 C2・C6）。
//   入口が契約の形（body・due_on・attachment_ids・知らない欄は 422）を確かめた後、口が値を確かめる：
//   本文は 1〜10000 字（前後の空白を取って空なら 422）・いつまでには null か暦にある日で日本の今日以降・添付は 0〜5（どれも欄つきの 422）。
//   DB の関数 app.portal_request_create が 1 つの取引で、依頼の行・添付の持ち主替え・証跡・届け先の人の受け箱の行を書く（どれかが落ちれば何も残らない）。
//   60 秒以内の同じ人・同じ本文・同じ期限は前の依頼の id を返す（関数が決める。何も増やさず、メールも送らない）。
//   ゲストでない（42501）→ 403・FORBIDDEN／付けられない添付（P0002・E-GST-160）→ 404・E-GST-160（欄・details なし）／ほか → 503・E-PAGE-003（ログには例外の種類だけ）。
//   取引が済んだ後、受け箱に入れた人へ「リンクだけ」のメールを送る（ゲストの書いた字を載せない）。送れなくても 201 のまま（受け箱の行がその代わり）。
//   Cache-Control: private, no-store は入口の app.ts が全部の答えに付ける
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import type { HookMailer } from "../../../hooks/registry.js";
import { todayJst } from "../../F4/create-ticket/input.js";

export const BODY_MAX = 10_000;
export const ATTACHMENTS_MAX = 5;
const DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

export const FORBIDDEN: HookReply = { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };
export const NOT_FOUND: HookReply = { status: 404, body: { error: "not_found", code: "NOT_FOUND" } };
const BAD_ATTACHMENT: HookReply = { status: 404, body: { error: "not_found", code: "E-GST-160" } };

export const unavailable = (): HookReply => {
  const e = kanameError("E-PAGE-003").toJSON();
  return { status: 503, body: { error: "unavailable", code: "E-PAGE-003", message: e.message, action: e.action } };
};
/** 例外の種類だけ（DB の番号か名前）。文や値はログに出さない */
export const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};
const invalid = (field: string, message: string): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details: [{ field, message }] },
});
const isDate = (v: string): boolean =>
  DATE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);

type Checked = { ok: true; body: string; due: string | null; atts: string[] } | { ok: false; reply: HookReply };

/** 値の確かめ（形は入口が確かめた後）。何も作らずに断る分だけ */
export function checkInput(input: Record<string, unknown>, today: string): Checked {
  const body = input["body"];
  if (typeof body !== "string" || body.trim() === "")
    return { ok: false, reply: invalid("body", "依頼の内容を書いてください") };
  if ([...body].length > BODY_MAX) return { ok: false, reply: invalid("body", `依頼の内容は ${BODY_MAX} 字までです`) };
  if (body.includes("\u0000")) return { ok: false, reply: invalid("body", "使えない文字が入っています") };
  const due = input["due_on"] ?? null;
  if (due !== null) {
    if (typeof due !== "string" || !isDate(due)) return { ok: false, reply: invalid("due_on", "日付の形が違います") };
    if (due < today) return { ok: false, reply: invalid("due_on", "いつまでには今日か、それより後の日にしてください") };
  }
  const atts = input["attachment_ids"] ?? [];
  if (!Array.isArray(atts)) return { ok: false, reply: invalid("attachment_ids", "添付の形が違います") };
  if (atts.length > ATTACHMENTS_MAX)
    return { ok: false, reply: invalid("attachment_ids", `添付は ${ATTACHMENTS_MAX} つまでです`) };
  return { ok: true, body, due, atts: atts as string[] };
}

/** リンクだけのメール（ゲストの書いた字・添付の名前を載せない・D-155.33） */
export function requestMail(base: string, id: string): { subject: string; text: string } {
  return {
    subject: "新しい依頼が届きました",
    text: `新しい依頼が届きました。下のリンクから開いてください。\n\n${base}/requests/${id}\n`,
  };
}

export function createCreatePortalRequest(
  appPool: pg.Pool,
  mailer?: HookMailer,
  webBaseUrl = "",
): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs) => {
    const c = checkInput(a.input, todayJst());
    if (!c.ok) return c.reply;
    let v: { id: string; emails: string[] } | null;
    try {
      v = await withTenant(appPool, a.ctx, async (cl) => {
        const r = await cl.query<{ v: { id: string; emails: string[] } | null }>(
          "select app.portal_request_create($1, $2::date, $3::uuid[]) as v",
          [c.body, c.due, c.atts],
        );
        return r.rows[0]?.v ?? null;
      });
    } catch (e) {
      const k = kindOf(e);
      if (k === "42501") return FORBIDDEN;
      if (k === "P0002" && (e as { hint?: unknown }).hint === "E-GST-160") return BAD_ATTACHMENT;
      console.error(`[portal] 依頼を出す取引が落ちた（${k}）`);
      return unavailable();
    }
    if (!v?.id) return unavailable();
    // 取引の後：受け箱に入れた人へリンクだけを送る。送れなくても依頼と受け箱の行は残る（関門 C6・[残る]）
    if (mailer) {
      const mail = requestMail(webBaseUrl, v.id);
      for (const to of v.emails ?? []) {
        try {
          await mailer({ to, ...mail });
        } catch (e) {
          console.error(`[portal] 依頼の知らせのメールが送れなかった（${kindOf(e)}）`);
        }
      }
    }
    return { status: 201, body: { data: { id: v.id } } };
  };
}
