// 前の道すじ（/api/auth-ext）の id の確かめ（K-145・D-129.42）。契約の入口 op.ts と同じ決まりを 1 部品にした（手書きの正規表現を置かない・L-008）：
//   ・形は契約の isUuid（z.uuid()：版と variant の桁まで見る・nil と max は通す・大文字は通す）
//   ・表記ゆらぎは入口の normalize と同じく NFKC と前後の空白をそろえてから確かめ、通れば揃えた値を使う（K144-API-016）
//   ・違えば 422（欄の名前と理由 "uuid"）。DB の uuid の引数に届かせない（中で 500 にしない）
import { isUuid } from "@kaname/contracts";

/** 正式な uuid なら揃えた値、違えば null（文字でないものも null） */
export function idOf(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.normalize("NFKC").trim();
  return isUuid(s) ? s : null;
}

/** 任意の id の欄：送らない・null は「無し」（null）、正式な uuid は揃えた値、それ以外（空の文字を含む）は false（422 にする） */
export function idOrNull(v: unknown): string | null | false {
  if (v === undefined || v === null) return null;
  return idOf(v) ?? false;
}

/** 問い合わせの id（?x=）：無い・空は指定なし（null）、正式な uuid は揃えた値、それ以外は false */
export function queryId(v: string | undefined): string | null | false {
  if (v === undefined || v === "") return null;
  return idOf(v) ?? false;
}

const LABEL: Record<string, string> = {
  id: "id",
  job_id: "仕事の id",
  conversation_id: "会話の id",
  branch_from: "直す元の文の id",
  session_id: "端末の id",
  memory_id: "記憶の id",
  target_scope_id: "上げ先の層の id",
  message_id: "文の id",
  "quote.message_id": "引用元の文の id",
  attachment_ids: "資料の id",
  quote: "引用",
  attachment_id: "資料の id",
  credential_id: "資格情報の id",
  service_id: "サービスの id",
  run_id: "実行の id",
  employee_id: "AI社員の id",
};

/** 形の違う id の答え（前の道すじの 422 の形＝error・code・message・field に、契約の口と同じ details を足す） */
export function badId(
  c: { json: (b: unknown, s: number) => Response },
  field: string,
  reason: "uuid" | "object" = "uuid",
): Response {
  return c.json(
    {
      error: "validation_failed",
      code: "VALIDATION_FAILED",
      message: `${LABEL[field] ?? field}の形が違います`,
      field,
      details: [{ field, message: reason }],
    },
    422,
  );
}

/** PC の印の頭の形：PC の印（kpc_…）か、前の形（sessions の id＝正式な uuid）。それ以外の形は 401 */
export const isBridgeKeyShape = (v: string | null | undefined): boolean =>
  typeof v === "string" && (/^kpc_[A-Za-z0-9_-]{43}$/.test(v) || isUuid(v));

/** 仕事に付ける資料の id の並び：送らない・null は空、並びでない・どれか 1 つでも形が違えば false（黙って捨てない・D-135.4） */
export function idList(v: unknown): string[] | false {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) return false;
  const out: string[] = [];
  for (const x of v) {
    const id = idOf(x);
    if (!id) return false;
    out.push(id);
  }
  return out;
}
