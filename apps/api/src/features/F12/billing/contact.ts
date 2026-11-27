// 請求先を変える口（updateBillingContact・PATCH /workspace/billing-contact）（K-959・D-156.29・D-156.30）。
//   認証・上限（60/分/人）・能力の無い人と先方の権限の人の 403・入力の形（422：3 欄とも必須・字数・メールの形・空白だけ・余計な欄）は
//   契約の入口（op.ts）が先に確かめる。ここは整え → DB の関数 app.billing_contact_set を withTenant の 1 取引で 1 回。
//   整え：会社名と宛名は NFKC と前後の空白を落とす。メールは前後の空白を落として小文字にする。
//   関数が請求先を書き、管理者全員に画面のお知らせ・記録（関門 C2）を同じ取引で残す。同じ値なら何も書かない。メールは送らない。
//   断りの言葉 → 番号は K-958 の errors.ts。ログに請求先の字（会社名・宛名・メール）を出さない（例外の種類だけ）
import type pg from "pg";
import { EMAIL_RE } from "@kaname/auth/signup";
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { fromCatalog, kindOf, replyOf } from "./errors.js";

export interface BillingContact {
  company: string;
  attn: string;
  email: string;
}

type Fn = { error?: string; data?: BillingContact };

const raw = (v: unknown): string => (typeof v === "string" ? v : "");

/** 整え：会社名と宛名は NFKC と前後の空白、メールは前後の空白と小文字 */
export function normalizeContact(input: Record<string, unknown>): BillingContact {
  return {
    company: raw(input["company"]).normalize("NFKC").trim(),
    attn: raw(input["attn"]).normalize("NFKC").trim(),
    email: raw(input["email"]).trim().toLowerCase(),
  };
}

/** 整えた後に空になった欄（契約の形が先に断るので、ここは 2 層目） */
const blankField = (c: BillingContact): keyof BillingContact | null =>
  (["company", "attn", "email"] as const).find((k) => c[k] === "") ?? null;

/** 契約の上限（会社名・宛名は 100 字まで） */
const NAME_MAX = 100;

/** 契約の形（字数・メールの形）に合わない欄。zod は欄の形を見ないので口が断る */
const badField = (c: BillingContact): { field: keyof BillingContact; message: string } | null => {
  if ([...c.company].length > NAME_MAX) return { field: "company", message: `${NAME_MAX} 字まで` };
  if ([...c.attn].length > NAME_MAX) return { field: "attn", message: `${NAME_MAX} 字まで` };
  if (!EMAIL_RE.test(c.email)) return { field: "email", message: "メールの形" };
  return null;
};

/** 止める側に倒す（503・E-PAGE-003）。ログは決まった字と例外の種類だけ */
const contactDown = (e: unknown): HookReply => {
  console.error(`[billing] 請求先を書けなかった（${kindOf(e)}）`);
  return fromCatalog("E-PAGE-003", 503);
};

export function updateBillingContact(appPool: pg.Pool) {
  return async (a: HookArgs): Promise<HookReply> => {
    const c = normalizeContact(a.input);
    const blank = blankField(c);
    if (blank)
      return {
        status: 422,
        body: {
          error: "validation_failed",
          code: "VALIDATION_ERROR",
          details: [{ field: blank, message: "空白だけでは送れません" }],
        },
      };
    const bad = badField(c);
    if (bad)
      return {
        status: 422,
        body: { error: "validation_failed", code: "VALIDATION_ERROR", details: [bad] },
      };
    let v: Fn | null;
    try {
      v = await withTenant(
        appPool,
        a.ctx,
        async (cl) =>
          (
            await cl.query<{ v: Fn | null }>("select app.billing_contact_set($1, $2, $3) as v", [
              c.company,
              c.attn,
              c.email,
            ])
          ).rows[0]?.v ?? null,
      );
    } catch (e) {
      return contactDown(e);
    }
    if (!v) return contactDown({ name: "empty" });
    if (v.error) return replyOf(v.error);
    if (!v.data) return contactDown({ name: "no_data" });
    return {
      status: 200,
      body: { data: { company: v.data.company, attn: v.data.attn, email: v.data.email } },
    };
  };
}
