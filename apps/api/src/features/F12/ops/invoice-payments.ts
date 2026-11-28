// K-982 運営が入金を 1 件ずつ記録する口（recordPayment・関門 C2・D-156.32・D-156.44・D-128.69・D-128.108・D-156.12・D-156.17）。
//   opsTx（運営の文脈の 1 つの取引）で app.ops_payment_record を呼ぶだけ：請求書の行を取り、入金の行（取り消しなら打ち消しの行）・
//   請求書の状態・運営の記録と会社の記録を同じ取引で書き、運営の請求の 1 行（OpsInvoiceRow）を返す。
//   断りの言葉 → 番号：already_reversed 409 E-BILL-004／amount_mismatch 409 E-BILL-005（欄・details なし・何も書かない）。
//   DB の断りは opsErrorReply（42501 → 403／P0002 → 404 欄なし／ほか → 503 E-PAGE-003）。ログに額・名義を出さない。
//   入力の形（額は 1 以上の整数・入金日は日付・名義 1〜100 字・取り消す入金は uuid・知らない欄）・お金を持つ人・本人確認の取り直しは契約の入口（op.ts）が先に確かめる
import type pg from "pg";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { opsErrorReply, opsTx } from "./db.js";

export interface OpsInvoicePaymentsDeps {
  appPool: pg.Pool;
}

/** 関数の断りの言葉 → 答えの番号 */
const REFUSALS: Readonly<Record<string, string>> = {
  already_reversed: "E-BILL-004",
  amount_mismatch: "E-BILL-005",
};

type Result = { data?: unknown; error?: string };

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

export function createRecordPayment(d: OpsInvoicePaymentsDeps): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const input = a.input;
    let r: Result;
    try {
      r = await opsTx(d.appPool, a.ctx, async (c) => {
        const q = await c.query<{ r: Result }>(
          "select app.ops_payment_record($1::uuid, $2::integer, $3::date, $4::text, $5::uuid) as r",
          [a.id, input["amount"], input["paid_on"], str(input["payer_name"]), str(input["reverses_payment_id"])],
        );
        return q.rows[0]?.r ?? {};
      });
    } catch (e) {
      return opsErrorReply(e, "payments");
    }
    a.c.header("Cache-Control", "private, no-store");
    if (r.error) {
      const code = REFUSALS[r.error];
      if (code) return { status: 409, body: kanameError(code).toJSON() };
      console.error("[ops] payments の DB が知らない断りを返した");
      return { status: 503, body: kanameError("E-PAGE-003").toJSON() };
    }
    return { status: 201, body: { data: r.data ?? null } };
  };
}
