// 請求書の出す側の値を読む 1 か所（K-1107・D-156.59・D-156.60・D-125.24）。
//   請求書の PDF（K-1013 の invoices-pdf.ts）・顧客の請求書の画面の振込先（K-958 の read.ts）・運営の請求書の型の読む口（invoice-template.ts）が使う。
//   運営が請求書の型を保存していれば、その行（app.invoice_issuer()・security definer）だけを読む。1 度も保存していない間は設定の値（BILLING_*）を初めの値にする。
//   呼ぶ側の取引（withTenant／opsTx の client）で読む。設定の値はここ以外で読み分けない（同じ物を 2 つ書かない）
import type pg from "pg";
import type { Config } from "@kaname/config";

/** 請求書に載る出す側の値（会社名・住所・登録番号・連絡先・備考・振込先の行） */
export interface InvoiceIssuerValues {
  name: string;
  address: string;
  invoiceNo: string;
  contact: string;
  note: string;
  payeeLines: readonly string[];
}

/** 同じ取引の client か pool（query だけを使う） */
export type Queryable = pg.Pool | pg.PoolClient;

/** app.invoice_issuer() の答え（行が無ければ null） */
interface Saved {
  company: string;
  address: string;
  reg_no: string;
  contact: string;
  payee: string;
  note: string;
}

/** 1 度も保存していない間の初めの値（設定の値） */
export function issuerFromConfig(cfg: Partial<Config["billing"]> | undefined): InvoiceIssuerValues {
  return {
    name: cfg?.issuer ?? "",
    address: cfg?.issuerAddress ?? "",
    invoiceNo: cfg?.invoiceNo ?? "",
    contact: cfg?.issuerContact ?? "",
    note: cfg?.note ?? "",
    payeeLines: [...(cfg?.payeeLines ?? [])],
  };
}

/** 保存した型の行があればそれ、無ければ設定の値 */
export async function loadInvoiceIssuer(
  q: Queryable,
  cfg: Partial<Config["billing"]> | undefined,
): Promise<InvoiceIssuerValues> {
  const r = await (q as pg.PoolClient).query<{ v: Saved | null }>("select app.invoice_issuer() as v");
  const v = r.rows[0]?.v ?? null;
  if (!v) return issuerFromConfig(cfg);
  return {
    name: v.company,
    address: v.address,
    invoiceNo: v.reg_no,
    contact: v.contact,
    note: v.note,
    payeeLines: [v.payee],
  };
}
