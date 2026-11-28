// チケットの設定「項目」を足す・消す（K-720）の形：足す小窓の初めの値・足す口（createTicketField・K-706）の体・消す確かめの注意の文。
//   画面の外の純粋な関数（@/ を読まない・元の配列は変えない）。入力の確かめは K-709 の fieldProblems を使う
import { isChoiceType, type FieldDraft } from "./fields-shape";

/** 足す口の体（契約 createTicketField の入力のうち、この画面が送る所） */
export interface FieldCreateBody {
  name: string;
  field_type: string;
  kind_ids: string[];
  required: boolean;
  description?: string;
  options?: { name: string }[];
}

/** 前後の空白（全角・タブ・改行も）を落とす */
const trimText = (s: string): string => s.replace(/^\s+|\s+$/g, "");

/** 足す小窓の初めの値：名前は空・型は 1 行・必須は外れ・説明は空・今ある全部の種別にチェック・選ぶ物は空の 1 行 */
export function newFieldDraft(allKindIds: readonly string[]): FieldDraft {
  return {
    name: "",
    type: "short_text",
    options: [{ name: "" }],
    required: false,
    description: "",
    kindIds: [...allKindIds],
  };
}

/** 足す口の体：名前と選ぶ物は空白を落とす・種別は全部の種別の並びの順・必須は必ず送る・説明は空なら送らない・選ぶ物は選ぶ型のときだけ */
export function fieldCreateBody(draft: FieldDraft, allKindIds: readonly string[]): FieldCreateBody {
  const description = trimText(draft.description);
  return {
    name: trimText(draft.name),
    field_type: draft.type,
    kind_ids: allKindIds.filter((id) => draft.kindIds.includes(id)),
    required: draft.required,
    ...(description ? { description } : {}),
    ...(isChoiceType(draft.type) ? { options: draft.options.map((o) => ({ name: trimText(o.name) })) } : {}),
  };
}

/** 消す確かめの注意（値が入っているときだけ、見えなくなる数の 1 行を前に置く） */
export function deleteCaution(valueCount: number): string[] {
  const last = "消すと元に戻せません。";
  return valueCount > 0 ? [`${valueCount} 件のチケットに入っている値が見えなくなります。`, last] : [last];
}
