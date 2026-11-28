// チケットの設定「項目」の差し込み口（K-709）：項目を足す・消す（小窓つき）は別の葉が、FIELD_SLOTS に自分の 1 行だけを足して入れる。
//   各行は入れ物の描きのたびに同じ順で呼ばれる関数（中で React のフックを使ってよい・並びは変えない）。
//   動きの無い操作は押せない形（aria-disabled）で出す（実装が無いのに押せる死にボタンを作らない）。この葉の時点は誰も載せない
import type { ReactNode } from "react";
import { useFieldEditSlot } from "./field-edit-slot";
import type { FieldRowShape } from "./fields-shape";

/** 差し込みが受け取る物 */
export interface FieldCtx {
  fields: readonly FieldRowShape[];
  kinds: readonly { id: string; name: string }[];
  /** 今選んでいる項目（0 件なら undefined） */
  selectedId: string | undefined;
  select: (id: string) => void;
  /** 項目を読み直す */
  reload: () => void;
  /** お知らせを出す */
  notify: (text: string) => void;
}

/** 差し込み 1 つが返す物（どれも任意） */
export interface FieldSlot {
  /** 「項目を足す」を押したとき */
  add?: () => void;
  /** 「この項目を消す…」を押したとき（選んでいる項目の id） */
  delete?: (id: string) => void;
  /** 画面に重ねる小窓 */
  overlay?: ReactNode;
}

export type FieldSlotFn = (ctx: FieldCtx) => FieldSlot;

/** 差し込みの登録（別の葉が 1 行ずつ足す） */
export const FIELD_SLOTS: readonly FieldSlotFn[] = [useFieldEditSlot];

/** 差し込みを 1 つにまとめる（どの欄も先に出した物 1 つ） */
export function mergeFieldSlots(slots: readonly FieldSlotFn[], ctx: FieldCtx): FieldSlot {
  return slots.reduce<FieldSlot>((acc, slot) => {
    const s = slot(ctx);
    const add = acc.add ?? s.add;
    const del = acc.delete ?? s.delete;
    const overlay = acc.overlay ?? s.overlay;
    return { ...(add ? { add } : {}), ...(del ? { delete: del } : {}), ...(overlay ? { overlay } : {}) };
  }, {});
}

/** その操作に動きが無い（押せない形で出す）か */
export const isInertField = (merged: FieldSlot, op: "add" | "delete"): boolean => !merged[op];
