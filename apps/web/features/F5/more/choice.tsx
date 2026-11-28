"use client";
// 丸い選択・四角い選択の 1 行（段 6 core）。印の中心と字の 1 行目の中心をそろえる（ずれは 1px 以下・more.css の .k-more-choice）。
//   差し戻す小窓・確認項目・まとめて承認の四角など、領域の中の選択は全部これを使う。値は props で受け取り、描くだけ（readOnly）。
import type { ReactNode } from "react";
import "./more.css";

interface Props {
  kind: "radio" | "checkbox";
  checked: boolean;
  /** 丸は同じ組の名前 */
  name?: string;
  children: ReactNode;
  className?: string;
}

export function Choice({ kind, checked, name, children, className }: Props) {
  return (
    <label className={className ? `k-dialog-check k-more-choice ${className}` : "k-dialog-check k-more-choice"}>
      <input type={kind} {...(name ? { name } : {})} checked={checked} readOnly />
      <span>{children}</span>
    </label>
  );
}

/** 表の行の選ぶ四角（字の無い四角）。見出しの行は「すべて選ぶ」 */
export function PickBox({ checked, label }: { checked: boolean; label: string }) {
  return <input type="checkbox" className="k-more-pick" aria-label={label} checked={checked} readOnly />;
}
