// 段 5 の更新の行の文の規則（K-574）。上から最初に当たった規則が文を作る（並びが意味を持つ）。
//   字は下絵 v2（f4v2-detail-thread）の言い回し「…しました」「…に変えました」。値の字は書く側が書いた字のまま（show で切る）。
import { show, type ChangeEntry, type ChangeRule } from "./change-text";

/** 真偽として読む（true／"true"・false／"false"）。それ以外は null */
function boolOf(v: unknown): boolean | null {
  if (v === true || v === "true") return true;
  if (v === false || v === "false") return false;
  return null;
}
const isText = (v: unknown): v is string => typeof v === "string" && v !== "" && boolOf(v) === null;
const isEmpty = (v: unknown): boolean => v === null || v === undefined || v === "";
const noteText = (c: ChangeEntry): string | null =>
  typeof c.note === "string" && c.note.trim() !== "" ? c.note : null;
const specName = (v: string): string => `確認項目『${show(v)}』`;
const isSpec = (c: ChangeEntry): boolean => c.field === "test_spec";

/** 固定の欄の鍵 → 画面の名前 */
const FIXED_FIELDS: Readonly<Record<string, string>> = {
  assignee: "担当者",
  due_on: "期限",
  start_on: "開始日",
  priority: "優先度",
  estimate_minutes: "予定時間",
  parent: "親",
};
const FIELD_PREFIX = "field:";
const COMPANY_FIELD = "会社の項目";
const RESTORE_BODY = /^版\s*(\d+)\s*に戻した$/;
const DIGITS = /^\d+$/;

const changed = (name: string, c: ChangeEntry): string => `${name}を ${show(c.from)} → ${show(c.to)} に変えました`;

export const STAGE5_RULES: readonly ChangeRule[] = [
  {
    id: "spec-add",
    match: (c) => isSpec(c) && isEmpty(c.from) && isText(c.to),
    text: (c) => `確認項目を足しました：${show(c.to)}`,
  },
  {
    id: "spec-check",
    match: (c) => isSpec(c) && boolOf(c.from) === false && boolOf(c.to) === true,
    text: (c) => {
      const n = noteText(c);
      return n === null ? "確認項目にチェックを付けました" : `${specName(n)}にチェックを付けました`;
    },
  },
  {
    id: "spec-uncheck",
    match: (c) => isSpec(c) && boolOf(c.from) === true && boolOf(c.to) === false,
    text: (c) => {
      const n = noteText(c);
      return n === null ? "確認項目のチェックを外しました" : `${specName(n)}のチェックを外しました`;
    },
  },
  {
    id: "spec-edit",
    match: (c) => isSpec(c) && isText(c.from) && isText(c.to),
    text: (c) => `${specName(c.to as string)}を直しました`,
  },
  {
    id: "spec-remove",
    match: (c) => isSpec(c) && isText(c.from) && isEmpty(c.to),
    text: (c) => `${specName(c.from as string)}を外しました`,
  },
  {
    id: "body",
    match: (c) => c.field === "body",
    text: (c) => {
      const m = typeof c.note === "string" ? RESTORE_BODY.exec(c.note.trim()) : null;
      return m ? `本文を版 ${m[1]} に戻しました` : "本文を直しました";
    },
  },
  {
    id: "item-restore",
    match: (c) => c.field === "item_restore",
    text: (c) => {
      const from = typeof c.from === "number" ? String(c.from) : c.from;
      return typeof from === "string" && DIGITS.test(from) ? `項目を版 ${from} の形に戻しました` : "項目を戻しました";
    },
  },
  {
    id: "company-field",
    match: (c) => c.field.startsWith(FIELD_PREFIX),
    text: (c, ctx) => changed(ctx.fieldName(c.field.slice(FIELD_PREFIX.length)) ?? COMPANY_FIELD, c),
  },
  {
    id: "fixed-field",
    match: (c) => Object.hasOwn(FIXED_FIELDS, c.field),
    text: (c) => changed(FIXED_FIELDS[c.field] as string, c),
  },
];
