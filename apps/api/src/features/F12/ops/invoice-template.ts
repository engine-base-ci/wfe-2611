// 請求書の型を読む・直す口（K-1107・getOpsInvoiceTemplate・updateOpsInvoiceTemplate・GET／PUT /api/v1/ops/invoice-template・D-156.59・D-156.60・D-128.108）。
//   お金を持つ運営の人（契約の ops:money）・直すときの本人確認の取り直し（15 分・step_up always）・入力の形（422）・上限は入口。
//   型は運営の会社に 1 つ。読む＝opsTx で app.ops_invoice_template()。行が無ければ設定の値（loadInvoiceIssuer の設定の側）を初めの値・版 0 で返す。
//   直す＝整え（NFKC と前後の空白）→ opsTx で app.ops_invoice_template_set を 1 回（版の食い違いは changed → 409 E-BILL-007・同じ値なら書かない）。
//   直すと、これから出す請求書の PDF と顧客の振込先に効く（どちらも loadInvoiceIssuer で同じ行を読む）。もう出した請求書は変えない。
//   ログは場所と SQLSTATE だけ（opsErrorReply・会社名・住所・振込先の字を出さない）
import type pg from "pg";
import type { Config } from "@kaname/config";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { issuerFromConfig } from "../billing/issuer.js";
import { opsErrorReply, opsTx } from "./db.js";

const WHERE = "invoice-template";

/** 答えの 9 欄（画面の葉 K-1108 の正本） */
export interface OpsInvoiceTemplate {
  company: string;
  address: string;
  reg_no: string;
  contact: string;
  payee: string;
  note: string;
  version: number;
  updated_at: string | null;
  updated_by_name: string | null;
}

export interface InvoiceTemplateDeps {
  appPool: pg.Pool;
  /** 要求の時に読む（材料を作る時に読まない） */
  config: () => Partial<Pick<Config, "billing">> | undefined;
}

type SetAnswer = { data?: OpsInvoiceTemplate; error?: string };

/** 整える欄（登録番号は形が決まっているので整えない＝入口の pattern） */
const TEXT_FIELDS = ["company", "address", "contact", "payee", "note"] as const;
/** 空を許さない欄（備考だけ任意） */
const REQUIRED_TEXT = ["company", "address", "contact", "payee"] as const;

const raw = (v: unknown): string => (typeof v === "string" ? v : "");
const tidy = (v: unknown): string => raw(v).normalize("NFKC").trim();

/** 整えた後の送る値（version はそのまま） */
export function normalizeTemplate(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { reg_no: raw(input["reg_no"]), version: input["version"] };
  for (const k of TEXT_FIELDS) out[k] = tidy(input[k]);
  return out;
}

/** 保存していない間の 9 欄（設定の値・版 0）。振込先は設定の行を半角の空白でつないだ 1 行 */
export function templateFromConfig(cfg: Partial<Config["billing"]> | undefined): OpsInvoiceTemplate {
  const iss = issuerFromConfig(cfg);
  return {
    company: iss.name,
    address: iss.address,
    reg_no: iss.invoiceNo,
    contact: iss.contact,
    payee: iss.payeeLines.join(" "),
    note: iss.note,
    version: 0,
    updated_at: null,
    updated_by_name: null,
  };
}

const down = (why: string): HookReply => {
  console.error(`[ops] ${WHERE} の DB が失敗した（${why}）`);
  return { status: 503, body: kanameError("E-PAGE-003").toJSON() };
};

export function getOpsInvoiceTemplate(d: InvoiceTemplateDeps) {
  return async (a: HookArgs): Promise<HookReply> => {
    let v: OpsInvoiceTemplate | null;
    try {
      v = await opsTx(
        d.appPool,
        a.ctx,
        async (cl) =>
          (await cl.query<{ v: OpsInvoiceTemplate | null }>("select app.ops_invoice_template() as v")).rows[0]?.v ??
          null,
      );
    } catch (e) {
      return opsErrorReply(e, WHERE);
    }
    return { status: 200, body: { data: v ?? templateFromConfig(d.config()?.billing) } };
  };
}

export function updateOpsInvoiceTemplate(d: Pick<InvoiceTemplateDeps, "appPool">) {
  return async (a: HookArgs): Promise<HookReply> => {
    const p = normalizeTemplate(a.input);
    const blank = REQUIRED_TEXT.find((k) => p[k] === "");
    if (blank)
      return {
        status: 422,
        body: {
          error: "validation_failed",
          code: "VALIDATION_ERROR",
          details: [{ field: blank, message: "空白だけでは保存できません" }],
        },
      };
    let r: SetAnswer | null;
    try {
      r = await opsTx(
        d.appPool,
        a.ctx,
        async (cl) =>
          (
            await cl.query<{ v: SetAnswer | null }>("select app.ops_invoice_template_set($1::jsonb) as v", [
              JSON.stringify(p),
            ])
          ).rows[0]?.v ?? null,
      );
    } catch (e) {
      return opsErrorReply(e, WHERE);
    }
    if (!r) return down("empty");
    if (r.error === "changed") return { status: 409, body: kanameError("E-BILL-007").toJSON() };
    if (r.error !== undefined || !r.data) return down(/^[a-z_]+$/.test(String(r.error)) ? String(r.error) : "unknown");
    return { status: 200, body: { data: r.data } };
  };
}
