// 本文を書き終える（K-432）の入力の形の確かめ。契約（updateTicketBody）が先に断る物の重ねで、契約に書けない決まりの最後の砦でもある。
//   入力は version（今見ている版・本文の行がまだ無いチケットは 0）と doc（文書の木）だけ。text は受けない（口が doc から作る）。
//   doc の中身の決まりは @kaname/contracts の validateDoc（K-561・K-584）と同じ物。外れは番号なしの 422・欄は version か doc（理由の言葉は details に）
import { validateDoc, type Doc } from "@kaname/contracts";

export interface Detail {
  field: string;
  message: string;
}
export type BodyChecked = { ok: true; version: number; doc: Doc } | { ok: false; details: Detail[] };

/** 版は 0 以上の整数（本文の行がまだ無いチケットは 0） */
const isVersion = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;

export function checkBodyUpdate(input: Record<string, unknown>): BodyChecked {
  const details: Detail[] = [];
  const version = input["version"];
  if (!isVersion(version)) details.push({ field: "version", message: "版は 0 以上の整数で送ってください" });
  const checked = validateDoc(input["doc"]);
  if (!checked.ok) details.push({ field: "doc", message: checked.reason });
  if (details.length || !isVersion(version) || !checked.ok) return { ok: false, details };
  return { ok: true, version, doc: checked.doc };
}
