// 段 5 の更新の行（ticket_messages の kind change）の changes 1 つを、やり取りの流れの文にする（K-574）。純粋な関数・@/ を読まない。
//   返すのは「〈名前〉が」の後ろだけ（名前・「が」・時刻・顔は段 7 の部品 features/F6/thread が付ける）。
//   当たらない欄は null を返し、段 7 の字（知らない欄は「〈欄の鍵〉を変えた」）に落とす。規則の並びは rules.ts。
import { STAGE5_RULES } from "./rules";

/** 口の答えの changes の 1 つ（値の形は書く側の葉が決める・壊れていても落ちない） */
export interface ChangeEntry {
  field: string;
  from: unknown;
  to: unknown;
  note?: string | null;
}
/** 会社の項目の名前の引き先（詳細の答えの fields から作る・change-ctx.ts） */
export interface ChangeCtx {
  fieldName(id: string): string | null;
}
/** 上から最初に当たった規則が文を作る */
export interface ChangeRule {
  id: string;
  match(c: ChangeEntry): boolean;
  text(c: ChangeEntry, ctx: ChangeCtx): string;
}

/** 値を見せる字の長さの上限（超えたら切って「…」） */
export const VALUE_MAX = 40;
const EMPTY = "（空）";
const UNREADABLE = "（読めない値）";

/** 値の見せ方：空は（空）・数と真偽は字・object と配列は（読めない値）・40 字で切る */
export function show(value: unknown): string {
  if (value === null || value === undefined || value === "") return EMPTY;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value !== "string") return UNREADABLE;
  const chars = [...value];
  return chars.length > VALUE_MAX ? `${chars.slice(0, VALUE_MAX).join("")}…` : value;
}

/** 更新の 1 つを文にする。extraRules を先に見て、次に段 5 の表。どれにも当たらなければ null */
export function stage5ChangeText(
  c: ChangeEntry,
  ctx: ChangeCtx,
  extraRules: readonly ChangeRule[] = [],
): string | null {
  for (const rule of [...extraRules, ...STAGE5_RULES]) {
    if (rule.match(c)) return rule.text(c, ctx);
  }
  return null;
}
