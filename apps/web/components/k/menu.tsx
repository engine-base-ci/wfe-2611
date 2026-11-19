"use client";
// メニューの型（K-369・Base UI Menu）。開くボタン 1 つと、開いた箱の中の項目の並び（行の「…」など）。
//   キーボード（Enter・Space で開く・↑↓ で項目を移る・Esc で閉じて焦点が開くボタンに戻る）と読み上げ（menu・menuitem）は Base UI に任せる。
//   箱と項目の見た目は選ぶ欄と同じ決まり（k.css の .k-select-popup・.k-select-item）。開くボタン・箱・項目に足すクラスは使う側が className で渡す
//   （幅・色などは、その部品の CSS が正本のトークンで決める）。画面の部品（features）は Base UI を直に読まず、この型を使う。
//   並べ方：<Menu><MenuTrigger>…</MenuTrigger><MenuPopup><MenuItem>…</MenuItem></MenuPopup></Menu>
import { Menu as M } from "@base-ui/react/menu";
import type { ReactNode } from "react";

/** 開くボタンと箱の間（外枠の自分のメニューと同じ） */
const MENU_SIDE_OFFSET = 6;

export interface MenuProps {
  /** 最初から開いておく（モックで中身を見せる） */
  defaultOpen?: boolean;
  children: ReactNode;
}

/** メニューの入れ物（開く・閉じるの状態を持つ） */
export function Menu({ defaultOpen = false, children }: MenuProps) {
  return <M.Root defaultOpen={defaultOpen}>{children}</M.Root>;
}

export interface MenuTriggerProps {
  /** 読み上げの名前（中身が「…」などの印だけのとき） */
  label?: string;
  /** 開くボタンの形（使う側の部品の CSS が決める） */
  className?: string;
  children: ReactNode;
}

/** 開くボタン */
export function MenuTrigger({ label, className, children }: MenuTriggerProps) {
  return (
    <M.Trigger className={className} aria-label={label}>
      {children}
    </M.Trigger>
  );
}

export interface MenuPopupProps {
  /** 箱を、開くボタンのどちらの端にそろえるか */
  align?: "start" | "center" | "end";
  /** 箱に足すクラス（幅の下限など） */
  className?: string;
  children: ReactNode;
}

/** 開いた箱（項目を中に並べる） */
export function MenuPopup({ align = "end", className, children }: MenuPopupProps) {
  return (
    <M.Portal>
      <M.Positioner sideOffset={MENU_SIDE_OFFSET} align={align}>
        <M.Popup className={className ? `k-select-popup ${className}` : "k-select-popup"}>{children}</M.Popup>
      </M.Positioner>
    </M.Portal>
  );
}

export interface MenuItemProps {
  /** 項目を選んだとき（押す・Enter） */
  onSelect?: (() => void) | undefined;
  disabled?: boolean;
  /** 項目に足すクラス（取り消せない操作の色など） */
  className?: string;
  children: ReactNode;
}

/** 箱の中の 1 つの項目 */
export function MenuItem({ onSelect, disabled, className, children }: MenuItemProps) {
  return (
    <M.Item
      className={className ? `k-select-item ${className}` : "k-select-item"}
      disabled={disabled}
      onClick={onSelect}
    >
      {children}
    </M.Item>
  );
}
