// 請求書の型の設定の画面（K-1108）の形：口の答え（K-1107 の 9 欄）→ 部品の値・欄の値 → 書く口の体・欄の誤りの字。
//   画面の外の純粋な関数だけ（@/ を読まない・試験 apps/web/test/k1108-invoice-template-shape.test.ts）。字は D-156.75

/** 読む口 getOpsInvoiceTemplate の答え（K-1107 の 9 欄・使う欄だけ） */
export interface InvoiceTemplateAnswer {
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

/** 部品の欄の値（部品の名前に合わせる：登録番号は regNo・振込先は bank） */
export interface InvoiceTemplateValues {
  company: string;
  address: string;
  regNo: string;
  contact: string;
  bank: string;
  note: string;
}
export type InvoiceTemplateField = keyof InvoiceTemplateValues;
export type InvoiceTemplateErrors = Partial<Record<InvoiceTemplateField, string>>;

/** 書く口 updateOpsInvoiceTemplate の体（ちょうど 7 つの鍵） */
export interface InvoiceTemplateBody {
  company: string;
  address: string;
  reg_no: string;
  contact: string;
  payee: string;
  note: string;
  version: number;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** 答えの形か（形が違えば画面は「読めない」にする・G-15） */
export function isInvoiceTemplate(d: unknown): d is InvoiceTemplateAnswer {
  if (d === null || typeof d !== "object" || Array.isArray(d)) return false;
  const o = d as Record<string, unknown>;
  const texts = ["company", "address", "reg_no", "contact", "payee", "note"] as const;
  const nullableText = (v: unknown) => v === null || v === undefined || typeof v === "string";
  return (
    texts.every((k) => typeof o[k] === "string") &&
    typeof o["version"] === "number" &&
    Number.isInteger(o["version"]) &&
    nullableText(o["updated_at"]) &&
    nullableText(o["updated_by_name"])
  );
}

const JST_MS = 9 * 60 * 60 * 1000;
const pad2 = (n: number): string => String(n).padStart(2, "0");
/** 時刻 → 日本時間の「MM/DD」（読めない時刻は null） */
function dayOf(iso: string): string | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t + JST_MS);
  return `${pad2(d.getUTCMonth() + 1)}/${pad2(d.getUTCDate())}`;
}

/** 答え → 部品の値と箱の右の字（「11/01 に 佐野 が直した」・直した時刻か人が無ければ null） */
// 今の時刻は形をそろえるため受け取る（日は答えの時刻だけで決まる・試験 K1108-UN-003）
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function viewOf(a: InvoiceTemplateAnswer, _now: Date): { values: InvoiceTemplateValues; aside: string | null } {
  const values: InvoiceTemplateValues = {
    company: str(a.company),
    address: str(a.address),
    regNo: str(a.reg_no),
    contact: str(a.contact),
    bank: str(a.payee),
    note: str(a.note),
  };
  const day = a.updated_at ? dayOf(a.updated_at) : null;
  const who = str(a.updated_by_name).trim();
  return { values, aside: day && who ? `${day} に ${who} が直した` : null };
}

/** 全角の英数字を半角に（登録番号の欄） */
const halfWidth = (s: string): string =>
  s.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
/** 登録番号の正規化：前後の空白を落とし、全角を半角に、頭の t を大文字の T に */
const regNoOf = (s: string): string => halfWidth(s.trim()).toUpperCase();

/** 欄の値と読んだ版 → 書く口の体（前後の空白を落とす） */
export function bodyOf(values: InvoiceTemplateValues, version: number): InvoiceTemplateBody {
  return {
    company: values.company.trim(),
    address: values.address.trim(),
    reg_no: regNoOf(values.regNo),
    contact: values.contact.trim(),
    payee: values.bank.trim(),
    note: values.note.trim(),
    version,
  };
}

/** 書かないといけない欄と、空のときの字 */
const REQUIRED: readonly [InvoiceTemplateField, string][] = [
  ["company", "会社名を書いてください"],
  ["address", "住所を書いてください"],
  ["contact", "連絡先を書いてください"],
  ["bank", "振込先を書いてください"],
];
/** 欄ごとの字数の上限 */
const MAX_LEN: Readonly<Partial<Record<InvoiceTemplateField, number>>> = {
  company: 100,
  address: 200,
  contact: 200,
  bank: 200,
  note: 500,
};
const REG_NO = /^T\d{13}$/;
const REG_NO_TEXT = "登録番号は T と 13 けたの数字で書いてください";

/** 欄の誤りの字（誤りが無ければ空）。1 つでもあれば送らない */
export function errorsOf(values: InvoiceTemplateValues): InvoiceTemplateErrors {
  const out: InvoiceTemplateErrors = {};
  for (const [k, text] of REQUIRED) if (values[k].trim() === "") out[k] = text;
  if (!REG_NO.test(regNoOf(values.regNo))) out.regNo = REG_NO_TEXT;
  for (const [k, max] of Object.entries(MAX_LEN) as [InvoiceTemplateField, number][])
    if (out[k] === undefined && [...values[k].trim()].length > max) out[k] = `${max} 字までにしてください`;
  return out;
}
